// SmartFlowStrategyV3 单元测试
const SmartFlowStrategyV3 = require('../modules/strategy/SmartFlowStrategyV3');

describe('SmartFlowStrategyV3', () => {
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

    test('应该正确处理undefined信号', () => {
      const result = { signal: undefined, mode: 'NONE' };
      const formatted = SmartFlowStrategyV3.formatExecution(result);
      expect(formatted).toBeNull();
    });

    test('应该正确处理BUY信号', () => {
      const result = { signal: 'BUY', mode: '假突破反手' };
      const formatted = SmartFlowStrategyV3.formatExecution(result);
      expect(formatted).toBe('做多_假突破反手');
    });

    test('应该正确处理SHORT信号', () => {
      const result = { signal: 'SHORT', mode: '假突破反手' };
      const formatted = SmartFlowStrategyV3.formatExecution(result);
      expect(formatted).toBe('做空_假突破反手');
    });

    test('应该正确处理LONG信号', () => {
      const result = { signal: 'LONG', mode: '区间多头' };
      const formatted = SmartFlowStrategyV3.formatExecution(result);
      expect(formatted).toBe('做多_区间多头');
    });

    test('应该处理undefined mode', () => {
      const result = { signal: 'SHORT', mode: undefined };
      const formatted = SmartFlowStrategyV3.formatExecution(result);
      expect(formatted).toBe('做空_NONE');
    });

    test('应该处理null mode', () => {
      const result = { signal: 'BUY', mode: null };
      const formatted = SmartFlowStrategyV3.formatExecution(result);
      expect(formatted).toBe('做多_NONE');
    });
  });

  describe('createNoSignalResult', () => {
    test('应该创建正确的无信号结果', () => {
      const result = SmartFlowStrategyV3.createNoSignalResult('TESTUSDT', '数据不足');
      
      expect(result.symbol).toBe('TESTUSDT');
      expect(result.marketType).toBe('震荡市');
      expect(result.score1h).toBe(0);
      expect(result.vwapDirectionConsistent).toBe(false);
      expect(result.factors).toEqual({});
      expect(result.signal).toBe('NONE');
      expect(result.execution).toBeNull();
      expect(result.executionMode).toBe('NONE');
      expect(result.reason).toBe('数据不足');
    });
  });
});

// Mock dependencies
jest.mock('../modules/strategy/StrategyV3Core', () => ({
  analyze4HTrend: jest.fn().mockResolvedValue({
    trend4h: '震荡市',
    marketType: '震荡市',
    error: null
  }),
  analyzeRangeBoundary: jest.fn().mockResolvedValue({
    lowerBoundaryValid: true,
    upperBoundaryValid: true,
    bbUpper: 100,
    bbMiddle: 95,
    bbLower: 90,
    touchesLower: 2,
    touchesUpper: 1,
    volFactor: 1.5,
    delta: 0.01,
    oiChange: 0.02,
    lastBreakout: false,
    factorScore: 4,
    boundaryThreshold: 3.0
  })
}));

jest.mock('../modules/strategy/StrategyV3Execution', () => ({
  analyzeRangeExecution: jest.fn().mockResolvedValue({
    signal: 'NONE',
    mode: 'NONE',
    reason: '不满足假突破条件',
    atr14: 1.5
  })
}));
