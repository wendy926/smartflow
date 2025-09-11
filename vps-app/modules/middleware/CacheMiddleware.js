// modules/middleware/CacheMiddleware.js
// 缓存中间件

const CacheManager = require('../cache/CacheManager');

class CacheMiddleware {
  constructor(cacheManager) {
    this.cache = cacheManager;
  }

  /**
   * 缓存中间件工厂
   */
  static create(cacheManager) {
    return new CacheMiddleware(cacheManager);
  }

  /**
   * 缓存GET请求
   */
  cacheGet(type, ttl = null) {
    return async (req, res, next) => {
      const originalSend = res.send;
      const cacheKey = this.generateCacheKey(req);

      try {
        // 尝试从缓存获取
        const cached = await this.cache.get(type, cacheKey);
        if (cached !== null) {
          res.set('X-Cache', 'HIT');
          return res.json(cached);
        }

        // 缓存未命中，继续处理请求
        res.set('X-Cache', 'MISS');

        // 拦截响应
        res.send = function (data) {
          // 缓存响应数据
          if (res.statusCode === 200) {
            this.cache.set(type, cacheKey, JSON.parse(data), ttl)
              .catch(err => console.warn('缓存设置失败:', err));
          }

          // 发送原始响应
          originalSend.call(this, data);
        }.bind(this);

        next();
      } catch (error) {
        console.error('缓存中间件错误:', error);
        next();
      }
    };
  }

  /**
   * 缓存POST请求（用于幂等操作）
   */
  cachePost(type, ttl = null) {
    return async (req, res, next) => {
      const originalSend = res.send;
      const cacheKey = this.generateCacheKey(req);

      try {
        // 对于POST请求，先检查缓存
        const cached = await this.cache.get(type, cacheKey);
        if (cached !== null) {
          res.set('X-Cache', 'HIT');
          return res.json(cached);
        }

        res.set('X-Cache', 'MISS');

        // 拦截响应
        res.send = function (data) {
          if (res.statusCode === 200) {
            this.cache.set(type, cacheKey, JSON.parse(data), ttl)
              .catch(err => console.warn('缓存设置失败:', err));
          }

          originalSend.call(this, data);
        }.bind(this);

        next();
      } catch (error) {
        console.error('缓存中间件错误:', error);
        next();
      }
    };
  }

  /**
   * 生成缓存键
   */
  generateCacheKey(req) {
    const { method, url, query, body } = req;
    const keyData = {
      method,
      url,
      query,
      body: method === 'POST' ? body : undefined
    };

    return Buffer.from(JSON.stringify(keyData)).toString('base64');
  }

  /**
   * 清除相关缓存
   */
  async clearRelatedCache(patterns) {
    const clearPromises = patterns.map(pattern =>
      this.cache.del(pattern.type, pattern.identifier)
    );

    await Promise.all(clearPromises);
  }

  /**
   * 预热缓存
   */
  async warmupCache(warmupData) {
    const warmupPromises = warmupData.map(({ type, identifier, data, ttl }) =>
      this.cache.set(type, identifier, data, ttl)
    );

    await Promise.all(warmupPromises);
    console.log(`✅ 缓存预热完成，预热了 ${warmupData.length} 个缓存项`);
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return this.cache.getStats();
  }
}

module.exports = CacheMiddleware;
