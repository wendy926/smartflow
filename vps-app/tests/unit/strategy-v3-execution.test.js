// strategy-v3-execution.test.js
// StrategyV3Execution执行逻辑测试

const StrategyV3Execution = require('../modules/strategy/StrategyV3Execution');

describe('StrategyV3Execution 执行逻辑测试', () => {
  let execution;

  beforeEach(() => {
    execution = new StrategyV3Execution(null); // 不传入数据库连接
  });

  afterEach(() => {
    if (execution) {
      execution.destroy();
    }
  });

  describe('15分钟入场执行逻辑', () => {
    test('应该正确识别趋势市多头回踩突破', () => {
      const mockData = {
        trend4h: '多头趋势',
        marketType: '趋势市',
        currentPrice: 110,
        ema20: 108,
        ema50: 106,
        bbUpper: 112,
        bbLower: 104,
        bbMiddle: 108,
        volume15m: 1500,
        avgVolume15m: 1000,
        atr14: 2.5,
        deltaBuy: 1200,
        deltaSell: 800,
        oiChange: 0.03
      };

      const result = execution.analyzeTrendExecution(mockData);

      expect(result).toBeDefined();
      expect(result.signal).toBeOneOf(['BUY', 'SELL', 'NONE']);
      expect(result.mode).toBeDefined();
      expect(result.entry).toBeDefined();
      expect(result.stopLoss).toBeDefined();
      expect(result.takeProfit).toBeDefined();
    });

    test('应该正确识别趋势市空头反抽破位', () => {
      const mockData = {
        trend4h: '空头趋势',
        marketType: '趋势市',
        currentPrice: 95,
        ema20: 98,
        ema50: 102,
        bbUpper: 104,
        bbLower: 96,
        bbMiddle: 100,
        volume15m: 1500,
        avgVolume15m: 1000,
        atr14: 2.5,
        deltaBuy: 800,
        deltaSell: 1200,
        oiChange: -0.03
      };

      const result = execution.analyzeTrendExecution(mockData);

      expect(result).toBeDefined();
      expect(result.signal).toBeOneOf(['BUY', 'SELL', 'NONE']);
      expect(result.mode).toBeDefined();
    });

    test('应该正确识别震荡市假突破反手', () => {
      const mockData = {
        trend4h: '震荡市',
        marketType: '震荡市',
        currentPrice: 105,
        bbUpper: 110,
        bbLower: 100,
        bbMiddle: 105,
        bbWidth15m: 0.03, // 收窄
        volume15m: 1500,
        avgVolume15m: 1000,
        atr14: 2.0,
        deltaBuy: 900,
        deltaSell: 1100,
        oiChange: -0.01,
        recentBreakout: true,
        breakoutRecovery: true
      };

      const result = execution.analyzeRangeExecution(mockData);

      expect(result).toBeDefined();
      expect(result.signal).toBeOneOf(['BUY', 'SELL', 'NONE']);
      expect(result.mode).toBeOneOf(['假突破反手', 'NONE']);
    });

    test('应该正确识别震荡市区间多头', () => {
      const mockData = {
        trend4h: '震荡市',
        marketType: '震荡市',
        currentPrice: 101, // 接近下轨
        bbUpper: 110,
        bbLower: 100,
        bbMiddle: 105,
        bbWidth15m: 0.05,
        volume15m: 1200,
        avgVolume15m: 1000,
        atr14: 2.0,
        deltaBuy: 1000,
        deltaSell: 1000,
        oiChange: 0.01,
        lowerBoundaryValid: true,
        upperBoundaryValid: true
      };

      const result = execution.analyzeRangeExecution(mockData);

      expect(result).toBeDefined();
      expect(result.signal).toBeOneOf(['BUY', 'SELL', 'NONE']);
    });

    test('应该处理数据不足的情况', () => {
      const mockData = {
        trend4h: '多头趋势',
        marketType: '趋势市',
        currentPrice: null,
        ema20: null,
        ema50: null
      };

      const result = execution.analyzeTrendExecution(mockData);

      expect(result.signal).toBe('NONE');
      expect(result.error).toBeDefined();
    });
  });

  describe('止损止盈计算', () => {
    test('应该正确计算多头止损止盈', () => {
      const mockData = {
        signal: 'BUY',
        entry: 110,
        atr14: 2.5,
        bbUpper: 115,
        bbMiddle: 112.5,
        bbLower: 110
      };

      const result = execution.calculateStopLossTakeProfit(mockData);

      expect(result.stopLoss).toBeLessThan(result.entry);
      expect(result.takeProfit).toBeGreaterThan(result.entry);
      expect(result.stopLoss).toBeGreaterThan(0);
      expect(result.takeProfit).toBeGreaterThan(0);
    });

    test('应该正确计算空头止损止盈', () => {
      const mockData = {
        signal: 'SELL',
        entry: 100,
        atr14: 2.5,
        bbUpper: 105,
        bbMiddle: 102.5,
        bbLower: 100
      };

      const result = execution.calculateStopLossTakeProfit(mockData);

      expect(result.stopLoss).toBeGreaterThan(result.entry);
      expect(result.takeProfit).toBeLessThan(result.entry);
      expect(result.stopLoss).toBeGreaterThan(0);
      expect(result.takeProfit).toBeGreaterThan(0);
    });

    test('应该处理震荡市止损止盈', () => {
      const mockData = {
        signal: 'BUY',
        entry: 105,
        atr14: 2.0,
        bbUpper: 110,
        bbMiddle: 107.5,
        bbLower: 105,
        marketType: '震荡市',
        rangeLow: 104,
        rangeHigh: 106
      };

      const result = execution.calculateStopLossTakeProfit(mockData);

      expect(result.stopLoss).toBeDefined();
      expect(result.takeProfit).toBeDefined();
      expect(result.stopLoss).toBeGreaterThan(0);
      expect(result.takeProfit).toBeGreaterThan(0);
    });
  });

  describe('杠杆计算', () => {
    test('应该正确计算多头杠杆数据', async () => {
      const entryPrice = 100;
      const stopLossPrice = 95;
      const atr14 = 2.5;
      const maxLossAmount = 100;

      const result = await execution.calculateLeverageData(
        entryPrice,
        stopLossPrice,
        atr14,
        'LONG',
        maxLossAmount
      );

      expect(result.maxLeverage).toBeGreaterThan(0);
      expect(result.minMargin).toBeGreaterThan(0);
      expect(result.stopLossDistance).toBeGreaterThan(0);
      expect(result.atrValue).toBe(atr14);
      expect(result.error).toBeUndefined();
    });

    test('应该正确计算空头杠杆数据', async () => {
      const entryPrice = 95;
      const stopLossPrice = 100;
      const atr14 = 2.5;
      const maxLossAmount = 100;

      const result = await execution.calculateLeverageData(
        entryPrice,
        stopLossPrice,
        atr14,
        'SHORT',
        maxLossAmount
      );

      expect(result.maxLeverage).toBeGreaterThan(0);
      expect(result.minMargin).toBeGreaterThan(0);
      expect(result.stopLossDistance).toBeGreaterThan(0);
      expect(result.atrValue).toBe(atr14);
    });

    test('应该处理无效参数', async () => {
      const result = await execution.calculateLeverageData(
        null,
        null,
        null,
        'LONG',
        100
      );

      expect(result.error).toBeDefined();
      expect(result.maxLeverage).toBe(10);
      expect(result.minMargin).toBe(100);
    });
  });

  describe('Setup蜡烛识别', () => {
    test('应该正确识别多头Setup蜡烛', () => {
      const mockCandles = [
        { high: 110, low: 108, close: 109 },
        { high: 111, low: 109, close: 110 },
        { high: 112, low: 110, close: 111 }, // Setup蜡烛
        { high: 113, low: 111, close: 112 }
      ];

      const result = execution.identifySetupCandle(mockCandles, 'BUY');

      expect(result.setupCandleHigh).toBeGreaterThan(0);
      expect(result.setupCandleLow).toBeGreaterThan(0);
      expect(result.setupCandleHigh).toBeGreaterThan(result.setupCandleLow);
    });

    test('应该正确识别空头Setup蜡烛', () => {
      const mockCandles = [
        { high: 111, low: 109, close: 110 },
        { high: 110, low: 108, close: 109 },
        { high: 109, low: 107, close: 108 }, // Setup蜡烛
        { high: 108, low: 106, close: 107 }
      ];

      const result = execution.identifySetupCandle(mockCandles, 'SELL');

      expect(result.setupCandleHigh).toBeGreaterThan(0);
      expect(result.setupCandleLow).toBeGreaterThan(0);
      expect(result.setupCandleHigh).toBeGreaterThan(result.setupCandleLow);
    });

    test('应该处理空数据', () => {
      const result = execution.identifySetupCandle([], 'BUY');

      expect(result.setupCandleHigh).toBe(0);
      expect(result.setupCandleLow).toBe(0);
    });
  });

  describe('错误处理', () => {
    test('应该处理空数据', () => {
      expect(() => {
        execution.analyzeTrendExecution(null);
      }).not.toThrow();

      expect(() => {
        execution.analyzeRangeExecution(null);
      }).not.toThrow();
    });

    test('应该处理无效信号', () => {
      const result = execution.calculateStopLossTakeProfit({
        signal: 'INVALID',
        entry: 100
      });

      expect(result.stopLoss).toBe(0);
      expect(result.takeProfit).toBe(0);
    });
  });
});
