// tests/cache-sync-mechanism.test.js
// 缓存同步机制测试

const DataChangeDetector = require('../modules/cache/DataChangeDetector');

describe('缓存同步机制测试', () => {
  let detector;
  let mockDatabase;
  let mockCacheManager;

  beforeEach(() => {
    mockDatabase = {
      runQuery: jest.fn().mockResolvedValue([])
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

  describe('缓存键映射', () => {
    test('应该为trend类型清除正确缓存', async () => {
      const symbol = 'BTCUSDT';
      const analysis = { symbol, trend: '多头趋势' };

      await detector.detectDataChange(symbol, 'trend', analysis);

      // 验证trend类型的缓存键
      expect(mockCacheManager.del).toHaveBeenCalledWith('strategy', `strategy_analysis:${symbol}`);
      expect(mockCacheManager.del).toHaveBeenCalledWith('strategy', `trend:${symbol}`);
      expect(mockCacheManager.del).toHaveBeenCalledWith('api', 'signals');
      expect(mockCacheManager.del).toHaveBeenCalledWith('api', 'stats');
    });

    test('应该为signal类型清除正确缓存', async () => {
      const symbol = 'ETHUSDT';
      const analysis = { symbol, signal: 'NONE' };

      await detector.detectDataChange(symbol, 'signal', analysis);

      // 验证signal类型的缓存键
      expect(mockCacheManager.del).toHaveBeenCalledWith('strategy', `strategy_analysis:${symbol}`);
      expect(mockCacheManager.del).toHaveBeenCalledWith('strategy', `signals:${symbol}`);
      expect(mockCacheManager.del).toHaveBeenCalledWith('api', 'signals');
      expect(mockCacheManager.del).toHaveBeenCalledWith('api', 'stats');
    });

    test('应该为execution类型清除正确缓存', async () => {
      const symbol = 'LINKUSDT';
      const analysis = { symbol, execution: '做多_15min' };

      await detector.detectDataChange(symbol, 'execution', analysis);

      // 验证execution类型的缓存键
      expect(mockCacheManager.del).toHaveBeenCalledWith('strategy', 'strategy_analysis:LINKUSDT');
      expect(mockCacheManager.del).toHaveBeenCalledWith('strategy', 'execution:LINKUSDT');
      expect(mockCacheManager.del).toHaveBeenCalledWith('api', 'signals');
      expect(mockCacheManager.del).toHaveBeenCalledWith('api', 'stats');
    });

    test('应该为未知类型清除默认缓存', async () => {
      const symbol = 'ADAUSDT';
      const analysis = { symbol, customField: 'value' };

      await detector.detectDataChange(symbol, 'unknown', analysis);

      // 验证默认缓存键（空数组）
      expect(mockCacheManager.del).toHaveBeenCalledWith('api', 'signals');
      expect(mockCacheManager.del).toHaveBeenCalledWith('api', 'stats');
      expect(mockCacheManager.del).toHaveBeenCalledWith('api', 'update-times');
    });
  });

  describe('全局缓存清除', () => {
    test('应该清除所有API级别缓存', async () => {
      const symbol = 'BTCUSDT';
      const analysis = { symbol, trend: '多头趋势' };

      await detector.detectDataChange(symbol, 'trend', analysis);

      // 验证全局API缓存被清除
      expect(mockCacheManager.del).toHaveBeenCalledWith('api', 'signals');
      expect(mockCacheManager.del).toHaveBeenCalledWith('api', 'stats');
      expect(mockCacheManager.del).toHaveBeenCalledWith('api', 'update-times');
    });

    test('应该为每个数据类型都清除全局缓存', async () => {
      const symbol = 'BTCUSDT';
      const analyses = [
        { symbol, trend: '多头趋势' },
        { symbol, signal: 'NONE' },
        { symbol, execution: '做多_15min' }
      ];

      for (const analysis of analyses) {
        await detector.detectDataChange(symbol, 'trend', analysis);
        await detector.detectDataChange(symbol, 'signal', analysis);
        await detector.detectDataChange(symbol, 'execution', analysis);
      }

      // 验证全局API缓存被多次清除
      const globalCacheCalls = mockCacheManager.del.mock.calls.filter(call => 
        call[0] === 'api' && ['signals', 'stats', 'update-times'].includes(call[1])
      );
      expect(globalCacheCalls.length).toBeGreaterThan(0);
    });
  });

  describe('缓存操作错误处理', () => {
    test('应该处理单个缓存键清除失败', async () => {
      // 模拟部分缓存操作失败
      mockCacheManager.del
        .mockResolvedValueOnce(true)  // 第一个成功
        .mockRejectedValueOnce(new Error('Cache error'))  // 第二个失败
        .mockResolvedValueOnce(true);  // 第三个成功

      const symbol = 'BTCUSDT';
      const analysis = { symbol, trend: '多头趋势' };

      // 应该不抛出错误
      await expect(detector.detectDataChange(symbol, 'trend', analysis)).resolves.not.toThrow();
    });

    test('应该处理所有缓存操作失败', async () => {
      // 模拟所有缓存操作失败
      mockCacheManager.del.mockRejectedValue(new Error('Cache error'));

      const symbol = 'BTCUSDT';
      const analysis = { symbol, trend: '多头趋势' };

      // 应该不抛出错误
      await expect(detector.detectDataChange(symbol, 'trend', analysis)).resolves.not.toThrow();
    });

    test('应该处理缓存管理器未初始化', async () => {
      detector.cacheManager = null;

      const symbol = 'BTCUSDT';
      const analysis = { symbol, trend: '多头趋势' };

      // 应该不抛出错误
      await expect(detector.detectDataChange(symbol, 'trend', analysis)).resolves.not.toThrow();
    });
  });

  describe('缓存同步性能', () => {
    test('应该批量清除缓存键', async () => {
      const symbol = 'BTCUSDT';
      const analysis = { symbol, trend: '多头趋势' };

      await detector.detectDataChange(symbol, 'trend', analysis);

      // 验证缓存操作被调用
      expect(mockCacheManager.del).toHaveBeenCalled();
      
      // 验证调用次数合理（不应该过多）
      expect(mockCacheManager.del.mock.calls.length).toBeLessThanOrEqual(10);
    });

    test('应该避免重复清除相同缓存键', async () => {
      const symbol = 'BTCUSDT';
      const analysis = { symbol, trend: '多头趋势' };

      // 多次检测相同数据
      await detector.detectDataChange(symbol, 'trend', analysis);
      await detector.detectDataChange(symbol, 'trend', analysis);
      await detector.detectDataChange(symbol, 'trend', analysis);

      // 只有第一次应该清除缓存
      const strategyCacheCalls = mockCacheManager.del.mock.calls.filter(call => 
        call[0] === 'strategy'
      );
      expect(strategyCacheCalls.length).toBe(4); // 只有第一次调用的4个策略缓存键
    });
  });

  describe('缓存同步时机', () => {
    test('应该只在数据变化时清除缓存', async () => {
      const symbol = 'BTCUSDT';
      const analysis = { symbol, trend: '多头趋势' };

      // 第一次检测
      await detector.detectDataChange(symbol, 'trend', analysis);
      const firstCallCount = mockCacheManager.del.mock.calls.length;

      // 第二次检测相同数据
      await detector.detectDataChange(symbol, 'trend', analysis);
      const secondCallCount = mockCacheManager.del.mock.calls.length;

      // 第二次不应该有额外的缓存操作
      expect(secondCallCount).toBe(firstCallCount);
    });

    test('应该在不同数据变化时清除缓存', async () => {
      const symbol = 'BTCUSDT';
      const analysis1 = { symbol, trend: '多头趋势' };
      const analysis2 = { symbol, trend: '空头趋势' };

      // 第一次检测
      await detector.detectDataChange(symbol, 'trend', analysis1);
      const firstCallCount = mockCacheManager.del.mock.calls.length;

      // 第二次检测不同数据
      await detector.detectDataChange(symbol, 'trend', analysis2);
      const secondCallCount = mockCacheManager.del.mock.calls.length;

      // 第二次应该有额外的缓存操作
      expect(secondCallCount).toBeGreaterThan(firstCallCount);
    });
  });

  describe('多交易对缓存同步', () => {
    test('应该为不同交易对独立清除缓存', async () => {
      const analyses = [
        { symbol: 'BTCUSDT', trend: '多头趋势' },
        { symbol: 'ETHUSDT', trend: '空头趋势' },
        { symbol: 'LINKUSDT', trend: '震荡市' }
      ];

      for (const analysis of analyses) {
        await detector.detectDataChange(analysis.symbol, 'trend', analysis);
      }

      // 验证每个交易对的缓存都被清除
      expect(mockCacheManager.del).toHaveBeenCalledWith('strategy', 'strategy_analysis:BTCUSDT');
      expect(mockCacheManager.del).toHaveBeenCalledWith('strategy', 'strategy_analysis:ETHUSDT');
      expect(mockCacheManager.del).toHaveBeenCalledWith('strategy', 'strategy_analysis:LINKUSDT');
    });

    test('应该为不同数据类型独立清除缓存', async () => {
      const symbol = 'BTCUSDT';
      const analyses = [
        { symbol, trend: '多头趋势' },
        { symbol, signal: 'NONE' },
        { symbol, execution: '做多_15min' }
      ];

      await detector.detectDataChange(symbol, 'trend', analyses[0]);
      await detector.detectDataChange(symbol, 'signal', analyses[1]);
      await detector.detectDataChange(symbol, 'execution', analyses[2]);

      // 验证不同数据类型的缓存都被清除
      expect(mockCacheManager.del).toHaveBeenCalledWith('strategy', `trend:${symbol}`);
      expect(mockCacheManager.del).toHaveBeenCalledWith('strategy', `signals:${symbol}`);
      expect(mockCacheManager.del).toHaveBeenCalledWith('strategy', `execution:${symbol}`);
    });
  });

  describe('缓存同步监控', () => {
    test('应该记录缓存清除操作', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const symbol = 'BTCUSDT';
      const analysis = { symbol, trend: '多头趋势' };

      await detector.detectDataChange(symbol, 'trend', analysis);

      // 验证日志记录
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('清除缓存'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('缓存更新完成'));

      consoleSpy.mockRestore();
    });

    test('应该处理缓存清除错误并记录', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockCacheManager.del.mockRejectedValue(new Error('Cache error'));

      const symbol = 'BTCUSDT';
      const analysis = { symbol, trend: '多头趋势' };

      await detector.detectDataChange(symbol, 'trend', analysis);

      // 验证错误日志记录
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('清除缓存失败'), expect.any(String));

      consoleSpy.mockRestore();
    });
  });
});
