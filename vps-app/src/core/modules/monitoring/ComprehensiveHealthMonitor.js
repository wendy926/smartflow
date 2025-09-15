// ComprehensiveHealthMonitor.js - 综合健康监控模块
// 整合所有check_X.js的核心逻辑

const StrategyV3Core = require('../strategy/trend-trading/StrategyV3Core');
const SmartFlowStrategyV3 = require('../strategy/trend-trading/SmartFlowStrategyV3');
const BinanceAPI = require('../api/BinanceAPI');
const { MemoryMonitor } = require('./MemoryMonitor');
const DataRefreshManager = require('../data/DataRefreshManager');
const TelegramNotifier = require('../notification/TelegramNotifier');
const os = require('os');

class ComprehensiveHealthMonitor {
  constructor(database = null) {
    this.database = database;
    this.qualityMonitor = null;
    this.memoryMonitor = new MemoryMonitor();
    this.dataRefreshManager = new DataRefreshManager(database);
    this.telegramNotifier = new TelegramNotifier();
    this.lastCheckTime = new Map();
    this.checkInterval = 5 * 60 * 1000; // 5分钟检查间隔
    this.memoryThreshold = 0.8; // 80%内存使用率阈值
    this.freshnessCheckInterval = 10 * 60 * 1000; // 10分钟新鲜度检查间隔
  }

  async init() {
    if (this.database) {
      const EnhancedDataQualityMonitor = require('./EnhancedDataQualityMonitor');
      this.qualityMonitor = new EnhancedDataQualityMonitor(this.database);
      
      // 初始化Telegram通知器
      try {
        const botToken = await this.database.getUserSetting('telegramBotToken', '');
        const chatId = await this.database.getUserSetting('telegramChatId', '');
        if (botToken && chatId) {
          this.telegramNotifier.init(botToken, chatId);
          console.log('✅ 新鲜度告警Telegram通知已启用');
        } else {
          console.warn('⚠️ Telegram通知未配置，新鲜度告警将不会发送');
        }
      } catch (error) {
        console.error('初始化Telegram通知失败:', error);
      }
    }
  }

  /**
   * 综合健康检查 - 整合check-data-quality.js逻辑
   */
  async performComprehensiveHealthCheck(symbols = null) {
    if (!symbols) {
      symbols = [
        'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT', 'SOLUSDT',
        'DOGEUSDT', 'TRXUSDT', 'MATICUSDT', 'DOTUSDT', 'AVAXUSDT', 'LINKUSDT'
      ];
    }

    console.log('🚀 开始综合健康检查...\n');

    const results = {
      total: 0,
      healthy: 0,
      warnings: 0,
      errors: 0,
      issues: [],
      symbolDetails: {},
      monitoringDiagnosis: null,
      dataConsistency: null
    };

    // 1. 执行监控中心问题诊断
    console.log('🔍 执行监控中心问题诊断...');
    results.monitoringDiagnosis = await this.diagnoseMonitoringIssues();

    if (!results.monitoringDiagnosis.success || results.monitoringDiagnosis.issues.length > 0) {
      results.errors++;
      results.issues.push('监控中心诊断发现问题: ' + results.monitoringDiagnosis.issues.join(', '));
    }

    // 2. 执行数据一致性清理（可选）
    if (process.env.ENABLE_DATA_CLEANUP === 'true') {
      console.log('🔧 执行数据一致性清理...');
      const consistencyStats = await this.performDataConsistencyCleanup();
      results.dataConsistency = {
        success: true,
        stats: consistencyStats
      };
    }

    // 3. 检查各个交易对
    for (const symbol of symbols) {
      console.log(`\n🔍 检查 ${symbol}...`);

      const symbolResult = await this.checkSymbolHealth(symbol);
      results.symbolDetails[symbol] = symbolResult;
      results.total++;

      if (symbolResult.status === 'HEALTHY') {
        results.healthy++;
        console.log(`✅ ${symbol}: 健康状态正常`);
      } else if (symbolResult.status === 'WARNING') {
        results.warnings++;
        console.log(`⚠️ ${symbol}: 存在警告`);
        results.issues.push(`${symbol}: ${symbolResult.issues.join(', ')}`);
      } else {
        results.errors++;
        console.log(`❌ ${symbol}: 存在错误`);
        results.issues.push(`${symbol}: ${symbolResult.issues.join(', ')}`);
      }
    }

    return results;
  }

  /**
   * 单个交易对健康检查
   */
  async checkSymbolHealth(symbol) {
    const result = {
      symbol,
      status: 'HEALTHY',
      issues: [],
      indicators: {},
      dataQuality: {}
    };

    try {
      // 1. 数据质量检查
      if (this.qualityMonitor) {
        const qualityCheck = await this.qualityMonitor.performComprehensiveCheck(symbol);
        result.dataQuality = qualityCheck;

        if (qualityCheck && qualityCheck.overallStatus !== 'HEALTHY') {
          result.status = qualityCheck.overallStatus;
          result.issues.push(`数据质量: ${qualityCheck.overallStatus}`);
        }
      }

      // 2. 指标有效性检查
      const indicatorCheck = await this.checkIndicatorValidity(symbol);
      result.indicators = indicatorCheck;

      if (indicatorCheck.hasIssues) {
        if (result.status === 'HEALTHY') result.status = 'WARNING';
        result.issues.push(`指标问题: ${indicatorCheck.issues.join(', ')}`);
      }

      // 3. MA计算质量检查
      const maCheck = await this.checkMACalculationQuality(symbol);
      if (maCheck.hasIssues) {
        if (result.status === 'HEALTHY') result.status = 'WARNING';
        result.issues.push(`MA计算: ${maCheck.issues.join(', ')}`);
      }

      // 4. 内存健康检查（每个交易对检查一次）
      const memoryCheck = await this.checkMemoryHealth();
      result.memoryHealth = memoryCheck;

      if (memoryCheck.status !== 'HEALTHY') {
        if (result.status === 'HEALTHY') result.status = 'WARNING';
        result.issues.push(`内存: ${memoryCheck.issues.join(', ')}`);
      }

    } catch (error) {
      result.status = 'ERROR';
      result.issues.push(`检查失败: ${error.message}`);
    }

    return result;
  }

  /**
   * 指标有效性检查 - 整合check-all-indicators.js逻辑
   */
  async checkIndicatorValidity(symbol) {
    const result = {
      hasIssues: false,
      issues: [],
      indicators: {}
    };

    try {
      const strategyCore = new StrategyV3Core(this.database);

      // 检查4H趋势分析
      const trendResult = await strategyCore.analyze4HTrend(symbol);
      result.indicators.trend = trendResult;

      if (trendResult && !trendResult.error) {
        // 检查关键指标是否有效
        const indicators = ['ma20', 'ma50', 'ma200', 'ema20', 'ema50', 'adx14', 'bbw'];

        for (const indicator of indicators) {
          const value = trendResult[indicator];
          if (value === null || value === undefined || isNaN(value)) {
            result.hasIssues = true;
            result.issues.push(`${indicator}无效`);
          } else {
            result.indicators[indicator] = value;
          }
        }

        // 检查趋势判断逻辑
        if (!trendResult.trend4h || trendResult.trend4h === '--') {
          result.hasIssues = true;
          result.issues.push('趋势判断缺失');
        }

      } else {
        result.hasIssues = true;
        result.issues.push(`趋势分析失败: ${trendResult?.error || '未知错误'}`);
      }

      await strategyCore.destroy();

    } catch (error) {
      result.hasIssues = true;
      result.issues.push(`指标检查失败: ${error.message}`);
    }

    return result;
  }

  /**
   * MA计算质量检查 - 整合check-all-symbols-ma.js逻辑
   */
  async checkMACalculationQuality(symbol) {
    const result = {
      hasIssues: false,
      issues: [],
      maResults: {}
    };

    try {
      const strategyCore = new StrategyV3Core(this.database);

      // 获取4H数据
      const klines4h = await strategyCore.getKlineData(symbol, '4h', 250);

      if (!klines4h || klines4h.length === 0) {
        result.hasIssues = true;
        result.issues.push('无K线数据');
        return result;
      }

      // 数据质量验证
      const invalidData = klines4h.filter(k => {
        if (!k || !Array.isArray(k) || k.length < 6) return true;
        const close = parseFloat(k[4]);
        const volume = parseFloat(k[5]);
        return isNaN(close) || close <= 0 || isNaN(volume) || volume < 0;
      });

      const validData = klines4h.length - invalidData.length;

      if (validData < 20) {
        result.hasIssues = true;
        result.issues.push('有效数据不足');
        return result;
      }

      // 计算MA并检查结果
      const ma20 = strategyCore.calculateMA(klines4h, 20);
      const ma50 = strategyCore.calculateMA(klines4h, 50);
      const ma200 = strategyCore.calculateMA(klines4h, 200);

      result.maResults = { ma20, ma50, ma200 };

      // 检查MA结果
      const ma20NaN = ma20.some(val => isNaN(val));
      const ma50NaN = ma50.some(val => isNaN(val));
      const ma200NaN = ma200.some(val => isNaN(val));

      if (ma20NaN || ma50NaN || ma200NaN) {
        result.hasIssues = true;
        result.issues.push('MA计算包含NaN值');
      }

      if (ma20.length === 0 || ma50.length === 0 || ma200.length === 0) {
        result.hasIssues = true;
        result.issues.push('MA计算结果为空');
      }

      await strategyCore.destroy();

    } catch (error) {
      result.hasIssues = true;
      result.issues.push(`MA检查失败: ${error.message}`);
    }

    return result;
  }

  /**
   * K线数据时间戳检查 - 整合check-kline-timestamps.js逻辑
   */
  async checkKlineTimestampFreshness(symbol) {
    const result = {
      isFresh: true,
      ageHours: 0,
      issues: []
    };

    try {
      if (!this.database) {
        result.issues.push('数据库未初始化');
        return result;
      }

      const sql = `
        SELECT MAX(close_time) as latest_close_time
        FROM kline_data 
        WHERE symbol = ? AND interval = '4h'
      `;

      const results = await this.database.runQuery(sql, [symbol]);
      const row = results.length > 0 ? results[0] : null;

      if (!row || !row.latest_close_time) {
        result.isFresh = false;
        result.issues.push('无4H K线数据');
        return result;
      }

      const ageMs = Date.now() - row.latest_close_time;
      const ageHours = ageMs / (1000 * 60 * 60);
      result.ageHours = ageHours;

      if (ageHours > 8) {
        result.isFresh = false;
        result.issues.push('4H K线数据过期');
      } else if (ageHours > 4) {
        result.issues.push('4H K线数据正在老化');
      }

    } catch (error) {
      result.isFresh = false;
      result.issues.push(`时间戳检查失败: ${error.message}`);
    }

    return result;
  }

  /**
   * 交易对可访问性检查 - 整合check-symbol-accessibility.js逻辑
   */
  async checkSymbolAccessibility(symbol) {
    const result = {
      isAccessible: false,
      issues: []
    };

    try {
      const klines = await BinanceAPI.getKlines(symbol, '4h', 5);

      if (!klines || klines.length === 0) {
        result.issues.push('无法获取K线数据');
        return result;
      }

      result.isAccessible = true;

    } catch (error) {
      result.issues.push(error.message);
    }

    return result;
  }

  /**
   * 内存健康检查 - 整合memory-monitor.js逻辑
   */
  async checkMemoryHealth() {
    const result = {
      status: 'HEALTHY',
      issues: [],
      memoryInfo: {},
      processInfo: {}
    };

    try {
      // 获取系统内存信息
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const usagePercent = usedMem / totalMem;

      result.memoryInfo = {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        usagePercent: Math.round(usagePercent * 100)
      };

      // 获取进程内存信息
      const processMem = process.memoryUsage();
      result.processInfo = {
        rss: processMem.rss,
        heapTotal: processMem.heapTotal,
        heapUsed: processMem.heapUsed,
        external: processMem.external,
        arrayBuffers: processMem.arrayBuffers
      };

      // 检查内存使用率
      if (usagePercent > this.memoryThreshold) {
        result.status = 'ERROR';
        result.issues.push(`系统内存使用率过高: ${Math.round(usagePercent * 100)}%`);
      } else if (usagePercent > 0.7) {
        result.status = 'WARNING';
        result.issues.push(`系统内存使用率较高: ${Math.round(usagePercent * 100)}%`);
      }

      // 检查进程内存使用
      const heapUsagePercent = processMem.heapUsed / processMem.heapTotal;
      if (heapUsagePercent > 0.9) {
        if (result.status === 'HEALTHY') result.status = 'WARNING';
        result.issues.push(`进程堆内存使用率过高: ${Math.round(heapUsagePercent * 100)}%`);
      }

    } catch (error) {
      result.status = 'ERROR';
      result.issues.push(`内存检查失败: ${error.message}`);
    }

    return result;
  }

  /**
   * 检查数据新鲜度并发送告警
   */
  async checkDataFreshnessAndAlert() {
    try {
      console.log('🔍 检查数据新鲜度告警...');
      const alerts = await this.dataRefreshManager.checkFreshnessAndAlert(this.telegramNotifier);
      
      if (alerts.length > 0) {
        console.log(`⚠️ 发现 ${alerts.length} 个新鲜度告警`);
        alerts.forEach(alert => {
          console.log(`  - ${alert.dataType} (${alert.symbol}): ${alert.freshness.toFixed(1)}% [${alert.severity}]`);
        });
      } else {
        console.log('✅ 数据新鲜度正常');
      }
      
      return {
        success: true,
        alertCount: alerts.length,
        alerts: alerts
      };
    } catch (error) {
      console.error('检查数据新鲜度告警失败:', error);
      return {
        success: false,
        error: error.message,
        alertCount: 0,
        alerts: []
      };
    }
  }

  /**
   * 获取数据新鲜度告警状态
   */
  async getDataFreshnessAlertStatus() {
    try {
      const status = await this.dataRefreshManager.getFreshnessAlertStatus();
      return {
        success: true,
        status: status
      };
    } catch (error) {
      console.error('获取数据新鲜度告警状态失败:', error);
      return {
        success: false,
        error: error.message,
        status: { total: 0, critical: 0, warning: 0, info: 0, normal: 0, byDataType: {} }
      };
    }
  }

  /**
   * 启动定期新鲜度检查
   */
  startPeriodicFreshnessCheck() {
    if (this.freshnessCheckTimer) {
      clearInterval(this.freshnessCheckTimer);
    }
    
    this.freshnessCheckTimer = setInterval(async () => {
      try {
        await this.checkDataFreshnessAndAlert();
      } catch (error) {
        console.error('定期新鲜度检查失败:', error);
      }
    }, this.freshnessCheckInterval);
    
    console.log(`✅ 已启动定期新鲜度检查，间隔: ${this.freshnessCheckInterval / 1000 / 60}分钟`);
  }

  /**
   * 停止定期新鲜度检查
   */
  stopPeriodicFreshnessCheck() {
    if (this.freshnessCheckTimer) {
      clearInterval(this.freshnessCheckTimer);
      this.freshnessCheckTimer = null;
      console.log('✅ 已停止定期新鲜度检查');
    }
  }

  /**
   * 数据清理优化 - 整合所有清理脚本逻辑
   */
  async performMemoryOptimization() {
    const result = {
      success: false,
      operations: [],
      errors: [],
      cleanupStats: {}
    };

    try {
      if (!this.database) {
        result.errors.push('数据库未初始化');
        return result;
      }

      console.log('🔧 开始综合数据清理优化...');

      // 1. 清理过期的策略分析数据（保留最近7天）
      const strategyCleanup = await this.database.runQuery(
        "DELETE FROM strategy_analysis WHERE timestamp < datetime('now', '-7 days')"
      );
      result.operations.push('清理过期策略分析数据');

      // 2. 清理过期的模拟交易数据（保留最近30天）
      const simulationCleanup = await this.database.runQuery(
        "DELETE FROM simulations WHERE created_at < datetime('now', '-30 days')"
      );
      result.operations.push('清理过期模拟交易数据');

      // 3. 清理过期的告警历史（保留最近14天）
      const alertCleanup = await this.database.runQuery(
        "DELETE FROM alert_history WHERE timestamp < datetime('now', '-14 days')"
      );
      result.operations.push('清理过期告警历史');

      // 4. 清理过期的K线数据（保留最近90天）
      const klineCleanup = await this.database.runQuery(
        "DELETE FROM kline_data WHERE open_time < (strftime('%s', 'now', '-90 days') * 1000)"
      );
      result.operations.push('清理过期K线数据');

      // 5. 清理过期的数据质量日志（保留最近7天）
      const qualityCleanup = await this.database.runQuery(
        "DELETE FROM data_quality_issues WHERE timestamp < datetime('now', '-7 days')"
      );
      result.operations.push('清理过期数据质量日志');

      // 6. 数据一致性清理
      const consistencyResult = await this.performDataConsistencyCleanup();
      result.cleanupStats = consistencyResult;

      result.success = true;
      console.log('✅ 综合数据清理优化完成');

    } catch (error) {
      result.errors.push(`数据清理失败: ${error.message}`);
      console.error('❌ 数据清理失败:', error);
    }

    return result;
  }

  /**
   * 数据一致性清理 - 整合所有清理脚本逻辑
   */
  async performDataConsistencyCleanup() {
    const stats = {
      signalNoneCleaned: 0,
      duplicatesCleaned: 0,
      trendReversalCleaned: 0,
      trendReversalRangeCleaned: 0,
      missingKlineDataCollected: 0
    };

    try {
      console.log('🔍 开始数据一致性清理...');

      // 1. 清理SIGNAL_NONE记录（不应该存在的记录）
      const signalNoneCount = await this.database.runQuery(
        "SELECT COUNT(*) as count FROM simulations WHERE trigger_reason = 'SIGNAL_NONE'"
      );

      if (signalNoneCount[0].count > 0) {
        await this.database.runQuery(
          "DELETE FROM simulations WHERE trigger_reason = 'SIGNAL_NONE'"
        );
        stats.signalNoneCleaned = signalNoneCount[0].count;
        console.log(`✅ 清理了 ${stats.signalNoneCleaned} 条SIGNAL_NONE记录`);
      }

      // 2. 清理重复的模拟交易记录
      const duplicateResult = await this.cleanupDuplicateSimulations();
      stats.duplicatesCleaned = duplicateResult;

      // 3. 清理有问题的趋势反转记录
      const trendReversalResult = await this.cleanupProblematicTrendReversal();
      stats.trendReversalCleaned = trendReversalResult;

      // 4. 收集缺失的K线数据
      const missingKlineResult = await this.collectMissingKlineData();
      stats.missingKlineDataCollected = missingKlineResult;

      console.log('✅ 数据一致性清理完成');

    } catch (error) {
      console.error('❌ 数据一致性清理失败:', error);
    }

    return stats;
  }

  /**
   * 清理重复的模拟交易记录
   */
  async cleanupDuplicateSimulations() {
    try {
      const simulations = await this.database.runQuery(
        'SELECT * FROM simulations ORDER BY created_at DESC'
      );

      const duplicates = [];
      const seen = new Map();

      for (const sim of simulations) {
        const timeKey = sim.created_at.substring(0, 16); // 精确到分钟
        const key = `${sim.symbol}_${sim.direction}_${timeKey}`;

        if (seen.has(key)) {
          const existing = seen.get(key);
          if (sim.id > existing.id) {
            duplicates.push(sim);
          } else {
            duplicates.push(existing);
            seen.set(key, sim);
          }
        } else {
          seen.set(key, sim);
        }
      }

      if (duplicates.length > 0) {
        for (const dup of duplicates) {
          await this.database.runQuery('DELETE FROM simulations WHERE id = ?', [dup.id]);
        }
        console.log(`✅ 清理了 ${duplicates.length} 个重复的模拟交易记录`);
      }

      return duplicates.length;

    } catch (error) {
      console.error('❌ 清理重复记录失败:', error);
      return 0;
    }
  }

  /**
   * 清理有问题的趋势反转记录
   */
  async cleanupProblematicTrendReversal() {
    try {
      // 清理TREND_REVERSAL + 区间信号的记录
      const problematicRecords = await this.database.runQuery(`
        SELECT id FROM simulations 
        WHERE exit_reason = 'TREND_REVERSAL' 
        AND (trigger_reason LIKE '%区间%' OR execution_mode_v3 LIKE '区间%')
      `);

      if (problematicRecords.length > 0) {
        for (const record of problematicRecords) {
          await this.database.runQuery('DELETE FROM simulations WHERE id = ?', [record.id]);
        }
        console.log(`✅ 清理了 ${problematicRecords.length} 条有问题的趋势反转记录`);
      }

      return problematicRecords.length;

    } catch (error) {
      console.error('❌ 清理趋势反转记录失败:', error);
      return 0;
    }
  }

  /**
   * 收集缺失的K线数据
   */
  async collectMissingKlineData() {
    try {
      const apiSymbols = [
        'AAVEUSDT', 'ADAUSDT', 'AVAXUSDT', 'BNBUSDT', 'BTCUSDT', 'DOGEUSDT',
        'ENAUSDT', 'ETHUSDT', 'FETUSDT', 'HYPEUSDT', 'LDOUSDT', 'LINEAUSDT',
        'LINKUSDT', 'ONDOUSDT', 'PUMPUSDT', 'SOLUSDT', 'SUIUSDT', 'TAOUSDT',
        'TRXUSDT', 'XLMUSDT', 'XRPUSDT'
      ];

      const missingSymbols = [];

      for (const symbol of apiSymbols) {
        const count = await this.database.runQuery(
          'SELECT COUNT(*) as count FROM kline_data WHERE symbol = ? AND interval = ?',
          [symbol, '4h']
        );

        if (count[0].count < 200) {
          missingSymbols.push(symbol);
        }
      }

      if (missingSymbols.length > 0) {
        console.log(`📊 发现 ${missingSymbols.length} 个交易对K线数据不足，需要收集`);
        // 这里可以调用API收集数据，但由于API限制，建议在低峰期执行
        return missingSymbols.length;
      }

      return 0;

    } catch (error) {
      console.error('❌ 检查缺失K线数据失败:', error);
      return 0;
    }
  }

  /**
   * 诊断监控中心问题 - 整合diagnose-monitoring-issue.js逻辑
   */
  async diagnoseMonitoringIssues() {
    const diagnosis = {
      success: false,
      issues: [],
      recommendations: [],
      stats: {}
    };

    try {
      if (!this.database) {
        diagnosis.issues.push('数据库未初始化');
        return diagnosis;
      }

      console.log('🔍 开始诊断监控中心问题...');

      // 1. 检查数据库连接
      diagnosis.stats.databaseConnected = true;

      // 2. 检查交易对数据
      const symbols = await this.database.getCustomSymbols();
      diagnosis.stats.totalSymbols = symbols.length;

      // 3. 检查K线数据状态
      const klineIssues = [];
      for (const symbol of symbols.slice(0, 3)) {
        try {
          const klines = await this.database.runQuery(
            'SELECT COUNT(*) as count FROM kline_data WHERE symbol = ? AND interval = ?',
            [symbol, '4h']
          );
          if (klines[0].count < 50) {
            klineIssues.push(`${symbol}: K线数据不足 (${klines[0].count}/50)`);
          }
        } catch (error) {
          klineIssues.push(`${symbol}: K线数据检查失败 - ${error.message}`);
        }
      }

      if (klineIssues.length > 0) {
        diagnosis.issues.push('K线数据问题: ' + klineIssues.join(', '));
        diagnosis.recommendations.push('收集缺失的K线数据');
      }

      // 4. 检查策略分析表状态
      const analysisCount = await this.database.runQuery('SELECT COUNT(*) as count FROM strategy_v3_analysis');
      const latestAnalysis = await this.database.runQuery('SELECT MAX(created_at) as latest FROM strategy_v3_analysis');

      diagnosis.stats.analysisRecords = analysisCount[0].count;
      diagnosis.stats.latestAnalysis = latestAnalysis[0].latest;

      if (analysisCount[0].count === 0) {
        diagnosis.issues.push('策略分析表为空 - 策略分析功能未运行');
        diagnosis.recommendations.push('重启策略分析功能');
      }

      // 5. 检查监控统计表状态
      const statsCount = await this.database.runQuery('SELECT COUNT(*) as count FROM monitoring_stats');
      const latestStats = await this.database.runQuery('SELECT MAX(updated_at) as latest FROM monitoring_stats');

      diagnosis.stats.monitoringRecords = statsCount[0].count;
      diagnosis.stats.latestMonitoring = latestStats[0].latest;

      if (latestStats[0].latest) {
        const now = new Date();
        const latestTime = new Date(latestStats[0].latest);
        const daysDiff = Math.floor((now - latestTime) / (1000 * 60 * 60 * 24));

        if (daysDiff > 1) {
          diagnosis.issues.push(`监控数据过期 ${daysDiff} 天`);
          diagnosis.recommendations.push('更新监控统计数据');
        }
      }

      // 6. 检查数据质量问题
      const qualityIssues = await this.database.runQuery(
        'SELECT COUNT(*) as count FROM data_quality_issues WHERE created_at > datetime("now", "-1 day")'
      );
      diagnosis.stats.recentQualityIssues = qualityIssues[0].count;

      if (qualityIssues[0].count > 0) {
        diagnosis.issues.push(`最近24小时有 ${qualityIssues[0].count} 个数据质量问题`);
        diagnosis.recommendations.push('检查数据质量问题并修复');
      }

      // 7. 检查模拟交易数据
      const simulationCount = await this.database.runQuery('SELECT COUNT(*) as count FROM simulations');
      const activeSimulations = await this.database.runQuery(
        'SELECT COUNT(*) as count FROM simulations WHERE status = "ACTIVE"'
      );

      diagnosis.stats.totalSimulations = simulationCount[0].count;
      diagnosis.stats.activeSimulations = activeSimulations[0].count;

      // 8. 检查胜率统计
      const winRateStats = await this.database.runQuery('SELECT * FROM win_rate_stats LIMIT 1');
      if (winRateStats.length > 0) {
        diagnosis.stats.winRateStats = winRateStats[0];
      }

      diagnosis.success = true;
      console.log('✅ 监控中心问题诊断完成');

    } catch (error) {
      diagnosis.issues.push(`诊断过程中出现错误: ${error.message}`);
      console.error('❌ 监控诊断失败:', error);
    }

    return diagnosis;
  }

  /**
   * 生成健康检查报告
   */
  generateHealthReport(results) {
    console.log('\n' + '='.repeat(60));
    console.log('📋 综合健康检查报告');
    console.log('='.repeat(60));

    console.log(`\n📊 总体统计:`);
    console.log(`   总检查数: ${results.total}`);
    console.log(`   健康: ${results.healthy}`);
    console.log(`   警告: ${results.warnings}`);
    console.log(`   错误: ${results.errors}`);
    console.log(`   健康率: ${((results.healthy / results.total) * 100).toFixed(1)}%`);

    // 显示内存状态
    if (results.symbolDetails && Object.keys(results.symbolDetails).length > 0) {
      const firstSymbol = Object.keys(results.symbolDetails)[0];
      const memoryInfo = results.symbolDetails[firstSymbol].memoryHealth;
      if (memoryInfo) {
        console.log(`\n💾 内存状态:`);
        console.log(`   系统内存使用率: ${memoryInfo.memoryInfo.usagePercent}%`);
        console.log(`   进程堆内存使用率: ${Math.round((memoryInfo.processInfo.heapUsed / memoryInfo.processInfo.heapTotal) * 100)}%`);
        console.log(`   内存状态: ${memoryInfo.status}`);
      }
    }

    if (results.issues.length > 0) {
      console.log(`\n⚠️ 发现的问题:`);
      results.issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
    } else {
      console.log(`\n🎉 所有检查项目都正常！`);
    }

    return results;
  }

  /**
   * 启动定期健康检查
   */
  startPeriodicHealthCheck(intervalMinutes = 30) {
    console.log(`⏰ 启动定期健康检查 (间隔: ${intervalMinutes} 分钟)`);

    this.healthCheckTimer = setInterval(async () => {
      console.log('\n🔄 开始定期健康检查...');

      try {
        const results = await this.performComprehensiveHealthCheck();
        this.generateHealthReport(results);

        // 如果发现严重问题，可以触发告警
        if (results.errors > 0) {
          console.log('🚨 发现严重问题，建议立即检查！');
        }

      } catch (error) {
        console.error('❌ 定期健康检查失败:', error);
      }
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * 停止定期健康检查
   */
  stopPeriodicHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
      console.log('⏹️ 定期健康检查已停止');
    }
  }

  /**
   * 销毁监控器
   */
  destroy() {
    this.stopPeriodicHealthCheck();
    if (this.memoryMonitor) {
      this.memoryMonitor.stopMonitoring();
    }
    console.log('🔒 ComprehensiveHealthMonitor 已销毁');
  }
}

module.exports = ComprehensiveHealthMonitor;
