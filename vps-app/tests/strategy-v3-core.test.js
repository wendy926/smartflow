// strategy-v3-core.test.js
// StrategyV3Core核心逻辑测试

const StrategyV3Core = require('../modules/strategy/StrategyV3Core');

describe('StrategyV3Core 核心逻辑测试', () => {
  let strategyCore;

  beforeEach(() => {
    strategyCore = new StrategyV3Core();
  });

  afterEach(() => {
    if (strategyCore) {
      strategyCore.destroy();
    }
  });

  describe('4H趋势判断逻辑', () => {
    test('应该正确计算MA指标', () => {
      const testCandles = [];
      for (let i = 0; i < 250; i++) {
        testCandles.push({
          open: 100 + i * 0.1,
          high: 105 + i * 0.1,
          low: 95 + i * 0.1,
          close: 100 + i * 0.1,
          volume: 1000
        });
      }

      const ma20 = strategyCore.calculateMA(testCandles, 20);
      const ma50 = strategyCore.calculateMA(testCandles, 50);
      const ma200 = strategyCore.calculateMA(testCandles, 200);

      expect(ma20).toBeGreaterThan(0);
      expect(ma50).toBeGreaterThan(0);
      expect(ma200).toBeGreaterThan(0);
      expect(ma20).toBeGreaterThan(ma50);
      expect(ma50).toBeGreaterThan(ma200);
    });

    test('应该正确判断多头趋势', () => {
      const mockData = {
        ma20: 110,
        ma50: 105,
        ma200: 100,
        currentPrice: 115,
        adx14: 25,
        bbw: 0.06,
        candles: Array(10).fill().map((_, i) => ({
          close: 110 + i * 0.5
        }))
      };

      const result = strategyCore.analyze4HTrend(mockData);

      expect(result.trend4h).toBe('多头趋势');
      expect(result.score).toBeGreaterThanOrEqual(4);
      expect(result.bullScore).toBeGreaterThanOrEqual(2);
      expect(result.bearScore).toBeLessThan(2);
    });

    test('应该正确判断空头趋势', () => {
      const mockData = {
        ma20: 100,
        ma50: 105,
        ma200: 110,
        currentPrice: 95,
        adx14: 25,
        bbw: 0.06,
        candles: Array(10).fill().map((_, i) => ({
          close: 110 - i * 0.5
        }))
      };

      const result = strategyCore.analyze4HTrend(mockData);

      expect(result.trend4h).toBe('空头趋势');
      expect(result.score).toBeGreaterThanOrEqual(4);
      expect(result.bearScore).toBeGreaterThanOrEqual(2);
      expect(result.bullScore).toBeLessThan(2);
    });

    test('应该正确判断震荡市', () => {
      const mockData = {
        ma20: 105,
        ma50: 105,
        ma200: 105,
        currentPrice: 105,
        adx14: 15,
        bbw: 0.03,
        candles: Array(10).fill().map(() => ({
          close: 105 + (Math.random() - 0.5) * 2
        }))
      };

      const result = strategyCore.analyze4HTrend(mockData);

      expect(result.trend4h).toBe('震荡市');
      expect(result.score).toBeLessThan(4);
    });

    test('应该处理数据不足的情况', () => {
      const mockData = {
        ma20: null,
        ma50: null,
        ma200: null,
        currentPrice: 100,
        adx14: 0,
        bbw: 0,
        candles: []
      };

      const result = strategyCore.analyze4HTrend(mockData);

      expect(result.trend4h).toBe('震荡市');
      expect(result.error).toBeDefined();
    });
  });

  describe('1H多因子打分逻辑', () => {
    test('应该正确计算趋势市多因子得分', () => {
      const mockData = {
        trend4h: '多头趋势',
        currentPrice: 110,
        vwap: 108,
        deltaBuy: 1000,
        deltaSell: 800,
        oiChange: 0.05,
        volume15m: 1200,
        volume1h: 1000,
        fundingRate: 0.01
      };

      const result = strategyCore.analyze1HScoring(mockData);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(6);
      expect(result.factors).toBeDefined();
      expect(result.vwapDirectionConsistent).toBeDefined();
    });

    test('应该正确处理震荡市边界判断', () => {
      const mockData = {
        trend4h: '震荡市',
        currentPrice: 105,
        bbUpper: 110,
        bbLower: 100,
        bbMiddle: 105,
        touchesLower: 2,
        touchesUpper: 1,
        volume15m: 1200,
        volume1h: 1000,
        deltaBuy: 900,
        deltaSell: 1100,
        oiChange: -0.02
      };

      const result = strategyCore.analyzeRangeBoundary(mockData);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(2);
      expect(result.lowerBoundaryValid).toBeDefined();
      expect(result.upperBoundaryValid).toBeDefined();
    });

    test('应该处理无效数据', () => {
      const mockData = {
        trend4h: '多头趋势',
        currentPrice: null,
        vwap: null,
        deltaBuy: null,
        deltaSell: null
      };

      const result = strategyCore.analyze1HScoring(mockData);

      expect(result.error).toBeDefined();
      expect(result.score).toBe(0);
    });
  });

  describe('技术指标计算', () => {
    test('应该正确计算ADX指标', () => {
      const mockCandles = Array(20).fill().map((_, i) => ({
        high: 110 + i * 0.1,
        low: 90 + i * 0.1,
        close: 100 + i * 0.1
      }));

      const adx = strategyCore.calculateADX(mockCandles, 14);

      expect(adx).toBeGreaterThanOrEqual(0);
      expect(adx).toBeLessThanOrEqual(100);
    });

    test('应该正确计算布林带带宽', () => {
      const mockCandles = Array(20).fill().map((_, i) => ({
        close: 100 + Math.sin(i * 0.1) * 5
      }));

      const bbw = strategyCore.calculateBBW(mockCandles, 20);

      expect(bbw).toBeGreaterThan(0);
    });

    test('应该正确处理数据不足的情况', () => {
      const mockCandles = Array(5).fill().map(() => ({
        high: 110,
        low: 90,
        close: 100
      }));

      const adx = strategyCore.calculateADX(mockCandles, 14);

      expect(adx).toBe(0);
    });
  });

  describe('错误处理', () => {
    test('应该处理空数据', () => {
      expect(() => {
        strategyCore.analyze4HTrend(null);
      }).not.toThrow();

      expect(() => {
        strategyCore.analyze1HScoring(null);
      }).not.toThrow();
    });

    test('应该处理无效参数', () => {
      expect(() => {
        strategyCore.calculateMA([], -1);
      }).not.toThrow();

      expect(() => {
        strategyCore.calculateMA(null, 20);
      }).not.toThrow();
    });
  });
});
