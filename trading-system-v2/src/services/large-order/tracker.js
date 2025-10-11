/**
 * OrderTracker - 大额挂单追踪器
 * 负责跟踪挂单的生命周期：创建、持续、撤销、成交
 * 
 * @module OrderTracker
 */

const logger = require('../../utils/logger');

/**
 * 追踪挂单条目
 * @typedef {Object} TrackedEntry
 * @property {string} key - 唯一标识 (side@price)
 * @property {string} symbol - 交易对
 * @property {'bid'|'ask'} side - 买卖方向
 * @property {number} price - 价格
 * @property {number} qty - 数量
 * @property {number} valueUSD - USD价值
 * @property {number} createdAt - 创建时间(ms)
 * @property {number} lastSeenAt - 最后发现时间(ms)
 * @property {number|null} canceledAt - 撤销时间(ms)
 * @property {number} seenCount - 连续发现次数
 * @property {number} filledVolumeObserved - 观察到的成交量
 * @property {number} impactRatio - 影响力比率
 * @property {string} classification - 分类
 * @property {boolean} isPersistent - 是否持续
 * @property {boolean} isSpoof - 是否为诱导单
 * @property {boolean} wasConsumed - 是否被吃掉
 */

class OrderTracker {
  /**
   * @param {Object} config - 配置参数
   * @param {number} config.largeUSDThreshold - 大额阈值(USD)
   * @param {number} config.persistSnapshots - 持续判定次数
   * @param {number} config.spoofWindowMs - Spoof判定时间窗口(ms)
   * @param {number} config.maxTrackedEntries - 最大追踪数量
   */
  constructor(config) {
    this.config = config;
    this.tracked = new Map(); // key -> TrackedEntry
    
    logger.info('[OrderTracker] 初始化完成', {
      largeUSDThreshold: config.largeUSDThreshold,
      persistSnapshots: config.persistSnapshots,
      spoofWindowMs: config.spoofWindowMs
    });
  }

  /**
   * 更新追踪状态
   * @param {string} symbol - 交易对
   * @param {Array} depthSnapshot - 深度快照 [{price, qty, side}]
   * @param {number} currentPrice - 当前价格
   * @param {number} timestamp - 时间戳(ms)
   * @returns {Object} 更新结果
   */
  update(symbol, depthSnapshot, currentPrice, timestamp) {
    try {
      const largeOrders = this._filterLargeOrders(depthSnapshot, currentPrice);
      const currentKeys = new Set();
      const newEntries = [];
      const updatedEntries = [];
      const canceledEntries = [];

      // 处理当前存在的大额挂单
      for (const order of largeOrders) {
        const key = `${order.side}@${order.price}`;
        currentKeys.add(key);

        if (this.tracked.has(key)) {
          // 更新已存在的挂单
          const entry = this.tracked.get(key);
          entry.qty = order.qty;
          entry.valueUSD = order.valueUSD;
          entry.lastSeenAt = timestamp;
          entry.seenCount += 1;
          
          // 判断是否持续
          if (entry.seenCount >= this.config.persistSnapshots) {
            entry.isPersistent = true;
          }
          
          updatedEntries.push(entry);
        } else {
          // 新发现的大额挂单
          const entry = {
            key,
            symbol,
            side: order.side,
            price: order.price,
            qty: order.qty,
            valueUSD: order.valueUSD,
            createdAt: timestamp,
            lastSeenAt: timestamp,
            canceledAt: null,
            seenCount: 1,
            filledVolumeObserved: 0,
            impactRatio: 0,
            classification: 'UNKNOWN',
            isPersistent: false,
            isSpoof: false,
            wasConsumed: false
          };
          
          this.tracked.set(key, entry);
          newEntries.push(entry);
        }
      }

      // 检测消失的挂单（可能被撤销或成交）
      for (const [key, entry] of this.tracked.entries()) {
        if (entry.symbol !== symbol) continue;
        if (entry.canceledAt !== null) continue; // 已标记为撤销
        if (currentKeys.has(key)) continue; // 仍然存在

        // 标记为撤销
        entry.canceledAt = timestamp;
        
        // 检测是否为 Spoof（快速撤销）
        const lifespan = timestamp - entry.createdAt;
        if (lifespan < this.config.spoofWindowMs && !entry.isPersistent) {
          entry.isSpoof = true;
          entry.classification = 'SPOOF';
        }
        
        canceledEntries.push(entry);
      }

      // 清理过期记录（已撤销且超过1小时）
      this._cleanupOldEntries(timestamp);

      return {
        newEntries,
        updatedEntries,
        canceledEntries,
        totalTracked: this.tracked.size
      };
    } catch (error) {
      logger.error('[OrderTracker] 更新失败', { symbol, error: error.message });
      throw error;
    }
  }

  /**
   * 过滤大额挂单
   * @private
   */
  _filterLargeOrders(depthSnapshot, currentPrice) {
    return depthSnapshot
      .map(order => ({
        ...order,
        valueUSD: order.qty * currentPrice
      }))
      .filter(order => order.valueUSD >= this.config.largeUSDThreshold);
  }

  /**
   * 清理过期记录
   * @private
   */
  _cleanupOldEntries(timestamp) {
    const ONE_HOUR = 3600000;
    const keysToDelete = [];

    for (const [key, entry] of this.tracked.entries()) {
      if (entry.canceledAt && (timestamp - entry.canceledAt) > ONE_HOUR) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.tracked.delete(key));
    
    // 限制最大追踪数量
    if (this.tracked.size > this.config.maxTrackedEntries) {
      const entries = Array.from(this.tracked.entries())
        .sort((a, b) => b[1].lastSeenAt - a[1].lastSeenAt)
        .slice(this.config.maxTrackedEntries);
      
      entries.forEach(([key]) => this.tracked.delete(key));
    }
  }

  /**
   * 标记成交消耗
   * @param {string} symbol - 交易对
   * @param {number} price - 成交价格
   * @param {number} qty - 成交量
   * @param {'bid'|'ask'} side - 吃单方向
   */
  markConsumed(symbol, price, qty, side) {
    const tolerance = this.config.priceTolerance || 0.0005;
    
    for (const [key, entry] of this.tracked.entries()) {
      if (entry.symbol !== symbol) continue;
      if (entry.canceledAt !== null) continue;
      if (entry.side !== side) continue;
      
      // 价格匹配（容差范围内）
      const priceDiff = Math.abs(entry.price - price) / entry.price;
      if (priceDiff <= tolerance) {
        entry.filledVolumeObserved += qty;
        entry.wasConsumed = true;
      }
    }
  }

  /**
   * 获取当前追踪的挂单
   * @param {string} symbol - 交易对
   * @returns {Array<TrackedEntry>}
   */
  getTrackedEntries(symbol) {
    return Array.from(this.tracked.values())
      .filter(entry => entry.symbol === symbol && entry.canceledAt === null)
      .sort((a, b) => b.valueUSD - a.valueUSD);
  }

  /**
   * 获取所有追踪的挂单（包括已撤销）
   * @param {string} symbol - 交易对
   * @returns {Array<TrackedEntry>}
   */
  getAllTrackedEntries(symbol) {
    return Array.from(this.tracked.values())
      .filter(entry => entry.symbol === symbol)
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  }

  /**
   * 获取状态统计
   * @param {string} symbol - 交易对
   */
  getStats(symbol) {
    const entries = Array.from(this.tracked.values())
      .filter(entry => entry.symbol === symbol);
    
    return {
      total: entries.length,
      active: entries.filter(e => e.canceledAt === null).length,
      persistent: entries.filter(e => e.isPersistent).length,
      spoof: entries.filter(e => e.isSpoof).length,
      consumed: entries.filter(e => e.wasConsumed).length
    };
  }

  /**
   * 清空特定交易对的追踪数据
   * @param {string} symbol - 交易对
   */
  clear(symbol) {
    const keysToDelete = [];
    for (const [key, entry] of this.tracked.entries()) {
      if (entry.symbol === symbol) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.tracked.delete(key));
    
    logger.info('[OrderTracker] 清空追踪数据', { symbol, count: keysToDelete.length });
  }
}

module.exports = OrderTracker;

