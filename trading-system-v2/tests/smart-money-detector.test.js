/**
 * 聪明钱检测器单元测试
 */

const SmartMoneyDetector = require('../src/services/smart-money-detector');

describe('SmartMoneyDetector', () => {
  let detector;
  let mockDatabase;

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn()
    };
    detector = new SmartMoneyDetector(mockDatabase);
  });

  describe('_calculateOBI', () => {
    test('应该正确计算订单簿失衡', () => {
      const mockDepth = {
        bids: [
          ['100', '10'],
          ['99', '20'],
          ['98', '15']
        ],
        asks: [
          ['101', '5'],
          ['102', '10'],
          ['103', '8']
        ]
      };

      const obi = detector._calculateOBI(mockDepth, 3);
      
      // bids: 10+20+15=45, asks: 5+10+8=23
      expect(obi).toBe(22);
    });

    test('应该处理空订单簿', () => {
      const emptyDepth = {
        bids: [],
        asks: []
      };

      const obi = detector._calculateOBI(emptyDepth, 20);
      expect(obi).toBe(0);
    });

    test('应该只计算topN档位', () => {
      const mockDepth = {
        bids: Array(50).fill(['100', '10']),
        asks: Array(50).fill(['101', '10'])
      };

      const obi5 = detector._calculateOBI(mockDepth, 5);
      const obi20 = detector._calculateOBI(mockDepth, 20);

      expect(obi5).toBe(0); // 5*10 - 5*10 = 0
      expect(obi20).toBe(0); // 20*10 - 20*10 = 0
    });
  });

  describe('_calculateCVD', () => {
    test('应该为上涨趋势计算正CVD', () => {
      const klines = generateMockKlines(50, 100, 110, true);
      const cvd = detector._calculateCVD(klines);

      expect(cvd).toBeGreaterThan(0);
    });

    test('应该为下跌趋势计算负CVD', () => {
      const klines = generateMockKlines(50, 110, 100, false);
      const cvd = detector._calculateCVD(klines);

      expect(cvd).toBeLessThan(0);
    });

    test('应该处理空K线数组', () => {
      const cvd = detector._calculateCVD([]);
      expect(cvd).toBe(0);
    });
  });

  describe('_computeShortTermTrend', () => {
    test('应该识别上涨趋势', () => {
      const klines15m = generateMockKlines(50, 100, 110, true);
      const klines1h = generateMockKlines(100, 100, 110, true);

      const trend = detector._computeShortTermTrend(klines15m, klines1h);

      expect(trend.shortTrend).toBe(1);
      expect(trend.medTrend).toBe(1);
      expect(trend.aligned).toBe(true);
    });

    test('应该识别下跌趋势', () => {
      const klines15m = generateMockKlines(50, 110, 100, false);
      const klines1h = generateMockKlines(100, 110, 100, false);

      const trend = detector._computeShortTermTrend(klines15m, klines1h);

      expect(trend.shortTrend).toBe(-1);
      expect(trend.medTrend).toBe(-1);
      expect(trend.aligned).toBe(true);
    });
  });

  describe('_mapScoreToAction', () => {
    test('应该检测拉升动作', () => {
      const action = detector._mapScoreToAction(
        0.7,        // score > 0.5
        10,         // priceChange > 0
        1.5,        // cvdZ > 0
        1000,       // oiChange > 0
        2.0         // obiZ > 0
      );

      expect(action).toBe('拉升');
    });

    test('应该检测吸筹动作', () => {
      const action = detector._mapScoreToAction(
        0.6,        // score > 0.5
        -1,         // priceChange <= 0
        1.5,        // cvdZ > 0
        1000,       // oiChange > 0
        1.0         // obiZ
      );

      expect(action).toBe('吸筹');
    });

    test('应该检测砸盘动作', () => {
      const action = detector._mapScoreToAction(
        -0.7,       // score < -0.5
        -10,        // priceChange < 0
        -1.5,       // cvdZ < 0
        500,        // oiChange > 0
        -2.0        // obiZ < 0
      );

      expect(action).toBe('砸盘');
    });

    test('应该检测派发动作', () => {
      const action = detector._mapScoreToAction(
        -0.6,       // score < -0.5
        1,          // priceChange >= 0
        -1.5,       // cvdZ < 0
        500,        // oiChange > 0
        -1.0        // obiZ
      );

      expect(action).toBe('派发');
    });

    test('应该返回观望当分数中性', () => {
      const action = detector._mapScoreToAction(0.2, 0, 0, 0, 0);
      expect(action).toBe('观望');
    });
  });

  describe('addToWatchList', () => {
    test('应该成功添加交易对', async () => {
      mockDatabase.query.mockResolvedValue({ affectedRows: 1 });

      const result = await detector.addToWatchList('ADAUSDT', 'test_user');

      expect(result).toBe(true);
      expect(mockDatabase.query).toHaveBeenCalled();
    });

    test('应该处理添加失败', async () => {
      mockDatabase.query.mockRejectedValue(new Error('Database error'));

      const result = await detector.addToWatchList('ADAUSDT');

      expect(result).toBe(false);
    });
  });

  describe('removeFromWatchList', () => {
    test('应该成功移除交易对', async () => {
      mockDatabase.query.mockResolvedValue({ affectedRows: 1 });

      const result = await detector.removeFromWatchList('ADAUSDT');

      expect(result).toBe(true);
      expect(mockDatabase.query).toHaveBeenCalled();
    });
  });

  describe('_sma', () => {
    test('应该正确计算简单移动平均', () => {
      const arr = [1, 2, 3, 4, 5];
      const mean = detector._sma(arr);

      expect(mean).toBe(3);
    });

    test('应该处理空数组', () => {
      const mean = detector._sma([]);
      expect(mean).toBe(0);
    });
  });

  describe('_std', () => {
    test('应该正确计算标准差', () => {
      const arr = [2, 4, 4, 4, 5, 5, 7, 9];
      const std = detector._std(arr);

      // 标准差约为2
      expect(std).toBeGreaterThan(1.5);
      expect(std).toBeLessThan(2.5);
    });

    test('应该处理空数组', () => {
      const std = detector._std([]);
      expect(std).toBe(0);
    });
  });
});

/**
 * 生成模拟K线数据
 */
function generateMockKlines(count, startPrice, endPrice, increasing = true) {
  const klines = [];
  const priceStep = (endPrice - startPrice) / count;

  for (let i = 0; i < count; i++) {
    const basePrice = startPrice + (priceStep * i);
    const randomVar = basePrice * 0.01 * (Math.random() - 0.5);
    
    const open = basePrice + randomVar;
    const close = increasing 
      ? basePrice + Math.abs(randomVar) 
      : basePrice - Math.abs(randomVar);
    const high = Math.max(open, close) * 1.01;
    const low = Math.min(open, close) * 0.99;
    
    const volume = 1000000 * (1 + (increasing ? 0.5 : -0.5) * (i / count));

    klines.push([
      Date.now() - (count - i) * 15 * 60 * 1000,
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

