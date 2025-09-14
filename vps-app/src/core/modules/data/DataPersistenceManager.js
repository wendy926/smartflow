// modules/data/DataPersistenceManager.js
// 数据持久化管理器 - 确保所有数据都持久化到数据库

const EventEmitter = require('events');

/**
 * 数据持久化管理器
 * 负责将内存中的数据持久化到数据库，确保数据不丢失
 */
class DataPersistenceManager extends EventEmitter {
  constructor(dataAccessLayer, options = {}) {
    super();
    this.dal = dataAccessLayer;
    this.db = dataAccessLayer.db;

    // 持久化配置
    this.persistenceConfig = {
      autoSaveInterval: 30 * 1000,      // 30秒自动保存一次
      batchSize: 100,                   // 批处理大小
      enableAutoSave: true,             // 启用自动保存
      enableCompression: false,         // 启用数据压缩
      enableEncryption: false,          // 启用数据加密
      ...options.persistenceConfig
    };

    // 待持久化的数据队列
    this.pendingData = new Map();

    // 数据变更追踪
    this.dataChanges = new Map();

    // 启动自动保存
    if (this.persistenceConfig.enableAutoSave) {
      this.startAutoSave();
    }
  }

  /**
   * 标记数据需要持久化
   * @param {string} dataType - 数据类型
   * @param {string} key - 数据键
   * @param {*} data - 数据
   * @param {Object} options - 选项
   */
  markForPersistence(dataType, key, data, options = {}) {
    const persistenceKey = `${dataType}:${key}`;

    // 记录数据变更
    this.dataChanges.set(persistenceKey, {
      dataType,
      key,
      data,
      timestamp: Date.now(),
      options
    });

    // 添加到待持久化队列
    if (!this.pendingData.has(dataType)) {
      this.pendingData.set(dataType, new Map());
    }
    this.pendingData.get(dataType).set(key, {
      data,
      timestamp: Date.now(),
      options
    });

    console.log(`📝 标记数据待持久化: ${dataType}:${key}`);
  }

  /**
   * 立即持久化数据
   * @param {string} dataType - 数据类型
   * @param {string} key - 数据键
   * @param {*} data - 数据
   * @param {Object} options - 选项
   */
  async persistData(dataType, key, data, options = {}) {
    try {
      console.log(`💾 开始持久化数据: ${dataType}:${key}`);

      switch (dataType) {
        case 'strategyAnalysis':
          await this.persistStrategyAnalysis(key, data, options);
          break;

        case 'simulationData':
          await this.persistSimulationData(key, data, options);
          break;

        case 'monitoringData':
          await this.persistMonitoringData(key, data, options);
          break;

        case 'userSettings':
          await this.persistUserSettings(key, data, options);
          break;

        case 'alertHistory':
          await this.persistAlertHistory(key, data, options);
          break;

        default:
          throw new Error(`未知的数据类型: ${dataType}`);
      }

      // 清除待持久化标记
      this.clearPendingData(dataType, key);

      console.log(`✅ 数据持久化完成: ${dataType}:${key}`);
      this.emit('persisted', { dataType, key, data });

    } catch (error) {
      console.error(`❌ 数据持久化失败: ${dataType}:${key}`, error);
      this.emit('persistError', { dataType, key, data, error });
      throw error;
    }
  }

  /**
   * 持久化策略分析数据
   * @param {string} key - 数据键
   * @param {*} data - 数据
   * @param {Object} options - 选项
   */
  async persistStrategyAnalysis(key, data, options = {}) {
    if (Array.isArray(data)) {
      // 批量保存
      for (const item of data) {
        await this.db.recordStrategyAnalysis(item);
      }
    } else {
      // 单个保存
      await this.db.recordStrategyAnalysis(data);
    }
  }

  /**
   * 持久化模拟交易数据
   * @param {string} key - 数据键
   * @param {*} data - 数据
   * @param {Object} options - 选项
   */
  async persistSimulationData(key, data, options = {}) {
    if (Array.isArray(data)) {
      // 批量保存
      for (const item of data) {
        await this.db.run(
          `INSERT INTO simulations (symbol, entry_price, stop_loss_price, take_profit_price, 
           max_leverage, min_margin, trigger_reason, status, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [
            item.symbol,
            item.entryPrice,
            item.stopLossPrice,
            item.takeProfitPrice,
            item.maxLeverage,
            item.minMargin,
            item.triggerReason,
            item.status || 'ACTIVE'
          ]
        );
      }
    } else {
      // 单个保存
      await this.db.run(
        `INSERT INTO simulations (symbol, entry_price, stop_loss_price, take_profit_price, 
         max_leverage, min_margin, trigger_reason, status, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          data.symbol,
          data.entryPrice,
          data.stopLossPrice,
          data.takeProfitPrice,
          data.maxLeverage,
          data.minMargin,
          data.triggerReason,
          data.status || 'ACTIVE'
        ]
      );
    }
  }

  /**
   * 持久化监控数据
   * @param {string} key - 数据键
   * @param {*} data - 数据
   * @param {Object} options - 选项
   */
  async persistMonitoringData(key, data, options = {}) {
    // 监控数据通常不需要持久化，因为它是实时计算的
    // 但可以保存统计数据
    if (data.statistics) {
      await this.db.run(
        `INSERT INTO monitoring_stats (symbol, data_collection_rate, signal_analysis_rate, 
         simulation_completion_rate, timestamp) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          data.symbol,
          data.statistics.dataCollectionRate,
          data.statistics.signalAnalysisRate,
          data.statistics.simulationCompletionRate
        ]
      );
    }
  }

  /**
   * 持久化用户设置
   * @param {string} key - 数据键
   * @param {*} data - 数据
   * @param {Object} options - 选项
   */
  async persistUserSettings(key, data, options = {}) {
    await this.db.setUserSetting(key, data);
  }

  /**
   * 持久化告警历史
   * @param {string} key - 数据键
   * @param {*} data - 数据
   * @param {Object} options - 选项
   */
  async persistAlertHistory(key, data, options = {}) {
    if (Array.isArray(data)) {
      // 批量保存
      for (const item of data) {
        await this.db.recordAlert(
          item.symbol,
          item.alertType,
          item.severity,
          item.message,
          item.details
        );
      }
    } else {
      // 单个保存
      await this.db.recordAlert(
        data.symbol,
        data.alertType,
        data.severity,
        data.message,
        data.details
      );
    }
  }

  /**
   * 批量持久化数据
   * @param {string} dataType - 数据类型
   */
  async batchPersist(dataType) {
    const pendingData = this.pendingData.get(dataType);
    if (!pendingData || pendingData.size === 0) {
      return;
    }

    console.log(`📦 开始批量持久化: ${dataType} (${pendingData.size} 条记录)`);

    const batch = Array.from(pendingData.entries()).slice(0, this.persistenceConfig.batchSize);

    for (const [key, item] of batch) {
      try {
        await this.persistData(dataType, key, item.data, item.options);
      } catch (error) {
        console.error(`❌ 批量持久化失败: ${dataType}:${key}`, error);
      }
    }

    console.log(`✅ 批量持久化完成: ${dataType}`);
  }

  /**
   * 清除待持久化数据
   * @param {string} dataType - 数据类型
   * @param {string} key - 数据键
   */
  clearPendingData(dataType, key) {
    if (this.pendingData.has(dataType)) {
      this.pendingData.get(dataType).delete(key);
      if (this.pendingData.get(dataType).size === 0) {
        this.pendingData.delete(dataType);
      }
    }

    const persistenceKey = `${dataType}:${key}`;
    this.dataChanges.delete(persistenceKey);
  }

  /**
   * 启动自动保存
   */
  startAutoSave() {
    this.autoSaveInterval = setInterval(async () => {
      try {
        await this.performAutoSave();
      } catch (error) {
        console.error('❌ 自动保存失败:', error);
      }
    }, this.persistenceConfig.autoSaveInterval);

    console.log('🔄 自动保存已启动');
  }

  /**
   * 执行自动保存
   */
  async performAutoSave() {
    console.log('💾 开始自动保存...');

    const dataTypes = Array.from(this.pendingData.keys());

    for (const dataType of dataTypes) {
      try {
        await this.batchPersist(dataType);
      } catch (error) {
        console.error(`❌ 自动保存失败: ${dataType}`, error);
      }
    }

    console.log('✅ 自动保存完成');
  }

  /**
   * 强制保存所有待持久化数据
   */
  async forceSaveAll() {
    console.log('💾 强制保存所有待持久化数据...');

    const dataTypes = Array.from(this.pendingData.keys());

    for (const dataType of dataTypes) {
      const pendingData = this.pendingData.get(dataType);
      if (pendingData) {
        for (const [key, item] of pendingData.entries()) {
          try {
            await this.persistData(dataType, key, item.data, item.options);
          } catch (error) {
            console.error(`❌ 强制保存失败: ${dataType}:${key}`, error);
          }
        }
      }
    }

    console.log('✅ 强制保存完成');
  }

  /**
   * 获取待持久化数据统计
   */
  getPendingDataStats() {
    const stats = {};
    for (const [dataType, data] of this.pendingData.entries()) {
      stats[dataType] = data.size;
    }
    return {
      totalTypes: this.pendingData.size,
      totalRecords: Array.from(this.pendingData.values()).reduce((sum, data) => sum + data.size, 0),
      byType: stats
    };
  }

  /**
   * 停止自动保存
   */
  stopAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
    console.log('⏹️ 自动保存已停止');
  }

  /**
   * 清理过期数据
   * @param {number} maxAge - 最大年龄（毫秒）
   */
  async cleanupExpiredData(maxAge = 24 * 60 * 60 * 1000) {
    console.log('🧹 开始清理过期数据...');

    const cutoffTime = Date.now() - maxAge;

    // 清理数据变更记录
    for (const [key, change] of this.dataChanges.entries()) {
      if (change.timestamp < cutoffTime) {
        this.dataChanges.delete(key);
      }
    }

    // 清理待持久化数据
    for (const [dataType, data] of this.pendingData.entries()) {
      for (const [key, item] of data.entries()) {
        if (item.timestamp < cutoffTime) {
          data.delete(key);
        }
      }
      if (data.size === 0) {
        this.pendingData.delete(dataType);
      }
    }

    console.log('✅ 过期数据清理完成');
  }
}

module.exports = { DataPersistenceManager };
