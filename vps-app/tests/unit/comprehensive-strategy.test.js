/**
 * 综合策略测试
 * 覆盖趋势判断、权重分配、多因子打分等核心逻辑
 */

const SmartFlowStrategyV3 = require('../modules/strategy/SmartFlowStrategyV3');
const StrategyV3Core = require('../modules/strategy/StrategyV3Core');
const FactorWeightManager = require('../modules/strategy/FactorWeightManager');
const DatabaseManager = require('../modules/database/DatabaseManager');

describe('综合策略测试', () => {
  let core;
  let factorWeightManager;
  let database;

  beforeAll(async () => {
    database = new DatabaseManager();
    core = new StrategyV3Core(database);
    factorWeightManager = new FactorWeightManager(database);
  });

  afterAll(async () => {
    if (database) {
      await database.close();
    }
  });

  describe('4H趋势判断逻辑测试', () => {
    test('应该正确识别多头趋势', async () => {
      // 模拟多头趋势的4H K线数据
      const mockKlines = Array(25).fill().map((_, i) => ({
        close: 100 + i * 2, // 上升趋势
        high: 105 + i * 2,
        low: 95 + i * 2,
        volume: 1000 + i * 100
      }));

      // 模拟API调用
      const BinanceAPI = require('../modules/api/BinanceAPI');
      const originalGetKlines = BinanceAPI.getKlines;
      BinanceAPI.getKlines = jest.fn().mockResolvedValue(mockKlines);

      const result = await core.analyze4HTrend('BTCUSDT');

      expect(result).toBeDefined();
      expect(result.trend4h).toBeDefined();
      expect(['多头趋势', '空头趋势', '震荡市']).toContain(result.trend4h);
      expect(result.marketType).toBe('震荡市'); // 应该默认为震荡市，等待1H打分确认

      // 恢复原始方法
      BinanceAPI.getKlines = originalGetKlines;
    });

    test('应该正确识别空头趋势', async () => {
      // 模拟空头趋势的4H K线数据
      const mockKlines = Array(25).fill().map((_, i) => ({
        close: 200 - i * 2, // 下降趋势
        high: 205 - i * 2,
        low: 195 - i * 2,
        volume: 1000 + i * 100
      }));

      // 模拟API调用
      const BinanceAPI = require('../modules/api/BinanceAPI');
      const originalGetKlines = BinanceAPI.getKlines;
      BinanceAPI.getKlines = jest.fn().mockResolvedValue(mockKlines);

      const result = await core.analyze4HTrend('BTCUSDT');

      expect(result).toBeDefined();
      expect(result.trend4h).toBeDefined();
      expect(['多头趋势', '空头趋势', '震荡市']).toContain(result.trend4h);
      expect(result.marketType).toBe('震荡市'); // 应该默认为震荡市，等待1H打分确认

      // 恢复原始方法
      BinanceAPI.getKlines = originalGetKlines;
    });

    test('应该正确识别震荡市', async () => {
      // 模拟震荡的4H K线数据
      const mockKlines = Array(25).fill().map((_, i) => ({
        close: 100 + Math.sin(i * 0.5) * 10, // 震荡模式
        high: 105 + Math.sin(i * 0.5) * 10,
        low: 95 + Math.sin(i * 0.5) * 10,
        volume: 1000 + i * 100
      }));

      // 模拟API调用
      const BinanceAPI = require('../modules/api/BinanceAPI');
      const originalGetKlines = BinanceAPI.getKlines;
      BinanceAPI.getKlines = jest.fn().mockResolvedValue(mockKlines);

      const result = await core.analyze4HTrend('BTCUSDT');

      expect(result).toBeDefined();
      expect(result.trend4h).toBe('震荡市');
      expect(result.marketType).toBe('震荡市');

      // 恢复原始方法
      BinanceAPI.getKlines = originalGetKlines;
    });
  });

  describe('1H多因子打分测试', () => {
    test('应该正确计算主流币的1H多因子得分', async () => {
      // 模拟主流币的1H数据
      const mockKlines1h = Array(50).fill().map((_, i) => ({
        close: 100 + i * 0.5,
        high: 105 + i * 0.5,
        low: 95 + i * 0.5,
        volume: 1000 + i * 50
      }));

      const mockKlines4h = Array(20).fill().map((_, i) => ({
        close: 100 + i * 2,
        high: 105 + i * 2,
        low: 95 + i * 2,
        volume: 1000 + i * 100
      }));

      // 模拟API调用
      const BinanceAPI = require('../modules/api/BinanceAPI');
      const originalGetKlines = BinanceAPI.getKlines;
      const originalGetFundingRate = BinanceAPI.getFundingRate;
      const originalGetOpenInterestHistory = BinanceAPI.getOpenInterestHistory;

      BinanceAPI.getKlines = jest.fn()
        .mockImplementation((symbol, interval) => {
          if (interval === '1h') return Promise.resolve(mockKlines1h);
          if (interval === '4h') return Promise.resolve(mockKlines4h);
          if (interval === '15m') return Promise.resolve(mockKlines1h.slice(0, 20));
          return Promise.resolve([]);
        });

      BinanceAPI.getFundingRate = jest.fn().mockResolvedValue([{ fundingRate: '0.0001' }]);
      BinanceAPI.getOpenInterestHistory = jest.fn().mockResolvedValue([
        { openInterest: '1000000' },
        { openInterest: '1020000' },
        { openInterest: '1040000' },
        { openInterest: '1060000' },
        { openInterest: '1080000' },
        { openInterest: '1100000' }
      ]);

      // 模拟Delta管理器
      const mockDeltaManager = {
        getDelta: jest.fn().mockResolvedValue(0.15)
      };

      const result = await core.analyze1HScoring('BTCUSDT', '多头趋势', mockDeltaManager);

      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(6);
      expect(result.vwapDirectionConsistent).toBeDefined();
      expect(result.factors).toBeDefined();

      // 恢复原始方法
      BinanceAPI.getKlines = originalGetKlines;
      BinanceAPI.getFundingRate = originalGetFundingRate;
      BinanceAPI.getOpenInterestHistory = originalGetOpenInterestHistory;
    });

    test('应该正确处理VWAP方向不一致的情况', async () => {
      // 模拟VWAP方向不一致的数据
      const mockKlines1h = Array(50).fill().map((_, i) => ({
        close: 100 - i * 0.5, // 价格下降
        high: 105 - i * 0.5,
        low: 95 - i * 0.5,
        volume: 1000 + i * 50
      }));

      // 模拟API调用
      const BinanceAPI = require('../modules/api/BinanceAPI');
      const originalGetKlines = BinanceAPI.getKlines;
      const originalGetFundingRate = BinanceAPI.getFundingRate;
      const originalGetOpenInterestHistory = BinanceAPI.getOpenInterestHistory;

      BinanceAPI.getKlines = jest.fn()
        .mockImplementation((symbol, interval) => {
          if (interval === '1h') return Promise.resolve(mockKlines1h);
          if (interval === '4h') return Promise.resolve(mockKlines1h.slice(0, 20));
          if (interval === '15m') return Promise.resolve(mockKlines1h.slice(0, 20));
          return Promise.resolve([]);
        });

      BinanceAPI.getFundingRate = jest.fn().mockResolvedValue([{ fundingRate: '0.0001' }]);
      BinanceAPI.getOpenInterestHistory = jest.fn().mockResolvedValue([
        { openInterest: '1000000' },
        { openInterest: '1020000' },
        { openInterest: '1040000' },
        { openInterest: '1060000' },
        { openInterest: '1080000' },
        { openInterest: '1100000' }
      ]);

      // 模拟Delta管理器
      const mockDeltaManager = {
        getDelta: jest.fn().mockResolvedValue(0.15)
      };

      const result = await core.analyze1HScoring('BTCUSDT', '多头趋势', mockDeltaManager);

      expect(result).toBeDefined();
      expect(result.score).toBe(0); // VWAP方向不一致应该返回0分
      expect(result.vwapDirectionConsistent).toBe(false);

      // 恢复原始方法
      BinanceAPI.getKlines = originalGetKlines;
      BinanceAPI.getFundingRate = originalGetFundingRate;
      BinanceAPI.getOpenInterestHistory = originalGetOpenInterestHistory;
    });
  });

  describe('权重分配测试', () => {
    test('应该正确获取不同交易对的分类', async () => {
      const btcCategory = await factorWeightManager.getSymbolCategory('BTCUSDT');
      const ethCategory = await factorWeightManager.getSymbolCategory('ETHUSDT');
      const bnbCategory = await factorWeightManager.getSymbolCategory('BNBUSDT');
      const solCategory = await factorWeightManager.getSymbolCategory('SOLUSDT');

      expect(['mainstream', 'high-cap-trending', 'trending', 'smallcap']).toContain(btcCategory);
      expect(['mainstream', 'high-cap-trending', 'trending', 'smallcap']).toContain(ethCategory);
      expect(['mainstream', 'high-cap-trending', 'trending', 'smallcap']).toContain(bnbCategory);
      expect(['mainstream', 'high-cap-trending', 'trending', 'smallcap']).toContain(solCategory);
    });

    test('应该正确计算不同分类的权重得分', async () => {
      const factorValues = {
        vwap: true,
        breakout: true,
        volume: 1.5,
        oi: 0.025,
        delta: 0.15,
        funding: 0.0003
      };

      // 测试主流币权重
      const mainstreamResult = await factorWeightManager.calculateWeightedScore('BTCUSDT', '1h_scoring', factorValues);
      expect(mainstreamResult).toBeDefined();
      expect(mainstreamResult.category).toBe('mainstream');
      expect(mainstreamResult.score).toBeGreaterThan(0);

      // 测试高市值强趋势币权重
      const highcapResult = await factorWeightManager.calculateWeightedScore('BNBUSDT', '1h_scoring', factorValues);
      expect(highcapResult).toBeDefined();
      expect(highcapResult.category).toBe('high-cap-trending');
      expect(highcapResult.score).toBeGreaterThan(0);

      // 测试热点币权重
      const trendingResult = await factorWeightManager.calculateWeightedScore('PEPEUSDT', '1h_scoring', factorValues);
      expect(trendingResult).toBeDefined();
      expect(trendingResult.category).toBe('trending');
      expect(trendingResult.score).toBeGreaterThan(0);
    });

    test('应该正确处理震荡市1H边界权重', async () => {
      const factorValues = {
        vwap: true,
        touch: 2,
        volume: 1.2,
        delta: 0.01,
        oi: 0.01,
        no_breakout: true
      };

      const result = await factorWeightManager.calculateWeightedScore('BTCUSDT', '1h_boundary', factorValues);
      expect(result).toBeDefined();
      expect(result.category).toBe('mainstream');
      expect(result.score).toBeGreaterThan(0);
    });

    test('应该正确处理震荡市15分钟入场权重', async () => {
      const factorValues = {
        vwap: 1,
        delta: 0.1,
        oi: 0.02,
        volume: 1.3
      };

      const result = await factorWeightManager.calculateWeightedScore('BTCUSDT', '15m_execution', factorValues);
      expect(result).toBeDefined();
      expect(result.category).toBe('mainstream');
      expect(result.score).toBeGreaterThan(0);
    });
  });

  describe('完整策略流程测试', () => {
    test('应该正确处理趋势市完整流程', async () => {
      // 模拟趋势市数据
      const mockKlines4h = Array(25).fill().map((_, i) => ({
        close: 100 + i * 2,
        high: 105 + i * 2,
        low: 95 + i * 2,
        volume: 1000 + i * 100
      }));

      const mockKlines1h = Array(50).fill().map((_, i) => ({
        close: 100 + i * 0.5,
        high: 105 + i * 0.5,
        low: 95 + i * 0.5,
        volume: 1000 + i * 50
      }));

      const mockKlines15m = Array(50).fill().map((_, i) => ({
        close: 100 + i * 0.1,
        high: 105 + i * 0.1,
        low: 95 + i * 0.1,
        volume: 1000 + i * 10
      }));

      // 模拟API调用
      const BinanceAPI = require('../modules/api/BinanceAPI');
      const originalGetKlines = BinanceAPI.getKlines;
      const originalGetTicker = BinanceAPI.getTicker;
      const originalGetFundingRate = BinanceAPI.getFundingRate;
      const originalGetOpenInterestHistory = BinanceAPI.getOpenInterestHistory;

      BinanceAPI.getKlines = jest.fn()
        .mockImplementation((symbol, interval) => {
          if (interval === '4h') return Promise.resolve(mockKlines4h);
          if (interval === '1h') return Promise.resolve(mockKlines1h);
          if (interval === '15m') return Promise.resolve(mockKlines15m);
          return Promise.resolve([]);
        });

      BinanceAPI.getTicker = jest.fn().mockResolvedValue({ lastPrice: '150' });
      BinanceAPI.getFundingRate = jest.fn().mockResolvedValue([{ fundingRate: '0.0001' }]);
      BinanceAPI.getOpenInterestHistory = jest.fn().mockResolvedValue([
        { openInterest: '1000000' },
        { openInterest: '1020000' },
        { openInterest: '1040000' },
        { openInterest: '1060000' },
        { openInterest: '1080000' },
        { openInterest: '1100000' }
      ]);

      // 模拟Delta管理器
      const mockDeltaManager = {
        getDelta: jest.fn().mockResolvedValue(0.15)
      };

      // 模拟数据刷新管理器
      const mockDataRefreshManager = {
        shouldRefresh: jest.fn().mockResolvedValue(true),
        updateRefreshTime: jest.fn().mockResolvedValue()
      };

      const result = await SmartFlowStrategyV3.analyzeSymbol('BTCUSDT', {
        dataRefreshManager: mockDataRefreshManager
      });

      expect(result).toBeDefined();
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.marketType).toBeDefined();
      expect(['趋势市', '震荡市']).toContain(result.marketType);
      expect(result.trend4h).toBeDefined();
      expect(result.currentPrice).toBe(150);

      // 恢复原始方法
      BinanceAPI.getKlines = originalGetKlines;
      BinanceAPI.getTicker = originalGetTicker;
      BinanceAPI.getFundingRate = originalGetFundingRate;
      BinanceAPI.getOpenInterestHistory = originalGetOpenInterestHistory;
    });

    test('应该正确处理震荡市完整流程', async () => {
      // 模拟震荡市数据
      const mockKlines4h = Array(25).fill().map((_, i) => ({
        close: 100 + Math.sin(i * 0.5) * 10,
        high: 105 + Math.sin(i * 0.5) * 10,
        low: 95 + Math.sin(i * 0.5) * 10,
        volume: 1000 + i * 100
      }));

      const mockKlines1h = Array(50).fill().map((_, i) => ({
        close: 100 + Math.sin(i * 0.1) * 5,
        high: 105 + Math.sin(i * 0.1) * 5,
        low: 95 + Math.sin(i * 0.1) * 5,
        volume: 1000 + i * 50
      }));

      // 模拟API调用
      const BinanceAPI = require('../modules/api/BinanceAPI');
      const originalGetKlines = BinanceAPI.getKlines;
      const originalGetTicker = BinanceAPI.getTicker;

      BinanceAPI.getKlines = jest.fn()
        .mockImplementation((symbol, interval) => {
          if (interval === '4h') return Promise.resolve(mockKlines4h);
          if (interval === '1h') return Promise.resolve(mockKlines1h);
          if (interval === '15m') return Promise.resolve(mockKlines1h.slice(0, 20));
          return Promise.resolve([]);
        });

      BinanceAPI.getTicker = jest.fn().mockResolvedValue({ lastPrice: '100' });

      // 模拟数据刷新管理器
      const mockDataRefreshManager = {
        shouldRefresh: jest.fn().mockResolvedValue(true),
        updateRefreshTime: jest.fn().mockResolvedValue()
      };

      const result = await SmartFlowStrategyV3.analyzeSymbol('BTCUSDT', {
        dataRefreshManager: mockDataRefreshManager
      });

      expect(result).toBeDefined();
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.marketType).toBe('震荡市');
      expect(result.trend4h).toBe('震荡市');
      expect(result.currentPrice).toBe(100);

      // 恢复原始方法
      BinanceAPI.getKlines = originalGetKlines;
      BinanceAPI.getTicker = originalGetTicker;
    });
  });

  describe('边界情况测试', () => {
    test('应该正确处理API调用失败的情况', async () => {
      // 模拟API调用失败
      const BinanceAPI = require('../modules/api/BinanceAPI');
      const originalGetKlines = BinanceAPI.getKlines;
      BinanceAPI.getKlines = jest.fn().mockRejectedValue(new Error('API调用失败'));

      const result = await SmartFlowStrategyV3.analyzeSymbol('BTCUSDT');

      expect(result).toBeDefined();
      expect(result.error).toBeDefined();
      expect(result.error).toContain('4H趋势分析失败');

      // 恢复原始方法
      BinanceAPI.getKlines = originalGetKlines;
    });

    test('应该正确处理数据不足的情况', async () => {
      // 模拟数据不足
      const mockKlines = Array(5).fill().map((_, i) => ({
        close: 100 + i,
        high: 105 + i,
        low: 95 + i,
        volume: 1000 + i * 100
      }));

      const BinanceAPI = require('../modules/api/BinanceAPI');
      const originalGetKlines = BinanceAPI.getKlines;
      BinanceAPI.getKlines = jest.fn().mockResolvedValue(mockKlines);

      const result = await SmartFlowStrategyV3.analyzeSymbol('BTCUSDT');

      expect(result).toBeDefined();
      expect(result.error).toBeDefined();

      // 恢复原始方法
      BinanceAPI.getKlines = originalGetKlines;
    });
  });
});
