// modules/data/DataConsistencyManager.js
// 数据一致性管理器 - 确保内存缓存与数据库数据一致性

const EventEmitter = require('events');

/**
 * 数据一致性管理器
 * 负责维护内存缓存与数据库数据的一致性
 */
class DataConsistencyManager extends EventEmitter {
  constructor(dataAccessLayer, options = {}) {
    super();
    this.dal = dataAccessLayer;
    this.db = dataAccessLayer.db;

    // 一致性检查配置
    this.consistencyConfig = {
      checkInterval: 60 * 1000,        // 1分钟检查一次
      maxRetries: 3,                   // 最大重试次数
      retryDelay: 1000,                // 重试延迟
      enableAutoSync: true,            // 启用自动同步
      enableConflictResolution: true,  // 启用冲突解决
      ...options.consistencyConfig
    };

    // 数据同步状态
    this.syncStatus = new Map();

    // 冲突解决策略
    this.conflictResolutionStrategies = new Map();

    // 启动一致性检查
    if (this.consistencyConfig.enableAutoSync) {
      this.startConsistencyCheck();
    }
  }

  /**
   * 检查数据一致性
   * @param {string} dataType - 数据类型
   * @param {string} key - 数据键
   */
  async checkDataConsistency(dataType, key) {
    try {
      console.log(`🔍 检查数据一致性: ${dataType}:${key}`);

      // 获取缓存数据
      const cacheKey = this.getCacheKey(dataType, key);
      const cachedData = this.dal.cache.get(cacheKey);

      if (!cachedData) {
        console.log(`📦 缓存中无数据，跳过一致性检查: ${dataType}:${key}`);
        return { consistent: true, action: 'none' };
      }

      // 获取数据库数据
      const dbData = await this.getDatabaseData(dataType, key);

      // 比较数据
      const isConsistent = this.compareData(cachedData, dbData);

      if (isConsistent) {
        console.log(`✅ 数据一致: ${dataType}:${key}`);
        return { consistent: true, action: 'none' };
      }

      console.log(`⚠️ 数据不一致: ${dataType}:${key}`);

      // 解决冲突
      const resolution = await this.resolveConflict(dataType, key, cachedData, dbData);

      return {
        consistent: false,
        action: resolution.action,
        cacheData: cachedData,
        dbData: dbData,
        resolution: resolution
      };

    } catch (error) {
      console.error(`❌ 一致性检查失败: ${dataType}:${key}`, error);
      return { consistent: false, action: 'error', error: error.message };
    }
  }

  /**
   * 获取数据库数据
   * @param {string} dataType - 数据类型
   * @param {string} key - 数据键
   */
  async getDatabaseData(dataType, key) {
    switch (dataType) {
      case 'strategyAnalysis':
        return await this.db.getLatestStrategyAnalysis(key);

      case 'simulationData':
        return await this.db.runQuery(
          'SELECT * FROM simulations WHERE symbol = ? ORDER BY created_at DESC LIMIT 1',
          [key]
        );

      case 'userSettings':
        return await this.db.getUserSetting(key);

      case 'alertHistory':
        return await this.db.getAlertHistory(100);

      default:
        throw new Error(`未知的数据类型: ${dataType}`);
    }
  }

  /**
   * 比较数据
   * @param {*} cacheData - 缓存数据
   * @param {*} dbData - 数据库数据
   */
  compareData(cacheData, dbData) {
    if (!cacheData && !dbData) return true;
    if (!cacheData || !dbData) return false;

    // 简单比较（可以根据需要扩展）
    return JSON.stringify(cacheData) === JSON.stringify(dbData);
  }

  /**
   * 解决数据冲突
   * @param {string} dataType - 数据类型
   * @param {string} key - 数据键
   * @param {*} cacheData - 缓存数据
   * @param {*} dbData - 数据库数据
   */
  async resolveConflict(dataType, key, cacheData, dbData) {
    const strategy = this.conflictResolutionStrategies.get(dataType) || 'database_wins';

    switch (strategy) {
      case 'database_wins':
        // 数据库数据优先，更新缓存
        const cacheKey = this.getCacheKey(dataType, key);
        this.dal.cache.set(cacheKey, dbData, this.dal.cacheConfig[dataType]);
        console.log(`🔄 使用数据库数据更新缓存: ${dataType}:${key}`);
        return { action: 'update_cache', data: dbData };

      case 'cache_wins':
        // 缓存数据优先，更新数据库
        await this.updateDatabase(dataType, key, cacheData);
        console.log(`🔄 使用缓存数据更新数据库: ${dataType}:${key}`);
        return { action: 'update_database', data: cacheData };

      case 'merge':
        // 合并数据
        const mergedData = this.mergeData(cacheData, dbData);
        await this.updateDatabase(dataType, key, mergedData);
        const mergedCacheKey = this.getCacheKey(dataType, key);
        this.dal.cache.set(mergedCacheKey, mergedData, this.dal.cacheConfig[dataType]);
        console.log(`🔄 合并数据: ${dataType}:${key}`);
        return { action: 'merge', data: mergedData };

      case 'manual':
        // 手动解决
        this.emit('conflict', { dataType, key, cacheData, dbData });
        console.log(`⚠️ 需要手动解决冲突: ${dataType}:${key}`);
        return { action: 'manual', data: null };

      default:
        throw new Error(`未知的冲突解决策略: ${strategy}`);
    }
  }

  /**
   * 更新数据库
   * @param {string} dataType - 数据类型
   * @param {string} key - 数据键
   * @param {*} data - 数据
   */
  async updateDatabase(dataType, key, data) {
    switch (dataType) {
      case 'strategyAnalysis':
        return await this.db.recordStrategyAnalysis(data);

      case 'simulationData':
        // 更新模拟交易数据
        return await this.db.run(
          'UPDATE simulations SET status = ?, closed_at = ?, exit_price = ?, exit_reason = ?, is_win = ?, profit_loss = ? WHERE symbol = ? AND status = ?',
          [data.status, data.closedAt, data.exitPrice, data.exitReason, data.isWin, data.profitLoss, key, 'ACTIVE']
        );

      case 'userSettings':
        return await this.db.setUserSetting(key, data);

      default:
        throw new Error(`不支持更新数据类型: ${dataType}`);
    }
  }

  /**
   * 合并数据
   * @param {*} cacheData - 缓存数据
   * @param {*} dbData - 数据库数据
   */
  mergeData(cacheData, dbData) {
    // 简单的深度合并（可以根据需要扩展）
    if (typeof cacheData !== 'object' || typeof dbData !== 'object') {
      return dbData; // 非对象类型，使用数据库数据
    }

    const merged = { ...dbData };
    for (const key in cacheData) {
      if (cacheData[key] !== undefined && cacheData[key] !== null) {
        if (typeof cacheData[key] === 'object' && typeof dbData[key] === 'object') {
          merged[key] = this.mergeData(cacheData[key], dbData[key]);
        } else {
          merged[key] = cacheData[key];
        }
      }
    }

    return merged;
  }

  /**
   * 设置冲突解决策略
   * @param {string} dataType - 数据类型
   * @param {string} strategy - 解决策略
   */
  setConflictResolutionStrategy(dataType, strategy) {
    this.conflictResolutionStrategies.set(dataType, strategy);
    console.log(`🔧 设置冲突解决策略: ${dataType} -> ${strategy}`);
  }

  /**
   * 获取缓存键
   * @param {string} dataType - 数据类型
   * @param {string} key - 数据键
   */
  getCacheKey(dataType, key) {
    return `${dataType}:${key}`;
  }

  /**
   * 启动一致性检查
   */
  startConsistencyCheck() {
    setInterval(async () => {
      try {
        await this.performConsistencyCheck();
      } catch (error) {
        console.error('❌ 一致性检查失败:', error);
      }
    }, this.consistencyConfig.checkInterval);

    console.log('🔄 数据一致性检查已启动');
  }

  /**
   * 执行一致性检查
   */
  async performConsistencyCheck() {
    console.log('🔍 开始执行数据一致性检查...');

    // 获取所有缓存键
    const cacheKeys = Array.from(this.dal.cache.cache.keys());
    const dataTypes = new Set();

    // 提取数据类型
    for (const key of cacheKeys) {
      const [dataType] = key.split(':');
      dataTypes.add(dataType);
    }

    // 检查每种数据类型
    for (const dataType of dataTypes) {
      try {
        await this.checkDataTypeConsistency(dataType);
      } catch (error) {
        console.error(`❌ 检查数据类型失败: ${dataType}`, error);
      }
    }

    console.log('✅ 数据一致性检查完成');
  }

  /**
   * 检查特定数据类型的一致性
   * @param {string} dataType - 数据类型
   */
  async checkDataTypeConsistency(dataType) {
    const cacheKeys = Array.from(this.dal.cache.cache.keys())
      .filter(key => key.startsWith(`${dataType}:`));

    for (const cacheKey of cacheKeys) {
      const [, key] = cacheKey.split(':');
      await this.checkDataConsistency(dataType, key);
    }
  }

  /**
   * 强制同步数据
   * @param {string} dataType - 数据类型
   * @param {string} key - 数据键
   */
  async forceSync(dataType, key) {
    try {
      console.log(`🔄 强制同步数据: ${dataType}:${key}`);

      // 清除缓存
      const cacheKey = this.getCacheKey(dataType, key);
      this.dal.cache.delete(cacheKey);

      // 重新从数据库获取
      const dbData = await this.getDatabaseData(dataType, key);

      // 更新缓存
      if (dbData) {
        this.dal.cache.set(cacheKey, dbData, this.dal.cacheConfig[dataType]);
      }

      console.log(`✅ 数据同步完成: ${dataType}:${key}`);
      return dbData;
    } catch (error) {
      console.error(`❌ 强制同步失败: ${dataType}:${key}`, error);
      throw error;
    }
  }

  /**
   * 获取同步状态
   */
  getSyncStatus() {
    return {
      enabled: this.consistencyConfig.enableAutoSync,
      checkInterval: this.consistencyConfig.checkInterval,
      strategies: Array.from(this.conflictResolutionStrategies.entries()),
      lastCheck: new Date().toISOString()
    };
  }

  /**
   * 停止一致性检查
   */
  stopConsistencyCheck() {
    if (this.consistencyInterval) {
      clearInterval(this.consistencyInterval);
      this.consistencyInterval = null;
    }
    console.log('⏹️ 数据一致性检查已停止');
  }
}

module.exports = { DataConsistencyManager };
