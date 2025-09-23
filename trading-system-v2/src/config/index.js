/**
 * 系统配置文件
 * 基于环境变量和默认配置
 */

require('dotenv').config();

const config = {
  // 应用配置
  app: {
    name: 'Trading System V2.0',
    version: '2.0.0',
    port: parseInt(process.env.PORT) || 8080,
    env: process.env.NODE_ENV || 'development',
    apiPrefix: process.env.API_PREFIX || '/api/v1'
  },

  // 数据库配置
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    name: process.env.DB_NAME || 'trading_system',
    user: process.env.DB_USER || 'trading_user',
    password: process.env.DB_PASSWORD || 'password',
    connectionLimit: 3,
    acquireTimeout: 20000,
    timeout: 20000,
    reconnect: true,
    idleTimeout: 180000,
    queueLimit: 0,
    // 内存优化配置
    multipleStatements: false,
    dateStrings: true,
    supportBigNumbers: false,
    bigNumberStrings: false
  },

  // Redis配置
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || '',
    maxRetriesPerRequest: 2,
    retryDelayOnFailover: 50,
    enableReadyCheck: false,
    maxMemoryPolicy: 'allkeys-lru',
    maxMemory: '80mb',
    // 内存优化配置
    lazyConnect: true,
    keepAlive: 30000,
    family: 4,
    connectTimeout: 10000,
    commandTimeout: 5000
  },

  // Binance API配置
  binance: {
    apiKey: process.env.BINANCE_API_KEY || '',
    secretKey: process.env.BINANCE_SECRET_KEY || '',
    baseUrl: process.env.BINANCE_BASE_URL || 'https://fapi.binance.com',
    timeout: 10000,
    rateLimit: 1200 // 每分钟请求限制
  },

  // Telegram配置
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
    enabled: process.env.TELEGRAM_ENABLED === 'true'
  },

  // 监控配置
  monitoring: {
    interval: parseInt(process.env.MONITOR_INTERVAL) || 30000,
    cpuThreshold: parseInt(process.env.CPU_THRESHOLD) || 60,
    memoryThreshold: parseInt(process.env.MEMORY_THRESHOLD) || 60,
    diskThreshold: parseInt(process.env.DISK_THRESHOLD) || 80,
    apiSuccessThreshold: 95
  },

  // Telegram配置
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
    enabled: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
  },

  // 策略配置
  strategies: {
    v3: {
      batchSize: parseInt(process.env.V3_BATCH_SIZE) || 5,
      maxSymbols: parseInt(process.env.V3_MAX_SYMBOLS) || 50,
      updateInterval: 5 * 60 * 1000, // 5分钟
      memoryLimit: 150
    },
    ict: {
      batchSize: parseInt(process.env.ICT_BATCH_SIZE) || 5,
      maxSymbols: parseInt(process.env.ICT_MAX_SYMBOLS) || 50,
      updateInterval: 5 * 60 * 1000, // 5分钟
      memoryLimit: 150
    }
  },

  // 缓存配置
  cache: {
    ttl: {
      strategy: parseInt(process.env.CACHE_TTL_STRATEGY) || 300, // 5分钟
      symbol: parseInt(process.env.CACHE_TTL_SYMBOL) || 300, // 5分钟
      statistics: parseInt(process.env.CACHE_TTL_STATISTICS) || 3600, // 1小时
      config: parseInt(process.env.CACHE_TTL_CONFIG) || 86400 // 24小时
    }
  },

  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './logs/app.log',
    maxSize: '10m',
    maxFiles: 5,
    datePattern: 'YYYY-MM-DD'
  },

  // 安全配置
  security: {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15分钟
      max: 100 // 限制每个IP 15分钟内最多100个请求
    }
  },

  // 数据保留配置
  dataRetention: {
    strategyJudgments: 60, // 60天
    simulationTrades: 90, // 90天
    monitoringData: 30, // 30天
    logs: 7 // 7天
  }
};

module.exports = config;
