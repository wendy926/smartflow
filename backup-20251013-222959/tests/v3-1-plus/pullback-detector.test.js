/**
 * PullbackDetector 单元测试
 */

const PullbackDetector = require('../../src/services/v3-1-plus/pullback-detector');

describe('PullbackDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new PullbackDetector({
      retracePct: 0.015,
      ema20Required: true
    });
  });

  describe('isRetracedToLevel', () => {
    test('价格回撤到1.5%以内应该通过', () => {
      const candles = [
        [0, 62000, 62100, 61900, 62000, 100],
        [0, 62000, 62100, 61900, 62080, 100] // 回撤0.13%
      ];
      const result = detector.isRetracedToLevel(candles, 62000, 0.015);
      expect(result.ok).toBe(true);
      expect(result.distance).toBeLessThanOrEqual(0.015);
    });

    test('价格回撤超过容差应该不通过', () => {
      const candles = [
        [0, 62000, 62100, 61900, 62000, 100],
        [0, 62000, 62100, 61900, 63500, 100] // 回撤2.4%
      ];
      const result = detector.isRetracedToLevel(candles, 62000, 0.015);
      expect(result.ok).toBe(false);
      expect(result.distance).toBeGreaterThan(0.015);
    });
  });

  describe('isHeldAboveEMA', () => {
    test('连续2根K线在EMA20上方应该通过', () => {
      const candles = [
        [0, 0, 0, 0, 62100, 100], // 高于EMA20(62000)
        [0, 0, 0, 0, 62050, 100]  // 高于EMA20
      ];
      const result = detector.isHeldAboveEMA(candles, 62000);
      expect(result.ok).toBe(true);
      expect(result.holdCount).toBe(2);
    });

    test('低于EMA20应该不通过', () => {
      const candles = [
        [0, 0, 0, 0, 62100, 100],
        [0, 0, 0, 0, 61900, 100]  // 低于EMA20(62000)
      ];
      const result = detector.isHeldAboveEMA(candles, 62000);
      expect(result.ok).toBe(false);
    });
  });

  describe('isSupportFormed', () => {
    test('V形反转应该识别为支撑', () => {
      const candles = [
        [0, 0, 62000, 61500, 61600, 100], // 低点61500
        [0, 0, 61600, 61400, 61450, 100], // 更低61400
        [0, 0, 61450, 61500, 61700, 100]  // 反弹到61700
      ];
      const result = detector.isSupportFormed(candles);
      expect(result.ok).toBe(true);
      expect(result.pattern).toBe('V-reversal');
    });

    test('上升支撑或W底应该识别', () => {
      const candles = [
        [0, 0, 62000, 61500, 61600, 100], // 低点61500
        [0, 0, 61600, 61550, 61650, 100], // 低点61550（抬高）
        [0, 0, 61650, 61600, 61700, 100]  // 低点61600（继续抬高）
      ];
      const result = detector.isSupportFormed(candles);
      expect(result.ok).toBe(true);
      expect(['rising-support', 'W-bottom']).toContain(result.pattern);
    });

    test('无明显支撑应该不通过', () => {
      const candles = [
        [0, 0, 62000, 61500, 61600, 100],
        [0, 0, 61600, 61300, 61400, 100], // 继续下跌
        [0, 0, 61400, 61200, 61250, 100]  // 继续下跌
      ];
      const result = detector.isSupportFormed(candles);
      expect(result.ok).toBe(false);
    });
  });

  describe('detect', () => {
    test('完整的Pullback应该检测成功', () => {
      const klines15m = [
        [0, 61500, 61600, 61400, 61500, 100],
        [0, 61500, 61700, 61450, 61600, 100],
        [0, 61600, 61800, 61550, 61700, 100],
        [0, 61700, 62100, 61650, 62000, 200], // 突破
        [0, 62000, 62100, 61900, 62050, 150], // 回撤
        [0, 62050, 62150, 62000, 62100, 120]  // 持稳
      ];

      const result = detector.detect(klines15m, 62000, 62000);
      expect(result.detected).toBe(true);
      expect(result.reason).toBe('pullback_confirmed');
    });
  });
});

