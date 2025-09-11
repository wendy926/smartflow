/**
 * Delta集成测试
 * 测试Delta实时管理器与策略模块的集成
 */

const DeltaRealTimeManager = require('../modules/data/DeltaRealTimeManager');
const StrategyV3Core = require('../modules/strategy/StrategyV3Core');
const StrategyV3Execution = require('../modules/strategy/StrategyV3Execution');

// Mock BinanceAPI
jest.mock('../modules/api/BinanceAPI', () => ({
  getKlines: jest.fn(),
  get24hrTicker: jest.fn(),
  getOpenInterestHist: jest.fn()
}));

const BinanceAPI = require('../modules/api/BinanceAPI');

describe('Delta集成测试', () => {
  let deltaManager;
  let strategyCore;
  let strategyExecution;

  beforeEach(() => {
    deltaManager = new DeltaRealTimeManager();
    strategyCore = new StrategyV3Core();
    strategyExecution = new StrategyV3Execution();

    // 设置dataMonitor引用
    strategyCore.dataMonitor = { recordIndicator: jest.fn() };
    strategyExecution.dataMonitor = { recordIndicator: jest.fn() };

    // 重置mock
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (deltaManager) {
      deltaManager.stop();
    }
  });

  describe('StrategyV3Core Delta集成测试', () => {
    test('analyze1HScoring应该使用实时Delta数据', async () => {
      const symbol = 'BTCUSDT';

      // 模拟Delta数据
      const deltaData = {
        delta: 0.5,
        lastUpdate: Date.now()
      };
      deltaManager.deltaData.set(symbol, {
        deltaBuy: 100,
        deltaSell: 50,
        lastUpdate: Date.now(),
        delta: 0.5,
        imbalance: 0.5,
        delta15m: 0.3,
        delta1h: 0.5
      });

      // Mock API调用
      BinanceAPI.getKlines.mockResolvedValue([
        [Date.now(), '50000', '51000', '49000', '50500', '1000'],
        [Date.now() - 3600000, '49000', '50000', '48000', '49500', '800']
      ]);
      BinanceAPI.get24hrTicker.mockResolvedValue({ lastPrice: '50500' });
      BinanceAPI.getOpenInterestHist.mockResolvedValue([
        { sumOpenInterest: '1000000' },
        { sumOpenInterest: '1100000' }
      ]);

      const result = await strategyCore.analyze1HScoring(symbol, '多头趋势', deltaManager);

      expect(result).toBeDefined();
      expect(result.score).toBeDefined();
      expect(result.allowEntry).toBeDefined();
    });

    test('analyzeRangeBoundary应该使用实时Delta数据', async () => {
      const symbol = 'BTCUSDT';

      // 模拟Delta数据
      deltaManager.deltaData.set(symbol, {
        deltaBuy: 100,
        deltaSell: 50,
        lastUpdate: Date.now(),
        delta: 0.5,
        imbalance: 0.5,
        delta15m: 0.3,
        delta1h: 0.5
      });

      // Mock API调用
      BinanceAPI.getKlines.mockResolvedValue([
        [Date.now(), '50000', '51000', '49000', '50500', '1000'],
        [Date.now() - 3600000, '49000', '50000', '48000', '49500', '800']
      ]);
      BinanceAPI.getOpenInterestHist.mockResolvedValue([
        { sumOpenInterest: '1000000' },
        { sumOpenInterest: '1100000' }
      ]);

      const result = await strategyCore.analyzeRangeBoundary(symbol, deltaManager);

      expect(result).toBeDefined();
      expect(result.isRange).toBeDefined();
      expect(result.boundary).toBeDefined();
    });
  });

  describe('StrategyV3Execution Delta集成测试', () => {
    test('getMultiFactorData应该使用实时Delta数据', async () => {
      const symbol = 'BTCUSDT';

      // 模拟Delta数据
      deltaManager.deltaData.set(symbol, {
        deltaBuy: 100,
        deltaSell: 50,
        lastUpdate: Date.now(),
        delta: 0.5,
        imbalance: 0.5,
        delta15m: 0.3,
        delta1h: 0.5
      });

      // Mock API调用
      BinanceAPI.getKlines.mockResolvedValue([
        [Date.now(), '50000', '51000', '49000', '50500', '1000'],
        [Date.now() - 900000, '49000', '50000', '48000', '49500', '800']
      ]);
      BinanceAPI.get24hrTicker.mockResolvedValue({ lastPrice: '50500' });
      BinanceAPI.getOpenInterestHist.mockResolvedValue([
        { sumOpenInterest: '1000000' },
        { sumOpenInterest: '1100000' }
      ]);

      const result = await strategyExecution.getMultiFactorData(symbol, 50500, deltaManager);

      expect(result).toBeDefined();
      expect(result.delta).toBe(0.3); // 15分钟Delta
    });

    test('analyzeRangeExecution应该使用实时Delta数据', async () => {
      const symbol = 'BTCUSDT';

      // 模拟Delta数据
      deltaManager.deltaData.set(symbol, {
        deltaBuy: 100,
        deltaSell: 50,
        lastUpdate: Date.now(),
        delta: 0.5,
        imbalance: 0.5,
        delta15m: 0.3,
        delta1h: 0.5
      });

      const rangeResult = {
        lowerBoundaryValid: true,
        upperBoundaryValid: true,
        rangeLow: 49000,
        rangeHigh: 51000
      };

      const candles15m = Array.from({ length: 20 }, (_, i) => ({
        open: 50000 + i * 10,
        high: 50100 + i * 10,
        low: 49900 + i * 10,
        close: 50050 + i * 10,
        volume: 1000 + i * 10
      }));

      const candles1h = Array.from({ length: 20 }, (_, i) => ({
        open: 50000 + i * 50,
        high: 50100 + i * 50,
        low: 49900 + i * 50,
        close: 50050 + i * 50,
        volume: 10000 + i * 100
      }));

      // Mock API调用
      BinanceAPI.getKlines.mockResolvedValue([
        [Date.now(), '50000', '51000', '49000', '50500', '1000'],
        [Date.now() - 900000, '49000', '50000', '48000', '49500', '800']
      ]);
      BinanceAPI.get24hrTicker.mockResolvedValue({ lastPrice: '50500' });
      BinanceAPI.getOpenInterestHist.mockResolvedValue([
        { sumOpenInterest: '1000000' },
        { sumOpenInterest: '1100000' }
      ]);

      const result = await strategyExecution.analyzeRangeExecution(
        symbol,
        rangeResult,
        candles15m,
        candles1h,
        deltaManager
      );

      expect(result).toBeDefined();
    });
  });

  describe('Delta降级测试', () => {
    test('当Delta管理器不可用时应该降级到传统计算', async () => {
      const symbol = 'BTCUSDT';

      // Mock API调用
      BinanceAPI.getKlines.mockResolvedValue([
        [Date.now(), '50000', '51000', '49000', '50500', '1000'],
        [Date.now() - 3600000, '49000', '50000', '48000', '49500', '800']
      ]);
      BinanceAPI.get24hrTicker.mockResolvedValue({ lastPrice: '50500' });
      BinanceAPI.getOpenInterestHist.mockResolvedValue([
        { sumOpenInterest: '1000000' },
        { sumOpenInterest: '1100000' }
      ]);

      // 不传入deltaManager，应该降级到传统计算
      const result = await strategyCore.analyze1HScoring(symbol, '多头趋势');

      expect(result).toBeDefined();
      expect(result.score).toBeDefined();
    });
  });

  describe('Delta数据一致性测试', () => {
    test('不同时间级别的Delta数据应该保持一致', async () => {
      const symbol = 'BTCUSDT';

      // 模拟Delta数据
      deltaManager.deltaData.set(symbol, {
        deltaBuy: 100,
        deltaSell: 50,
        lastUpdate: Date.now(),
        delta: 0.5,
        imbalance: 0.5,
        delta15m: 0.3,
        delta1h: 0.5
      });

      const delta15m = deltaManager.getDeltaData(symbol, '15m');
      const delta1h = deltaManager.getDeltaData(symbol, '1h');
      const realtime = deltaManager.getDeltaData(symbol, 'realtime');

      expect(delta15m.delta).toBe(0.3);
      expect(delta1h.delta).toBe(0.5);
      expect(realtime.imbalance).toBe(0.5);
    });
  });

  describe('性能测试', () => {
    test('应该高效处理多个交易对的Delta计算', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'LINKUSDT'];

      await deltaManager.start(symbols);

      const startTime = Date.now();

      // 模拟处理多个交易对
      for (const symbol of symbols) {
        const deltaData = deltaManager.getDeltaData(symbol, '15m');
        expect(deltaData).toBeDefined();
      }

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(50); // 应该在50ms内完成

      deltaManager.stop();
    });
  });
});
