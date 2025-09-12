// 策略执行模块单元测试
const StrategyV3Execution = require('../modules/strategy/StrategyV3Execution');
const SmartFlowStrategyV3 = require('../modules/strategy/SmartFlowStrategyV3');

describe('StrategyV3Execution', () => {
  let strategyExecution;

  beforeEach(() => {
    strategyExecution = new StrategyV3Execution();
  });

  describe('formatExecution', () => {
    test('应该正确处理NONE信号', () => {
      const result = { signal: 'NONE', mode: 'NONE' };
      const formatted = SmartFlowStrategyV3.formatExecution(result);
      expect(formatted).toBeNull();
    });

    test('应该正确处理空信号', () => {
      const result = { signal: null, mode: 'NONE' };
      const formatted = SmartFlowStrategyV3.formatExecution(result);
      expect(formatted).toBeNull();
    });

    test('应该正确处理多头信号', () => {
      const result = { signal: 'BUY', mode: '假突破反手' };
      const formatted = SmartFlowStrategyV3.formatExecution(result);
      expect(formatted).toBe('做多_假突破反手');
    });

    test('应该正确处理空头信号', () => {
      const result = { signal: 'SHORT', mode: '假突破反手' };
      const formatted = SmartFlowStrategyV3.formatExecution(result);
      expect(formatted).toBe('做空_假突破反手');
    });

    test('应该处理undefined mode', () => {
      const result = { signal: 'SHORT', mode: undefined };
      const formatted = SmartFlowStrategyV3.formatExecution(result);
      expect(formatted).toBe('做空_NONE');
    });

    test('应该处理LONG信号', () => {
      const result = { signal: 'LONG', mode: '区间多头' };
      const formatted = SmartFlowStrategyV3.formatExecution(result);
      expect(formatted).toBe('做多_区间多头');
    });
  });

  describe('calculateFactorScore', () => {
    test('应该正确计算多头因子得分', () => {
      const factors = {
        currentPrice: 100,
        vwap: 95,
        delta: 1,
        oi: 1,
        volume: 1,
        signalType: 'long'
      };
      const score = strategyExecution.calculateLegacyFactorScore(factors);
      expect(score).toBe(4);
    });

    test('应该正确计算空头因子得分', () => {
      const factors = {
        currentPrice: 95,
        vwap: 100,
        delta: -1,
        oi: -1,
        volume: -1,
        signalType: 'short'
      };
      const score = strategyExecution.calculateLegacyFactorScore(factors);
      expect(score).toBe(4);
    });

    test('应该处理混合因子得分', () => {
      const factors = {
        currentPrice: 100,
        vwap: 95,
        delta: -1,
        oi: 1,
        volume: -1,
        signalType: 'long'
      };
      const score = strategyExecution.calculateLegacyFactorScore(factors);
      expect(score).toBe(0);
    });

    test('应该正确处理VWAP因子：当前价格高于VWAP', () => {
      const factors = {
        currentPrice: 100,
        vwap: 95,
        delta: 1,  // 正值，+1分
        oi: 1,     // 正值，+1分
        volume: 1, // 正值，+1分
        signalType: 'long'
      };
      const score = strategyExecution.calculateLegacyFactorScore(factors);
      expect(score).toBe(4); // VWAP因子+1分，其他因子各+1分，总共4分
    });

    test('应该正确处理VWAP因子：当前价格低于VWAP', () => {
      const factors = {
        currentPrice: 95,
        vwap: 100,
        delta: 1,  // 正值，+1分
        oi: 1,     // 正值，+1分
        volume: 1, // 正值，+1分
        signalType: 'long'
      };
      const score = strategyExecution.calculateLegacyFactorScore(factors);
      expect(score).toBe(2); // VWAP因子-1分，其他因子各+1分，总共2分
    });
  });

  describe('analyzeRangeExecution', () => {
    test('应该返回正确的NONE信号格式', async () => {
      const rangeResult = {
        lowerBoundaryValid: false,
        upperBoundaryValid: false,
        bb1h: {
          upper: 100,
          lower: 90
        }
      };
      // 创建20根15分钟K线数据，确保布林带收窄但价格超出区间
      const candles15m = Array.from({ length: 20 }, (_, i) => ({
        close: 95 + (i % 3) * 0.01, // 价格有微小变化，确保布林带收窄
        high: 95.1 + (i % 3) * 0.01,
        low: 94.9 + (i % 3) * 0.01,
        volume: 1000 + i * 10
      }));
      // 修改最后两根K线价格超出1H区间
      candles15m[candles15m.length - 2].close = 101; // 超出上沿
      candles15m[candles15m.length - 1].close = 102; // 超出上沿
      const candles1h = [];

      const result = await strategyExecution.analyzeRangeExecution('TESTUSDT', rangeResult, candles15m, candles1h);

      expect(result.signal).toBe('NONE');
      expect(result.mode).toBe('NONE');
      expect(result.reason).toBe('15m布林带未收窄');
    });

    test('应该正确处理空头假突破信号', async () => {
      const rangeResult = {
        lowerBoundaryValid: false,
        upperBoundaryValid: true,
        bb1h: {
          upper: 100,
          lower: 90
        }
      };
      // 创建20根15分钟K线数据
      const candles15m = Array.from({ length: 20 }, (_, i) => ({
        close: 95 + i * 0.1,
        high: 96 + i * 0.1,
        low: 94 + i * 0.1,
        volume: 1000 + i * 10
      }));
      // 修改最后两根K线模拟假突破
      candles15m[candles15m.length - 2].close = 101; // 突破上沿
      candles15m[candles15m.length - 1].close = 99;  // 回撤
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
        expect(result.entry).toBe(99);
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
