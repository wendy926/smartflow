/**
 * V3.1早期趋势探测模块单元测试
 */

const EarlyTrendDetector = require('../src/strategies/v3-1-early-trend');

describe('EarlyTrendDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new EarlyTrendDetector();
  });

  describe('detect() - 早期趋势探测', () => {
    test('应该检测到早期多头趋势', () => {
      // 模拟1H K线数据（价格上涨趋势）
      const klines1H = generateMockKlines(50, 100, 110, true);
      
      // 模拟4H K线数据
      const klines4H = generateMockKlines(200, 95, 105, false);

      const result = detector.detect(klines1H, klines4H);

      expect(result.detected).toBe(true);
      expect(result.signalType).toBe('EARLY_LONG');
      expect(result.weightBonus).toBe(0.1);
      expect(result.indicators.macdHist).toBeGreaterThan(0.5);
      expect(result.indicators.delta1H).toBeGreaterThan(0);
    });

    test('应该检测到早期空头趋势', () => {
      // 模拟1H K线数据（价格下跌趋势）
      const klines1H = generateMockKlines(50, 110, 100, false);
      
      // 模拟4H K线数据
      const klines4H = generateMockKlines(200, 105, 95, false);

      const result = detector.detect(klines1H, klines4H);

      expect(result.detected).toBe(true);
      expect(result.signalType).toBe('EARLY_SHORT');
      expect(result.weightBonus).toBe(0.1);
      expect(result.indicators.macdHist).toBeLessThan(-0.5);
      expect(result.indicators.delta1H).toBeLessThan(0);
    });

    test('应该在数据不足时返回false', () => {
      const klines1H = generateMockKlines(30, 100, 110, true); // 数据不足
      const klines4H = generateMockKlines(200, 100, 110, true);

      const result = detector.detect(klines1H, klines4H);

      expect(result.detected).toBe(false);
      expect(result.reason).toContain('Insufficient');
    });

    test('应该在条件不满足时返回false', () => {
      // 模拟横盘数据
      const klines1H = generateMockKlines(50, 100, 100.5, false, 0.001);
      const klines4H = generateMockKlines(200, 100, 100.5, false, 0.001);

      const result = detector.detect(klines1H, klines4H);

      expect(result.detected).toBe(false);
      expect(result.reason).toContain('No early trend pattern detected');
    });
  });

  describe('updateParams() - 参数更新', () => {
    test('应该正确更新参数', () => {
      const newParams = {
        macdHistThreshold: 0.6,
        deltaThreshold: 0.06
      };

      detector.updateParams(newParams);
      const params = detector.getParams();

      expect(params.macdHistThreshold).toBe(0.6);
      expect(params.deltaThreshold).toBe(0.06);
    });
  });

  describe('getParams() - 获取参数', () => {
    test('应该返回当前参数', () => {
      const params = detector.getParams();

      expect(params).toHaveProperty('macdHistThreshold');
      expect(params).toHaveProperty('deltaThreshold');
      expect(params).toHaveProperty('adxMin');
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
 * @returns {Array} K线数组
 */
function generateMockKlines(count, startPrice, endPrice, increasing = true, volatility = 0.01) {
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
    
    const volume = 1000000 * (1 + (increasing ? 0.5 : -0.5) * (i / count));

    klines.push([
      Date.now() - (count - i) * 60 * 60 * 1000, // timestamp
      open.toFixed(8),                            // open
      high.toFixed(8),                            // high
      low.toFixed(8),                             // low
      close.toFixed(8),                           // close
      volume.toFixed(8),                          // volume
      Date.now() - (count - i - 1) * 60 * 60 * 1000, // close time
      '0',                                        // quote asset volume
      0,                                          // number of trades
      '0',                                        // taker buy base asset volume
      '0',                                        // taker buy quote asset volume
      '0'                                         // ignore
    ]);
  }

  return klines;
}

