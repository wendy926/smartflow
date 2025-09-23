/**
 * 告警规则引擎
 */

const TelegramAlertService = require('./telegram-alert');
const logger = require('../utils/logger');

class AlertEngine {
  constructor() {
    this.telegramService = new TelegramAlertService();
    this.rules = new Map();
    this.alertHistory = new Map();
    this.setupDefaultRules();
  }

  /**
   * 设置默认告警规则
   */
  setupDefaultRules() {
    // CPU告警规则
    this.addRule('CPU_HIGH', {
      threshold: 60,
      cooldown: 300000, // 5分钟
      message: 'CPU使用率过高',
      enabled: true
    });

    // 内存告警规则
    this.addRule('MEMORY_HIGH', {
      threshold: 60,
      cooldown: 300000, // 5分钟
      message: '内存使用率过高',
      enabled: true
    });

    // 磁盘告警规则
    this.addRule('DISK_HIGH', {
      threshold: 80,
      cooldown: 600000, // 10分钟
      message: '磁盘使用率过高',
      enabled: true
    });

    // API错误告警规则
    this.addRule('API_ERROR', {
      threshold: 5, // 5次错误
      cooldown: 180000, // 3分钟
      message: 'API调用失败次数过多',
      enabled: true
    });

    // 策略执行告警规则
    this.addRule('STRATEGY_ERROR', {
      threshold: 3, // 3次错误
      cooldown: 300000, // 5分钟
      message: '策略执行失败次数过多',
      enabled: true
    });

    // 数据库告警规则
    this.addRule('DATABASE_ERROR', {
      threshold: 3, // 3次错误
      cooldown: 300000, // 5分钟
      message: '数据库连接或查询失败',
      enabled: true
    });
  }

  /**
   * 添加告警规则
   * @param {string} type - 告警类型
   * @param {Object} rule - 规则配置
   */
  addRule(type, rule) {
    this.rules.set(type, {
      threshold: rule.threshold,
      cooldown: rule.cooldown || 300000,
      message: rule.message,
      enabled: rule.enabled !== false,
      count: 0,
      lastAlert: 0
    });
  }

  /**
   * 检查告警条件
   * @param {string} type - 告警类型
   * @param {number} value - 当前值
   * @param {Object} context - 上下文数据
   */
  async checkAlert(type, value, context = {}) {
    const rule = this.rules.get(type);
    if (!rule || !rule.enabled) {
      return false;
    }

    const now = Date.now();
    const timeSinceLastAlert = now - rule.lastAlert;

    // 检查是否在冷却期内
    if (timeSinceLastAlert < rule.cooldown) {
      return false;
    }

    // 检查是否超过阈值
    let shouldAlert = false;
    if (type.includes('ERROR')) {
      // 错误类型：计数达到阈值
      rule.count++;
      shouldAlert = rule.count >= rule.threshold;
    } else {
      // 资源类型：值超过阈值
      shouldAlert = value > rule.threshold;
    }

    if (shouldAlert) {
      await this.triggerAlert(type, value, context, rule);
      rule.lastAlert = now;
      rule.count = 0; // 重置计数
      return true;
    }

    return false;
  }

  /**
   * 触发告警
   * @param {string} type - 告警类型
   * @param {number} value - 当前值
   * @param {Object} context - 上下文数据
   * @param {Object} rule - 规则配置
   */
  async triggerAlert(type, value, context, rule) {
    try {
      const alertData = {
        type,
        value,
        threshold: rule.threshold,
        message: rule.message,
        timestamp: new Date().toISOString(),
        ...context
      };

      // 记录告警历史
      this.recordAlert(alertData);

      // 发送Telegram告警
      await this.telegramService.sendAlert(type, rule.message, {
        ...context,
        [type.toLowerCase().split('_')[0]]: value
      });

      logger.warn(`告警触发: ${type} - ${rule.message}`, alertData);
    } catch (error) {
      logger.error('触发告警失败:', error);
    }
  }

  /**
   * 记录告警历史
   * @param {Object} alertData - 告警数据
   */
  recordAlert(alertData) {
    const key = `${alertData.type}_${new Date().toISOString().split('T')[0]}`;
    if (!this.alertHistory.has(key)) {
      this.alertHistory.set(key, []);
    }
    
    const history = this.alertHistory.get(key);
    history.push(alertData);
    
    // 只保留最近100条记录
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
  }

  /**
   * 获取告警历史
   * @param {string} type - 告警类型（可选）
   * @param {number} days - 天数（默认7天）
   */
  getAlertHistory(type = null, days = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const allAlerts = [];
    for (const [key, alerts] of this.alertHistory) {
      const alertDate = new Date(key.split('_')[1]);
      if (alertDate >= cutoffDate) {
        if (!type || key.startsWith(type)) {
          allAlerts.push(...alerts);
        }
      }
    }
    
    return allAlerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  /**
   * 获取告警统计
   */
  getAlertStats() {
    const stats = {
      rules: Object.fromEntries(this.rules),
      totalAlerts: 0,
      alertsByType: {},
      last24Hours: 0
    };

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    for (const [key, alerts] of this.alertHistory) {
      const alertType = key.split('_')[0];
      stats.totalAlerts += alerts.length;
      stats.alertsByType[alertType] = (stats.alertsByType[alertType] || 0) + alerts.length;
      
      // 统计最近24小时的告警
      const recentAlerts = alerts.filter(alert => 
        new Date(alert.timestamp) > yesterday
      );
      stats.last24Hours += recentAlerts.length;
    }

    return stats;
  }

  /**
   * 重置告警计数
   * @param {string} type - 告警类型
   */
  resetAlertCount(type) {
    const rule = this.rules.get(type);
    if (rule) {
      rule.count = 0;
      logger.info(`重置告警计数: ${type}`);
    }
  }

  /**
   * 启用/禁用告警规则
   * @param {string} type - 告警类型
   * @param {boolean} enabled - 是否启用
   */
  setRuleEnabled(type, enabled) {
    const rule = this.rules.get(type);
    if (rule) {
      rule.enabled = enabled;
      logger.info(`${enabled ? '启用' : '禁用'}告警规则: ${type}`);
    }
  }

  /**
   * 更新告警阈值
   * @param {string} type - 告警类型
   * @param {number} threshold - 新阈值
   */
  updateThreshold(type, threshold) {
    const rule = this.rules.get(type);
    if (rule) {
      rule.threshold = threshold;
      logger.info(`更新告警阈值: ${type} = ${threshold}`);
    }
  }
}

module.exports = AlertEngine;
