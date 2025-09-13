// cache-manager.test.js
// CacheManager缓存管理测试

const CacheManager = require('../modules/cache/CacheManager');

describe('CacheManager 缓存管理测试', () => {
  let cacheManager;

  beforeEach(() => {
    cacheManager = new CacheManager();
  });

  afterEach(() => {
    if (cacheManager) {
      cacheManager.destroy();
    }
  });

  describe('基础缓存操作', () => {
    test('应该正确设置和获取缓存', async () => {
      const key = 'test:key';
      const value = { data: 'test value', timestamp: Date.now() };
      const ttl = 60; // 60秒

      await cacheManager.set(key, value, ttl);
      const result = await cacheManager.get(key);

      expect(result).toBeDefined();
      expect(result.data).toBe('test value');
    });

    test('应该正确处理缓存过期', async () => {
      const key = 'test:expire';
      const value = { data: 'expire test' };
      const ttl = 1; // 1秒

      await cacheManager.set(key, value, ttl);

      // 立即获取应该成功
      let result = await cacheManager.get(key);
      expect(result).toBeDefined();

      // 等待过期
      await new Promise(resolve => setTimeout(resolve, 1100));

      // 过期后获取应该返回null
      result = await cacheManager.get(key);
      expect(result).toBeNull();
    });

    test('应该正确删除缓存', async () => {
      const key = 'test:delete';
      const value = { data: 'delete test' };

      await cacheManager.set(key, value, 60);
      let result = await cacheManager.get(key);
      expect(result).toBeDefined();

      await cacheManager.delete(key);
      result = await cacheManager.get(key);
      expect(result).toBeNull();
    });

    test('应该检查缓存是否存在', async () => {
      const key = 'test:exists';
      const value = { data: 'exists test' };

      let exists = await cacheManager.exists(key);
      expect(exists).toBe(false);

      await cacheManager.set(key, value, 60);
      exists = await cacheManager.exists(key);
      expect(exists).toBe(true);
    });
  });

  describe('批量缓存操作', () => {
    test('应该正确批量设置缓存', async () => {
      const data = {
        'batch:key1': { data: 'value1' },
        'batch:key2': { data: 'value2' },
        'batch:key3': { data: 'value3' }
      };
      const ttl = 60;

      await cacheManager.mset(data, ttl);

      for (const [key, value] of Object.entries(data)) {
        const result = await cacheManager.get(key);
        expect(result.data).toBe(value.data);
      }
    });

    test('应该正确批量获取缓存', async () => {
      const keys = ['batch:get1', 'batch:get2', 'batch:get3'];
      const values = [
        { data: 'get1' },
        { data: 'get2' },
        { data: 'get3' }
      ];

      // 设置缓存
      for (let i = 0; i < keys.length; i++) {
        await cacheManager.set(keys[i], values[i], 60);
      }

      // 批量获取
      const results = await cacheManager.mget(keys);
      expect(results).toHaveLength(3);
      expect(results[0].data).toBe('get1');
      expect(results[1].data).toBe('get2');
      expect(results[2].data).toBe('get3');
    });

    test('应该正确批量删除缓存', async () => {
      const keys = ['batch:del1', 'batch:del2', 'batch:del3'];

      // 设置缓存
      for (const key of keys) {
        await cacheManager.set(key, { data: 'delete test' }, 60);
      }

      // 批量删除
      await cacheManager.mdelete(keys);

      // 验证删除
      for (const key of keys) {
        const result = await cacheManager.get(key);
        expect(result).toBeNull();
      }
    });
  });

  describe('缓存模式管理', () => {
    test('应该正确管理不同类型的缓存', async () => {
      const signals = { BTCUSDT: { trend: 'bullish' } };
      const monitoring = { totalSymbols: 21 };
      const simulations = { total: 100 };

      await cacheManager.setSignals(signals);
      await cacheManager.setMonitoring(monitoring);
      await cacheManager.setSimulations(simulations);

      const cachedSignals = await cacheManager.getSignals();
      const cachedMonitoring = await cacheManager.getMonitoring();
      const cachedSimulations = await cacheManager.getSimulations();

      expect(cachedSignals.BTCUSDT.trend).toBe('bullish');
      expect(cachedMonitoring.totalSymbols).toBe(21);
      expect(cachedSimulations.total).toBe(100);
    });

    test('应该正确设置用户设置缓存', async () => {
      const settings = {
        maxLossAmount: '100',
        refreshInterval: '5000'
      };

      await cacheManager.setUserSettings(settings);
      const cached = await cacheManager.getUserSettings();

      expect(cached.maxLossAmount).toBe('100');
      expect(cached.refreshInterval).toBe('5000');
    });
  });

  describe('缓存统计和监控', () => {
    test('应该正确获取缓存统计', async () => {
      // 设置一些缓存数据
      await cacheManager.set('stats:test1', { data: 'test1' }, 60);
      await cacheManager.set('stats:test2', { data: 'test2' }, 60);
      await cacheManager.get('stats:test1'); // 命中
      await cacheManager.get('stats:test3'); // 未命中

      const stats = await cacheManager.getStats();

      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.misses).toBeGreaterThan(0);
      expect(stats.hitRate).toBeDefined();
      expect(stats.memoryCacheSize).toBeGreaterThan(0);
    });

    test('应该正确清理过期缓存', async () => {
      // 设置一些会过期的缓存
      await cacheManager.set('cleanup:test1', { data: 'test1' }, 1);
      await cacheManager.set('cleanup:test2', { data: 'test2' }, 1);
      await cacheManager.set('cleanup:test3', { data: 'test3' }, 60);

      // 等待过期
      await new Promise(resolve => setTimeout(resolve, 1100));

      // 清理过期缓存
      await cacheManager.cleanup();

      // 验证过期缓存被清理
      expect(await cacheManager.get('cleanup:test1')).toBeNull();
      expect(await cacheManager.get('cleanup:test2')).toBeNull();
      expect(await cacheManager.get('cleanup:test3')).toBeDefined();
    });
  });

  describe('缓存预热', () => {
    test('应该正确预热缓存', async () => {
      const preloadData = {
        'preload:key1': { data: 'preload1' },
        'preload:key2': { data: 'preload2' }
      };

      await cacheManager.preload(preloadData, 60);

      const result1 = await cacheManager.get('preload:key1');
      const result2 = await cacheManager.get('preload:key2');

      expect(result1.data).toBe('preload1');
      expect(result2.data).toBe('preload2');
    });
  });

  describe('缓存清理', () => {
    test('应该正确清理所有缓存', async () => {
      // 设置一些缓存
      await cacheManager.set('clear:test1', { data: 'test1' }, 60);
      await cacheManager.set('clear:test2', { data: 'test2' }, 60);

      // 清理所有缓存
      await cacheManager.clear();

      // 验证缓存被清理
      expect(await cacheManager.get('clear:test1')).toBeNull();
      expect(await cacheManager.get('clear:test2')).toBeNull();
    });

    test('应该正确按模式清理缓存', async () => {
      // 设置不同类型的缓存
      await cacheManager.setSignals({ BTCUSDT: { trend: 'bullish' } });
      await cacheManager.setMonitoring({ totalSymbols: 21 });
      await cacheManager.setSimulations({ total: 100 });

      // 清理信号缓存
      await cacheManager.clearByPattern('signals:*');

      // 验证信号缓存被清理，其他缓存保留
      expect(await cacheManager.getSignals()).toBeNull();
      expect(await cacheManager.getMonitoring()).toBeDefined();
      expect(await cacheManager.getSimulations()).toBeDefined();
    });
  });

  describe('错误处理', () => {
    test('应该处理无效键名', async () => {
      expect(async () => {
        await cacheManager.set(null, { data: 'test' }, 60);
      }).rejects.toThrow();

      expect(async () => {
        await cacheManager.set('', { data: 'test' }, 60);
      }).rejects.toThrow();
    });

    test('应该处理无效值', async () => {
      expect(async () => {
        await cacheManager.set('test:key', null, 60);
      }).rejects.toThrow();
    });

    test('应该处理无效TTL', async () => {
      expect(async () => {
        await cacheManager.set('test:key', { data: 'test' }, -1);
      }).rejects.toThrow();
    });
  });

  describe('内存管理', () => {
    test('应该正确管理内存使用', async () => {
      // 设置大量缓存数据
      for (let i = 0; i < 100; i++) {
        await cacheManager.set(`memory:test${i}`, { data: `test${i}` }, 60);
      }

      const stats = await cacheManager.getStats();
      expect(stats.memoryCacheSize).toBeGreaterThan(0);

      // 清理内存
      await cacheManager.cleanup();

      const statsAfterCleanup = await cacheManager.getStats();
      expect(statsAfterCleanup.memoryCacheSize).toBeLessThanOrEqual(stats.memoryCacheSize);
    });
  });
});
