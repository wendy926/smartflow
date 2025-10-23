/**
 * Telegram告警服务
 */

const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config');

class TelegramAlertService {
  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || config.telegram?.botToken;
    this.chatId = process.env.TELEGRAM_CHAT_ID || config.telegram?.chatId;
    this.enabled = this.botToken && this.chatId;
    this.rateLimit = new Map(); // 防止频繁发送
    this.cooldown = 300000; // 5分钟冷却期
  }

  /**
   * 发送告警消息
   * @param {string} type - 告警类型
   * @param {string} message - 告警消息
   * @param {Object} data - 附加数据
   */
  async sendAlert(type, message, data = {}) {
    if (!this.enabled) {
      logger.warn('Telegram告警未配置，跳过发送');
      return false;
    }

    // 检查冷却期
    const now = Date.now();
    const lastSent = this.rateLimit.get(type);
    if (lastSent && (now - lastSent) < this.cooldown) {
      logger.debug(`告警类型 ${type} 在冷却期内，跳过发送`);
      return false;
    }

    try {
      const alertMessage = this.formatAlertMessage(type, message, data);

      const response = await axios.post(
        `https://api.telegram.org/bot${this.botToken}/sendMessage`,
        {
          chat_id: this.chatId,
          text: alertMessage,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        },
        {
          timeout: 10000
        }
      );

      if (response.data.ok) {
        this.rateLimit.set(type, now);
        logger.info(`Telegram告警发送成功: ${type}`);
        return true;
      } else {
        logger.error('Telegram告警发送失败:', response.data);
        return false;
      }
    } catch (error) {
      logger.error('Telegram告警发送异常:', error.message);
      return false;
    }
  }

  /**
   * 格式化告警消息
   * @param {string} type - 告警类型
   * @param {string} message - 告警消息
   * @param {Object} data - 附加数据
   */
  formatAlertMessage(type, message, data) {
    const timestamp = new Date().toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai'
    });

    let emoji = '⚠️';
    let title = '系统告警';

    switch (type) {
      case 'CPU_HIGH':
        emoji = '🔥';
        title = 'CPU使用率告警';
        break;
      case 'MEMORY_HIGH':
        emoji = '💾';
        title = '内存使用率告警';
        break;
      case 'DISK_HIGH':
        emoji = '💿';
        title = '磁盘使用率告警';
        break;
      case 'API_ERROR':
        emoji = '🚨';
        title = 'API错误告警';
        break;
      case 'STRATEGY_ERROR':
        emoji = '📊';
        title = '策略执行告警';
        break;
      case 'DATABASE_ERROR':
        emoji = '🗄️';
        title = '数据库告警';
        break;
      case 'SYSTEM_HEALTH':
        emoji = '💚';
        title = '系统健康检查';
        break;
      default:
        emoji = '⚠️';
        title = '系统告警';
    }

    let alertText = `${emoji} <b>${title}</b>\n\n`;
    alertText += `📝 <b>消息:</b> ${message}\n`;
    alertText += `🕐 <b>时间:</b> ${timestamp}\n`;

    if (data.cpu) {
      alertText += `🔥 <b>CPU:</b> ${data.cpu.toFixed(2)}%\n`;
    }
    if (data.memory) {
      alertText += `💾 <b>内存:</b> ${data.memory.toFixed(2)}%\n`;
    }
    if (data.disk) {
      alertText += `💿 <b>磁盘:</b> ${data.disk.toFixed(2)}%\n`;
    }
    if (data.symbol) {
      alertText += `📈 <b>交易对:</b> ${data.symbol}\n`;
    }
    if (data.strategy) {
      alertText += `🎯 <b>策略:</b> ${data.strategy}\n`;
    }
    if (data.error) {
      alertText += `❌ <b>错误:</b> ${data.error}\n`;
    }

    alertText += `\n🔗 <b>系统:</b> 交易系统 V2.0`;

    return alertText;
  }

  /**
   * 发送系统健康报告
   * @param {Object} healthData - 健康数据
   */
  async sendHealthReport(healthData) {
    const message = '系统健康检查报告';
    return await this.sendAlert('SYSTEM_HEALTH', message, healthData);
  }

  /**
   * 发送策略执行报告
   * @param {Object} strategyData - 策略数据
   */
  async sendStrategyReport(strategyData) {
    const message = `策略执行完成: ${strategyData.symbol} - ${strategyData.signal}`;
    return await this.sendAlert('STRATEGY_SUCCESS', message, strategyData);
  }

  /**
   * 发送错误告警
   * @param {string} error - 错误信息
   * @param {Object} context - 上下文数据
   */
  async sendErrorAlert(error, context = {}) {
    const message = `系统错误: ${error}`;
    return await this.sendAlert('SYSTEM_ERROR', message, context);
  }

  /**
   * 测试Telegram连接
   */
  async testConnection() {
    if (!this.enabled) {
      return {
        success: false,
        error: 'Telegram未配置'
      };
    }

    try {
      const response = await axios.post(
        `https://api.telegram.org/bot${this.botToken}/getMe`,
        {},
        { timeout: 10000 }
      );

      if (response.data.ok) {
        return {
          success: true,
          bot: response.data.result
        };
      } else {
        return {
          success: false,
          error: 'Bot Token无效'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取告警统计
   */
  getAlertStats() {
    return {
      enabled: this.enabled,
      rateLimit: Object.fromEntries(this.rateLimit),
      cooldown: this.cooldown
    };
  }
}

module.exports = TelegramAlertService;
