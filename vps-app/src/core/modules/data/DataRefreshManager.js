// DataRefreshManager.js - 数据刷新频率管理器
// 根据strategy-v3.md文档要求管理不同时间级别的数据刷新

class DataRefreshManager {
  constructor(database) {
    this.db = database;
    this.refreshIntervals = {
      'trend_analysis': 480,       // 4H趋势判断：每8小时
      'trend_scoring': 120,        // 1H多因子打分：每2小时
      'trend_strength': 480,       // 4H加强趋势判断：每8小时
      'trend_entry': 60,           // 15分钟入场判断：每1小时
      'range_boundary': 480,       // 4H边界判断：每8小时
      'range_entry': 120           // 1H入场判断：每2小时
    };
    
    // 新鲜度告警阈值配置
    this.freshnessThresholds = {
      'trend_analysis': { critical: 30, warning: 50, info: 70 },
      'trend_scoring': { critical: 30, warning: 50, info: 70 },
      'trend_strength': { critical: 30, warning: 50, info: 70 },
      'trend_entry': { critical: 20, warning: 40, info: 60 },
      'range_boundary': { critical: 30, warning: 50, info: 70 },
      'range_entry': { critical: 20, warning: 40, info: 60 }
    };
    
    // 告警冷却时间（分钟）
    this.alertCooldown = 30;
    this.lastAlertTime = new Map();
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
        dataFreshnessScore = await this.calculateDataFreshnessScore(symbol, dataType, now.toISOString());
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
   * 获取数据新鲜度得分 - 基于实际K线数据时间
   */
  async calculateDataFreshnessScore(symbol, dataType, lastUpdate) {
    try {
      // 获取该交易对最新的K线数据时间
      const klineData = await this.db.runQuery(`
        SELECT close_time 
        FROM kline_data 
        WHERE symbol = ? AND interval = ?
        ORDER BY close_time DESC 
        LIMIT 1
      `, [symbol, this.getIntervalForDataType(dataType)]);

      if (!klineData || klineData.length === 0) {
        return 0; // 没有数据，新鲜度为0
      }

      const lastKlineTime = klineData[0].close_time;
      const now = Date.now();
      const timeDiff = (now - lastKlineTime) / (1000 * 60); // 分钟

      // 根据数据类型确定刷新间隔
      const interval = this.refreshIntervals[dataType];
      
      // 计算新鲜度得分：0-100分
      // 如果K线数据是未来时间，新鲜度设为100%
      if (timeDiff < 0) {
        return 100;
      }
      const freshnessScore = Math.max(0, 100 - (timeDiff / interval) * 100);
      return Math.round(freshnessScore * 100) / 100;
    } catch (error) {
      console.error(`计算数据新鲜度失败 [${symbol}][${dataType}]:`, error);
      return 0;
    }
  }

  /**
   * 根据数据类型获取对应的时间间隔
   */
  getIntervalForDataType(dataType) {
    const intervalMap = {
      'trend_analysis': '4h',
      'trend_scoring': '1h', 
      'trend_entry': '15m',
      'trend_strength': '4h',
      'range_boundary': '4h',
      'range_entry': '1h'
    };
    return intervalMap[dataType] || '4h';
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
          COUNT(DISTINCT symbol) as total_symbols,
          AVG(data_freshness_score) as avg_freshness,
          MIN(data_freshness_score) as min_freshness,
          MAX(data_freshness_score) as max_freshness,
          GROUP_CONCAT(DISTINCT symbol) as symbols
        FROM data_refresh_log 
        GROUP BY data_type
      `);

      // 将symbols字符串转换为数组
      return stats.map(stat => ({
        ...stat,
        symbols: stat.symbols ? stat.symbols.split(',') : []
      }));
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
   * 检查数据新鲜度并生成告警
   * @param {Object} telegramNotifier - Telegram通知器实例
   * @returns {Array} 告警列表
   */
  async checkFreshnessAndAlert(telegramNotifier = null) {
    try {
      const alerts = [];
      const allData = await this.db.runQuery(`
        SELECT symbol, data_type, last_update, data_freshness_score
        FROM data_refresh_log
        ORDER BY data_type, symbol
      `);

      for (const data of allData) {
        const { symbol, data_type, last_update, data_freshness_score } = data;
        const freshness = data_freshness_score || 0;
        const thresholds = this.freshnessThresholds[data_type];
        
        if (!thresholds) continue;

        // 确定告警级别
        let severity = null;
        let threshold = null;
        
        if (freshness <= thresholds.critical) {
          severity = 'critical';
          threshold = thresholds.critical;
        } else if (freshness <= thresholds.warning) {
          severity = 'warning';
          threshold = thresholds.warning;
        } else if (freshness <= thresholds.info) {
          severity = 'info';
          threshold = thresholds.info;
        }

        if (severity) {
          const alertKey = `${symbol}_${data_type}_${severity}`;
          const now = Date.now();
          const lastAlert = this.lastAlertTime.get(alertKey) || 0;
          
          // 检查冷却时间
          if (now - lastAlert > this.alertCooldown * 60 * 1000) {
            const alert = {
              dataType: data_type,
              symbol,
              freshness,
              threshold,
              lastUpdate: last_update,
              interval: this.refreshIntervals[data_type],
              severity,
              timestamp: now
            };
            
            alerts.push(alert);
            this.lastAlertTime.set(alertKey, now);
            
            // 发送单个告警
            if (telegramNotifier) {
              await telegramNotifier.sendDataFreshnessAlert(alert);
            }
          }
        }
      }

      // 发送批量告警（如果有多个告警）
      if (alerts.length > 1 && telegramNotifier) {
        await telegramNotifier.sendBatchDataFreshnessAlert(alerts);
      }

      return alerts;
    } catch (error) {
      console.error('检查新鲜度告警失败:', error);
      return [];
    }
  }

  /**
   * 获取新鲜度告警状态
   * @returns {Object} 告警状态统计
   */
  async getFreshnessAlertStatus() {
    try {
      const allData = await this.db.runQuery(`
        SELECT data_type, data_freshness_score
        FROM data_refresh_log
      `);

      const status = {
        total: allData.length,
        critical: 0,
        warning: 0,
        info: 0,
        normal: 0,
        byDataType: {}
      };

      for (const data of allData) {
        const { data_type, data_freshness_score } = data;
        const freshness = data_freshness_score || 0;
        const thresholds = this.freshnessThresholds[data_type];
        
        if (!thresholds) continue;

        if (!status.byDataType[data_type]) {
          status.byDataType[data_type] = { total: 0, critical: 0, warning: 0, info: 0, normal: 0 };
        }

        status.byDataType[data_type].total++;
        status.total++;

        if (freshness <= thresholds.critical) {
          status.critical++;
          status.byDataType[data_type].critical++;
        } else if (freshness <= thresholds.warning) {
          status.warning++;
          status.byDataType[data_type].warning++;
        } else if (freshness <= thresholds.info) {
          status.info++;
          status.byDataType[data_type].info++;
        } else {
          status.normal++;
          status.byDataType[data_type].normal++;
        }
      }

      return status;
    } catch (error) {
      console.error('获取新鲜度告警状态失败:', error);
      return { total: 0, critical: 0, warning: 0, info: 0, normal: 0, byDataType: {} };
    }
  }

  /**
   * 设置新鲜度告警阈值
   * @param {string} dataType - 数据类型
   * @param {Object} thresholds - 阈值配置 {critical, warning, info}
   */
  setFreshnessThresholds(dataType, thresholds) {
    if (this.freshnessThresholds[dataType]) {
      this.freshnessThresholds[dataType] = { ...this.freshnessThresholds[dataType], ...thresholds };
      console.log(`✅ 更新新鲜度告警阈值 [${dataType}]:`, thresholds);
    }
  }

  /**
   * 设置告警冷却时间
   * @param {number} minutes - 冷却时间（分钟）
   */
  setAlertCooldown(minutes) {
    this.alertCooldown = minutes;
    console.log(`✅ 设置告警冷却时间: ${minutes}分钟`);
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
