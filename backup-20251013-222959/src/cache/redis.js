const Redis = require('ioredis');
const config = require('../config');
const logger = require('../utils/logger');

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.client = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.db,
        maxMemoryPolicy: 'allkeys-lru',
        lazyConnect: true,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        connectTimeout: 10000,
        commandTimeout: 5000
      });

      this.client.on('connect', () => {
        logger.info('Redis connected');
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        logger.error('Redis error:', err);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        logger.warn('Redis connection closed');
        this.isConnected = false;
      });

      await this.client.connect();
      return this.client;
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }

  getClient() {
    return this.client;
  }

  isReady() {
    return this.isConnected && this.client && this.client.status === 'ready';
  }

  // 代理Redis方法
  async get(key) {
    if (!this.isReady()) {
      await this.connect();
    }
    return this.client.get(key);
  }

  async set(key, value, ttl = null) {
    if (!this.isReady()) {
      await this.connect();
    }
    // 确保value是字符串
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttl) {
      return this.client.setex(key, Math.floor(ttl), stringValue);
    }
    return this.client.set(key, stringValue);
  }

  async del(key) {
    if (!this.isReady()) {
      await this.connect();
    }
    return this.client.del(key);
  }

  async exists(key) {
    if (!this.isReady()) {
      await this.connect();
    }
    return this.client.exists(key);
  }
}

module.exports = new RedisClient();