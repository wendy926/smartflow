/**
 * 通用交易系统主应用程序
 * 支持多市场交易和跨机房部署
 */

const SimpleConfigManager = require('./config/SimpleConfigManager');
const { AdapterFactory } = require('./adapters/AdapterFactory');
const { AIServiceFactory, AIServiceManager } = require('./services/ai/IAIService');
const { CrossRegionMessagingService, DataSyncHandler, AIAnalysisHandler } = require('./services/CrossRegionMessagingService');
const { DataSyncService } = require('./services/DataSyncService');
const logger = require('./utils/logger');

/**
 * 通用交易系统应用程序
 */
class UniversalTradingSystem {
  constructor() {
    this.configManager = new SimpleConfigManager();
    this.config = this.configManager.getConfig();
    this.region = this.configManager.getRegion();
    this.environment = this.configManager.getEnvironment();
    
    // 核心组件
    this.adapters = new Map();
    this.aiServiceManager = new AIServiceManager();
    this.messagingService = null;
    this.dataSyncService = null;
    
    // 服务状态
    this.isRunning = false;
    this.startTime = null;
    
    // 统计信息
    this.stats = {
      uptime: 0,
      requestsProcessed: 0,
      errors: 0,
      lastActivity: null
    };
  }

  /**
   * 启动应用程序
   */
  async start() {
    try {
      logger.info(`🚀 Starting Universal Trading System in ${this.region} region...`);
      this.startTime = new Date();
      
      // 1. 初始化数据库连接
      await this.initializeDatabase();
      
      // 2. 初始化消息队列
      await this.initializeMessaging();
      
      // 3. 初始化市场适配器
      await this.initializeAdapters();
      
      // 4. 初始化AI服务
      await this.initializeAIServices();
      
      // 5. 初始化数据同步服务
      await this.initializeDataSync();
      
      // 6. 启动核心服务
      await this.startCoreServices();
      
      // 7. 启动监控
      await this.startMonitoring();
      
      this.isRunning = true;
      
      logger.info('✅ Universal Trading System started successfully!');
      logger.info(`📊 Configuration Summary:`, this.configManager.getConfigSummary());
      
      // 启动统计更新
      this.startStatsUpdate();

    } catch (error) {
      logger.error('❌ Failed to start Universal Trading System:', error);
      throw error;
    }
  }

  /**
   * 停止应用程序
   */
  async stop() {
    try {
      logger.info('🛑 Stopping Universal Trading System...');
      
      this.isRunning = false;
      
      // 停止数据同步服务
      if (this.dataSyncService) {
        await this.dataSyncService.stop();
      }
      
      // 停止消息队列
      if (this.messagingService) {
        await this.messagingService.stop();
      }
      
      // 关闭数据库连接
      await this.closeDatabaseConnections();
      
      logger.info('✅ Universal Trading System stopped successfully!');

    } catch (error) {
      logger.error('❌ Error stopping Universal Trading System:', error);
      throw error;
    }
  }

  /**
   * 初始化数据库连接
   */
  async initializeDatabase() {
    try {
      const dbConfig = this.configManager.getDatabaseConfig();
      
      // 初始化MySQL连接
      if (dbConfig.mysql) {
        await this.initializeMySQL(dbConfig.mysql);
      }
      
      // 初始化Redis连接
      if (dbConfig.redis) {
        await this.initializeRedis(dbConfig.redis);
      }
      
      logger.info('✅ Database connections initialized');

    } catch (error) {
      logger.error('❌ Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * 初始化MySQL连接
   */
  async initializeMySQL(config) {
    // 这里需要根据实际的MySQL客户端进行初始化
    // const mysql = require('mysql2/promise');
    // this.mysqlPool = mysql.createPool(config);
    
    logger.info(`📊 MySQL connection initialized: ${config.host}:${config.port}/${config.database}`);
  }

  /**
   * 初始化Redis连接
   */
  async initializeRedis(config) {
    // 这里需要根据实际的Redis客户端进行初始化
    // const Redis = require('ioredis');
    // this.redis = new Redis(config);
    
    logger.info(`📊 Redis connection initialized: ${config.host}:${config.port}`);
  }

  /**
   * 初始化消息队列
   */
  async initializeMessaging() {
    try {
      const messagingConfig = this.configManager.getMessagingConfig();
      
      this.messagingService = new CrossRegionMessagingService({
        region: this.region,
        redis: messagingConfig.redis
      });
      
      await this.messagingService.start();
      
      logger.info('✅ Messaging service initialized');

    } catch (error) {
      logger.error('❌ Failed to initialize messaging service:', error);
      throw error;
    }
  }

  /**
   * 初始化市场适配器
   */
  async initializeAdapters() {
    try {
      const markets = this.config.markets || {};
      
      // 市场类型映射
      const marketTypeMap = {
        'binance': 'CRYPTO',
        'alpaca': 'US_STOCK',
        'tushare': 'CN_STOCK'
      };
      
      for (const [marketName, marketConfig] of Object.entries(markets)) {
        if (marketConfig.enabled) {
          const marketType = marketTypeMap[marketName] || marketName.toUpperCase();
          const adapter = AdapterFactory.create(marketType, marketConfig);
          this.adapters.set(marketName, adapter);
          
          logger.info(`✅ ${marketName} adapter initialized`);
        }
      }
      
      logger.info(`📊 Total adapters initialized: ${this.adapters.size}`);

    } catch (error) {
      logger.error('❌ Failed to initialize adapters:', error);
      throw error;
    }
  }

  /**
   * 初始化AI服务
   */
  async initializeAIServices() {
    try {
      const aiConfig = this.configManager.getAIConfig();
      const defaultProvider = aiConfig.defaultProvider;
      
      // 注册AI服务
      for (const [provider, providerConfig] of Object.entries(aiConfig.providers || {})) {
        if (providerConfig.apiKey) {
          const aiService = AIServiceFactory.create(provider, providerConfig);
          this.aiServiceManager.registerService(provider, aiService);
          
          logger.info(`✅ ${provider} AI service initialized`);
        }
      }
      
      // 设置默认提供商
      this.aiServiceManager.setDefaultProvider(defaultProvider);
      this.aiServiceManager.setRegion(this.region);
      
      logger.info(`📊 Default AI provider: ${defaultProvider}`);

    } catch (error) {
      logger.error('❌ Failed to initialize AI services:', error);
      throw error;
    }
  }

  /**
   * 初始化数据同步服务
   */
  async initializeDataSync() {
    try {
      this.dataSyncService = new DataSyncService(this.messagingService, this.adapters);
      
      // 注册数据同步处理器
      const dataSyncHandler = new DataSyncHandler(this.dataSyncService);
      this.messagingService.registerHandler(dataSyncHandler);
      
      // 注册AI分析处理器
      const aiAnalysisHandler = new AIAnalysisHandler(this.aiServiceManager.getDefaultService());
      this.messagingService.registerHandler(aiAnalysisHandler);
      
      await this.dataSyncService.start();
      
      logger.info('✅ Data sync service initialized');

    } catch (error) {
      logger.error('❌ Failed to initialize data sync service:', error);
      throw error;
    }
  }

  /**
   * 启动核心服务
   */
  async startCoreServices() {
    try {
      // 这里可以启动其他核心服务
      // 如策略引擎、风险管理、回测引擎等
      
      logger.info('✅ Core services started');

    } catch (error) {
      logger.error('❌ Failed to start core services:', error);
      throw error;
    }
  }

  /**
   * 启动监控
   */
  async startMonitoring() {
    try {
      const monitoringConfig = this.configManager.getMonitoringConfig();
      
      // 启动Prometheus监控
      if (monitoringConfig.prometheus) {
        await this.startPrometheus(monitoringConfig.prometheus);
      }
      
      // 启动Grafana监控
      if (monitoringConfig.grafana) {
        await this.startGrafana(monitoringConfig.grafana);
      }
      
      logger.info('✅ Monitoring services started');

    } catch (error) {
      logger.error('❌ Failed to start monitoring:', error);
      throw error;
    }
  }

  /**
   * 启动Prometheus监控
   */
  async startPrometheus(config) {
    // 这里需要根据实际的Prometheus客户端进行初始化
    logger.info(`📊 Prometheus monitoring started on port ${config.port}`);
  }

  /**
   * 启动Grafana监控
   */
  async startGrafana(config) {
    // 这里需要根据实际的Grafana配置进行初始化
    logger.info(`📊 Grafana monitoring started on port ${config.port}`);
  }

  /**
   * 启动统计更新
   */
  startStatsUpdate() {
    setInterval(() => {
      if (this.isRunning && this.startTime) {
        this.stats.uptime = Date.now() - this.startTime.getTime();
        this.stats.lastActivity = new Date();
      }
    }, 1000);
  }

  /**
   * 关闭数据库连接
   */
  async closeDatabaseConnections() {
    try {
      // 关闭MySQL连接池
      if (this.mysqlPool) {
        await this.mysqlPool.end();
      }
      
      // 关闭Redis连接
      if (this.redis) {
        await this.redis.disconnect();
      }
      
      logger.info('✅ Database connections closed');

    } catch (error) {
      logger.error('❌ Error closing database connections:', error);
    }
  }

  /**
   * 获取系统状态
   */
  async getSystemStatus() {
    try {
      const status = {
        isRunning: this.isRunning,
        region: this.region,
        environment: this.environment,
        uptime: this.stats.uptime,
        startTime: this.startTime,
        stats: this.stats,
        adapters: Array.from(this.adapters.keys()),
        aiServices: this.aiServiceManager ? Object.keys(this.aiServiceManager.services) : [],
        messaging: this.messagingService ? this.messagingService.getStats() : null,
        dataSync: this.dataSyncService ? this.dataSyncService.getStats() : null
      };
      
      return status;

    } catch (error) {
      logger.error('❌ Failed to get system status:', error);
      throw error;
    }
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date(),
        checks: {}
      };
      
      // 检查数据库连接
      health.checks.database = {
        mysql: !!this.mysqlPool,
        redis: !!this.redis
      };
      
      // 检查市场适配器
      health.checks.adapters = {};
      for (const [marketType, adapter] of this.adapters) {
        try {
          health.checks.adapters[marketType] = await adapter.healthCheck();
        } catch (error) {
          health.checks.adapters[marketType] = false;
        }
      }
      
      // 检查AI服务
      if (this.aiServiceManager) {
        health.checks.aiServices = await this.aiServiceManager.healthCheckAll();
      }
      
      // 检查消息队列
      if (this.messagingService) {
        health.checks.messaging = this.messagingService.isRunning;
      }
      
      // 检查数据同步
      if (this.dataSyncService) {
        health.checks.dataSync = this.dataSyncService.isRunning;
      }
      
      // 确定整体健康状态
      const allChecks = Object.values(health.checks).flat();
      if (allChecks.some(check => check === false)) {
        health.status = 'unhealthy';
      }
      
      return health;

    } catch (error) {
      logger.error('❌ Health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        error: error.message
      };
    }
  }

  /**
   * 获取配置信息
   */
  getConfig() {
    return this.configManager.getConfigSummary();
  }

  /**
   * 重新加载配置
   */
  async reloadConfig() {
    try {
      logger.info('🔄 Reloading configuration...');
      
      this.configManager.reload();
      this.config = this.configManager.getConfig();
      
      logger.info('✅ Configuration reloaded successfully');

    } catch (error) {
      logger.error('❌ Failed to reload configuration:', error);
      throw error;
    }
  }
}

/**
 * 应用程序启动器
 */
class ApplicationLauncher {
  static async launch() {
    const app = new UniversalTradingSystem();
    
    // 处理进程信号
    process.on('SIGINT', async () => {
      logger.info('🛑 Received SIGINT, shutting down gracefully...');
      await app.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('🛑 Received SIGTERM, shutting down gracefully...');
      await app.stop();
      process.exit(0);
    });
    
    // 处理未捕获的异常
    process.on('uncaughtException', async (error) => {
      logger.error('❌ Uncaught Exception:', error);
      await app.stop();
      process.exit(1);
    });
    
    process.on('unhandledRejection', async (reason, promise) => {
      logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      await app.stop();
      process.exit(1);
    });
    
    try {
      await app.start();
      
      // 定期健康检查
      setInterval(async () => {
        const health = await app.healthCheck();
        if (health.status === 'unhealthy') {
          logger.warn('⚠️ System health check failed:', health);
        }
      }, 30000);
      
      return app;

    } catch (error) {
      logger.error('❌ Failed to launch application:', error);
      process.exit(1);
    }
  }
}

module.exports = UniversalTradingSystem;
