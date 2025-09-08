// modules/data/DataAccessLayer.js
// 统一数据访问层 - 基于内存缓存的数据层架构

const { DataCache } = require('../utils/DataCache');

/**
 * 统一数据访问层
 * 提供基于内存缓存的数据访问接口，确保数据一致性和性能优化
 */
class DataAccessLayer {
  constructor(database, options = {}) {
    this.db = database;
    this.cache = new DataCache();

    // 缓存配置
    this.cacheConfig = {
      // 不同数据类型的缓存时间（毫秒）
      strategyAnalysis: 5 * 60 * 1000,      // 5分钟
      simulationData: 2 * 60 * 1000,        // 2分钟
      monitoringData: 30 * 1000,            // 30秒
      userSettings: 10 * 60 * 1000,         // 10分钟
      alertHistory: 1 * 60 * 1000,          // 1分钟
      customSymbols: 30 * 60 * 1000,        // 30分钟
      winRateStats: 5 * 60 * 1000,          // 5分钟
      ...options.cacheConfig
    };

    // 数据版本控制
    this.dataVersions = new Map();

    // 缓存失效策略
    this.invalidationStrategies = new Map();

    // 启动定期清理
    this.startCacheCleanup();
  }

  /**
   * 获取策略分析数据
   * @param {string} symbol - 交易对
   * @param {Object} options - 查询选项
   */
  async getStrategyAnalysis(symbol, options = {}) {
    const cacheKey = `strategy_analysis:${symbol}:${JSON.stringify(options)}`;

    // 检查缓存
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log(`📦 从缓存获取策略分析数据: ${symbol}`);
      return cached;
    }

    // 从数据库获取
    console.log(`🗄️ 从数据库获取策略分析数据: ${symbol}`);
    let data;

    if (options.latest) {
      data = await this.db.getLatestStrategyAnalysis(symbol);
    } else if (options.history) {
      data = await this.db.getStrategyAnalysisHistory(symbol, options.limit || 100);
    } else {
      data = await this.db.getLatestStrategyAnalysis(symbol);
    }

    // 缓存数据
    if (data) {
      this.cache.set(cacheKey, data, this.cacheConfig.strategyAnalysis);
      this.updateDataVersion('strategyAnalysis', symbol);
    }

    return data;
  }

  /**
   * 保存策略分析数据
   * @param {Object} analysisData - 分析数据
   */
  async saveStrategyAnalysis(analysisData) {
    try {
      // 保存到数据库
      const result = await this.db.recordStrategyAnalysis(analysisData);

      // 更新缓存
      const cacheKey = `strategy_analysis:${analysisData.symbol}:latest`;
      this.cache.set(cacheKey, analysisData, this.cacheConfig.strategyAnalysis);

      // 更新数据版本
      this.updateDataVersion('strategyAnalysis', analysisData.symbol);

      // 触发相关缓存失效
      this.invalidateRelatedCaches('strategyAnalysis', analysisData.symbol);

      console.log(`💾 策略分析数据已保存并缓存: ${analysisData.symbol}`);
      return result;
    } catch (error) {
      console.error(`❌ 保存策略分析数据失败: ${analysisData.symbol}`, error);
      throw error;
    }
  }

  /**
   * 获取模拟交易数据
   * @param {string} symbol - 交易对
   * @param {Object} options - 查询选项
   */
  async getSimulationData(symbol, options = {}) {
    const cacheKey = `simulation:${symbol}:${JSON.stringify(options)}`;

    // 检查缓存
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log(`📦 从缓存获取模拟交易数据: ${symbol}`);
      return cached;
    }

    // 从数据库获取
    console.log(`🗄️ 从数据库获取模拟交易数据: ${symbol}`);
    let data;

    if (options.active) {
      data = await this.db.runQuery(
        'SELECT * FROM simulations WHERE symbol = ? AND status = ? ORDER BY created_at DESC',
        [symbol, 'ACTIVE']
      );
    } else if (options.history) {
      data = await this.db.runQuery(
        'SELECT * FROM simulations WHERE symbol = ? ORDER BY created_at DESC LIMIT ?',
        [symbol, options.limit || 100]
      );
    } else {
      data = await this.db.runQuery(
        'SELECT * FROM simulations WHERE symbol = ? ORDER BY created_at DESC',
        [symbol]
      );
    }

    // 缓存数据
    if (data) {
      this.cache.set(cacheKey, data, this.cacheConfig.simulationData);
      this.updateDataVersion('simulationData', symbol);
    }

    return data;
  }

  /**
   * 保存模拟交易数据
   * @param {Object} simulationData - 模拟交易数据
   */
  async saveSimulationData(simulationData) {
    try {
      // 保存到数据库
      const result = await this.db.run(
        `INSERT INTO simulations (symbol, entry_price, stop_loss_price, take_profit_price, 
         max_leverage, min_margin, trigger_reason, status, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          simulationData.symbol,
          simulationData.entryPrice,
          simulationData.stopLossPrice,
          simulationData.takeProfitPrice,
          simulationData.maxLeverage,
          simulationData.minMargin,
          simulationData.triggerReason,
          simulationData.status || 'ACTIVE'
        ]
      );

      // 更新缓存
      const cacheKey = `simulation:${simulationData.symbol}:all`;
      this.cache.delete(cacheKey);

      // 更新数据版本
      this.updateDataVersion('simulationData', simulationData.symbol);

      // 触发相关缓存失效
      this.invalidateRelatedCaches('simulationData', simulationData.symbol);

      console.log(`💾 模拟交易数据已保存: ${simulationData.symbol}`);
      return result;
    } catch (error) {
      console.error(`❌ 保存模拟交易数据失败: ${simulationData.symbol}`, error);
      throw error;
    }
  }

  /**
   * 获取监控数据
   * @param {Object} options - 查询选项
   */
  async getMonitoringData(options = {}) {
    const cacheKey = `monitoring:${JSON.stringify(options)}`;

    // 检查缓存
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log(`📦 从缓存获取监控数据`);
      return cached;
    }

    // 从数据库获取
    console.log(`🗄️ 从数据库获取监控数据`);

    // 获取所有交易对
    const symbols = await this.db.getCustomSymbols();

    // 并行获取每个交易对的数据
    const monitoringData = await Promise.all(symbols.map(async symbol => {
      const [strategyAnalysis, simulationData] = await Promise.all([
        this.getStrategyAnalysis(symbol, { latest: true }),
        this.getSimulationData(symbol, { active: true })
      ]);

      return {
        symbol,
        strategyAnalysis,
        simulationData,
        lastUpdate: new Date().toISOString()
      };
    }));

    // 缓存数据
    this.cache.set(cacheKey, monitoringData, this.cacheConfig.monitoringData);
    this.updateDataVersion('monitoringData', 'global');

    return monitoringData;
  }

  /**
   * 获取用户设置
   * @param {string} key - 设置键
   * @param {*} defaultValue - 默认值
   */
  async getUserSetting(key, defaultValue = null) {
    const cacheKey = `user_setting:${key}`;

    // 检查缓存
    const cached = this.cache.get(cacheKey);
    if (cached !== null) {
      console.log(`📦 从缓存获取用户设置: ${key}`);
      return cached;
    }

    // 从数据库获取
    console.log(`🗄️ 从数据库获取用户设置: ${key}`);
    const value = await this.db.getUserSetting(key, defaultValue);

    // 缓存数据
    this.cache.set(cacheKey, value, this.cacheConfig.userSettings);
    this.updateDataVersion('userSettings', key);

    return value;
  }

  /**
   * 保存用户设置
   * @param {string} key - 设置键
   * @param {*} value - 设置值
   */
  async setUserSetting(key, value) {
    try {
      // 保存到数据库
      const result = await this.db.setUserSetting(key, value);

      // 更新缓存
      const cacheKey = `user_setting:${key}`;
      this.cache.set(cacheKey, value, this.cacheConfig.userSettings);

      // 更新数据版本
      this.updateDataVersion('userSettings', key);

      console.log(`💾 用户设置已保存并缓存: ${key}`);
      return result;
    } catch (error) {
      console.error(`❌ 保存用户设置失败: ${key}`, error);
      throw error;
    }
  }

  /**
   * 获取告警历史
   * @param {Object} options - 查询选项
   */
  async getAlertHistory(options = {}) {
    const cacheKey = `alert_history:${JSON.stringify(options)}`;

    // 检查缓存
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log(`📦 从缓存获取告警历史`);
      return cached;
    }

    // 从数据库获取
    console.log(`🗄️ 从数据库获取告警历史`);
    const data = await this.db.getAlertHistory(
      options.limit || 100,
      options.alertType || null
    );

    // 缓存数据
    this.cache.set(cacheKey, data, this.cacheConfig.alertHistory);
    this.updateDataVersion('alertHistory', 'global');

    return data;
  }

  /**
   * 保存告警历史
   * @param {Object} alertData - 告警数据
   */
  async saveAlertHistory(alertData) {
    try {
      // 保存到数据库
      const result = await this.db.recordAlert(
        alertData.symbol,
        alertData.alertType,
        alertData.severity,
        alertData.message,
        alertData.details
      );

      // 清除相关缓存
      this.invalidateRelatedCaches('alertHistory', 'global');

      // 更新数据版本
      this.updateDataVersion('alertHistory', 'global');

      console.log(`💾 告警历史已保存: ${alertData.symbol}`);
      return result;
    } catch (error) {
      console.error(`❌ 保存告警历史失败: ${alertData.symbol}`, error);
      throw error;
    }
  }

  /**
   * 更新数据版本
   * @param {string} dataType - 数据类型
   * @param {string} key - 数据键
   */
  updateDataVersion(dataType, key) {
    const versionKey = `${dataType}:${key}`;
    this.dataVersions.set(versionKey, Date.now());
  }

  /**
   * 获取数据版本
   * @param {string} dataType - 数据类型
   * @param {string} key - 数据键
   */
  getDataVersion(dataType, key) {
    const versionKey = `${dataType}:${key}`;
    return this.dataVersions.get(versionKey) || 0;
  }

  /**
   * 失效相关缓存
   * @param {string} dataType - 数据类型
   * @param {string} key - 数据键
   */
  invalidateRelatedCaches(dataType, key) {
    const patterns = this.invalidationStrategies.get(dataType) || [];

    for (const pattern of patterns) {
      const regex = new RegExp(pattern.replace('*', '.*'));
      for (const cacheKey of this.cache.cache.keys()) {
        if (regex.test(cacheKey)) {
          this.cache.delete(cacheKey);
          console.log(`🗑️ 失效缓存: ${cacheKey}`);
        }
      }
    }
  }

  /**
   * 设置缓存失效策略
   * @param {string} dataType - 数据类型
   * @param {Array} patterns - 失效模式
   */
  setInvalidationStrategy(dataType, patterns) {
    this.invalidationStrategies.set(dataType, patterns);
  }

  /**
   * 清除所有缓存
   */
  clearAllCache() {
    this.cache.clear();
    this.dataVersions.clear();
    console.log('🗑️ 所有缓存已清除');
  }

  /**
   * 清除特定类型的缓存
   * @param {string} dataType - 数据类型
   */
  clearCacheByType(dataType) {
    const pattern = new RegExp(`^${dataType}:`);
    for (const key of this.cache.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
    console.log(`🗑️ ${dataType} 类型缓存已清除`);
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    return {
      cacheSize: this.cache.size(),
      dataVersions: this.dataVersions.size,
      cacheConfig: this.cacheConfig,
      invalidationStrategies: Array.from(this.invalidationStrategies.keys())
    };
  }

  /**
   * 启动缓存清理
   */
  startCacheCleanup() {
    // 每5分钟清理一次过期缓存
    setInterval(() => {
      this.cache.cleanExpired();
      console.log('🧹 缓存清理完成');
    }, 5 * 60 * 1000);
  }

  /**
   * 预热缓存
   * @param {Array} symbols - 交易对列表
   */
  async warmupCache(symbols) {
    console.log('🔥 开始预热缓存...');

    const promises = symbols.map(async symbol => {
      try {
        await Promise.all([
          this.getStrategyAnalysis(symbol, { latest: true }),
          this.getSimulationData(symbol, { active: true })
        ]);
        console.log(`✅ 预热完成: ${symbol}`);
      } catch (error) {
        console.error(`❌ 预热失败: ${symbol}`, error);
      }
    });

    await Promise.all(promises);
    console.log('🔥 缓存预热完成');
  }
}

module.exports = { DataAccessLayer };
