// DataChangeDetector.js - 数据变更检测器
// 检测数据是否真正发生变化，并触发缓存更新

class DataChangeDetector {
  constructor(database, cacheManager) {
    this.db = database;
    this.cacheManager = cacheManager;
    this.dataHashes = new Map(); // 存储数据哈希值
    this.changeListeners = new Set(); // 变更监听器
  }

  /**
   * 计算数据哈希值
   */
  calculateDataHash(data) {
    const dataString = JSON.stringify(data, Object.keys(data).sort());
    return this.simpleHash(dataString);
  }

  /**
   * 简单哈希函数
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return hash.toString();
  }

  /**
   * 检测数据是否发生变化
   */
  async detectDataChange(symbol, dataType, newData) {
    try {
      const key = `${symbol}_${dataType}`;
      const newHash = this.calculateDataHash(newData);
      const oldHash = this.dataHashes.get(key);

      if (oldHash !== newHash) {
        // 数据发生变化
        this.dataHashes.set(key, newHash);
        console.log(`🔄 检测到数据变化 [${symbol}][${dataType}]: ${oldHash} -> ${newHash}`);
        
        // 触发变更事件
        await this.triggerDataChange(symbol, dataType, newData);
        return true;
      } else {
        console.log(`📊 数据无变化 [${symbol}][${dataType}]: ${newHash}`);
        return false;
      }
    } catch (error) {
      console.error(`数据变更检测失败 [${symbol}][${dataType}]:`, error);
      return false;
    }
  }

  /**
   * 触发数据变更事件
   */
  async triggerDataChange(symbol, dataType, newData) {
    try {
      // 更新缓存
      await this.updateCache(symbol, dataType, newData);
      
      // 通知所有监听器
      for (const listener of this.changeListeners) {
        try {
          await listener(symbol, dataType, newData);
        } catch (error) {
          console.error('变更监听器执行失败:', error);
        }
      }
    } catch (error) {
      console.error('触发数据变更失败:', error);
    }
  }

  /**
   * 更新缓存
   */
  async updateCache(symbol, dataType, newData) {
    try {
      if (!this.cacheManager) {
        console.warn('缓存管理器未初始化，跳过缓存更新');
        return;
      }

      // 更新相关缓存
      const cacheKeys = [
        `strategy_analysis:${symbol}`,
        `signals:${symbol}`,
        `trend:${symbol}`,
        `execution:${symbol}`
      ];

      for (const cacheKey of cacheKeys) {
        try {
          await this.cacheManager.del('strategy', cacheKey);
          console.log(`🗑️ 清除缓存: ${cacheKey}`);
        } catch (error) {
          console.warn(`清除缓存失败 ${cacheKey}:`, error.message);
        }
      }

      // 清除全局信号缓存
      try {
        await this.cacheManager.del('api', 'signals');
        await this.cacheManager.del('api', 'stats');
        await this.cacheManager.del('api', 'update-times');
        console.log('🗑️ 清除全局API缓存');
      } catch (error) {
        console.warn('清除全局API缓存失败:', error.message);
      }

      console.log(`✅ 缓存更新完成 [${symbol}][${dataType}]`);
    } catch (error) {
      console.error('更新缓存失败:', error);
    }
  }

  /**
   * 添加变更监听器
   */
  addChangeListener(listener) {
    this.changeListeners.add(listener);
  }

  /**
   * 移除变更监听器
   */
  removeChangeListener(listener) {
    this.changeListeners.delete(listener);
  }

  /**
   * 获取数据哈希统计
   */
  getHashStats() {
    return {
      totalKeys: this.dataHashes.size,
      keys: Array.from(this.dataHashes.keys()),
      listeners: this.changeListeners.size
    };
  }

  /**
   * 清理过期的哈希记录
   */
  cleanup() {
    // 清理超过24小时的记录
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24小时
    
    // 这里可以添加时间戳记录来清理过期数据
    // 目前简化处理，只清理数量限制
    if (this.dataHashes.size > 1000) {
      const keys = Array.from(this.dataHashes.keys());
      const toDelete = keys.slice(0, keys.length - 500); // 保留最新的500条
      toDelete.forEach(key => this.dataHashes.delete(key));
      console.log(`🧹 清理了 ${toDelete.length} 条过期哈希记录`);
    }
  }
}

module.exports = DataChangeDetector;
