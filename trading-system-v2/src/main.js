/**
 * 交易系统 V2.0 主应用入口
 * 基于V3和ICT策略的高性能交易系统
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

const config = require('./config');
const logger = require('./utils/logger');
const database = require('./database/connection');
const cache = require('./cache/redis');
const monitoring = require('./monitoring/resource-monitor');
const DataUpdater = require('./services/data-updater');
const MacroMonitorController = require('./services/macro-monitor/macro-monitor-controller');
const AIAnalysisScheduler = require('./services/ai-agent/scheduler');
const TelegramAlert = require('./services/telegram-alert');
const TelegramMonitoringService = require('./services/telegram-monitoring');
const SmartMoneyDetector = require('./services/smart-money-detector');
const LargeOrderDetector = require('./services/large-order/detector'); // V2.1.0新增：大额挂单监控

class TradingSystemApp {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.dataUpdater = null;
    this.macroMonitor = null;
    this.aiScheduler = null;
    this.smartMoneyDetector = null;
    this.largeOrderDetector = null; // V2.1.0新增
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    // 安全中间件
    this.app.use(helmet());

    // CORS配置
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }));

    // 压缩中间件
    this.app.use(compression());

    // 日志中间件
    this.app.use(morgan('combined', {
      stream: { write: message => logger.info(message.trim()) }
    }));

    // 解析中间件
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // 静态文件
    this.app.use(express.static('src/web'));
  }

  setupRoutes() {
    // API路由
    this.app.use('/api/v1/strategies', require('./api/routes/strategies'));
    this.app.use('/api/v1/symbols', require('./api/routes/symbols'));
    this.app.use('/api/v1/trades', require('./api/routes/trades'));
    this.app.use('/api/v1/monitoring', require('./api/routes/monitoring'));
    this.app.use('/api/v1/macro-monitor', require('./api/routes/macro-monitor'));
    // this.app.use('/api/v1/new-coin-monitor', require('./api/routes/new-coin-monitor')); // V2.0禁用：功能未使用
    this.app.use('/api/v1/smart-money', require('./api/routes/smart-money')); // V2.0.1新增：聪明钱跟踪
    // V2.1.0新增：大额挂单监控 - 延迟注册（需要在start中初始化detector）
    this.app.use('/api/v1/tools', require('./api/routes/tools'));
    this.app.use('/api/v1/telegram', require('./api/routes/telegram'));
    this.app.use('/api/v1/settings', require('./api/routes/settings'));
    this.app.use('/api/v1/ai', require('./api/routes/ai-analysis'));

    // 健康检查
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: require('../package.json').version
      });
    });

    // 根路径和前端路由 - 所有前端路由都返回index.html
    this.app.get('/', (req, res) => {
      res.sendFile('index.html', { root: 'src/web' });
    });

    // 前端路由处理 - 支持SPA路由
    this.app.get(['/dashboard', '/strategies', '/monitoring', '/statistics', /* '/new-coin-monitor', */ '/tools', '/smart-money', '/large-orders', '/docs'], (req, res) => {
      res.sendFile('index.html', { root: 'src/web' });
    });
  }

  setupErrorHandling() {
    // 404处理
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
      });
    });

    // 全局错误处理
    this.app.use((err, req, res, next) => {
      logger.error('Unhandled error:', err);

      res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      });
    });
  }

  async start() {
    try {
      // 初始化数据库连接
      await database.connect();
      logger.info('Database connected successfully');

      // 初始化Redis连接
      await cache.connect();
      logger.info('Redis connected successfully');

      // 启动资源监控
      monitoring.start();
      logger.info('Resource monitoring started');

      // 初始化宏观监控
      this.macroMonitor = new MacroMonitorController(database, cache);
      this.app.set('macroMonitor', this.macroMonitor);
      await this.macroMonitor.start();
      logger.info('Macro monitoring started');

      // 初始化AI分析调度器（完全隔离，失败不影响策略执行）
      try {
        logger.info('[AI模块] 开始初始化AI分析调度器...');

        const getAIOps = require('./database/ai-operations');
        const aiOps = getAIOps();
        const BinanceAPI = require('./api/binance-api');
        const binanceAPI = new BinanceAPI();  // 创建实例

        // 使用TelegramMonitoringService（支持从数据库加载配置）
        const telegramService = new TelegramMonitoringService();
        logger.info('[AI模块] 使用TelegramMonitoringService（支持数据库配置）');

        this.aiScheduler = new AIAnalysisScheduler(aiOps, binanceAPI, telegramService);
        global.aiScheduler = this.aiScheduler; // 设置全局变量供API路由使用（向后兼容）
        this.app.set('aiScheduler', this.aiScheduler);  // 注册到Express app

        const aiStarted = await this.aiScheduler.start();
        if (aiStarted) {
          logger.info('[AI模块] ✅ AI分析调度器启动成功（独立运行，不影响策略）');
        } else {
          logger.warn('[AI模块] ⚠️ AI分析调度器未启动（可能已禁用）');
        }
      } catch (error) {
        logger.error('[AI模块] ❌ AI调度器启动失败（不影响策略执行）:', error);
        // AI调度器启动失败不影响主应用和策略执行
        // 策略模块（V3/ICT）继续正常运行
        this.aiScheduler = null;
        global.aiScheduler = null;
      }

      // 为API路由提供数据库连接
      this.app.set('database', database);

      // 初始化聪明钱检测器（V2.0.1新增）
      try {
        logger.info('[聪明钱] 初始化聪明钱检测器...');
        this.smartMoneyDetector = new SmartMoneyDetector(database);
        await this.smartMoneyDetector.initialize();
        this.app.set('smartMoneyDetector', this.smartMoneyDetector);
        logger.info('[聪明钱] ✅ 聪明钱检测器启动成功');
      } catch (error) {
        logger.error('[聪明钱] ❌ 检测器启动失败:', error);
        this.smartMoneyDetector = null;
      }

      // 初始化大额挂单检测器（V2.1.0新增）
      try {
        logger.info('[大额挂单] 初始化大额挂单检测器...');
        const BinanceAPI = require('./api/binance-api');
        const binanceAPIInstance = new BinanceAPI();
        this.largeOrderDetector = new LargeOrderDetector(binanceAPIInstance, database);
        await this.largeOrderDetector.loadConfig();
        
        // 注册API路由（需要detector实例）
        const largeOrderRoutes = require('./api/routes/large-orders')(this.largeOrderDetector, database);
        this.app.use('/api/v1/large-orders', largeOrderRoutes);
        
        // 获取活跃监控交易对并启动监控
        const sql = 'SELECT symbol FROM smart_money_watch_list WHERE is_active = 1 LIMIT 5';
        const rows = await database.query(sql);
        const symbols = rows.map(row => row.symbol);
        
        if (symbols.length > 0) {
          await this.largeOrderDetector.start(symbols);
          logger.info('[大额挂单] ✅ 大额挂单检测器启动成功', { symbols });
        } else {
          logger.warn('[大额挂单] ⚠️ 没有活跃的监控交易对');
        }
        
        this.app.set('largeOrderDetector', this.largeOrderDetector);
      } catch (error) {
        logger.error('[大额挂单] ❌ 检测器启动失败:', error);
        this.largeOrderDetector = null;
      }

      // 暂时禁用数据更新服务以避免连接池问题
      // this.dataUpdater = new DataUpdater(database, cache);
      // this.dataUpdater.start();
      // logger.info('Data updater started');

      // 启动服务器
      this.app.listen(this.port, () => {
        logger.info(`Trading System V2.0 started on port ${this.port}`);
        logger.info(`Environment: ${process.env.NODE_ENV}`);
        logger.info(`Memory limit: ${process.env.MEMORY_LIMIT}MB`);
      });

    } catch (error) {
      logger.error('Failed to start application:', error);
      process.exit(1);
    }
  }

  async stop() {
    try {
      logger.info('Shutting down application...');

      // 停止AI调度器（隔离错误）
      if (this.aiScheduler) {
        try {
          this.aiScheduler.stop();
          logger.info('[AI模块] AI调度器已停止');
        } catch (error) {
          logger.error('[AI模块] AI调度器停止失败（不影响其他服务）:', error);
        }
      }

      // 停止数据更新服务
      if (this.dataUpdater) {
        this.dataUpdater.stop();
      }

      // 停止宏观监控
      if (this.macroMonitor) {
        await this.macroMonitor.stop();
      }

      // 停止监控
      monitoring.stop();

      // 关闭数据库连接
      await database.disconnect();

      // 关闭Redis连接
      await cache.disconnect();

      logger.info('Application stopped successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// 创建应用实例
const app = new TradingSystemApp();

// 启动应用
app.start();

// 优雅关闭
process.on('SIGTERM', () => app.stop());
process.on('SIGINT', () => app.stop());
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  app.stop();
});
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  app.stop();
});

module.exports = app;
