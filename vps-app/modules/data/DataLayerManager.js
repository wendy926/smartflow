// modules/data/DataLayerManager.js
// 统一数据层管理器 - 整合缓存、一致性和持久化

const { DataAccessLayer } = require('./DataAccessLayer');
const { DataConsistencyManager } = require('./DataConsistencyManager');
const { DataPersistenceManager } = require('./DataPersistenceManager');

/**
 * 统一数据层管理器
 * 整合缓存、数据一致性和持久化功能
 */
class DataLayerManager {
  constructor(database, options = {}) {
    this.db = database;

    // 初始化数据访问层
    this.dal = new DataAccessLayer(database, options.dal);

    // 初始化数据一致性管理器
    this.consistencyManager = new DataConsistencyManager(this.dal, options.consistency);

    // 初始化数据持久化管理器
    this.persistenceManager = new DataPersistenceManager(this.dal, options.persistence);

    // 设置冲突解决策略
    this.setupConflictResolutionStrategies();

    // 设置数据变更监听
    this.setupDataChangeListeners();

    console.log('🏗️ 数据层管理器初始化完成');
  }

  /**
   * 设置冲突解决策略
   */
  setupConflictResolutionStrategies() {
    // 策略分析数据：数据库优先（确保数据准确性）
    this.consistencyManager.setConflictResolutionStrategy('strategyAnalysis', 'database_wins');

    // 模拟交易数据：数据库优先（确保交易记录准确性）
    this.consistencyManager.setConflictResolutionStrategy('simulationData', 'database_wins');

    // 用户设置：缓存优先（用户操作优先）
    this.consistencyManager.setConflictResolutionStrategy('userSettings', 'cache_wins');

    // 告警历史：数据库优先（确保告警记录完整性）
    this.consistencyManager.setConflictResolutionStrategy('alertHistory', 'database_wins');

    // 监控数据：合并（综合多个数据源）
    this.consistencyManager.setConflictResolutionStrategy('monitoringData', 'merge');
  }

  /**
   * 设置数据变更监听
   */
  setupDataChangeListeners() {
    // 监听数据变更，自动标记为待持久化
    this.dal.cache.on('dataChanged', (dataType, key, data) => {
      this.persistenceManager.markForPersistence(dataType, key, data);
    });

    // 监听冲突事件
    this.consistencyManager.on('conflict', (conflict) => {
      console.log('⚠️ 检测到数据冲突:', conflict);
      // 可以在这里添加通知逻辑
    });

    // 监听持久化事件
    this.persistenceManager.on('persisted', (event) => {
      console.log('✅ 数据持久化成功:', event);
    });

    this.persistenceManager.on('persistError', (event) => {
      console.error('❌ 数据持久化失败:', event);
    });
  }

  // ==================== 数据访问接口 ====================

  /**
   * 获取策略分析数据
   * @param {string} symbol - 交易对
   * @param {Object} options - 查询选项
   */
  async getStrategyAnalysis(symbol, options = {}) {
    return await this.dal.getStrategyAnalysis(symbol, options);
  }

  /**
   * 保存策略分析数据
   * @param {Object} analysisData - 分析数据
   */
  async saveStrategyAnalysis(analysisData) {
    const result = await this.dal.saveStrategyAnalysis(analysisData);

    // 标记为待持久化
    this.persistenceManager.markForPersistence('strategyAnalysis', analysisData.symbol, analysisData);

    return result;
  }

  /**
   * 获取模拟交易数据
   * @param {string} symbol - 交易对
   * @param {Object} options - 查询选项
   */
  async getSimulationData(symbol, options = {}) {
    return await this.dal.getSimulationData(symbol, options);
  }

  /**
   * 保存模拟交易数据
   * @param {Object} simulationData - 模拟交易数据
   */
  async saveSimulationData(simulationData) {
    const result = await this.dal.saveSimulationData(simulationData);

    // 标记为待持久化
    this.persistenceManager.markForPersistence('simulationData', simulationData.symbol, simulationData);

    return result;
  }

  /**
   * 获取监控数据
   * @param {Object} options - 查询选项
   */
  async getMonitoringData(options = {}) {
    return await this.dal.getMonitoringData(options);
  }

  /**
   * 获取用户设置
   * @param {string} key - 设置键
   * @param {*} defaultValue - 默认值
   */
  async getUserSetting(key, defaultValue = null) {
    return await this.dal.getUserSetting(key, defaultValue);
  }

  /**
   * 保存用户设置
   * @param {string} key - 设置键
   * @param {*} value - 设置值
   */
  async setUserSetting(key, value) {
    const result = await this.dal.setUserSetting(key, value);

    // 标记为待持久化
    this.persistenceManager.markForPersistence('userSettings', key, value);

    return result;
  }

  /**
   * 获取告警历史
   * @param {Object} options - 查询选项
   */
  async getAlertHistory(options = {}) {
    return await this.dal.getAlertHistory(options);
  }

  /**
   * 保存告警历史
   * @param {Object} alertData - 告警数据
   */
  async saveAlertHistory(alertData) {
    const result = await this.dal.saveAlertHistory(alertData);

    // 标记为待持久化
    this.persistenceManager.markForPersistence('alertHistory', alertData.symbol, alertData);

    return result;
  }

  // ==================== 缓存管理接口 ====================

  /**
   * 清除所有缓存
   */
  clearAllCache() {
    this.dal.clearAllCache();
  }

  /**
   * 清除特定类型缓存
   * @param {string} dataType - 数据类型
   */
  clearCacheByType(dataType) {
    this.dal.clearCacheByType(dataType);
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    return this.dal.getCacheStats();
  }

  /**
   * 预热缓存
   * @param {Array} symbols - 交易对列表
   */
  async warmupCache(symbols) {
    return await this.dal.warmupCache(symbols);
  }

  // ==================== 一致性管理接口 ====================

  /**
   * 检查数据一致性
   * @param {string} dataType - 数据类型
   * @param {string} key - 数据键
   */
  async checkDataConsistency(dataType, key) {
    return await this.consistencyManager.checkDataConsistency(dataType, key);
  }

  /**
   * 强制同步数据
   * @param {string} dataType - 数据类型
   * @param {string} key - 数据键
   */
  async forceSync(dataType, key) {
    return await this.consistencyManager.forceSync(dataType, key);
  }

  /**
   * 获取同步状态
   */
  getSyncStatus() {
    return this.consistencyManager.getSyncStatus();
  }

  // ==================== 持久化管理接口 ====================

  /**
   * 立即持久化数据
   * @param {string} dataType - 数据类型
   * @param {string} key - 数据键
   * @param {*} data - 数据
   * @param {Object} options - 选项
   */
  async persistData(dataType, key, data, options = {}) {
    return await this.persistenceManager.persistData(dataType, key, data, options);
  }

  /**
   * 强制保存所有待持久化数据
   */
  async forceSaveAll() {
    return await this.persistenceManager.forceSaveAll();
  }

  /**
   * 获取待持久化数据统计
   */
  getPendingDataStats() {
    return this.persistenceManager.getPendingDataStats();
  }

  // ==================== 系统管理接口 ====================

  /**
   * 获取系统状态
   */
  getSystemStatus() {
    return {
      cache: this.dal.getCacheStats(),
      consistency: this.consistencyManager.getSyncStatus(),
      persistence: this.persistenceManager.getPendingDataStats(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      // 检查数据库连接
      await this.db.runQuery('SELECT 1');

      // 检查缓存状态
      const cacheStats = this.dal.getCacheStats();

      // 检查待持久化数据
      const pendingStats = this.persistenceManager.getPendingDataStats();

      return {
        status: 'healthy',
        database: 'connected',
        cache: cacheStats,
        pendingData: pendingStats,
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
    console.log('🔄 开始优雅关闭数据层管理器...');

    try {
      // 停止一致性检查
      this.consistencyManager.stopConsistencyCheck();

      // 停止自动保存
      this.persistenceManager.stopAutoSave();

      // 强制保存所有待持久化数据
      await this.persistenceManager.forceSaveAll();

      console.log('✅ 数据层管理器优雅关闭完成');
    } catch (error) {
      console.error('❌ 优雅关闭失败:', error);
    }
  }

  /**
   * 清理过期数据
   * @param {number} maxAge - 最大年龄（毫秒）
   */
  async cleanupExpiredData(maxAge = 24 * 60 * 60 * 1000) {
    await this.persistenceManager.cleanupExpiredData(maxAge);
  }
}

module.exports = { DataLayerManager };
