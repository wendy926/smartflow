/**
 * 数据同步服务
 * 负责SG/CN机房之间的数据同步
 */

const { MessageType, MessagePriority, Region } = require('./CrossRegionMessagingService');
const logger = require('../utils/logger');

/**
 * 数据同步服务
 */
class DataSyncService {
  constructor(messagingService, adapters) {
    this.messagingService = messagingService;
    this.adapters = adapters; // Map<MarketType, IExchangeAdapter>
    this.syncInterval = 60000; // 1分钟同步一次
    this.isRunning = false;
    this.syncTasks = new Map();
    
    // 统计信息
    this.stats = {
      syncRequests: 0,
      syncSuccess: 0,
      syncFailed: 0,
      dataTransferred: 0,
      lastSyncTime: null
    };
  }

  /**
   * 启动数据同步服务
   */
  async start() {
    try {
      this.isRunning = true;
      
      // 启动定时同步
      this.startPeriodicSync();
      
      // 启动实时同步监听
      this.startRealtimeSync();
      
      logger.info('[DataSyncService] Data sync service started');

    } catch (error) {
      logger.error('[DataSyncService] Failed to start data sync service:', error);
      throw error;
    }
  }

  /**
   * 停止数据同步服务
   */
  async stop() {
    this.isRunning = false;
    logger.info('[DataSyncService] Data sync service stopped');
  }

  /**
   * 启动定时同步
   */
  startPeriodicSync() {
    setInterval(async () => {
      if (!this.isRunning) return;

      try {
        // 同步关键市场数据
        await this.syncCriticalData();
        
        // 清理过期数据
        await this.cleanupExpiredData();

      } catch (error) {
        logger.error('[DataSyncService] Periodic sync error:', error);
      }
    }, this.syncInterval);
  }

  /**
   * 启动实时同步监听
   */
  startRealtimeSync() {
    // 监听实时数据变化
    this.adapters.forEach((adapter, marketType) => {
      if (adapter.on) {
        adapter.on('dataUpdate', (data) => {
          this.handleRealtimeDataUpdate(marketType, data);
        });
      }
    });
  }

  /**
   * 同步关键数据
   */
  async syncCriticalData() {
    const syncTasks = [];

    // 根据区域同步不同数据
    if (this.messagingService.region === Region.SG) {
      // SG机房同步加密货币和美股数据到CN机房
      syncTasks.push(
        this.syncCryptoData(),
        this.syncUSStockData()
      );
    } else if (this.messagingService.region === Region.CN) {
      // CN机房同步A股数据到SG机房
      syncTasks.push(
        this.syncChinaStockData()
      );
    }

    await Promise.allSettled(syncTasks);
  }

  /**
   * 同步加密货币数据
   */
  async syncCryptoData() {
    try {
      const cryptoAdapter = this.adapters.get('crypto');
      if (!cryptoAdapter) return;

      const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'];
      const timeframes = ['1h', '4h', '1d'];

      for (const symbol of symbols) {
        for (const timeframe of timeframes) {
          const data = await cryptoAdapter.getKlines(symbol, timeframe, 24);
          
          await this.sendDataToRegion(Region.CN, {
            marketType: 'crypto',
            symbol: symbol,
            timeframe: timeframe,
            data: data,
            timestamp: new Date()
          });
        }

        // 同步市场指标
        const metrics = await cryptoAdapter.getMarketMetrics(symbol);
        await this.sendDataToRegion(Region.CN, {
          marketType: 'crypto',
          symbol: symbol,
          metrics: metrics,
          timestamp: new Date()
        });
      }

      logger.debug('[DataSyncService] Crypto data synced to CN region');

    } catch (error) {
      logger.error('[DataSyncService] Failed to sync crypto data:', error);
    }
  }

  /**
   * 同步美股数据
   */
  async syncUSStockData() {
    try {
      const usStockAdapter = this.adapters.get('us_stock');
      if (!usStockAdapter) return;

      const symbols = ['AAPL', 'MSFT', 'GOOGL'];
      const timeframes = ['1h', '4h', '1d'];

      for (const symbol of symbols) {
        for (const timeframe of timeframes) {
          const data = await usStockAdapter.getKlines(symbol, timeframe, 24);
          
          await this.sendDataToRegion(Region.CN, {
            marketType: 'us_stock',
            symbol: symbol,
            timeframe: timeframe,
            data: data,
            timestamp: new Date()
          });
        }

        // 同步市场指标
        const metrics = await usStockAdapter.getMarketMetrics(symbol);
        await this.sendDataToRegion(Region.CN, {
          marketType: 'us_stock',
          symbol: symbol,
          metrics: metrics,
          timestamp: new Date()
        });
      }

      logger.debug('[DataSyncService] US stock data synced to CN region');

    } catch (error) {
      logger.error('[DataSyncService] Failed to sync US stock data:', error);
    }
  }

  /**
   * 同步A股数据
   */
  async syncChinaStockData() {
    try {
      const cnStockAdapter = this.adapters.get('cn_stock');
      if (!cnStockAdapter) return;

      const symbols = ['000001.SZ', '600000.SH', '000002.SZ'];
      const timeframes = ['1h', '4h', '1d'];

      for (const symbol of symbols) {
        for (const timeframe of timeframes) {
          const data = await cnStockAdapter.getKlines(symbol, timeframe, 24);
          
          await this.sendDataToRegion(Region.SG, {
            marketType: 'cn_stock',
            symbol: symbol,
            timeframe: timeframe,
            data: data,
            timestamp: new Date()
          });
        }

        // 同步市场指标
        const metrics = await cnStockAdapter.getMarketMetrics(symbol);
        await this.sendDataToRegion(Region.SG, {
          marketType: 'cn_stock',
          symbol: symbol,
          metrics: metrics,
          timestamp: new Date()
        });
      }

      logger.debug('[DataSyncService] China stock data synced to SG region');

    } catch (error) {
      logger.error('[DataSyncService] Failed to sync China stock data:', error);
    }
  }

  /**
   * 发送数据到指定区域
   */
  async sendDataToRegion(targetRegion, data) {
    try {
      const message = {
        type: MessageType.DATA_SYNC,
        data: data,
        priority: MessagePriority.NORMAL,
        targetRegion: targetRegion,
        ttl: 3600
      };

      await this.messagingService.sendMessage(message);
      
      this.stats.dataTransferred += JSON.stringify(data).length;

    } catch (error) {
      logger.error('[DataSyncService] Failed to send data to region:', error);
    }
  }

  /**
   * 处理实时数据更新
   */
  async handleRealtimeDataUpdate(marketType, data) {
    try {
      // 根据市场类型确定目标区域
      let targetRegion;
      if (marketType === 'crypto' || marketType === 'us_stock') {
        targetRegion = Region.CN;
      } else if (marketType === 'cn_stock') {
        targetRegion = Region.SG;
      } else {
        return;
      }

      await this.sendDataToRegion(targetRegion, {
        marketType: marketType,
        realtimeUpdate: true,
        data: data,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('[DataSyncService] Failed to handle realtime data update:', error);
    }
  }

  /**
   * 同步指定数据
   */
  async syncData(marketType, symbol, timeframe, from, to) {
    try {
      this.stats.syncRequests++;
      
      const adapter = this.adapters.get(marketType);
      if (!adapter) {
        throw new Error(`No adapter for market type: ${marketType}`);
      }

      const data = await adapter.getKlines(symbol, timeframe);
      
      // 过滤时间范围
      const filteredData = data.filter(k => {
        const timestamp = new Date(k.timestamp);
        return timestamp >= new Date(from) && timestamp <= new Date(to);
      });

      this.stats.syncSuccess++;
      this.stats.lastSyncTime = new Date();
      
      return filteredData;

    } catch (error) {
      this.stats.syncFailed++;
      logger.error('[DataSyncService] Failed to sync data:', error);
      throw error;
    }
  }

  /**
   * 清理过期数据
   */
  async cleanupExpiredData() {
    try {
      // 清理7天前的同步任务
      const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000);
      
      for (const [taskId, task] of this.syncTasks) {
        if (task.timestamp < cutoffTime) {
          this.syncTasks.delete(taskId);
        }
      }

      logger.debug('[DataSyncService] Expired sync tasks cleaned up');

    } catch (error) {
      logger.error('[DataSyncService] Failed to cleanup expired data:', error);
    }
  }

  /**
   * 获取同步统计信息
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      syncInterval: this.syncInterval,
      activeSyncTasks: this.syncTasks.size
    };
  }

  /**
   * 手动触发数据同步
   */
  async manualSync(marketType, symbol, timeframe, limit = 100) {
    try {
      const adapter = this.adapters.get(marketType);
      if (!adapter) {
        throw new Error(`No adapter for market type: ${marketType}`);
      }

      const data = await adapter.getKlines(symbol, timeframe, limit);
      
      // 确定目标区域
      let targetRegion;
      if (marketType === 'crypto' || marketType === 'us_stock') {
        targetRegion = Region.CN;
      } else if (marketType === 'cn_stock') {
        targetRegion = Region.SG;
      } else {
        throw new Error(`Unknown market type: ${marketType}`);
      }

      await this.sendDataToRegion(targetRegion, {
        marketType: marketType,
        symbol: symbol,
        timeframe: timeframe,
        data: data,
        timestamp: new Date(),
        manualSync: true
      });

      logger.info(`[DataSyncService] Manual sync completed: ${marketType}/${symbol}/${timeframe}`);

    } catch (error) {
      logger.error('[DataSyncService] Manual sync failed:', error);
      throw error;
    }
  }

  /**
   * 获取数据同步状态
   */
  async getSyncStatus() {
    try {
      const status = {
        region: this.messagingService.region,
        isRunning: this.isRunning,
        stats: this.stats,
        adapters: Array.from(this.adapters.keys()),
        lastSyncTime: this.stats.lastSyncTime
      };

      return status;

    } catch (error) {
      logger.error('[DataSyncService] Failed to get sync status:', error);
      throw error;
    }
  }
}

/**
 * 数据缓存服务
 * 缓存跨机房同步的数据
 */
class DataCacheService {
  constructor(redis) {
    this.redis = redis;
    this.cachePrefix = 'cross_region_data:';
    this.defaultTTL = 3600; // 1小时
  }

  /**
   * 缓存数据
   */
  async cacheData(key, data, ttl = this.defaultTTL) {
    try {
      const cacheKey = `${this.cachePrefix}${key}`;
      await this.redis.setex(cacheKey, ttl, JSON.stringify(data));
      
      logger.debug(`[DataCacheService] Data cached: ${key}`);

    } catch (error) {
      logger.error('[DataCacheService] Failed to cache data:', error);
    }
  }

  /**
   * 获取缓存数据
   */
  async getCachedData(key) {
    try {
      const cacheKey = `${this.cachePrefix}${key}`;
      const data = await this.redis.get(cacheKey);
      
      if (data) {
        return JSON.parse(data);
      }
      
      return null;

    } catch (error) {
      logger.error('[DataCacheService] Failed to get cached data:', error);
      return null;
    }
  }

  /**
   * 删除缓存数据
   */
  async deleteCachedData(key) {
    try {
      const cacheKey = `${this.cachePrefix}${key}`;
      await this.redis.del(cacheKey);
      
      logger.debug(`[DataCacheService] Data deleted: ${key}`);

    } catch (error) {
      logger.error('[DataCacheService] Failed to delete cached data:', error);
    }
  }

  /**
   * 清理过期缓存
   */
  async cleanupExpiredCache() {
    try {
      const pattern = `${this.cachePrefix}*`;
      const keys = await this.redis.keys(pattern);
      
      for (const key of keys) {
        const ttl = await this.redis.ttl(key);
        if (ttl === -1) {
          // 没有过期时间的key，设置默认TTL
          await this.redis.expire(key, this.defaultTTL);
        }
      }

      logger.info(`[DataCacheService] Expired cache cleaned up: ${keys.length} keys`);

    } catch (error) {
      logger.error('[DataCacheService] Failed to cleanup expired cache:', error);
    }
  }
}

module.exports = {
  DataSyncService,
  DataCacheService
};
