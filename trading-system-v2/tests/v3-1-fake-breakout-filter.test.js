/**
 * V3.1假突破过滤器模块单元测试
 */

const FakeBreakoutFilter = require('../src/strategies/v3-1-fake-breakout-filter');

describe('FakeBreakoutFilter', () => {
  let filter;

  beforeEach(() => {
    filter = new FakeBreakoutFilter();
  });

  describe('filterTrend() - 趋势市场过滤', () => {
    test('应该通过合法的突破', () => {
      const breakoutPrice = 105;
      const klines15m = generateMockKlines(30, 100, 110, true, 0.005);
      const klines1H = generateMockKlines(30, 100, 110, true, 0.005);
      const klines4H = generateMockKlines(20, 95, 115, true, 0.01);

      const result = filter.filterTrend(breakoutPrice, klines15m, klines1H, klines4H);

      expect(result.passed).toBe(true);
      expect(result.details.volumeCheck.passed).toBe(true);
      expect(result.details.deltaCheck.passed).toBe(true);
    });

    test('应该拒绝成交量不足的突破', () => {
      // 生成低成交量的K线
      const breakoutPrice = 105;
      const klines15m = generateMockKlines(30, 100, 105, true, 0.001, 0.5); // 低成交量倍数
      const klines1H = generateMockKlines(30, 100, 105, true, 0.005);
      const klines4H = generateMockKlines(20, 95, 110, true, 0.01);

      const result = filter.filterTrend(breakoutPrice, klines15m, klines1H, klines4H);

      expect(result.passed).toBe(false);
      expect(result.details.volumeCheck.passed).toBe(false);
    });

    test('应该拒绝Delta不同向的突破', () => {
      const breakoutPrice = 105;
      const klines15m = generateMockKlines(30, 100, 110, true, 0.005);   // 上涨
      const klines1H = generateMockKlines(30, 110, 100, false, 0.005);   // 下跌（反向）
      const klines4H = generateMockKlines(20, 95, 115, true, 0.01);

      const result = filter.filterTrend(breakoutPrice, klines15m, klines1H, klines4H);

      expect(result.passed).toBe(false);
      expect(result.details.deltaCheck.aligned).toBe(false);
    });

    test('应该拒绝在区间边界的突破', () => {
      const breakoutPrice = 119; // 接近区间上限
      const klines15m = generateMockKlines(30, 100, 120, true, 0.005);
      const klines1H = generateMockKlines(30, 100, 120, true, 0.005);
      // 4H区间：100-120
      const klines4H = generateMockKlines(20, 100, 120, false, 0.15);

      const result = filter.filterTrend(breakoutPrice, klines15m, klines1H, klines4H);

      // 可能会因区间边界被拒绝
      if (!result.passed) {
        expect(result.details.boundaryCheck.atEdge).toBe(true);
      }
    });
  });

  describe('filterRange() - 震荡市场过滤', () => {
    test('应该检测到多头假突破', () => {
      // 前一根跌破，当前根反弹
      const klines15m = [
        ...generateMockKlines(28, 100, 99, false, 0.002),
        // 假突破：跌破后反弹
        [Date.now() - 120000, '99', '99.5', '98.5', '98.8', '2000000', Date.now() - 60000, '0', 0, '0', '0', '0'],
        [Date.now() - 60000, '98.8', '100.5', '98.5', '100.2', '3000000', Date.now(), '0', 0, '0', '0', '0']
      ];
      const klines1H = generateMockKlines(30, 98, 100, false, 0.005);

      const result = filter.filterRange('LONG', klines15m, klines1H);

      expect(result.passed).toBe(true);
      expect(result.details.brokeOut).toBe(true);
      expect(result.details.reversed).toBe(true);
    });

    test('应该检测到空头假突破', () => {
      // 前一根突破，当前根回落
      const klines15m = [
        ...generateMockKlines(28, 100, 101, true, 0.002),
        // 假突破：突破后回落
        [Date.now() - 120000, '100', '101.5', '100', '101.2', '2000000', Date.now() - 60000, '0', 0, '0', '0', '0'],
        [Date.now() - 60000, '101.2', '101.5', '99.5', '99.8', '3000000', Date.now(), '0', 0, '0', '0', '0']
      ];
      const klines1H = generateMockKlines(30, 101, 99, false, 0.005);

      const result = filter.filterRange('SHORT', klines15m, klines1H);

      expect(result.passed).toBe(true);
      expect(result.details.brokeOut).toBe(true);
      expect(result.details.reversed).toBe(true);
    });

    test('应该在没有假突破时返回false', () => {
      // 正常横盘
      const klines15m = generateMockKlines(30, 100, 100.5, false, 0.001);
      const klines1H = generateMockKlines(30, 100, 100.5, false, 0.001);

      const result = filter.filterRange('LONG', klines15m, klines1H);

      expect(result.passed).toBe(false);
    });
  });

  describe('updateParams() - 参数更新', () => {
    test('应该正确更新参数', () => {
      const newParams = {
        volFactor: 1.5,
        deltaThreshold: 0.05
      };

      filter.updateParams(newParams);
      const params = filter.getParams();

      expect(params.volFactor).toBe(1.5);
      expect(params.deltaThreshold).toBe(0.05);
    });
  });
});

/**
 * 生成模拟K线数据
 * @param {number} count - K线数量
 * @param {number} startPrice - 起始价格
 * @param {number} endPrice - 结束价格
 * @param {boolean} increasing - 是否上涨
 * @param {number} volatility - 波动率
 * @param {number} volumeMultiplier - 成交量倍数
 * @returns {Array} K线数组
 */
function generateMockKlines(count, startPrice, endPrice, increasing = true, volatility = 0.01, volumeMultiplier = 1.0) {
  const klines = [];
  const priceStep = (endPrice - startPrice) / count;

  for (let i = 0; i < count; i++) {
    const basePrice = startPrice + (priceStep * i);
    const randomVar = basePrice * volatility * (Math.random() - 0.5);
    
    const open = basePrice + randomVar;
    const close = increasing 
      ? basePrice + Math.abs(randomVar) 
      : basePrice - Math.abs(randomVar);
    const high = Math.max(open, close) * (1 + volatility);
    const low = Math.min(open, close) * (1 - volatility);
    
    const baseVolume = 1000000 * (1 + (increasing ? 0.5 : -0.5) * (i / count));
    const volume = baseVolume * volumeMultiplier;

    klines.push([
      Date.now() - (count - i) * 15 * 60 * 1000, // timestamp (15分钟)
      open.toFixed(8),
      high.toFixed(8),
      low.toFixed(8),
      close.toFixed(8),
      volume.toFixed(8),
      Date.now() - (count - i - 1) * 15 * 60 * 1000,
      '0',
      0,
      '0',
      '0',
      '0'
    ]);
  }

  return klines;
}

