// modules/data/DataLayerIntegration.js
// 数据层架构集成 - 将新架构集成到现有系统中

const { DataLayerManager } = require('./DataLayerManager');
const DatabaseManager = require('../database/DatabaseManager');
const { DatabaseSchemaUpdater } = require('../database/DatabaseSchemaUpdater');

/**
 * 数据层架构集成器
 * 负责将新的数据层架构集成到现有系统中
 */
class DataLayerIntegration {
  constructor() {
    this.db = null;
    this.dataLayer = null;
    this.isInitialized = false;
  }

  /**
   * 初始化数据层架构
   */
  async init() {
    if (this.isInitialized) {
      console.log('ℹ️ 数据层架构已初始化');
      return;
    }

    try {
      console.log('🚀 开始初始化数据层架构...');

      // 1. 初始化数据库
      await this.initDatabase();

      // 2. 更新数据库架构
      await this.updateDatabaseSchema();

      // 3. 初始化数据层管理器
      await this.initDataLayerManager();

      // 4. 预热缓存
      await this.warmupCache();

      this.isInitialized = true;
      console.log('✅ 数据层架构初始化完成');

    } catch (error) {
      console.error('❌ 数据层架构初始化失败:', error);
      throw error;
    }
  }

  /**
   * 初始化数据库
   */
  async initDatabase() {
    console.log('🗄️ 初始化数据库...');

    this.db = new DatabaseManager();
    await this.db.init();

    console.log('✅ 数据库初始化完成');
  }

  /**
   * 更新数据库架构
   */
  async updateDatabaseSchema() {
    console.log('📋 更新数据库架构...');

    const schemaUpdater = new DatabaseSchemaUpdater(this.db);
    await schemaUpdater.performFullUpdate();

    console.log('✅ 数据库架构更新完成');
  }

  /**
   * 初始化数据层管理器
   */
  async initDataLayerManager() {
    console.log('🏗️ 初始化数据层管理器...');

    this.dataLayer = new DataLayerManager(this.db, {
      dal: {
        cacheConfig: {
          strategyAnalysis: 5 * 60 * 1000,      // 5分钟
          simulationData: 2 * 60 * 1000,        // 2分钟
          monitoringData: 30 * 1000,            // 30秒
          userSettings: 10 * 60 * 1000,         // 10分钟
          alertHistory: 1 * 60 * 1000,          // 1分钟
          customSymbols: 30 * 60 * 1000,        // 30分钟
          winRateStats: 5 * 60 * 1000           // 5分钟
        }
      },
      consistency: {
        consistencyConfig: {
          // 允许通过环境变量延长一致性检查间隔，默认1分钟
          checkInterval: Number(process.env.CONSISTENCY_INTERVAL_MS || (60 * 1000)),
          // 允许通过环境变量禁用自动同步（例如启动阶段）
          enableAutoSync: String(process.env.CONSISTENCY_ENABLE || '1') === '1',
          enableConflictResolution: true
        }
      },
      persistence: {
        persistenceConfig: {
          // 允许通过环境变量延长自动保存间隔，默认30秒
          autoSaveInterval: Number(process.env.AUTOSAVE_INTERVAL_MS || (30 * 1000)),
          enableAutoSave: true,
          batchSize: 50
        }
      }
    });

    console.log('✅ 数据层管理器初始化完成');
  }

  /**
   * 预热缓存
   */
  async warmupCache() {
    console.log('🔥 开始预热缓存...');

    try {
      // 获取所有交易对
      const symbols = await this.db.getCustomSymbols();

      if (symbols.length > 0) {
        // 通过环境变量限制预热数量，默认预热前2个，0表示禁用预热
        const limit = Number(process.env.WARMUP_SYMBOL_LIMIT || 2);
        const toWarm = limit > 0 ? symbols.slice(0, limit) : [];

        if (toWarm.length > 0) {
          await this.dataLayer.warmupCache(toWarm);
        } else {
          console.log('ℹ️ 已禁用启动阶段缓存预热 (WARMUP_SYMBOL_LIMIT=0)');
        }
        console.log(`✅ 缓存预热完成 - ${symbols.length} 个交易对`);
      } else {
        console.log('ℹ️ 没有交易对数据，跳过缓存预热');
      }
    } catch (error) {
      console.warn('⚠️ 缓存预热失败:', error.message);
    }
  }

  /**
   * 获取数据层管理器实例
   */
  getDataLayer() {
    if (!this.isInitialized) {
      throw new Error('数据层架构未初始化，请先调用 init() 方法');
    }
    return this.dataLayer;
  }

  /**
   * 获取数据库实例
   */
  getDatabase() {
    if (!this.isInitialized) {
      throw new Error('数据层架构未初始化，请先调用 init() 方法');
    }
    return this.db;
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    if (!this.isInitialized) {
      return {
        status: 'unhealthy',
        error: '数据层架构未初始化',
        timestamp: new Date().toISOString()
      };
    }

    try {
      const systemStatus = this.dataLayer.getSystemStatus();
      const healthStatus = await this.dataLayer.healthCheck();

      return {
        ...healthStatus,
        dataLayer: systemStatus,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 优雅关闭
   */
  async gracefulShutdown() {
    if (!this.isInitialized) {
      console.log('ℹ️ 数据层架构未初始化，无需关闭');
      return;
    }

    try {
      console.log('🔄 开始优雅关闭数据层架构...');

      if (this.dataLayer) {
        await this.dataLayer.gracefulShutdown();
      }

      if (this.db) {
        await this.db.close();
      }

      this.isInitialized = false;
      console.log('✅ 数据层架构优雅关闭完成');

    } catch (error) {
      console.error('❌ 数据层架构关闭失败:', error);
      throw error;
    }
  }

  /**
   * 获取系统状态
   */
  getSystemStatus() {
    if (!this.isInitialized) {
      return {
        initialized: false,
        error: '数据层架构未初始化'
      };
    }

    try {
      const dataLayerStatus = this.dataLayer.getSystemStatus();

      return {
        initialized: true,
        dataLayer: dataLayerStatus,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        initialized: true,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// 创建全局实例
const dataLayerIntegration = new DataLayerIntegration();

module.exports = { DataLayerIntegration, dataLayerIntegration };
