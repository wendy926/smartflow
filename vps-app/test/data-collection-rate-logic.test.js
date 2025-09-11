/**
 * 数据采集率逻辑的单元测试
 */

const DataMonitor = require('../modules/monitoring/DataMonitor');

describe('数据采集率逻辑测试', () => {
  let dataMonitor;

  beforeEach(() => {
    dataMonitor = new DataMonitor();
  });

  test('DataMonitor重置后数据应该为0', () => {
    dataMonitor.reset();
    
    expect(dataMonitor.completionRates.dataCollection).toBe(0);
    expect(dataMonitor.completionRates.signalAnalysis).toBe(0);
    expect(dataMonitor.completionRates.simulationTrading).toBe(0);
    expect(dataMonitor.symbolStats.size).toBe(0);
  });

  test('记录分析日志应该正确更新统计', () => {
    const symbol = 'BTCUSDT';
    const analysisResult = {
      success: true,
      trend4h: '多头趋势',
      signal: '做多',
      execution: '多头回踩突破'
    };

    // 记录分析日志
    dataMonitor.recordAnalysisLog(symbol, analysisResult);

    // 检查统计数据
    const stats = dataMonitor.symbolStats.get(symbol);
    expect(stats).toBeDefined();
    expect(stats.dataCollectionAttempts).toBe(1);
    expect(stats.dataCollectionSuccesses).toBe(1);
    expect(stats.signalAnalysisAttempts).toBe(1);
    expect(stats.signalAnalysisSuccesses).toBe(1);
  });

  test('数据不足时应该正确记录失败', () => {
    const symbol = 'BTCUSDT';
    const analysisResult = {
      success: false,
      reason: '数据不足：缺少4H K线数据'
    };

    // 记录分析日志
    dataMonitor.recordAnalysisLog(symbol, analysisResult);

    // 检查统计数据
    const stats = dataMonitor.symbolStats.get(symbol);
    expect(stats).toBeDefined();
    expect(stats.dataCollectionAttempts).toBe(1);
    expect(stats.dataCollectionSuccesses).toBe(0);
    expect(stats.signalAnalysisAttempts).toBe(1);
    expect(stats.signalAnalysisSuccesses).toBe(0);
  });

  test('计算完成率应该正确', () => {
    // 添加一些测试数据
    const symbols = ['BTCUSDT', 'ETHUSDT'];
    
    symbols.forEach(symbol => {
      dataMonitor.symbolStats.set(symbol, {
        dataCollectionAttempts: 2,
        dataCollectionSuccesses: 1,
        signalAnalysisAttempts: 2,
        signalAnalysisSuccesses: 1,
        simulationTriggers: 0,
        simulationCompletions: 0
      });
    });

    // 计算完成率
    dataMonitor.calculateCompletionRates();

    // 检查结果
    expect(dataMonitor.completionRates.dataCollection).toBe(50);
    expect(dataMonitor.completionRates.signalAnalysis).toBe(50);
    expect(dataMonitor.completionRates.simulationTrading).toBe(0);
  });

  test('空交易对列表时完成率应该为0', () => {
    dataMonitor.calculateCompletionRates();
    
    expect(dataMonitor.completionRates.dataCollection).toBe(0);
    expect(dataMonitor.completionRates.signalAnalysis).toBe(0);
    expect(dataMonitor.completionRates.simulationTrading).toBe(0);
  });

  test('所有分析成功时完成率应该为100%', () => {
    const symbol = 'BTCUSDT';
    dataMonitor.symbolStats.set(symbol, {
      dataCollectionAttempts: 2,
      dataCollectionSuccesses: 2,
      signalAnalysisAttempts: 2,
      signalAnalysisSuccesses: 2,
      simulationTriggers: 0,
      simulationCompletions: 0
    });

    dataMonitor.calculateCompletionRates();

    expect(dataMonitor.completionRates.dataCollection).toBe(100);
    expect(dataMonitor.completionRates.signalAnalysis).toBe(100);
  });
});
