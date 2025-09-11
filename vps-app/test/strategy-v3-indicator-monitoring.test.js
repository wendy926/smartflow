/**
 * V3策略指标监控单元测试
 * 测试StrategyV3Core和StrategyV3Execution中的指标监控逻辑
 */

const DataMonitor = require('../modules/monitoring/DataMonitor');
const StrategyV3Core = require('../modules/strategy/StrategyV3Core');
const StrategyV3Execution = require('../modules/strategy/StrategyV3Execution');
const BinanceAPI = require('../modules/api/BinanceAPI');

// Mock BinanceAPI
jest.mock('../modules/api/BinanceAPI');

describe('V3策略指标监控测试', () => {
  let dataMonitor;
  let strategyCore;
  let strategyExecution;

  beforeEach(() => {
    dataMonitor = new DataMonitor();
    strategyCore = new StrategyV3Core();
    strategyExecution = new StrategyV3Execution();
    
    // 设置dataMonitor引用
    strategyCore.dataMonitor = dataMonitor;
    strategyExecution.dataMonitor = dataMonitor;
    
    // 重置mock
    jest.clearAllMocks();
  });

  afterEach(() => {
    dataMonitor.reset();
  });

  describe('StrategyV3Core指标监控测试', () => {
    test('analyze4HTrend应该记录4H MA指标', async () => {
      const symbol = 'BTCUSDT';
      
      // Mock API响应
      BinanceAPI.getKlines.mockResolvedValue([
        [1640995200000, '50000', '51000', '49000', '50500', '1000'],
        [1641009600000, '50500', '51500', '49500', '51000', '1200']
      ]);

      const result = await strategyCore.analyze4HTrend(symbol);
      
      // 验证结果
      expect(result).toBeDefined();
      expect(result.trend4h).toBeDefined();
      expect(result.marketType).toBeDefined();
      
      // 验证指标记录
      const analysisLog = dataMonitor.getAnalysisLog(symbol);
      expect(analysisLog.indicators['4H MA指标']).toBeDefined();
      expect(analysisLog.indicators['4H MA指标'].data.ma20).toBeDefined();
      expect(analysisLog.indicators['4H MA指标'].data.ma50).toBeDefined();
      expect(analysisLog.indicators['4H MA指标'].data.ma200).toBeDefined();
    });

    test('analyze1HScoring应该记录1H多因子打分指标', async () => {
      const symbol = 'ETHUSDT';
      
      // Mock API响应
      BinanceAPI.getKlines.mockResolvedValue([
        [1640995200000, '3000', '3100', '2900', '3050', '500'],
        [1641000000000, '3050', '3150', '2950', '3100', '600']
      ]);
      BinanceAPI.get24hrTicker.mockResolvedValue({
        lastPrice: '3100',
        volume: '1000000'
      });
      BinanceAPI.getFundingRate.mockResolvedValue({
        fundingRate: '0.0001'
      });
      BinanceAPI.getOpenInterestHist.mockResolvedValue([
        { openInterest: '1000000', timestamp: 1640995200000 },
        { openInterest: '1050000', timestamp: 1641000000000 }
      ]);

      const result = await strategyCore.analyze1HScoring(symbol, '多头趋势');
      
      // 验证结果
      expect(result).toBeDefined();
      expect(result.score).toBeDefined();
      expect(result.allowEntry).toBeDefined();
      
      // 验证指标记录
      const analysisLog = dataMonitor.getAnalysisLog(symbol);
      expect(analysisLog.indicators['1H多因子打分']).toBeDefined();
      expect(analysisLog.indicators['1H多因子打分'].data.score).toBeDefined();
      expect(analysisLog.indicators['1H多因子打分'].data.allowEntry).toBeDefined();
      expect(analysisLog.indicators['1H多因子打分'].data.vwapDirectionConsistent).toBeDefined();
    });

    test('analyzeRangeBoundary应该记录震荡市1H边界判断指标', async () => {
      const symbol = 'ADAUSDT';
      
      // Mock API响应
      BinanceAPI.getKlines.mockResolvedValue([
        [1640995200000, '1.0', '1.1', '0.9', '1.05', '1000000'],
        [1641000000000, '1.05', '1.15', '0.95', '1.1', '1200000']
      ]);
      BinanceAPI.get24hrTicker.mockResolvedValue({
        lastPrice: '1.1',
        volume: '2000000'
      });
      BinanceAPI.getFundingRate.mockResolvedValue({
        fundingRate: '0.0001'
      });
      BinanceAPI.getOpenInterestHist.mockResolvedValue([
        { openInterest: '1000000', timestamp: 1640995200000 },
        { openInterest: '1050000', timestamp: 1641000000000 }
      ]);

      const result = await strategyCore.analyzeRangeBoundary(symbol);
      
      // 验证结果
      expect(result).toBeDefined();
      expect(result.lowerBoundaryValid).toBeDefined();
      expect(result.upperBoundaryValid).toBeDefined();
      
      // 验证指标记录
      const analysisLog = dataMonitor.getAnalysisLog(symbol);
      expect(analysisLog.indicators['震荡市1H边界判断']).toBeDefined();
      expect(analysisLog.indicators['震荡市1H边界判断'].data.lowerBoundaryValid).toBeDefined();
      expect(analysisLog.indicators['震荡市1H边界判断'].data.upperBoundaryValid).toBeDefined();
      expect(analysisLog.indicators['震荡市1H边界判断'].data.factorScore).toBeDefined();
    });

    test('指标计算失败时应该记录错误信息', async () => {
      const symbol = 'ERRORUSDT';
      
      // Mock API失败
      BinanceAPI.getKlines.mockRejectedValue(new Error('API调用失败'));

      const result = await strategyCore.analyze4HTrend(symbol);
      
      // 验证结果包含错误
      expect(result.error).toBeDefined();
      
      // 验证指标记录包含错误信息
      const analysisLog = dataMonitor.getAnalysisLog(symbol);
      expect(analysisLog.indicators['4H MA指标']).toBeDefined();
      expect(analysisLog.indicators['4H MA指标'].data.error).toBeDefined();
    });
  });

  describe('StrategyV3Execution指标监控测试', () => {
    test('analyzeRangeExecution应该记录15分钟执行指标', async () => {
      const symbol = 'DOTUSDT';
      
      // Mock API响应
      BinanceAPI.getKlines.mockResolvedValue([
        [1640995200000, '6.0', '6.5', '5.8', '6.2', '100000'],
        [1641000000000, '6.2', '6.8', '6.0', '6.5', '120000']
      ]);
      BinanceAPI.get24hrTicker.mockResolvedValue({
        lastPrice: '6.5',
        volume: '200000'
      });

      const result = await strategyExecution.analyzeRangeExecution(symbol, {
        lowerBoundaryValid: true,
        upperBoundaryValid: false,
        bb1h: {
          upper: 6.8,
          middle: 6.3,
          lower: 5.8
        }
      });
      
      // 验证结果
      expect(result).toBeDefined();
      expect(result.signal).toBeDefined();
      expect(result.mode).toBeDefined();
      
      // 验证指标记录
      const analysisLog = dataMonitor.getAnalysisLog(symbol);
      expect(analysisLog.indicators['15分钟执行']).toBeDefined();
      expect(analysisLog.indicators['15分钟执行'].data.signal).toBeDefined();
      expect(analysisLog.indicators['15分钟执行'].data.mode).toBeDefined();
      expect(analysisLog.indicators['15分钟执行'].data.atr14).toBeDefined();
    });

    test('calculateFactorScore应该被正确调用', () => {
      const factorData = {
        currentPrice: 100,
        vwap: 99,
        delta: 1,
        oi: 0.02,
        volume: 1.5,
        signalType: 'long'
      };

      const score = strategyExecution.calculateFactorScore(factorData);
      
      // 验证得分计算
      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(-4);
      expect(score).toBeLessThanOrEqual(4);
    });

    test('getMultiFactorData应该返回完整数据', async () => {
      const symbol = 'LINKUSDT';
      
      // Mock API响应
      BinanceAPI.getKlines.mockResolvedValue([
        [1640995200000, '10.0', '10.5', '9.8', '10.2', '50000'],
        [1641000000000, '10.2', '10.8', '10.0', '10.5', '60000']
      ]);
      BinanceAPI.get24hrTicker.mockResolvedValue({
        lastPrice: '10.5',
        volume: '100000'
      });

      const result = await strategyExecution.getMultiFactorData(symbol, 10.5);
      
      // 验证返回数据
      expect(result).toBeDefined();
      expect(result.vwap).toBeDefined();
      expect(result.delta).toBeDefined();
      expect(result.oi).toBeDefined();
      expect(result.volume).toBeDefined();
      expect(result.currentPrice).toBe(10.5);
    });
  });

  describe('指标监控集成测试', () => {
    test('完整的V3策略分析应该记录所有指标', async () => {
      const symbol = 'COMPUSDT';
      
      // Mock所有API调用
      BinanceAPI.getKlines.mockResolvedValue([
        [1640995200000, '50.0', '52.0', '48.0', '51.0', '10000'],
        [1641000000000, '51.0', '53.0', '49.0', '52.0', '12000']
      ]);
      BinanceAPI.get24hrTicker.mockResolvedValue({
        lastPrice: '52.0',
        volume: '20000'
      });
      BinanceAPI.getFundingRate.mockResolvedValue({
        fundingRate: '0.0001'
      });
      BinanceAPI.getOpenInterestHist.mockResolvedValue([
        { openInterest: '1000000', timestamp: 1640995200000 },
        { openInterest: '1050000', timestamp: 1641000000000 }
      ]);

      // 执行4H趋势分析
      const trendResult = await strategyCore.analyze4HTrend(symbol);
      
      // 执行1H打分分析
      const scoringResult = await strategyCore.analyze1HScoring(symbol, trendResult.trend4h);
      
      // 执行边界判断
      const boundaryResult = await strategyCore.analyzeRangeBoundary(symbol);
      
      // 执行15分钟执行分析
      const executionResult = await strategyExecution.analyzeRangeExecution(symbol, boundaryResult);

      // 验证所有指标都被记录
      const analysisLog = dataMonitor.getAnalysisLog(symbol);
      expect(analysisLog.indicators['4H MA指标']).toBeDefined();
      expect(analysisLog.indicators['1H多因子打分']).toBeDefined();
      expect(analysisLog.indicators['震荡市1H边界判断']).toBeDefined();
      expect(analysisLog.indicators['15分钟执行']).toBeDefined();
    });

    test('指标监控应该支持多个交易对', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'];
      
      // Mock API响应
      BinanceAPI.getKlines.mockResolvedValue([
        [1640995200000, '50000', '51000', '49000', '50500', '1000'],
        [1641000000000, '50500', '51500', '49500', '51000', '1200']
      ]);
      BinanceAPI.get24hrTicker.mockResolvedValue({
        lastPrice: '51000',
        volume: '2000'
      });
      BinanceAPI.getFundingRate.mockResolvedValue({
        fundingRate: '0.0001'
      });
      BinanceAPI.getOpenInterestHist.mockResolvedValue([
        { openInterest: '1000000', timestamp: 1640995200000 },
        { openInterest: '1050000', timestamp: 1641000000000 }
      ]);

      // 为每个交易对执行分析
      for (const symbol of symbols) {
        await strategyCore.analyze4HTrend(symbol);
        await strategyCore.analyze1HScoring(symbol, '多头趋势');
        await strategyCore.analyzeRangeBoundary(symbol);
      }

      // 验证所有交易对的指标都被记录
      symbols.forEach(symbol => {
        const analysisLog = dataMonitor.getAnalysisLog(symbol);
        expect(analysisLog.indicators['4H MA指标']).toBeDefined();
        expect(analysisLog.indicators['1H多因子打分']).toBeDefined();
        expect(analysisLog.indicators['震荡市1H边界判断']).toBeDefined();
      });
    });
  });

  describe('指标监控性能测试', () => {
    test('应该高效处理大量指标计算', async () => {
      const symbol = 'PERFUSDT';
      
      // Mock API响应
      BinanceAPI.getKlines.mockResolvedValue([
        [1640995200000, '100.0', '110.0', '90.0', '105.0', '1000'],
        [1641000000000, '105.0', '115.0', '95.0', '110.0', '1200']
      ]);
      BinanceAPI.get24hrTicker.mockResolvedValue({
        lastPrice: '110.0',
        volume: '2000'
      });
      BinanceAPI.getFundingRate.mockResolvedValue({
        fundingRate: '0.0001'
      });
      BinanceAPI.getOpenInterestHist.mockResolvedValue([
        { openInterest: '1000000', timestamp: 1640995200000 },
        { openInterest: '1050000', timestamp: 1641000000000 }
      ]);

      const startTime = Date.now();
      
      // 执行100次分析
      for (let i = 0; i < 100; i++) {
        await strategyCore.analyze4HTrend(symbol);
        await strategyCore.analyze1HScoring(symbol, '多头趋势');
        await strategyCore.analyzeRangeBoundary(symbol);
      }
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      // 应该在合理时间内完成（小于5秒）
      expect(executionTime).toBeLessThan(5000);
      
      // 验证指标记录
      const analysisLog = dataMonitor.getAnalysisLog(symbol);
      expect(Object.keys(analysisLog.indicators)).toHaveLength(300); // 100 * 3个指标
    });
  });
});
