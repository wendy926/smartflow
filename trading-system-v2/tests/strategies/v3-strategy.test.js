/**
 * 策略V3单测 - 测试驱动开发
 * 基于strategy-comparison.md中的V3策略逻辑
 */

const V3Strategy = require('../../src/strategies/v3-strategy');
const { createMockKlines, createMockSymbol } = require('../setup');

describe('策略V3 - 趋势交易策略', () => {
  let v3Strategy;
  let mockBinanceAPI;
  let mockDatabase;
  let mockCache;

  beforeEach(() => {
    // 模拟Binance API
    mockBinanceAPI = {
      getKlines: jest.fn(),
      getPremiumIndex: jest.fn(),
      getOpenInterestHist: jest.fn(),
      getTicker24hr: jest.fn(),
      getAggTradeStream: jest.fn()
    };

    // 模拟数据库
    mockDatabase = {
      query: jest.fn(),
      execute: jest.fn()
    };

    // 模拟缓存
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn()
    };

    v3Strategy = new V3Strategy({
      binanceAPI: mockBinanceAPI,
      database: mockDatabase,
      cache: mockCache
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('4H趋势判断', () => {
    test('应该正确计算移动平均线', async () => {
      // Arrange
      const klines4h = createMockKlines(250, 50000);
      mockBinanceAPI.getKlines.mockResolvedValue(klines4h);

      // Act
      const result = await v3Strategy.calculateMA(klines4h, 20);

      // Assert
      expect(result).toHaveLength(231); // 250 - 20 + 1
      expect(result[0]).toBeCloseTo(50000, 0);
      expect(result[result.length - 1]).toBeCloseTo(50000, 0);
    });

    test('应该正确计算ADX指标', async () => {
      // Arrange
      const klines4h = createMockKlines(50, 50000);
      mockBinanceAPI.getKlines.mockResolvedValue(klines4h);

      // Act
      const result = await v3Strategy.calculateADX(klines4h, 14);

      // Assert
      expect(result).toHaveProperty('adx');
      expect(result).toHaveProperty('diPlus');
      expect(result).toHaveProperty('diMinus');
      expect(result.adx).toBeGreaterThanOrEqual(0);
      expect(result.adx).toBeLessThanOrEqual(100);
    });

    test('应该正确计算布林带宽度', async () => {
      // Arrange
      const klines4h = createMockKlines(50, 50000);
      mockBinanceAPI.getKlines.mockResolvedValue(klines4h);

      // Act
      const result = await v3Strategy.calculateBBW(klines4h, 20, 2);

      // Assert
      expect(result).toBeGreaterThan(0);
      expect(typeof result).toBe('number');
    });

    test('应该正确判断多头趋势', async () => {
      // Arrange
      const klines4h = createMockKlines(250, 50000);
      // 模拟上升趋势：收盘价 > MA20 > MA50 > MA200
      for (let i = 0; i < klines4h.length; i++) {
        const price = 50000 + i * 10; // 逐步上涨
        klines4h[i][4] = price.toFixed(8); // close
      }
      mockBinanceAPI.getKlines.mockResolvedValue(klines4h);

      // Act
      const result = await v3Strategy.judge4HTrend('BTCUSDT');

      // Assert
      expect(result.trend_direction).toBe('UP');
      expect(result.score).toBeGreaterThanOrEqual(4);
    });

    test('应该正确判断空头趋势', async () => {
      // Arrange
      const klines4h = createMockKlines(250, 50000);
      // 模拟下降趋势：收盘价 < MA20 < MA50 < MA200
      for (let i = 0; i < klines4h.length; i++) {
        const price = 50000 - i * 10; // 逐步下跌
        klines4h[i][4] = price.toFixed(8); // close
      }
      mockBinanceAPI.getKlines.mockResolvedValue(klines4h);

      // Act
      const result = await v3Strategy.judge4HTrend('BTCUSDT');

      // Assert
      expect(result.trend_direction).toBe('DOWN');
      expect(result.score).toBeGreaterThanOrEqual(4);
    });

    test('应该正确判断震荡趋势', async () => {
      // Arrange
      const klines4h = createMockKlines(250, 50000);
      // 模拟震荡趋势：价格在MA20附近波动
      for (let i = 0; i < klines4h.length; i++) {
        const price = 50000 + Math.sin(i * 0.1) * 100; // 正弦波动
        klines4h[i][4] = price.toFixed(8); // close
      }
      mockBinanceAPI.getKlines.mockResolvedValue(klines4h);

      // Act
      const result = await v3Strategy.judge4HTrend('BTCUSDT');

      // Assert
      expect(result.trend_direction).toBe('RANGE');
      expect(result.score).toBeLessThan(4);
    });
  });

  describe('1H多因子确认', () => {
    test('应该正确计算VWAP', async () => {
      // Arrange
      const klines1h = createMockKlines(50, 50000);
      mockBinanceAPI.getKlines.mockResolvedValue(klines1h);

      // Act
      const result = await v3Strategy.calculateVWAP(klines1h);

      // Assert
      expect(result).toBeGreaterThan(0);
      expect(typeof result).toBe('number');
    });

    test('应该正确计算OI变化率', async () => {
      // Arrange
      const oiHistory = [
        { sumOpenInterest: 1000000 },
        { sumOpenInterest: 1020000 }
      ];
      mockBinanceAPI.getOpenInterestHist.mockResolvedValue(oiHistory);

      // Act
      const result = await v3Strategy.calculateOIChange(oiHistory);

      // Assert
      expect(result).toBeCloseTo(0.02, 4); // 2%增长
    });

    test('应该正确计算Delta不平衡', async () => {
      // Arrange
      const aggTradeData = [
        { maker: false, q: '100' }, // 主动买单
        { maker: true, q: '80' },   // 主动卖单
        { maker: false, q: '120' }, // 主动买单
        { maker: true, q: '90' }    // 主动卖单
      ];

      // Act
      const result = await v3Strategy.calculateDelta(aggTradeData);

      // Assert
      expect(result).toBeCloseTo(0.1282, 4); // (220-170)/(220+170) = 0.1282
    });

    test('应该正确进行多因子打分', async () => {
      // Arrange
      const symbol = 'BTCUSDT';
      const trendDirection = 'UP';
      const mockData = {
        vwap: 50000,
        volume: 1000000,
        oiChange: 0.02,
        fundingRate: 0.0001,
        delta: 0.15
      };

      mockBinanceAPI.getKlines.mockResolvedValue(createMockKlines(50, 50000));
      mockBinanceAPI.getTicker24hr.mockResolvedValue({ volume: '1000000' });
      mockBinanceAPI.getOpenInterestHist.mockResolvedValue([
        { sumOpenInterest: 1000000 },
        { sumOpenInterest: 1020000 }
      ]);
      mockBinanceAPI.getPremiumIndex.mockResolvedValue({ lastFundingRate: '0.0001' });

      // Act
      const result = await v3Strategy.judge1HFactors(symbol, trendDirection);

      // Assert
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(6);
      expect(result.isValid).toBe(result.score >= 3);
    });
  });

  describe('15m入场执行', () => {
    test('应该正确计算EMA', async () => {
      // Arrange
      const klines15m = createMockKlines(50, 50000);
      mockBinanceAPI.getKlines.mockResolvedValue(klines15m);

      // Act
      const result = await v3Strategy.calculateEMA(klines15m, 20);

      // Assert
      expect(result).toHaveLength(50);
      expect(result[0]).toBeCloseTo(50000, 0);
    });

    test('应该正确计算ATR', async () => {
      // Arrange
      const klines15m = createMockKlines(50, 50000);
      mockBinanceAPI.getKlines.mockResolvedValue(klines15m);

      // Act
      const result = await v3Strategy.calculateATR(klines15m, 14);

      // Assert
      expect(result).toHaveLength(37); // 50 - 14 + 1
      expect(result[0]).toBeGreaterThan(0);
    });

    test('应该正确判断趋势市入场信号', async () => {
      // Arrange
      const symbol = 'BTCUSDT';
      const trendDirection = 'UP';
      const mockData = {
        vwap: 50000,
        factors: { score: 4 },
        ema20: 49900,
        ema50: 49800,
        atr: 200
      };

      mockBinanceAPI.getKlines.mockResolvedValue(createMockKlines(50, 50000));

      // Act
      const result = await v3Strategy.judge15mEntry(symbol, trendDirection, mockData);

      // Assert
      expect(result).toHaveProperty('entry_signal');
      expect(result).toHaveProperty('confidence_score');
      expect(['BUY', 'SELL', 'HOLD']).toContain(result.entry_signal);
    });

    test('应该正确判断震荡市假突破信号', async () => {
      // Arrange
      const symbol = 'BTCUSDT';
      const mockData = {
        bbw: 0.03, // 布林带收窄
        rangeHigh: 50500,
        rangeLow: 49500,
        prevClose: 49400, // 突破下轨
        lastClose: 49600  // 回到区间
      };

      mockBinanceAPI.getKlines.mockResolvedValue(createMockKlines(50, 50000));

      // Act
      const result = await v3Strategy.judge15mRangeBreakout(symbol, mockData);

      // Assert
      expect(result).toHaveProperty('entry_signal');
      expect(result).toHaveProperty('is_fake_breakout');
      expect(result.is_fake_breakout).toBe(true);
    });
  });

  describe('止盈止损逻辑', () => {
    test('应该正确计算趋势市止损', async () => {
      // Arrange
      const entryPrice = 50000;
      const atr = 200;
      const setupCandle = { high: 50200, low: 49800 };

      // Act
      const result = await v3Strategy.calculateStopLoss(entryPrice, atr, setupCandle, 'trend');

      // Assert
      expect(result).toBeLessThan(entryPrice);
      expect(result).toBeGreaterThan(0);
    });

    test('应该正确计算震荡市止损', async () => {
      // Arrange
      const entryPrice = 50000;
      const atr = 200;
      const rangeHigh = 50500;
      const rangeLow = 49500;

      // Act
      const result = await v3Strategy.calculateStopLoss(entryPrice, atr, null, 'range', rangeHigh, rangeLow);

      // Assert
      expect(result).toBeLessThan(entryPrice);
      expect(result).toBeGreaterThan(0);
    });

    test('应该正确计算止盈目标', async () => {
      // Arrange
      const entryPrice = 50000;
      const stopLoss = 49000;
      const riskRewardRatio = 2;

      // Act
      const result = await v3Strategy.calculateTakeProfit(entryPrice, stopLoss, riskRewardRatio);

      // Assert
      expect(result).toBeGreaterThan(entryPrice);
      expect(result).toBe(51000); // 50000 + (50000-49000) * 2
    });
  });

  describe('完整策略执行', () => {
    test('应该完整执行V3策略并返回结果', async () => {
      // Arrange
      const symbol = 'BTCUSDT';
      const mockSymbol = createMockSymbol(symbol);
      
      // 模拟所有API调用
      mockBinanceAPI.getKlines
        .mockResolvedValueOnce(createMockKlines(250, 50000)) // 4H
        .mockResolvedValueOnce(createMockKlines(50, 50000))  // 1H
        .mockResolvedValueOnce(createMockKlines(50, 50000)); // 15m
      
      mockBinanceAPI.getTicker24hr.mockResolvedValue({ volume: '1000000' });
      mockBinanceAPI.getOpenInterestHist.mockResolvedValue([
        { sumOpenInterest: 1000000 },
        { sumOpenInterest: 1020000 }
      ]);
      mockBinanceAPI.getPremiumIndex.mockResolvedValue({ lastFundingRate: '0.0001' });

      // Act
      const result = await v3Strategy.execute(symbol);

      // Assert
      expect(result).toHaveProperty('strategy_name', 'V3');
      expect(result).toHaveProperty('timeframe', '4H');
      expect(result).toHaveProperty('trend_direction');
      expect(result).toHaveProperty('entry_signal');
      expect(result).toHaveProperty('confidence_score');
      expect(result).toHaveProperty('indicators_data');
      expect(['UP', 'DOWN', 'RANGE']).toContain(result.trend_direction);
      expect(['BUY', 'SELL', 'HOLD']).toContain(result.entry_signal);
    });

    test('应该处理API调用失败的情况', async () => {
      // Arrange
      const symbol = 'BTCUSDT';
      mockBinanceAPI.getKlines.mockRejectedValue(new Error('API调用失败'));

      // Act & Assert
      await expect(v3Strategy.execute(symbol)).rejects.toThrow('API调用失败');
    });

    test('应该使用缓存数据避免重复计算', async () => {
      // Arrange
      const symbol = 'BTCUSDT';
      const cachedResult = {
        strategy_name: 'V3',
        timeframe: '4H',
        trend_direction: 'UP',
        entry_signal: 'BUY',
        confidence_score: 85.5,
        indicators_data: {},
        created_at: new Date()
      };
      
      mockCache.get.mockResolvedValue(JSON.stringify(cachedResult));

      // Act
      const result = await v3Strategy.execute(symbol);

      // Assert
      expect(result).toEqual(cachedResult);
      expect(mockBinanceAPI.getKlines).not.toHaveBeenCalled();
    });
  });

  describe('性能测试', () => {
    test('应该在合理时间内完成策略计算', async () => {
      // Arrange
      const symbol = 'BTCUSDT';
      const startTime = Date.now();
      
      // 模拟所有API调用
      mockBinanceAPI.getKlines.mockResolvedValue(createMockKlines(250, 50000));
      mockBinanceAPI.getTicker24hr.mockResolvedValue({ volume: '1000000' });
      mockBinanceAPI.getOpenInterestHist.mockResolvedValue([
        { sumOpenInterest: 1000000 },
        { sumOpenInterest: 1020000 }
      ]);
      mockBinanceAPI.getPremiumIndex.mockResolvedValue({ lastFundingRate: '0.0001' });

      // Act
      await v3Strategy.execute(symbol);
      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(5000); // 5秒内完成
    });
  });
});
