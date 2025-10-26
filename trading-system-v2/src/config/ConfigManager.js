/**
 * 统一配置管理器
 * 支持多环境、多区域配置管理
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// 环境枚举
const Environment = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production'
};

// 区域枚举
const Region = {
  SG: 'SG',
  CN: 'CN'
};

// 市场类型枚举
const MarketType = {
  CRYPTO: 'crypto',
  CN_STOCK: 'cn_stock',
  US_STOCK: 'us_stock'
};

// AI提供商枚举
const AIProvider = {
  CLAUDE: 'claude',
  DEEPSEEK: 'deepseek',
  OPENAI: 'openai'
};

/**
 * 配置管理器
 */
class ConfigManager {
  constructor() {
    this.config = null;
    this.environment = process.env.NODE_ENV || Environment.DEVELOPMENT;
    this.region = process.env.REGION || Region.SG;
    this.configPath = process.env.CONFIG_PATH || './config';

    this.loadConfig();
  }

  /**
   * 加载配置
   */
  loadConfig() {
    try {
      // 加载基础配置
      const baseConfig = this.loadConfigFile('base.json');

      // 加载环境配置
      const envConfig = this.loadConfigFile(`${this.environment}.json`);

      // 加载区域配置
      const regionConfig = this.loadConfigFile(`regions/${this.region}.json`);

      // 合并配置
      this.config = this.mergeConfigs(baseConfig, envConfig, regionConfig);

      // 加载环境变量覆盖
      this.loadEnvironmentOverrides();

      // 验证配置
      this.validateConfig();

      logger.info(`[ConfigManager] Configuration loaded for ${this.environment}/${this.region}`);

    } catch (error) {
      logger.error('[ConfigManager] Failed to load configuration:', error);
      throw error;
    }
  }

  /**
   * 加载配置文件
   */
  loadConfigFile(filename) {
    try {
      const filePath = path.join(this.configPath, filename);

      if (!fs.existsSync(filePath)) {
        logger.warn(`[ConfigManager] Config file not found: ${filePath}`);
        return {};
      }

      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);

    } catch (error) {
      logger.error(`[ConfigManager] Failed to load config file ${filename}:`, error);
      return {};
    }
  }

  /**
   * 合并配置
   */
  mergeConfigs(...configs) {
    return configs.reduce((merged, config) => {
      return this.deepMerge(merged, config);
    }, {});
  }

  /**
   * 深度合并对象
   */
  deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  /**
   * 加载环境变量覆盖
   */
  loadEnvironmentOverrides() {
    const overrides = {
      // 基础配置
      environment: this.environment,
      region: this.region,

      // 数据库配置
      'database.mysql.host': process.env.MYSQL_HOST,
      'database.mysql.port': process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT) : undefined,
      'database.mysql.database': process.env.MYSQL_DATABASE,
      'database.mysql.username': process.env.MYSQL_USERNAME,
      'database.mysql.password': process.env.MYSQL_PASSWORD,

      // Redis配置
      'database.redis.host': process.env.REDIS_HOST,
      'database.redis.port': process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : undefined,
      'database.redis.password': process.env.REDIS_PASSWORD,

      // AI服务配置
      'ai.providers.claude.apiKey': process.env.CLAUDE_API_KEY,
      'ai.providers.deepseek.apiKey': process.env.DEEPSEEK_API_KEY,
      'ai.providers.openai.apiKey': process.env.OPENAI_API_KEY,

      // 市场配置
      'markets.crypto.apiKey': process.env.BINANCE_API_KEY,
      'markets.crypto.secretKey': process.env.BINANCE_SECRET_KEY,
      'markets.cnStock.tushareToken': process.env.TUSHARE_TOKEN,
      'markets.usStock.apiKey': process.env.ALPACA_API_KEY,
      'markets.usStock.secretKey': process.env.ALPACA_SECRET_KEY,

      // 监控配置
      'monitoring.prometheus.port': process.env.PROMETHEUS_PORT ? parseInt(process.env.PROMETHEUS_PORT) : undefined,
      'monitoring.grafana.port': process.env.GRAFANA_PORT ? parseInt(process.env.GRAFANA_PORT) : undefined
    };

    for (const [key, value] of Object.entries(overrides)) {
      if (value !== undefined) {
        this.setNestedValue(key, value);
      }
    }
  }

  /**
   * 设置嵌套值
   */
  setNestedValue(key, value) {
    const keys = key.split('.');
    let current = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * 验证配置
   */
  validateConfig() {
    const requiredFields = [
      'environment',
      'region',
      'database.mysql.host',
      'database.redis.host',
      'ai.defaultProvider'
    ];

    for (const field of requiredFields) {
      if (!this.getNestedValue(field)) {
        throw new Error(`Required configuration field missing: ${field}`);
      }
    }

    // 验证市场配置
    this.validateMarketConfig();

    // 验证AI配置
    this.validateAIConfig();

    logger.info('[ConfigManager] Configuration validation passed');
  }

  /**
   * 验证市场配置
   */
  validateMarketConfig() {
    const markets = this.config.markets || {};

    for (const [marketType, marketConfig] of Object.entries(markets)) {
      if (marketConfig.enabled) {
        if (!marketConfig.adapter) {
          throw new Error(`Market ${marketType} is enabled but no adapter specified`);
        }

        if (!marketConfig.symbols || marketConfig.symbols.length === 0) {
          throw new Error(`Market ${marketType} is enabled but no symbols specified`);
        }
      }
    }
  }

  /**
   * 验证AI配置
   */
  validateAIConfig() {
    const aiConfig = this.config.ai || {};
    const defaultProvider = aiConfig.defaultProvider;

    if (!defaultProvider) {
      throw new Error('No default AI provider specified');
    }

    const providers = aiConfig.providers || {};
    if (!providers[defaultProvider]) {
      throw new Error(`Default AI provider ${defaultProvider} not configured`);
    }

    const providerConfig = providers[defaultProvider];
    if (!providerConfig.apiKey) {
      throw new Error(`AI provider ${defaultProvider} missing API key`);
    }
  }

  /**
   * 获取嵌套值
   */
  getNestedValue(key) {
    const keys = key.split('.');
    let current = this.config;

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * 获取完整配置
   */
  getConfig() {
    return this.config;
  }

  /**
   * 获取环境
   */
  getEnvironment() {
    return this.environment;
  }

  /**
   * 获取区域
   */
  getRegion() {
    return this.region;
  }

  /**
   * 获取数据库配置
   */
  getDatabaseConfig() {
    return this.config.database || {};
  }

  /**
   * 获取市场配置
   */
  getMarketConfig(marketType) {
    return this.config.markets?.[marketType] || {};
  }

  /**
   * 获取AI配置
   */
  getAIConfig() {
    return this.config.ai || {};
  }

  /**
   * 获取AI提供商配置
   */
  getAIProviderConfig(provider) {
    return this.config.ai?.providers?.[provider] || {};
  }

  /**
   * 获取监控配置
   */
  getMonitoringConfig() {
    return this.config.monitoring || {};
  }

  /**
   * 获取消息队列配置
   */
  getMessagingConfig() {
    return this.config.messaging || {};
  }

  /**
   * 检查市场是否启用
   */
  isMarketEnabled(marketType) {
    return this.config.markets?.[marketType]?.enabled === true;
  }

  /**
   * 检查AI提供商是否配置
   */
  isAIProviderConfigured(provider) {
    const providerConfig = this.config.ai?.providers?.[provider];
    return providerConfig && providerConfig.apiKey;
  }

  /**
   * 重新加载配置
   */
  reload() {
    logger.info('[ConfigManager] Reloading configuration...');
    this.loadConfig();
  }

  /**
   * 获取配置摘要
   */
  getConfigSummary() {
    return {
      environment: this.environment,
      region: this.region,
      enabledMarkets: Object.entries(this.config.markets || {})
        .filter(([_, config]) => config.enabled)
        .map(([type, _]) => type),
      defaultAIProvider: this.config.ai?.defaultProvider,
      configuredAIProviders: Object.keys(this.config.ai?.providers || {}),
      database: {
        mysql: !!this.config.database?.mysql?.host,
        redis: !!this.config.database?.redis?.host
      }
    };
  }
}

/**
 * SG机房配置
 */
const sgConfig = {
  environment: Environment.PRODUCTION,
  region: Region.SG,

  database: {
    mysql: {
      host: 'sg-mysql-cluster.internal',
      port: 3306,
      database: 'trading_sg',
      username: 'trading_user',
      password: process.env.MYSQL_PASSWORD,
      pool: {
        min: 5,
        max: 20,
        acquireTimeoutMillis: 30000,
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 200
      }
    },
    redis: {
      host: 'sg-redis-cluster.internal',
      port: 6379,
      password: process.env.REDIS_PASSWORD,
      db: 0,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    },
    influxdb: {
      host: 'sg-influxdb.internal',
      port: 8086,
      database: 'trading_metrics',
      username: 'trading_user',
      password: process.env.INFLUXDB_PASSWORD
    }
  },

  markets: {
    crypto: {
      enabled: true,
      adapter: 'BinanceAdapter',
      symbols: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'BNBUSDT', 'XRPUSDT'],
      tradingHours: '24/7',
      config: {
        apiKey: process.env.BINANCE_API_KEY,
        secretKey: process.env.BINANCE_SECRET_KEY,
        baseURL: 'https://fapi.binance.com',
        testnet: false
      }
    },
    usStock: {
      enabled: true,
      adapter: 'USStockAdapter',
      symbols: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'],
      tradingHours: '09:30-16:00 ET',
      config: {
        alpaca: {
          apiKey: process.env.ALPACA_API_KEY,
          secretKey: process.env.ALPACA_SECRET_KEY,
          baseURL: 'https://paper-api.alpaca.markets'
        },
        alphaVantage: {
          apiKey: process.env.ALPHA_VANTAGE_API_KEY,
          baseURL: 'https://www.alphavantage.co/query'
        }
      }
    },
    cnStock: {
      enabled: false, // SG机房不直接交易A股
      adapter: 'ChinaStockAdapter'
    }
  },

  ai: {
    providers: {
      claude: {
        apiKey: process.env.CLAUDE_API_KEY,
        baseURL: 'https://api.anthropic.com',
        model: 'claude-3.5-sonnet'
      },
      deepseek: {
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: 'https://api.deepseek.com',
        model: 'deepseek-chat'
      }
    },
    defaultProvider: AIProvider.CLAUDE
  },

  messaging: {
    redis: {
      host: 'sg-redis-cluster.internal',
      port: 6379,
      password: process.env.REDIS_PASSWORD,
      db: 1
    },
    topics: [
      'data.sync.request',
      'data.sync.response',
      'ai.analysis.request',
      'ai.analysis.response',
      'trading.signal',
      'risk.alert',
      'system.status',
      'heartbeat'
    ]
  },

  monitoring: {
    prometheus: {
      port: 9090,
      path: '/metrics'
    },
    grafana: {
      port: 3000,
      adminUser: 'admin',
      adminPassword: process.env.GRAFANA_ADMIN_PASSWORD
    }
  }
};

/**
 * CN机房配置
 */
const cnConfig = {
  environment: Environment.PRODUCTION,
  region: Region.CN,

  database: {
    mysql: {
      host: 'cn-mysql-cluster.internal',
      port: 3306,
      database: 'trading_cn',
      username: 'trading_user',
      password: process.env.MYSQL_PASSWORD,
      pool: {
        min: 5,
        max: 20,
        acquireTimeoutMillis: 30000,
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 200
      }
    },
    redis: {
      host: 'cn-redis-cluster.internal',
      port: 6379,
      password: process.env.REDIS_PASSWORD,
      db: 0,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    },
    mongodb: {
      host: 'cn-mongodb-cluster.internal',
      port: 27017,
      database: 'trading_logs',
      username: 'trading_user',
      password: process.env.MONGODB_PASSWORD
    }
  },

  markets: {
    crypto: {
      enabled: false, // CN机房不直接交易加密货币
      adapter: 'BinanceAdapter'
    },
    usStock: {
      enabled: false, // CN机房不直接交易美股
      adapter: 'USStockAdapter'
    },
    cnStock: {
      enabled: true,
      adapter: 'ChinaStockAdapter',
      symbols: ['000001.SZ', '600000.SH', '000002.SZ', '600036.SH', '000858.SZ'],
      tradingHours: '09:30-11:30,13:00-15:00',
      config: {
        tushare: {
          token: process.env.TUSHARE_TOKEN,
          baseURL: 'http://api.tushare.pro'
        },
        efinance: {
          baseURL: 'https://push2.eastmoney.com'
        },
        broker: {
          baseURL: process.env.BROKER_API_URL,
          apiKey: process.env.BROKER_API_KEY,
          secretKey: process.env.BROKER_SECRET_KEY
        }
      }
    }
  },

  ai: {
    providers: {
      deepseek: {
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: 'https://api.deepseek.com',
        model: 'deepseek-chat'
      }
    },
    defaultProvider: AIProvider.DEEPSEEK
  },

  messaging: {
    redis: {
      host: 'cn-redis-cluster.internal',
      port: 6379,
      password: process.env.REDIS_PASSWORD,
      db: 1
    },
    topics: [
      'data.sync.request',
      'data.sync.response',
      'ai.analysis.request',
      'ai.analysis.response',
      'trading.signal',
      'risk.alert',
      'system.status',
      'heartbeat'
    ]
  },

  monitoring: {
    prometheus: {
      port: 9090,
      path: '/metrics'
    },
    grafana: {
      port: 3000,
      adminUser: 'admin',
      adminPassword: process.env.GRAFANA_ADMIN_PASSWORD
    }
  }
};

/**
 * 开发环境配置
 */
const developmentConfig = {
  environment: Environment.DEVELOPMENT,

  database: {
    mysql: {
      host: 'localhost',
      port: 3306,
      database: 'trading_dev',
      username: 'root',
      password: 'password'
    },
    redis: {
      host: 'localhost',
      port: 6379,
      password: null
    }
  },

  markets: {
    crypto: {
      enabled: true,
      config: {
        testnet: true
      }
    },
    usStock: {
      enabled: true,
      config: {
        paperTrading: true
      }
    },
    cnStock: {
      enabled: true,
      config: {
        mockData: true
      }
    }
  },

  ai: {
    providers: {
      claude: {
        apiKey: 'test-key',
        model: 'claude-3.5-sonnet'
      },
      deepseek: {
        apiKey: 'test-key',
        model: 'deepseek-chat'
      }
    },
    defaultProvider: AIProvider.CLAUDE
  },

  messaging: {
    redis: {
      host: 'localhost',
      port: 6379,
      password: null
    }
  }
};

/**
 * 配置工厂
 */
class ConfigFactory {
  static create(region = Region.SG, environment = Environment.PRODUCTION) {
    let config;

    if (environment === Environment.DEVELOPMENT) {
      config = developmentConfig;
    } else if (region === Region.SG) {
      config = sgConfig;
    } else if (region === Region.CN) {
      config = cnConfig;
    } else {
      throw new Error(`Unsupported region: ${region}`);
    }

    return config;
  }
}

module.exports = {
  Environment,
  Region,
  MarketType,
  AIProvider,
  ConfigManager,
  ConfigFactory,
  sgConfig,
  cnConfig,
  developmentConfig
};
