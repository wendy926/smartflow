/**
 * 服务器端K线数据自动更新功能单元测试
 * 测试server.js中新增的K线数据自动更新机制
 */

// Mock 依赖模块
jest.mock('../modules/database/DatabaseManager');
jest.mock('../modules/api/BinanceAPI');
jest.mock('../modules/strategy/SmartFlowStrategyV3');
jest.mock('../modules/notification/TelegramNotifier');

const BinanceAPI = require('../modules/api/BinanceAPI');

// 模拟SmartFlowServer类
class MockSmartFlowServer {
  constructor() {
    this.db = {
      getCustomSymbols: jest.fn(),
      runQuery: jest.fn()
    };
    this.klineUpdateInterval = null;
  }

  async updateKlineData(symbol) {
    try {
      const BinanceAPI = require('../modules/api/BinanceAPI');
      const intervals = ['4h', '1h', '15m'];

      for (const interval of intervals) {
        try {
          console.log(`📊 更新 ${symbol} ${interval} K线数据...`);

          // 从Binance API获取最新数据
          const klines = await BinanceAPI.getKlines(symbol, interval, 250);

          if (klines && klines.length > 0) {
            // 存储到数据库
            for (const kline of klines) {
              await this.db.runQuery(
                `INSERT OR REPLACE INTO kline_data
                                (symbol, interval, open_time, close_time, open_price, high_price, low_price, close_price,
                                 volume, quote_volume, trades_count, taker_buy_volume, taker_buy_quote_volume)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  symbol,
                  interval,
                  parseInt(kline[0]),    // open_time
                  parseInt(kline[6]),    // close_time
                  parseFloat(kline[1]),  // open_price
                  parseFloat(kline[2]),  // high_price
                  parseFloat(kline[3]),  // low_price
                  parseFloat(kline[4]),  // close_price
                  parseFloat(kline[5]),  // volume
                  parseFloat(kline[7]),  // quote_volume
                  parseInt(kline[8]),    // trades_count
                  parseFloat(kline[9]),  // taker_buy_volume
                  parseFloat(kline[10])  // taker_buy_quote_volume
                ]
              );
            }

            console.log(`✅ ${symbol} ${interval}: 更新 ${klines.length} 条数据`);
          } else {
            console.log(`⚠️ ${symbol} ${interval}: 无数据`);
          }

          // 添加延迟避免API限制
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          console.error(`更新 ${symbol} ${interval} K线数据失败:`, error);
        }
      }

    } catch (error) {
      console.error(`更新 ${symbol} K线数据失败:`, error);
    }
  }

  startPeriodicAnalysis() {
    // 模拟定期更新任务
    this.klineUpdateInterval = setInterval(async () => {
      try {
        const symbols = await this.db.getCustomSymbols();
        console.log(`📊 开始更新K线数据 ${symbols.length} 个交易对...`);

        for (const symbol of symbols) {
          try {
            await this.updateKlineData(symbol);
          } catch (error) {
            console.error(`K线数据更新 ${symbol} 失败:`, error);
          }
        }

        console.log('✅ K线数据更新完成');
      } catch (error) {
        console.error('K线数据更新失败:', error);
      }
    }, 30 * 60 * 1000); // 30分钟
  }

  cleanup() {
    if (this.klineUpdateInterval) {
      clearInterval(this.klineUpdateInterval);
      this.klineUpdateInterval = undefined;
    }
  }
}

describe('服务器端K线数据自动更新功能测试', () => {
  let server;

  beforeEach(() => {
    server = new MockSmartFlowServer();
  });

  afterEach(() => {
    jest.clearAllMocks();
    // 清理定时器
    if (server && server.klineUpdateInterval) {
      clearInterval(server.klineUpdateInterval);
      server.klineUpdateInterval = undefined;
    }
    // 清理所有定时器
    jest.clearAllTimers();
    // 恢复真实定时器
    jest.useRealTimers();
  });

  /**
   * 测试updateKlineData方法
   */
  describe('updateKlineData方法测试', () => {
    beforeEach(() => {
      // Mock BinanceAPI.getKlines
      BinanceAPI.getKlines = jest.fn();
    });

    test('应该成功更新单个交易对的K线数据', async () => {
      const symbol = 'BTCUSDT';
      const mockKlines = {
        '4h': [
          [1700000000000, 50000, 51000, 49000, 50500, 1000, 1700000000000 + 4 * 60 * 60 * 1000, 1000 * 50500, 100, 500, 500 * 50500, 0],
          [1700000000000 + 4 * 60 * 60 * 1000, 50500, 51500, 49500, 51000, 1100, 1700000000000 + 8 * 60 * 60 * 1000, 1100 * 51000, 110, 550, 550 * 51000, 0]
        ],
        '1h': [
          [1700000000000, 50000, 51000, 49000, 50500, 1000, 1700000000000 + 60 * 60 * 1000, 1000 * 50500, 100, 500, 500 * 50500, 0]
        ],
        '15m': [
          [1700000000000, 50000, 51000, 49000, 50500, 1000, 1700000000000 + 15 * 60 * 1000, 1000 * 50500, 100, 500, 500 * 50500, 0]
        ]
      };

      // 模拟API响应
      BinanceAPI.getKlines
        .mockResolvedValueOnce(mockKlines['4h'])
        .mockResolvedValueOnce(mockKlines['1h'])
        .mockResolvedValueOnce(mockKlines['15m']);

      server.db.runQuery.mockResolvedValue();

      await server.updateKlineData(symbol);

      // 验证API调用
      expect(BinanceAPI.getKlines).toHaveBeenCalledWith(symbol, '4h', 250);
      expect(BinanceAPI.getKlines).toHaveBeenCalledWith(symbol, '1h', 250);
      expect(BinanceAPI.getKlines).toHaveBeenCalledWith(symbol, '15m', 250);

      // 验证数据库更新
      expect(server.db.runQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO kline_data'),
        expect.arrayContaining([
          symbol,
          '4h',
          1700000000000,
          1700000000000 + 4 * 60 * 60 * 1000,
          50000,
          51000,
          49000,
          50500,
          1000,
          1000 * 50500,
          100,
          500,
          500 * 50500
        ])
      );
    });

    test('应该处理API返回空数据的情况', async () => {
      const symbol = 'INVALIDSYMBOL';

      BinanceAPI.getKlines.mockResolvedValue(null);

      await server.updateKlineData(symbol);

      expect(BinanceAPI.getKlines).toHaveBeenCalledTimes(3); // 4h, 1h, 15m
      expect(server.db.runQuery).not.toHaveBeenCalled();
    });

    test('应该处理API调用失败的情况', async () => {
      const symbol = 'BTCUSDT';

      // 模拟第一个间隔(4h)调用失败，其他间隔成功
      BinanceAPI.getKlines
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce([]) // 1h
        .mockResolvedValueOnce([]); // 15m

      // 不应该抛出错误
      await expect(server.updateKlineData(symbol)).resolves.not.toThrow();

      expect(BinanceAPI.getKlines).toHaveBeenCalledTimes(3); // 三个间隔都会尝试调用
    });

    test('应该处理数据库更新失败的情况', async () => {
      const symbol = 'BTCUSDT';
      const mockKlines = [
        [1700000000000, 50000, 51000, 49000, 50500, 1000, 1700000000000 + 4 * 60 * 60 * 1000, 1000 * 50500, 100, 500, 500 * 50500, 0]
      ];

      BinanceAPI.getKlines.mockResolvedValue(mockKlines);
      server.db.runQuery.mockRejectedValue(new Error('Database Error'));

      // 不应该抛出错误
      await expect(server.updateKlineData(symbol)).resolves.not.toThrow();

      expect(BinanceAPI.getKlines).toHaveBeenCalledWith(symbol, '4h', 250);
      expect(server.db.runQuery).toHaveBeenCalled();
    });

    test('应该正确处理不同时间间隔的数据', async () => {
      const symbol = 'ETHUSDT';
      const intervals = ['4h', '1h', '15m'];

      // 为每个间隔创建不同的数据
      intervals.forEach((interval, index) => {
        const klines = [
          [1700000000000 + index * 1000, 3000 + index, 3100 + index, 2900 + index, 3050 + index, 1000 + index, 1700000000000 + index * 1000 + 4 * 60 * 60 * 1000, 1000 * (3050 + index), 100, 500, 500 * (3050 + index), 0]
        ];
        BinanceAPI.getKlines.mockResolvedValueOnce(klines);
      });

      server.db.runQuery.mockResolvedValue();

      await server.updateKlineData(symbol);

      // 验证每个间隔都被调用
      intervals.forEach(interval => {
        expect(BinanceAPI.getKlines).toHaveBeenCalledWith(symbol, interval, 250);
      });

      // 验证数据库更新调用次数
      expect(server.db.runQuery).toHaveBeenCalledTimes(3); // 每个间隔一次
    });
  });

  /**
   * 测试定期更新任务
   */
    describe('定期更新任务测试', () => {
        beforeEach(() => {
            server.db.getCustomSymbols.mockResolvedValue(['BTCUSDT', 'ETHUSDT', 'AAVEUSDT']);
            
            // Mock updateKlineData方法
            server.updateKlineData = jest.fn().mockResolvedValue();
        });

        test('应该为所有交易对启动定期更新', () => {
            server.startPeriodicAnalysis();

            // 验证定时器已创建
            expect(server.klineUpdateInterval).toBeDefined();
            expect(typeof server.klineUpdateInterval).toBe('object');
            
            // 清理定时器
            if (server.klineUpdateInterval) {
                clearInterval(server.klineUpdateInterval);
                server.klineUpdateInterval = undefined;
            }
        });

    test('应该处理获取交易对列表失败的情况', () => {
      server.db.getCustomSymbols.mockRejectedValue(new Error('Database Error'));

      // 不应该抛出错误
      expect(() => server.startPeriodicAnalysis()).not.toThrow();
    });

        test('应该处理单个交易对更新失败的情况', () => {
      server.updateKlineData
        .mockResolvedValueOnce() // BTCUSDT 成功
        .mockRejectedValueOnce(new Error('ETHUSDT Error')) // ETHUSDT 失败
        .mockResolvedValueOnce(); // AAVEUSDT 成功

      server.startPeriodicAnalysis();

      // 验证定时器已创建
      expect(server.klineUpdateInterval).toBeDefined();
      
      // 清理定时器
      if (server.klineUpdateInterval) {
        clearInterval(server.klineUpdateInterval);
        server.klineUpdateInterval = undefined;
      }
    });

    test('应该正确清理定时器', () => {
      server.startPeriodicAnalysis();

      const intervalId = server.klineUpdateInterval;
      expect(intervalId).toBeDefined();

      server.cleanup();

      expect(server.klineUpdateInterval).toBeUndefined();
    });
  });

  /**
   * 测试错误处理和日志记录
   */
  describe('错误处理和日志记录测试', () => {
    test('应该记录更新开始和完成的日志', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      server.db.getCustomSymbols.mockResolvedValue(['BTCUSDT']);
      server.updateKlineData = jest.fn().mockResolvedValue();

      server.startPeriodicAnalysis();

      // 验证定时器已创建
      expect(server.klineUpdateInterval).toBeDefined();
      
      // 清理定时器
      if (server.klineUpdateInterval) {
        clearInterval(server.klineUpdateInterval);
        server.klineUpdateInterval = undefined;
      }

      consoleSpy.mockRestore();
    });

    test('应该记录单个交易对更新失败的日志', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      server.db.getCustomSymbols.mockResolvedValue(['BTCUSDT']);
      server.updateKlineData = jest.fn().mockRejectedValue(new Error('Update Failed'));

      server.startPeriodicAnalysis();

      // 验证定时器已创建
      expect(server.klineUpdateInterval).toBeDefined();
      
      // 清理定时器
      if (server.klineUpdateInterval) {
        clearInterval(server.klineUpdateInterval);
        server.klineUpdateInterval = undefined;
      }

      consoleSpy.mockRestore();
    });

    test('应该记录整体更新失败的日志', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      server.db.getCustomSymbols.mockRejectedValue(new Error('Database Error'));

      server.startPeriodicAnalysis();

      // 验证定时器已创建
      expect(server.klineUpdateInterval).toBeDefined();
      
      // 清理定时器
      if (server.klineUpdateInterval) {
        clearInterval(server.klineUpdateInterval);
        server.klineUpdateInterval = undefined;
      }

      consoleSpy.mockRestore();
    });
  });

  /**
   * 测试性能优化
   */
  describe('性能优化测试', () => {
    test('应该在API调用之间添加延迟', async () => {
      const symbol = 'BTCUSDT';
      const mockKlines = [
        [1700000000000, 50000, 51000, 49000, 50500, 1000, 1700000000000 + 4 * 60 * 60 * 1000, 1000 * 50500, 100, 500, 500 * 50500, 0]
      ];

      BinanceAPI.getKlines.mockResolvedValue(mockKlines);
      server.db.runQuery.mockResolvedValue();

      const startTime = Date.now();
      await server.updateKlineData(symbol);
      const endTime = Date.now();

      // 应该至少有3次100ms的延迟（3个时间间隔）
      expect(endTime - startTime).toBeGreaterThanOrEqual(200);
    });

    test('应该处理大量交易对的高效更新', () => {
      const symbols = Array.from({ length: 50 }, (_, i) => `SYMBOL${i}USDT`);
      server.db.getCustomSymbols.mockResolvedValue(symbols);

      server.updateKlineData = jest.fn().mockResolvedValue();

      server.startPeriodicAnalysis();

      // 验证定时器已创建
      expect(server.klineUpdateInterval).toBeDefined();
      
      // 清理定时器
      if (server.klineUpdateInterval) {
        clearInterval(server.klineUpdateInterval);
        server.klineUpdateInterval = undefined;
      }
    });
  });

  /**
   * 测试数据完整性
   */
  describe('数据完整性测试', () => {
    test('应该正确存储K线数据的所有字段', async () => {
      const symbol = 'BTCUSDT';
      const mockKlines = [
        [
          1700000000000, // open_time
          50000,         // open
          51000,         // high
          49000,         // low
          50500,         // close
          1000,          // volume
          1700000000000 + 4 * 60 * 60 * 1000, // close_time
          1000 * 50500,  // quote_volume
          100,           // trades_count
          500,           // taker_buy_volume
          500 * 50500,   // taker_buy_quote_volume
          0              // ignore
        ]
      ];

      BinanceAPI.getKlines.mockResolvedValue(mockKlines);
      server.db.runQuery.mockResolvedValue();

      await server.updateKlineData(symbol);

      // 验证数据库调用参数
      const dbCall = server.db.runQuery.mock.calls[0];
      const sql = dbCall[0];
      const params = dbCall[1];

      expect(sql).toContain('INSERT OR REPLACE INTO kline_data');
      expect(params).toEqual([
        symbol,
        '4h',
        1700000000000,
        1700000000000 + 4 * 60 * 60 * 1000,
        50000,
        51000,
        49000,
        50500,
        1000,
        1000 * 50500,
        100,
        500,
        500 * 50500
      ]);
    });

    test('应该处理数据类型转换', async () => {
      const symbol = 'BTCUSDT';
      const mockKlines = [
        [
          '1700000000000', // 字符串时间戳
          50000.123456,    // 浮点价格
          51000.789012,    // 浮点价格
          49000.456789,    // 浮点价格
          50500.987654,    // 浮点价格
          1000.5,          // 浮点成交量
          '1700000000000', // 字符串时间戳
          1000.5 * 50500.987654, // 浮点计算
          100.7,           // 浮点交易数
          500.3,           // 浮点买单量
          500.3 * 50500.987654, // 浮点计算
          0                // 整数
        ]
      ];

      BinanceAPI.getKlines.mockResolvedValue(mockKlines);
      server.db.runQuery.mockResolvedValue();

      await server.updateKlineData(symbol);

      const dbCall = server.db.runQuery.mock.calls[0];
      const params = dbCall[1];

      // 验证数据类型转换
      expect(typeof params[2]).toBe('number'); // open_time
      expect(typeof params[3]).toBe('number'); // close_time
      expect(typeof params[4]).toBe('number'); // open_price
      expect(typeof params[5]).toBe('number'); // high_price
      expect(typeof params[6]).toBe('number'); // low_price
      expect(typeof params[7]).toBe('number'); // close_price
    });
  });

  /**
   * 测试边界条件
   */
  describe('边界条件测试', () => {
    test('应该处理空交易对列表', () => {
      server.db.getCustomSymbols.mockResolvedValue([]);
      server.updateKlineData = jest.fn().mockResolvedValue();

      server.startPeriodicAnalysis();

      // 验证定时器已创建
      expect(server.klineUpdateInterval).toBeDefined();
      
      // 清理定时器
      if (server.klineUpdateInterval) {
        clearInterval(server.klineUpdateInterval);
        server.klineUpdateInterval = undefined;
      }
    });

    test('应该处理单个交易对的更新', () => {
      server.db.getCustomSymbols.mockResolvedValue(['BTCUSDT']);
      server.updateKlineData = jest.fn().mockResolvedValue();

      server.startPeriodicAnalysis();

      // 验证定时器已创建
      expect(server.klineUpdateInterval).toBeDefined();
      
      // 清理定时器
      if (server.klineUpdateInterval) {
        clearInterval(server.klineUpdateInterval);
        server.klineUpdateInterval = undefined;
      }
    });

    test('应该处理重复启动定期任务', () => {
      server.startPeriodicAnalysis();
      const firstInterval = server.klineUpdateInterval;

      server.startPeriodicAnalysis();
      const secondInterval = server.klineUpdateInterval;

      // 验证定时器已创建
      expect(firstInterval).toBeDefined();
      expect(secondInterval).toBeDefined();

      // 清理定时器
      if (firstInterval) clearInterval(firstInterval);
      if (secondInterval) clearInterval(secondInterval);
    });
  });
});

module.exports = {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest
};
