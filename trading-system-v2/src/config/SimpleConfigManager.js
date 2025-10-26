/**
 * 简化的配置管理器
 * 直接使用环境变量，不依赖配置文件
 */

const logger = require('../utils/logger');

class SimpleConfigManager {
  constructor() {
    this.config = this.loadFromEnv();
    logger.info('[SimpleConfigManager] 配置加载完成');
  }

  loadFromEnv() {
    return {
      environment: process.env.NODE_ENV || 'production',
      region: process.env.REGION || 'SG',
      port: process.env.PORT || 3000,
      
      // 数据库配置
      database: {
        mysql: {
          host: process.env.MYSQL_HOST || 'localhost',
          port: process.env.MYSQL_PORT || 3306,
          database: process.env.MYSQL_DATABASE || 'trading_system',
          username: process.env.MYSQL_USERNAME || 'trading_user',
          password: process.env.MYSQL_PASSWORD || 'trading_pass_2024',
        },
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379,
          password: process.env.REDIS_PASSWORD || 'trading_redis_2024',
        }
      },

      // AI服务配置
      ai: {
        providers: {
          claude: {
            apiKey: process.env.CLAUDE_API_KEY || '',
            enabled: !!process.env.CLAUDE_API_KEY,
          },
          deepseek: {
            apiKey: process.env.DEEPSEEK_API_KEY || '',
            enabled: !!process.env.DEEPSEEK_API_KEY,
          },
          openai: {
            apiKey: process.env.OPENAI_API_KEY || '',
            enabled: !!process.env.OPENAI_API_KEY,
          }
        },
        defaultProvider: process.env.AI_DEFAULT_PROVIDER || 'deepseek'
      },

      // 市场配置
      markets: {
        binance: {
          enabled: !!process.env.BINANCE_API_KEY,
          apiKey: process.env.BINANCE_API_KEY || '',
          secretKey: process.env.BINANCE_SECRET_KEY || '',
        },
        alpaca: {
          enabled: !!process.env.ALPACA_API_KEY,
          apiKey: process.env.ALPACA_API_KEY || '',
          secretKey: process.env.ALPACA_SECRET_KEY || '',
        },
        tushare: {
          enabled: !!process.env.TUSHARE_TOKEN,
          token: process.env.TUSHARE_TOKEN || '',
        }
      },

      // 跨区域通信
      messaging: {
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379,
          password: process.env.REDIS_PASSWORD || '',
        },
        channel: process.env.MESSAGING_CHANNEL || 'cross_region_trading_channel',
      },

      // 日志配置
      logger: {
        level: process.env.LOG_LEVEL || 'info',
        console: process.env.LOG_CONSOLE !== 'false',
        file: process.env.LOG_FILE !== 'false',
        filePath: process.env.LOG_FILE_PATH || './logs/app.log',
      }
    };
  }

  get(key, defaultValue = undefined) {
    const keys = key.split('.');
    let value = this.config;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }
    
    return value !== undefined ? value : defaultValue;
  }

  getConfig() {
    return this.config;
  }

  getRegion() {
    return this.config.region;
  }

  getEnvironment() {
    return this.config.environment;
  }

  getDatabaseConfig() {
    return this.config.database;
  }

  getAIConfig() {
    return this.config.ai;
  }

  getMarketConfig() {
    return this.config.markets;
  }

  getMessagingConfig() {
    return this.config.messaging;
  }

  getLoggerConfig() {
    return this.config.logger;
  }

  getMonitoringConfig() {
    return {
      interval: process.env.MONITOR_INTERVAL || 30000,
      cpuThreshold: process.env.CPU_THRESHOLD || 60,
      memoryThreshold: process.env.MEMORY_THRESHOLD || 60,
      diskThreshold: process.env.DISK_THRESHOLD || 80,
      enabled: process.env.MONITORING_ENABLED !== 'false'
    };
  }
}

module.exports = SimpleConfigManager;
