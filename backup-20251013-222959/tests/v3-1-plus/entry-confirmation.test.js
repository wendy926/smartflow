/**
 * EntryConfirmationManager 单元测试
 */

const EntryConfirmationManager = require('../../src/services/v3-1-plus/entry-confirmation');

describe('EntryConfirmationManager', () => {
  let manager;

  beforeEach(() => {
    manager = new EntryConfirmationManager({
      confirmationWait: 1,
      volFactor: 1.2,
      deltaThreshold: 0.04,
      confirmCountMin: 2
    });
  });

  describe('hasConfirmationCandle', () => {
    test('K线数量不足应该返回false', () => {
      const klines = [[/* 1根 */]];
      expect(manager.hasConfirmationCandle(klines)).toBe(false);
    });

    test('K线数量足够应该返回true', () => {
      const klines = [
        [/* K1 */], 
        [/* K2 突破 */], 
        [/* K3 确认 */]
      ];
      expect(manager.hasConfirmationCandle(klines)).toBe(true);
    });
  });

  describe('checkVolume', () => {
    test('成交量高于1.2倍应该通过', () => {
      const klines15m = Array(21).fill(null).map((_, i) => [
        0, 0, 0, 0, 0, 
        i < 20 ? 100 : 150 // 最后一根150，前20根平均100
      ]);

      const result = manager.checkVolume(klines15m, 20);
      expect(result.ok).toBe(true);
      expect(result.ratio).toBeGreaterThanOrEqual(1.2);
    });

    test('成交量低于1.2倍应该不通过', () => {
      const klines15m = Array(21).fill(null).map((_, i) => [
        0, 0, 0, 0, 0, 
        i < 20 ? 100 : 110 // 最后一根110，前20根平均100
      ]);

      const result = manager.checkVolume(klines15m, 20);
      expect(result.ok).toBe(false);
      expect(result.ratio).toBeLessThan(1.2);
    });
  });

  describe('checkDelta', () => {
    test('同向且满足阈值应该通过', () => {
      // 模拟上涨K线（close > open）
      const klines15m = [
        [0, 100, 0, 0, 105, 1000], // 涨
        [0, 105, 0, 0, 110, 1000], // 涨
        [0, 110, 0, 0, 115, 1000]  // 涨
      ];
      const klines1h = [
        [0, 1000, 0, 0, 1050, 5000], // 涨
        [0, 1050, 0, 0, 1100, 5000], // 涨
        [0, 1100, 0, 0, 1150, 5000]  // 涨
      ];

      const result = manager.checkDelta(klines15m, klines1h);
      expect(result.sameDirection).toBe(true);
      expect(result.delta15m).toBeGreaterThan(0);
      expect(result.delta1h).toBeGreaterThan(0);
    });

    test('反向应该不通过', () => {
      const klines15m = [
        [0, 100, 0, 0, 105, 1000], // 涨
        [0, 105, 0, 0, 110, 1000],
        [0, 110, 0, 0, 115, 1000]
      ];
      const klines1h = [
        [0, 1000, 0, 0, 990, 5000], // 跌
        [0, 990, 0, 0, 980, 5000],
        [0, 980, 0, 0, 970, 5000]
      ];

      const result = manager.checkDelta(klines15m, klines1h);
      expect(result.sameDirection).toBe(false);
      expect(result.ok).toBe(false);
    });
  });

  describe('checkConfirmations', () => {
    test('所有项通过应该允许入场', () => {
      const klines15m = Array(21).fill(null).map((_, i) => [
        0, 100 + i, 0, 0, 105 + i, i < 20 ? 100 : 150
      ]);
      const klines1h = Array(3).fill(null).map((_, i) => [
        0, 1000 + i * 10, 0, 0, 1005 + i * 10, 1000
      ]);

      const result = manager.checkConfirmations(klines15m, klines1h, {
        earlyTrend: true,
        smartScore: 0.7
      });

      expect(result.allowed).toBe(true);
      expect(result.confirmCount).toBeGreaterThanOrEqual(2);
    });

    test('确认项不足应该拒绝', () => {
      const klines15m = Array(21).fill(null).map(() => [0, 100, 0, 0, 100, 50]);
      const klines1h = Array(3).fill(null).map(() => [0, 1000, 0, 0, 1000, 100]);

      const result = manager.checkConfirmations(klines15m, klines1h, {
        earlyTrend: false,
        smartScore: 0.3
      });

      expect(result.allowed).toBe(false);
      expect(result.confirmCount).toBeLessThan(2);
    });
  });
});

