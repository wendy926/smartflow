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

class TradingSystemApp {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.dataUpdater = null;
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
    this.app.use('/api/v1/tools', require('./api/routes/tools'));
    this.app.use('/api/v1/telegram', require('./api/routes/telegram'));
    this.app.use('/api/v1/settings', require('./api/routes/settings'));

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
    this.app.get(['/dashboard', '/strategies', '/monitoring', '/statistics', '/tools', '/docs'], (req, res) => {
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

      // 停止数据更新服务
      if (this.dataUpdater) {
        this.dataUpdater.stop();
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
