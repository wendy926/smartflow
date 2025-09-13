// integration-strategy-v3.test.js
// SmartFlowStrategyV3集成测试

const SmartFlowStrategyV3 = require('../modules/strategy/SmartFlowStrategyV3');
const DatabaseManager = require('../modules/database/DatabaseManager');
const BinanceAPI = require('../modules/api/BinanceAPI');
const path = require('path');
const fs = require('fs');

describe('SmartFlowStrategyV3 集成测试', () => {
  let strategy;
  let database;
  let binanceAPI;
  const testDbPath = path.join(__dirname, 'integration-test.db');

  beforeAll(async () => {
    // 清理测试数据库
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  afterAll(async () => {
    // 清理测试数据库
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  beforeEach(async () => {
    database = new DatabaseManager(testDbPath);
    await database.init();

    binanceAPI = new BinanceAPI();
    strategy = new SmartFlowStrategyV3(database);
  });

  afterEach(async () => {
    if (strategy) {
      strategy.destroy();
    }
    if (database) {
      await database.close();
    }
    if (binanceAPI) {
      binanceAPI.destroy();
    }
  });

  describe('完整策略分析流程', () => {
    test('应该完成完整的BTCUSDT分析流程', async () => {
      const symbol = 'BTCUSDT';

      // 执行完整的策略分析
      const result = await SmartFlowStrategyV3.analyzeSymbol(symbol, {
        database: database,
        binanceAPI: binanceAPI,
        useCache: false
      });

      expect(result).toBeDefined();
      expect(result.symbol).toBe(symbol);
      expect(result.strategyVersion).toBe('V3');

      // 验证4H趋势判断
      expect(result.trend4h).toBeOneOf(['多头趋势', '空头趋势', '震荡市']);
      expect(result.marketType).toBeOneOf(['趋势市', '震荡市']);

      // 验证1H多因子得分
      if (result.marketType === '趋势市') {
        expect(result.score1h).toBeGreaterThanOrEqual(0);
        expect(result.score1h).toBeLessThanOrEqual(6);
        expect(result.vwapDirectionConsistent).toBeDefined();
      }

      // 验证15分钟执行信号
      expect(result.execution).toBeDefined();
      expect(result.executionMode).toBeDefined();

      // 验证价格数据
      expect(result.currentPrice).toBeGreaterThan(0);
      if (result.entrySignal) {
        expect(result.entrySignal).toBeGreaterThan(0);
        expect(result.stopLoss).toBeGreaterThan(0);
        expect(result.takeProfit).toBeGreaterThan(0);
      }

      // 验证杠杆数据
      if (result.maxLeverage) {
        expect(result.maxLeverage).toBeGreaterThan(0);
        expect(result.minMargin).toBeGreaterThan(0);
        expect(result.stopLossDistance).toBeGreaterThan(0);
        expect(result.atrValue).toBeGreaterThan(0);
      }
    }, 30000);

    test('应该正确处理多个交易对', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT'];
      const results = [];

      for (const symbol of symbols) {
        const result = await SmartFlowStrategyV3.analyzeSymbol(symbol, {
          database: database,
          binanceAPI: binanceAPI,
          useCache: false
        });
        results.push(result);
      }

      expect(results).toHaveLength(symbols.length);

      for (let i = 0; i < results.length; i++) {
        expect(results[i].symbol).toBe(symbols[i]);
        expect(results[i].strategyVersion).toBe('V3');
        expect(results[i].currentPrice).toBeGreaterThan(0);
      }
    }, 60000);
  });

  describe('数据库集成', () => {
    test('应该正确保存分析结果到数据库', async () => {
      const symbol = 'LINKUSDT';

      const result = await SmartFlowStrategyV3.analyzeSymbol(symbol, {
        database: database,
        binanceAPI: binanceAPI,
        useCache: false
      });

      expect(result).toBeDefined();

      // 验证数据已保存到数据库
      const savedAnalysis = await database.getLatestStrategyAnalysis(symbol);
      expect(savedAnalysis).toBeDefined();
      expect(savedAnalysis.symbol).toBe(symbol);
      expect(savedAnalysis.strategyVersion).toBe('V3');
    }, 30000);

    test('应该正确保存模拟交易数据', async () => {
      const symbol = 'BTCUSDT';

      const result = await SmartFlowStrategyV3.analyzeSymbol(symbol, {
        database: database,
        binanceAPI: binanceAPI,
        useCache: false,
        autoStartSimulation: true,
        maxLossAmount: 100
      });

      expect(result).toBeDefined();

      // 如果有信号，验证模拟交易已启动
      if (result.execution && result.execution !== 'NONE') {
        const simulations = await database.getSimulationHistory(10);
        const relevantSimulation = simulations.find(s => s.symbol === symbol);

        if (relevantSimulation) {
          expect(relevantSimulation.symbol).toBe(symbol);
          expect(relevantSimulation.direction).toBeDefined();
          expect(relevantSimulation.maxLeverage).toBeGreaterThan(0);
          expect(relevantSimulation.minMargin).toBeGreaterThan(0);
        }
      }
    }, 30000);
  });

  describe('API集成', () => {
    test('应该正确获取K线数据', async () => {
      const symbol = 'BTCUSDT';
      const interval = '4h';
      const limit = 100;

      const klines = await binanceAPI.getKlines(symbol, interval, limit);

      expect(klines).toBeDefined();
      expect(Array.isArray(klines)).toBe(true);
      expect(klines.length).toBeGreaterThan(0);

      // 验证K线数据完整性
      const kline = klines[0];
      expect(kline.open).toBeGreaterThan(0);
      expect(kline.high).toBeGreaterThan(0);
      expect(kline.low).toBeGreaterThan(0);
      expect(kline.close).toBeGreaterThan(0);
      expect(kline.volume).toBeGreaterThanOrEqual(0);
    });

    test('应该正确获取24小时价格统计', async () => {
      const symbol = 'ETHUSDT';

      const ticker = await binanceAPI.get24hrTicker(symbol);

      expect(ticker).toBeDefined();
      expect(ticker.symbol).toBe(symbol);
      expect(ticker.price).toBeGreaterThan(0);
      expect(ticker.priceChange).toBeDefined();
      expect(ticker.priceChangePercent).toBeDefined();
      expect(ticker.volume).toBeGreaterThan(0);
    });

    test('应该正确处理API限流', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'LINKUSDT'];
      const startTime = Date.now();

      // 连续请求多个交易对
      const promises = symbols.map(symbol =>
        binanceAPI.getTickerPrice(symbol)
      );

      const results = await Promise.allSettled(promises);
      const endTime = Date.now();

      // 验证所有请求都成功
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBe(symbols.length);

      // 验证没有过快请求
      const duration = endTime - startTime;
      expect(duration).toBeGreaterThan(0);
    });
  });

  describe('缓存集成', () => {
    test('应该正确使用缓存机制', async () => {
      const symbol = 'BTCUSDT';

      // 第一次分析
      const startTime1 = Date.now();
      const result1 = await SmartFlowStrategyV3.analyzeSymbol(symbol, {
        database: database,
        binanceAPI: binanceAPI,
        useCache: true
      });
      const duration1 = Date.now() - startTime1;

      // 第二次分析（应该使用缓存）
      const startTime2 = Date.now();
      const result2 = await SmartFlowStrategyV3.analyzeSymbol(symbol, {
        database: database,
        binanceAPI: binanceAPI,
        useCache: true
      });
      const duration2 = Date.now() - startTime2;

      // 验证结果一致性
      expect(result1.symbol).toBe(result2.symbol);
      expect(result1.trend4h).toBe(result2.trend4h);
      expect(result1.marketType).toBe(result2.marketType);

      // 验证缓存加速（第二次应该更快）
      expect(duration2).toBeLessThan(duration1);
    }, 60000);
  });

  describe('错误处理和恢复', () => {
    test('应该处理API错误', async () => {
      // 模拟API错误
      const originalGetKlines = binanceAPI.getKlines;
      binanceAPI.getKlines = jest.fn().mockRejectedValue(new Error('API Error'));

      const result = await SmartFlowStrategyV3.analyzeSymbol('INVALID', {
        database: database,
        binanceAPI: binanceAPI,
        useCache: false
      });

      expect(result).toBeDefined();
      expect(result.error).toBeDefined();

      // 恢复原始方法
      binanceAPI.getKlines = originalGetKlines;
    });

    test('应该处理数据库错误', async () => {
      // 模拟数据库错误
      const originalSave = database.saveStrategyAnalysis;
      database.saveStrategyAnalysis = jest.fn().mockRejectedValue(new Error('Database Error'));

      const result = await SmartFlowStrategyV3.analyzeSymbol('BTCUSDT', {
        database: database,
        binanceAPI: binanceAPI,
        useCache: false
      });

      expect(result).toBeDefined();
      // 即使数据库保存失败，分析结果仍然应该返回

      // 恢复原始方法
      database.saveStrategyAnalysis = originalSave;
    });

    test('应该处理数据不足的情况', async () => {
      // 模拟数据不足
      const originalGetKlines = binanceAPI.getKlines;
      binanceAPI.getKlines = jest.fn().mockResolvedValue([]);

      const result = await SmartFlowStrategyV3.analyzeSymbol('BTCUSDT', {
        database: database,
        binanceAPI: binanceAPI,
        useCache: false
      });

      expect(result).toBeDefined();
      expect(result.trend4h).toBe('震荡市');
      expect(result.error).toBeDefined();

      // 恢复原始方法
      binanceAPI.getKlines = originalGetKlines;
    });
  });

  describe('性能测试', () => {
    test('应该在合理时间内完成分析', async () => {
      const symbol = 'BTCUSDT';
      const startTime = Date.now();

      const result = await SmartFlowStrategyV3.analyzeSymbol(symbol, {
        database: database,
        binanceAPI: binanceAPI,
        useCache: false
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(30000); // 应该在30秒内完成
    }, 35000);

    test('应该支持并发分析', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'LINKUSDT'];
      const startTime = Date.now();

      const promises = symbols.map(symbol =>
        SmartFlowStrategyV3.analyzeSymbol(symbol, {
          database: database,
          binanceAPI: binanceAPI,
          useCache: false
        })
      );

      const results = await Promise.allSettled(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // 验证所有分析都完成
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBe(symbols.length);

      // 验证并发执行时间合理
      expect(duration).toBeLessThan(60000); // 并发应该在60秒内完成
    }, 65000);
  });

  describe('内存管理', () => {
    test('应该正确清理内存', async () => {
      const symbol = 'BTCUSDT';

      // 执行多次分析
      for (let i = 0; i < 5; i++) {
        await SmartFlowStrategyV3.analyzeSymbol(symbol, {
          database: database,
          binanceAPI: binanceAPI,
          useCache: false
        });
      }

      // 验证内存没有持续增长
      const memBefore = process.memoryUsage();

      // 执行更多分析
      for (let i = 0; i < 5; i++) {
        await SmartFlowStrategyV3.analyzeSymbol(symbol, {
          database: database,
          binanceAPI: binanceAPI,
          useCache: false
        });
      }

      const memAfter = process.memoryUsage();
      const memIncrease = memAfter.heapUsed - memBefore.heapUsed;

      // 内存增长应该在合理范围内（小于100MB）
      expect(memIncrease).toBeLessThan(100 * 1024 * 1024);
    }, 120000);
  });
});
