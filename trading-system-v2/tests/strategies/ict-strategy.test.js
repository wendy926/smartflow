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
      getTickerStream: jest.fn(),
      get24hrTicker: jest.fn(),
      getFundingRate: jest.fn()
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

    ictStrategy = new ICTStrategy();
    ictStrategy.binanceAPI = mockBinanceAPI;
    ictStrategy.database = mockDatabase;
    ictStrategy.cache = mockCache;

    // 设置默认的mock返回值
    mockBinanceAPI.getKlines.mockResolvedValue(createMockKlines(50, 50000));
    mockBinanceAPI.get24hrTicker.mockResolvedValue({
      lastPrice: '50000',
      volume: '1000000'
    });
    mockBinanceAPI.getFundingRate.mockResolvedValue(0.0001);
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
      const result = await ictStrategy.analyzeDailyTrend('BTCUSDT');

      // Assert
      expect(result.trend).toBe('UP');
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
      const result = await ictStrategy.analyzeDailyTrend('BTCUSDT');

      // Assert
      expect(result.trend).toBe('DOWN');
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
      const result = await ictStrategy.analyzeDailyTrend('BTCUSDT');

      // Assert
      expect(result.trend).toBe('RANGE');
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
      expect(result).toHaveLength(50); // 与输入长度相同
      expect(result[13]).toBeGreaterThan(0); // 第14个值（索引13）应该是有效的ATR值
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

      // 创建吞没形态：前一根为阴线，当前为阳线且完全吞没
      const i = 25; // 中间位置
      klines4h[i - 1][1] = '50050'; // 前一根开盘价
      klines4h[i - 1][4] = '49950'; // 前一根收盘价（阴线）
      klines4h[i][1] = '49940';   // 当前开盘价（低于前一根收盘价）
      klines4h[i][4] = '50060';   // 当前收盘价（高于前一根开盘价，完全吞没）

      mockBinanceAPI.getKlines.mockResolvedValue(klines4h);

      // Act
      const result = await ictStrategy.detectOrderBlocks(klines4h, atr4h, maxAgeDays);

      // Assert
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      result.forEach(ob => {
        expect(ob).toHaveProperty('low');
        expect(ob).toHaveProperty('high');
        expect(ob).toHaveProperty('timestamp');
        expect(ob).toHaveProperty('age');
        expect(ob.high - ob.low).toBeGreaterThanOrEqual(0.25 * atr4h);
        expect(ob.age).toBeLessThanOrEqual(maxAgeDays);
      });
    });

    test('应该过滤掉高度不足的订单块', async () => {
      // Arrange
      const klines4h = Array(50).fill().map(() => Array(6).fill(0));
      const atr4h = 200;
      const maxAgeDays = 30;

      // 模拟小订单块：高度 < 0.25 * ATR，且没有吞没形态
      for (let i = 0; i < klines4h.length; i++) {
        const high = 50000 + 20; // 高度40，不满足条件
        const low = 50000 - 20;
        klines4h[i][2] = high.toFixed(8); // high
        klines4h[i][3] = low.toFixed(8);  // low
        klines4h[i][0] = Date.now() - (klines4h.length - i) * 4 * 60 * 60 * 1000; // 时间戳
        klines4h[i][1] = '50000'; // 开盘价
        klines4h[i][4] = '50000'; // 收盘价（没有吞没形态）
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
        { high: 50060, close: 49890 }  // 明显跌破极端点 (49890 < 50000 * 0.998 = 49900)
      ];
      const atr4h = 200;

      // Act
      const result = await ictStrategy.detectSweepHTF(extreme, bars, atr4h);

      // Assert
      expect(result.detected).toBe(true);
    });

    test('应该正确检测Sweep宏观速率失败情况', async () => {
      // Arrange
      const extreme = 50000;
      const bars = [
        { high: 50100, close: 50050 }, // 刺破但收回太慢
        { high: 50080, close: 50020 },
        { high: 50060, close: 50020 },
        { high: 50040, close: 50020 },
        { high: 50020, low: 50010, close: 50035 }  // 没有突破极值点，也没有跌破低点
      ];
      const atr4h = 200;

      // Act
      const result = await ictStrategy.detectSweepHTF(extreme, bars, atr4h);

      // Assert
      expect(result.detected).toBe(false);
    });
  });

  describe('15m入场确认', () => {
    test('应该正确检测吞没形态', async () => {
      // Arrange
      const prevCandle = { open: 50000, close: 49900 }; // 下跌K线
      const currCandle = { open: 49890, close: 50100 }; // 上涨K线，吞没前一根
      const atr15 = 100;
      const trend = 'up';

      // Act
      const result = ictStrategy.detectEngulfingPattern([prevCandle, currCandle]);

      // Assert
      expect(result.detected).toBe(true);
    });

    test('应该正确检测吞没形态失败情况', async () => {
      // Arrange
      const prevCandle = { open: 50000, close: 49900 }; // 下跌K线
      const currCandle = { open: 49900, close: 50000 }; // 上涨K线，但实体太小
      const atr15 = 100;
      const trend = 'up';

      // Act
      const result = ictStrategy.detectEngulfingPattern([prevCandle, currCandle]);

      // Assert
      expect(result.detected).toBe(false);
    });

    test('应该正确检测Sweep微观速率', async () => {
      // Arrange
      const extreme = 50000;
      const bars = [
        { high: 50100, low: 50000, close: 50050 }, // 刺破并收回
        { high: 50080, low: 50010, close: 50020 },
        { high: 50060, low: 50020, close: 50030 },
        { high: 50040, low: 50015, close: 50025 },
        { high: 50060, low: 50020, close: 50300 }  // 明显突破最高点 (50300 > 50100 * 1.002 = 50200.2)
      ];
      const atr15 = 100;

      // Act
      const result = ictStrategy.detectSweepLTF(bars, atr15);

      // Assert
      expect(result.detected).toBe(true);
    });

    test('应该正确检测Sweep微观速率失败情况', async () => {
      // Arrange
      const extreme = 50000;
      const bars = [
        { high: 50100, low: 50000, close: 50050 }, // 刺破但收回太慢
        { high: 50080, low: 50010, close: 50020 },
        { high: 50060, low: 50020, close: 50020 },
        { high: 50040, low: 50015, close: 50020 },
        { high: 50020, low: 50000, close: 49950 }  // 没有明显跌破最低点 (49950 > 50000 * 0.998 = 49900)
      ];
      const atr15 = 100;

      // Act
      const result = ictStrategy.detectSweepLTF(bars, atr15);

      // Assert
      expect(result.detected).toBe(false);
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
      const result = await ictStrategy.execute(symbol);

      // Assert
      expect(result).toHaveProperty('signal');
      expect(result).toHaveProperty('confidence');
      expect(['BUY', 'SELL', 'HOLD']).toContain(result.signal);
    });
  });

  describe('止盈止损逻辑', () => {
    test('应该正确计算上升趋势止损', async () => {
      // Arrange
      const orderBlock = { low: 49900, high: 50100 };
      const atr4h = 200;
      const trend = 'UP';
      const recentLows = [49800, 49850, 49900];

      // Mock K线数据
      const mockKlines = createMockKlines(50, 50000);
      mockBinanceAPI.getKlines.mockResolvedValue(mockKlines);

      // Act
      const result = await ictStrategy.calculateTradeParameters('BTCUSDT', trend, {});

      // Debug
      console.log('ICT trade params result:', result);

      // Assert
      expect(result.stopLoss).toBeGreaterThan(0); // 止损应该大于0
      expect(result.stopLoss).toBeCloseTo(49712, -4); // 基于ATR计算的止损
    });

    test('应该正确计算下降趋势止损', async () => {
      // Arrange
      const orderBlock = { low: 49900, high: 50100 };
      const atr4h = 200;
      const trend = 'DOWN';
      const recentHighs = [50200, 50150, 50100];

      // Mock K线数据
      const mockKlines = createMockKlines(50, 50000);
      mockBinanceAPI.getKlines.mockResolvedValue(mockKlines);

      // Act
      const result = await ictStrategy.calculateTradeParameters('BTCUSDT', trend, {});

      // Assert
      expect(result.stopLoss).toBeGreaterThan(0); // 止损应该大于0
      expect(result.stopLoss).toBeGreaterThan(50000); // 下降趋势的止损应该高于入场价
    });

    test('应该正确计算止盈目标', async () => {
      // Arrange
      const entryPrice = 50000;
      const stopLoss = 49000;
      const riskRewardRatio = 3;

      // Mock K线数据
      const mockKlines = createMockKlines(50, 50000);
      mockBinanceAPI.getKlines.mockResolvedValue(mockKlines);

      // Act
      const result = await ictStrategy.calculateTradeParameters('BTCUSDT', 'UP', {});

      // Assert
      expect(result.takeProfit).toBeGreaterThan(0); // 止盈价格应该大于0
      expect(result.stopLoss).toBeGreaterThan(0); // 止损价格应该大于0
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
      expect(result).toHaveProperty('strategy', 'ICT');
      expect(result).toHaveProperty('timeframe', '15m');
      expect(result).toHaveProperty('trend');
      expect(result).toHaveProperty('signal');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('reasons');
      expect(['UP', 'DOWN', 'RANGE']).toContain(result.trend);
      expect(['BUY', 'SELL', 'HOLD']).toContain(result.signal);
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
        symbol: 'BTCUSDT',
        strategy: 'ICT',
        timeframe: '15m',
        trend: 'RANGE',
        signal: 'HOLD',
        confidence: 0.3,
        score: 15,
        reasons: 'HTF Sweep: LIQUIDITY_SWEEP_UP (100.0%)',
        tradeParams: {
          entry: 50000,
          leverage: 1.2,
          risk: 0.02,
          stopLoss: 0,
          takeProfit: 0
        },
        orderBlocks: [],
        signals: {
          engulfing: { detected: false, strength: 0, type: null },
          sweepHTF: { detected: true, type: 'LIQUIDITY_SWEEP_UP', level: 0, confidence: 1 },
          sweepLTF: { detected: false, type: null, level: 0, confidence: 0 }
        },
        timestamp: new Date().toISOString()
      };

      mockCache.get.mockResolvedValue(JSON.stringify(cachedResult));

      // Act
      const result = await ictStrategy.execute(symbol);

      // Assert - 检查关键属性而不是完全匹配
      expect(result.strategy).toBe(cachedResult.strategy);
      expect(result.symbol).toBe(cachedResult.symbol);
      expect(result.timeframe).toBe(cachedResult.timeframe);
      expect(result.trend).toBe(cachedResult.trend);
      expect(result.signal).toBe(cachedResult.signal);
      expect(result.confidence).toBe(cachedResult.confidence);
      expect(result.score).toBe(cachedResult.score);
      expect(result.reasons).toBe(cachedResult.reasons);
      expect(result.tradeParams.entry).toBe(cachedResult.tradeParams.entry);
      expect(result.tradeParams.leverage).toBe(cachedResult.tradeParams.leverage);
      expect(result.tradeParams.risk).toBe(cachedResult.tradeParams.risk);
      expect(result.orderBlocks).toEqual(cachedResult.orderBlocks);
      expect(result.signals).toEqual(cachedResult.signals);
      expect(mockBinanceAPI.getKlines).toHaveBeenCalledTimes(0); // 使用缓存，不调用API
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
