// modules/monitoring/DataMonitor.js
// 数据监控模块

class DataMonitor {
  constructor() {
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
      dataCollection: 99,
      signalAnalysis: 99,
      simulationTrading: 99
    };
    this.symbolStats = new Map();
    this.refreshInterval = 30000; // 30秒
    this.lastRefreshTime = new Map();
  }

  startAnalysis(symbol) {
    const now = Date.now();
    const lastRefresh = this.lastRefreshTime.get(symbol) || 0;
    const refreshFrequency = now - lastRefresh;

    this.lastRefreshTime.set(symbol, now);

    if (!this.symbolStats.has(symbol)) {
      this.symbolStats.set(symbol, {
        dataCollectionAttempts: 0,
        dataCollectionSuccesses: 0,
        signalAnalysisAttempts: 0,
        signalAnalysisSuccesses: 0,
        simulationTriggers: 0,
        simulationCompletions: 0,
        simulationInProgress: 0,
        lastDataCollectionTime: null,
        lastSignalAnalysisTime: null,
        lastSimulationTime: null
      });
    }

    this.analysisLogs.set(symbol, {
      startTime: now,
      endTime: null,
      success: false,
      symbol,
      phases: {
        dataCollection: { success: false, error: null },
        signalAnalysis: { success: false, error: null },
        simulationTrading: { success: false, error: null }
      },
      rawData: {},
      indicators: {},
      signals: {},
      simulation: {},
      errors: [],
      totalTime: 0
    });
  }

  recordRawData(symbol, dataType, data, success = true, error = null) {
    const stats = this.symbolStats.get(symbol);
    if (stats) {
      stats.dataCollectionAttempts++;
      if (success) {
        stats.dataCollectionSuccesses++;
        stats.lastDataCollectionTime = Date.now();
      }
    }

    const log = this.analysisLogs.get(symbol);
    if (log) {
      log.rawData[dataType] = { data, success, error };
      log.phases.dataCollection.success = success;
      if (error) {
        log.errors.push(`数据收集错误 (${dataType}): ${error.message || error}`);
      }
    }
  }

  recordIndicator(symbol, indicatorType, data, calculationTime) {
    const log = this.analysisLogs.get(symbol);
    if (log) {
      log.indicators[indicatorType] = { data, calculationTime };
    }
  }

  recordSignal(symbol, signalType, signalData, success = true, error = null) {
    const stats = this.symbolStats.get(symbol);
    if (stats) {
      stats.signalAnalysisAttempts++;
      if (success) {
        stats.signalAnalysisSuccesses++;
        stats.lastSignalAnalysisTime = Date.now();
      }
    }

    const log = this.analysisLogs.get(symbol);
    if (log) {
      log.signals[signalType] = { data: signalData, success, error };
      log.phases.signalAnalysis.success = success;
      if (error) {
        log.errors.push(`信号分析错误 (${signalType}): ${error.message || error}`);
      }
    }
  }

  recordSimulation(symbol, simulationType, simulationData, success = true, error = null) {
    const stats = this.symbolStats.get(symbol);
    if (stats) {
      stats.simulationTriggers++;
      if (success) {
        stats.simulationCompletions++;
        stats.lastSimulationTime = Date.now();
      }
    }

    const log = this.analysisLogs.get(symbol);
    if (log) {
      log.simulation[simulationType] = { data: simulationData, success, error };
      log.phases.simulationTrading.success = success;
      if (error) {
        log.errors.push(`模拟交易错误 (${simulationType}): ${error.message || error}`);
      }
    }
  }

  completeDataCollection(symbol, success = true) {
    const log = this.analysisLogs.get(symbol);
    if (log) {
      log.endTime = Date.now();
      log.success = success;
      log.totalTime = log.endTime - log.startTime;
    }

    this.calculateCompletionRates();
    this.checkHealthStatus();
  }

  getAnalysisLog(symbol) {
    const log = this.analysisLogs.get(symbol);
    if (!log) {
      return {
        success: false,
        symbol,
        phases: {
          dataCollection: { success: false },
          signalAnalysis: { success: false },
          simulationTrading: { success: false }
        },
        rawData: {},
        indicators: {},
        signals: {},
        simulation: {},
        errors: [],
        totalTime: 0
      };
    }
    return log;
  }

  calculateCompletionRates() {
    const symbols = Array.from(this.symbolStats.keys());
    if (symbols.length === 0) {
      this.completionRates = { dataCollection: 0, signalAnalysis: 0, simulationTrading: 0 };
      return;
    }

    let totalDataAttempts = 0, totalDataSuccesses = 0;
    let totalSignalAttempts = 0, totalSignalSuccesses = 0;
    let totalSimulationTriggers = 0, totalSimulationCompletions = 0;

    for (const symbol of symbols) {
      const stats = this.symbolStats.get(symbol);
      totalDataAttempts += stats.dataCollectionAttempts;
      totalDataSuccesses += stats.dataCollectionSuccesses;
      totalSignalAttempts += stats.signalAnalysisAttempts;
      totalSignalSuccesses += stats.signalAnalysisSuccesses;
      totalSimulationTriggers += stats.simulationTriggers;
      totalSimulationCompletions += stats.simulationCompletions;
    }

    this.completionRates = {
      dataCollection: totalDataAttempts > 0 ? (totalDataSuccesses / totalDataAttempts) * 100 : 0,
      signalAnalysis: totalSignalAttempts > 0 ? (totalSignalSuccesses / totalSignalAttempts) * 100 : 0,
      simulationTrading: totalSimulationTriggers > 0 ? (totalSimulationCompletions / totalSimulationTriggers) * 100 : 0
    };
  }

  checkHealthStatus() {
    const thresholds = this.alertThresholds;

    this.healthStatus = {
      dataCollection: this.completionRates.dataCollection >= thresholds.dataCollection ? 'HEALTHY' : 'WARNING',
      signalAnalysis: this.completionRates.signalAnalysis >= thresholds.signalAnalysis ? 'HEALTHY' : 'WARNING',
      simulationTrading: this.completionRates.simulationTrading >= thresholds.simulationTrading ? 'HEALTHY' : 'WARNING'
    };

    const overallRate = (this.completionRates.dataCollection + this.completionRates.signalAnalysis + this.completionRates.simulationTrading) / 3;
    this.healthStatus.overall = overallRate >= 99 ? 'HEALTHY' : 'WARNING';
  }

  getMonitoringDashboard() {
    this.calculateCompletionRates();
    this.checkHealthStatus();

    const symbols = Array.from(this.symbolStats.keys()).filter(symbol => symbol && symbol.trim() !== '');
    const recentLogs = symbols.map(symbol => this.getAnalysisLog(symbol)).filter(log => log !== null);

    const detailedStats = symbols.map(symbol => {
      const stats = this.symbolStats.get(symbol);
      const log = this.getAnalysisLog(symbol);

      if (!stats) {
        return {
          symbol,
          dataCollection: { rate: 0, attempts: 0, successes: 0 },
          signalAnalysis: { rate: 0, attempts: 0, successes: 0 },
          simulationCompletion: { rate: 0, triggers: 0, completions: 0 },
          simulationProgress: { rate: 0, triggers: 0, inProgress: 0 },
          refreshFrequency: 0,
          overall: { rate: 0, status: 'UNKNOWN' },
          hasExecution: false,
          hasSignal: false,
          hasTrend: false,
          priorityScore: 0
        };
      }

      const dataCollectionRate = stats.dataCollectionAttempts > 0 ?
        (stats.dataCollectionSuccesses / stats.dataCollectionAttempts) * 100 : 0;
      const signalAnalysisRate = stats.signalAnalysisAttempts > 0 ?
        (stats.signalAnalysisSuccesses / stats.signalAnalysisAttempts) * 100 : 0;
      const simulationCompletionRate = stats.simulationTriggers > 0 ?
        (stats.simulationCompletions / stats.simulationTriggers) * 100 : 0;
      const simulationProgressRate = stats.simulationTriggers > 0 ?
        (stats.simulationInProgress / stats.simulationTriggers) * 100 : 0;

      // 检查各阶段信号状态
      let hasExecution = false;
      let hasSignal = false;
      let hasTrend = false;

      if (log) {
        if (log.execution && log.execution !== 'NO_EXECUTION' && log.execution.includes('EXECUTE')) {
          hasExecution = true;
        }
        if (log.signal && log.signal !== 'NO_SIGNAL' && (log.signal === 'LONG' || log.signal === 'SHORT')) {
          hasSignal = true;
        }
        if (log.trend && log.trend !== 'RANGE' && (log.trend === 'UPTREND' || log.trend === 'DOWNTREND')) {
          hasTrend = true;
        }
      }

      const priorityScore = (hasExecution ? 1000 : 0) + (hasSignal ? 100 : 0) + (hasTrend ? 10 : 0);
      const signalActivityScore = (stats.signalAnalysisSuccesses * 10) + (stats.simulationTriggers * 5) + (stats.simulationInProgress * 3);
      const overallRate = (dataCollectionRate + signalAnalysisRate + simulationCompletionRate) / 3;

      return {
        symbol,
        dataCollection: {
          rate: dataCollectionRate,
          attempts: stats.dataCollectionAttempts,
          successes: stats.dataCollectionSuccesses,
          lastTime: stats.lastDataCollectionTime
        },
        signalAnalysis: {
          rate: signalAnalysisRate,
          attempts: stats.signalAnalysisAttempts,
          successes: stats.signalAnalysisSuccesses,
          lastTime: stats.lastSignalAnalysisTime
        },
        simulationCompletion: {
          rate: simulationCompletionRate,
          triggers: stats.simulationTriggers,
          completions: stats.simulationCompletions
        },
        simulationProgress: {
          rate: simulationProgressRate,
          triggers: stats.simulationTriggers,
          inProgress: stats.simulationInProgress
        },
        refreshFrequency: this.refreshInterval / 1000,
        overall: {
          rate: overallRate,
          status: overallRate >= 99 ? 'HEALTHY' : 'WARNING'
        },
        hasExecution,
        hasSignal,
        hasTrend,
        priorityScore,
        signalActivityScore
      };
    });

    // 按优先级排序
    detailedStats.sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }
      if (b.signalActivityScore !== a.signalActivityScore) {
        return b.signalActivityScore - a.signalActivityScore;
      }
      return b.overall.rate - a.overall.rate;
    });

    return {
      summary: {
        totalSymbols: symbols.length,
        healthySymbols: detailedStats.filter(s => s.overall.status === 'HEALTHY').length,
        warningSymbols: detailedStats.filter(s => s.overall.status === 'WARNING').length,
        overallHealth: this.healthStatus.overall,
        completionRates: this.completionRates
      },
      detailedStats,
      recentLogs: recentLogs.slice(0, 10),
      thresholds: this.alertThresholds,
      lastUpdated: new Date().toISOString()
    };
  }

  clearOldLogs() {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24小时前
    for (const [symbol, log] of this.analysisLogs.entries()) {
      if (log.startTime < cutoffTime) {
        this.analysisLogs.delete(symbol);
      }
    }
  }

  setAlertThresholds(thresholds) {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
    this.checkHealthStatus();
  }

  async checkAndSendAlerts(telegramNotifier) {
    if (!telegramNotifier || !telegramNotifier.enabled) return;

    const dashboard = this.getMonitoringDashboard();
    const { detailedStats } = dashboard;

    for (const symbol of detailedStats) {
      const { dataCollection, signalAnalysis, simulationTrading } = symbol;

      // 检查数据收集告警
      if (dataCollection.rate < this.alertThresholds.dataCollection) {
        await telegramNotifier.sendMessage(
          `⚠️ ${symbol.symbol} 数据收集完成率过低: ${dataCollection.rate.toFixed(1)}% (阈值: ${this.alertThresholds.dataCollection}%)`
        );
      }

      // 检查信号判断告警
      if (signalAnalysis.rate < this.alertThresholds.signalAnalysis) {
        await telegramNotifier.sendMessage(
          `⚠️ ${symbol.symbol} 信号判断完成率过低: ${signalAnalysis.rate.toFixed(1)}% (阈值: ${this.alertThresholds.signalAnalysis}%)`
        );
      }

      // 检查模拟交易告警
      if (simulationTrading.rate < this.alertThresholds.simulationTrading) {
        await telegramNotifier.sendMessage(
          `⚠️ ${symbol.symbol} 模拟交易完成率过低: ${simulationTrading.rate.toFixed(1)}% (阈值: ${this.alertThresholds.simulationTrading}%)`
        );
      }
    }
  }
}

module.exports = { DataMonitor };
