// DataRefreshManager.js - 数据刷新频率管理器
// 根据strategy-v3.md文档要求管理不同时间级别的数据刷新

class DataRefreshManager {
  constructor(database) {
    this.db = database;
    this.refreshIntervals = {
      'trend_analysis': 60,        // 4H和1H趋势判断：每1小时
      'trend_scoring': 5,          // 趋势市1H多因子打分：每5分钟
      'trend_entry': 2,            // 趋势市15分钟入场判断：每2分钟
      'range_boundary': 5,         // 震荡市1H边界判断：每5分钟
      'range_entry': 2             // 震荡市15分钟入场判断：每2分钟
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
  async updateRefreshTime(symbol, dataType, dataFreshnessScore = null) {
    try {
      const interval = this.refreshIntervals[dataType];
      const now = new Date();
      const nextUpdate = new Date(now.getTime() + interval * 60 * 1000);

      // 如果没有传入新鲜度得分，则计算当前新鲜度
      if (dataFreshnessScore === null) {
        dataFreshnessScore = this.calculateDataFreshnessScore(symbol, dataType, now.toISOString());
      }

      await this.db.run(`
        INSERT OR REPLACE INTO data_refresh_log 
        (symbol, data_type, last_update, next_update, refresh_interval, data_freshness_score)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [symbol, dataType, now.toISOString(), nextUpdate.toISOString(), interval, dataFreshnessScore]);

      console.log(`✅ 更新刷新时间 [${symbol}][${dataType}]: 下次刷新 ${nextUpdate.toISOString()}, 新鲜度: ${dataFreshnessScore}%`);
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
            staleData.push({ symbol, data_type: dataType });
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
   * 批量刷新所有过期数据
   */
  async refreshAllStaleData() {
    try {
      const staleData = await this.getStaleData();
      const refreshResults = [];
      
      for (const item of staleData) {
        try {
          // 更新刷新时间
          await this.updateRefreshTime(item.symbol, item.data_type);
          refreshResults.push({
            symbol: item.symbol,
            data_type: item.data_type,
            success: true
          });
        } catch (error) {
          refreshResults.push({
            symbol: item.symbol,
            data_type: item.data_type,
            success: false,
            error: error.message
          });
        }
      }
      
      const successCount = refreshResults.filter(r => r.success).length;
      const failCount = refreshResults.filter(r => !r.success).length;
      
      console.log(`✅ 批量刷新完成: 成功 ${successCount} 个, 失败 ${failCount} 个`);
      
      return {
        success: true,
        total: staleData.length,
        successCount,
        failCount,
        results: refreshResults
      };
    } catch (error) {
      console.error('批量刷新失败:', error);
      return {
        success: false,
        error: error.message
      };
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
