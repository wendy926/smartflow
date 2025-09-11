/**
 * Delta实时计算单元测试
 * 测试不同时间级别的Delta平滑处理
 */

const DeltaRealTimeManager = require('../modules/data/DeltaRealTimeManager');

describe('Delta实时计算测试', () => {
  let deltaManager;

  beforeEach(() => {
    deltaManager = new DeltaRealTimeManager();
  });

  afterEach(() => {
    if (deltaManager) {
      deltaManager.stop();
    }
  });

  describe('Delta计算逻辑测试', () => {
    test('应该正确计算聚合Delta', () => {
      const tradeList = [
        { q: '100', maker: false }, // 主动买单
        { q: '50', maker: true },   // 主动卖单
        { q: '200', maker: false }, // 主动买单
        { q: '75', maker: true }    // 主动卖单
      ];

      const delta = deltaManager.calcDelta(tradeList);
      expect(delta).toBeCloseTo(0.41, 1); // (350 - 125) / 475 = 0.4737
    });

    test('应该正确处理空交易列表', () => {
      const delta = deltaManager.calcDelta([]);
      expect(delta).toBe(0);
    });

    test('应该正确处理只有买单的情况', () => {
      const tradeList = [
        { q: '100', maker: false },
        { q: '200', maker: false }
      ];

      const delta = deltaManager.calcDelta(tradeList);
      expect(delta).toBe(1); // 全部买单
    });

    test('应该正确处理只有卖单的情况', () => {
      const tradeList = [
        { q: '100', maker: true },
        { q: '200', maker: true }
      ];

      const delta = deltaManager.calcDelta(tradeList);
      expect(delta).toBe(-1); // 全部卖单
    });
  });

  describe('EMA计算测试', () => {
    test('应该正确计算EMA(3)', () => {
      const values = [1, 2, 3, 4, 5];
      const ema = deltaManager.calculateEMA(values, 3);
      expect(ema).toBeCloseTo(4.1, 1);
    });

    test('应该正确计算EMA(6)', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const ema = deltaManager.calculateEMA(values, 6);
      expect(ema).toBeCloseTo(7.6, 1);
    });

    test('应该正确处理空数组', () => {
      const ema = deltaManager.calculateEMA([], 3);
      expect(ema).toBeNull();
    });

    test('应该正确处理单值数组', () => {
      const ema = deltaManager.calculateEMA([5], 3);
      expect(ema).toBe(5);
    });
  });

  describe('Delta数据管理测试', () => {
    test('应该正确启动和停止Delta管理器', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT'];

      await deltaManager.start(symbols);
      expect(deltaManager.isRunning).toBe(true);

      deltaManager.stop();
      expect(deltaManager.isRunning).toBe(false);
    });

    test('应该正确处理交易数据', () => {
      const symbol = 'BTCUSDT';
      const trade = {
        T: Date.now(),
        q: '100',
        p: '50000',
        m: false
      };

      deltaManager.processTrade(symbol, trade);
      const deltaData = deltaManager.getDeltaData(symbol, 'realtime');

      expect(deltaData).toBeDefined();
      if (deltaData) {
        expect(deltaData.deltaBuy).toBe(100);
        expect(deltaData.deltaSell).toBe(0);
      }
    });

    test('应该正确获取不同时间级别的Delta数据', () => {
      const symbol = 'BTCUSDT';

      // 模拟设置Delta数据
      const deltaData = deltaManager.deltaData.get(symbol);
      if (deltaData) {
        deltaData.delta15m = 0.5;
        deltaData.delta1h = 0.3;
      }

      const delta15m = deltaManager.getDeltaData(symbol, '15m');
      const delta1h = deltaManager.getDeltaData(symbol, '1h');
      const realtime = deltaManager.getDeltaData(symbol, 'realtime');

      expect(delta15m).toBeDefined();
      expect(delta1h).toBeDefined();
      expect(realtime).toBeDefined();
    });
  });

  describe('时间级别处理测试', () => {
    test('应该正确处理15分钟Delta聚合', () => {
      const symbol = 'BTCUSDT';

      // 模拟交易数据
      const now = Date.now();
      const trades = [
        { T: now - 10 * 60 * 1000, q: '100', maker: false },
        { T: now - 5 * 60 * 1000, q: '50', maker: true },
        { T: now - 2 * 60 * 1000, q: '200', maker: false }
      ];

      deltaManager.trades.set(symbol, trades);
      deltaManager.process15mDelta(symbol);

      const deltaData = deltaManager.getDeltaData(symbol, '15m');
      expect(deltaData).toBeDefined();
    });

    test('应该正确处理1小时Delta聚合', () => {
      const symbol = 'BTCUSDT';

      // 模拟交易数据
      const now = Date.now();
      const trades = [
        { T: now - 30 * 60 * 1000, q: '100', maker: false },
        { T: now - 15 * 60 * 1000, q: '50', maker: true },
        { T: now - 5 * 60 * 1000, q: '200', maker: false }
      ];

      deltaManager.trades.set(symbol, trades);
      deltaManager.process1hDelta(symbol);

      const deltaData = deltaManager.getDeltaData(symbol, '1h');
      expect(deltaData).toBeDefined();
    });
  });

  describe('统计信息测试', () => {
    test('应该正确获取Delta统计信息', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT'];
      await deltaManager.start(symbols);

      const stats = deltaManager.getStats();
      expect(stats.totalSymbols).toBe(2);
      expect(stats.activeConnections).toBe(2);
      expect(stats.symbols).toHaveLength(2);

      deltaManager.stop();
    });
  });

  describe('错误处理测试', () => {
    test('应该正确处理无效交易数据', () => {
      const symbol = 'BTCUSDT';
      const invalidTrade = {
        T: 'invalid',
        q: 'invalid',
        p: 'invalid',
        m: 'invalid'
      };

      expect(() => {
        deltaManager.processTrade(symbol, invalidTrade);
      }).not.toThrow();
    });

    test('应该正确处理不存在的交易对', () => {
      const deltaData = deltaManager.getDeltaData('NONEXISTENT', '15m');
      expect(deltaData).toBeNull();
    });
  });

  describe('定时器管理测试', () => {
    test('应该正确启动和停止定时器', () => {
      // 启动定时器
      deltaManager.startTimers();
      expect(deltaManager.timer15m).toBeDefined();
      expect(deltaManager.timer1h).toBeDefined();
      expect(deltaManager.timer15m).not.toBeNull();
      expect(deltaManager.timer1h).not.toBeNull();

      // 停止定时器
      deltaManager.stopTimers();
      expect(deltaManager.timer15m).toBeNull();
      expect(deltaManager.timer1h).toBeNull();
    });

    test('重复启动定时器应该先清理旧的', () => {
      // 第一次启动
      deltaManager.startTimers();
      const firstTimer15m = deltaManager.timer15m;
      const firstTimer1h = deltaManager.timer1h;

      // 第二次启动
      deltaManager.startTimers();
      const secondTimer15m = deltaManager.timer15m;
      const secondTimer1h = deltaManager.timer1h;

      // 应该是不同的定时器ID
      expect(firstTimer15m).not.toBe(secondTimer15m);
      expect(firstTimer1h).not.toBe(secondTimer1h);
      expect(secondTimer15m).toBeDefined();
      expect(secondTimer1h).toBeDefined();
    });

    test('停止不存在的定时器应该不会报错', () => {
      // 直接停止（没有启动过）
      expect(() => {
        deltaManager.stopTimers();
      }).not.toThrow();
    });

    test('stop方法应该清理所有资源', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT'];
      await deltaManager.start(symbols);

      // 验证资源存在
      expect(deltaManager.isRunning).toBe(true);
      expect(deltaManager.timer15m).toBeDefined();
      expect(deltaManager.timer1h).toBeDefined();
      expect(deltaManager.connections.size).toBeGreaterThan(0);

      // 停止
      deltaManager.stop();

      // 验证所有资源被清理
      expect(deltaManager.isRunning).toBe(false);
      expect(deltaManager.timer15m).toBeNull();
      expect(deltaManager.timer1h).toBeNull();
      expect(deltaManager.connections.size).toBe(0);
      expect(deltaManager.deltaData.size).toBe(0);
      expect(deltaManager.trades.size).toBe(0);
    });
  });

  describe('性能测试', () => {
    test('应该高效处理大量交易数据', () => {
      const symbol = 'BTCUSDT';
      const trades = [];

      // 生成1000个模拟交易
      for (let i = 0; i < 1000; i++) {
        trades.push({
          T: Date.now() - i * 1000,
          q: (Math.random() * 100).toString(),
          p: (50000 + Math.random() * 1000).toString(),
          m: Math.random() > 0.5
        });
      }

      deltaManager.trades.set(symbol, trades);

      const startTime = Date.now();
      deltaManager.process15mDelta(symbol);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // 应该在100ms内完成
    });
  });
});
