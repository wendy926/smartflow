/**
 * Telegram监控服务
 * 支持分别配置交易触发和系统监控的机器人
 */

const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config');
const TelegramConfigOps = require('../database/telegram-config-ops');

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

    // 宏观监控机器人配置（已废弃）
    this.macroBotToken = null;
    this.macroChatId = null;
    this.macroEnabled = false;

    // 速率限制
    this.rateLimit = new Map();
    this.cooldown = 300000; // 5分钟冷却期

    // 从数据库加载配置
    this.loadConfigFromDatabase();
  }

  /**
   * 从数据库加载配置
   */
  async loadConfigFromDatabase() {
    try {
      const result = await TelegramConfigOps.getAllConfigs();

      if (result.success && result.data.length > 0) {
        result.data.forEach(cfg => {
          if (cfg.config_type === 'trading') {
            this.tradingBotToken = cfg.bot_token;
            this.tradingChatId = cfg.chat_id;
            this.tradingEnabled = cfg.enabled;
            logger.info('已从数据库加载交易触发Telegram配置');
          } else if (cfg.config_type === 'monitoring') {
            this.monitoringBotToken = cfg.bot_token;
            this.monitoringChatId = cfg.chat_id;
            this.monitoringEnabled = cfg.enabled;
            logger.info('已从数据库加载系统监控Telegram配置');
          }
        });
      }
    } catch (error) {
      logger.warn(`从数据库加载Telegram配置失败，使用环境变量: ${error.message}`);
    }
  }

  /**
   * 发送交易触发通知
   * @param {Object} tradeData - 交易数据
   */
  async sendTradingAlert(tradeData) {
    logger.info('[Telegram交易] 收到发送请求', {
      tradingEnabled: this.tradingEnabled,
      hasBotToken: !!this.tradingBotToken,
      hasChatId: !!this.tradingChatId,
      tradeSymbol: tradeData.symbol,
      tradeId: tradeData.id
    });

    if (!this.tradingEnabled) {
      logger.warn('[Telegram交易] 交易触发Telegram未启用，跳过发送', {
        botToken: this.tradingBotToken ? `已设置(${this.tradingBotToken.substring(0, 10)}...)` : '未设置',
        chatId: this.tradingChatId ? `已设置(${this.tradingChatId})` : '未设置'
      });
      return false;
    }

    try {
      logger.debug('[Telegram交易] 开始格式化消息', {
        tradeData: {
          symbol: tradeData.symbol,
          strategy_type: tradeData.strategy_type || tradeData.strategy_name,
          direction: tradeData.direction || tradeData.trade_type,
          entry_price: tradeData.entry_price,
          id: tradeData.id
        }
      });

      const message = this.formatTradingMessage(tradeData);

      logger.debug('[Telegram交易] 消息格式化完成', {
        messageLength: message.length,
        messagePreview: message.substring(0, 100) + '...'
      });

      const result = await this.sendMessage(message, 'trading');

      if (result) {
        logger.info('[Telegram交易] ✅ 消息发送成功', {
          tradeSymbol: tradeData.symbol,
          tradeId: tradeData.id
        });
      } else {
        logger.warn('[Telegram交易] ⚠️ 消息发送失败（返回false）', {
          tradeSymbol: tradeData.symbol,
          tradeId: tradeData.id
        });
      }

      return result;
    } catch (error) {
      logger.error('[Telegram交易] ❌ 发送消息异常', {
        error: error.message,
        stack: error.stack,
        tradeSymbol: tradeData.symbol,
        tradeId: tradeData.id
      });
      return false;
    }
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

    logger.debug(`[Telegram发送] 准备发送${type}消息`, {
      type,
      hasBotToken: !!botToken,
      botTokenPrefix: botToken ? botToken.substring(0, 10) + '...' : 'null',
      chatId: chatId || 'null',
      messageLength: message.length
    });

    if (!botToken || !chatId) {
      logger.error(`[Telegram发送] ❌ Bot配置不完整`, {
        type,
        botToken: botToken ? '已设置' : '未设置',
        chatId: chatId ? '已设置' : '未设置'
      });
      return false;
    }

    try {
      const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const payload = {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      };

      logger.debug(`[Telegram发送] 调用Telegram API`, {
        type,
        url: `https://api.telegram.org/bot${botToken.substring(0, 10)}...`,
        chatId,
        textLength: message.length
      });

      const response = await axios.post(apiUrl, payload, { timeout: 10000 });

      if (response.data.ok) {
        logger.info(`[Telegram发送] ✅ ${type} 消息发送成功`, {
          messageId: response.data.result.message_id,
          chatId: response.data.result.chat.id
        });
        return true;
      } else {
        logger.error(`[Telegram发送] ❌ ${type} 消息发送失败（API返回非ok）`, {
          ok: response.data.ok,
          error_code: response.data.error_code,
          description: response.data.description
        });
        return false;
      }
    } catch (error) {
      logger.error(`[Telegram发送] ❌ ${type} 消息发送异常`, {
        error: error.message,
        errorName: error.name,
        errorCode: error.code,
        responseStatus: error.response?.status,
        responseData: error.response?.data,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * 发送AI信号通知
   * @param {Object} aiSignalData - AI信号数据
   * @returns {Promise<boolean>}
   */
  async sendAISignalAlert(aiSignalData) {
    logger.info('[Telegram AI信号] 收到发送请求', {
      tradingEnabled: this.tradingEnabled,
      symbol: aiSignalData.symbol,
      signal: aiSignalData.signalRecommendation
    });

    if (!this.tradingEnabled) {
      logger.warn('[Telegram AI信号] 交易触发Telegram未启用，跳过发送');
      return false;
    }

    try {
      const message = this.formatAISignalMessage(aiSignalData);
      const result = await this.sendMessage(message, 'trading');
      
      if (result) {
        logger.info('[Telegram AI信号] ✅ 消息发送成功', {
          symbol: aiSignalData.symbol,
          signal: aiSignalData.signalRecommendation
        });
      } else {
        logger.warn('[Telegram AI信号] ⚠️ 消息发送失败', {
          symbol: aiSignalData.symbol
        });
      }

      return result;
    } catch (error) {
      logger.error('[Telegram AI信号] ❌ 发送消息异常', {
        error: error.message,
        symbol: aiSignalData.symbol
      });
      return false;
    }
  }

  /**
   * 格式化AI信号消息
   * @param {Object} aiSignalData - AI信号数据
   * @returns {string}
   */
  formatAISignalMessage(aiSignalData) {
    const {
      symbol,
      signalRecommendation,
      overallScore,
      currentPrice,
      shortTermTrend,
      midTermTrend,
      timestamp
    } = aiSignalData;

    const signalEmoji = {
      'strongBuy': '🟢',
      'caution': '🔴'
    };

    const signalText = {
      'strongBuy': '强烈看多',
      'caution': '谨慎'
    };

    const emoji = signalEmoji[signalRecommendation] || '⚠️';
    const text = signalText[signalRecommendation] || signalRecommendation;

    let message = `${emoji} <b>AI信号通知</b>\n\n`;
    message += `📊 <b>交易对</b>: ${symbol}\n`;
    message += `🎯 <b>信号</b>: ${text}\n`;
    message += `📈 <b>评分</b>: ${overallScore?.totalScore || 'N/A'}/100\n`;
    message += `💰 <b>当前价格</b>: $${currentPrice || 'N/A'}\n\n`;

    // 短期趋势
    if (shortTermTrend) {
      const directionEmoji = {
        'up': '↗️',
        'down': '↘️',
        'sideways': '↔️'
      };
      message += `📊 <b>短期趋势</b>: ${directionEmoji[shortTermTrend.direction] || ''} `;
      message += `置信度 ${shortTermTrend.confidence}%\n`;
      if (shortTermTrend.priceRange && shortTermTrend.priceRange.length === 2) {
        message += `   区间: $${shortTermTrend.priceRange[0].toFixed(2)} - $${shortTermTrend.priceRange[1].toFixed(2)}\n`;
      }
    }

    // 中期趋势
    if (midTermTrend) {
      const directionEmoji = {
        'up': '↗️',
        'down': '↘️',
        'sideways': '↔️'
      };
      message += `📊 <b>中期趋势</b>: ${directionEmoji[midTermTrend.direction] || ''} `;
      message += `置信度 ${midTermTrend.confidence}%\n`;
      if (midTermTrend.priceRange && midTermTrend.priceRange.length === 2) {
        message += `   区间: $${midTermTrend.priceRange[0].toFixed(2)} - $${midTermTrend.priceRange[1].toFixed(2)}\n`;
      }
    }

    message += `\n⏰ <b>时间</b>: ${new Date(timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n`;

    // 添加操作建议
    if (signalRecommendation === 'strongBuy') {
      message += `\n💡 <b>建议</b>: 多因子共振，可考虑积极入场（仓位20-30%）`;
    } else if (signalRecommendation === 'caution') {
      message += `\n⚠️ <b>警告</b>: 趋势转弱，建议避免入场或减仓`;
    }

    return message;
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
  /**
   * 更新配置并保存到数据库
   */
  async updateConfig(config) {
    try {
      if (config.trading) {
        this.tradingBotToken = config.trading.botToken;
        this.tradingChatId = config.trading.chatId;
        this.tradingEnabled = this.tradingBotToken && this.tradingChatId;

        // 保存到数据库
        await TelegramConfigOps.saveConfig('trading', this.tradingBotToken, this.tradingChatId);
      }

      if (config.monitoring) {
        this.monitoringBotToken = config.monitoring.botToken;
        this.monitoringChatId = config.monitoring.chatId;
        this.monitoringEnabled = this.monitoringBotToken && this.monitoringChatId;

        // 保存到数据库
        await TelegramConfigOps.saveConfig('monitoring', this.monitoringBotToken, this.monitoringChatId);
      }

      // 宏观监控已废弃，不再支持
      if (config.macro) {
        logger.warn('宏观监控Telegram配置已废弃，请使用CoinGlass外部链接');
      }

      logger.info('Telegram监控配置已更新并保存到数据库');
    } catch (error) {
      logger.error(`更新Telegram配置失败: ${error.message}`);
      throw error;
    }
  }
}

module.exports = TelegramMonitoringService;
