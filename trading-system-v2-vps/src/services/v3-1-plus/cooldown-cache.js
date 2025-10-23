/**
 * V3.1-Plus 优化 - 冷却缓存管理模块
 * 
 * 功能：
 * - 内存缓存交易冷却状态
 * - 从数据库恢复状态（重启后）
 * - 检查入场许可（冷却时间、每日次数）
 * - 更新入场记录
 * 
 * 设计原则：
 * - 单一职责：仅管理冷却状态
 * - 高性能：内存缓存，避免频繁DB查询
 * - 数据一致性：重启后从DB恢复
 * 
 * @module v3-1-plus/cooldown-cache
 */

const logger = require('../../utils/logger');

/**
 * 冷却缓存管理器
 * 使用Map存储每个交易对的冷却状态
 */
class CooldownCache {
  constructor() {
    // 缓存结构：symbol -> {lastEntry: timestamp, dailyCount: number, lastResetDate: string}
    this.cache = new Map();
    this.initialized = false;
    logger.info('[CooldownCache] 初始化冷却缓存管理器');
  }

  /**
   * 从数据库恢复冷却状态（服务启动时调用）
   * @param {Object} database - 数据库实例
   * @returns {Promise<void>}
   */
  async restore(database) {
    try {
      logger.info('[CooldownCache] 开始从数据库恢复冷却状态...');

      const [rows] = await database.pool.query(`
        SELECT 
          s.symbol,
          MAX(t.entry_time) as last_entry,
          COUNT(*) as daily_count
        FROM simulation_trades t
        JOIN symbols s ON t.symbol_id = s.id
        WHERE t.strategy_name = 'V3'
          AND DATE(t.entry_time) = CURDATE()
        GROUP BY s.symbol
      `);

      // 加载到缓存
      for (const row of rows) {
        const lastEntryTime = new Date(row.last_entry).getTime();
        this.cache.set(row.symbol, {
          lastEntry: lastEntryTime,
          dailyCount: row.daily_count,
          lastResetDate: new Date().toDateString()
        });
      }

      this.initialized = true;
      logger.info(`[CooldownCache] ✅ 恢复完成，加载${rows.length}个交易对的冷却状态`);
    } catch (error) {
      logger.error('[CooldownCache] ❌ 恢复失败:', error);
      // 即使失败也标记为已初始化，使用空缓存继续运行
      this.initialized = true;
    }
  }

  /**
   * 检查是否可以入场
   * @param {string} symbol - 交易对符号
   * @param {number} cooldownMinutes - 冷却时间（分钟）
   * @param {number} maxDailyTrades - 每日最大交易次数
   * @returns {Object} {allowed: boolean, reason: string, details: Object}
   */
  canEnter(symbol, cooldownMinutes, maxDailyTrades) {
    try {
      const info = this.cache.get(symbol);
      const now = Date.now();
      const today = new Date().toDateString();

      // 如果没有记录，允许入场（首次交易）
      if (!info) {
        return {
          allowed: true,
          reason: 'first_entry',
          details: {
            symbol,
            dailyCount: 0,
            minutesSinceLast: null
          }
        };
      }

      // 检查日期是否需要重置
      if (info.lastResetDate !== today) {
        // 日期已变更，重置每日计数
        info.dailyCount = 0;
        info.lastResetDate = today;
        this.cache.set(symbol, info);
        
        return {
          allowed: true,
          reason: 'daily_reset',
          details: {
            symbol,
            dailyCount: 0,
            minutesSinceLast: Math.round((now - info.lastEntry) / 1000 / 60)
          }
        };
      }

      // 计算距离上次入场的时间
      const minutesSinceLast = (now - info.lastEntry) / 1000 / 60;

      // 检查冷却时间
      if (minutesSinceLast < cooldownMinutes) {
        const minutesRemaining = Math.ceil(cooldownMinutes - minutesSinceLast);
        return {
          allowed: false,
          reason: 'cooldown_active',
          details: {
            symbol,
            dailyCount: info.dailyCount,
            minutesSinceLast: Math.round(minutesSinceLast),
            minutesRemaining,
            nextAllowedTime: new Date(info.lastEntry + cooldownMinutes * 60 * 1000)
          }
        };
      }

      // 检查每日交易次数限制
      if (info.dailyCount >= maxDailyTrades) {
        return {
          allowed: false,
          reason: 'daily_limit_reached',
          details: {
            symbol,
            dailyCount: info.dailyCount,
            maxDaily: maxDailyTrades,
            resetTime: new Date(new Date().setHours(0, 0, 0, 0) + 24 * 60 * 60 * 1000)
          }
        };
      }

      // 通过所有检查，允许入场
      return {
        allowed: true,
        reason: 'ok',
        details: {
          symbol,
          dailyCount: info.dailyCount,
          minutesSinceLast: Math.round(minutesSinceLast)
        }
      };
    } catch (error) {
      logger.error('[CooldownCache] canEnter错误:', error);
      // 发生错误时，保守策略：不允许入场
      return {
        allowed: false,
        reason: 'error',
        details: { error: error.message }
      };
    }
  }

  /**
   * 更新入场记录
   * @param {string} symbol - 交易对符号
   * @returns {void}
   */
  updateEntry(symbol) {
    try {
      const now = Date.now();
      const today = new Date().toDateString();
      const info = this.cache.get(symbol);

      if (!info) {
        // 首次入场
        this.cache.set(symbol, {
          lastEntry: now,
          dailyCount: 1,
          lastResetDate: today
        });
        logger.debug(`[CooldownCache] ${symbol} 首次入场记录`);
      } else {
        // 检查是否需要重置日计数
        if (info.lastResetDate !== today) {
          info.dailyCount = 1;
          info.lastResetDate = today;
        } else {
          info.dailyCount++;
        }
        info.lastEntry = now;
        this.cache.set(symbol, info);
        logger.debug(`[CooldownCache] ${symbol} 更新入场记录，今日第${info.dailyCount}笔`);
      }
    } catch (error) {
      logger.error('[CooldownCache] updateEntry错误:', error);
    }
  }

  /**
   * 获取交易对的冷却状态
   * @param {string} symbol - 交易对符号
   * @returns {Object|null} 冷却状态信息
   */
  getStatus(symbol) {
    const info = this.cache.get(symbol);
    if (!info) {
      return null;
    }

    const now = Date.now();
    const minutesSinceLast = Math.round((now - info.lastEntry) / 1000 / 60);

    return {
      symbol,
      lastEntry: new Date(info.lastEntry),
      dailyCount: info.dailyCount,
      minutesSinceLast,
      lastResetDate: info.lastResetDate
    };
  }

  /**
   * 手动重置交易对的冷却状态（用于测试或管理）
   * @param {string} symbol - 交易对符号
   * @returns {void}
   */
  reset(symbol) {
    this.cache.delete(symbol);
    logger.info(`[CooldownCache] ${symbol} 冷却状态已重置`);
  }

  /**
   * 重置所有冷却状态
   * @returns {void}
   */
  resetAll() {
    const count = this.cache.size;
    this.cache.clear();
    logger.info(`[CooldownCache] 所有冷却状态已重置（${count}个交易对）`);
  }

  /**
   * 获取所有交易对的冷却统计
   * @returns {Object} 统计信息
   */
  getStatistics() {
    const stats = {
      totalSymbols: this.cache.size,
      byDailyCount: {},
      recentEntries: []
    };

    const now = Date.now();
    for (const [symbol, info] of this.cache.entries()) {
      // 按每日交易次数分组
      const count = info.dailyCount;
      stats.byDailyCount[count] = (stats.byDailyCount[count] || 0) + 1;

      // 收集最近入场的交易对
      const minutesSince = Math.round((now - info.lastEntry) / 1000 / 60);
      if (minutesSince < 60) {
        stats.recentEntries.push({
          symbol,
          minutesSince,
          dailyCount: info.dailyCount
        });
      }
    }

    // 按时间排序
    stats.recentEntries.sort((a, b) => a.minutesSince - b.minutesSince);

    return stats;
  }

  /**
   * 检查是否已初始化
   * @returns {boolean}
   */
  isInitialized() {
    return this.initialized;
  }
}

module.exports = CooldownCache;

