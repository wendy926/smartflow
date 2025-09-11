/**
 * VWAP逻辑的单元测试
 * 测试VWAP时间级别和方向一致性逻辑
 */

const StrategyV3Core = require('../modules/strategy/StrategyV3Core');
const StrategyV3Execution = require('../modules/strategy/StrategyV3Execution');

// Mock BinanceAPI
jest.mock('../modules/api/BinanceAPI', () => ({
  getKlines: jest.fn(),
  get24hrTicker: jest.fn(),
  getFundingRate: jest.fn(),
  getOpenInterestHist: jest.fn()
}));

const BinanceAPI = require('../modules/api/BinanceAPI');

describe('VWAP逻辑测试', () => {
  let strategyCore;
  let strategyExecution;

  beforeEach(() => {
    strategyCore = new StrategyV3Core();
    strategyExecution = new StrategyV3Execution();
    jest.clearAllMocks();
  });

  describe('VWAP时间级别逻辑', () => {
    test('趋势市1H多因子打分应该使用1H VWAP', async () => {
      const mockKlines1h = Array(50).fill().map((_, i) => [
        Date.now() - (50 - i) * 3600000, // 时间戳
        '100', // open
        '105', // high
        '95',  // low
        '102', // close
        '1000' // volume
      ]);

      const mockKlines15m = Array(50).fill().map((_, i) => [
        Date.now() - (50 - i) * 900000, // 时间戳
        '100', // open
        '105', // high
        '95',  // low
        '102', // close
        '1000' // volume
      ]);

      BinanceAPI.getKlines
        .mockResolvedValueOnce(mockKlines1h)  // 1H数据
        .mockResolvedValueOnce(mockKlines15m) // 15m数据
        .mockResolvedValueOnce({ lastPrice: '102' })
        .mockResolvedValueOnce({ fundingRate: '0.01' })
        .mockResolvedValueOnce([]);

      const result = await strategyCore.analyze1HScoring('BTCUSDT', '多头趋势');

      // 验证调用了1H数据
      expect(BinanceAPI.getKlines).toHaveBeenCalledWith('BTCUSDT', '1h', 50);
      
      // 验证VWAP计算使用了1H数据
      expect(result.vwap).toBeDefined();
      expect(result.vwap).toBeGreaterThan(0);
    });

    test('震荡市1H边界判断应该使用1H VWAP', async () => {
      const mockKlines1h = Array(50).fill().map((_, i) => [
        Date.now() - (50 - i) * 3600000, // 时间戳
        '100', // open
        '105', // high
        '95',  // low
        '102', // close
        '1000' // volume
      ]);

      BinanceAPI.getKlines.mockResolvedValueOnce(mockKlines1h);
      BinanceAPI.getOpenInterestHist.mockResolvedValueOnce([]);

      const result = await strategyCore.analyzeRangeBoundary('BTCUSDT');

      // 验证调用了1H数据
      expect(BinanceAPI.getKlines).toHaveBeenCalledWith('BTCUSDT', '1h', 50);
      
      // 验证结果包含VWAP相关数据
      expect(result).toBeDefined();
    });

    test('震荡市15分钟执行应该使用15m VWAP', async () => {
      const mockKlines15m = Array(50).fill().map((_, i) => [
        Date.now() - (50 - i) * 900000, // 时间戳
        '100', // open
        '105', // high
        '95',  // low
        '102', // close
        '1000' // volume
      ]);

      BinanceAPI.getKlines.mockResolvedValue(mockKlines15m);
      BinanceAPI.get24hrTicker.mockResolvedValue({ lastPrice: '102' });

      const rangeResult = {
        lowerBoundaryValid: true,
        upperBoundaryValid: true,
        bb1h: { upper: 110, lower: 90 }
      };

      const candles15m = mockKlines15m.map(k => ({
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));

      const result = await strategyExecution.analyzeRangeExecution('BTCUSDT', rangeResult, candles15m, null);

      // 验证调用了15m数据
      expect(BinanceAPI.getKlines).toHaveBeenCalledWith('BTCUSDT', '15m', 20);
      
      // 验证结果包含多因子数据
      expect(result).toBeDefined();
    });
  });

  describe('VWAP方向一致性逻辑', () => {
    test('趋势市VWAP方向一致性必须满足', async () => {
      const mockKlines1h = Array(50).fill().map((_, i) => [
        Date.now() - (50 - i) * 3600000, // 时间戳
        '100', // open
        '105', // high
        '95',  // low
        '102', // close
        '1000' // volume
      ]);

      const mockKlines15m = Array(50).fill().map((_, i) => [
        Date.now() - (50 - i) * 900000, // 时间戳
        '100', // open
        '105', // high
        '95',  // low
        '102', // close
        '1000' // volume
      ]);

      BinanceAPI.getKlines
        .mockResolvedValueOnce(mockKlines1h)  // 1H数据
        .mockResolvedValueOnce(mockKlines15m) // 15m数据
        .mockResolvedValueOnce({ lastPrice: '102' })
        .mockResolvedValueOnce({ fundingRate: '0.01' })
        .mockResolvedValueOnce([]);

      const result = await strategyCore.analyze1HScoring('BTCUSDT', '多头趋势');

      // 验证VWAP方向一致性检查
      expect(result.vwapDirectionConsistent).toBeDefined();
      
      // 如果VWAP方向不一致，应该返回0分
      if (!result.vwapDirectionConsistent) {
        expect(result.score).toBe(0);
        expect(result.allowEntry).toBe(false);
      }
    });

    test('震荡市VWAP作为加分因子', () => {
      // 测试VWAP因子计算
      const factors = {
        currentPrice: 100,
        vwap: 95,
        delta: 0,
        oi: 0,
        volume: 0,
        signalType: 'long'
      };

      const score = strategyExecution.calculateFactorScore(factors);
      
      // 当前价格高于VWAP应该得+1分
      expect(score).toBe(1);
    });

    test('震荡市VWAP因子：价格低于VWAP时扣分', () => {
      const factors = {
        currentPrice: 95,
        vwap: 100,
        delta: 0,
        oi: 0,
        volume: 0,
        signalType: 'long'
      };

      const score = strategyExecution.calculateFactorScore(factors);
      
      // 当前价格低于VWAP应该得-1分
      expect(score).toBe(-1);
    });
  });

  describe('VWAP计算准确性', () => {
    test('VWAP计算应该使用典型价格和成交量', () => {
      const mockKlines = [
        [Date.now(), '100', '105', '95', '102', '1000'],  // 典型价格 = (105+95+102)/3 = 100.67
        [Date.now(), '102', '108', '98', '105', '2000'],   // 典型价格 = (108+98+105)/3 = 103.67
      ];

      BinanceAPI.getKlines.mockResolvedValue(mockKlines);

      return strategyExecution.getVWAP('BTCUSDT', '15m').then(vwap => {
        // 验证VWAP计算
        // 预期VWAP = (100.67*1000 + 103.67*2000) / (1000+2000) = 307.01/3000 = 102.34
        expect(vwap).toBeCloseTo(102.34, 2);
      });
    });

    test('VWAP计算应该处理空数据', () => {
      BinanceAPI.getKlines.mockResolvedValue([]);

      return strategyExecution.getVWAP('BTCUSDT', '15m').then(vwap => {
        expect(vwap).toBe(0);
      });
    });

    test('VWAP计算应该处理数据不足', () => {
      const mockKlines = Array(10).fill().map((_, i) => [
        Date.now() - (10 - i) * 900000,
        '100', '105', '95', '102', '1000'
      ]);

      BinanceAPI.getKlines.mockResolvedValue(mockKlines);

      return strategyExecution.getVWAP('BTCUSDT', '15m').then(vwap => {
        expect(vwap).toBe(0); // 数据不足20根K线
      });
    });
  });

  describe('多因子数据获取', () => {
    test('getMultiFactorData应该返回当前价格和VWAP', async () => {
      const mockKlines15m = Array(20).fill().map((_, i) => [
        Date.now() - (20 - i) * 900000,
        '100', '105', '95', '102', '1000'
      ]);

      BinanceAPI.getKlines.mockResolvedValue(mockKlines15m);
      BinanceAPI.get24hrTicker.mockResolvedValue({ lastPrice: '102.5' });

      const result = await strategyExecution.getMultiFactorData('BTCUSDT', 102.5);

      expect(result).toHaveProperty('currentPrice', 102.5);
      expect(result).toHaveProperty('vwap');
      expect(result).toHaveProperty('delta');
      expect(result).toHaveProperty('oi');
      expect(result).toHaveProperty('volume');
    });

    test('getMultiFactorData应该处理错误', async () => {
      BinanceAPI.getKlines.mockRejectedValue(new Error('API错误'));
      BinanceAPI.get24hrTicker.mockRejectedValue(new Error('API错误'));

      const result = await strategyExecution.getMultiFactorData('BTCUSDT');

      expect(result.currentPrice).toBe(0);
      expect(result.vwap).toBe(0);
      expect(result.delta).toBe(0);
      expect(result.oi).toBe(0);
      expect(result.volume).toBe(0);
    });
  });
});
