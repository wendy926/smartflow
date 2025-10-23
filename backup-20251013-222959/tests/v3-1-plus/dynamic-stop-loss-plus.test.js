/**
 * DynamicStopLossPlus 单元测试
 */

const DynamicStopLossPlus = require('../../src/services/v3-1-plus/dynamic-stop-loss-plus');

describe('DynamicStopLossPlus', () => {
  let manager;

  beforeEach(() => {
    manager = new DynamicStopLossPlus({
      kEntryHigh: 1.4,
      kEntryMed: 2.0,
      kEntryLow: 3.0,
      breakoutMultiplier: 1.25,
      pullbackMultiplier: 0.9,
      trailStep: 0.4,
      tpFactor: 2.0
    });
  });

  describe('computeStopK', () => {
    test('High置信度应该返回1.4', () => {
      const K = manager.computeStopK('high', 'momentum');
      expect(K).toBe(1.4);
    });

    test('Med置信度应该返回2.0', () => {
      const K = manager.computeStopK('med', 'momentum');
      expect(K).toBe(2.0);
    });

    test('Low置信度应该返回3.0', () => {
      const K = manager.computeStopK('low', 'momentum');
      expect(K).toBe(3.0);
    });

    test('Breakout模式应该×1.25', () => {
      const K = manager.computeStopK('med', 'breakout');
      expect(K).toBe(2.0 * 1.25);
    });

    test('Pullback模式应该×0.9', () => {
      const K = manager.computeStopK('med', 'pullback');
      expect(K).toBe(2.0 * 0.9);
    });
  });

  describe('calculateInitialPlus', () => {
    test('LONG方向止损应该在入场价下方', () => {
      const result = manager.calculateInitialPlus(
        62000,
        'LONG',
        100,
        'med',
        'momentum'
      );

      expect(result.initialSL).toBeLessThan(62000);
      expect(result.tp).toBeGreaterThan(62000);
      expect(result.kEntry).toBe(2.0);
      expect(result.confidence).toBe('med');
      expect(result.entryMode).toBe('momentum');
    });

    test('SHORT方向止损应该在入场价上方', () => {
      const result = manager.calculateInitialPlus(
        62000,
        'SHORT',
        100,
        'med',
        'momentum'
      );

      expect(result.initialSL).toBeGreaterThan(62000);
      expect(result.tp).toBeLessThan(62000);
    });

    test('High置信度止损应该更紧', () => {
      const resultHigh = manager.calculateInitialPlus(62000, 'LONG', 100, 'high', 'momentum');
      const resultMed = manager.calculateInitialPlus(62000, 'LONG', 100, 'med', 'momentum');

      const distanceHigh = 62000 - resultHigh.initialSL;
      const distanceMed = 62000 - resultMed.initialSL;

      expect(distanceHigh).toBeLessThan(distanceMed);
    });

    test('Pullback模式止损应该更紧', () => {
      const resultPullback = manager.calculateInitialPlus(62000, 'LONG', 100, 'med', 'pullback');
      const resultBreakout = manager.calculateInitialPlus(62000, 'LONG', 100, 'med', 'breakout');

      const distancePullback = 62000 - resultPullback.initialSL;
      const distanceBreakout = 62000 - resultBreakout.initialSL;

      expect(distancePullback).toBeLessThan(distanceBreakout);
    });

    test('Plus版TP应该是2.0倍（而非V3.1的1.3倍）', () => {
      const result = manager.calculateInitialPlus(62000, 'LONG', 100, 'med', 'momentum');
      
      // Med模式K=2.0, TP_factor=2.0
      // 止损距离 = 100 * 2.0 = 200
      // TP距离 = 200 * 2.0 = 400
      const stopDistance = 62000 - result.initialSL;
      const tpDistance = result.tp - 62000;

      expect(Math.abs(tpDistance / stopDistance - 2.0)).toBeLessThan(0.1);
    });
  });

  describe('shouldTimeStop', () => {
    test('60分钟内有盈利不应该止损', () => {
      const trade = {
        entry_time: new Date(Date.now() - 50 * 60 * 1000), // 50分钟前
        entry_price: 62000,
        current_price: 62500, // 有盈利
        trade_type: 'LONG'
      };

      const result = manager.shouldTimeStop(trade, {});
      expect(result.shouldStop).toBe(false);
    });

    test('60分钟后无盈利且动量反转应该止损', () => {
      const trade = {
        entry_time: new Date(Date.now() - 65 * 60 * 1000), // 65分钟前
        entry_price: 62000,
        current_price: 61900, // 无盈利
        trade_type: 'LONG'
      };

      const result = manager.shouldTimeStop(trade, {
        macdHist1h: 0.1,
        prevMacdHist1h: 0.5 // 减少80%，反转
      });

      expect(result.shouldStop).toBe(true);
      expect(result.reason).toBe('time_stop_with_momentum_reversal');
    });

    test('120分钟后无盈利应该减仓', () => {
      const trade = {
        entry_time: new Date(Date.now() - 125 * 60 * 1000), // 125分钟前
        entry_price: 62000,
        current_price: 61900,
        trade_type: 'LONG'
      };

      const result = manager.shouldTimeStop(trade, {});
      expect(result.shouldStop).toBe(true);
      expect(result.reason).toBe('extended_time_stop');
      expect(result.action).toBe('reduce_50_percent');
    });
  });
});

