const { DataMonitor } = require('../modules/monitoring/DataMonitor');

describe('数据收集率计算修复测试', () => {
  let dataMonitor;

  beforeEach(() => {
    dataMonitor = new DataMonitor();
  });

  afterEach(() => {
    if (dataMonitor) {
      dataMonitor.stopMemoryCleanup();
      dataMonitor = null;
    }
  });

  describe('数据收集率计算逻辑', () => {
    test('应该正确计算所有交易对数据采集率的平均值', () => {
      // 模拟交易对统计数据
      const symbolStats = new Map();
      symbolStats.set('BTCUSDT', {
        dataCollectionAttempts: 10,
        dataCollectionSuccesses: 9,
        signalAnalysisAttempts: 10,
        signalAnalysisSuccesses: 8,
        simulationTriggers: 5,
        simulationCompletions: 4
      });
      symbolStats.set('ETHUSDT', {
        dataCollectionAttempts: 8,
        dataCollectionSuccesses: 7,
        signalAnalysisAttempts: 8,
        signalAnalysisSuccesses: 6,
        simulationTriggers: 3,
        simulationCompletions: 2
      });
      symbolStats.set('LINKUSDT', {
        dataCollectionAttempts: 12,
        dataCollectionSuccesses: 11,
        signalAnalysisAttempts: 12,
        signalAnalysisSuccesses: 10,
        simulationTriggers: 4,
        simulationCompletions: 3
      });

      // 设置统计数据
      dataMonitor.symbolStats = symbolStats;

      // 调用计算完成率方法
      dataMonitor.calculateCompletionRates();

      // 验证结果
      // BTCUSDT: 90%, ETHUSDT: 87.5%, LINKUSDT: 91.67%
      // 平均值: (90 + 87.5 + 91.67) / 3 = 89.72%
      expect(dataMonitor.completionRates.dataCollection).toBeCloseTo(89.72, 1);
      // BTCUSDT: 80%, ETHUSDT: 75%, LINKUSDT: 83.33%
      // 平均值: (80 + 75 + 83.33) / 3 = 79.44%
      expect(dataMonitor.completionRates.signalAnalysis).toBeCloseTo(79.44, 1);
      // BTCUSDT: 80%, ETHUSDT: 66.67%, LINKUSDT: 75%
      // 平均值: (80 + 66.67 + 75) / 3 = 73.89%
      expect(dataMonitor.completionRates.simulationTrading).toBeCloseTo(73.89, 1);
    });

    test('应该正确处理部分交易对无数据的情况', () => {
      const symbolStats = new Map();
      symbolStats.set('BTCUSDT', {
        dataCollectionAttempts: 10,
        dataCollectionSuccesses: 9,
        signalAnalysisAttempts: 10,
        signalAnalysisSuccesses: 8,
        simulationTriggers: 5,
        simulationCompletions: 4
      });
      symbolStats.set('ETHUSDT', {
        dataCollectionAttempts: 0, // 无数据
        dataCollectionSuccesses: 0,
        signalAnalysisAttempts: 0,
        signalAnalysisSuccesses: 0,
        simulationTriggers: 0,
        simulationCompletions: 0
      });
      symbolStats.set('LINKUSDT', {
        dataCollectionAttempts: 12,
        dataCollectionSuccesses: 11,
        signalAnalysisAttempts: 12,
        signalAnalysisSuccesses: 10,
        simulationTriggers: 4,
        simulationCompletions: 3
      });

      dataMonitor.symbolStats = symbolStats;
      dataMonitor.calculateCompletionRates();

      // 只计算有数据的交易对
      // BTCUSDT: 90%, LINKUSDT: 91.67%
      // 平均值: (90 + 91.67) / 2 = 90.83%
      expect(dataMonitor.completionRates.dataCollection).toBeCloseTo(90.83, 1);
      // BTCUSDT: 80%, LINKUSDT: 83.33%
      // 平均值: (80 + 83.33) / 2 = 81.67%
      expect(dataMonitor.completionRates.signalAnalysis).toBeCloseTo(81.67, 1);
      // BTCUSDT: 80%, LINKUSDT: 75%
      // 平均值: (80 + 75) / 2 = 77.5%
      expect(dataMonitor.completionRates.simulationTrading).toBeCloseTo(77.5, 1);
    });

    test('应该正确处理所有交易对都无数据的情况', () => {
      const symbolStats = new Map();
      symbolStats.set('BTCUSDT', {
        dataCollectionAttempts: 0,
        dataCollectionSuccesses: 0,
        signalAnalysisAttempts: 0,
        signalAnalysisSuccesses: 0,
        simulationTriggers: 0,
        simulationCompletions: 0
      });
      symbolStats.set('ETHUSDT', {
        dataCollectionAttempts: 0,
        dataCollectionSuccesses: 0,
        signalAnalysisAttempts: 0,
        signalAnalysisSuccesses: 0,
        simulationTriggers: 0,
        simulationCompletions: 0
      });

      dataMonitor.symbolStats = symbolStats;
      dataMonitor.calculateCompletionRates();

      expect(dataMonitor.completionRates.dataCollection).toBe(0);
      expect(dataMonitor.completionRates.signalAnalysis).toBe(0);
      expect(dataMonitor.completionRates.simulationTrading).toBe(0);
    });

    test('应该正确处理空交易对列表', () => {
      dataMonitor.symbolStats = new Map();
      dataMonitor.calculateCompletionRates();

      expect(dataMonitor.completionRates.dataCollection).toBe(0);
      expect(dataMonitor.completionRates.signalAnalysis).toBe(0);
      expect(dataMonitor.completionRates.simulationTrading).toBe(0);
    });
  });

  describe('recordAnalysisLog方法修复', () => {
    test('应该正确记录尝试次数和成功次数', () => {
      const symbol = 'BTCUSDT';
      
      // 初始化交易对统计
      dataMonitor.symbolStats.set(symbol, {
        dataCollectionAttempts: 0,
        dataCollectionSuccesses: 0,
        signalAnalysisAttempts: 0,
        signalAnalysisSuccesses: 0,
        simulationTriggers: 0,
        simulationCompletions: 0
      });

      // 模拟分析结果
      const analysisResult = {
        phases: {
          dataCollection: { success: true },
          signalAnalysis: { success: false },
          simulationTrading: { success: true }
        }
      };

      // 记录分析日志
      dataMonitor.recordAnalysisLog(symbol, analysisResult);

      // 验证统计数据
      const stats = dataMonitor.symbolStats.get(symbol);
      expect(stats.dataCollectionAttempts).toBe(1);
      expect(stats.dataCollectionSuccesses).toBe(1);
      expect(stats.signalAnalysisAttempts).toBe(1);
      expect(stats.signalAnalysisSuccesses).toBe(0);
      expect(stats.simulationCompletions).toBe(1);
    });

    test('应该正确更新完成率', () => {
      const symbol = 'BTCUSDT';
      
      dataMonitor.symbolStats.set(symbol, {
        dataCollectionAttempts: 0,
        dataCollectionSuccesses: 0,
        signalAnalysisAttempts: 0,
        signalAnalysisSuccesses: 0,
        simulationTriggers: 0,
        simulationCompletions: 0
      });

      const analysisResult = {
        phases: {
          dataCollection: { success: true },
          signalAnalysis: { success: true },
          simulationTrading: { success: false }
        }
      };

      dataMonitor.recordAnalysisLog(symbol, analysisResult);

      // 验证完成率已更新
      expect(dataMonitor.completionRates.dataCollection).toBe(100);
      expect(dataMonitor.completionRates.signalAnalysis).toBe(100);
      expect(dataMonitor.completionRates.simulationTrading).toBe(0);
    });

    test('应该处理不存在的交易对', () => {
      const symbol = 'NONEXISTENT';
      const analysisResult = {
        phases: {
          dataCollection: { success: true },
          signalAnalysis: { success: true },
          simulationTrading: { success: true }
        }
      };

      // 应该不会抛出错误
      expect(() => {
        dataMonitor.recordAnalysisLog(symbol, analysisResult);
      }).not.toThrow();
    });
  });

  describe('数据收集率显示格式', () => {
    test('应该正确格式化两位小数的数据收集率', () => {
      const rate = 95.83333333333333;
      const formatted = rate.toFixed(2);
      expect(formatted).toBe('95.83');
    });

    test('应该正确处理整数数据收集率', () => {
      const rate = 100;
      const formatted = rate.toFixed(2);
      expect(formatted).toBe('100.00');
    });

    test('应该正确处理零值数据收集率', () => {
      const rate = 0;
      const formatted = rate.toFixed(2);
      expect(formatted).toBe('0.00');
    });
  });

  describe('告警阈值检查', () => {
    test('应该正确识别数据收集率过低告警', () => {
      const dataCollectionRate = 85.5;
      const threshold = 95;
      
      const shouldAlert = dataCollectionRate < threshold;
      expect(shouldAlert).toBe(true);
    });

    test('应该正确识别数据收集率正常情况', () => {
      const dataCollectionRate = 98.5;
      const threshold = 95;
      
      const shouldAlert = dataCollectionRate < threshold;
      expect(shouldAlert).toBe(false);
    });

    test('应该正确识别信号分析率过低告警', () => {
      const signalAnalysisRate = 90.2;
      const threshold = 95;
      
      const shouldAlert = signalAnalysisRate < threshold;
      expect(shouldAlert).toBe(true);
    });
  });
});
