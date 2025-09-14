// modules/monitoring/OptimizedDataMonitor.js
// 优化后的数据监控模块 - 减少内存使用

const DataValidationSystem = require('./DataValidationSystem');
const { MemoryOptimizedManager } = require('../data/MemoryOptimizedManager');

class OptimizedDataMonitor {
  constructor(database = null) {
    this.database = database;
    this.validationSystem = new DataValidationSystem(database);
    this.memoryManager = new MemoryOptimizedManager(database);
    
    // 内存限制配置
    this.maxLogsPerSymbol = 3; // 每个交易对最多保留3条日志
    this.maxSymbols = 30; // 最多监控30个交易对
    this.maxDataQualityIssues = 2; // 每个交易对最多保留2个数据质量问题
    
    // 只保留必要的实时数据在内存中
    this.analysisLogs = new Map();
    this.completionRates = {
      dataCollection: 0,
      signalAnalysis: 0,
      simulationTrading: 0
    };
    this.healthStatus = {
      overall: 'HEALTHY',
      dataCollection: 'HEALTHY',
      signalAnalysis: 'HEALTHY',
      simulationTrading: 'HEALTHY'
    };
    this.alertThresholds = {
      dataCollection: 95,
      signalAnalysis: 95,
      simulationTrading: 90
    };
    
    // 减少内存存储的数据
    this.symbolStats = new Map();
    this.dataQualityIssues = new Map();
    this.lastRefreshTime = new Map();
    this.lastAlertTime = new Map();
    this.alertCooldown = 30 * 60 * 1000; // 30分钟冷却时间
    
    this.refreshInterval = 30000; // 30秒
    
    // 定时器ID存储
    this.memoryCleanupTimer = null;
  }

  /**
   * 开始分析（优化版本）
   */
  startAnalysis(symbol) {
    const now = Date.now();
    const lastRefresh = this.lastRefreshTime.get(symbol) || 0;
    const refreshFrequency = now - lastRefresh;

    this.lastRefreshTime.set(symbol, now);

    if (!this.symbolStats.has(symbol)) {
      this.symbolStats.set(symbol, {
        totalAnalyses: 0,
        successfulAnalyses: 0,
        failedAnalyses: 0,
        lastAnalysis: null,
        dataQualityScore: 100
      });
    }

    // 限制内存使用 - 只保留最近的数据
    this.limitMemoryUsage();
  }

  /**
   * 记录分析结果（优化版本）
   */
  recordAnalysisResult(symbol, result) {
    const stats = this.symbolStats.get(symbol);
    if (!stats) return;

    stats.totalAnalyses++;
    stats.lastAnalysis = {
      timestamp: Date.now(),
      success: result.success,
      dataQuality: result.dataQuality || 100
    };

    if (result.success) {
      stats.successfulAnalyses++;
    } else {
      stats.failedAnalyses++;
    }

    // 更新数据质量分数
    if (result.dataQuality !== undefined) {
      stats.dataQualityScore = result.dataQuality;
    }

    // 只保留最近的日志
    this.addAnalysisLog(symbol, result);
  }

  /**
   * 添加分析日志（限制数量）
   */
  addAnalysisLog(symbol, result) {
    if (!this.analysisLogs.has(symbol)) {
      this.analysisLogs.set(symbol, []);
    }

    const logs = this.analysisLogs.get(symbol);
    logs.push({
      timestamp: Date.now(),
      success: result.success,
      dataQuality: result.dataQuality,
      error: result.error
    });

    // 只保留最近的日志
    if (logs.length > this.maxLogsPerSymbol) {
      logs.splice(0, logs.length - this.maxLogsPerSymbol);
    }
  }

  /**
   * 记录数据质量问题（优化版本）
   */
  recordDataQualityIssue(symbol, issue) {
    if (!this.dataQualityIssues.has(symbol)) {
      this.dataQualityIssues.set(symbol, []);
    }

    const issues = this.dataQualityIssues.get(symbol);
    issues.push({
      timestamp: Date.now(),
      type: issue.type,
      severity: issue.severity,
      message: issue.message
    });

    // 只保留最近的问题
    if (issues.length > this.maxDataQualityIssues) {
      issues.splice(0, issues.length - this.maxDataQualityIssues);
    }
  }

  /**
   * 限制内存使用
   */
  limitMemoryUsage() {
    // 限制交易对数量
    if (this.symbolStats.size > this.maxSymbols) {
      const symbols = Array.from(this.symbolStats.keys());
      const toRemove = symbols.slice(0, symbols.length - this.maxSymbols);
      toRemove.forEach(symbol => {
        this.symbolStats.delete(symbol);
        this.analysisLogs.delete(symbol);
        this.dataQualityIssues.delete(symbol);
        this.lastRefreshTime.delete(symbol);
      });
    }

    // 清理过期的刷新时间记录
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24小时
    for (const [symbol, timestamp] of this.lastRefreshTime.entries()) {
      if (now - timestamp > maxAge) {
        this.lastRefreshTime.delete(symbol);
      }
    }
  }

  /**
   * 启动内存清理
   */
  startMemoryCleanup() {
    // 清理现有定时器
    this.stopMemoryCleanup();
    
    // 每10分钟清理一次过期数据
    this.memoryCleanupTimer = setInterval(() => {
      this.limitMemoryUsage();
      console.log(`🧹 数据监控内存清理完成 - 交易对: ${this.symbolStats.size}, 日志: ${this.analysisLogs.size}, 问题: ${this.dataQualityIssues.size}`);
    }, 10 * 60 * 1000);
  }

  /**
   * 停止内存清理定时器
   */
  stopMemoryCleanup() {
    if (this.memoryCleanupTimer) {
      clearInterval(this.memoryCleanupTimer);
      this.memoryCleanupTimer = null;
    }
  }

  /**
   * 获取监控数据（优化版本）
   */
  getMonitoringData() {
    const now = Date.now();
    const symbols = Array.from(this.symbolStats.keys());
    
    // 计算完成率
    let totalAnalyses = 0;
    let successfulAnalyses = 0;
    
    for (const stats of this.symbolStats.values()) {
      totalAnalyses += stats.totalAnalyses;
      successfulAnalyses += stats.successfulAnalyses;
    }
    
    this.completionRates.dataCollection = totalAnalyses > 0 ? (successfulAnalyses / totalAnalyses) * 100 : 0;
    this.completionRates.signalAnalysis = this.completionRates.dataCollection;
    this.completionRates.simulationTrading = this.completionRates.dataCollection;

    // 更新健康状态
    this.updateHealthStatus();

    return {
      completionRates: this.completionRates,
      healthStatus: this.healthStatus,
      symbolCount: symbols.length,
      totalAnalyses,
      successfulAnalyses,
      memoryUsage: this.getMemoryUsageStats()
    };
  }

  /**
   * 获取内存使用统计
   */
  getMemoryUsageStats() {
    return {
      symbolStats: this.symbolStats.size,
      analysisLogs: this.analysisLogs.size,
      dataQualityIssues: this.dataQualityIssues.size,
      lastRefreshTime: this.lastRefreshTime.size,
      lastAlertTime: this.lastAlertTime.size
    };
  }

  /**
   * 更新健康状态
   */
  updateHealthStatus() {
    const rates = this.completionRates;
    
    this.healthStatus.dataCollection = rates.dataCollection >= this.alertThresholds.dataCollection ? 'HEALTHY' : 'UNHEALTHY';
    this.healthStatus.signalAnalysis = rates.signalAnalysis >= this.alertThresholds.signalAnalysis ? 'HEALTHY' : 'UNHEALTHY';
    this.healthStatus.simulationTrading = rates.simulationTrading >= this.alertThresholds.simulationTrading ? 'HEALTHY' : 'UNHEALTHY';
    
    const unhealthyCount = Object.values(this.healthStatus).filter(status => status === 'UNHEALTHY').length;
    this.healthStatus.overall = unhealthyCount === 0 ? 'HEALTHY' : 'UNHEALTHY';
  }

  /**
   * 获取交易对统计（优化版本）
   */
  getSymbolStats() {
    const stats = [];
    
    for (const [symbol, data] of this.symbolStats.entries()) {
      stats.push({
        symbol,
        totalAnalyses: data.totalAnalyses,
        successfulAnalyses: data.successfulAnalyses,
        failedAnalyses: data.failedAnalyses,
        successRate: data.totalAnalyses > 0 ? (data.successfulAnalyses / data.totalAnalyses) * 100 : 0,
        dataQualityScore: data.dataQualityScore,
        lastAnalysis: data.lastAnalysis
      });
    }
    
    return stats.sort((a, b) => b.successRate - a.successRate);
  }

  /**
   * 清理所有内存数据
   */
  clearAllMemory() {
    this.analysisLogs.clear();
    this.symbolStats.clear();
    this.dataQualityIssues.clear();
    this.lastRefreshTime.clear();
    this.lastAlertTime.clear();
    console.log('🧹 数据监控内存清理完成');
  }
}

module.exports = { OptimizedDataMonitor };
