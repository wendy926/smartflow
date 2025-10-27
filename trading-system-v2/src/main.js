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
const DatabaseConnection = require('./database/connection');
const database = DatabaseConnection.getInstance ? DatabaseConnection.getInstance() : DatabaseConnection.default;
const cache = require('./cache/redis');
const monitoring = require('./monitoring/resource-monitor');
const DataUpdater = require('./services/data-updater');
const MacroMonitorController = require('./services/macro-monitor/macro-monitor-controller');
const AIAnalysisScheduler = require('./services/ai-agent/scheduler');
const TelegramAlert = require('./services/telegram-alert');
const TelegramMonitoringService = require('./services/telegram-monitoring');
const SmartMoneyDetector = require('./services/smart-money-detector');
const LargeOrderDetector = require('./services/large-order/detector'); // V2.1.0新增：大额挂单监控
const { SmartMoneyV2Monitor } = require('./services/smart-money-v2-monitor'); // V2.3.0新增：聪明钱V2监控
const BacktestManager = require('./services/backtest-manager'); // V2.4.0新增：回测管理器
const BacktestDataService = require('./services/backtest-data-service'); // V2.4.0新增：回测数据服务
const BacktestStrategyEngine = require('./services/backtest-strategy-engine'); // V2.4.0新增：回测策略引擎
const MarketDataPreloader = require('./services/market-data-preloader'); // V2.4.0新增：市场数据预加载器

class TradingSystemApp {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.dataUpdater = null;
    this.macroMonitor = null;
    this.aiScheduler = null;
    this.smartMoneyDetector = null;
    this.largeOrderDetector = null; // V2.1.0新增
    this.smartMoneyV2Monitor = null; // V2.3.0新增
    this.backtestManager = null; // V2.4.0新增：回测管理器
    this.backtestDataService = null; // V2.4.0新增：回测数据服务
    this.backtestStrategyEngine = null; // V2.4.0新增：回测策略引擎
    this.marketDataPreloader = null; // V2.4.0新增：市场数据预加载器
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    // 安全中间件 - 配置CSP以允许CDN资源
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
          fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net", "data:"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          upgradeInsecureRequests: [],
        },
      },
    }));

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
  }

  setupRoutes() {
    // 健康检查端点
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '2.1.0'
      });
    });

    // 导入鉴权中间件
    const { authMiddleware } = require('./middleware/auth');

    // 公开API路由（无需认证）
    this.app.use('/api/v1/auth', require('./api/routes/auth')); // 认证路由（注册登录）

    // 受保护的API路由（需要认证）
    this.app.use('/api/v1/strategies', authMiddleware, require('./api/routes/strategies'));
    this.app.use('/api/v1/symbols', authMiddleware, require('./api/routes/symbols'));
    this.app.use('/api/v1/trades', authMiddleware, require('./api/routes/trades'));
    this.app.use('/api/v1/monitoring', authMiddleware, require('./api/routes/monitoring'));
    this.app.use('/api/v1/macro-monitor', authMiddleware, require('./api/routes/macro-monitor'));
    // this.app.use('/api/v1/new-coin-monitor', require('./api/routes/new-coin-monitor')); // V2.0禁用：功能未使用
    this.app.use('/api/v1/smart-money', authMiddleware, require('./api/routes/smart-money')); // V2.0.1新增：聪明钱跟踪
    this.app.use('/api/v1/smart-money-monitor', authMiddleware, require('./api/routes/smart-money-monitor')); // V2.1.0新增：聪明钱监控
    this.app.use('/api/v1/smart-money-four-phase', authMiddleware, require('./api/routes/smart-money-four-phase')); // V2.2.0新增：四阶段聪明钱检测
    this.app.use('/api/v1/smart-money-four-phase-notifier', authMiddleware, require('./api/routes/smart-money-four-phase-notifier')); // V2.2.1新增：四阶段聪明钱通知
    this.app.use('/api/v1/large-orders', authMiddleware, require('./api/routes/large-orders')()); // V2.1.0新增：大额挂单监控
    this.app.use('/api/v1/large-orders-advanced', authMiddleware, require('./api/routes/large-orders-advanced')()); // V2.2.2新增：大额挂单高级查询
    this.app.use('/api/v1/smart-money-v2', authMiddleware, require('./api/routes/smart-money-v2')()); // V2.3.0新增：聪明钱V2 API
    this.app.use('/api/v1/ict-position', authMiddleware, require('./api/routes/ict-position')); // ICT优化V2.0新增：ICT仓位管理API
    this.app.use('/api/v1/tools', authMiddleware, require('./api/routes/tools'));
    this.app.use('/api/v1/telegram', authMiddleware, require('./api/routes/telegram'));
    this.app.use('/api/v1/settings', authMiddleware, require('./api/routes/settings'));
    this.app.use('/api/v1/ai', authMiddleware, require('./api/routes/ai-analysis'));
    this.app.use('/api/v1/position-monitor', authMiddleware, require('./api/routes/position-monitor'));
    this.app.use('/api/v1/strategy-params', authMiddleware, require('./api/routes/strategy-params')); // 策略参数化调优API

    // 回测API路由
    const { router: backtestRouter, setBacktestServices } = require('./api/routes/backtest');
    this.app.use('/api/v1/backtest', authMiddleware, backtestRouter);
    this.setBacktestServices = setBacktestServices; // 保存设置函数

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

    // 根路径 - 首页介绍页
    this.app.get('/', (req, res) => {
      res.sendFile('home.html', { root: 'src/web' });
    });

    // 加密货币路由 (crypto/*)
    this.app.get(['/crypto/dashboard', '/crypto/strategies', '/crypto/statistics',
      '/crypto/tools', '/crypto/smart-money', '/crypto/large-orders', '/crypto/backtest', '/crypto/strategy-params'],
      (req, res) => {
        res.sendFile('index.html', { root: 'src/web' });
      });

    // A股路由 (a/*)
    this.app.get(['/a/dashboard', '/a/strategies', '/a/statistics', '/a/backtest'],
      (req, res) => {
        res.sendFile('cn-stock.html', { root: 'src/web' });
      });

    // 美股路由 (us/*)
    this.app.get(['/us/dashboard', '/us/strategies', '/us/statistics', '/us/backtest'],
      (req, res) => {
        res.sendFile('us-stock.html', { root: 'src/web' });
      });

    // 系统监控和文档（直接访问）
    this.app.get('/monitoring', (req, res) => {
      res.sendFile('index.html', { root: 'src/web' });
    });

    this.app.get('/docs', (req, res) => {
      res.sendFile('index.html', { root: 'src/web' });
    });

    // 策略参数调优页面（保持原路径，作为加密货币的快捷入口）
    this.app.get(['/strategy-params', '/crypto/strategy-params'], (req, res) => {
      res.sendFile('strategy-params.html', { root: 'src/web' });
    });

    // 兼容旧路由（重定向到新路由）
    this.app.get(['/dashboard', '/strategies', '/statistics'], (req, res) => {
      res.redirect('/crypto' + req.path);
    });

    // 静态文件（放在所有路由之后，避免覆盖路由）
    this.app.use(express.static('src/web'));
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
        this.telegramService = new TelegramMonitoringService();
        logger.info('[AI模块] 使用TelegramMonitoringService（支持数据库配置）');

        this.aiScheduler = new AIAnalysisScheduler(aiOps, binanceAPI, this.telegramService);
        global.aiScheduler = this.aiScheduler; // 设置全局变量供API路由使用（向后兼容）
        this.app.set('aiScheduler', this.aiScheduler);  // 注册到Express app

        // 🔧 初始化AI调度器并启动定时任务（每小时分析一次）
        const aiInitialized = await this.aiScheduler.initialize();
        if (aiInitialized) {
          logger.info('[AI模块] ✅ AI调度器初始化成功');

          // 启动定时任务（每小时宏观分析，每15分钟交易对分析）
          const aiStarted = await this.aiScheduler.start();
          if (aiStarted) {
            logger.info('[AI模块] ✅ AI定时任务已启动（每小时宏观分析，每15分钟交易对分析）');
          } else {
            logger.warn('[AI模块] ⚠️ AI定时任务启动失败');
          }
        } else {
          logger.warn('[AI模块] ⚠️ AI调度器初始化失败');
        }
      } catch (error) {
        logger.error('[AI模块] ❌ AI调度器启动失败（不影响策略执行）:', error);
        // AI调度器启动失败不影响主应用和策略执行
        // 策略模块（V3/ICT）继续正常运行
        this.aiScheduler = null;
        global.aiScheduler = null;
        // 即使AI模块失败，也要保持telegramService可用
        if (!this.telegramService) {
          this.telegramService = new TelegramMonitoringService();
        }
      }

      // 为API路由提供数据库连接
      this.app.set('database', database);

      // 初始化聪明钱检测器（V2.2.0 - 四阶段状态机）
      try {
        logger.info('[聪明钱] 初始化四阶段聪明钱检测器...');
        const SmartMoneyAdapter = require('./services/smart-money/smart-money-adapter');
        const BinanceAPI = require('./api/binance-api');
        const binanceAPIInstance = new BinanceAPI();

        this.smartMoneyDetector = new SmartMoneyAdapter(database, binanceAPIInstance, this.largeOrderDetector);
        await this.smartMoneyDetector.initialize();
        this.app.set('smartMoneyDetector', this.smartMoneyDetector);
        logger.info('[聪明钱] ✅ 四阶段聪明钱检测器启动成功');
      } catch (error) {
        logger.error('[聪明钱] ❌ 检测器启动失败:', error);
        this.smartMoneyDetector = null;
      }

      // 初始化聪明钱实时监控服务（V2.1.0新增）
      try {
        if (this.smartMoneyDetector && this.telegramService) {
          logger.info('[聪明钱监控] 初始化实时监控服务...');
          const SmartMoneyMonitor = require('./services/smart-money-monitor');
          this.smartMoneyMonitor = new SmartMoneyMonitor(database, this.smartMoneyDetector, this.telegramService);
          await this.smartMoneyMonitor.start();
          this.app.set('smartMoneyMonitor', this.smartMoneyMonitor);
          logger.info('[聪明钱监控] ✅ 实时监控服务启动成功');
        } else {
          logger.warn('[聪明钱监控] ⚠️ 跳过启动（依赖服务未就绪）');
        }
      } catch (error) {
        logger.error('[聪明钱监控] ❌ 监控服务启动失败:', error);
        this.smartMoneyMonitor = null;
      }

      // 初始化 ICT 仓位监控服务（ICT优化V2.0新增）
      try {
        logger.info('[ICT仓位监控] 初始化ICT仓位监控服务...');
        const ICTPositionMonitor = require('./services/ict-position-monitor');
        const BinanceAPI = require('./api/binance-api');
        const binanceAPIInstance = new BinanceAPI();

        this.ictPositionMonitor = new ICTPositionMonitor(database, binanceAPIInstance);
        await this.ictPositionMonitor.start();
        this.app.set('ictPositionMonitor', this.ictPositionMonitor);
        logger.info('[ICT仓位监控] ✅ ICT仓位监控服务启动成功');
      } catch (error) {
        logger.error('[ICT仓位监控] ❌ 监控服务启动失败:', error);
        this.ictPositionMonitor = null;
      }

      // 初始化策略参数管理器（策略参数化调优）
      try {
        logger.info('[策略参数] 初始化策略参数管理器...');
        const StrategyParameterManager = require('./services/strategy-parameter-manager');
        this.strategyParamManager = new StrategyParameterManager(database);
        this.app.set('strategyParamManager', this.strategyParamManager);
        logger.info('[策略参数] ✅ 策略参数管理器启动成功');
      } catch (error) {
        logger.error('[策略参数] ❌ 参数管理器启动失败:', error);
        this.strategyParamManager = null;
      }

      // 初始化回测服务（V2.4.0新增）
      try {
        logger.info('[回测服务] 初始化回测管理器V3...');
        const BinanceAPI = require('./api/binance-api');
        const binanceAPIInstance = new BinanceAPI();

        // 使用新的回测管理器V3（直接调用Dashboard策略逻辑）
        const BacktestManagerV3 = require('./services/backtest-manager-v3');
        const BacktestStrategyEngineV3 = require('./services/backtest-strategy-engine-v3');

        this.backtestDataService = new BacktestDataService(database, binanceAPIInstance);
        this.backtestStrategyEngine = new BacktestStrategyEngineV3(); // 使用V3版本
        this.backtestManager = new BacktestManagerV3(database); // 使用V3版本
        this.marketDataPreloader = new MarketDataPreloader(database, binanceAPIInstance);

        // 设置回测服务到API路由
        this.setBacktestServices(this.backtestManager, this.backtestDataService, this.backtestStrategyEngine, this.marketDataPreloader);

        this.app.set('backtestManager', this.backtestManager);
        this.app.set('backtestDataService', this.backtestDataService);
        this.app.set('backtestStrategyEngine', this.backtestStrategyEngine);
        this.app.set('marketDataPreloader', this.marketDataPreloader);

        logger.info('[回测服务] ✅ 回测服务V3启动成功');
      } catch (error) {
        logger.error('[回测服务] ❌ 回测服务启动失败:', error);
        this.backtestManager = null;
        this.backtestDataService = null;
        this.backtestStrategyEngine = null;
      }

      // 初始化四阶段聪明钱Telegram通知服务（V2.2.1新增）
      try {
        if (this.smartMoneyDetector && this.telegramService) {
          logger.info('[四阶段聪明钱通知] 初始化Telegram通知服务...');
          const FourPhaseTelegramNotifier = require('./services/smart-money/four-phase-telegram-notifier');
          this.fourPhaseNotifier = new FourPhaseTelegramNotifier(this.telegramService, database, this.smartMoneyDetector.fourPhaseDetector);
          await this.fourPhaseNotifier.initialize();
          this.app.set('fourPhaseNotifier', this.fourPhaseNotifier);
          logger.info('[四阶段聪明钱通知] ✅ Telegram通知服务启动成功');
        } else {
          logger.warn('[四阶段聪明钱通知] ⚠️ 跳过启动（依赖服务未就绪）');
        }
      } catch (error) {
        logger.error('[四阶段聪明钱通知] ❌ 通知服务启动失败:', error);
        this.fourPhaseNotifier = null;
      }

      // 初始化聪明钱V2监控服务（V2.3.0新增 - 候选-确认分层策略）
      try {
        logger.info('[聪明钱V2] 初始化候选-确认分层检测服务...');
        const BinanceAPI = require('./api/binance-api');
        const binanceAPIInstance = new BinanceAPI();

        this.smartMoneyV2Monitor = new SmartMoneyV2Monitor(database, binanceAPIInstance, this.telegramService);
        await this.smartMoneyV2Monitor.initialize();
        await this.smartMoneyV2Monitor.start();
        this.app.set('smartMoneyV2Monitor', this.smartMoneyV2Monitor);
        logger.info('[聪明钱V2] ✅ 候选-确认分层检测服务启动成功');
      } catch (error) {
        logger.error('[聪明钱V2] ❌ 检测服务启动失败:', error);
        this.smartMoneyV2Monitor = null;
      }

      // 初始化持仓监控服务（V2.1.3新增）
      try {
        logger.info('[持仓监控] 初始化持仓监控服务...');
        const PositionMonitor = require('./services/position-monitor');
        const BinanceAPI = require('./api/binance-api');
        const binanceAPIInstance = new BinanceAPI();
        this.positionMonitor = new PositionMonitor(database, binanceAPIInstance);
        await this.positionMonitor.start();
        this.app.set('positionMonitor', this.positionMonitor);
        logger.info('[持仓监控] ✅ 持仓监控服务启动成功');
      } catch (error) {
        logger.error('[持仓监控] ❌ 监控服务启动失败:', error);
        this.positionMonitor = null;
      }

      // 初始化大额挂单检测器（V2.1.2 - 启用BTCUSDT/ETHUSDT监控）
      try {
        logger.info('[大额挂单] 初始化大额挂单检测器...');
        const BinanceAPI = require('./api/binance-api');
        const binanceAPIInstance = new BinanceAPI();
        this.largeOrderDetector = new LargeOrderDetector(binanceAPIInstance, database);
        await this.largeOrderDetector.loadConfig();

        // 注册到app（供API路由使用）
        this.app.set('largeOrderDetector', this.largeOrderDetector);

        // V2.1.2：启动BTCUSDT和ETHUSDT监控（包含现货和合约）
        // 性能影响：2个交易对 × 2个WebSocket = 4个连接
        const monitoredSymbols = ['BTCUSDT', 'ETHUSDT'];

        // 启动监控（WebSocket模式）
        for (const symbol of monitoredSymbols) {
          this.largeOrderDetector.startMonitoring(symbol);
        }

        logger.info('[大额挂单] ✅ 大额挂单检测器启动成功', {
          symbols: monitoredSymbols,
          mode: 'WebSocket',
          connections: monitoredSymbols.length
        });
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

      // 停止聪明钱监控服务
      if (this.smartMoneyMonitor) {
        try {
          await this.smartMoneyMonitor.stop();
          logger.info('[聪明钱监控] 监控服务已停止');
        } catch (error) {
          logger.error('[聪明钱监控] 监控服务停止失败:', error);
        }
      }

      // 停止四阶段聪明钱通知服务
      if (this.fourPhaseNotifier) {
        try {
          this.fourPhaseNotifier.stopMonitoring();
          logger.info('[四阶段聪明钱通知] 通知服务已停止');
        } catch (error) {
          logger.error('[四阶段聪明钱通知] 通知服务停止失败:', error);
        }
      }

      // 停止持仓监控服务
      if (this.positionMonitor) {
        try {
          await this.positionMonitor.stop();
          logger.info('[持仓监控] 监控服务已停止');
        } catch (error) {
          logger.error('[持仓监控] 监控服务停止失败:', error);
        }
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
