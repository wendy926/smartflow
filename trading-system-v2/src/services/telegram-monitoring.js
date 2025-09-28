/**
 * Telegram监控服务
 * 支持分别配置交易触发和系统监控的机器人
 */

const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config');

class TelegramMonitoringService {
  constructor() {
    // 交易触发机器人配置
    this.tradingBotToken = process.env.TELEGRAM_TRADING_BOT_TOKEN || config.telegram?.tradingBotToken;
    this.tradingChatId = process.env.TELEGRAM_TRADING_CHAT_ID || config.telegram?.tradingChatId;
    this.tradingEnabled = this.tradingBotToken && this.tradingChatId;

    // 系统监控机器人配置
    this.monitoringBotToken = process.env.TELEGRAM_MONITORING_BOT_TOKEN || config.telegram?.monitoringBotToken;
    this.monitoringChatId = process.env.TELEGRAM_MONITORING_CHAT_ID || config.telegram?.monitoringChatId;
    this.monitoringEnabled = this.monitoringBotToken && this.monitoringChatId;

    // 宏观监控机器人配置
    this.macroBotToken = process.env.TELEGRAM_MACRO_BOT_TOKEN || config.telegram?.macroBotToken;
    this.macroChatId = process.env.TELEGRAM_MACRO_CHAT_ID || config.telegram?.macroChatId;
    this.macroEnabled = this.macroBotToken && this.macroChatId;
    this.macroThresholds = {
      btcThreshold: 10000000,
      ethThreshold: 1000,
      fearGreedLow: 20,
      fearGreedHigh: 80
    };

    // 速率限制
    this.rateLimit = new Map();
    this.cooldown = 300000; // 5分钟冷却期
  }

  /**
   * 发送交易触发通知
   * @param {Object} tradeData - 交易数据
   */
  async sendTradingAlert(tradeData) {
    if (!this.tradingEnabled) {
      logger.warn('交易触发Telegram未配置，跳过发送');
      return false;
    }

    const message = this.formatTradingMessage(tradeData);
    return await this.sendMessage(message, 'trading');
  }

  /**
   * 发送系统监控告警
   * @param {string} type - 告警类型
   * @param {string} message - 告警消息
   * @param {Object} data - 附加数据
   */
  async sendMonitoringAlert(type, message, data = {}) {
    if (!this.monitoringEnabled) {
      logger.warn('系统监控Telegram未配置，跳过发送');
      return false;
    }

    // 检查冷却期
    const now = Date.now();
    const lastSent = this.rateLimit.get(type);
    if (lastSent && (now - lastSent) < this.cooldown) {
      logger.debug(`告警类型 ${type} 在冷却期内，跳过发送`);
      return false;
    }

    const alertMessage = this.formatMonitoringMessage(type, message, data);
    const success = await this.sendMessage(alertMessage, 'monitoring');

    if (success) {
      this.rateLimit.set(type, now);
    }

    return success;
  }

  /**
   * 发送消息
   * @param {string} message - 消息内容
   * @param {string} type - 消息类型：'trading'、'monitoring' 或 'macro'
   */
  async sendMessage(message, type = 'trading') {
    let botToken, chatId;
    
    switch (type) {
      case 'trading':
        botToken = this.tradingBotToken;
        chatId = this.tradingChatId;
        break;
      case 'monitoring':
        botToken = this.monitoringBotToken;
        chatId = this.monitoringChatId;
        break;
      case 'macro':
        botToken = this.macroBotToken;
        chatId = this.macroChatId;
        break;
      default:
        botToken = this.tradingBotToken;
        chatId = this.tradingChatId;
    }

    try {
      const response = await axios.post(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        },
        {
          timeout: 10000
        }
      );

      if (response.data.ok) {
        logger.info(`Telegram ${type} 消息发送成功`);
        return true;
      } else {
        logger.error(`Telegram ${type} 消息发送失败:`, response.data);
        return false;
      }
    } catch (error) {
      logger.error(`Telegram ${type} 消息发送异常:`, error.message);
      return false;
    }
  }

  /**
   * 格式化交易消息
   * @param {Object} tradeData - 交易数据
   */
  formatTradingMessage(tradeData) {
    const timestamp = new Date().toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai'
    });

    const {
      symbol,
      strategy_type,
      direction,
      entry_price,
      stop_loss,
      take_profit,
      leverage,
      margin_required,
      entry_reason,
      status
    } = tradeData;

    let emoji = '📈';
    let title = '交易触发';

    if (status === 'ACTIVE') {
      emoji = '🚀';
      title = '新交易开启';
    } else if (status === 'CLOSED') {
      emoji = '✅';
      title = '交易关闭';
    }

    let message = `${emoji} <b>${title}</b>\n\n`;
    message += `📊 <b>交易对:</b> ${symbol}\n`;
    message += `🎯 <b>策略:</b> ${strategy_type}\n`;
    message += `📈 <b>方向:</b> ${direction}\n`;
    message += `💰 <b>入场价格:</b> ${entry_price}\n`;
    message += `🛑 <b>止损价格:</b> ${stop_loss}\n`;
    message += `🎯 <b>止盈价格:</b> ${take_profit}\n`;
    message += `⚡ <b>杠杆:</b> ${leverage}x\n`;
    message += `💵 <b>保证金:</b> ${margin_required.toFixed(2)}\n`;
    message += `📝 <b>入场原因:</b> ${entry_reason}\n`;
    message += `🕐 <b>时间:</b> ${timestamp}\n`;
    message += `\n🔗 <b>系统:</b> SmartFlow 交易系统 V2.0`;

    return message;
  }

  /**
   * 格式化监控消息
   * @param {string} type - 告警类型
   * @param {string} message - 告警消息
   * @param {Object} data - 附加数据
   */
  formatMonitoringMessage(type, message, data) {
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
      case 'TRADE_RULE_VIOLATION':
        emoji = '🚫';
        title = '交易规则违反';
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
    if (data.rule) {
      alertText += `📋 <b>规则:</b> ${data.rule}\n`;
    }

    alertText += `\n🔗 <b>系统:</b> SmartFlow 交易系统 V2.0`;

    return alertText;
  }

  /**
   * 测试Telegram连接
   * @param {string} type - 测试类型：'trading'、'monitoring' 或 'macro'
   */
  async testConnection(type = 'trading') {
    let botToken, chatId;
    
    switch (type) {
      case 'trading':
        botToken = this.tradingBotToken;
        chatId = this.tradingChatId;
        break;
      case 'monitoring':
        botToken = this.monitoringBotToken;
        chatId = this.monitoringChatId;
        break;
      case 'macro':
        botToken = this.macroBotToken;
        chatId = this.macroChatId;
        break;
      default:
        botToken = this.tradingBotToken;
        chatId = this.tradingChatId;
    }

    if (!botToken || !chatId) {
      return {
        success: false,
        error: `${type} Telegram未配置`
      };
    }

    try {
      const response = await axios.post(
        `https://api.telegram.org/bot${botToken}/getMe`,
        {},
        { timeout: 10000 }
      );

      if (response.data.ok) {
        return {
          success: true,
          bot: response.data.result,
          type: type
        };
      } else {
        return {
          success: false,
          error: `${type} Bot Token无效`
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
   * 获取配置状态
   */
  getStatus() {
    return {
      trading: {
        enabled: this.tradingEnabled,
        botToken: this.tradingBotToken ? '已配置' : '未配置',
        chatId: this.tradingChatId ? '已配置' : '未配置'
      },
      monitoring: {
        enabled: this.monitoringEnabled,
        botToken: this.monitoringBotToken ? '已配置' : '未配置',
        chatId: this.monitoringChatId ? '已配置' : '未配置'
      },
      macro: {
        enabled: this.macroEnabled,
        botToken: this.macroBotToken ? '已配置' : '未配置',
        chatId: this.macroChatId ? '已配置' : '未配置',
        thresholds: this.macroThresholds
      },
      rateLimit: Object.fromEntries(this.rateLimit),
      cooldown: this.cooldown
    };
  }

  /**
   * 更新配置
   * @param {Object} config - 配置对象
   */
  updateConfig(config) {
    if (config.trading) {
      this.tradingBotToken = config.trading.botToken;
      this.tradingChatId = config.trading.chatId;
      this.tradingEnabled = this.tradingBotToken && this.tradingChatId;
    }

    if (config.monitoring) {
      this.monitoringBotToken = config.monitoring.botToken;
      this.monitoringChatId = config.monitoring.chatId;
      this.monitoringEnabled = this.monitoringBotToken && this.monitoringChatId;
    }

    if (config.macro) {
      this.macroBotToken = config.macro.botToken;
      this.macroChatId = config.macro.chatId;
      this.macroEnabled = this.macroBotToken && this.macroChatId;
      
      if (config.macro.thresholds) {
        this.macroThresholds = {
          ...this.macroThresholds,
          ...config.macro.thresholds
        };
      }
    }

    logger.info('Telegram监控配置已更新');
  }
}

module.exports = TelegramMonitoringService;
