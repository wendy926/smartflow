/**
 * 四阶段聪明钱Telegram通知服务
 * 当交易对出现吸筹、拉升、派发、砸盘信号时发送Telegram通知
 * 
 * 设计原则：
 * 1. 单一职责：专注于四阶段信号通知
 * 2. 复用配置：使用现有的交易触发bot配置
 * 3. 防重复通知：避免短时间内重复通知同一信号
 * 4. 可配置性：支持启用/禁用特定阶段通知
 */

const logger = require('../../utils/logger');
const { SmartMoneyStage } = require('./four-phase-detector');

/**
 * 四阶段聪明钱Telegram通知器
 */
class FourPhaseTelegramNotifier {
  constructor(telegramService, database, fourPhaseDetector) {
    this.telegramService = telegramService;
    this.database = database;
    this.fourPhaseDetector = fourPhaseDetector;
    
    // 通知配置
    this.config = {
      enabled: true,
      confidenceThreshold: 0.6, // 置信度阈值
      cooldownMinutes: 60, // 冷却时间（分钟）
      stages: {
        [SmartMoneyStage.ACCUMULATION]: { enabled: true, emoji: '📈' },
        [SmartMoneyStage.MARKUP]: { enabled: true, emoji: '🚀' },
        [SmartMoneyStage.DISTRIBUTION]: { enabled: true, emoji: '⚠️' },
        [SmartMoneyStage.MARKDOWN]: { enabled: true, emoji: '📉' }
      }
    };
    
    // 通知历史记录（防重复）
    this.notificationHistory = new Map();
    
    // 中文阶段名称映射
    this.stageNames = {
      [SmartMoneyStage.ACCUMULATION]: '吸筹',
      [SmartMoneyStage.MARKUP]: '拉升',
      [SmartMoneyStage.DISTRIBUTION]: '派发',
      [SmartMoneyStage.MARKDOWN]: '砸盘',
      [SmartMoneyStage.NEUTRAL]: '中性'
    };
  }

  /**
   * 初始化通知器
   */
  async initialize() {
    try {
      // 从数据库加载配置
      await this.loadConfiguration();
      
      // 启动定期检查
      this.startMonitoring();
      
      logger.info('[四阶段聪明钱通知] 通知器初始化完成');
    } catch (error) {
      logger.error('[四阶段聪明钱通知] 初始化失败:', error);
    }
  }

  /**
   * 从数据库加载配置
   */
  async loadConfiguration() {
    try {
      const [rows] = await this.database.pool.query(`
        SELECT config_key, config_value 
        FROM four_phase_monitor_config 
        WHERE config_key LIKE 'notify_%'
      `);

      for (const row of rows) {
        const key = row.config_key.replace('notify_', '');
        let value = row.config_value;
        
        // 解析JSON配置
        if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
          try {
            value = JSON.parse(value);
          } catch (e) {
            // 保持原值
          }
        }
        
        // 设置配置
        if (key === 'enabled') this.config.enabled = value === 'true' || value === true;
        if (key === 'confidence_threshold') this.config.confidenceThreshold = parseFloat(value);
        if (key === 'cooldown_minutes') this.config.cooldownMinutes = parseInt(value);
        if (key === 'stages') this.config.stages = { ...this.config.stages, ...value };
      }
      
      logger.info('[四阶段聪明钱通知] 配置加载完成');
    } catch (error) {
      logger.warn('[四阶段聪明钱通知] 配置加载失败，使用默认值:', error.message);
    }
  }

  /**
   * 启动监控
   */
  startMonitoring() {
    // 每5分钟检查一次
    this.monitorInterval = setInterval(() => {
      this.checkForSignals();
    }, 5 * 60 * 1000);
    
    logger.info('[四阶段聪明钱通知] 监控已启动，检查间隔：5分钟');
  }

  /**
   * 停止监控
   */
  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    
    logger.info('[四阶段聪明钱通知] 监控已停止');
  }

  /**
   * 检查信号并发送通知
   */
  async checkForSignals() {
    if (!this.config.enabled) {
      return;
    }

    try {
      // 获取所有交易对的四阶段状态
      const states = this.fourPhaseDetector.getAllStates();
      
      for (const [symbol, state] of Object.entries(states)) {
        await this.checkSymbolSignal(symbol, state);
      }
    } catch (error) {
      logger.error('[四阶段聪明钱通知] 检查信号失败:', error);
    }
  }

  /**
   * 检查单个交易对的信号
   */
  async checkSymbolSignal(symbol, state) {
    try {
      const { stage, confidence, since, reasons } = state;
      
      // 检查是否满足通知条件
      if (!this.shouldNotify(symbol, stage, confidence)) {
        return;
      }
      
      // 检查是否在冷却期内
      if (this.isInCooldown(symbol, stage)) {
        return;
      }
      
      // 发送通知
      await this.sendNotification(symbol, stage, confidence, reasons, since);
      
      // 记录通知历史
      this.recordNotification(symbol, stage);
      
    } catch (error) {
      logger.error(`[四阶段聪明钱通知] 检查${symbol}信号失败:`, error);
    }
  }

  /**
   * 判断是否应该发送通知
   */
  shouldNotify(symbol, stage, confidence) {
    // 检查阶段是否启用
    if (!this.config.stages[stage]?.enabled) {
      return false;
    }
    
    // 检查置信度阈值
    if (confidence < this.config.confidenceThreshold) {
      return false;
    }
    
    // 中性阶段不发送通知
    if (stage === SmartMoneyStage.NEUTRAL) {
      return false;
    }
    
    return true;
  }

  /**
   * 检查是否在冷却期内
   */
  isInCooldown(symbol, stage) {
    const key = `${symbol}_${stage}`;
    const lastNotification = this.notificationHistory.get(key);
    
    if (!lastNotification) {
      return false;
    }
    
    const now = Date.now();
    const cooldownMs = this.config.cooldownMinutes * 60 * 1000;
    
    return (now - lastNotification) < cooldownMs;
  }

  /**
   * 发送Telegram通知
   */
  async sendNotification(symbol, stage, confidence, reasons, since) {
    try {
      const stageConfig = this.config.stages[stage];
      const emoji = stageConfig?.emoji || '📊';
      const stageName = this.stageNames[stage];
      const confidencePercent = Math.round(confidence * 100);
      
      // 计算持续时间
      const duration = this.formatDuration(Date.now() - since);
      
      // 格式化触发原因
      const reasonText = reasons && reasons.length > 0 
        ? `\n触发原因: ${reasons.join(', ')}`
        : '';
      
      // 构建消息
      const message = `${emoji} **四阶段聪明钱信号** ${emoji}

**交易对**: ${symbol}
**阶段**: ${stageName}
**置信度**: ${confidencePercent}%
**持续时间**: ${duration}${reasonText}

⏰ ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;
      
      // 发送通知
      await this.telegramService.sendTradingAlert({
        symbol: symbol,
        action: stageName,
        confidence: confidence,
        custom_message: message
      });
      
      logger.info(`[四阶段聪明钱通知] ${symbol} ${stageName}信号通知已发送 (置信度: ${confidencePercent}%)`);
      
    } catch (error) {
      logger.error(`[四阶段聪明钱通知] 发送${symbol}通知失败:`, error);
    }
  }

  /**
   * 记录通知历史
   */
  recordNotification(symbol, stage) {
    const key = `${symbol}_${stage}`;
    this.notificationHistory.set(key, Date.now());
    
    // 清理过期记录（保留7天）
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
    for (const [k, timestamp] of this.notificationHistory.entries()) {
      if (timestamp < cutoff) {
        this.notificationHistory.delete(k);
      }
    }
  }

  /**
   * 格式化持续时间
   */
  formatDuration(ms) {
    const minutes = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}天${hours % 24}小时`;
    if (hours > 0) return `${hours}小时${minutes % 60}分钟`;
    if (minutes > 0) return `${minutes}分钟`;
    return '刚刚';
  }

  /**
   * 手动发送通知（用于测试）
   */
  async sendTestNotification(symbol = 'BTCUSDT', stage = SmartMoneyStage.ACCUMULATION) {
    try {
      await this.sendNotification(
        symbol, 
        stage, 
        0.8, 
        ['测试原因1', '测试原因2'], 
        Date.now() - 30 * 60 * 1000
      );
      
      logger.info(`[四阶段聪明钱通知] 测试通知已发送: ${symbol} ${this.stageNames[stage]}`);
    } catch (error) {
      logger.error('[四阶段聪明钱通知] 发送测试通知失败:', error);
    }
  }

  /**
   * 更新配置
   */
  async updateConfiguration(newConfig) {
    try {
      this.config = { ...this.config, ...newConfig };
      
      // 保存到数据库
      for (const [key, value] of Object.entries(newConfig)) {
        await this.database.pool.query(`
          INSERT INTO four_phase_monitor_config (config_key, config_value)
          VALUES (?, ?)
          ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)
        `, [`notify_${key}`, typeof value === 'object' ? JSON.stringify(value) : String(value)]);
      }
      
      logger.info('[四阶段聪明钱通知] 配置更新完成');
    } catch (error) {
      logger.error('[四阶段聪明钱通知] 配置更新失败:', error);
    }
  }

  /**
   * 获取通知统计
   */
  getNotificationStats() {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;
    
    let todayCount = 0;
    let weekCount = 0;
    
    for (const timestamp of this.notificationHistory.values()) {
      if (now - timestamp < oneDay) todayCount++;
      if (now - timestamp < oneWeek) weekCount++;
    }
    
    return {
      totalNotifications: this.notificationHistory.size,
      todayNotifications: todayCount,
      weekNotifications: weekCount,
      config: this.config
    };
  }

  /**
   * 重置通知历史
   */
  resetNotificationHistory() {
    this.notificationHistory.clear();
    logger.info('[四阶段聪明钱通知] 通知历史已重置');
  }
}

module.exports = FourPhaseTelegramNotifier;
