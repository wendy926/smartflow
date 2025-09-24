/**
 * 市场情绪监控模块
 * 监控恐惧贪婪指数等市场情绪指标
 */

const logger = require('../../utils/logger');

class MarketSentimentMonitor {
  constructor(database, config) {
    this.database = database;
    this.config = config;
    this.fearGreedApi = 'https://api.alternative.me/fng/?limit=1';
    this.lowThreshold = config.lowThreshold || 20;
    this.highThreshold = config.highThreshold || 80;
  }

  /**
   * 检查恐惧贪婪指数
   */
  async checkFearGreedIndex() {
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(this.fearGreedApi);
      const data = await response.json();

      if (data.data && data.data.length > 0) {
        const fngData = data.data[0];
        const index = parseInt(fngData.value);
        const classification = fngData.value_classification;

        // 记录数据
        await this.saveSentimentData('MARKET_SENTIMENT', 'Alternative.me', '恐惧贪婪指数', index, '指数', 'NORMAL', {
          value: index,
          classification: classification,
          timestamp: fngData.timestamp
        });

        // 检查告警阈值
        const alerts = [];
        if (index < this.lowThreshold) {
          alerts.push({
            type: 'MARKET_SENTIMENT',
            level: 'WARNING',
            title: '极度恐惧告警',
            message: `恐惧贪婪指数过低: ${index} (${classification})，可能出现反转机会`,
            metric_name: '恐惧贪婪指数',
            metric_value: index,
            threshold_value: this.lowThreshold
          });
        } else if (index > this.highThreshold) {
          alerts.push({
            type: 'MARKET_SENTIMENT',
            level: 'WARNING',
            title: '极度贪婪告警',
            message: `恐惧贪婪指数过高: ${index} (${classification})，注意市场过热风险`,
            metric_name: '恐惧贪婪指数',
            metric_value: index,
            threshold_value: this.highThreshold
          });
        }

        logger.info(`恐惧贪婪指数: ${index} (${classification})`);
        return alerts;
      }
    } catch (error) {
      logger.error('检查恐惧贪婪指数失败:', error);
      throw error;
    }

    return [];
  }

  /**
   * 执行市场情绪监控
   */
  async monitor() {
    try {
      logger.info('开始市场情绪监控...');

      const alerts = [];

      // 检查恐惧贪婪指数
      const fngAlerts = await this.checkFearGreedIndex();
      alerts.push(...fngAlerts);

      // 处理告警
      for (const alert of alerts) {
        await this.saveAlert(alert);
      }

      logger.info(`市场情绪监控完成，发现 ${alerts.length} 个告警`);
      return alerts;

    } catch (error) {
      logger.error('市场情绪监控失败:', error);
      throw error;
    }
  }

  /**
   * 保存市场情绪数据
   */
  async saveSentimentData(dataType, source, metricName, metricValue, metricUnit, alertLevel, rawData) {
    try {
      const query = `
        INSERT INTO macro_monitoring_data 
        (data_type, source, metric_name, metric_value, metric_unit, alert_level, raw_data, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      `;

      await this.database.execute(query, [
        dataType,
        source,
        metricName,
        metricValue,
        metricUnit,
        alertLevel,
        JSON.stringify(rawData)
      ]);

    } catch (error) {
      logger.error('保存市场情绪数据失败:', error);
      throw error;
    }
  }

  /**
   * 保存告警记录
   */
  async saveAlert(alert) {
    try {
      const query = `
        INSERT INTO macro_monitoring_alerts 
        (alert_type, alert_level, title, message, metric_name, metric_value, threshold_value, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      `;

      await this.database.execute(query, [
        alert.type,
        alert.level,
        alert.title,
        alert.message,
        alert.metric_name,
        alert.metric_value,
        alert.threshold_value
      ]);

    } catch (error) {
      logger.error('保存告警记录失败:', error);
      throw error;
    }
  }

  /**
   * 获取市场情绪数据
   */
  async getSentimentData(limit = 50) {
    try {
      const query = `
        SELECT * FROM macro_monitoring_data 
        WHERE data_type = 'MARKET_SENTIMENT' 
        ORDER BY created_at DESC 
        LIMIT ?
      `;

      const [rows] = await this.database.execute(query, [limit]);
      return rows;

    } catch (error) {
      logger.error('获取市场情绪数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取当前恐惧贪婪指数
   */
  async getCurrentFearGreedIndex() {
    try {
      const query = `
        SELECT metric_value, raw_data, created_at 
        FROM macro_monitoring_data 
        WHERE data_type = 'MARKET_SENTIMENT' 
        AND metric_name = '恐惧贪婪指数'
        ORDER BY created_at DESC 
        LIMIT 1
      `;

      const [rows] = await this.database.execute(query);
      if (rows.length > 0) {
        const row = rows[0];
        return {
          value: row.metric_value,
          classification: JSON.parse(row.raw_data).classification,
          timestamp: row.created_at
        };
      }

      return null;
    } catch (error) {
      logger.error('获取当前恐惧贪婪指数失败:', error);
      throw error;
    }
  }
}

module.exports = MarketSentimentMonitor;
