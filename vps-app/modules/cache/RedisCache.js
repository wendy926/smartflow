// modules/cache/RedisCache.js
// Redis缓存系统实现

const redis = require('redis');

class RedisCache {
  constructor(options = {}) {
    this.host = options.host || 'localhost';
    this.port = options.port || 6379;
    this.password = options.password || null;
    this.db = options.db || 0;
    this.client = null;
    this.isConnected = false;

    // 缓存配置
    this.defaultTTL = options.defaultTTL || 300; // 5分钟默认TTL
    this.keyPrefix = options.keyPrefix || 'smartflow:';
  }

  /**
   * 连接Redis服务器
   */
  async connect() {
    try {
      this.client = redis.createClient({
        host: this.host,
        port: this.port,
        password: this.password,
        db: this.db,
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            console.error('Redis连接被拒绝');
            return new Error('Redis连接被拒绝');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            console.error('Redis重试时间超时');
            return new Error('Redis重试时间超时');
          }
          if (options.attempt > 10) {
            console.error('Redis重试次数超限');
            return undefined;
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

      this.client.on('error', (err) => {
        console.error('Redis客户端错误:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('✅ Redis连接成功');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        console.log('✅ Redis客户端就绪');
        this.isConnected = true;
      });

      this.client.on('end', () => {
        console.log('Redis连接关闭');
        this.isConnected = false;
      });

      await this.client.connect();
      return true;
    } catch (error) {
      console.error('❌ Redis连接失败:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * 断开Redis连接
   */
  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  /**
   * 生成缓存键
   */
  generateKey(key) {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * 设置缓存
   */
  async set(key, value, ttl = null) {
    if (!this.isConnected) {
      console.warn('Redis未连接，跳过缓存设置');
      return false;
    }

    try {
      const cacheKey = this.generateKey(key);
      const serializedValue = JSON.stringify(value);
      const expireTime = ttl || this.defaultTTL;

      await this.client.setEx(cacheKey, expireTime, serializedValue);
      return true;
    } catch (error) {
      console.error('Redis设置缓存失败:', error);
      return false;
    }
  }

  /**
   * 获取缓存
   */
  async get(key) {
    if (!this.isConnected) {
      console.warn('Redis未连接，跳过缓存获取');
      return null;
    }

    try {
      const cacheKey = this.generateKey(key);
      const value = await this.client.get(cacheKey);

      if (value === null) {
        return null;
      }

      return JSON.parse(value);
    } catch (error) {
      console.error('Redis获取缓存失败:', error);
      return null;
    }
  }

  /**
   * 删除缓存
   */
  async del(key) {
    if (!this.isConnected) {
      console.warn('Redis未连接，跳过缓存删除');
      return false;
    }

    try {
      const cacheKey = this.generateKey(key);
      await this.client.del(cacheKey);
      return true;
    } catch (error) {
      console.error('Redis删除缓存失败:', error);
      return false;
    }
  }

  /**
   * 检查缓存是否存在
   */
  async exists(key) {
    if (!this.isConnected) {
      return false;
    }

    try {
      const cacheKey = this.generateKey(key);
      const result = await this.client.exists(cacheKey);
      return result === 1;
    } catch (error) {
      console.error('Redis检查缓存存在失败:', error);
      return false;
    }
  }

  /**
   * 设置缓存过期时间
   */
  async expire(key, ttl) {
    if (!this.isConnected) {
      return false;
    }

    try {
      const cacheKey = this.generateKey(key);
      await this.client.expire(cacheKey, ttl);
      return true;
    } catch (error) {
      console.error('Redis设置过期时间失败:', error);
      return false;
    }
  }

  /**
   * 获取缓存剩余时间
   */
  async ttl(key) {
    if (!this.isConnected) {
      return -1;
    }

    try {
      const cacheKey = this.generateKey(key);
      return await this.client.ttl(cacheKey);
    } catch (error) {
      console.error('Redis获取TTL失败:', error);
      return -1;
    }
  }

  /**
   * 清空所有缓存
   */
  async flushAll() {
    if (!this.isConnected) {
      return false;
    }

    try {
      await this.client.flushAll();
      return true;
    } catch (error) {
      console.error('Redis清空缓存失败:', error);
      return false;
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getStats() {
    if (!this.isConnected) {
      return null;
    }

    try {
      const info = await this.client.info('memory');
      const keyspace = await this.client.info('keyspace');

      return {
        connected: this.isConnected,
        memory: info,
        keyspace: keyspace,
        keyCount: await this.client.dbSize()
      };
    } catch (error) {
      console.error('Redis获取统计信息失败:', error);
      return null;
    }
  }

  /**
   * 批量操作
   */
  async mget(keys) {
    if (!this.isConnected) {
      return [];
    }

    try {
      const cacheKeys = keys.map(key => this.generateKey(key));
      const values = await this.client.mGet(cacheKeys);

      return values.map(value => {
        if (value === null) return null;
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      });
    } catch (error) {
      console.error('Redis批量获取失败:', error);
      return [];
    }
  }

  /**
   * 批量设置
   */
  async mset(keyValuePairs, ttl = null) {
    if (!this.isConnected) {
      return false;
    }

    try {
      const pairs = [];
      for (const [key, value] of Object.entries(keyValuePairs)) {
        const cacheKey = this.generateKey(key);
        const serializedValue = JSON.stringify(value);
        pairs.push(cacheKey, serializedValue);
      }

      await this.client.mSet(pairs);

      // 设置过期时间
      if (ttl) {
        const expireTime = ttl || this.defaultTTL;
        for (const key of Object.keys(keyValuePairs)) {
          await this.expire(key, expireTime);
        }
      }

      return true;
    } catch (error) {
      console.error('Redis批量设置失败:', error);
      return false;
    }
  }
}

module.exports = RedisCache;
