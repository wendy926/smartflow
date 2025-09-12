// DataRefreshManager.js - 数据刷新频率管理器
// 根据strategy-v3.md文档要求管理不同时间级别的数据刷新

class DataRefreshManager {
  constructor(database) {
    this.db = database;
    this.refreshIntervals = {
      '4h_trend': 60,      // 4H趋势：每1小时
      '1h_scoring': 5,     // 1H打分：每5分钟
      '15m_entry': 2,      // 15m入场：每1-3分钟（取2分钟）
      'delta': 0.1         // Delta/盘口：实时（0.1分钟=6秒）
    };
  }

  /**
   * 检查数据是否需要刷新
   */
  async shouldRefresh(symbol, dataType) {
    try {
      const interval = this.refreshIntervals[dataType];
      if (!interval) {
        console.warn(`未知的数据类型: ${dataType}`);
        return true;
      }

      const rows = await this.db.runQuery(
        `SELECT last_update, next_update FROM data_refresh_log 
         WHERE symbol = ? AND data_type = ?`,
        [symbol, dataType]
      );
      const result = rows.length > 0 ? rows[0] : null;

      if (!result) {
        // 首次刷新
        return true;
      }

      const now = new Date();
      const nextUpdate = new Date(result.next_update);
      
      return now >= nextUpdate;
    } catch (error) {
      console.error(`检查刷新状态失败 [${symbol}][${dataType}]:`, error);
      return true;
    }
  }

  /**
   * 更新数据刷新时间
   */
  async updateRefreshTime(symbol, dataType, dataFreshnessScore = 0) {
    try {
      const interval = this.refreshIntervals[dataType];
      const now = new Date();
      const nextUpdate = new Date(now.getTime() + interval * 60 * 1000);

      await this.db.run(`
        INSERT OR REPLACE INTO data_refresh_log 
        (symbol, data_type, last_update, next_update, refresh_interval, data_freshness_score)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [symbol, dataType, now.toISOString(), nextUpdate.toISOString(), interval, dataFreshnessScore]);

      console.log(`✅ 更新刷新时间 [${symbol}][${dataType}]: 下次刷新 ${nextUpdate.toISOString()}`);
    } catch (error) {
      console.error(`更新刷新时间失败 [${symbol}][${dataType}]:`, error);
    }
  }

  /**
   * 获取数据新鲜度得分
   */
  calculateDataFreshnessScore(symbol, dataType, lastUpdate) {
    const interval = this.refreshIntervals[dataType];
    const now = new Date();
    const lastUpdateTime = new Date(lastUpdate);
    const timeDiff = (now - lastUpdateTime) / (1000 * 60); // 分钟

    // 计算新鲜度得分：0-100分
    const freshnessScore = Math.max(0, 100 - (timeDiff / interval) * 100);
    return Math.round(freshnessScore * 100) / 100;
  }

  /**
   * 获取所有需要刷新的数据
   */
  async getStaleData() {
    try {
      const staleData = [];
      const symbols = await this.db.runQuery(`SELECT DISTINCT symbol FROM data_refresh_log`);
      
      for (const { symbol } of symbols) {
        for (const dataType of Object.keys(this.refreshIntervals)) {
          const shouldRefresh = await this.shouldRefresh(symbol, dataType);
          if (shouldRefresh) {
            staleData.push({ symbol, dataType });
          }
        }
      }
      
      return staleData;
    } catch (error) {
      console.error('获取过期数据失败:', error);
      return [];
    }
  }

  /**
   * 获取数据刷新统计
   */
  async getRefreshStats() {
    try {
      const stats = await this.db.runQuery(`
        SELECT 
          data_type,
          COUNT(*) as total_symbols,
          AVG(data_freshness_score) as avg_freshness,
          MIN(data_freshness_score) as min_freshness,
          MAX(data_freshness_score) as max_freshness
        FROM data_refresh_log 
        GROUP BY data_type
      `);
      
      return stats;
    } catch (error) {
      console.error('获取刷新统计失败:', error);
      return [];
    }
  }

  /**
   * 清理过期的刷新记录
   */
  async cleanupExpiredRecords() {
    try {
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24小时前
      
      await this.db.run(`
        DELETE FROM data_refresh_log 
        WHERE last_update < ?
      `, [cutoffTime.toISOString()]);
      
      console.log('✅ 清理过期刷新记录完成');
    } catch (error) {
      console.error('清理过期记录失败:', error);
    }
  }
}

module.exports = DataRefreshManager;
