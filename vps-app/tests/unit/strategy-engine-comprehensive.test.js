// tests/unit/strategy-engine-comprehensive.test.js
// 策略引擎综合单元测试 - 覆盖核心逻辑

const StrategyV3Engine = require('../../src/core/modules/strategy/trend-trading/StrategyV3Engine');
const ICTStrategyEngine = require('../../src/core/modules/strategy/ict-trading/ICTStrategyEngine');
const ICTSweepDetector = require('../../src/core/modules/strategy/ict-trading/ICTSweepDetector');
const V3TrendFilter = require('../../src/core/modules/strategy/trend-trading/V3TrendFilter');
const V3HourlyScoring = require('../../src/core/modules/strategy/trend-trading/V3HourlyScoring');
const StrategyResultValidator = require('../../src/core/modules/validation/StrategyResultValidator');

// Mock BinanceAPI
jest.mock('../../src/core/modules/api/BinanceAPI', () => ({
  getKlines: jest.fn().mockResolvedValue([
    [1640995200000, "47000", "47500", "46800", "47200", "1000.5"],
    [1640998800000, "47200", "47800", "47000", "47600", "1200.3"],
    [1641002400000, "47600", "48000", "47400", "47800", "1100.8"],
    [1641006000000, "47800", "48200", "47600", "48000", "1300.2"],
    [1641009600000, "48000", "48400", "47900", "48200", "1150.7"]
  ]),
  get24hrTicker: jest.fn().mockResolvedValue({ lastPrice: "47200" }),
  getFundingRate: jest.fn().mockResolvedValue([{ fundingRate: "0.0001" }]),
  getOpenInterestHist: jest.fn().mockResolvedValue([
    { sumOpenInterest: "1000000" },
    { sumOpenInterest: "1020000" }
  ]),
  ping: jest.fn().mockResolvedValue(true)
}));

// Mock数据
const mockKlineData = [
  [1640995200000, "47000", "47500", "46800", "47200", "1000.5"],
  [1640998800000, "47200", "47800", "47000", "47600", "1200.3"],
  [1641002400000, "47600", "48000", "47400", "47800", "1100.8"],
  [1641006000000, "47800", "48200", "47600", "48000", "1300.2"],
  [1641009600000, "48000", "48400", "47900", "48200", "1150.7"]
];

const mockDatabase = {
  runQuery: jest.fn().mockResolvedValue([]),
  run: jest.fn().mockResolvedValue({ lastID: 1, changes: 1 }),
  get: jest.fn().mockResolvedValue({}),
  all: jest.fn().mockResolvedValue([])
};

const mockCacheManager = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(true)
};

describe('策略引擎综合测试', () => {
  let v3Engine;
  let ictEngine;
  let validator;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // 模拟数据库返回交易对分类数据
    mockDatabase.runQuery.mockImplementation((query, params) => {
      if (query.includes('symbol_categories')) {
        return Promise.resolve([{
          symbol: params[0],
          category: 'midcap',
          v3_vwap_weight: 0.35,
          v3_breakout_weight: 0.25,
          v3_volume_weight: 0.25,
          v3_oi_weight: 0.20,
          v3_delta_weight: 0.20,
          v3_funding_weight: 0.10
        }]);
      }
      return Promise.resolve([]);
    });

    v3Engine = new StrategyV3Engine(mockDatabase, mockCacheManager);
    ictEngine = new ICTStrategyEngine(mockDatabase, mockCacheManager);
    validator = new StrategyResultValidator();
  });

  describe('V3策略引擎测试', () => {
    test('应该正确执行完整的V3策略分析流程', async () => {
      const result = await v3Engine.analyzeSymbol('BTCUSDT');

      expect(result).toBeDefined();
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.strategyType).toBe('V3');
      expect(result.engineSource).toBe('real');
      expect(result.timestamp).toBeDefined();
    });

    test('应该正确验证V3策略结果', async () => {
      const result = await v3Engine.analyzeSymbol('BTCUSDT');
      const validation = validator.validateV3Result(result);

      expect(validation).toBeDefined();
      expect(validation.valid).toBeDefined();
      expect(Array.isArray(validation.errors)).toBe(true);
      expect(Array.isArray(validation.warnings)).toBe(true);
    });

    test('应该处理V3策略分析错误', async () => {
      // Mock API失败
      const BinanceAPI = require('../../src/core/modules/api/BinanceAPI');
      BinanceAPI.getKlines.mockRejectedValueOnce(new Error('API调用失败'));

      const result = await v3Engine.analyzeSymbol('INVALID');

      expect(result.error).toBeDefined();
      expect(result.dataValid).toBe(false);
      expect(result.strategyType).toBe('V3');
    });
  });

  describe('ICT策略引擎测试', () => {
    test('应该正确执行完整的ICT策略分析流程', async () => {
      const result = await ictEngine.analyzeSymbol('BTCUSDT');

      expect(result).toBeDefined();
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.strategyType).toBe('ICT');
      expect(result.engineSource).toBe('real');
      expect(result.timestamp).toBeDefined();
    });

    test('应该正确验证ICT策略结果', async () => {
      const result = await ictEngine.analyzeSymbol('BTCUSDT');
      const validation = validator.validateICTResult(result);

      expect(validation).toBeDefined();
      expect(validation.valid).toBeDefined();
      expect(Array.isArray(validation.errors)).toBe(true);
      expect(Array.isArray(validation.warnings)).toBe(true);
    });

    test('应该处理ICT策略分析错误', async () => {
      // Mock API失败
      const BinanceAPI = require('../../src/core/modules/api/BinanceAPI');
      BinanceAPI.getKlines.mockRejectedValueOnce(new Error('API调用失败'));

      const result = await ictEngine.analyzeSymbol('INVALID');

      expect(result.error).toBeDefined();
      expect(result.dataValid).toBe(false);
      expect(result.strategyType).toBe('ICT');
    });
  });

  describe('ICT Sweep检测测试', () => {
    let sweepDetector;

    beforeEach(() => {
      sweepDetector = new ICTSweepDetector();
    });

    test('应该正确检测4H Sweep宏观速率', async () => {
      const candles4h = mockKlineData.map(k => ({
        timestamp: k[0],
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));

      const atr4h = 500; // 模拟ATR值
      const result = await sweepDetector.detectSweepHTF(candles4h, atr4h);

      expect(result).toBeDefined();
      expect(result.detected).toBeDefined();
      expect(result.threshold).toBe(atr4h * 0.4); // 按文档要求
    });

    test('应该正确检测15m Sweep微观速率', async () => {
      const candles15m = mockKlineData.map(k => ({
        timestamp: k[0],
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));

      const atr15m = 100; // 模拟ATR值
      const result = await sweepDetector.detectSweepLTF(candles15m, atr15m);

      expect(result).toBeDefined();
      expect(result.detected).toBeDefined();
      expect(result.threshold).toBe(atr15m * 0.2); // 按文档要求
    });

    test('Sweep检测应该符合文档阈值要求', async () => {
      const sweepDetector = new ICTSweepDetector();
      const stats = sweepDetector.getSweepDetectionStats();

      // 验证配置符合ict.md文档
      expect(stats.htfConfig.maxBarsToReturn).toBe(2);
      expect(stats.htfConfig.minSpeedATRRatio).toBe(0.4);
      expect(stats.ltfConfig.maxBarsToReturn).toBe(3);
      expect(stats.ltfConfig.minSpeedATRRatio).toBe(0.2);
    });
  });

  describe('V3趋势过滤测试', () => {
    let trendFilter;

    beforeEach(() => {
      trendFilter = new V3TrendFilter(mockDatabase, mockCacheManager);
    });

    test('应该正确执行10分打分机制', async () => {
      const result = await trendFilter.analyze4HTrend('BTCUSDT');

      expect(result).toBeDefined();
      expect(result.totalScore).toBeGreaterThanOrEqual(0);
      expect(result.totalScore).toBeLessThanOrEqual(10);
      expect(result.trend4h).toMatch(/^(多头趋势|空头趋势|震荡市)$/);
    });

    test('趋势过滤应该符合文档评分标准', async () => {
      const result = await trendFilter.analyze4HTrend('BTCUSDT');

      // 验证得分逻辑符合strategy-v3.md文档
      if (result.trend4h !== '震荡市') {
        expect(result.totalScore).toBeGreaterThanOrEqual(4); // ≥4分保留趋势
      } else {
        expect(result.totalScore).toBeLessThan(4); // <4分震荡市
      }

      // 验证因子得分结构
      expect(result.factorScores).toBeDefined();
      expect(result.factorDetails).toBeDefined();
    });
  });

  describe('策略结果验证器测试', () => {
    test('应该正确验证V3策略结果', () => {
      const mockV3Result = {
        symbol: 'BTCUSDT',
        trend4h: '多头趋势',
        signal: '做多',
        execution: '做多_突破确认',
        currentPrice: 47200,
        entrySignal: 47250,
        stopLoss: 46800,
        takeProfit: 48150,
        score: 5,
        score1h: 4,
        dataCollectionRate: 98.5,
        strategyType: 'V3',
        timestamp: new Date().toISOString()
      };

      const validation = validator.validateV3Result(mockV3Result);

      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
      expect(validation.score).toBeGreaterThan(60);
    });

    test('应该正确验证ICT策略结果', () => {
      const mockICTResult = {
        symbol: 'BTCUSDT',
        dailyTrend: 'up',
        signalType: 'BOS_LONG',
        entryPrice: 47200,
        stopLoss: 46800,
        takeProfit: 48400,
        dailyTrendScore: 2,
        obDetected: true,
        fvgDetected: false,
        sweepHTF: true,
        riskRewardRatio: 3,
        leverage: 5,
        dataCollectionRate: 95.0,
        strategyType: 'ICT',
        timestamp: new Date().toISOString()
      };

      const validation = validator.validateICTResult(mockICTResult);

      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
      expect(validation.score).toBeGreaterThan(60);
    });

    test('应该检测无效的策略结果', () => {
      const invalidResult = {
        symbol: 'INVALID_SYMBOL',
        trend4h: '多头趋势',
        signal: '做空', // 逻辑错误: 多头趋势下做空
        currentPrice: -100, // 无效价格
        score: 15, // 超出范围
        strategyType: 'V3'
        // 缺少timestamp等必需字段
      };

      const validation = validator.validateV3Result(invalidResult);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.score).toBeLessThan(60);
    });
  });

  describe('策略一致性测试', () => {
    test('应该检测V3和ICT策略的一致性', async () => {
      const v3Result = await v3Engine.analyzeSymbol('BTCUSDT');
      const ictResult = await ictEngine.analyzeSymbol('BTCUSDT');

      const consistencyValidation = validator.validateStrategyConsistency([v3Result], [ictResult]);

      expect(consistencyValidation).toBeDefined();
      expect(consistencyValidation.consistent).toBeDefined();
      expect(Array.isArray(consistencyValidation.conflicts)).toBe(true);
      expect(Array.isArray(consistencyValidation.agreements)).toBe(true);
    });

    test('应该识别策略信号冲突', () => {
      const v3Results = [{
        symbol: 'BTCUSDT',
        signal: '做多',
        currentPrice: 47200,
        strategyType: 'V3'
      }];

      const ictResults = [{
        symbol: 'BTCUSDT',
        signalType: 'BOS_SHORT',
        entryPrice: 47200,
        strategyType: 'ICT'
      }];

      const validation = validator.validateStrategyConsistency(v3Results, ictResults);

      expect(validation.consistent).toBe(false);
      expect(validation.conflicts.length).toBeGreaterThan(0);
    });
  });

  describe('数据完整性测试', () => {
    test('应该验证策略结果数据完整性', () => {
      const results = [
        {
          symbol: 'BTCUSDT',
          strategyType: 'V3',
          trend4h: '多头趋势',
          signal: '做多',
          currentPrice: 47200,
          dataCollectionRate: 98.5,
          timestamp: new Date().toISOString()
        },
        {
          symbol: 'ETHUSDT',
          strategyType: 'ICT',
          dailyTrend: 'up',
          signalType: 'BOS_LONG',
          entryPrice: 3200,
          dataCollectionRate: 95.0,
          timestamp: new Date().toISOString()
        }
      ];

      const validation = validator.validateDataCompleteness(results);

      expect(validation.totalCount).toBe(2);
      expect(validation.validCount).toBeGreaterThan(0);
      expect(validation.completenessRate).toBeGreaterThan(0);
    });

    test('应该检测数据收集率问题', () => {
      const results = [
        {
          symbol: 'BTCUSDT',
          strategyType: 'V3',
          dataCollectionRate: 85, // 低于90%
          timestamp: new Date().toISOString()
        }
      ];

      const validation = validator.validateDataCompleteness(results);

      expect(validation.missingDataCount).toBe(1);
      expect(validation.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('风险管理验证测试', () => {
    test('应该验证正确的风险管理参数', () => {
      const riskData = {
        entry: 47200,
        stopLoss: 46800,
        takeProfit: 48000,
        direction: 'LONG',
        riskRewardRatio: 2,
        leverage: 10,
        margin: 4720,
        notional: 47200
      };

      const validation = validator.validateRiskManagement(riskData);

      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    test('应该检测无效的风险管理参数', () => {
      const invalidRiskData = {
        entry: 47200,
        stopLoss: 47500, // 错误: 多头止损高于入场价
        takeProfit: 46800, // 错误: 多头止盈低于入场价
        direction: 'LONG',
        riskRewardRatio: 0.5, // 错误: 风险回报比过低
        leverage: 200 // 错误: 杠杆过高
      };

      const validation = validator.validateRiskManagement(invalidRiskData);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('性能测试', () => {
    test('策略分析应该在合理时间内完成', async () => {
      const startTime = Date.now();
      
      const [v3Result, ictResult] = await Promise.all([
        v3Engine.analyzeSymbol('BTCUSDT'),
        ictEngine.analyzeSymbol('BTCUSDT')
      ]);

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // 5秒内完成
      expect(v3Result.analysisTime).toBeLessThan(3000); // 单个策略3秒内
      expect(ictResult.analysisTime).toBeLessThan(3000);
    });

    test('批量分析应该正确处理多个交易对', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
      const startTime = Date.now();

      const results = await Promise.all(
        symbols.map(symbol => v3Engine.analyzeSymbol(symbol))
      );

      const duration = Date.now() - startTime;

      expect(results.length).toBe(symbols.length);
      expect(duration).toBeLessThan(10000); // 10秒内完成批量分析
      
      results.forEach((result, index) => {
        expect(result.symbol).toBe(symbols[index]);
        expect(result.strategyType).toBe('V3');
      });
    });
  });

  describe('文档符合性测试', () => {
    test('V3策略应该符合strategy-v3.md文档要求', async () => {
      const result = await v3Engine.analyzeSymbol('BTCUSDT');

      // 检查4H趋势过滤10分制
      if (result.score !== undefined) {
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(10);
      }

      // 检查1H多因子6分制
      if (result.score1h !== undefined) {
        expect(result.score1h).toBeGreaterThanOrEqual(0);
        expect(result.score1h).toBeLessThanOrEqual(6);
      }

      // 检查趋势判断逻辑
      if (result.score >= 4) {
        expect(result.trend4h).toMatch(/^(多头趋势|空头趋势)$/);
      } else {
        expect(result.trend4h).toBe('震荡市');
      }
    });

    test('ICT策略应该符合ict.md文档要求', async () => {
      const result = await ictEngine.analyzeSymbol('BTCUSDT');

      // 检查1D趋势3分制
      if (result.dailyTrendScore !== undefined) {
        expect(result.dailyTrendScore).toBeGreaterThanOrEqual(0);
        expect(result.dailyTrendScore).toBeLessThanOrEqual(3);
      }

      // 检查信号类型符合文档
      if (result.signalType) {
        expect(result.signalType).toMatch(/^(BOS_LONG|BOS_SHORT|CHoCH_LONG|CHoCH_SHORT|MIT_LONG|MIT_SHORT|WAIT)$/);
      }

      // 检查风险回报比
      if (result.riskRewardRatio) {
        expect(result.riskRewardRatio).toBe(3); // 按文档默认3:1
      }
    });
  });

  describe('错误处理测试', () => {
    test('应该优雅处理网络错误', async () => {
      const BinanceAPI = require('../../src/core/modules/api/BinanceAPI');
      BinanceAPI.getKlines.mockRejectedValue(new Error('Network timeout'));

      const v3Result = await v3Engine.analyzeSymbol('BTCUSDT');
      const ictResult = await ictEngine.analyzeSymbol('BTCUSDT');

      expect(v3Result.error).toBeDefined();
      expect(ictResult.error).toBeDefined();
      expect(v3Result.dataValid).toBe(false);
      expect(ictResult.dataValid).toBe(false);
    });

    test('应该优雅处理数据库错误', async () => {
      mockDatabase.runQuery.mockRejectedValue(new Error('Database connection failed'));

      const result = await v3Engine.analyzeSymbol('BTCUSDT');

      // 应该仍然返回结果，即使数据库操作失败
      expect(result).toBeDefined();
      expect(result.symbol).toBe('BTCUSDT');
    });

    test('应该处理无效的交易对', async () => {
      const invalidSymbols = ['', null, undefined, 'INVALID', '123'];

      for (const symbol of invalidSymbols) {
        const result = await v3Engine.analyzeSymbol(symbol);
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('缓存机制测试', () => {
    test('应该正确使用缓存机制', async () => {
      // 第一次调用
      await v3Engine.analyzeSymbol('BTCUSDT');
      
      // 验证缓存调用
      expect(mockCacheManager.get).toHaveBeenCalled();
      expect(mockCacheManager.set).toHaveBeenCalled();
    });

    test('应该在缓存失效时重新计算', async () => {
      // Mock缓存返回过期数据
      mockCacheManager.get.mockResolvedValueOnce({
        timestamp: Date.now() - 600000, // 10分钟前的数据
        data: { symbol: 'BTCUSDT', signal: 'cached' }
      });

      const result = await v3Engine.analyzeSymbol('BTCUSDT');

      // 应该重新计算而不是使用过期缓存
      expect(result.engineSource).toBe('real');
    });
  });

  describe('数据库集成测试', () => {
    test('应该正确存储策略分析结果', async () => {
      const result = await v3Engine.analyzeSymbol('BTCUSDT');

      // 验证数据库存储调用
      expect(mockDatabase.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO unified_strategy_results'),
        expect.any(Array)
      );
    });

    test('应该正确查询交易对分类数据', async () => {
      await v3Engine.analyzeSymbol('BTCUSDT');

      // 验证分类数据查询
      expect(mockDatabase.runQuery).toHaveBeenCalledWith(
        expect.stringContaining('symbol_categories'),
        ['BTCUSDT']
      );
    });
  });

  describe('边界条件测试', () => {
    test('应该处理极端价格情况', async () => {
      // Mock极端价格数据
      const extremeKlineData = [
        [Date.now(), "0.0001", "0.0002", "0.0001", "0.0001", "1000"],
        [Date.now(), "999999", "1000000", "999999", "999999", "1000"]
      ];

      const BinanceAPI = require('../../src/core/modules/api/BinanceAPI');
      BinanceAPI.getKlines.mockResolvedValueOnce(extremeKlineData);

      const result = await v3Engine.analyzeSymbol('TESTUSDT');

      expect(result).toBeDefined();
      // 应该有错误或警告
      expect(result.error || result.dataValid === false).toBeTruthy();
    });

    test('应该处理数据不足情况', async () => {
      // Mock数据不足
      const BinanceAPI = require('../../src/core/modules/api/BinanceAPI');
      BinanceAPI.getKlines.mockResolvedValueOnce([]);

      const result = await v3Engine.analyzeSymbol('BTCUSDT');

      expect(result.error).toBeDefined();
      expect(result.dataValid).toBe(false);
    });
  });

  describe('并发安全测试', () => {
    test('应该安全处理并发分析请求', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT'];
      
      // 并发执行多个分析
      const promises = symbols.map(symbol => 
        Promise.all([
          v3Engine.analyzeSymbol(symbol),
          ictEngine.analyzeSymbol(symbol)
        ])
      );

      const results = await Promise.all(promises);

      // 验证所有结果都正确返回
      expect(results.length).toBe(symbols.length);
      
      results.forEach((symbolResults, index) => {
        const [v3Result, ictResult] = symbolResults;
        expect(v3Result.symbol).toBe(symbols[index]);
        expect(ictResult.symbol).toBe(symbols[index]);
      });
    });
  });
});

// 集成测试
describe('策略引擎集成测试', () => {
  test('完整工作流测试 - 从数据获取到信号生成', async () => {
    const symbol = 'BTCUSDT';
    
    // 1. V3策略完整流程
    const v3Engine = new StrategyV3Engine(mockDatabase, mockCacheManager);
    const v3Result = await v3Engine.analyzeSymbol(symbol);
    
    // 2. ICT策略完整流程
    const ictEngine = new ICTStrategyEngine(mockDatabase, mockCacheManager);
    const ictResult = await ictEngine.analyzeSymbol(symbol);
    
    // 3. 结果验证
    const validator = new StrategyResultValidator();
    const v3Validation = validator.validateV3Result(v3Result);
    const ictValidation = validator.validateICTResult(ictResult);
    
    // 4. 一致性检查
    const consistencyValidation = validator.validateStrategyConsistency([v3Result], [ictResult]);
    
    // 5. 生成验证报告
    const report = validator.generateValidationReport(v3Validation, ictValidation, consistencyValidation);

    // 验证整个流程
    expect(v3Result).toBeDefined();
    expect(ictResult).toBeDefined();
    expect(report.overall.valid).toBeDefined();
    expect(report.summary.totalErrors).toBeGreaterThanOrEqual(0);
    
    console.log('📊 策略引擎集成测试报告:', {
      v3Valid: v3Validation.valid,
      ictValid: ictValidation.valid,
      consistent: consistencyValidation.consistent,
      totalErrors: report.summary.totalErrors,
      avgScore: report.summary.avgScore
    });
  });
});

// 性能基准测试
describe('策略引擎性能基准测试', () => {
  test('单个交易对分析性能基准', async () => {
    const iterations = 10;
    const symbol = 'BTCUSDT';
    const times = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      await v3Engine.analyzeSymbol(symbol);
      times.push(Date.now() - startTime);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);

    console.log('📈 V3策略性能基准:', {
      iterations,
      avgTime: `${avgTime.toFixed(2)}ms`,
      maxTime: `${maxTime}ms`,
      minTime: `${minTime}ms`
    });

    // 性能要求: 平均分析时间应在3秒内
    expect(avgTime).toBeLessThan(3000);
    expect(maxTime).toBeLessThan(5000);
  });

  test('批量分析性能基准', async () => {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'];
    const startTime = Date.now();

    const results = await Promise.all(
      symbols.map(symbol => v3Engine.analyzeSymbol(symbol))
    );

    const totalTime = Date.now() - startTime;
    const avgTimePerSymbol = totalTime / symbols.length;

    console.log('📊 批量分析性能基准:', {
      symbolCount: symbols.length,
      totalTime: `${totalTime}ms`,
      avgTimePerSymbol: `${avgTimePerSymbol.toFixed(2)}ms`
    });

    expect(results.length).toBe(symbols.length);
    expect(totalTime).toBeLessThan(15000); // 15秒内完成5个交易对
    expect(avgTimePerSymbol).toBeLessThan(3000); // 平均每个3秒内
  });
});
