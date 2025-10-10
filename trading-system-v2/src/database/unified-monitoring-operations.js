/**
 * 统一监控数据操作模块
 * 替代原有的macro_monitoring_*表操作，统一使用system_monitoring
 * 
 * @module unified-monitoring-operations
 */

const logger = require('../utils/logger');

/**
 * 统一监控数据操作类
 * 封装对system_monitoring表的操作，兼容原macro_monitoring接口
 */
class UnifiedMonitoringOperations {
  constructor(database) {
    this.database = database;
    this.component = 'macro_monitor'; // 组件标识
  }

  /**
   * 保存监控数据
   * 替代原 INSERT INTO macro_monitoring_data
   * 
   * @param {string} metricName - 指标名称
   * @param {number} metricValue - 指标值
   * @param {string} metricUnit - 单位
   * @param {Object} details - 详细信息
   * @returns {Promise<void>}
   */
  async saveMonitoringData(metricName, metricValue, metricUnit = null, details = {}) {
    try {
      // 判断状态
      const status = this._determineStatus(details);

      const query = `
        INSERT INTO system_monitoring 
        (metric_name, metric_value, metric_unit, component, status, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
      `;

      const detailsJson = JSON.stringify({
        ...details,
        source: details.source || 'macro_monitor',
        data_type: details.dataType || details.data_type || 'MACRO'
      });

      await this.database.query(query, [
        metricName,
        metricValue,
        metricUnit,
        this.component,
        status,
        detailsJson
      ]);

      logger.debug(`监控数据已保存: ${metricName} = ${metricValue} ${metricUnit || ''}`);
    } catch (error) {
      logger.error(`保存监控数据失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 查询历史监控数据
   * 替代原 SELECT FROM macro_monitoring_data
   * 
   * @param {string} metricName - 指标名称
   * @param {Object} options - 查询选项
   * @returns {Promise<Array>}
   */
  async getMonitoringData(metricName, options = {}) {
    try {
      const {
        limit = 100,
        hours = 24,
        source = null
      } = options;

      let query = `
        SELECT 
          id,
          metric_name,
          metric_value,
          metric_unit,
          status,
          details,
          created_at
        FROM system_monitoring
        WHERE component = ?
          AND metric_name = ?
          AND created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
      `;

      const params = [this.component, metricName, hours];

      // 如果指定了source，添加过滤
      if (source) {
        query += ` AND JSON_EXTRACT(details, '$.source') = ?`;
        params.push(source);
      }

      query += ` ORDER BY created_at DESC LIMIT ?`;
      params.push(limit);

      const rows = await this.database.query(query, params);

      return rows.map(row => ({
        ...row,
        details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details
      }));
    } catch (error) {
      logger.error(`查询监控数据失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 保存告警记录
   * 替代原 INSERT INTO macro_monitoring_alerts
   * 
   * @param {Object} alert - 告警对象
   * @returns {Promise<void>}
   */
  async saveAlert(alert) {
    try {
      // 使用macro_alert_history表（专门的告警表）
      const query = `
        INSERT INTO macro_alert_history 
        (alert_type, severity, symbol_id, message, alert_data, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
      `;

      const severity = this._mapAlertLevel(alert.level || alert.severity);
      const alertData = JSON.stringify({
        metric_name: alert.metric_name || alert.metricName,
        metric_value: alert.metric_value || alert.metricValue,
        threshold_value: alert.threshold_value || alert.thresholdValue,
        title: alert.title,
        ...alert
      });

      await this.database.query(query, [
        alert.type || alert.alert_type,
        severity,
        alert.symbol_id || null,
        alert.message || alert.alert_message,
        alertData
      ]);

      logger.info(`告警已保存: ${alert.type} - ${alert.message}`);
    } catch (error) {
      logger.error(`保存告警失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 查询告警历史
   * 替代原 SELECT FROM macro_monitoring_alerts
   * 
   * @param {Object} options - 查询选项
   * @returns {Promise<Array>}
   */
  async getAlerts(options = {}) {
    try {
      const {
        limit = 100,
        hours = 24,
        alertType = null,
        severity = null
      } = options;

      let query = `
        SELECT * FROM macro_alert_history
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
      `;
      const params = [hours];

      if (alertType) {
        query += ` AND alert_type = ?`;
        params.push(alertType);
      }

      if (severity) {
        query += ` AND severity = ?`;
        params.push(severity);
      }

      query += ` ORDER BY created_at DESC LIMIT ?`;
      params.push(limit);

      const rows = await this.database.query(query, params);

      return rows.map(row => ({
        ...row,
        alert_data: typeof row.alert_data === 'string' ? JSON.parse(row.alert_data) : row.alert_data
      }));
    } catch (error) {
      logger.error(`查询告警失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取配置
   * 替代原 SELECT FROM macro_monitoring_config
   * 
   * @param {string} configKey - 配置键（可选）
   * @returns {Promise<Object|Array>}
   */
  async getConfig(configKey = null) {
    try {
      let query, params;

      if (configKey) {
        query = `
          SELECT config_key, config_value, config_type
          FROM system_config
          WHERE config_key = ? AND is_active = 1
        `;
        params = [configKey];
      } else {
        query = `
          SELECT config_key, config_value, config_type
          FROM system_config
          WHERE config_key LIKE 'macro_%' AND is_active = 1
        `;
        params = [];
      }

      const rows = await this.database.query(query, params);

      // 转换为对象格式
      if (configKey) {
        return rows.length > 0 ? this._parseConfigValue(rows[0]) : null;
      }

      const config = {};
      rows.forEach(row => {
        config[row.config_key] = this._parseConfigValue(row);
      });
      return config;
    } catch (error) {
      logger.error(`获取配置失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 保存配置
   * 替代原 INSERT/UPDATE macro_monitoring_config
   * 
   * @param {string} configKey - 配置键
   * @param {any} configValue - 配置值
   * @param {string} configType - 配置类型
   * @returns {Promise<void>}
   */
  async saveConfig(configKey, configValue, configType = 'STRING') {
    try {
      const query = `
        INSERT INTO system_config (config_key, config_value, config_type, is_active)
        VALUES (?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE
          config_value = VALUES(config_value),
          config_type = VALUES(config_type),
          updated_at = CURRENT_TIMESTAMP
      `;

      await this.database.query(query, [
        configKey,
        String(configValue),
        configType
      ]);

      logger.info(`配置已保存: ${configKey} = ${configValue}`);
    } catch (error) {
      logger.error(`保存配置失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 判断状态
   * @private
   */
  _determineStatus(details) {
    if (details.alert_triggered || details.alertTriggered) {
      return 'WARNING';
    }
    if (details.alert_level === 'CRITICAL' || details.alertLevel === 'CRITICAL') {
      return 'CRITICAL';
    }
    return 'NORMAL';
  }

  /**
   * 映射告警级别
   * @private
   */
  _mapAlertLevel(level) {
    const mapping = {
      'INFO': 'INFO',
      'WARNING': 'WARNING',
      'WARN': 'WARNING',
      'CRITICAL': 'CRITICAL',
      'ERROR': 'CRITICAL'
    };
    return mapping[level] || 'WARNING';
  }

  /**
   * 解析配置值
   * @private
   */
  _parseConfigValue(row) {
    const { config_value, config_type } = row;

    switch (config_type) {
      case 'NUMBER':
        return parseFloat(config_value);
      case 'BOOLEAN':
        return config_value === 'true' || config_value === '1';
      case 'JSON':
        try {
          return JSON.parse(config_value);
        } catch {
          return config_value;
        }
      default:
        return config_value;
    }
  }
}

module.exports = UnifiedMonitoringOperations;

