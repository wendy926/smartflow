/**
 * 聪明钱V2监控服务
 * 基于候选-确认分层策略的实时聪明钱检测
 * 
 * 设计原则：
 * 1. 单一职责：专注于聪明钱监控
 * 2. 开闭原则：支持功能扩展
 * 3. 依赖倒置：依赖抽象接口
 * 4. 接口隔离：提供简洁的监控接口
 * 5. 高性能：实时数据处理
 * 6. 可观测性：详细日志和事件
 * 7. 高可用：错误恢复和容错
 */

const logger = require('../utils/logger');
const { CandidateConfirmDetector, Phase } = require('./smart-money/candidate-confirm-detector');
const { RealtimeMetricsCollector } = require('./smart-money/realtime-metrics-collector');

/**
 * 聪明钱V2监控服务
 */
class SmartMoneyV2Monitor {
  constructor(database, binanceAPI, telegramService = null) {
    this.database = database;
    this.binanceAPI = binanceAPI;
    this.telegramService = telegramService;

    // 候选-确认检测器
    this.detector = null;

    // 实时指标收集器
    this.collector = null;

    // 运行状态
    this.isRunning = false;

    // 统计信息
    this.stats = {
      totalDetections: 0,
      phaseChanges: 0,
      candidates: 0,
      errors: 0,
      startTime: null
    };
  }

  /**
   * 初始化监控服务
   */
  async initialize() {
    try {
      logger.info('[聪明钱V2监控] 初始化...');

      // 创建检测器
      this.detector = new CandidateConfirmDetector(
        this.database,
        this.binanceAPI,
        {
          debug: process.env.NODE_ENV === 'development'
        }
      );

      // 初始化检测器
      await this.detector.initialize();

      // 绑定检测器事件
      this.detector.on('candidate', (event) => {
        this.handleCandidateEvent(event);
      });

      this.detector.on('phase_change', (event) => {
        this.handlePhaseChangeEvent(event);
      });

      this.detector.on('debug', (event) => {
        if (process.env.NODE_ENV === 'development') {
          logger.debug('[聪明钱V2监控] 调试:', event);
        }
      });

      // 创建指标收集器
      this.collector = new RealtimeMetricsCollector(
        this.database,
        this.binanceAPI,
        this.detector,
        {
          updateIntervalSec: 15,  // 15秒更新一次，降低API调用频率
          klineInterval: '1m'
        }
      );

      logger.info('[聪明钱V2监控] 初始化完成');
    } catch (error) {
      logger.error('[聪明钱V2监控] 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 启动监控服务
   */
  async start() {
    try {
      logger.info('[聪明钱V2监控] 启动...');

      if (this.isRunning) {
        logger.warn('[聪明钱V2监控] 已在运行中');
        return;
      }

      // 启动指标收集器
      await this.collector.start();

      this.isRunning = true;
      this.stats.startTime = Date.now();

      logger.info('[聪明钱V2监控] 已启动');
    } catch (error) {
      logger.error('[聪明钱V2监控] 启动失败:', error);
      throw error;
    }
  }

  /**
   * 停止监控服务
   */
  async stop() {
    try {
      logger.info('[聪明钱V2监控] 停止...');

      if (!this.isRunning) {
        logger.warn('[聪明钱V2监控] 未运行');
        return;
      }

      // 停止指标收集器
      if (this.collector) {
        this.collector.stop();
      }

      this.isRunning = false;

      logger.info('[聪明钱V2监控] 已停止');
    } catch (error) {
      logger.error('[聪明钱V2监控] 停止失败:', error);
      throw error;
    }
  }

  /**
   * 处理候选事件
   */
  handleCandidateEvent(event) {
    try {
      this.stats.candidates++;

      logger.info(`[聪明钱V2监控] ${event.symbol} 候选: ${event.phase} - ${event.reason}`);

      // 可选：发送Telegram通知
      if (this.telegramService) {
        this.sendCandidateNotification(event);
      }
    } catch (error) {
      logger.error('[聪明钱V2监控] 处理候选事件失败:', error);
    }
  }

  /**
   * 处理阶段变化事件
   */
  handlePhaseChangeEvent(event) {
    try {
      this.stats.phaseChanges++;
      this.stats.totalDetections++;

      logger.info(`[聪明钱V2监控] ${event.symbol} 阶段变化: ${event.from} -> ${event.to} (置信度: ${event.confidence.toFixed(2)})`);

      // 只在拉升和砸盘时发送Telegram通知
      if (this.telegramService && this.shouldNotifyPhase(event.to)) {
        this.sendPhaseChangeNotification(event);
      }
    } catch (error) {
      logger.error('[聪明钱V2监控] 处理阶段变化事件失败:', error);
    }
  }

  /**
   * 判断是否应该发送通知
   * 只在拉升和砸盘时发送通知
   */
  shouldNotifyPhase(phase) {
    return phase === Phase.MARKUP || phase === Phase.MARKDOWN;
  }

  /**
   * 发送候选通知
   */
  async sendCandidateNotification(event) {
    try {
      const phaseName = this.getPhaseName(event.phase);
      const message = `
🔍 **聪明钱候选信号**

交易对: ${event.symbol}
阶段: ${phaseName}
原因: ${event.reason}
价格: $${event.metrics.price.toFixed(2)}
时间: ${new Date(event.since).toLocaleString('zh-CN')}
      `.trim();

      await this.telegramService.sendMessage(message);
    } catch (error) {
      logger.error('[聪明钱V2监控] 发送候选通知失败:', error);
    }
  }

  /**
   * 发送阶段变化通知
   */
  async sendPhaseChangeNotification(event) {
    try {
      const phaseName = this.getPhaseName(event.to);
      const emoji = this.getPhaseEmoji(event.to);
      const message = `
${emoji} **聪明钱阶段变化**

交易对: ${event.symbol}
阶段: ${event.from} → ${event.to}
动作: ${phaseName}
置信度: ${(event.confidence * 100).toFixed(1)}%
原因: ${event.reason}
价格: $${event.metrics.price.toFixed(2)}
时间: ${new Date(event.time).toLocaleString('zh-CN')}
      `.trim();

      // 使用交易触发bot配置
      await this.telegramService.sendTradingAlert({
        symbol: event.symbol,
        action: phaseName,
        confidence: event.confidence,
        custom_message: message
      });

      logger.info(`[聪明钱V2监控] ${event.symbol} ${phaseName}通知已发送 (置信度: ${(event.confidence * 100).toFixed(1)}%)`);
    } catch (error) {
      logger.error('[聪明钱V2监控] 发送阶段变化通知失败:', error);
    }
  }

  /**
   * 获取阶段名称
   */
  getPhaseName(phase) {
    const mapping = {
      [Phase.NONE]: '无动作',
      [Phase.ACCUMULATE]: '吸筹',
      [Phase.MARKUP]: '拉升',
      [Phase.DISTRIBUTION]: '派发',
      [Phase.MARKDOWN]: '砸盘'
    };

    return mapping[phase] || phase;
  }

  /**
   * 获取阶段Emoji
   */
  getPhaseEmoji(phase) {
    const mapping = {
      [Phase.NONE]: '⚪',
      [Phase.ACCUMULATE]: '📈',
      [Phase.MARKUP]: '🚀',
      [Phase.DISTRIBUTION]: '⚠️',
      [Phase.MARKDOWN]: '📉'
    };

    return mapping[phase] || '⚪';
  }

  /**
   * 获取当前状态
   */
  getState(symbol) {
    if (!this.detector) {
      return null;
    }

    return this.detector.getState(symbol);
  }

  /**
   * 获取所有交易对状态
   */
  getAllStates() {
    if (!this.detector) {
      return {};
    }

    return this.detector.getAllStates();
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const uptime = this.stats.startTime ? Date.now() - this.stats.startTime : 0;

    return {
      ...this.stats,
      uptime: uptime,
      uptimeHours: (uptime / (1000 * 60 * 60)).toFixed(2),
      isRunning: this.isRunning
    };
  }

  /**
   * 手动触发检测
   */
  async triggerDetection(symbol) {
    try {
      logger.info(`[聪明钱V2监控] 手动触发${symbol}检测`);

      if (!this.collector) {
        throw new Error('指标收集器未初始化');
      }

      await this.collector.updateSymbol(symbol);

      return this.getState(symbol);
    } catch (error) {
      logger.error(`[聪明钱V2监控] 手动触发${symbol}检测失败:`, error);
      throw error;
    }
  }
}

module.exports = {
  SmartMoneyV2Monitor
};

