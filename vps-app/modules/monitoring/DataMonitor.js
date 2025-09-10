// modules/monitoring/DataMonitor.js
// 数据监控模块

const DataValidationSystem = require('./DataValidationSystem');

class DataMonitor {
  constructor(database = null) {
    this.database = database; // 数据库引用
    this.validationSystem = new DataValidationSystem(database); // 数据验证系统
    
    // 只保留必要的实时数据在内存中，其他数据存储到数据库
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
      dataCollection: 95, // 降低阈值，95%以上认为正常
      signalAnalysis: 95, // 降低阈值，95%以上认为正常
      simulationTrading: 90 // 降低阈值，90%以上认为正常
    };
    
    // 只保留最近15分钟的数据在内存中
    this.memoryRetentionMs = 15 * 60 * 1000; // 15分钟
    this.symbolStats = new Map(); // 只保留实时统计
    this.lastRefreshTime = new Map(); // 只保留刷新时间
    this.lastAlertTime = new Map(); // 记录上次告警时间，避免重复告警
    this.alertCooldown = 30 * 60 * 1000; // 30分钟冷却时间
    this.refreshInterval = 30000; // 30秒

    // 启动定期清理
    this.startMemoryCleanup();
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

    // 增加尝试次数
    const stats = this.symbolStats.get(symbol);
    stats.dataCollectionAttempts++;
    stats.signalAnalysisAttempts++;

    // 创建分析日志对象（不再存储在内存中）
    const analysisLog = {
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
    };

    // 存储到数据库
    if (this.database) {
      this.storeAnalysisLog(analysisLog).catch(error => {
        console.error('存储分析日志失败:', error);
      });
    }

    return analysisLog;
  }

  // 存储分析日志到数据库
  async storeAnalysisLog(analysisLog) {
    if (!this.database) return;

    try {
      await this.database.run(`
        INSERT INTO analysis_logs (symbol, start_time, end_time, success, phases, error_message)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        analysisLog.symbol,
        new Date(analysisLog.startTime).toISOString(),
        analysisLog.endTime ? new Date(analysisLog.endTime).toISOString() : null,
        analysisLog.success,
        JSON.stringify(analysisLog.phases),
        analysisLog.errors.length > 0 ? analysisLog.errors.join('; ') : null
      ]);
    } catch (error) {
      console.error('存储分析日志失败:', error);
    }
  }

  recordRawData(symbol, dataType, data, success = true, error = null) {
    const stats = this.symbolStats.get(symbol);
    if (stats) {
      // 初始化数据类型统计
      if (!stats.dataTypeStats) {
        stats.dataTypeStats = new Map();
      }

      if (!stats.dataTypeStats.has(dataType)) {
        stats.dataTypeStats.set(dataType, {
          attempts: 0,
          successes: 0,
          lastSuccessTime: null,
          lastErrorTime: null,
          lastError: null
        });
      }

      const dataTypeStats = stats.dataTypeStats.get(dataType);
      dataTypeStats.attempts++;

      if (success) {
        dataTypeStats.successes++;
        dataTypeStats.lastSuccessTime = Date.now();
        dataTypeStats.lastError = null;
      } else {
        dataTypeStats.lastErrorTime = Date.now();
        dataTypeStats.lastError = error;
      }

      stats.dataCollectionAttempts++;
      if (success) {
        stats.dataCollectionSuccesses++;
        stats.lastDataCollectionTime = Date.now();
      }
    }

    // 记录数据质量问题到数据库
    if (!success) {
      this.recordDataQualityIssue(symbol, dataType, error?.message || error);
    }
  }

  // 记录数据质量问题
  async recordDataQualityIssue(symbol, analysisType, errorMessage) {
    // 直接存储到数据库
    if (this.database) {
      try {
        await this.database.run(`
          INSERT INTO data_quality_issues (symbol, issue_type, severity, message, details)
          VALUES (?, ?, ?, ?, ?)
        `, [
          symbol,
          analysisType,
          'HIGH', // 数据质量问题都是高严重性
          errorMessage,
          JSON.stringify({ timestamp: new Date().toISOString() })
        ]);
      } catch (error) {
        console.error('存储数据质量问题失败:', error);
      }
    }
  }

  recordIndicator(symbol, indicatorType, data, calculationTime) {
    // 指标数据不再存储在内存中，直接使用
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

    // 记录数据质量问题到数据库
    if (!success) {
      this.recordDataQualityIssue(symbol, signalType, error?.message || error);
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

    // 记录数据质量问题到数据库
    if (!success) {
      this.recordDataQualityIssue(symbol, simulationType, error?.message || error);
    }
  }

  completeDataCollection(symbol, success = true) {
    // 数据收集完成，不再需要存储到内存
    this.calculateCompletionRates();
    this.checkHealthStatus();
  }

  /**
   * 记录完整的分析日志
   * @param {string} symbol - 交易对
   * @param {Object} analysisResult - 分析结果
   */
  recordAnalysisLog(symbol, analysisResult) {
    // 分析日志不再存储在内存中，直接使用结果
    
    // 更新统计数据
    const stats = this.symbolStats.get(symbol);
    if (stats) {
      // 根据分析结果更新成功次数
      if (analysisResult.phases?.dataCollection?.success) {
        stats.dataCollectionSuccesses++;
        stats.lastDataCollectionTime = Date.now();
      }
      if (analysisResult.phases?.signalAnalysis?.success) {
        stats.signalAnalysisSuccesses++;
        stats.lastSignalAnalysisTime = Date.now();
      }
      if (analysisResult.phases?.simulationTrading?.success) {
        stats.simulationCompletions++;
        stats.lastSimulationTime = Date.now();
      }
    }
  }

  getAnalysisLog(symbol) {
    // 不再从内存中获取分析日志，返回默认结构
    return {
      success: false,
      symbol,
      strategyVersion: 'V3', // 默认V3策略
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
      dataCollection: totalDataAttempts > 0 ? Math.min((totalDataSuccesses / totalDataAttempts) * 100, 100) : 0,
      signalAnalysis: totalSignalAttempts > 0 ? Math.min((totalSignalSuccesses / totalSignalAttempts) * 100, 100) : 0,
      simulationTrading: totalSimulationTriggers > 0 ? Math.min((totalSimulationCompletions / totalSimulationTriggers) * 100, 100) : 0
    };
  }

  // 从数据库重新同步模拟交易统计
  async syncSimulationStatsFromDB(db) {
    try {
      console.log('🔄 开始从数据库同步模拟交易统计...');

      // 获取所有模拟交易统计
      const stats = await db.runQuery(`
        SELECT 
          symbol,
          COUNT(*) as total_simulations,
          SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END) as completed_simulations
        FROM simulations 
        GROUP BY symbol
      `);

      for (const stat of stats) {
        const symbol = stat.symbol;
        const totalSimulations = stat.total_simulations;
        const completedSimulations = stat.completed_simulations;

        // 确保symbolStats中有该交易对的记录
        if (!this.symbolStats.has(symbol)) {
          this.symbolStats.set(symbol, {
            dataCollectionAttempts: 0,
            dataCollectionSuccesses: 0,
            signalAnalysisAttempts: 0,
            signalAnalysisSuccesses: 0,
            simulationTriggers: 0,
            simulationCompletions: 0,
            simulationInProgress: 0,
            lastDataCollectionTime: 0,
            lastSignalAnalysisTime: 0,
            lastSimulationTime: 0
          });
        }

        const symbolStats = this.symbolStats.get(symbol);

        // 更新模拟交易统计
        symbolStats.simulationTriggers = totalSimulations;
        symbolStats.simulationCompletions = completedSimulations;
        symbolStats.simulationInProgress = totalSimulations - completedSimulations;

        console.log(`📊 同步 ${symbol}: 总模拟交易 ${totalSimulations}, 已完成 ${completedSimulations}`);
      }

      // 重新计算完成率
      this.calculateCompletionRates();

      console.log('✅ 模拟交易统计同步完成');
    } catch (error) {
      console.error('同步模拟交易统计失败:', error);
    }
  }

  // 从数据库获取最新的信号状态
  async getLatestSignalStatusFromDB(db, symbol) {
    try {
      // 获取最新的策略分析结果
      const analysis = await db.runQuery(`
        SELECT trend, signal, execution, execution_mode, timestamp
        FROM strategy_analysis 
        WHERE symbol = ? 
        ORDER BY timestamp DESC 
        LIMIT 1
      `, [symbol]);

      if (analysis.length > 0) {
        const latest = analysis[0];
        return {
          trend: latest.trend,
          signal: latest.signal,
          execution: latest.execution,
          executionMode: latest.execution_mode,
          lastUpdate: latest.timestamp
        };
      }
    } catch (error) {
      console.error(`获取 ${symbol} 信号状态失败:`, error);
    }

    return null;
  }

  checkHealthStatus() {
    const thresholds = this.alertThresholds;

    this.healthStatus = {
      dataCollection: this.completionRates.dataCollection >= thresholds.dataCollection ? 'HEALTHY' : 'WARNING',
      signalAnalysis: this.completionRates.signalAnalysis >= thresholds.signalAnalysis ? 'HEALTHY' : 'WARNING',
      simulationTrading: 'N/A' // 模拟交易不参与健康检查
    };

    // 只关注数据收集率和信号分析率，各占50%
    const overallRate = (this.completionRates.dataCollection + this.completionRates.signalAnalysis) / 2;
    this.healthStatus.overall = overallRate >= 99 ? 'HEALTHY' : 'WARNING';
  }

  async getMonitoringDashboard() {
    this.calculateCompletionRates();
    this.checkHealthStatus();

    // 优先从数据库同步模拟交易统计
    if (this.db) {
      try {
        await this.syncSimulationStatsFromDB(this.db);
      } catch (error) {
        console.error('同步模拟交易统计失败:', error);
      }
    }

    // 获取所有交易对，优先从数据库获取
    let allSymbols = [];

    if (this.db) {
      try {
        const dbSymbols = await this.db.getCustomSymbols();
        allSymbols = dbSymbols.filter(symbol => symbol && symbol.trim() !== '');
        console.log(`📊 从数据库获取到 ${allSymbols.length} 个交易对:`, allSymbols);
      } catch (error) {
        console.error('获取数据库交易对失败:', error);
      }
    }

    // 如果数据库没有交易对，则从统计中获取
    if (allSymbols.length === 0) {
      const statsSymbols = Array.from(this.symbolStats.keys()).filter(symbol => symbol && symbol.trim() !== '');
      allSymbols = statsSymbols;
      console.log(`📊 从统计中获取到 ${allSymbols.length} 个交易对:`, allSymbols);
    }

    // 计算实际的数据收集成功率
    let actualDataCollectionRate = 0;
    let actualSignalAnalysisRate = 0;
    let totalSymbols = allSymbols.length;
    let dataValidationErrors = [];
    let dataQualityIssues = [];

    if (totalSymbols > 0) {
      let successfulDataCollections = 0;
      let successfulSignalAnalyses = 0;

      // 使用V3策略验证系统
      for (const symbol of allSymbols) {
        const log = this.getAnalysisLog(symbol);
        const stats = this.symbolStats.get(symbol);

        // 使用V3策略验证系统
        const validationResult = await this.validationSystem.validateSymbol(symbol, log);

        // 记录验证结果到数据库
        await this.validationSystem.recordValidationResult(symbol, validationResult);

        // 收集验证错误（只收集真正的错误，不包括警告）
        if (validationResult.errors.length > 0) {
          dataValidationErrors.push(...validationResult.errors.map(error => `${symbol}: ${error}`));
        }

        // 收集数据质量问题（从数据库读取）
        if (this.database) {
          try {
            const issues = await this.database.all(`
              SELECT issue_type, message FROM data_quality_issues 
              WHERE symbol = ? AND created_at > datetime('now', '-1 hour')
              ORDER BY created_at DESC LIMIT 5
            `, [symbol]);
            issues.forEach(issue => {
              dataQualityIssues.push(`${symbol}: ${issue.issue_type} - ${issue.message}`);
            });
          } catch (error) {
            console.error('读取数据质量问题失败:', error);
          }
        }

        // 统计成功率 - 使用统计数据而不是分析日志
        if (stats) {
          // 数据收集成功率基于统计数据
          const dataCollectionRate = stats.dataCollectionAttempts > 0 ? 
            (stats.dataCollectionSuccesses / stats.dataCollectionAttempts) * 100 : 0;
          if (dataCollectionRate > 0) {
            successfulDataCollections++;
          }

          // 信号分析成功率基于统计数据
          const signalAnalysisRate = stats.signalAnalysisAttempts > 0 ? 
            (stats.signalAnalysisSuccesses / stats.signalAnalysisAttempts) * 100 : 0;
          if (signalAnalysisRate > 0) {
            successfulSignalAnalyses++;
          }
        }
      }

      actualDataCollectionRate = (successfulDataCollections / totalSymbols) * 100;
      actualSignalAnalysisRate = (successfulSignalAnalyses / totalSymbols) * 100;
    }

    const recentLogs = allSymbols.map(symbol => this.getAnalysisLog(symbol)).filter(log => log !== null);

    // 确保allSymbols不为空
    if (allSymbols.length === 0) {
      console.log('⚠️ 没有找到任何交易对，使用recentLogs中的交易对');
      allSymbols = recentLogs.map(log => log.symbol).filter(symbol => symbol && symbol.trim() !== '');
    }

    const detailedStats = await Promise.all(allSymbols.map(async symbol => {
      const stats = this.symbolStats.get(symbol);
      const log = this.getAnalysisLog(symbol);

      if (!stats) {
        return {
          symbol,
          dataCollection: { rate: 0, attempts: 0, successes: 0 },
          dataTypeCollection: {},
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

      // 计算各数据类型采集成功率
      const dataTypeCollection = {};
      if (stats.dataTypeStats) {
        for (const [dataType, dataTypeStats] of stats.dataTypeStats.entries()) {
          const rate = dataTypeStats.attempts > 0 ?
            (dataTypeStats.successes / dataTypeStats.attempts) * 100 : 0;

          dataTypeCollection[dataType] = {
            rate: rate,
            attempts: dataTypeStats.attempts,
            successes: dataTypeStats.successes,
            lastSuccessTime: dataTypeStats.lastSuccessTime,
            lastErrorTime: dataTypeStats.lastErrorTime,
            lastError: dataTypeStats.lastError,
            status: rate >= 95 ? 'HEALTHY' : rate >= 80 ? 'WARNING' : 'ERROR'
          };
        }
      }

      // 检查各阶段信号状态 - 优先使用数据库数据
      let hasExecution = false;
      let hasSignal = false;
      let hasTrend = false;
      let hourlyScore = 0;
      let executionMode = 'NONE';
      let modeA = false;
      let modeB = false;

      // 优先从数据库获取最新的信号状态
      let dbSignalStatus = null;
      if (this.db) {
        dbSignalStatus = await this.getLatestSignalStatusFromDB(this.db, symbol);
      }

      if (dbSignalStatus) {
        // 使用数据库中的信号状态
        hasExecution = dbSignalStatus.execution && dbSignalStatus.execution !== 'NO_EXECUTION' &&
          (dbSignalStatus.execution.includes('做多_') || dbSignalStatus.execution.includes('做空_'));
        hasSignal = dbSignalStatus.signal && dbSignalStatus.signal !== 'NO_SIGNAL' &&
          (dbSignalStatus.signal === 'LONG' || dbSignalStatus.signal === 'SHORT');
        hasTrend = dbSignalStatus.trend && dbSignalStatus.trend !== 'RANGE' &&
          (dbSignalStatus.trend === 'UPTREND' || dbSignalStatus.trend === 'DOWNTREND');
        executionMode = dbSignalStatus.executionMode || 'NONE';
      } else if (log) {
        // 回退到内存中的日志数据
        if (log.execution && log.execution !== 'NO_EXECUTION' && log.execution.includes('EXECUTE')) {
          hasExecution = true;
        }
        if (log.signal && log.signal !== 'NO_SIGNAL' && (log.signal === 'LONG' || log.signal === 'SHORT')) {
          hasSignal = true;
        }
        if (log.trend && log.trend !== 'RANGE' && (log.trend === 'UPTREND' || log.trend === 'DOWNTREND')) {
          hasTrend = true;
        }

        // 获取小时级多因子得分
        if (log.hourlyConfirmation && log.hourlyConfirmation.score !== undefined) {
          hourlyScore = log.hourlyConfirmation.score;
        }

        // 获取执行模式
        if (log.executionMode) {
          executionMode = log.executionMode;
        }

        // 获取模式A和模式B判断结果
        if (log.execution15m && log.execution15m.executionDetails) {
          modeA = log.execution15m.executionDetails.pullbackToEma20 || log.execution15m.executionDetails.pullbackToEma50 || false;
          modeB = log.execution15m.executionDetails.volumeExpansion >= 1.5 || false;
        }
      }

      const priorityScore = (hasExecution ? 1000 : 0) + (hasSignal ? 100 : 0) + (hasTrend ? 10 : 0);
      const signalActivityScore = (stats.signalAnalysisSuccesses * 10) + (stats.simulationTriggers * 5) + (stats.simulationInProgress * 3);
      // 只关注数据收集率和信号分析率，各占50%
      const overallRate = (dataCollectionRate + signalAnalysisRate) / 2;

      return {
        symbol,
        dataCollection: {
          rate: dataCollectionRate,
          attempts: stats.dataCollectionAttempts,
          successes: stats.dataCollectionSuccesses,
          lastTime: stats.lastDataCollectionTime
        },
        dataTypeCollection,
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
        hourlyScore,
        executionMode,
        modeA,
        modeB,
        priorityScore,
        signalActivityScore
      };
    }));

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

    // 计算错误状态统计（包含数据验证错误和数据质量问题）
    const totalErrors = dataValidationErrors.length + dataQualityIssues.length;
    const errorSymbols = detailedStats.filter(s => s.overall.status === 'ERROR').length;
    const warningSymbols = detailedStats.filter(s => s.overall.status === 'WARNING').length;
    const healthySymbols = detailedStats.filter(s => s.overall.status === 'HEALTHY').length;

    return {
      summary: {
        totalSymbols: allSymbols.length,
        healthySymbols: healthySymbols,
        warningSymbols: warningSymbols,
        errorSymbols: errorSymbols + (totalErrors > 0 ? 1 : 0), // 如果有验证错误，至少有一个错误状态
        totalErrors: totalErrors, // 添加总错误数
        overallHealth: totalErrors > 0 ? 'ERROR' : (errorSymbols > 0 ? 'WARNING' : 'HEALTHY'),
        completionRates: {
          dataCollection: this.completionRates.dataCollection,
          signalAnalysis: this.completionRates.signalAnalysis,
          simulationTrading: this.completionRates.simulationTrading
        },
        // 保留原始统计数据用于调试
        rawCompletionRates: this.completionRates,
        // 数据验证信息
        dataValidation: {
          errors: dataValidationErrors,
          errorCount: dataValidationErrors.length,
          hasErrors: dataValidationErrors.length > 0
        },
        // 数据质量问题
        dataQuality: {
          issues: dataQualityIssues,
          issueCount: dataQualityIssues.length,
          hasIssues: dataQualityIssues.length > 0
        }
      },
      detailedStats,
      recentLogs: recentLogs.slice(0, 10),
      thresholds: this.alertThresholds,
      lastUpdated: new Date().toISOString()
    };

    // 记录告警到数据库
    await this.checkAndRecordDataValidationErrors(dataValidationErrors);
    await this.checkAndRecordDataQualityIssues(dataQualityIssues);
  }

  // 启动定期内存清理
  startMemoryCleanup() {
    // 每5分钟清理一次内存
    setInterval(() => {
      this.clearOldLogs();
    }, 5 * 60 * 1000);
  }

  // 限制交易对数量
  limitSymbolCount() {
    if (this.symbolStats.size > this.maxSymbols) {
      // 按时间排序，删除最旧的交易对
      const sortedStats = Array.from(this.symbolStats.entries())
        .sort((a, b) => (a[1].lastDataCollectionTime || 0) - (b[1].lastDataCollectionTime || 0));

      const toDelete = sortedStats.slice(0, this.symbolStats.size - this.maxSymbols);
      toDelete.forEach(([symbol]) => {
        this.symbolStats.delete(symbol);
        this.lastRefreshTime.delete(symbol);
        this.lastAlertTime.delete(symbol);
      });

      console.log(`🧹 限制交易对数量，删除了 ${toDelete.length} 个旧交易对`);
    }
  }

  async clearOldLogs() {
    const cutoffTime = Date.now() - (2 * 60 * 60 * 1000); // 2小时前，更频繁清理

    // 清理数据库中的过期分析日志
    if (this.database) {
      try {
        await this.database.run(`
          DELETE FROM analysis_logs 
          WHERE start_time < datetime('now', '-2 hours')
        `);
      } catch (error) {
        console.error('清理过期分析日志失败:', error);
      }
    }

    // 清理数据库中的过期数据质量问题
    if (this.database) {
      try {
        await this.database.run(`
          DELETE FROM data_quality_issues 
          WHERE created_at < datetime('now', '-1 hour')
        `);
      } catch (error) {
        console.error('清理过期数据质量问题失败:', error);
      }
    }

    // 清理过期的刷新时间记录
    for (const [symbol, time] of this.lastRefreshTime.entries()) {
      if (time < cutoffTime) {
        this.lastRefreshTime.delete(symbol);
      }
    }

    // 清理过期的告警时间记录
    for (const [symbol, time] of this.lastAlertTime.entries()) {
      if (time < cutoffTime) {
        this.lastAlertTime.delete(symbol);
      }
    }

    // 限制交易对数量
    this.limitSymbolCount();

    console.log(`🧹 内存清理完成 - 刷新时间: ${this.lastRefreshTime.size}, 告警时间: ${this.lastAlertTime.size}`);
  }

  setAlertThresholds(thresholds) {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
    this.checkHealthStatus();
  }

  async checkAndSendAlerts(telegramNotifier) {
    if (!telegramNotifier || !telegramNotifier.enabled) return;

    const dashboard = await this.getMonitoringDashboard();
    const { detailedStats, summary } = dashboard;

    // 检查整体系统告警 - 使用实际计算的数据收集率
    const dataCollectionRate = summary.completionRates.dataCollection;
    const signalAnalysisRate = summary.completionRates.signalAnalysis;
    const dataValidation = summary.dataValidation;
    const dataQuality = summary.dataQuality;

    // 检查是否需要发送告警
    const needsAlert = dataCollectionRate < this.alertThresholds.dataCollection ||
      signalAnalysisRate < this.alertThresholds.signalAnalysis ||
      dataValidation.hasErrors ||
      dataQuality.hasIssues;

    if (needsAlert) {
      // 检查冷却时间，避免重复告警
      const now = Date.now();
      const lastAlert = this.lastAlertTime.get('system') || 0;

      if (now - lastAlert < this.alertCooldown) {
        console.log('⏰ 系统告警在冷却期内，跳过发送');
        return;
      }

      // 更新告警时间
      this.lastAlertTime.set('system', now);
      let alertMessage = `🚨 <b>SmartFlow 系统告警</b>\n\n` +
        `📊 <b>系统概览：</b>\n` +
        `• 总交易对: ${summary.totalSymbols}\n` +
        `• 健康状态: ${summary.healthySymbols}\n` +
        `• 警告状态: ${summary.warningSymbols}\n\n` +
        `⚠️ <b>告警详情：</b>\n` +
        `• 数据收集率: ${dataCollectionRate.toFixed(1)}% ${dataCollectionRate < 99 ? '❌' : '✅'}\n` +
        `• 信号分析率: ${signalAnalysisRate.toFixed(1)}% ${signalAnalysisRate < 99 ? '❌' : '✅'}\n` +
        `• 数据验证: ${dataValidation.hasErrors ? '❌ 异常' : '✅ 正常'} (${dataValidation.errorCount}个错误)\n` +
        `• 数据质量: ${dataQuality.hasIssues ? '❌ 异常' : '✅ 正常'} (${dataQuality.issueCount}个问题)\n\n`;

      // 添加数据验证错误详情
      if (dataValidation.hasErrors) {
        alertMessage += `🔍 <b>数据验证错误：</b>\n`;
        dataValidation.errors.slice(0, 5).forEach(error => {
          alertMessage += `• ${error}\n`;
        });
        if (dataValidation.errors.length > 5) {
          alertMessage += `• ... 还有${dataValidation.errors.length - 5}个错误\n`;
        }
        alertMessage += `\n`;
      }

      // 添加数据质量问题详情
      if (dataQuality.hasIssues) {
        alertMessage += `⚠️ <b>数据质量问题：</b>\n`;
        dataQuality.issues.slice(0, 5).forEach(issue => {
          alertMessage += `• ${issue}\n`;
        });
        if (dataQuality.issues.length > 5) {
          alertMessage += `• ... 还有${dataQuality.issues.length - 5}个问题\n`;
        }
        alertMessage += `\n`;
      }

      alertMessage += `🌐 <b>网页链接：</b>https://smart.aimaventop.com\n` +
        `⏰ <b>告警时间：</b>${new Date().toLocaleString('zh-CN')}`;

      await telegramNotifier.sendMessage(alertMessage);
    }

    // 检查单个交易对告警
    for (const symbol of detailedStats) {
      const { dataCollection, signalAnalysis } = symbol;
      let hasAlert = false;
      let alertDetails = [];

      // 检查数据收集告警
      if (dataCollection.rate < this.alertThresholds.dataCollection) {
        hasAlert = true;
        alertDetails.push(`数据收集率: ${dataCollection.rate.toFixed(1)}% (成功: ${dataCollection.successes}/${dataCollection.attempts})`);
      }

      // 检查信号判断告警
      if (signalAnalysis.rate < this.alertThresholds.signalAnalysis) {
        hasAlert = true;
        alertDetails.push(`信号分析率: ${signalAnalysis.rate.toFixed(1)}% (成功: ${signalAnalysis.successes}/${signalAnalysis.attempts})`);
      }

      // 发送单个交易对告警
      if (hasAlert) {
        // 检查单个交易对告警冷却时间
        const now = Date.now();
        const lastSymbolAlert = this.lastAlertTime.get(symbol.symbol) || 0;

        if (now - lastSymbolAlert < this.alertCooldown) {
          console.log(`⏰ ${symbol.symbol} 交易对告警在冷却期内，跳过发送`);
          continue;
        }

        // 更新告警时间
        this.lastAlertTime.set(symbol.symbol, now);

        const symbolAlertMessage = `⚠️ <b>${symbol.symbol} 交易对告警</b>\n\n` +
          `📊 <b>告警详情：</b>\n` +
          alertDetails.map(detail => `• ${detail}`).join('\n') + '\n\n' +
          `🔄 <b>刷新频率：</b>${symbol.refreshFrequency}秒\n` +
          `⏰ <b>最后更新：</b>${new Date(symbol.dataCollection.lastTime || Date.now()).toLocaleString('zh-CN')}\n\n` +
          `🌐 <b>网页链接：</b>https://smart.aimaventop.com`;

        await telegramNotifier.sendMessage(symbolAlertMessage);
      }
    }
  }

  // 记录告警到数据库
  async recordAlert(symbol, alertType, severity, message, details = null) {
    if (!this.database) {
      console.warn('数据库未初始化，无法记录告警');
      return;
    }

    try {
      await this.database.recordAlert(symbol, alertType, severity, message, details);
      console.log(`📝 告警已记录: ${symbol} - ${alertType} - ${severity}`);
    } catch (error) {
      console.error('记录告警失败:', error);
    }
  }

  // 检查并记录数据验证错误
  async checkAndRecordDataValidationErrors(dataValidationErrors) {
    if (dataValidationErrors && dataValidationErrors.length > 0) {
      // 去重：只记录新的错误
      const now = Date.now();
      const lastRecordTime = this.lastValidationErrorRecordTime || 0;
      const recordInterval = 5 * 60 * 1000; // 5分钟内不重复记录相同错误

      if (now - lastRecordTime > recordInterval) {
        for (const error of dataValidationErrors) {
          const [symbol, errorMessage] = error.split(': ');
          await this.recordAlert(
            symbol,
            'data-validation',
            'high',
            errorMessage,
            '数据验证失败'
          );
        }
        this.lastValidationErrorRecordTime = now;
      }
    }
  }

  // 检查并记录数据质量问题
  async checkAndRecordDataQualityIssues(dataQualityIssues) {
    if (dataQualityIssues && dataQualityIssues.length > 0) {
      // 去重：只记录新的问题
      const now = Date.now();
      const lastRecordTime = this.lastQualityIssueRecordTime || 0;
      const recordInterval = 5 * 60 * 1000; // 5分钟内不重复记录相同问题

      if (now - lastRecordTime > recordInterval) {
        for (const issue of dataQualityIssues) {
          const [symbol, issueMessage] = issue.split(': ');
          await this.recordAlert(
            symbol,
            'data-quality',
            'medium',
            issueMessage,
            '数据质量问题'
          );
        }
        this.lastQualityIssueRecordTime = now;
      }
    }
  }
}

module.exports = { DataMonitor };
