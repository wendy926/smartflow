// tests/trend-15m-factor-scoring.test.js
// 趋势市15分钟多因子打分系统测试

const StrategyV3Execution = require('../modules/strategy/StrategyV3Execution');

describe('趋势市15分钟多因子打分系统', () => {
  let execution;

  beforeEach(() => {
    execution = new StrategyV3Execution();
  });

  describe('calculateTrend15mFactorScore', () => {
    test('多头信号多因子打分 - 所有条件满足', () => {
      const symbol = 'BTCUSDT';
      const last15m = {
        close: 105000,
        high: 105500,
        low: 104500,
        volume: 1500
      };
      const candles15m = Array.from({ length: 20 }, (_, i) => ({
        high: 100000 + i * 100,
        low: 99000 + i * 100,
        volume: 1000
      }));
      const signalType = 'long';
      const vwap = 104000;

      const result = execution.calculateTrend15mFactorScore(
        symbol, last15m, candles15m, signalType, vwap
      );

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(5);
      expect(result.factorScores).toHaveProperty('vwap');
      expect(result.factorScores).toHaveProperty('breakout');
      expect(result.factorScores).toHaveProperty('volume');
      expect(result.factorScores).toHaveProperty('oi');
      expect(result.factorScores).toHaveProperty('delta');
      expect(result.vwapDirection).toBe(true); // 105000 > 104000
    });

    test('空头信号多因子打分 - 所有条件满足', () => {
      const symbol = 'BTCUSDT';
      const last15m = {
        close: 103000,
        high: 103500,
        low: 102500,
        volume: 1500
      };
      const candles15m = Array.from({ length: 20 }, (_, i) => ({
        high: 100000 + i * 100,
        low: 99000 + i * 100,
        volume: 1000
      }));
      const signalType = 'short';
      const vwap = 104000;

      const result = execution.calculateTrend15mFactorScore(
        symbol, last15m, candles15m, signalType, vwap
      );

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(5);
      expect(result.vwapDirection).toBe(true); // 103000 < 104000
    });

    test('VWAP方向不一致时得分正确', () => {
      const symbol = 'BTCUSDT';
      const last15m = {
        close: 103000, // 低于VWAP
        high: 103500,
        low: 102500,
        volume: 1500
      };
      const candles15m = Array.from({ length: 20 }, (_, i) => ({
        high: 100000 + i * 100,
        low: 99000 + i * 100,
        volume: 1000
      }));
      const signalType = 'long'; // 多头信号但价格低于VWAP
      const vwap = 104000;

      const result = execution.calculateTrend15mFactorScore(
        symbol, last15m, candles15m, signalType, vwap
      );

      expect(result.vwapDirection).toBe(false); // 103000 < 104000，多头信号VWAP方向不一致
      expect(result.factorScores.vwap).toBe(0);
    });

    test('突破确认因子计算正确', () => {
      const symbol = 'BTCUSDT';
      const last15m = {
        close: 102000, // 突破最近20根高点
        high: 102500,
        low: 101500,
        volume: 1500
      };
      const candles15m = Array.from({ length: 20 }, (_, i) => ({
        high: 100000 + i * 50, // 最高点是100950
        low: 99000 + i * 50,
        volume: 1000
      }));
      const signalType = 'long';
      const vwap = 100500;

      const result = execution.calculateTrend15mFactorScore(
        symbol, last15m, candles15m, signalType, vwap
      );

      // 102000 > 100950，应该触发突破确认
      expect(result.factorScores.breakout).toBe(1);
    });

    test('成交量确认因子计算正确', () => {
      const symbol = 'BTCUSDT';
      const last15m = {
        close: 105000,
        high: 105500,
        low: 104500,
        volume: 2000 // 2倍于平均成交量
      };
      const candles15m = Array.from({ length: 20 }, (_, i) => ({
        high: 100000 + i * 100,
        low: 99000 + i * 100,
        volume: 1000 // 平均成交量1000
      }));
      const signalType = 'long';
      const vwap = 104000;

      const result = execution.calculateTrend15mFactorScore(
        symbol, last15m, candles15m, signalType, vwap
      );

      // 2000/1000 = 2.0 >= 1.5，应该触发成交量确认
      expect(result.factorScores.volume).toBe(1);
    });

    test('成交量不足时因子计算正确', () => {
      const symbol = 'BTCUSDT';
      const last15m = {
        close: 105000,
        high: 105500,
        low: 104500,
        volume: 1200 // 1.2倍于平均成交量，不足1.5倍
      };
      const candles15m = Array.from({ length: 20 }, (_, i) => ({
        high: 100000 + i * 100,
        low: 99000 + i * 100,
        volume: 1000
      }));
      const signalType = 'long';
      const vwap = 104000;

      const result = execution.calculateTrend15mFactorScore(
        symbol, last15m, candles15m, signalType, vwap
      );

      // 1200/1000 = 1.2 < 1.5，不应该触发成交量确认
      expect(result.factorScores.volume).toBe(0);
    });

    test('错误处理', () => {
      const symbol = 'BTCUSDT';
      const last15m = null; // 无效数据
      const candles15m = [];
      const signalType = 'long';
      const vwap = 104000;

      const result = execution.calculateTrend15mFactorScore(
        symbol, last15m, candles15m, signalType, vwap
      );

      expect(result.score).toBe(0);
      expect(result.factorScores).toEqual({});
      expect(result.error).toBeDefined();
    });
  });

  describe('analyzeTrendExecution 集成测试', () => {
    test('多头趋势执行 - 多因子得分≥2触发入场', () => {
      const symbol = 'BTCUSDT';
      const trend4h = '多头趋势';
      const score1h = 4;
      const vwapDirectionConsistent = true;
      
      const candles15m = Array.from({ length: 50 }, (_, i) => ({
        open: 100000 + i * 10,
        high: 100500 + i * 10,
        low: 99500 + i * 10,
        close: 100200 + i * 10,
        volume: 1500 // 1.5倍成交量
      }));
      
      const candles1h = Array.from({ length: 50 }, (_, i) => ({
        open: 100000 + i * 50,
        high: 100500 + i * 50,
        low: 99500 + i * 50,
        close: 100200 + i * 50,
        volume: 5000
      }));

      // Mock calculateTrend15mFactorScore 返回高分
      jest.spyOn(execution, 'calculateTrend15mFactorScore').mockReturnValue({
        score: 3,
        factorScores: { vwap: 1, breakout: 1, volume: 1, oi: 0, delta: 0 },
        vwapDirection: true
      });

      const result = execution.analyzeTrendExecution(
        symbol, trend4h, score1h, vwapDirectionConsistent, candles15m, candles1h
      );

      expect(result.signal).toBe('BUY');
      expect(result.mode).toBe('多头回踩突破');
      expect(result.factorScore15m).toBe(3);
      expect(result.reason).toContain('多因子得分: 3');
    });

    test('多头趋势执行 - 多因子得分<2不触发入场', () => {
      const symbol = 'BTCUSDT';
      const trend4h = '多头趋势';
      const score1h = 4;
      const vwapDirectionConsistent = true;
      
      const candles15m = Array.from({ length: 50 }, (_, i) => ({
        open: 100000 + i * 10,
        high: 100500 + i * 10,
        low: 99500 + i * 10,
        close: 100200 + i * 10,
        volume: 1500
      }));
      
      const candles1h = Array.from({ length: 50 }, (_, i) => ({
        open: 100000 + i * 50,
        high: 100500 + i * 50,
        low: 99500 + i * 50,
        close: 100200 + i * 50,
        volume: 5000
      }));

      // Mock calculateTrend15mFactorScore 返回低分
      jest.spyOn(execution, 'calculateTrend15mFactorScore').mockReturnValue({
        score: 1,
        factorScores: { vwap: 1, breakout: 0, volume: 0, oi: 0, delta: 0 },
        vwapDirection: true
      });

      const result = execution.analyzeTrendExecution(
        symbol, trend4h, score1h, vwapDirectionConsistent, candles15m, candles1h
      );

      expect(result.signal).toBe('NONE');
      expect(result.mode).toBe('NONE');
    });

    test('空头趋势执行 - 多因子得分≥2触发入场', () => {
      const symbol = 'BTCUSDT';
      const trend4h = '空头趋势';
      const score1h = 4;
      const vwapDirectionConsistent = true;
      
      const candles15m = Array.from({ length: 50 }, (_, i) => ({
        open: 100000 - i * 10,
        high: 100500 - i * 10,
        low: 99500 - i * 10,
        close: 99800 - i * 10,
        volume: 1500
      }));
      
      const candles1h = Array.from({ length: 50 }, (_, i) => ({
        open: 100000 - i * 50,
        high: 100500 - i * 50,
        low: 99500 - i * 50,
        close: 99800 - i * 50,
        volume: 5000
      }));

      // Mock calculateTrend15mFactorScore 返回高分
      jest.spyOn(execution, 'calculateTrend15mFactorScore').mockReturnValue({
        score: 3,
        factorScores: { vwap: 1, breakout: 1, volume: 1, oi: 0, delta: 0 },
        vwapDirection: true
      });

      const result = execution.analyzeTrendExecution(
        symbol, trend4h, score1h, vwapDirectionConsistent, candles15m, candles1h
      );

      expect(result.signal).toBe('SELL');
      expect(result.mode).toBe('空头反抽破位');
      expect(result.factorScore15m).toBe(3);
      expect(result.reason).toContain('多因子得分: 3');
    });
  });

  describe('边界条件测试', () => {
    test('数据不足时返回NONE', () => {
      const symbol = 'BTCUSDT';
      const trend4h = '多头趋势';
      const score1h = 4;
      const vwapDirectionConsistent = true;
      const candles15m = Array.from({ length: 10 }, () => ({})); // 数据不足
      const candles1h = Array.from({ length: 10 }, () => ({}));

      const result = execution.analyzeTrendExecution(
        symbol, trend4h, score1h, vwapDirectionConsistent, candles15m, candles1h
      );

      expect(result.signal).toBe('NONE');
      expect(result.reason).toBe('15m数据不足');
    });

    test('震荡市不执行趋势入场', () => {
      const symbol = 'BTCUSDT';
      const trend4h = '震荡市';
      const score1h = 4;
      const vwapDirectionConsistent = true;
      const candles15m = Array.from({ length: 50 }, () => ({}));
      const candles1h = Array.from({ length: 50 }, () => ({}));

      const result = execution.analyzeTrendExecution(
        symbol, trend4h, score1h, vwapDirectionConsistent, candles15m, candles1h
      );

      expect(result.signal).toBe('NONE');
    });

    test('1H得分不足不执行入场', () => {
      const symbol = 'BTCUSDT';
      const trend4h = '多头趋势';
      const score1h = 2; // 不足3分
      const vwapDirectionConsistent = true;
      const candles15m = Array.from({ length: 50 }, () => ({}));
      const candles1h = Array.from({ length: 50 }, () => ({}));

      const result = execution.analyzeTrendExecution(
        symbol, trend4h, score1h, vwapDirectionConsistent, candles15m, candles1h
      );

      expect(result.signal).toBe('NONE');
    });
  });
});
