// database-manager.test.js
// DatabaseManager数据库管理测试

const DatabaseManager = require('../modules/database/DatabaseManager');
const path = require('path');
const fs = require('fs');

describe('DatabaseManager 数据库管理测试', () => {
  let db;
  const testDbPath = path.join(__dirname, 'test.db');

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
    db = new DatabaseManager(testDbPath);
    await db.init();
  });

  afterEach(async () => {
    if (db) {
      await db.close();
    }
  });

  describe('数据库初始化', () => {
    test('应该正确初始化数据库', async () => {
      expect(db).toBeDefined();
      expect(db.db).toBeDefined();
    });

    test('应该创建必要的表', async () => {
      const tables = await db.getAllTables();
      expect(tables).toContain('strategy_analysis');
      expect(tables).toContain('simulations');
      expect(tables).toContain('data_refresh_status');
    });
  });

  describe('策略分析数据管理', () => {
    test('应该正确保存策略分析数据', async () => {
      const analysisData = {
        symbol: 'BTCUSDT',
        trend4h: '多头趋势',
        marketType: '趋势市',
        score: 5,
        direction: 'BULL',
        bullScore: 3,
        bearScore: 1,
        score1h: 4,
        vwapDirectionConsistent: true,
        factors: JSON.stringify({
          breakout: true,
          volume: true,
          oi: true,
          delta: false,
          funding: true
        }),
        execution: '做多_多头回踩突破',
        executionMode: '多头回踩突破',
        entrySignal: 110.5,
        stopLoss: 108.0,
        takeProfit: 115.0,
        currentPrice: 110.5,
        dataCollectionRate: 100.0,
        strategyVersion: 'V3'
      };

      const result = await db.saveStrategyAnalysis(analysisData);
      expect(result).toBeDefined();
      expect(result.id).toBeGreaterThan(0);
    });

    test('应该正确获取策略分析数据', async () => {
      const symbol = 'BTCUSDT';
      const analysisData = {
        symbol,
        trend4h: '多头趋势',
        marketType: '趋势市',
        score: 5,
        direction: 'BULL',
        currentPrice: 110.5,
        strategyVersion: 'V3'
      };

      await db.saveStrategyAnalysis(analysisData);
      const result = await db.getLatestStrategyAnalysis(symbol);

      expect(result).toBeDefined();
      expect(result.symbol).toBe(symbol);
      expect(result.trend4h).toBe('多头趋势');
    });

    test('应该正确处理批量保存', async () => {
      const batchData = [
        { symbol: 'BTCUSDT', trend4h: '多头趋势', score: 5 },
        { symbol: 'ETHUSDT', trend4h: '空头趋势', score: 4 },
        { symbol: 'LINKUSDT', trend4h: '震荡市', score: 2 }
      ];

      const results = await db.saveBatchStrategyAnalysis(batchData);
      expect(results).toHaveLength(3);
      expect(results.every(r => r.id > 0)).toBe(true);
    });
  });

  describe('模拟交易数据管理', () => {
    test('应该正确保存模拟交易数据', async () => {
      const simulationData = {
        symbol: 'BTCUSDT',
        entryPrice: 110.5,
        stopLossPrice: 108.0,
        takeProfitPrice: 115.0,
        maxLeverage: 20,
        minMargin: 100.0,
        triggerReason: 'SIGNAL_多头回踩突破',
        direction: 'LONG',
        executionModeV3: '多头回踩突破',
        marketType: '趋势市',
        setupCandleHigh: 111.0,
        setupCandleLow: 110.0,
        atr14: 2.5,
        atrValue: 2.5
      };

      const result = await db.saveSimulation(simulationData);
      expect(result).toBeDefined();
      expect(result.id).toBeGreaterThan(0);
    });

    test('应该正确获取模拟交易历史', async () => {
      const simulationData = {
        symbol: 'BTCUSDT',
        entryPrice: 110.5,
        stopLossPrice: 108.0,
        takeProfitPrice: 115.0,
        maxLeverage: 20,
        minMargin: 100.0,
        triggerReason: 'SIGNAL_多头回踩突破',
        direction: 'LONG'
      };

      await db.saveSimulation(simulationData);
      const history = await db.getSimulationHistory(10);

      expect(history).toBeDefined();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].symbol).toBe('BTCUSDT');
    });

    test('应该正确更新模拟交易状态', async () => {
      const simulationData = {
        symbol: 'BTCUSDT',
        entryPrice: 110.5,
        stopLossPrice: 108.0,
        takeProfitPrice: 115.0,
        maxLeverage: 20,
        minMargin: 100.0,
        triggerReason: 'SIGNAL_多头回踩突破',
        direction: 'LONG'
      };

      const simulation = await db.saveSimulation(simulationData);
      await db.updateSimulation(simulation.id, {
        status: 'CLOSED',
        exitPrice: 115.0,
        exitReason: '止盈触发',
        isWin: true,
        profitLoss: 450.0
      });

      const updated = await db.getSimulationById(simulation.id);
      expect(updated.status).toBe('CLOSED');
      expect(updated.isWin).toBe(true);
      expect(updated.profitLoss).toBe(450.0);
    });
  });

  describe('数据刷新状态管理', () => {
    test('应该正确更新数据刷新状态', async () => {
      const symbol = 'BTCUSDT';
      const dataType = 'trend_analysis';
      const shouldRefresh = false;
      const lastRefresh = new Date().toISOString();
      const nextRefresh = new Date(Date.now() + 3600000).toISOString();

      await db.updateDataRefreshStatus(symbol, dataType, shouldRefresh, lastRefresh, nextRefresh);
      const status = await db.getDataRefreshStatus(symbol, dataType);

      expect(status).toBeDefined();
      expect(status.shouldRefresh).toBe(shouldRefresh);
      expect(status.lastRefresh).toBe(lastRefresh);
    });

    test('应该正确获取所有刷新状态', async () => {
      const symbol = 'BTCUSDT';

      // 更新多个数据类型的状态
      await db.updateDataRefreshStatus(symbol, 'trend_analysis', false, new Date().toISOString());
      await db.updateDataRefreshStatus(symbol, 'trend_scoring', true, new Date().toISOString());

      const allStatus = await db.getAllDataRefreshStatus(symbol);
      expect(allStatus).toBeDefined();
      expect(allStatus.trend_analysis).toBeDefined();
      expect(allStatus.trend_scoring).toBeDefined();
    });
  });

  describe('数据清理和优化', () => {
    test('应该正确清理历史数据', async () => {
      // 创建一些测试数据
      const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8天前

      await db.saveStrategyAnalysis({
        symbol: 'TESTUSDT',
        trend4h: '多头趋势',
        score: 5,
        timestamp: oldDate.toISOString()
      });

      const beforeCount = await db.getStrategyAnalysisCount();
      await db.cleanOldStrategyAnalysis(7); // 清理7天前的数据
      const afterCount = await db.getStrategyAnalysisCount();

      expect(afterCount).toBeLessThan(beforeCount);
    });

    test('应该正确执行数据库优化', async () => {
      expect(async () => {
        await db.optimizeDatabase();
      }).not.toThrow();
    });
  });

  describe('统计查询', () => {
    test('应该正确计算胜率统计', async () => {
      // 创建一些测试模拟交易数据
      const simulations = [
        { symbol: 'BTCUSDT', direction: 'LONG', isWin: true, profitLoss: 100 },
        { symbol: 'ETHUSDT', direction: 'SHORT', isWin: false, profitLoss: -50 },
        { symbol: 'LINKUSDT', direction: 'LONG', isWin: true, profitLoss: 75 }
      ];

      for (const sim of simulations) {
        await db.saveSimulation({
          ...sim,
          entryPrice: 100,
          stopLossPrice: 95,
          takeProfitPrice: 105,
          maxLeverage: 10,
          minMargin: 100,
          triggerReason: 'TEST'
        });
      }

      const stats = await db.getWinRateStats();
      expect(stats.total_trades).toBeGreaterThanOrEqual(3);
      expect(stats.win_rate).toBeGreaterThanOrEqual(0);
      expect(stats.win_rate).toBeLessThanOrEqual(100);
    });

    test('应该正确计算交易对统计', async () => {
      const symbolStats = await db.getSymbolStats();
      expect(Array.isArray(symbolStats)).toBe(true);
    });

    test('应该正确计算方向统计', async () => {
      const directionStats = await db.getDirectionStats();
      expect(directionStats).toBeDefined();
      expect(directionStats.long).toBeDefined();
      expect(directionStats.short).toBeDefined();
    });
  });

  describe('错误处理', () => {
    test('应该处理无效数据', async () => {
      expect(async () => {
        await db.saveStrategyAnalysis(null);
      }).rejects.toThrow();

      expect(async () => {
        await db.saveSimulation(null);
      }).rejects.toThrow();
    });

    test('应该处理数据库连接错误', async () => {
      const invalidDb = new DatabaseManager('/invalid/path/db.sqlite');
      expect(async () => {
        await invalidDb.init();
      }).rejects.toThrow();
    });
  });
});
