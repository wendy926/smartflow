/**
 * V3策略优化版本单元测试
 */

const V3StrategyOptimized = require('../src/strategies/v3-strategy-optimized');
const logger = require('../src/utils/logger');

describe('V3StrategyOptimized', () => {
  let strategy;

  beforeEach(() => {
    strategy = new V3StrategyOptimized();
  });

  describe('趋势置信度计算', () => {
    test('低ADX值应返回低置信度', () => {
      expect(strategy.computeTrendConfidence(15, true)).toBe(0.2);
      expect(strategy.computeTrendConfidence(15, false)).toBe(0.2);
    });

    test('中等ADX值应根据MACD对齐度返回不同置信度', () => {
      expect(strategy.computeTrendConfidence(25, true)).toBe(0.5);
      expect(strategy.computeTrendConfidence(25, false)).toBe(0.4);
    });

    test('高ADX值应返回高置信度', () => {
      expect(strategy.computeTrendConfidence(45, true)).toBe(0.9);
      expect(strategy.computeTrendConfidence(45, false)).toBe(0.6);
    });
  });

  describe('多因子去相关评分', () => {
    test('应正确计算去相关得分', () => {
      const factors = { vwap: 0.8, oi: 0.9, delta: 0.85 };
      const corrMatrix = [[1, 0.7, 0.6], [0.7, 1, 0.65], [0.6, 0.65, 1]];

      const result = strategy.decorrelatedScore(factors, corrMatrix);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    test('完全相关因子应返回较低得分', () => {
      const factors = { vwap: 1, oi: 1, delta: 1 };
      const corrMatrix = [[1, 1, 1], [1, 1, 1], [1, 1, 1]];

      const result = strategy.decorrelatedScore(factors, corrMatrix);
      expect(result).toBe(0);
    });
  });

  describe('趋势连续性验证', () => {
    test('连续趋势应返回true', () => {
      const trendSeries = ['UP', 'UP', 'UP'];
      expect(strategy.validateTrendPersistence(trendSeries)).toBe(true);
    });

    test('不连续趋势应返回false', () => {
      const trendSeries = ['UP', 'DOWN', 'UP'];
      expect(strategy.validateTrendPersistence(trendSeries)).toBe(false);
    });

    test('空数组应返回false', () => {
      expect(strategy.validateTrendPersistence([])).toBe(false);
    });
  });

  describe('确认收盘延迟机制', () => {
    test('BUY信号应验证价格上涨', () => {
      const closes = [100, 101, 102, 103];
      expect(strategy.confirmEntry('BUY', closes, 3)).toBe(true);
    });

    test('SELL信号应验证价格下跌', () => {
      const closes = [103, 102, 101, 100];
      expect(strategy.confirmEntry('SELL', closes, 3)).toBe(true);
    });

    test('价格波动应返回false', () => {
      const closes = [100, 99, 101, 100];
      expect(strategy.confirmEntry('BUY', closes, 3)).toBe(false);
    });

    test('价格先涨后跌应返回false', () => {
      const closes = [100, 101, 102, 101];
      expect(strategy.confirmEntry('BUY', closes, 3)).toBe(false);
    });
  });

  describe('自适应止损计算', () => {
    test('高置信度应使用更紧止损', () => {
      const entry = 100;
      const atr = 2;
      const highConfidence = 0.9;
      const lowConfidence = 0.3;

      const highStop = strategy.calcAdaptiveStop(entry, atr, highConfidence);
      const lowStop = strategy.calcAdaptiveStop(entry, atr, lowConfidence);

      expect(highStop).toBeLessThan(lowStop);
    });
  });

  describe('分层仓位管理', () => {
    test('应基于总得分和胜率计算仓位', () => {
      const baseRisk = 100;
      const totalScore = 80;
      const winRate = 0.7;

      const position = strategy.positionSizing(baseRisk, totalScore, winRate);
      expect(position).toBeGreaterThan(0);
      expect(position).toBeLessThanOrEqual(baseRisk);
    });
  });

  describe('成本感知过滤', () => {
    test('高预期回报应通过过滤', () => {
      expect(strategy.costAwareFilter(2.0, 0.5, 0.01)).toBe(true);
    });

    test('低预期回报应被过滤', () => {
      expect(strategy.costAwareFilter(1.0, 0.1, 0.01)).toBe(false);
    });
  });

  describe('波动率收缩检测', () => {
    test('应检测到BBW收缩', () => {
      const bbwSeries = [0.1, 0.1, 0.1, 0.05, 0.05, 0.05];
      const atrSeries = [2, 2, 2, 1.5, 1.5, 1.5];
      
      expect(strategy.detectVolatilityContraction(bbwSeries, atrSeries)).toBe(true);
    });

    test('应检测到ATR收缩', () => {
      const bbwSeries = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
      const atrSeries = [2, 2, 2, 1.0, 1.0, 1.0];
      
      expect(strategy.detectVolatilityContraction(bbwSeries, atrSeries)).toBe(true);
    });

    test('数据不足应返回false', () => {
      const bbwSeries = [0.1, 0.1];
      const atrSeries = [2, 2];

      expect(strategy.detectVolatilityContraction(bbwSeries, atrSeries)).toBe(false);
    });
  });

  describe('信号融合逻辑', () => {
    test('强信号条件应触发BUY', () => {
      const trend4H = { trend: 'UP', score: 8, trendPersistence: true };
      const factors1H = { score: 6, decorrelatedScore: 0.9 };
      const execution15M = { score: 5, structureScore: 2 };

      const signal = strategy.combineSignals(trend4H, factors1H, execution15M);
      expect(signal).toBe('BUY');
    });

    test('中等信号条件应触发SELL', () => {
      const trend4H = { trend: 'DOWN', score: 6, trendPersistence: true };
      const factors1H = { score: 5, decorrelatedScore: 0.8 };
      const execution15M = { score: 4, structureScore: 1 };

      const signal = strategy.combineSignals(trend4H, factors1H, execution15M);
      expect(signal).toBe('SELL');
    });

    test('趋势不连续应返回HOLD', () => {
      const trend4H = { trend: 'UP', score: 8, trendPersistence: false };
      const factors1H = { score: 6, decorrelatedScore: 0.9 };
      const execution15M = { score: 5, structureScore: 2 };

      const signal = strategy.combineSignals(trend4H, factors1H, execution15M);
      expect(signal).toBe('HOLD');
    });

    test('数据不完整应返回HOLD', () => {
      const signal = strategy.combineSignals(null, {}, {});
      expect(signal).toBe('HOLD');
    });
  });
});
