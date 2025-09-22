/**
 * ICT策略单测 - 测试驱动开发
 * 基于strategy-comparison.md中的ICT策略逻辑
 */

const ICTStrategy = require('../../src/strategies/ict-strategy');
const { createMockKlines, createMockSymbol } = require('../setup');

describe('ICT策略 - 订单块交易策略', () => {
  let ictStrategy;
  let mockBinanceAPI;
  let mockDatabase;
  let mockCache;

  beforeEach(() => {
    // 模拟Binance API
    mockBinanceAPI = {
      getKlines: jest.fn(),
      getExchangeInfo: jest.fn(),
      getTickerStream: jest.fn()
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

    ictStrategy = new ICTStrategy({
      binanceAPI: mockBinanceAPI,
      database: mockDatabase,
      cache: mockCache
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('1D趋势判断', () => {
    test('应该正确判断上升趋势', async () => {
      // Arrange
      const klines1d = createMockKlines(25, 50000);
      // 模拟上升趋势：最近20根日线收盘价末值 > 首值
      for (let i = 0; i < klines1d.length; i++) {
        const price = 50000 + i * 100; // 逐步上涨
        klines1d[i][4] = price.toFixed(8); // close
      }
      mockBinanceAPI.getKlines.mockResolvedValue(klines1d);

      // Act
      const result = await ictStrategy.detectTrend1D('BTCUSDT');

      // Assert
      expect(result).toBe('up');
    });

    test('应该正确判断下降趋势', async () => {
      // Arrange
      const klines1d = createMockKlines(25, 50000);
      // 模拟下降趋势：最近20根日线收盘价末值 < 首值
      for (let i = 0; i < klines1d.length; i++) {
        const price = 50000 - i * 100; // 逐步下跌
        klines1d[i][4] = price.toFixed(8); // close
      }
      mockBinanceAPI.getKlines.mockResolvedValue(klines1d);

      // Act
      const result = await ictStrategy.detectTrend1D('BTCUSDT');

      // Assert
      expect(result).toBe('down');
    });

    test('应该正确判断震荡趋势', async () => {
      // Arrange
      const klines1d = createMockKlines(25, 50000);
      // 模拟震荡趋势：价格在50000附近波动
      for (let i = 0; i < klines1d.length; i++) {
        const price = 50000 + Math.sin(i * 0.2) * 500; // 正弦波动
        klines1d[i][4] = price.toFixed(8); // close
      }
      mockBinanceAPI.getKlines.mockResolvedValue(klines1d);

      // Act
      const result = await ictStrategy.detectTrend1D('BTCUSDT');

      // Assert
      expect(result).toBe('sideways');
    });
  });

  describe('4H订单块检测', () => {
    test('应该正确计算ATR', async () => {
      // Arrange
      const klines4h = createMockKlines(50, 50000);
      mockBinanceAPI.getKlines.mockResolvedValue(klines4h);

      // Act
      const result = await ictStrategy.calculateATR(klines4h, 14);

      // Assert
      expect(result).toHaveLength(37); // 50 - 14 + 1
      expect(result[0]).toBeGreaterThan(0);
    });

    test('应该正确检测订单块', async () => {
      // Arrange
      const klines4h = createMockKlines(50, 50000);
      const atr4h = 200;
      const maxAgeDays = 30;

      // 模拟订单块：高度 >= 0.25 * ATR
      for (let i = 0; i < klines4h.length; i++) {
        const high = 50000 + 100; // 高度100，满足条件
        const low = 50000 - 100;
        klines4h[i][2] = high.toFixed(8); // high
        klines4h[i][3] = low.toFixed(8);  // low
        klines4h[i][0] = Date.now() - (klines4h.length - i) * 4 * 60 * 60 * 1000; // 时间戳
      }

      mockBinanceAPI.getKlines.mockResolvedValue(klines4h);

      // Act
      const result = await ictStrategy.detectOrderBlocks(klines4h, atr4h, maxAgeDays);

      // Assert
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      result.forEach(ob => {
        expect(ob).toHaveProperty('low');
        expect(ob).toHaveProperty('high');
        expect(ob).toHaveProperty('time');
        expect(ob).toHaveProperty('age');
        expect(ob.high - ob.low).toBeGreaterThanOrEqual(0.25 * atr4h);
        expect(ob.age).toBeLessThanOrEqual(maxAgeDays);
      });
    });

    test('应该过滤掉高度不足的订单块', async () => {
      // Arrange
      const klines4h = createMockKlines(50, 50000);
      const atr4h = 200;
      const maxAgeDays = 30;

      // 模拟小订单块：高度 < 0.25 * ATR
      for (let i = 0; i < klines4h.length; i++) {
        const high = 50000 + 20; // 高度40，不满足条件
        const low = 50000 - 20;
        klines4h[i][2] = high.toFixed(8); // high
        klines4h[i][3] = low.toFixed(8);  // low
        klines4h[i][0] = Date.now() - (klines4h.length - i) * 4 * 60 * 60 * 1000; // 时间戳
      }

      mockBinanceAPI.getKlines.mockResolvedValue(klines4h);

      // Act
      const result = await ictStrategy.detectOrderBlocks(klines4h, atr4h, maxAgeDays);

      // Assert
      expect(result).toHaveLength(0);
    });

    test('应该过滤掉年龄过大的订单块', async () => {
      // Arrange
      const klines4h = createMockKlines(50, 50000);
      const atr4h = 200;
      const maxAgeDays = 30;

      // 模拟老订单块：年龄 > 30天
      for (let i = 0; i < klines4h.length; i++) {
        const high = 50000 + 100; // 高度满足条件
        const low = 50000 - 100;
        klines4h[i][2] = high.toFixed(8); // high
        klines4h[i][3] = low.toFixed(8);  // low
        klines4h[i][0] = Date.now() - (klines4h.length - i) * 4 * 60 * 60 * 1000 - 35 * 24 * 60 * 60 * 1000; // 35天前
      }

      mockBinanceAPI.getKlines.mockResolvedValue(klines4h);

      // Act
      const result = await ictStrategy.detectOrderBlocks(klines4h, atr4h, maxAgeDays);

      // Assert
      expect(result).toHaveLength(0);
    });

    test('应该正确检测Sweep宏观速率', async () => {
      // Arrange
      const extreme = 50000;
      const bars = [
        { high: 50100, close: 50050 }, // 刺破并收回
        { high: 50080, close: 50020 },
        { high: 50060, close: 49980 }  // 跌破极端点
      ];
      const atr4h = 200;

      // Act
      const result = await ictStrategy.detectSweepHTF(extreme, bars, atr4h);

      // Assert
      expect(result).toBe(true);
    });

    test('应该正确检测Sweep宏观速率失败情况', async () => {
      // Arrange
      const extreme = 50000;
      const bars = [
        { high: 50100, close: 50050 }, // 刺破但收回太慢
        { high: 50080, close: 50020 },
        { high: 50060, close: 50020 },
        { high: 50040, close: 50020 },
        { high: 50020, close: 49980 }  // 5根K线才跌破
      ];
      const atr4h = 200;

      // Act
      const result = await ictStrategy.detectSweepHTF(extreme, bars, atr4h);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('15m入场确认', () => {
    test('应该正确检测吞没形态', async () => {
      // Arrange
      const prevCandle = { open: 50000, close: 49900 }; // 下跌K线
      const currCandle = { open: 49900, close: 50100 }; // 上涨K线，吞没前一根
      const atr15 = 100;
      const trend = 'up';

      // Act
      const result = await ictStrategy.isEngulfingPattern(prevCandle, currCandle, atr15, trend);

      // Assert
      expect(result).toBe(true);
    });

    test('应该正确检测吞没形态失败情况', async () => {
      // Arrange
      const prevCandle = { open: 50000, close: 49900 }; // 下跌K线
      const currCandle = { open: 49900, close: 50000 }; // 上涨K线，但实体太小
      const atr15 = 100;
      const trend = 'up';

      // Act
      const result = await ictStrategy.isEngulfingPattern(prevCandle, currCandle, atr15, trend);

      // Assert
      expect(result).toBe(false);
    });

    test('应该正确检测Sweep微观速率', async () => {
      // Arrange
      const extreme = 50000;
      const bars = [
        { high: 50100, close: 50050 }, // 刺破并收回
        { high: 50080, close: 50020 },
        { high: 50060, close: 49980 }  // 3根K线内跌破
      ];
      const atr15 = 100;

      // Act
      const result = await ictStrategy.detectSweepLTF(extreme, bars, atr15);

      // Assert
      expect(result).toBe(true);
    });

    test('应该正确检测Sweep微观速率失败情况', async () => {
      // Arrange
      const extreme = 50000;
      const bars = [
        { high: 50100, close: 50050 }, // 刺破但收回太慢
        { high: 50080, close: 50020 },
        { high: 50060, close: 50020 },
        { high: 50040, close: 50020 },
        { high: 50020, close: 49980 }  // 5根K线才跌破
      ];
      const atr15 = 100;

      // Act
      const result = await ictStrategy.detectSweepLTF(extreme, bars, atr15);

      // Assert
      expect(result).toBe(false);
    });

    test('应该正确判断15m入场条件', async () => {
      // Arrange
      const symbol = 'BTCUSDT';
      const trend = 'up';
      const orderBlocks = [
        { low: 49900, high: 50100, age: 1.5 }
      ];
      const mockData = {
        engulfing: true,
        sweep: true,
        volume: 1000000
      };

      mockBinanceAPI.getKlines.mockResolvedValue(createMockKlines(50, 50000));

      // Act
      const result = await ictStrategy.judge15mEntry(symbol, trend, orderBlocks, mockData);

      // Assert
      expect(result).toHaveProperty('entry_signal');
      expect(result).toHaveProperty('confidence_score');
      expect(['BUY', 'SELL', 'HOLD']).toContain(result.entry_signal);
    });
  });

  describe('止盈止损逻辑', () => {
    test('应该正确计算上升趋势止损', async () => {
      // Arrange
      const orderBlock = { low: 49900, high: 50100 };
      const atr4h = 200;
      const trend = 'up';
      const recentLows = [49800, 49850, 49900];

      // Act
      const result = await ictStrategy.calculateStopLoss(orderBlock, atr4h, trend, recentLows);

      // Assert
      expect(result).toBeLessThan(49900); // 应该在订单块下沿之下
      expect(result).toBeGreaterThan(0);
    });

    test('应该正确计算下降趋势止损', async () => {
      // Arrange
      const orderBlock = { low: 49900, high: 50100 };
      const atr4h = 200;
      const trend = 'down';
      const recentHighs = [50200, 50150, 50100];

      // Act
      const result = await ictStrategy.calculateStopLoss(orderBlock, atr4h, trend, null, recentHighs);

      // Assert
      expect(result).toBeGreaterThan(50100); // 应该在订单块上沿之上
      expect(result).toBeGreaterThan(0);
    });

    test('应该正确计算止盈目标', async () => {
      // Arrange
      const entryPrice = 50000;
      const stopLoss = 49000;
      const riskRewardRatio = 3;

      // Act
      const result = await ictStrategy.calculateTakeProfit(entryPrice, stopLoss, riskRewardRatio);

      // Assert
      expect(result).toBeGreaterThan(entryPrice);
      expect(result).toBe(53000); // 50000 + (50000-49000) * 3
    });
  });

  describe('完整策略执行', () => {
    test('应该完整执行ICT策略并返回结果', async () => {
      // Arrange
      const symbol = 'BTCUSDT';
      const mockSymbol = createMockSymbol(symbol);
      
      // 模拟所有API调用
      mockBinanceAPI.getKlines
        .mockResolvedValueOnce(createMockKlines(25, 50000)) // 1D
        .mockResolvedValueOnce(createMockKlines(50, 50000)) // 4H
        .mockResolvedValueOnce(createMockKlines(50, 50000)); // 15m
      
      mockBinanceAPI.getExchangeInfo.mockResolvedValue({ symbols: [{ symbol: 'BTCUSDT' }] });

      // Act
      const result = await ictStrategy.execute(symbol);

      // Assert
      expect(result).toHaveProperty('strategy_name', 'ICT');
      expect(result).toHaveProperty('timeframe', '1D');
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
      await expect(ictStrategy.execute(symbol)).rejects.toThrow('API调用失败');
    });

    test('应该使用缓存数据避免重复计算', async () => {
      // Arrange
      const symbol = 'BTCUSDT';
      const cachedResult = {
        strategy_name: 'ICT',
        timeframe: '1D',
        trend_direction: 'UP',
        entry_signal: 'BUY',
        confidence_score: 85.5,
        indicators_data: {},
        created_at: new Date()
      };
      
      mockCache.get.mockResolvedValue(JSON.stringify(cachedResult));

      // Act
      const result = await ictStrategy.execute(symbol);

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
      mockBinanceAPI.getKlines.mockResolvedValue(createMockKlines(50, 50000));
      mockBinanceAPI.getExchangeInfo.mockResolvedValue({ symbols: [{ symbol: 'BTCUSDT' }] });

      // Act
      await ictStrategy.execute(symbol);
      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(5000); // 5秒内完成
    });
  });
});
