const StrategyV3Core = require('../modules/strategy/StrategyV3Core');

describe('4H趋势判断逻辑测试', () => {
  let strategyCore;
  let mockDatabase;

  beforeEach(() => {
    // 模拟数据库
    mockDatabase = {
      runQuery: jest.fn()
    };
    strategyCore = new StrategyV3Core(mockDatabase);
  });

  describe('趋势方向得分计算', () => {
    test('多头趋势：价格>MA20>MA50>MA200，多头得分3分', async () => {
      // 模拟K线数据：多头排列
      const mockKlines = generateMockKlines(250, {
        basePrice: 100,
        trend: 'bullish',
        ma20: 95,
        ma50: 90,
        ma200: 85
      });

      mockDatabase.runQuery.mockResolvedValue(mockKlines);

      const result = await strategyCore.analyze4HTrend('TESTUSDT');

      expect(result.bullScore).toBe(3);
      expect(result.bearScore).toBe(0);
      expect(result.direction).toBe('BULL');
    });

    test('空头趋势：价格<MA20<MA50<MA200，空头得分3分', async () => {
      // 模拟K线数据：空头排列
      const mockKlines = generateMockKlines(250, {
        basePrice: 80,
        trend: 'bearish',
        ma20: 85,
        ma50: 90,
        ma200: 95
      });

      mockDatabase.runQuery.mockResolvedValue(mockKlines);

      const result = await strategyCore.analyze4HTrend('TESTUSDT');

      expect(result.bullScore).toBe(0);
      expect(result.bearScore).toBe(3);
      expect(result.direction).toBe('BEAR');
    });

    test('震荡市：多头得分1分，空头得分1分，都不满足≥2分条件', async () => {
      // 模拟K线数据：震荡排列
      const mockKlines = generateMockKlines(250, {
        basePrice: 100,
        trend: 'sideways',
        ma20: 100,
        ma50: 100,
        ma200: 100
      });

      mockDatabase.runQuery.mockResolvedValue(mockKlines);

      const result = await strategyCore.analyze4HTrend('TESTUSDT');

      expect(result.bullScore).toBe(1); // 只有价格>MA20
      expect(result.bearScore).toBe(1); // 只有价格<MA20
      expect(result.direction).toBe(null);
      expect(result.trend4h).toBe('震荡市');
    });

    test('部分多头：价格>MA20>MA50但MA50<MA200，多头得分2分', async () => {
      // 模拟K线数据：部分多头排列
      const mockKlines = generateMockKlines(250, {
        basePrice: 100,
        trend: 'partial_bullish',
        ma20: 95,
        ma50: 90,
        ma200: 95 // MA50 < MA200
      });

      mockDatabase.runQuery.mockResolvedValue(mockKlines);

      const result = await strategyCore.analyze4HTrend('TESTUSDT');

      expect(result.bullScore).toBe(2); // 价格>MA20, MA20>MA50
      expect(result.bearScore).toBe(1); // 只有MA50<MA200
      expect(result.direction).toBe('BULL');
    });
  });

  describe('总分计算和最终判断', () => {
    test('总分≥4分：多头趋势，市场类型为趋势市', async () => {
      const mockKlines = generateMockKlines(250, {
        basePrice: 100,
        trend: 'bullish',
        ma20: 95,
        ma50: 90,
        ma200: 85,
        adx: 25, // 强趋势
        bbwExpanding: true,
        momentum: 0.01 // 1%动量
      });

      mockDatabase.runQuery.mockResolvedValue(mockKlines);

      const result = await strategyCore.analyze4HTrend('TESTUSDT');

      expect(result.score).toBeGreaterThanOrEqual(4);
      expect(result.trend4h).toBe('多头趋势');
      expect(result.marketType).toBe('趋势市');
    });

    test('总分<4分：震荡市', async () => {
      const mockKlines = generateMockKlines(250, {
        basePrice: 100,
        trend: 'partial_bullish',
        ma20: 95,
        ma50: 90,
        ma200: 95,
        adx: 15, // 弱趋势
        bbwExpanding: false,
        momentum: 0.001 // 0.1%动量
      });

      mockDatabase.runQuery.mockResolvedValue(mockKlines);

      const result = await strategyCore.analyze4HTrend('TESTUSDT');

      expect(result.score).toBeLessThan(4);
      expect(result.trend4h).toBe('震荡市');
      expect(result.marketType).toBe('震荡市');
    });
  });

  describe('边界条件测试', () => {
    test('数据不足：返回震荡市', async () => {
      mockDatabase.runQuery.mockResolvedValue([]);

      const result = await strategyCore.analyze4HTrend('TESTUSDT');

      expect(result.trend4h).toBe('震荡市');
      expect(result.marketType).toBe('震荡市');
      expect(result.error).toBe('数据不足');
    });

    test('ADX=20边界：应该得分', async () => {
      const mockKlines = generateMockKlines(250, {
        basePrice: 100,
        trend: 'bullish',
        ma20: 95,
        ma50: 90,
        ma200: 85,
        adx: 20, // 边界值
        bbwExpanding: true,
        momentum: 0.01
      });

      mockDatabase.runQuery.mockResolvedValue(mockKlines);

      const result = await strategyCore.analyze4HTrend('TESTUSDT');

      expect(result.score).toBeGreaterThanOrEqual(4);
    });

    test('动量0.5%边界：应该得分', async () => {
      const mockKlines = generateMockKlines(250, {
        basePrice: 100,
        trend: 'bullish',
        ma20: 95,
        ma50: 90,
        ma200: 85,
        adx: 25,
        bbwExpanding: true,
        momentum: 0.005 // 0.5%边界值
      });

      mockDatabase.runQuery.mockResolvedValue(mockKlines);

      const result = await strategyCore.analyze4HTrend('TESTUSDT');

      expect(result.score).toBeGreaterThanOrEqual(4);
    });
  });
});

// 辅助函数：生成模拟K线数据
function generateMockKlines(count, options = {}) {
  const {
    basePrice = 100,
    trend = 'sideways',
    ma20 = 95,
    ma50 = 90,
    ma200 = 85,
    adx = 20,
    bbwExpanding = true,
    momentum = 0.01
  } = options;

  const klines = [];
  const now = Date.now();
  const interval = 4 * 60 * 60 * 1000; // 4小时

  for (let i = 0; i < count; i++) {
    let price = basePrice;
    
    // 根据趋势调整价格
    if (trend === 'bullish') {
      price = basePrice + (count - i) * 0.1;
    } else if (trend === 'bearish') {
      price = basePrice - (count - i) * 0.1;
    } else if (trend === 'partial_bullish') {
      price = basePrice + Math.sin(i * 0.1) * 2;
    } else {
      price = basePrice + Math.sin(i * 0.1) * 1;
    }

    // 添加动量
    if (momentum > 0) {
      price = price * (1 + momentum);
    }

    const high = price * 1.01;
    const low = price * 0.99;
    const open = price * 0.999;
    const close = price;
    const volume = 1000 + Math.random() * 500;

    klines.push([
      now - (count - i) * interval, // timestamp
      open.toFixed(4),
      high.toFixed(4),
      low.toFixed(4),
      close.toFixed(4),
      volume.toFixed(4),
      now - (count - i) * interval + 1000, // close time
      '0', // quote asset volume
      10, // count
      0, // taker buy base asset volume
      0, // taker buy quote asset volume
      '0' // ignore
    ]);
  }

  return klines;
}
