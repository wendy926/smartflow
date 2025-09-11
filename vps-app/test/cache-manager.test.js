// test/cache-manager.test.js
// 缓存管理器单元测试

const CacheManager = require('../modules/cache/CacheManager');

// Mock RedisCache
jest.mock('../modules/cache/RedisCache', () => {
  return jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
    del: jest.fn().mockResolvedValue(true),
    exists: jest.fn().mockResolvedValue(false),
    expire: jest.fn().mockResolvedValue(true),
    ttl: jest.fn().mockResolvedValue(-1),
    flushAll: jest.fn().mockResolvedValue(true),
    getStats: jest.fn().mockResolvedValue({ connected: true, keyCount: 10 }),
    mget: jest.fn().mockResolvedValue([null, null]),
    mset: jest.fn().mockResolvedValue(true),
    isConnected: true,
    defaultTTL: 300
  }));
});

describe('CacheManager', () => {
  let cacheManager;

  beforeEach(() => {
    cacheManager = new CacheManager({
      redis: {
        host: 'localhost',
        port: 6379,
        password: null,
        db: 0
      },
      enableRedis: true,
      enableMemory: true
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    test('应该初始化缓存系统', async () => {
      const result = await cacheManager.initialize();

      expect(result).toBe(true);
    });

    test('应该处理Redis连接失败', async () => {
      const RedisCache = require('../modules/cache/RedisCache');
      RedisCache.mockImplementationOnce(() => ({
        connect: jest.fn().mockResolvedValue(false),
        on: jest.fn()
      }));

      const newCacheManager = new CacheManager({
        enableRedis: true,
        enableMemory: true
      });

      const result = await newCacheManager.initialize();

      expect(result).toBe(true); // 应该回退到内存缓存
    });
  });

  describe('set and get', () => {
    beforeEach(async () => {
      await cacheManager.initialize();
    });

    test('应该设置和获取缓存', async () => {
      const testData = { key: 'value', number: 123 };

      await cacheManager.set('test', 'key1', testData, 60);
      const result = await cacheManager.get('test', 'key1');

      expect(result).toEqual(testData);
    });

    test('应该处理缓存未命中', async () => {
      const result = await cacheManager.get('test', 'nonexistent');

      expect(result).toBeNull();
    });

    test('应该使用默认TTL', async () => {
      await cacheManager.set('test', 'key2', 'value');

      expect(cacheManager.redis.set).toHaveBeenCalledWith(
        'test:key2',
        'value',
        300 // 默认TTL
      );
    });
  });

  describe('delete', () => {
    beforeEach(async () => {
      await cacheManager.initialize();
    });

    test('应该删除缓存', async () => {
      const result = await cacheManager.del('test', 'key1');

      expect(result).toBe(true);
      expect(cacheManager.redis.del).toHaveBeenCalledWith('test:key1');
    });
  });

  describe('exists', () => {
    beforeEach(async () => {
      await cacheManager.initialize();
    });

    test('应该检查缓存是否存在', async () => {
      cacheManager.redis.exists.mockResolvedValue(true);

      const result = await cacheManager.exists('test', 'key1');

      expect(result).toBe(true);
    });

    test('应该处理Redis未连接的情况', async () => {
      cacheManager.redis.isConnected = false;

      const result = await cacheManager.exists('test', 'key1');

      expect(result).toBe(false);
    });
  });

  describe('mget', () => {
    beforeEach(async () => {
      await cacheManager.initialize();
    });

    test('应该批量获取缓存', async () => {
      const identifiers = ['key1', 'key2'];
      cacheManager.redis.mget.mockResolvedValue(['"value1"', null]);

      const result = await cacheManager.mget('test', identifiers);

      expect(result).toEqual({
        key1: '"value1"',
        key2: undefined
      });
    });
  });

  describe('mset', () => {
    beforeEach(async () => {
      await cacheManager.initialize();
    });

    test('应该批量设置缓存', async () => {
      const keyValuePairs = {
        'key1': 'value1',
        'key2': 'value2'
      };

      await cacheManager.mset(keyValuePairs, 60);

      expect(cacheManager.redis.mset).toHaveBeenCalledWith({
        'batch:key1': 'value1',
        'batch:key2': 'value2'
      }, 60);
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      await cacheManager.initialize();
    });

    test('应该清理过期缓存', async () => {
      // 添加过期的内存缓存
      cacheManager.memoryCache.set('test:expired', {
        value: 'expired',
        expiry: Date.now() - 1000
      });

      await cacheManager.cleanup();

      expect(cacheManager.memoryCache.has('test:expired')).toBe(false);
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      await cacheManager.initialize();
    });

    test('应该获取缓存统计信息', () => {
      cacheManager.cacheStats = { hits: 10, misses: 5, errors: 0 };

      const stats = cacheManager.getStats();

      expect(stats.hits).toBe(10);
      expect(stats.misses).toBe(5);
      expect(stats.hitRate).toBe('66.67%');
    });
  });

  describe('close', () => {
    beforeEach(async () => {
      await cacheManager.initialize();
    });

    test('应该关闭缓存系统', async () => {
      await cacheManager.close();

      expect(cacheManager.redis.disconnect).toHaveBeenCalled();
      expect(cacheManager.memoryCache.size).toBe(0);
    });
  });
});
