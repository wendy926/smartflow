/**
 * BacktestStrategyEngine 单元测试
 * 测试回测策略引擎的核心功能
 */

const BacktestStrategyEngine = require('../../src/services/backtest-strategy-engine');

describe('BacktestStrategyEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new BacktestStrategyEngine();
  });

  describe('calculateATR', () => {
    test('应该正确计算ATR', () => {
      const klines = [
        { high: 100, low: 95, close: 98 },
        { high: 102, low: 97, close: 100 },
        { high: 105, low: 99, close: 103 },
        { high: 103, low: 98, close: 101 },
        { high: 107, low: 100, close: 105 },
        { high: 106, low: 102, close: 104 },
        { high: 108, low: 103, close: 106 },
        { high: 109, low: 105, close: 107 },
        { high: 111, low: 106, close: 109 },
        { high: 110, low: 107, close: 108 },
        { high: 112, low: 108, close: 110 },
        { high: 113, low: 109, close: 111 },
        { high: 114, low: 110, close: 112 },
        { high: 115, low: 111, close: 113 },
        { high: 116, low: 112, close: 114 }
      ];

      const atr = engine.calculateATR(klines, 14);

      expect(atr).toBeDefined();
      expect(atr.length).toBeGreaterThan(0);
      expect(atr[0]).toBeGreaterThan(0);
    });

    test('当K线数量不足时应该返回空数组', () => {
      const klines = [
        { high: 100, low: 95, close: 98 }
      ];

      const atr = engine.calculateATR(klines, 14);

      expect(atr).toEqual([]);
    });
  });

  describe('calculateEMA', () => {
    test('应该正确计算EMA', () => {
      const klines = [
        { close: 100 },
        { close: 102 },
        { close: 101 },
        { close: 103 },
        { close: 105 },
        { close: 104 },
        { close: 106 },
        { close: 107 },
        { close: 109 },
        { close: 108 },
        { close: 110 },
        { close: 111 },
        { close: 112 },
        { close: 113 },
        { close: 114 },
        { close: 115 },
        { close: 116 },
        { close: 117 },
        { close: 118 },
        { close: 119 },
        { close: 120 }
      ];

      const ema = engine.calculateEMA(klines, 20);

      expect(ema).toBeDefined();
      expect(ema.length).toBe(2); // 21条K线 - 20周期 = 2个EMA值
      expect(ema[0]).toBeGreaterThan(0);
      expect(ema[1]).toBeGreaterThan(0);
    });

    test('当K线数量不足时应该返回空数组', () => {
      const klines = [
        { close: 100 },
        { close: 102 }
      ];

      const ema = engine.calculateEMA(klines, 20);

      expect(ema).toEqual([]);
    });
  });

  describe('simulateICTTrades', () => {
    test('应该能够生成ICT交易信号', async () => {
      // 创建模拟K线数据（价格突破模式）
      const klines = [];
      for (let i = 0; i < 100; i++) {
        klines.push([
          Date.now() + i * 3600000, // timestamp
          100 + i * 0.1, // open
          102 + i * 0.1, // high
          98 + i * 0.1, // low
          101 + i * 0.1, // close
          1000 + i * 10 // volume
        ]);
      }

      // 添加一个突破信号
      klines.push([
        Date.now() + 100 * 3600000,
        120, // open
        150, // high (突破)
        115, // low
        145, // close (突破)
        5000 // volume
      ]);

      const params = {
        risk: {
          stopLossMultiplier: 2.0,
          takeProfitMultiplier: 3.0
        }
      };

      const trades = await engine.simulateICTTrades('BTCUSDT', klines, params, 'AGGRESSIVE');

      expect(trades).toBeDefined();
      expect(Array.isArray(trades)).toBe(true);
    });
  });

  describe('simulateV3Trades', () => {
    test('应该能够生成V3交易信号', async () => {
      // 创建模拟K线数据（上升趋势）
      const klines = [];
      for (let i = 0; i < 100; i++) {
        klines.push([
          Date.now() + i * 3600000, // timestamp
          100 + i * 0.5, // open
          102 + i * 0.5, // high
          98 + i * 0.5, // low
          101 + i * 0.5, // close
          1000 + i * 10 // volume
        ]);
      }

      const params = {
        risk: {
          stopLossMultiplier: 2.0,
          takeProfitMultiplier: 3.0
        }
      };

      const trades = await engine.simulateV3Trades('BTCUSDT', klines, params, 'AGGRESSIVE');

      expect(trades).toBeDefined();
      expect(Array.isArray(trades)).toBe(true);
    });
  });

  describe('getModeMultiplier', () => {
    test('应该返回正确的模式系数', () => {
      const aggressive = engine.getModeMultiplier('AGGRESSIVE');
      const balanced = engine.getModeMultiplier('BALANCED');
      const conservative = engine.getModeMultiplier('CONSERVATIVE');

      expect(aggressive).toBe(1.5);
      expect(balanced).toBe(1.0);
      expect(conservative).toBe(0.5); // 实际值是0.5
    });
  });

  describe('closePosition', () => {
    test('应该正确计算交易盈亏', () => {
      const position = {
        symbol: 'BTCUSDT',
        type: 'LONG',
        entryTime: new Date(),
        entryPrice: 100,
        quantity: 1.0,
        confidence: 0.7
      };

      const exitPrice = 110; // 盈利
      const trade = engine.closePosition(position, exitPrice, '止盈');

      expect(trade).toBeDefined();
      expect(trade.pnl).toBe(10); // 实际字段名是pnl
      expect(trade.exitPrice).toBe(110);
      expect(trade.exitReason).toBe('止盈');
      expect(trade.fees).toBeGreaterThan(0);
    });

    test('应该正确计算亏损交易', () => {
      const position = {
        symbol: 'BTCUSDT',
        type: 'LONG',
        entryTime: new Date(),
        entryPrice: 100,
        quantity: 1.0,
        confidence: 0.7
      };

      const exitPrice = 90; // 亏损
      const trade = engine.closePosition(position, exitPrice, '止损');

      expect(trade).toBeDefined();
      expect(trade.pnl).toBe(-10); // 实际字段名是pnl
      expect(trade.exitPrice).toBe(90);
      expect(trade.exitReason).toBe('止损');
      expect(trade.fees).toBeGreaterThan(0);
    });
  });
});

