/**
 * 数据库操作单测 - 测试驱动开发
 * 基于database-design.md中的数据库设计
 */

const DatabaseOperations = require('../../src/database/operations');
const { createMockSymbol, createMockJudgment, createMockTrade } = require('../setup');

describe('数据库操作', () => {
  let dbOps;
  let mockConnection;
  let mockCache;

  beforeEach(() => {
    // 模拟数据库连接
    mockConnection = {
      query: jest.fn(),
      execute: jest.fn(),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn()
    };

    // 模拟缓存
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn()
    };

    dbOps = new DatabaseOperations({
      connection: mockConnection,
      cache: mockCache
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('交易对管理', () => {
    test('应该正确创建交易对', async () => {
      // Arrange
      const symbolData = createMockSymbol('BTCUSDT');
      mockConnection.execute.mockResolvedValue([{ insertId: 1 }]);

      // Act
      const result = await dbOps.createSymbol(symbolData);

      // Assert
      expect(result).toBe(1);
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO symbols'),
        expect.arrayContaining([
          symbolData.symbol,
          symbolData.status,
          symbolData.funding_rate,
          symbolData.last_price,
          symbolData.volume_24h,
          symbolData.price_change_24h
        ])
      );
    });

    test('应该正确获取交易对列表', async () => {
      // Arrange
      const mockSymbols = [createMockSymbol('BTCUSDT'), createMockSymbol('ETHUSDT')];
      mockConnection.query.mockResolvedValue([mockSymbols]);

      // Act
      const result = await dbOps.getSymbols();

      // Assert
      expect(result).toEqual(mockSymbols);
      expect(mockConnection.query).toHaveBeenCalledWith(
        'SELECT * FROM symbols WHERE status = ? ORDER BY updated_at DESC',
        ['ACTIVE']
      );
    });

    test('应该正确更新交易对信息', async () => {
      // Arrange
      const symbolId = 1;
      const updateData = {
        last_price: 51000,
        volume_24h: 1200000,
        price_change_24h: 3.5
      };
      mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }]);

      // Act
      const result = await dbOps.updateSymbol(symbolId, updateData);

      // Assert
      expect(result).toBe(true);
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE symbols SET'),
        expect.arrayContaining([51000, 1200000, 3.5, symbolId])
      );
    });

    test('应该正确删除交易对', async () => {
      // Arrange
      const symbolId = 1;
      mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }]);

      // Act
      const result = await dbOps.deleteSymbol(symbolId);

      // Assert
      expect(result).toBe(true);
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'UPDATE symbols SET status = ? WHERE id = ?',
        ['INACTIVE', symbolId]
      );
    });
  });

  describe('策略判断记录', () => {
    test('应该正确保存策略判断结果', async () => {
      // Arrange
      const judgment = createMockJudgment('BTCUSDT', 'V3', '4H');
      mockConnection.execute.mockResolvedValue([{ insertId: 1 }]);

      // Act
      const result = await dbOps.saveStrategyJudgment(judgment);

      // Assert
      expect(result).toBe(1);
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO strategy_judgments'),
        expect.arrayContaining([
          judgment.symbol_id,
          judgment.strategy_name,
          judgment.timeframe,
          judgment.trend_direction,
          judgment.entry_signal,
          judgment.confidence_score,
          JSON.stringify(judgment.indicators_data)
        ])
      );
    });

    test('应该正确获取策略判断历史', async () => {
      // Arrange
      const symbol = 'BTCUSDT';
      const strategy = 'V3';
      const timeframe = '4H';
      const limit = 100;
      const mockJudgments = [createMockJudgment(symbol, strategy, timeframe)];
      mockConnection.query.mockResolvedValue([mockJudgments]);

      // Act
      const result = await dbOps.getStrategyJudgments(symbol, strategy, timeframe, limit);

      // Assert
      expect(result).toEqual(mockJudgments);
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT sj.*, s.symbol FROM strategy_judgments sj'),
        expect.arrayContaining([symbol, strategy, timeframe, limit])
      );
    });

    test('应该正确获取最新策略判断', async () => {
      // Arrange
      const symbol = 'BTCUSDT';
      const strategy = 'V3';
      const mockJudgment = createMockJudgment(symbol, strategy, '4H');
      mockConnection.query.mockResolvedValue([[mockJudgment]]);

      // Act
      const result = await dbOps.getLatestStrategyJudgment(symbol, strategy);

      // Assert
      expect(result).toEqual(mockJudgment);
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT sj.*, s.symbol FROM strategy_judgments sj'),
        expect.arrayContaining([symbol, strategy])
      );
    });
  });

  describe('模拟交易记录', () => {
    test('应该正确创建模拟交易', async () => {
      // Arrange
      const trade = createMockTrade('BTCUSDT', 'V3');
      mockConnection.execute.mockResolvedValue([{ insertId: 1 }]);

      // Act
      const result = await dbOps.createSimulationTrade(trade);

      // Assert
      expect(result).toBe(1);
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO simulation_trades'),
        expect.arrayContaining([
          trade.symbol_id,
          trade.strategy_name,
          trade.trade_type,
          trade.entry_price,
          trade.quantity,
          trade.leverage,
          trade.margin_used,
          trade.stop_loss,
          trade.take_profit
        ])
      );
    });

    test('应该正确更新模拟交易', async () => {
      // Arrange
      const tradeId = 1;
      const updateData = {
        exit_price: 52000,
        pnl: 200,
        pnl_percentage: 4.0,
        status: 'CLOSED'
      };
      mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }]);

      // Act
      const result = await dbOps.updateSimulationTrade(tradeId, updateData);

      // Assert
      expect(result).toBe(true);
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE simulation_trades SET'),
        expect.arrayContaining([52000, 200, 4.0, 'CLOSED', tradeId])
      );
    });

    test('应该正确获取活跃交易', async () => {
      // Arrange
      const mockTrades = [createMockTrade('BTCUSDT', 'V3')];
      mockConnection.query.mockResolvedValue([mockTrades]);

      // Act
      const result = await dbOps.getActiveTrades();

      // Assert
      expect(result).toEqual(mockTrades);
      expect(mockConnection.query).toHaveBeenCalledWith(
        'SELECT st.*, s.symbol FROM simulation_trades st JOIN symbols s ON st.symbol_id = s.id WHERE st.status = ?',
        ['OPEN']
      );
    });

    test('应该正确获取交易历史', async () => {
      // Arrange
      const symbol = 'BTCUSDT';
      const strategy = 'V3';
      const limit = 100;
      const mockTrades = [createMockTrade(symbol, strategy)];
      mockConnection.query.mockResolvedValue([mockTrades]);

      // Act
      const result = await dbOps.getTradeHistory(symbol, strategy, limit);

      // Assert
      expect(result).toEqual(mockTrades);
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT st.*, s.symbol FROM simulation_trades st'),
        expect.arrayContaining([symbol, strategy, limit])
      );
    });
  });

  describe('系统监控数据', () => {
    test('应该正确保存监控数据', async () => {
      // Arrange
      const monitoringData = {
        metric_name: 'API_SUCCESS_RATE',
        metric_value: 98.5,
        metric_unit: '%',
        component: 'binance_api',
        status: 'NORMAL',
        details: { endpoint: '/api/v1/klines' }
      };
      mockConnection.execute.mockResolvedValue([{ insertId: 1 }]);

      // Act
      const result = await dbOps.saveMonitoringData(monitoringData);

      // Assert
      expect(result).toBe(1);
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO system_monitoring'),
        expect.arrayContaining([
          monitoringData.metric_name,
          monitoringData.metric_value,
          monitoringData.metric_unit,
          monitoringData.component,
          monitoringData.status,
          JSON.stringify(monitoringData.details)
        ])
      );
    });

    test('应该正确获取监控数据', async () => {
      // Arrange
      const metricName = 'API_SUCCESS_RATE';
      const component = 'binance_api';
      const hours = 24;
      const mockData = [{
        id: 1,
        metric_name: metricName,
        metric_value: 98.5,
        component,
        created_at: new Date()
      }];
      mockConnection.query.mockResolvedValue([mockData]);

      // Act
      const result = await dbOps.getMonitoringData(metricName, component, hours);

      // Assert
      expect(result).toEqual(mockData);
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM system_monitoring'),
        expect.arrayContaining([metricName, component, hours])
      );
    });
  });

  describe('统计数据', () => {
    test('应该正确更新交易对统计', async () => {
      // Arrange
      const symbolId = 1;
      const strategy = 'V3';
      const stats = {
        total_trades: 100,
        winning_trades: 65,
        losing_trades: 35,
        win_rate: 65.0,
        total_pnl: 2500.50,
        avg_pnl: 25.005,
        max_pnl: 500.00,
        min_pnl: -200.00,
        profit_factor: 1.85
      };
      mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }]);

      // Act
      const result = await dbOps.updateSymbolStatistics(symbolId, strategy, stats);

      // Assert
      expect(result).toBe(true);
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO symbol_statistics'),
        expect.arrayContaining([
          symbolId,
          strategy,
          stats.total_trades,
          stats.winning_trades,
          stats.losing_trades,
          stats.win_rate,
          stats.total_pnl,
          stats.avg_pnl,
          stats.max_pnl,
          stats.min_pnl,
          stats.profit_factor
        ])
      );
    });

    test('应该正确获取统计数据', async () => {
      // Arrange
      const symbol = 'BTCUSDT';
      const strategy = 'V3';
      const mockStats = {
        total_trades: 100,
        winning_trades: 65,
        win_rate: 65.0,
        total_pnl: 2500.50
      };
      mockConnection.query.mockResolvedValue([[mockStats]]);

      // Act
      const result = await dbOps.getSymbolStatistics(symbol, strategy);

      // Assert
      expect(result).toEqual(mockStats);
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT ss.*, s.symbol FROM symbol_statistics ss'),
        expect.arrayContaining([symbol, strategy])
      );
    });
  });

  describe('缓存操作', () => {
    test('应该正确设置缓存', async () => {
      // Arrange
      const key = 'strategy:judgment:BTCUSDT:V3:4H';
      const data = { trend_direction: 'UP', score: 85.5 };
      const ttl = 300;
      mockCache.set.mockResolvedValue('OK');

      // Act
      const result = await dbOps.setCache(key, data, ttl);

      // Assert
      expect(result).toBe(true);
      expect(mockCache.set).toHaveBeenCalledWith(key, JSON.stringify(data), 'EX', ttl);
    });

    test('应该正确获取缓存', async () => {
      // Arrange
      const key = 'strategy:judgment:BTCUSDT:V3:4H';
      const cachedData = { trend_direction: 'UP', score: 85.5 };
      mockCache.get.mockResolvedValue(JSON.stringify(cachedData));

      // Act
      const result = await dbOps.getCache(key);

      // Assert
      expect(result).toEqual(cachedData);
      expect(mockCache.get).toHaveBeenCalledWith(key);
    });

    test('应该正确处理缓存未命中', async () => {
      // Arrange
      const key = 'strategy:judgment:BTCUSDT:V3:4H';
      mockCache.get.mockResolvedValue(null);

      // Act
      const result = await dbOps.getCache(key);

      // Assert
      expect(result).toBeNull();
    });

    test('应该正确删除缓存', async () => {
      // Arrange
      const key = 'strategy:judgment:BTCUSDT:V3:4H';
      mockCache.del.mockResolvedValue(1);

      // Act
      const result = await dbOps.deleteCache(key);

      // Assert
      expect(result).toBe(true);
      expect(mockCache.del).toHaveBeenCalledWith(key);
    });
  });

  describe('事务操作', () => {
    test('应该正确执行事务', async () => {
      // Arrange
      const operations = [
        { type: 'insert', table: 'symbols', data: createMockSymbol('BTCUSDT') },
        { type: 'insert', table: 'strategy_judgments', data: createMockJudgment('BTCUSDT', 'V3', '4H') }
      ];
      mockConnection.beginTransaction.mockResolvedValue();
      mockConnection.execute.mockResolvedValue([{ insertId: 1 }]);
      mockConnection.commit.mockResolvedValue();

      // Act
      const result = await dbOps.executeTransaction(operations);

      // Assert
      expect(result).toBe(true);
      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.commit).toHaveBeenCalled();
      expect(mockConnection.rollback).not.toHaveBeenCalled();
    });

    test('应该正确处理事务回滚', async () => {
      // Arrange
      const operations = [
        { type: 'insert', table: 'symbols', data: createMockSymbol('BTCUSDT') },
        { type: 'insert', table: 'invalid_table', data: {} }
      ];
      mockConnection.beginTransaction.mockResolvedValue();
      mockConnection.execute
        .mockResolvedValueOnce([{ insertId: 1 }])
        .mockRejectedValueOnce(new Error('表不存在'));
      mockConnection.rollback.mockResolvedValue();

      // Act
      const result = await dbOps.executeTransaction(operations);

      // Assert
      expect(result).toBe(false);
      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockConnection.commit).not.toHaveBeenCalled();
    });
  });

  describe('数据清理', () => {
    test('应该正确清理过期数据', async () => {
      // Arrange
      const retentionDays = 60;
      mockConnection.execute.mockResolvedValue([{ affectedRows: 100 }]);

      // Act
      const result = await dbOps.cleanupExpiredData(retentionDays);

      // Assert
      expect(result).toHaveProperty('strategy_judgments', 100);
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM strategy_judgments'),
        expect.arrayContaining([retentionDays])
      );
    });

    test('应该正确优化表', async () => {
      // Arrange
      const tables = ['strategy_judgments', 'simulation_trades'];
      mockConnection.execute.mockResolvedValue([{ affectedRows: 0 }]);

      // Act
      const result = await dbOps.optimizeTables(tables);

      // Assert
      expect(result).toBe(true);
      expect(mockConnection.execute).toHaveBeenCalledTimes(2);
    });
  });

  describe('性能测试', () => {
    test('应该在合理时间内完成批量插入', async () => {
      // Arrange
      const judgments = Array.from({ length: 1000 }, (_, i) => 
        createMockJudgment(`SYMBOL${i}`, 'V3', '4H')
      );
      mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }]);
      const startTime = Date.now();

      // Act
      await dbOps.batchInsertJudgments(judgments);
      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(5000); // 5秒内完成
    });

    test('应该能够处理大量并发查询', async () => {
      // Arrange
      const queries = Array.from({ length: 100 }, () => 
        dbOps.getSymbols()
      );
      mockConnection.query.mockResolvedValue([[]]);

      // Act
      const startTime = Date.now();
      await Promise.all(queries);
      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(3000); // 3秒内完成
    });
  });
});
