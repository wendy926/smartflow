// strategy-v3-weighted-scoring.test.js - 策略V3分类权重打分单元测试

// 清理模块缓存以确保获取最新版本
delete require.cache[require.resolve('../modules/api/BinanceAPI')];
delete require.cache[require.resolve('../modules/strategy/StrategyV3Core')];
delete require.cache[require.resolve('../modules/strategy/StrategyV3Execution')];

const StrategyV3Core = require('../modules/strategy/StrategyV3Core');
const StrategyV3Execution = require('../modules/strategy/StrategyV3Execution');
const FactorWeightManager = require('../modules/strategy/FactorWeightManager');

// 模拟BinanceAPI
jest.mock('../modules/api/BinanceAPI', () => ({
  getKlines: jest.fn(),
  get24hrTicker: jest.fn(),
  getFundingRate: jest.fn(),
  getOpenInterestHist: jest.fn()
}));

const BinanceAPI = require('../modules/api/BinanceAPI');

describe('策略V3分类权重打分测试', () => {
  let strategyCore;
  let strategyExecution;
  let mockDatabase;
  let mockDataMonitor;

  beforeAll(() => {
    // 在测试环境中启动定时器
    const BinanceAPI = require('../modules/api/BinanceAPI');
    BinanceAPI.rateLimiter.startCleanup();
  });

  afterAll(() => {
    // 清理所有定时器
    try {
      const BinanceAPI = require('../modules/api/BinanceAPI');
      if (BinanceAPI.stopCleanup) {
        BinanceAPI.stopCleanup();
      }
    } catch (error) {
      // 忽略清理错误
    }
  });

  beforeEach(() => {
    // 创建模拟数据库
    mockDatabase = {
      getSymbolCategory: jest.fn(),
      getFactorWeights: jest.fn(),
      recordFactorWeights: jest.fn()
    };

    // 创建模拟数据监控器
    mockDataMonitor = {
      recordIndicator: jest.fn()
    };

    strategyCore = new StrategyV3Core(mockDatabase);
    strategyExecution = new StrategyV3Execution(mockDatabase);
    
    strategyCore.dataMonitor = mockDataMonitor;
    strategyExecution.dataMonitor = mockDataMonitor;

    // 重置模拟函数
    jest.clearAllMocks();
  });

  afterEach(() => {
    // 清理资源
    if (strategyCore) {
      strategyCore = null;
    }
    if (strategyExecution) {
      strategyExecution = null;
    }
    if (mockDataMonitor) {
      mockDataMonitor = null;
    }
    if (mockDatabase) {
      mockDatabase = null;
    }
  });

  describe('StrategyV3Core - analyze1HScoring', () => {
    test('应该使用分类权重计算1H多因子得分', async () => {
      const symbol = 'BTCUSDT';
      const trend4h = '多头趋势';

      // 模拟API响应
      const mockKlines1h = Array(50).fill().map((_, i) => [
        Date.now() - (50 - i) * 60 * 60 * 1000, // 时间戳
        '50000', // open
        '51000', // high
        '49000', // low
        '50500', // close
        '1000000' // volume
      ]);

      const mockKlines15m = Array(50).fill().map((_, i) => [
        Date.now() - (50 - i) * 15 * 60 * 1000,
        '50000',
        '51000',
        '49000',
        '50500',
        '1000000'
      ]);

      const mockKlines4h = Array(20).fill().map((_, i) => [
        Date.now() - (20 - i) * 4 * 60 * 60 * 1000,
        '50000',
        '51000',
        '49000',
        '50500',
        '1000000'
      ]);

      BinanceAPI.getKlines
        .mockResolvedValueOnce(mockKlines1h)
        .mockResolvedValueOnce(mockKlines15m)
        .mockResolvedValueOnce(mockKlines4h);

      BinanceAPI.get24hrTicker.mockResolvedValue({ lastPrice: '50500' });
      BinanceAPI.getFundingRate.mockResolvedValue([{ fundingRate: '0.0001' }]);
      BinanceAPI.getOpenInterestHist.mockResolvedValue([
        { sumOpenInterest: '1000000' },
        { sumOpenInterest: '1100000' }
      ]);

      // 模拟分类权重
      mockDatabase.getSymbolCategory.mockResolvedValue({ category: 'mainstream' });
      mockDatabase.getFactorWeights.mockResolvedValue({
        vwap_weight: 0,
        breakout_weight: 0.30,
        volume_weight: 0.20,
        oi_weight: 0.25,
        delta_weight: 0.15,
        funding_weight: 0.10
      });

      const result = await strategyCore.analyze1HScoring(symbol, trend4h);

      expect(result).toBeDefined();
      expect(result.score).toBeDefined();
      expect(result.allowEntry).toBeDefined();
      expect(result.category).toBe('mainstream');
      expect(result.weightedScores).toBeDefined();
      expect(mockDataMonitor.recordIndicator).toHaveBeenCalled();
    });

    test('应该处理VWAP方向不一致的情况', async () => {
      const symbol = 'BTCUSDT';
      const trend4h = '多头趋势';

      // 模拟价格低于VWAP的情况
      const mockKlines1h = Array(50).fill().map((_, i) => [
        Date.now() - (50 - i) * 60 * 60 * 1000,
        '50000',
        '51000',
        '49000',
        '49000', // 收盘价低于VWAP
        '1000000'
      ]);

      BinanceAPI.getKlines.mockResolvedValue(mockKlines1h);
      BinanceAPI.get24hrTicker.mockResolvedValue({ lastPrice: '49000' });
      BinanceAPI.getFundingRate.mockResolvedValue([{ fundingRate: '0.0001' }]);
      BinanceAPI.getOpenInterestHist.mockResolvedValue([
        { sumOpenInterest: '1000000' },
        { sumOpenInterest: '1100000' }
      ]);

      const result = await strategyCore.analyze1HScoring(symbol, trend4h);

      expect(result.score).toBe(0);
      expect(result.allowEntry).toBe(false);
      expect(result.vwapDirectionConsistent).toBe(false);
      expect(mockDataMonitor.recordIndicator).toHaveBeenCalled();
    });
  });

  describe('StrategyV3Execution - calculateFactorScore', () => {
    test('应该使用分类权重计算15分钟多因子得分', async () => {
      const symbol = 'ETHUSDT';
      const factorData = {
        currentPrice: 3000,
        vwap: 2950,
        delta: 100,
        oi: 50,
        volume: 200,
        signalType: 'long'
      };

      // 模拟分类权重
      mockDatabase.getSymbolCategory.mockResolvedValue({ category: 'highcap' });
      mockDatabase.getFactorWeights.mockResolvedValue({
        vwap_weight: 0.20,
        delta_weight: 0.30,
        oi_weight: 0.30,
        volume_weight: 0.20
      });

      const result = await strategyExecution.calculateFactorScore(symbol, factorData);

      expect(result).toBeDefined();
      expect(result.score).toBeDefined();
      expect(result.category).toBe('highcap');
      expect(result.factorScores).toBeDefined();
      expect(result.weights).toBeDefined();
    });

    test('应该正确处理空头信号', async () => {
      const symbol = 'ETHUSDT';
      const factorData = {
        currentPrice: 2900,
        vwap: 2950,
        delta: -100,
        oi: -50,
        volume: -200,
        signalType: 'short'
      };

      mockDatabase.getSymbolCategory.mockResolvedValue({ category: 'trending' });
      mockDatabase.getFactorWeights.mockResolvedValue({
        vwap_weight: 0.20,
        delta_weight: 0.20,
        oi_weight: 0.20,
        volume_weight: 0.40
      });

      const result = await strategyExecution.calculateFactorScore(symbol, factorData);

      expect(result.score).toBeLessThan(0); // 空头信号得分应该为负
      expect(result.category).toBe('trending');
    });

    test('应该降级到传统计算当权重计算失败时', async () => {
      const symbol = 'ETHUSDT';
      const factorData = {
        currentPrice: 3000,
        vwap: 2950,
        delta: 100,
        oi: 50,
        volume: 200,
        signalType: 'long'
      };

      // 模拟数据库错误
      mockDatabase.getSymbolCategory.mockRejectedValue(new Error('Database error'));

      const result = await strategyExecution.calculateFactorScore(symbol, factorData);

      expect(result).toBeDefined();
      expect(result.score).toBeDefined();
      expect(result.category).toBe('mainstream'); // 降级到默认分类
    });
  });

  describe('FactorWeightManager集成测试', () => {
    test('应该正确计算不同分类的权重得分', async () => {
      const factorWeightManager = new FactorWeightManager(mockDatabase);

      // 测试主流币权重
      mockDatabase.getSymbolCategory.mockResolvedValue({ category: 'mainstream' });
      mockDatabase.getFactorWeights.mockResolvedValue(null);

      const mainstreamResult = await factorWeightManager.calculateWeightedScore(
        'BTCUSDT',
        '15m_execution',
        { vwap: true, delta: true, oi: true, volume: true }
      );

      expect(mainstreamResult.category).toBe('mainstream');
      expect(mainstreamResult.score).toBeGreaterThan(0);

      // 测试热点币权重
      mockDatabase.getSymbolCategory.mockResolvedValue({ category: 'trending' });

      const trendingResult = await factorWeightManager.calculateWeightedScore(
        'PEPEUSDT',
        '15m_execution',
        { vwap: true, delta: true, oi: true, volume: true }
      );

      expect(trendingResult.category).toBe('trending');
      expect(trendingResult.score).toBeGreaterThan(0);
    });

    test('应该正确处理权重配置更新', async () => {
      const factorWeightManager = new FactorWeightManager(mockDatabase);
      mockDatabase.recordFactorWeights.mockResolvedValue({ id: 1 });

      const newWeights = {
        vwap: 0.4,
        delta: 0.3,
        oi: 0.2,
        volume: 0.1
      };

      const result = await factorWeightManager.updateWeights(
        'mainstream',
        '15m_execution',
        newWeights
      );

      expect(result).toBe(true);
      expect(mockDatabase.recordFactorWeights).toHaveBeenCalledWith({
        category: 'mainstream',
        analysisType: '15m_execution',
        vwapWeight: 0.4,
        deltaWeight: 0.3,
        oiWeight: 0.2,
        volumeWeight: 0.1,
        breakoutWeight: 0,
        fundingWeight: 0
      });
    });
  });

  describe('权重配置验证', () => {
    test('默认权重配置应该符合文档要求', () => {
      const factorWeightManager = new FactorWeightManager();

      // 验证1H打分权重
      const weights1h = factorWeightManager.getDefaultWeights()['1h_scoring'];
      expect(weights1h.mainstream.breakout).toBe(0.30);
      expect(weights1h.mainstream.volume).toBe(0.20);
      expect(weights1h.mainstream.oi).toBe(0.25);
      expect(weights1h.mainstream.delta).toBe(0.15);
      expect(weights1h.mainstream.funding).toBe(0.10);

      // 验证15分钟执行权重
      const weights15m = factorWeightManager.getDefaultWeights()['15m_execution'];
      expect(weights15m.mainstream.vwap).toBe(0.30);
      expect(weights15m.mainstream.delta).toBe(0.30);
      expect(weights15m.mainstream.oi).toBe(0.20);
      expect(weights15m.mainstream.volume).toBe(0.20);

      expect(weights15m.trending.volume).toBe(0.40); // 热点币成交量权重最高
      expect(weights15m.smallcap.volume).toBe(0.50); // 小币成交量权重最高
    });

    test('权重总和应该为1', () => {
      const factorWeightManager = new FactorWeightManager();
      const weights = factorWeightManager.getDefaultWeights();

      Object.values(weights).forEach(analysisType => {
        Object.values(analysisType).forEach(categoryWeights => {
          const sum = Object.values(categoryWeights).reduce((a, b) => a + b, 0);
          expect(sum).toBeCloseTo(1, 2);
        });
      });
    });
  });
});
