// modules/monitoring/RealTimeDataMonitor.js
// 实时Binance API数据采集率监控

class RealTimeDataMonitor {
  constructor() {
    this.apiCallStats = new Map(); // 存储每个交易对的API调用统计
    this.globalStats = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      lastUpdate: Date.now()
    };
  }

  /**
   * 记录API调用结果
   * @param {string} symbol - 交易对
   * @param {string} dataType - 数据类型 (klines, ticker, funding, openInterest, etc.)
   * @param {boolean} success - 是否成功
   * @param {string} error - 错误信息
   */
  recordAPICall(symbol, dataType, success, error = null) {
    // 更新全局统计
    this.globalStats.totalCalls++;
    if (success) {
      this.globalStats.successfulCalls++;
    } else {
      this.globalStats.failedCalls++;
    }
    this.globalStats.lastUpdate = Date.now();

    // 更新交易对统计
    if (!this.apiCallStats.has(symbol)) {
      this.apiCallStats.set(symbol, {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        dataTypeStats: new Map(),
        lastUpdate: Date.now(),
        errors: []
      });
    }

    const symbolStats = this.apiCallStats.get(symbol);
    symbolStats.totalCalls++;
    if (success) {
      symbolStats.successfulCalls++;
    } else {
      symbolStats.failedCalls++;
      if (error) {
        symbolStats.errors.push({
          dataType,
          error,
          timestamp: Date.now()
        });
        // 只保留最近10个错误
        if (symbolStats.errors.length > 10) {
          symbolStats.errors = symbolStats.errors.slice(-10);
        }
      }
    }
    symbolStats.lastUpdate = Date.now();

    // 更新数据类型统计
    if (!symbolStats.dataTypeStats.has(dataType)) {
      symbolStats.dataTypeStats.set(dataType, {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        lastError: null
      });
    }

    const dataTypeStats = symbolStats.dataTypeStats.get(dataType);
    dataTypeStats.totalCalls++;
    if (success) {
      dataTypeStats.successfulCalls++;
    } else {
      dataTypeStats.failedCalls++;
      dataTypeStats.lastError = error;
    }

    // 记录到控制台
    if (success) {
      console.log(`✅ API调用成功 [${symbol}] ${dataType}`);
    } else {
      console.log(`❌ API调用失败 [${symbol}] ${dataType}: ${error}`);
    }
  }

  /**
   * 获取全局数据采集率
   * @returns {Object} 全局统计信息
   */
  getGlobalStats() {
    const successRate = this.globalStats.totalCalls > 0 
      ? (this.globalStats.successfulCalls / this.globalStats.totalCalls * 100).toFixed(2)
      : 0;

    return {
      totalCalls: this.globalStats.totalCalls,
      successfulCalls: this.globalStats.successfulCalls,
      failedCalls: this.globalStats.failedCalls,
      successRate: parseFloat(successRate),
      lastUpdate: this.globalStats.lastUpdate
    };
  }

  /**
   * 获取指定交易对的数据采集率
   * @param {string} symbol - 交易对
   * @returns {Object} 交易对统计信息
   */
  getSymbolStats(symbol) {
    const symbolStats = this.apiCallStats.get(symbol);
    if (!symbolStats) {
      return {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        successRate: 0,
        dataTypeStats: {},
        errors: [],
        lastUpdate: null
      };
    }

    const successRate = symbolStats.totalCalls > 0 
      ? (symbolStats.successfulCalls / symbolStats.totalCalls * 100).toFixed(2)
      : 0;

    // 转换数据类型统计
    const dataTypeStats = {};
    for (const [dataType, stats] of symbolStats.dataTypeStats) {
      const dataTypeSuccessRate = stats.totalCalls > 0 
        ? (stats.successfulCalls / stats.totalCalls * 100).toFixed(2)
        : 0;
      
      dataTypeStats[dataType] = {
        totalCalls: stats.totalCalls,
        successfulCalls: stats.successfulCalls,
        failedCalls: stats.failedCalls,
        successRate: parseFloat(dataTypeSuccessRate),
        lastError: stats.lastError
      };
    }

    return {
      totalCalls: symbolStats.totalCalls,
      successfulCalls: symbolStats.successfulCalls,
      failedCalls: symbolStats.failedCalls,
      successRate: parseFloat(successRate),
      dataTypeStats,
      errors: symbolStats.errors,
      lastUpdate: symbolStats.lastUpdate
    };
  }

  /**
   * 获取所有交易对的统计信息
   * @returns {Array} 所有交易对的统计信息数组
   */
  getAllSymbolStats() {
    const results = [];
    for (const [symbol, stats] of this.apiCallStats) {
      results.push({
        symbol,
        ...this.getSymbolStats(symbol)
      });
    }
    return results.sort((a, b) => b.totalCalls - a.totalCalls);
  }

  /**
   * 获取失败原因分析
   * @returns {Object} 失败原因统计
   */
  getFailureAnalysis() {
    const failureReasons = new Map();
    let totalFailures = 0;

    for (const [symbol, stats] of this.apiCallStats) {
      for (const error of stats.errors) {
        totalFailures++;
        const reason = this.categorizeError(error.error);
        if (!failureReasons.has(reason)) {
          failureReasons.set(reason, { count: 0, examples: [] });
        }
        const reasonStats = failureReasons.get(reason);
        reasonStats.count++;
        if (reasonStats.examples.length < 3) {
          reasonStats.examples.push({
            symbol,
            dataType: error.dataType,
            error: error.error,
            timestamp: error.timestamp
          });
        }
      }
    }

    return {
      totalFailures,
      reasons: Object.fromEntries(failureReasons),
      summary: Array.from(failureReasons.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .map(([reason, stats]) => ({
          reason,
          count: stats.count,
          percentage: ((stats.count / totalFailures) * 100).toFixed(2)
        }))
    };
  }

  /**
   * 分类错误原因
   * @param {string} error - 错误信息
   * @returns {string} 错误分类
   */
  categorizeError(error) {
    if (error.includes('网络连接失败') || error.includes('fetch')) {
      return '网络连接问题';
    } else if (error.includes('地理位置限制') || error.includes('restricted location')) {
      return '地理位置限制';
    } else if (error.includes('Invalid symbol') || error.includes('不存在')) {
      return '交易对无效';
    } else if (error.includes('429') || error.includes('Too Many Requests')) {
      return 'API限流';
    } else if (error.includes('403')) {
      return '访问被拒绝';
    } else if (error.includes('500') || error.includes('502') || error.includes('503')) {
      return '服务器错误';
    } else {
      return '其他错误';
    }
  }

  /**
   * 重置统计数据
   */
  reset() {
    this.apiCallStats.clear();
    this.globalStats = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      lastUpdate: Date.now()
    };
    console.log('🔄 实时数据监控统计已重置');
  }
}

module.exports = RealTimeDataMonitor;
