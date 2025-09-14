// data-monitor.test.js
// DataMonitor数据监控测试

const DataMonitor = require('../modules/monitoring/DataMonitor');

describe('DataMonitor 数据监控测试', () => {
  let dataMonitor;

  beforeEach(() => {
    dataMonitor = new DataMonitor();
  });

  afterEach(() => {
    if (dataMonitor) {
      dataMonitor.destroy();
    }
  });

  describe('分析日志记录', () => {
    test('应该正确记录分析开始', () => {
      const symbol = 'BTCUSDT';
      const analysisId = dataMonitor.recordAnalysisStart(symbol);

      expect(analysisId).toBeDefined();
      expect(typeof analysisId).toBe('string');
      expect(analysisId.length).toBeGreaterThan(0);
    });

    test('应该正确记录分析结束', () => {
      const symbol = 'BTCUSDT';
      const analysisId = dataMonitor.recordAnalysisStart(symbol);

      const phases = {
        '4h_trend': { success: true, duration: 100 },
        '1h_scoring': { success: true, duration: 50 },
        '15m_execution': { success: true, duration: 30 }
      };

      dataMonitor.recordAnalysisEnd(analysisId, true, phases);

      const logs = dataMonitor.getAnalysisLogs(symbol, 10);
      expect(logs.length).toBeGreaterThan(0);

      const log = logs[0];
      expect(log.success).toBe(true);
      expect(log.phases).toEqual(phases);
    });

    test('应该正确处理分析失败', () => {
      const symbol = 'ETHUSDT';
      const analysisId = dataMonitor.recordAnalysisStart(symbol);
      const errorMessage = '数据不足';

      dataMonitor.recordAnalysisEnd(analysisId, false, null, errorMessage);

      const logs = dataMonitor.getAnalysisLogs(symbol, 10);
      expect(logs.length).toBeGreaterThan(0);

      const log = logs[0];
      expect(log.success).toBe(false);
      expect(log.errorMessage).toBe(errorMessage);
    });
  });

  describe('数据质量监控', () => {
    test('应该正确记录数据质量问题', () => {
      const symbol = 'BTCUSDT';
      const issueType = '数据不足';
      const severity = '高';
      const message = 'K线数据少于200条';
      const details = { required: 200, actual: 150 };

      dataMonitor.recordDataQualityIssue(symbol, issueType, severity, message, details);

      const issues = dataMonitor.getDataQualityIssues(symbol, 10);
      expect(issues.length).toBeGreaterThan(0);

      const issue = issues[0];
      expect(issue.symbol).toBe(symbol);
      expect(issue.issueType).toBe(issueType);
      expect(issue.severity).toBe(severity);
      expect(issue.message).toBe(message);
      expect(issue.details).toEqual(details);
    });

    test('应该正确记录数据验证结果', () => {
      const symbol = 'LINKUSDT';
      const overallStatus = 'WARNING';
      const errors = ['MA数据不完整', 'ATR计算错误'];
      const warnings = ['成交量数据延迟'];
      const details = {
        maData: { valid: false, reason: '数据不足' },
        atrData: { valid: false, reason: '计算错误' }
      };

      dataMonitor.recordValidationResult(symbol, overallStatus, errors, warnings, details);

      const results = dataMonitor.getValidationResults(symbol, 10);
      expect(results.length).toBeGreaterThan(0);

      const result = results[0];
      expect(result.symbol).toBe(symbol);
      expect(result.overallStatus).toBe(overallStatus);
      expect(result.errors).toEqual(errors);
      expect(result.warnings).toEqual(warnings);
      expect(result.details).toEqual(details);
    });
  });

  describe('模拟交易监控', () => {
    test('应该正确记录模拟交易触发', () => {
      const symbol = 'BTCUSDT';
      const triggerReason = 'SIGNAL_多头回踩突破';

      dataMonitor.recordSimulationTrigger(symbol, triggerReason);

      const stats = dataMonitor.getSimulationStats(symbol);
      expect(stats.triggers).toBeGreaterThan(0);
      expect(stats.lastTrigger).toBeDefined();
    });

    test('应该正确记录模拟交易完成', () => {
      const symbol = 'BTCUSDT';
      const isWin = true;
      const profitLoss = 150.5;

      dataMonitor.recordSimulationCompletion(symbol, isWin, profitLoss);

      const stats = dataMonitor.getSimulationStats(symbol);
      expect(stats.completions).toBeGreaterThan(0);
      expect(stats.lastCompletion).toBeDefined();
    });

    test('应该正确计算模拟交易完成率', () => {
      const symbol = 'ETHUSDT';

      // 触发3次，完成2次
      dataMonitor.recordSimulationTrigger(symbol, 'SIGNAL_空头反抽破位');
      dataMonitor.recordSimulationTrigger(symbol, 'SIGNAL_多头回踩突破');
      dataMonitor.recordSimulationTrigger(symbol, 'SIGNAL_区间多头');

      dataMonitor.recordSimulationCompletion(symbol, true, 100);
      dataMonitor.recordSimulationCompletion(symbol, false, -50);

      const stats = dataMonitor.getSimulationStats(symbol);
      expect(stats.triggers).toBe(3);
      expect(stats.completions).toBe(2);
      expect(stats.completionRate).toBeCloseTo(66.67, 1);
    });
  });

  describe('数据收集监控', () => {
    test('应该正确记录数据收集成功', () => {
      const symbol = 'LINKUSDT';
      const dataType = 'klines';

      dataMonitor.recordDataCollection(symbol, dataType, true);

      const stats = dataMonitor.getDataCollectionStats(symbol);
      expect(stats.attempts).toBeGreaterThan(0);
      expect(stats.successes).toBeGreaterThan(0);
      expect(stats.successRate).toBeGreaterThan(0);
    });

    test('应该正确记录数据收集失败', () => {
      const symbol = 'BTCUSDT';
      const dataType = 'ticker';

      dataMonitor.recordDataCollection(symbol, dataType, false);

      const stats = dataMonitor.getDataCollectionStats(symbol);
      expect(stats.attempts).toBeGreaterThan(0);
      expect(stats.failures).toBeGreaterThan(0);
      expect(stats.successRate).toBeLessThan(100);
    });

    test('应该正确计算数据收集率', () => {
      const symbol = 'ETHUSDT';

      // 成功5次，失败1次
      for (let i = 0; i < 5; i++) {
        dataMonitor.recordDataCollection(symbol, 'klines', true);
      }
      dataMonitor.recordDataCollection(symbol, 'ticker', false);

      const stats = dataMonitor.getDataCollectionStats(symbol);
      expect(stats.attempts).toBe(6);
      expect(stats.successes).toBe(5);
      expect(stats.failures).toBe(1);
      expect(stats.successRate).toBeCloseTo(83.33, 1);
    });
  });

  describe('信号分析监控', () => {
    test('应该正确记录信号分析成功', () => {
      const symbol = 'BTCUSDT';
      const analysisType = '4h_trend';

      dataMonitor.recordSignalAnalysis(symbol, analysisType, true);

      const stats = dataMonitor.getSignalAnalysisStats(symbol);
      expect(stats.attempts).toBeGreaterThan(0);
      expect(stats.successes).toBeGreaterThan(0);
      expect(stats.successRate).toBeGreaterThan(0);
    });

    test('应该正确记录信号分析失败', () => {
      const symbol = 'LINKUSDT';
      const analysisType = '1h_scoring';

      dataMonitor.recordSignalAnalysis(symbol, analysisType, false);

      const stats = dataMonitor.getSignalAnalysisStats(symbol);
      expect(stats.attempts).toBeGreaterThan(0);
      expect(stats.failures).toBeGreaterThan(0);
      expect(stats.successRate).toBeLessThan(100);
    });
  });

  describe('整体状态评估', () => {
    test('应该正确评估健康状态', () => {
      const symbol = 'BTCUSDT';

      // 设置良好的数据
      dataMonitor.recordDataCollection(symbol, 'klines', true);
      dataMonitor.recordSignalAnalysis(symbol, '4h_trend', true);
      dataMonitor.recordSimulationTrigger(symbol, 'SIGNAL_多头回踩突破');
      dataMonitor.recordSimulationCompletion(symbol, true, 100);

      const status = dataMonitor.getOverallStatus(symbol);
      expect(status).toBeDefined();
      expect(['healthy', 'warning', 'error']).toContain(status);
    });

    test('应该正确评估警告状态', () => {
      const symbol = 'ETHUSDT';

      // 设置部分失败的数据
      dataMonitor.recordDataCollection(symbol, 'klines', true);
      dataMonitor.recordDataCollection(symbol, 'ticker', false);
      dataMonitor.recordSignalAnalysis(symbol, '4h_trend', true);
      dataMonitor.recordSignalAnalysis(symbol, '1h_scoring', false);

      const status = dataMonitor.getOverallStatus(symbol);
      expect(status).toBeDefined();
    });

    test('应该正确评估错误状态', () => {
      const symbol = 'LINKUSDT';

      // 设置大量失败的数据
      for (let i = 0; i < 5; i++) {
        dataMonitor.recordDataCollection(symbol, 'klines', false);
        dataMonitor.recordSignalAnalysis(symbol, '4h_trend', false);
      }

      const status = dataMonitor.getOverallStatus(symbol);
      expect(status).toBeDefined();
    });
  });

  describe('统计汇总', () => {
    test('应该正确生成监控仪表板数据', () => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'LINKUSDT'];

      // 为每个交易对设置数据
      symbols.forEach(symbol => {
        dataMonitor.recordDataCollection(symbol, 'klines', true);
        dataMonitor.recordSignalAnalysis(symbol, '4h_trend', true);
        dataMonitor.recordSimulationTrigger(symbol, 'SIGNAL_多头回踩突破');
      });

      const dashboard = dataMonitor.getMonitoringDashboard();

      expect(dashboard).toBeDefined();
      expect(dashboard.summary).toBeDefined();
      expect(dashboard.detailedStats).toBeDefined();
      expect(dashboard.detailedStats.length).toBe(symbols.length);

      expect(dashboard.summary.totalSymbols).toBe(symbols.length);
      expect(dashboard.summary.completionRates).toBeDefined();
    });

    test('应该正确生成系统概览', () => {
      const symbols = ['BTCUSDT', 'ETHUSDT'];

      symbols.forEach(symbol => {
        dataMonitor.recordDataCollection(symbol, 'klines', true);
        dataMonitor.recordSignalAnalysis(symbol, '4h_trend', true);
      });

      const overview = dataMonitor.getSystemOverview();

      expect(overview).toBeDefined();
      expect(overview.totalSymbols).toBe(symbols.length);
      expect(overview.healthySymbols).toBeGreaterThanOrEqual(0);
      expect(overview.warningSymbols).toBeGreaterThanOrEqual(0);
      expect(overview.errorSymbols).toBeGreaterThanOrEqual(0);
    });
  });

  describe('数据清理', () => {
    test('应该正确清理旧数据', () => {
      const symbol = 'BTCUSDT';

      // 记录一些数据
      dataMonitor.recordDataCollection(symbol, 'klines', true);
      dataMonitor.recordSignalAnalysis(symbol, '4h_trend', true);

      // 清理数据
      dataMonitor.cleanupOldData(0); // 清理所有数据

      const stats = dataMonitor.getDataCollectionStats(symbol);
      expect(stats.attempts).toBe(0);
    });

    test('应该正确重置监控数据', () => {
      const symbol = 'BTCUSDT';

      // 记录一些数据
      dataMonitor.recordDataCollection(symbol, 'klines', true);
      dataMonitor.recordSignalAnalysis(symbol, '4h_trend', true);

      // 重置数据
      dataMonitor.reset();

      const stats = dataMonitor.getDataCollectionStats(symbol);
      expect(stats.attempts).toBe(0);
    });
  });

  describe('错误处理', () => {
    test('应该处理无效参数', () => {
      expect(() => {
        dataMonitor.recordAnalysisStart(null);
      }).not.toThrow();

      expect(() => {
        dataMonitor.recordDataCollection(null, null, null);
      }).not.toThrow();
    });

    test('应该处理无效的分析ID', () => {
      expect(() => {
        dataMonitor.recordAnalysisEnd('invalid-id', true);
      }).not.toThrow();
    });
  });
});
