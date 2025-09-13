// tests/cache-logic-integration.test.js
// 缓存逻辑集成测试

const DataChangeDetector = require('../modules/cache/DataChangeDetector');

describe('缓存逻辑集成测试', () => {
  let detector;
  let mockDatabase;
  let mockCacheManager;

  beforeEach(() => {
    mockDatabase = {
      runQuery: jest.fn().mockResolvedValue([]),
      recordStrategyAnalysis: jest.fn().mockResolvedValue(true)
    };

    mockCacheManager = {
      del: jest.fn().mockResolvedValue(true),
      getStats: jest.fn().mockReturnValue({
        hits: 0,
        misses: 0,
        errors: 0,
        hitRate: '0%'
      })
    };

    detector = new DataChangeDetector(mockDatabase, mockCacheManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('数据更新流程集成', () => {
    test('应该模拟updateTrendData流程', async () => {
      const symbol = 'BTCUSDT';
      const analysis1 = {
        symbol,
        trend: '多头趋势',
        hourlyScore: 85,
        execution: 'NONE',
        timestamp: Date.now()
      };

      const analysis2 = {
        symbol,
        trend: '空头趋势',
        hourlyScore: 75,
        execution: 'NONE',
        timestamp: Date.now()
      };

      // 模拟第一次更新
      const hasChanged1 = await detector.detectDataChange(symbol, 'trend', analysis1);
      expect(hasChanged1).toBe(true);

      // 模拟数据库更新（在检测到变化后）
      if (hasChanged1) {
        await mockDatabase.recordStrategyAnalysis(analysis1);
      }

      // 模拟第二次更新相同数据
      const hasChanged2 = await detector.detectDataChange(symbol, 'trend', analysis1);
      expect(hasChanged2).toBe(false);

      // 模拟第三次更新不同数据
      const hasChanged3 = await detector.detectDataChange(symbol, 'trend', analysis2);
      expect(hasChanged3).toBe(true);

      // 模拟数据库更新（在检测到变化后）
      if (hasChanged3) {
        await mockDatabase.recordStrategyAnalysis(analysis2);
      }

      // 验证数据库被调用了2次（第一次和第三次）
      expect(mockDatabase.recordStrategyAnalysis).toHaveBeenCalledTimes(2);
    });

    test('应该模拟updateSignalData流程', async () => {
      const symbol = 'ETHUSDT';
      const analysis1 = {
        symbol,
        trend: '震荡市',
        hourlyScore: 60,
        signal: 'NONE',
        execution: 'NONE',
        timestamp: Date.now()
      };

      const analysis2 = {
        symbol,
        trend: '震荡市',
        hourlyScore: 80,
        signal: 'SIGNAL_多头回踩突破',
        execution: '做多_15min',
        timestamp: Date.now()
      };

      // 第一次更新
      const hasChanged1 = await detector.detectDataChange(symbol, 'signal', analysis1);
      expect(hasChanged1).toBe(true);

      if (hasChanged1) {
        await mockDatabase.recordStrategyAnalysis(analysis1);
      }

      // 第二次更新不同数据
      const hasChanged2 = await detector.detectDataChange(symbol, 'signal', analysis2);
      expect(hasChanged2).toBe(true);

      if (hasChanged2) {
        await mockDatabase.recordStrategyAnalysis(analysis2);
      }

      expect(mockDatabase.recordStrategyAnalysis).toHaveBeenCalledTimes(2);
    });

    test('应该模拟updateExecutionData流程', async () => {
      const symbol = 'LINKUSDT';
      const analysis1 = {
        symbol,
        trend: '震荡市',
        hourlyScore: 70,
        signal: 'NONE',
        execution: 'NONE',
        executionMode: 'NONE',
        timestamp: Date.now()
      };

      const analysis2 = {
        symbol,
        trend: '震荡市',
        hourlyScore: 70,
        signal: 'SIGNAL_空头回踩突破',
        execution: '做空_15min',
        executionMode: '空头回踩突破',
        timestamp: Date.now()
      };

      // 第一次更新
      const hasChanged1 = await detector.detectDataChange(symbol, 'execution', analysis1);
      expect(hasChanged1).toBe(true);

      if (hasChanged1) {
        await mockDatabase.recordStrategyAnalysis(analysis1);
      }

      // 第二次更新不同数据
      const hasChanged2 = await detector.detectDataChange(symbol, 'execution', analysis2);
      expect(hasChanged2).toBe(true);

      if (hasChanged2) {
        await mockDatabase.recordStrategyAnalysis(analysis2);
      }

      expect(mockDatabase.recordStrategyAnalysis).toHaveBeenCalledTimes(2);
    });
  });

  describe('缓存同步机制', () => {
    test('应该根据数据类型清除对应缓存', async () => {
      const symbol = 'BTCUSDT';
      const analysis = { symbol, trend: '多头趋势' };

      // 测试trend类型
      await detector.detectDataChange(symbol, 'trend', analysis);
      
      expect(mockCacheManager.del).toHaveBeenCalledWith('strategy', `strategy_analysis:${symbol}`);
      expect(mockCacheManager.del).toHaveBeenCalledWith('strategy', `trend:${symbol}`);
      expect(mockCacheManager.del).toHaveBeenCalledWith('api', 'signals');
      expect(mockCacheManager.del).toHaveBeenCalledWith('api', 'stats');
    });

    test('应该为不同数据类型清除不同缓存', async () => {
      const symbol = 'ETHUSDT';
      const analysis = { symbol, signal: 'NONE' };

      // 测试signal类型
      await detector.detectDataChange(symbol, 'signal', analysis);
      
      expect(mockCacheManager.del).toHaveBeenCalledWith('strategy', `strategy_analysis:${symbol}`);
      expect(mockCacheManager.del).toHaveBeenCalledWith('strategy', `signals:${symbol}`);
      expect(mockCacheManager.del).toHaveBeenCalledWith('api', 'signals');
      expect(mockCacheManager.del).toHaveBeenCalledWith('api', 'stats');
    });

    test('应该为execution类型清除对应缓存', async () => {
      const symbol = 'LINKUSDT';
      const analysis = { symbol, execution: '做多_15min' };

      // 测试execution类型
      await detector.detectDataChange(symbol, 'execution', analysis);
      
      expect(mockCacheManager.del).toHaveBeenCalledWith('strategy', `strategy_analysis:${symbol}`);
      expect(mockCacheManager.del).toHaveBeenCalledWith('strategy', `execution:${symbol}`);
      expect(mockCacheManager.del).toHaveBeenCalledWith('api', 'signals');
      expect(mockCacheManager.del).toHaveBeenCalledWith('api', 'stats');
    });
  });

  describe('性能优化验证', () => {
    test('应该避免不必要的数据库写入', async () => {
      const symbol = 'BTCUSDT';
      const analysis = { symbol, trend: '多头趋势', score: 85 };

      // 第一次更新
      await detector.detectDataChange(symbol, 'trend', analysis);
      expect(mockDatabase.recordStrategyAnalysis).toHaveBeenCalledTimes(0); // 这里不直接调用

      // 第二次更新相同数据
      await detector.detectDataChange(symbol, 'trend', analysis);
      expect(mockDatabase.recordStrategyAnalysis).toHaveBeenCalledTimes(0); // 这里不直接调用

      // 验证只有第一次检测到变化
      expect(detector.dataHashes.size).toBe(1);
    });

    test('应该避免不必要的缓存操作', async () => {
      const symbol = 'BTCUSDT';
      const analysis = { symbol, trend: '多头趋势' };

      // 第一次更新
      await detector.detectDataChange(symbol, 'trend', analysis);
      const firstCallCount = mockCacheManager.del.mock.calls.length;

      // 第二次更新相同数据
      await detector.detectDataChange(symbol, 'trend', analysis);
      const secondCallCount = mockCacheManager.del.mock.calls.length;

      // 第二次不应该有额外的缓存操作
      expect(secondCallCount).toBe(firstCallCount);
    });
  });

  describe('错误处理', () => {
    test('应该处理数据库错误', async () => {
      mockDatabase.recordStrategyAnalysis.mockRejectedValue(new Error('Database error'));

      const symbol = 'BTCUSDT';
      const analysis = { symbol, trend: '多头趋势' };

      // 检测应该成功，即使数据库操作失败
      const result = await detector.detectDataChange(symbol, 'trend', analysis);
      expect(result).toBe(true);
    });

    test('应该处理缓存错误', async () => {
      mockCacheManager.del.mockRejectedValue(new Error('Cache error'));

      const symbol = 'BTCUSDT';
      const analysis = { symbol, trend: '多头趋势' };

      // 检测应该成功，即使缓存操作失败
      const result = await detector.detectDataChange(symbol, 'trend', analysis);
      expect(result).toBe(true);
    });

    test('应该处理无效数据', async () => {
      const symbol = 'BTCUSDT';
      const invalidData = null;

      const result = await detector.detectDataChange(symbol, 'trend', invalidData);
      expect(result).toBe(false);
    });
  });

  describe('并发处理', () => {
    test('应该处理并发数据更新', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'LINKUSDT'];
      const analyses = symbols.map(symbol => ({
        symbol,
        trend: '多头趋势',
        score: Math.floor(Math.random() * 100)
      }));

      // 并发检测
      const promises = analyses.map((analysis, index) => 
        detector.detectDataChange(analysis.symbol, 'trend', analysis)
      );

      const results = await Promise.all(promises);

      // 所有检测都应该成功
      expect(results.every(result => result === true)).toBe(true);
      expect(detector.dataHashes.size).toBe(symbols.length);
    });
  });

  describe('内存管理', () => {
    test('应该正确管理哈希记录', async () => {
      const symbol = 'BTCUSDT';
      const dataType = 'trend';
      const analysis = { symbol, trend: '多头趋势' };

      // 添加记录
      await detector.detectDataChange(symbol, dataType, analysis);
      expect(detector.dataHashes.size).toBe(1);

      // 获取统计信息
      const stats = detector.getHashStats();
      expect(stats.totalKeys).toBe(1);
      expect(stats.keys).toContain(`${symbol}_${dataType}`);
    });

    test('应该清理过期记录', () => {
      // 添加大量记录
      for (let i = 0; i < 1200; i++) {
        detector.dataHashes.set(`key_${i}`, `hash_${i}`);
      }

      expect(detector.dataHashes.size).toBe(1200);

      // 清理
      detector.cleanup();

      expect(detector.dataHashes.size).toBeLessThanOrEqual(500);
    });
  });

  describe('监听器机制', () => {
    test('应该正确通知监听器', async () => {
      const listener = jest.fn();
      detector.addChangeListener(listener);

      const symbol = 'BTCUSDT';
      const analysis = { symbol, trend: '多头趋势' };

      await detector.detectDataChange(symbol, 'trend', analysis);

      expect(listener).toHaveBeenCalledWith(symbol, 'trend', analysis);
    });

    test('应该支持多个监听器', async () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      detector.addChangeListener(listener1);
      detector.addChangeListener(listener2);

      const symbol = 'BTCUSDT';
      const analysis = { symbol, trend: '多头趋势' };

      await detector.detectDataChange(symbol, 'trend', analysis);

      expect(listener1).toHaveBeenCalledWith(symbol, 'trend', analysis);
      expect(listener2).toHaveBeenCalledWith(symbol, 'trend', analysis);
    });
  });
});
