/**
 * 聪明钱实时监控服务
 * 当置信度超过75%时发送Telegram通知
 * 复用交易触发的Telegram bot配置
 */

const logger = require('../utils/logger');

class SmartMoneyMonitor {
  constructor(database, smartMoneyDetector, telegramService) {
    this.database = database;
    this.smartMoneyDetector = smartMoneyDetector;
    this.telegramService = telegramService;
    
    // 监控配置
    this.config = {
      confidenceThreshold: 0.75, // 置信度阈值
      checkInterval: 60000, // 检查间隔（1分钟）
      cooldownPeriod: 300000, // 冷却期（5分钟）- 避免重复通知
      maxNotificationsPerHour: 10 // 每小时最大通知数
    };
    
    // 状态管理
    this.isRunning = false;
    this.checkInterval = null;
    this.notificationHistory = new Map(); // 记录通知历史，避免重复
    this.hourlyNotificationCount = 0;
    this.lastHourReset = Date.now();
    
    logger.info('[聪明钱监控] 初始化完成', {
      confidenceThreshold: this.config.confidenceThreshold,
      checkInterval: this.config.checkInterval
    });
  }
  
  /**
   * 启动实时监控
   */
  async start() {
    if (this.isRunning) {
      logger.warn('[聪明钱监控] 已在运行中');
      return;
    }
    
    try {
      logger.info('[聪明钱监控] 启动实时监控...');
      
      // 立即执行一次检查
      await this.checkSmartMoneySignals();
      
      // 设置定时检查
      this.checkInterval = setInterval(async () => {
        try {
          await this.checkSmartMoneySignals();
        } catch (error) {
          logger.error('[聪明钱监控] 定时检查失败:', error);
        }
      }, this.config.checkInterval);
      
      this.isRunning = true;
      logger.info('[聪明钱监控] ✅ 实时监控已启动');
      
    } catch (error) {
      logger.error('[聪明钱监控] ❌ 启动失败:', error);
      throw error;
    }
  }
  
  /**
   * 停止实时监控
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }
    
    try {
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }
      
      this.isRunning = false;
      logger.info('[聪明钱监控] 已停止');
      
    } catch (error) {
      logger.error('[聪明钱监控] 停止失败:', error);
    }
  }
  
  /**
   * 检查聪明钱信号
   */
  async checkSmartMoneySignals() {
    try {
      // 检查是否在冷却期内
      if (!this._shouldCheck()) {
        return;
      }
      
      // 获取监控列表
      const watchList = await this.smartMoneyDetector.loadWatchList();
      
      if (!watchList || watchList.length === 0) {
        logger.debug('[聪明钱监控] 监控列表为空，跳过检查');
        return;
      }
      
      logger.debug(`[聪明钱监控] 开始检查 ${watchList.length} 个交易对`);
      
      // 批量检测聪明钱信号
      const results = await this.smartMoneyDetector.detectBatchV2(watchList);
      
      // 更新最后检查时间
      this.lastCheckTime = new Date().toISOString();
      
      // 检查高置信度信号
      for (const result of results) {
        await this._processSmartMoneyResult(result);
      }
      
      // 重置每小时通知计数
      this._resetHourlyCountIfNeeded();
      
    } catch (error) {
      logger.error('[聪明钱监控] 检查信号失败:', error);
    }
  }
  
  /**
   * 处理聪明钱检测结果
   * @private
   */
  async _processSmartMoneyResult(result) {
    try {
      const { symbol, confidence, action, isSmartMoney, isTrap, source } = result;
      
      // 检查置信度阈值
      if (confidence < this.config.confidenceThreshold) {
        return;
      }
      
      // 检查是否应该发送通知
      if (!this._shouldNotify(symbol, result)) {
        return;
      }
      
      // 格式化并发送通知
      const message = this._formatSmartMoneyMessage(result);
      await this._sendTelegramNotification(message, result);
      
      // 记录通知历史
      this._recordNotification(symbol, result);
      
      logger.info('[聪明钱监控] ✅ 发送高置信度信号通知', {
        symbol,
        confidence: (confidence * 100).toFixed(1) + '%',
        action,
        isSmartMoney,
        isTrap
      });
      
    } catch (error) {
      logger.error('[聪明钱监控] 处理结果失败:', error);
    }
  }
  
  /**
   * 检查是否应该进行检查
   * @private
   */
  _shouldCheck() {
    // 检查每小时通知限制
    if (this.hourlyNotificationCount >= this.config.maxNotificationsPerHour) {
      logger.debug('[聪明钱监控] 达到每小时通知限制，跳过检查');
      return false;
    }
    
    return true;
  }
  
  /**
   * 检查是否应该发送通知
   * @private
   */
  _shouldNotify(symbol, result) {
    const { confidence, action, isSmartMoney, isTrap } = result;
    const now = Date.now();
    
    // 1. 置信度检查
    if (confidence < this.config.confidenceThreshold) {
      return false;
    }
    
    // 2. 冷却期检查
    const notificationKey = `${symbol}_${action}_${isSmartMoney ? 'smart' : 'normal'}`;
    const lastNotification = this.notificationHistory.get(notificationKey);
    
    if (lastNotification && (now - lastNotification.timestamp) < this.config.cooldownPeriod) {
      logger.debug(`[聪明钱监控] ${symbol} 在冷却期内，跳过通知`);
      return false;
    }
    
    // 3. 优先通知聪明钱建仓和陷阱信号
    if (!isSmartMoney && !isTrap && action === 'UNKNOWN') {
      return false;
    }
    
    // 4. 每小时通知限制检查
    if (this.hourlyNotificationCount >= this.config.maxNotificationsPerHour) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 格式化聪明钱通知消息
   * @private
   */
  _formatSmartMoneyMessage(result) {
    const { 
      symbol, 
      confidence, 
      action, 
      isSmartMoney, 
      isTrap, 
      source,
      largeOrder,
      trap,
      swan,
      reason
    } = result;
    
    const confidencePercent = (confidence * 100).toFixed(1);
    const timestamp = new Date().toLocaleString('zh-CN');
    
    // 构建消息
    let message = `🎯 **聪明钱监控警报**\n\n`;
    message += `📊 **交易对**: ${symbol}\n`;
    message += `🎯 **庄家动作**: ${this._getActionEmoji(action)} ${this._getActionName(action)}\n`;
    message += `📈 **置信度**: ${confidencePercent}%\n`;
    message += `⏰ **检测时间**: ${timestamp}\n\n`;
    
    // 添加特殊标识
    if (isSmartMoney) {
      message += `💰 **聪明钱建仓信号**\n`;
    }
    
    if (isTrap) {
      message += `⚠️ **陷阱信号**: ${trap?.type || 'Unknown'}\n`;
    }
    
    if (swan && swan.detected) {
      message += `🦢 **黑天鹅信号**: ${swan.level}\n`;
    }
    
    if (largeOrder && largeOrder.trackedEntriesCount > 0) {
      message += `📋 **大额挂单**: ${largeOrder.trackedEntriesCount}个\n`;
    }
    
    // 添加原因说明
    if (reason) {
      message += `\n💡 **分析依据**: ${reason}`;
    }
    
    return message;
  }
  
  /**
   * 获取动作对应的表情符号
   * @private
   */
  _getActionEmoji(action) {
    const emojiMap = {
      'ACCUMULATE': '📈', // 吸筹
      'MARKUP': '🚀',     // 拉升
      'DISTRIBUTION': '📉', // 派发
      'MARKDOWN': '💥',   // 砸盘
      'UNKNOWN': '❓'      // 未知
    };
    return emojiMap[action] || '❓';
  }
  
  /**
   * 获取动作的中文名称
   * @private
   */
  _getActionName(action) {
    const nameMap = {
      'ACCUMULATE': '吸筹',
      'MARKUP': '拉升', 
      'DISTRIBUTION': '派发',
      'MARKDOWN': '砸盘',
      'UNKNOWN': '无动作'
    };
    return nameMap[action] || '未知';
  }
  
  /**
   * 发送Telegram通知
   * @private
   */
  async _sendTelegramNotification(message, result) {
    try {
      // 复用交易触发的Telegram配置
      const success = await this.telegramService.sendTradingAlert({
        symbol: result.symbol,
        strategy_type: 'SmartMoney',
        direction: result.action,
        entry_price: 0, // 聪明钱监控没有具体价格
        id: `sm_${Date.now()}`,
        custom_message: message // 使用自定义消息
      });
      
      if (success) {
        this.hourlyNotificationCount++;
        logger.info('[聪明钱监控] Telegram通知发送成功', {
          symbol: result.symbol,
          confidence: result.confidence
        });
      } else {
        logger.warn('[聪明钱监控] Telegram通知发送失败');
      }
      
    } catch (error) {
      logger.error('[聪明钱监控] 发送Telegram通知异常:', error);
    }
  }
  
  /**
   * 记录通知历史
   * @private
   */
  _recordNotification(symbol, result) {
    const notificationKey = `${symbol}_${result.action}_${result.isSmartMoney ? 'smart' : 'normal'}`;
    this.notificationHistory.set(notificationKey, {
      timestamp: Date.now(),
      confidence: result.confidence,
      action: result.action,
      isSmartMoney: result.isSmartMoney,
      isTrap: result.isTrap
    });
    
    // 清理过期的通知历史（保留1小时）
    const oneHourAgo = Date.now() - 3600000;
    for (const [key, value] of this.notificationHistory.entries()) {
      if (value.timestamp < oneHourAgo) {
        this.notificationHistory.delete(key);
      }
    }
  }
  
  /**
   * 重置每小时通知计数
   * @private
   */
  _resetHourlyCountIfNeeded() {
    const now = Date.now();
    const oneHour = 3600000;
    
    if (now - this.lastHourReset >= oneHour) {
      this.hourlyNotificationCount = 0;
      this.lastHourReset = now;
      logger.debug('[聪明钱监控] 重置每小时通知计数');
    }
  }
  
  /**
   * 获取监控状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      confidenceThreshold: this.config.confidenceThreshold,
      checkInterval: this.config.checkInterval,
      cooldownPeriod: this.config.cooldownPeriod,
      hourlyNotificationCount: this.hourlyNotificationCount,
      maxNotificationsPerHour: this.config.maxNotificationsPerHour,
      notificationHistorySize: this.notificationHistory.size,
      telegramEnabled: this.telegramService.tradingEnabled,
      lastCheckTime: this.lastCheckTime || null
    };
  }
  
  /**
   * 更新配置
   */
  updateConfig(newConfig) {
    if (newConfig.confidenceThreshold !== undefined) {
      this.config.confidenceThreshold = newConfig.confidenceThreshold;
    }
    if (newConfig.checkInterval !== undefined) {
      this.config.checkInterval = newConfig.checkInterval;
    }
    if (newConfig.cooldownPeriod !== undefined) {
      this.config.cooldownPeriod = newConfig.cooldownPeriod;
    }
    if (newConfig.maxNotificationsPerHour !== undefined) {
      this.config.maxNotificationsPerHour = newConfig.maxNotificationsPerHour;
    }
    
    logger.info('[聪明钱监控] 配置已更新', this.config);
  }
}

module.exports = SmartMoneyMonitor;
