/**
 * 日志管理工具
 * 基于Winston的日志系统
 */

const winston = require('winston');
const path = require('path');
const config = require('../config');

// 创建日志目录
const logDir = path.dirname(config.logging.file);
require('fs').mkdirSync(logDir, { recursive: true });

// 自定义日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// 控制台格式
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// 创建logger实例
const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: { service: 'trading-system' },
  transports: [
    // 错误日志文件
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles
    }),
    // 所有日志文件
    new winston.transports.File({
      filename: config.logging.file,
      maxsize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles
    })
  ]
});

// 开发环境添加控制台输出
if (config.app.env !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// 生产环境添加控制台输出（简化格式）
if (config.app.env === 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// 添加自定义方法
logger.logMemoryUsage = function() {
  const usage = process.memoryUsage();
  this.info('Memory Usage', {
    rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
    external: `${Math.round(usage.external / 1024 / 1024)}MB`
  });
};

logger.logSystemInfo = function() {
  this.info('System Info', {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    uptime: `${Math.round(process.uptime())}s`,
    pid: process.pid
  });
};

module.exports = logger;
