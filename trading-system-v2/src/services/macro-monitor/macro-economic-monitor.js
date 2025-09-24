/**
 * 宏观指标监控模块
 * 监控美联储利率、CPI通胀率等宏观金融指标
 */

const logger = require('../../utils/logger');

class MacroEconomicMonitor {
  constructor(database, config) {
    this.database = database;
    this.config = config;
    this.fredApiKey = config.fredApiKey || 'fbfe3e85bdec733f71b17800eaa614fd';
    this.fedFundsHigh = config.fedFundsHigh || 5.0;
    this.fedFundsLow = config.fedFundsLow || 2.0;
    this.cpiHigh = config.cpiHigh || 4.0;
    this.cpiLow = config.cpiLow || 1.0;
  }

  /**
   * 检查美联储利率
   */
  async checkFedFundsRate() {
    try {
      const fetch = (await import('node-fetch')).default;
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=FEDFUNDS&api_key=${this.fredApiKey}&file_type=json`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.observations && data.observations.length > 0) {
        const latest = data.observations[data.observations.length - 1];
        const value = parseFloat(latest.value);

        // 记录数据
        await this.saveMacroData('MACRO_ECONOMIC', 'FRED', '美联储利率', value, '%', 'NORMAL', {
          value: value,
          date: latest.date,
          series_id: 'FEDFUNDS'
        });

        // 检查告警阈值
        const alerts = [];
        if (value > this.fedFundsHigh) {
          alerts.push({
            type: 'MACRO_ECONOMIC',
            level: 'WARNING',
            title: '美联储利率过高告警',
            message: `美联储利率过高: ${value}% (阈值: ${this.fedFundsHigh}%)`,
            metric_name: '美联储利率',
            metric_value: value,
            threshold_value: this.fedFundsHigh
          });
        } else if (value < this.fedFundsLow) {
          alerts.push({
            type: 'MACRO_ECONOMIC',
            level: 'WARNING',
            title: '美联储利率过低告警',
            message: `美联储利率过低: ${value}% (阈值: ${this.fedFundsLow}%)`,
            metric_name: '美联储利率',
            metric_value: value,
            threshold_value: this.fedFundsLow
          });
        }

        logger.info(`美联储利率: ${value}% (${latest.date})`);
        return alerts;
      }
    } catch (error) {
      logger.error('检查美联储利率失败:', error);
      throw error;
    }

    return [];
  }

  /**
   * 检查CPI通胀率
   */
  async checkCPIRate() {
    try {
      const fetch = (await import('node-fetch')).default;
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL&api_key=${this.fredApiKey}&file_type=json`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.observations && data.observations.length > 12) {
        const latest = data.observations[data.observations.length - 1];
        const lastYear = data.observations[data.observations.length - 13];

        const currentCPI = parseFloat(latest.value);
        const lastYearCPI = parseFloat(lastYear.value);
        const yoyRate = ((currentCPI - lastYearCPI) / lastYearCPI) * 100;

        // 记录数据
        await this.saveMacroData('MACRO_ECONOMIC', 'FRED', 'CPI同比通胀率', yoyRate, '%', 'NORMAL', {
          currentCPI: currentCPI,
          lastYearCPI: lastYearCPI,
          yoyRate: yoyRate,
          currentDate: latest.date,
          lastYearDate: lastYear.date
        });

        // 检查告警阈值
        const alerts = [];
        if (yoyRate > this.cpiHigh) {
          alerts.push({
            type: 'MACRO_ECONOMIC',
            level: 'WARNING',
            title: '高通胀风险告警',
            message: `CPI同比通胀率过高: ${yoyRate.toFixed(2)}% (阈值: ${this.cpiHigh}%)`,
            metric_name: 'CPI同比通胀率',
            metric_value: yoyRate,
            threshold_value: this.cpiHigh
          });
        } else if (yoyRate < this.cpiLow) {
          alerts.push({
            type: 'MACRO_ECONOMIC',
            level: 'WARNING',
            title: '通缩风险告警',
            message: `CPI同比通胀率过低: ${yoyRate.toFixed(2)}% (阈值: ${this.cpiLow}%)`,
            metric_name: 'CPI同比通胀率',
            metric_value: yoyRate,
            threshold_value: this.cpiLow
          });
        }

        logger.info(`美国CPI同比: ${yoyRate.toFixed(2)}% (${latest.date})`);
        return alerts;
      }
    } catch (error) {
      logger.error('检查CPI通胀率失败:', error);
      throw error;
    }

    return [];
  }

  /**
   * 执行宏观指标监控
   */
  async monitor() {
    try {
      logger.info('开始宏观指标监控...');

      const alerts = [];

      // 检查美联储利率
      const fedAlerts = await this.checkFedFundsRate();
      alerts.push(...fedAlerts);

      // 检查CPI通胀率
      const cpiAlerts = await this.checkCPIRate();
      alerts.push(...cpiAlerts);

      // 处理告警
      for (const alert of alerts) {
        await this.saveAlert(alert);
      }

      logger.info(`宏观指标监控完成，发现 ${alerts.length} 个告警`);
      return alerts;

    } catch (error) {
      logger.error('宏观指标监控失败:', error);
      throw error;
    }
  }

  /**
   * 保存宏观指标数据
   */
  async saveMacroData(dataType, source, metricName, metricValue, metricUnit, alertLevel, rawData) {
    try {
      const query = `
        INSERT INTO macro_monitoring_data 
        (data_type, source, metric_name, metric_value, metric_unit, alert_level, raw_data, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      `;

      await this.database.query(query, [
        dataType,
        source,
        metricName,
        metricValue,
        metricUnit,
        alertLevel,
        JSON.stringify(rawData)
      ]);

    } catch (error) {
      logger.error('保存宏观指标数据失败:', error);
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

      await this.database.query(query, [
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
   * 获取宏观指标数据
   */
  async getMacroData(limit = 50) {
    try {
      const query = `
        SELECT * FROM macro_monitoring_data 
        WHERE data_type = 'MACRO_ECONOMIC' 
        ORDER BY created_at DESC 
        LIMIT 50
      `;

      const rows = await this.database.query(query);
      return rows;

    } catch (error) {
      logger.error('获取宏观指标数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取当前美联储利率
   */
  async getCurrentFedFundsRate() {
    try {
      const query = `
        SELECT metric_value, raw_data, created_at 
        FROM macro_monitoring_data 
        WHERE data_type = 'MACRO_ECONOMIC' 
        AND metric_name = '美联储利率'
        ORDER BY created_at DESC 
        LIMIT 1
      `;

      const rows = await this.database.query(query);
      if (rows.length > 0) {
        const row = rows[0];
        let rawData = {};
        try {
          rawData = JSON.parse(row.raw_data || "{}");
        } catch (e) {
          logger.warn("JSON解析失败，使用默认值:", e.message);
          rawData = {};
        }
        return {
          value: row.metric_value,
          date: rawData.date || "Unknown",
          timestamp: row.created_at
        };
      }

      return null;
    } catch (error) {
      logger.error('获取当前美联储利率失败:', error);
      throw error;
    }
  }

  /**
   * 获取当前CPI通胀率
   */
  async getCurrentCPIRate() {
    try {
      const query = `
        SELECT metric_value, raw_data, created_at 
        FROM macro_monitoring_data 
        WHERE data_type = 'MACRO_ECONOMIC' 
        AND metric_name = 'CPI同比通胀率'
        ORDER BY created_at DESC 
        LIMIT 1
      `;

      const rows = await this.database.query(query);
      if (rows.length > 0) {
        const row = rows[0];
        let rawData = {};
        try {
          rawData = JSON.parse(row.raw_data || "{}");
        } catch (e) {
          logger.warn("JSON解析失败，使用默认值:", e.message);
          rawData = {};
        }
        return {
          value: row.metric_value,
          currentCPI: rawData.currentCPI || 0,
          lastYearCPI: rawData.lastYearCPI || 0,
          currentDate: rawData.currentDate || "Unknown",
          lastYearDate: rawData.lastYearDate || "Unknown",
          timestamp: row.created_at
        };
      }

      return null;
    } catch (error) {
      logger.error('获取当前CPI通胀率失败:', error);
      throw error;
    }
  }
}

module.exports = MacroEconomicMonitor;
