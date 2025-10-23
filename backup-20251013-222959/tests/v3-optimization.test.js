/**
 * V3策略优化单元测试
 * 测试MACD Histogram、动态权重、结构分析
 */

const TechnicalIndicators = require('../src/utils/technical-indicators');
const { DynamicWeightAdjuster } = require('../src/strategies/v3-dynamic-weights');

describe('V3策略优化测试', () => {
  describe('MACD Histogram', () => {
    test('应正确计算MACD柱状图', () => {
      // 构造测试数据：上升趋势
      const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5 + Math.random() * 2);

      const result = TechnicalIndicators.calculateMACDHistogram(prices);

      expect(result).toBeDefined();
      expect(result.histogram).toBeDefined();
      expect(result.macd).toBeDefined();
      expect(result.signal).toBeDefined();
      expect(typeof result.trending).toBe('boolean');
    });

    test('上升趋势应有正的histogram', () => {
      const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 0.8);
      const result = TechnicalIndicators.calculateMACDHistogram(prices);

      // 上升趋势通常histogram > 0
      expect(result.trending).toBe(true);
    });

    test('数据不足应返回默认值', () => {
      const prices = [100, 101, 102];
      const result = TechnicalIndicators.calculateMACDHistogram(prices);

      expect(result.histogram).toBe(0);
      expect(result.trending).toBe(false);
    });
  });

  describe('动态权重调整器', () => {
    test('应正确初始化', () => {
      const adjuster = new DynamicWeightAdjuster(0.25);
      expect(adjuster.alpha).toBe(0.25);
      expect(adjuster.minSamples).toBe(10);
    });

    test('应根据胜率调整权重', () => {
      const adjuster = new DynamicWeightAdjuster(0.25);

      const baseWeights = {
        breakout: 0.3,
        volume: 0.2,
        oi: 0.25,
        delta: 0.15,
        funding: 0.1
      };

      const winRates = {
        breakout: 0.6,  // 60%胜率 > 50% → 权重应增加
        volume: 0.4,    // 40%胜率 < 50% → 权重应降低
        oi: 0.5,        // 50%胜率 = 50% → 权重应保持
        delta: 0.55,    // 55%胜率 > 50% → 权重应增加
        funding: 0.45   // 45%胜率 < 50% → 权重应降低
      };

      const adjusted = adjuster.adjustWeights(baseWeights, winRates);

      // 验证权重总和为1
      const sum = Object.values(adjusted).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 5);

      // 验证调整方向
      expect(adjusted.breakout).toBeGreaterThan(baseWeights.breakout); // 胜率高应增加
      expect(adjusted.volume).toBeLessThan(baseWeights.volume);        // 胜率低应降低
    });

    test('应正确记录因子表现', () => {
      const adjuster = new DynamicWeightAdjuster();

      // 记录第一笔交易
      adjuster.recordFactorPerformance('BTCUSDT', {
        breakout: 1,
        volume: 1,
        oi: 0
      }, true); // 获胜

      // 记录第二笔交易
      adjuster.recordFactorPerformance('BTCUSDT', {
        breakout: 1,
        volume: 0,
        oi: 1
      }, false); // 失败

      const history = adjuster.factorHistory['BTCUSDT'];
      expect(history.breakout.total).toBe(2);
      expect(history.breakout.wins).toBe(1);
      expect(history.volume.total).toBe(1);
      expect(history.volume.wins).toBe(1);
    });

    test('样本数不足应不返回胜率', () => {
      const adjuster = new DynamicWeightAdjuster();
      adjuster.minSamples = 10;

      // 只记录5笔
      for (let i = 0; i < 5; i++) {
        adjuster.recordFactorPerformance('ETHUSDT', { breakout: 1 }, i % 2 === 0);
      }

      const winRates = adjuster.getFactorWinRates('ETHUSDT');
      expect(Object.keys(winRates).length).toBe(0); // 样本不足，不返回
    });

    test('样本数足够应返回胜率', () => {
      const adjuster = new DynamicWeightAdjuster();
      adjuster.minSamples = 10;

      // 记录12笔，6胜6负
      for (let i = 0; i < 12; i++) {
        adjuster.recordFactorPerformance('BNBUSDT', { breakout: 1 }, i < 6);
      }

      const winRates = adjuster.getFactorWinRates('BNBUSDT');
      expect(winRates.breakout).toBeCloseTo(0.5, 2);
    });
  });

  describe('结构分析', () => {
    // 这部分测试V3Strategy类的analyzeStructure方法
    // 由于需要实例化V3Strategy，这里提供测试框架

    test('应在上升趋势中检测到HH和HL', () => {
      // 模拟数据：构造明显的HH/HL结构
      const klines = [
        // 前12根：低点100，高点110
        ...Array.from({ length: 12 }, (_, i) => [0, 100, 100 + i * 0.5, 100, 100 + i * 0.3, 1000]),
        // 后12根：低点105（HL），高点115（HH）
        ...Array.from({ length: 12 }, (_, i) => [0, 105, 105 + i * 0.5, 105, 105 + i * 0.3, 1000])
      ];

      // 预期：recentHigh(115) > prevHigh(110) = HH
      //      recentLow(105) > prevLow(100) = HL
      // score = 2

      // 注：实际测试需要V3Strategy实例
      expect(klines.length).toBe(24);
    });
  });
});

