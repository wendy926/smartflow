// 策略执行模块单元测试
const StrategyV3Execution = require('../modules/strategy/StrategyV3Execution');

describe('StrategyV3Execution', () => {
  let strategyExecution;

  beforeEach(() => {
    strategyExecution = new StrategyV3Execution();
  });

  describe('formatExecution', () => {
    test('应该正确处理NONE信号', () => {
      const result = { signal: 'NONE', mode: 'NONE' };
      const formatted = strategyExecution.formatExecution(result);
      expect(formatted).toBeNull();
    });

    test('应该正确处理空信号', () => {
      const result = { signal: null, mode: 'NONE' };
      const formatted = strategyExecution.formatExecution(result);
      expect(formatted).toBeNull();
    });

    test('应该正确处理多头信号', () => {
      const result = { signal: 'BUY', mode: '假突破反手' };
      const formatted = strategyExecution.formatExecution(result);
      expect(formatted).toBe('做多_假突破反手');
    });

    test('应该正确处理空头信号', () => {
      const result = { signal: 'SHORT', mode: '假突破反手' };
      const formatted = strategyExecution.formatExecution(result);
      expect(formatted).toBe('做空_假突破反手');
    });

    test('应该处理undefined mode', () => {
      const result = { signal: 'SHORT', mode: undefined };
      const formatted = strategyExecution.formatExecution(result);
      expect(formatted).toBe('做空_NONE');
    });

    test('应该处理LONG信号', () => {
      const result = { signal: 'LONG', mode: '区间多头' };
      const formatted = strategyExecution.formatExecution(result);
      expect(formatted).toBe('做多_区间多头');
    });
  });

  describe('calculateFactorScore', () => {
    test('应该正确计算多头因子得分', () => {
      const factors = {
        vwap: 1,
        delta: 1,
        oi: 1,
        volume: 1,
        signalType: 'long'
      };
      const score = strategyExecution.calculateFactorScore(factors);
      expect(score).toBe(4);
    });

    test('应该正确计算空头因子得分', () => {
      const factors = {
        vwap: -1,
        delta: -1,
        oi: -1,
        volume: -1,
        signalType: 'short'
      };
      const score = strategyExecution.calculateFactorScore(factors);
      expect(score).toBe(4);
    });

    test('应该处理混合因子得分', () => {
      const factors = {
        vwap: 1,
        delta: -1,
        oi: 1,
        volume: -1,
        signalType: 'long'
      };
      const score = strategyExecution.calculateFactorScore(factors);
      expect(score).toBe(0);
    });
  });

  describe('analyzeRangeExecution', () => {
    test('应该返回正确的NONE信号格式', async () => {
      const rangeResult = {
        lowerBoundaryValid: false,
        upperBoundaryValid: false,
        bbUpper: 100,
        bbLower: 90
      };
      const candles15m = [
        { close: 95, high: 96, low: 94, volume: 1000 },
        { close: 95.5, high: 96.5, low: 94.5, volume: 1100 }
      ];
      const candles1h = [];

      const result = await strategyExecution.analyzeRangeExecution('TESTUSDT', rangeResult, candles15m, candles1h);
      
      expect(result.signal).toBe('NONE');
      expect(result.mode).toBe('NONE');
      expect(result.reason).toBe('不在1H区间内');
    });

    test('应该正确处理空头假突破信号', async () => {
      const rangeResult = {
        lowerBoundaryValid: false,
        upperBoundaryValid: true,
        bbUpper: 100,
        bbLower: 90
      };
      const candles15m = [
        { close: 99, high: 100, low: 98, volume: 1000 },
        { close: 98, high: 99, low: 97, volume: 1100 }
      ];
      const candles1h = [];

      // Mock getMultiFactorData to return high factor score
      strategyExecution.getMultiFactorData = jest.fn().mockResolvedValue({
        vwap: 98.5,
        delta: -0.5,
        oi: -0.02,
        volume: 100
      });

      const result = await strategyExecution.analyzeRangeExecution('TESTUSDT', rangeResult, candles15m, candles1h);
      
      if (result.signal === 'SHORT') {
        expect(result.mode).toBe('假突破反手');
        expect(result.entry).toBe(98);
        expect(result.stopLoss).toBe(100);
      }
    });
  });
});

// Mock BinanceAPI for testing
jest.mock('../modules/api/BinanceAPI', () => ({
  getKlines: jest.fn().mockResolvedValue([
    [1640995200000, '100', '101', '99', '100.5', '1000', 1640995259999, '1000', 10, '500', '500', '0'],
    [1640995260000, '100.5', '102', '100', '101', '1100', 1640995319999, '1100', 11, '550', '550', '0']
  ]),
  getOpenInterest: jest.fn().mockResolvedValue({ openInterest: '1000000' })
}));
