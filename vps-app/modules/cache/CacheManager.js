// modules/cache/CacheManager.js
// 缓存管理器 - 统一管理各种缓存策略

const RedisCache = require('./RedisCache');

class CacheManager {
  constructor(options = {}) {
    this.redis = new RedisCache(options.redis);
    this.memoryCache = new Map(); // 内存缓存作为Redis的备用
    this.cacheStats = {
      hits: 0,
      misses: 0,
      errors: 0
    };

    // 缓存配置
    this.config = {
      // 不同数据类型的TTL配置
      ttl: {
        'signals': 60,           // 信号数据1分钟
        'trend4h': 4 * 60 * 60,  // 4H趋势4小时
        'scoring1h': 60 * 60,    // 1H打分1小时
        'execution15m': 15 * 60, // 15分钟执行15分钟
        'monitoring': 30,        // 监控数据30秒
        'simulations': 5 * 60,   // 模拟交易5分钟
        'user_settings': 10 * 60 // 用户设置10分钟
      },
      // 内存缓存大小限制
      maxMemoryCacheSize: 1000,
      // 是否启用Redis
      enableRedis: options.enableRedis !== false,
      // 是否启用内存缓存
      enableMemory: options.enableMemory !== false
    };
  }

  /**
   * 初始化缓存系统
   */
  async initialize() {
    if (this.config.enableRedis) {
      const connected = await this.redis.connect();
      if (!connected) {
        console.warn('Redis连接失败，将使用内存缓存');
        this.config.enableRedis = false;
      }
    }

    console.log('✅ 缓存管理器初始化完成');
    return true;
  }

  /**
   * 生成缓存键
   */
  generateKey(type, identifier) {
    return `${type}:${identifier}`;
  }

  /**
   * 获取缓存
   */
  async get(type, identifier) {
    const key = this.generateKey(type, identifier);

    try {
      // 优先从Redis获取
      if (this.config.enableRedis && this.redis.isConnected) {
        const value = await this.redis.get(key);
        if (value !== null) {
          this.cacheStats.hits++;
          return value;
        }
      }

      // 从内存缓存获取
      if (this.config.enableMemory && this.memoryCache.has(key)) {
        const cached = this.memoryCache.get(key);
        if (cached.expiry > Date.now()) {
          this.cacheStats.hits++;
          return cached.value;
        } else {
          this.memoryCache.delete(key);
        }
      }

      this.cacheStats.misses++;
      return null;
    } catch (error) {
      console.error('缓存获取失败:', error);
      this.cacheStats.errors++;
      return null;
    }
  }

  /**
   * 设置缓存
   */
  async set(type, identifier, value, customTTL = null) {
    const key = this.generateKey(type, identifier);
    const ttl = customTTL || this.config.ttl[type] || this.redis.defaultTTL;

    try {
      // 设置Redis缓存
      if (this.config.enableRedis && this.redis.isConnected) {
        await this.redis.set(key, value, ttl);
      }

      // 设置内存缓存
      if (this.config.enableMemory) {
        // 检查内存缓存大小限制
        if (this.memoryCache.size >= this.config.maxMemoryCacheSize) {
          this.cleanupMemoryCache();
        }

        this.memoryCache.set(key, {
          value: value,
          expiry: Date.now() + (ttl * 1000)
        });
      }

      return true;
    } catch (error) {
      console.error('缓存设置失败:', error);
      this.cacheStats.errors++;
      return false;
    }
  }

  /**
   * 删除缓存
   */
  async del(type, identifier) {
    const key = this.generateKey(type, identifier);

    try {
      // 删除Redis缓存
      if (this.config.enableRedis && this.redis.isConnected) {
        await this.redis.del(key);
      }

      // 删除内存缓存
      if (this.config.enableMemory) {
        this.memoryCache.delete(key);
      }

      return true;
    } catch (error) {
      console.error('缓存删除失败:', error);
      this.cacheStats.errors++;
      return false;
    }
  }

  /**
   * 检查缓存是否存在
   */
  async exists(type, identifier) {
    const key = this.generateKey(type, identifier);

    try {
      // 优先从Redis检查
      if (this.config.enableRedis && this.redis.isConnected) {
        return await this.redis.exists(key);
      }

      // 从内存缓存检查
      if (this.config.enableMemory) {
        return this.memoryCache.has(key);
      }

      return false;
    } catch (error) {
      console.error('检查缓存存在失败:', error);
      this.cacheStats.errors++;
      return false;
    }
  }

  /**
   * 批量获取缓存
   */
  async mget(type, identifiers) {
    const keys = identifiers.map(id => this.generateKey(type, id));

    try {
      // 优先从Redis批量获取
      if (this.config.enableRedis && this.redis.isConnected) {
        const values = await this.redis.mget(keys);
        const results = {};

        identifiers.forEach((id, index) => {
          if (values[index] !== null) {
            results[id] = values[index];
            this.cacheStats.hits++;
          } else {
            this.cacheStats.misses++;
          }
        });

        return results;
      }

      // 从内存缓存获取
      const results = {};
      identifiers.forEach(id => {
        const key = this.generateKey(type, id);
        if (this.memoryCache.has(key)) {
          const cached = this.memoryCache.get(key);
          if (cached.expiry > Date.now()) {
            results[id] = cached.value;
            this.cacheStats.hits++;
          } else {
            this.memoryCache.delete(key);
            this.cacheStats.misses++;
          }
        } else {
          this.cacheStats.misses++;
        }
      });

      return results;
    } catch (error) {
      console.error('批量缓存获取失败:', error);
      this.cacheStats.errors++;
      return {};
    }
  }

  /**
   * 批量设置缓存
   */
  async mset(keyValuePairs, ttl = null) {
    try {
      const pairs = {};
      const expireTime = ttl || this.redis.defaultTTL;

      for (const [key, value] of Object.entries(keyValuePairs)) {
        const cacheKey = this.generateKey('batch', key);
        pairs[cacheKey] = value;
      }

      // 设置Redis缓存
      if (this.config.enableRedis && this.redis.isConnected) {
        await this.redis.mset(pairs, expireTime);
      }

      // 设置内存缓存
      if (this.config.enableMemory) {
        for (const [key, value] of Object.entries(pairs)) {
          this.memoryCache.set(key, {
            value: value,
            expiry: Date.now() + (expireTime * 1000)
          });
        }
      }

      return true;
    } catch (error) {
      console.error('批量缓存设置失败:', error);
      this.cacheStats.errors++;
      return false;
    }
  }

  /**
   * 清理内存缓存
   */
  cleanupMemoryCache() {
    const now = Date.now();
    const toDelete = [];

    for (const [key, cached] of this.memoryCache.entries()) {
      if (cached.expiry <= now) {
        toDelete.push(key);
      }
    }

    toDelete.forEach(key => this.memoryCache.delete(key));

    // 如果还是超过限制，删除最旧的缓存
    if (this.memoryCache.size >= this.config.maxMemoryCacheSize) {
      const entries = Array.from(this.memoryCache.entries());
      entries.sort((a, b) => a[1].expiry - b[1].expiry);

      const toRemove = entries.slice(0, Math.floor(this.config.maxMemoryCacheSize * 0.2));
      toRemove.forEach(([key]) => this.memoryCache.delete(key));
    }
  }

  /**
   * 清理过期缓存
   */
  async cleanup() {
    // 清理内存缓存
    this.cleanupMemoryCache();

    // Redis会自动清理过期键，这里不需要手动清理
    console.log('✅ 缓存清理完成');
  }

  /**
   * 获取缓存统计信息
   */
  getStats() {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    const hitRate = total > 0 ? (this.cacheStats.hits / total * 100).toFixed(2) : 0;

    return {
      ...this.cacheStats,
      hitRate: `${hitRate}%`,
      memoryCacheSize: this.memoryCache.size,
      redisConnected: this.redis.isConnected,
      config: this.config
    };
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.cacheStats = {
      hits: 0,
      misses: 0,
      errors: 0
    };
  }

  /**
   * 关闭缓存系统
   */
  async close() {
    if (this.redis.isConnected) {
      await this.redis.disconnect();
    }
    this.memoryCache.clear();
    console.log('✅ 缓存系统已关闭');
  }

  /**
   * 缓存装饰器 - 用于方法缓存
   */
  cache(type, ttl = null) {
    return (target, propertyName, descriptor) => {
      const method = descriptor.value;

      descriptor.value = async function (...args) {
        const cacheKey = `${propertyName}:${JSON.stringify(args)}`;

        // 尝试从缓存获取
        const cached = await this.get(type, cacheKey);
        if (cached !== null) {
          return cached;
        }

        // 执行原方法
        const result = await method.apply(this, args);

        // 缓存结果
        await this.set(type, cacheKey, result, ttl);

        return result;
      };
    };
  }
}

module.exports = CacheManager;
