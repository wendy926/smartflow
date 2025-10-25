/**
 * 持仓时长管理器
 * 根据strategy-v3.md中不同交易对类别的持仓时长建议，动态调整止损止盈策略
 */

const TokenClassifier = require('./token-classifier');
const logger = require('./logger');

/**
 * 持仓时长配置（基于strategy-v3.md建议）
 */
const POSITION_DURATION_CONFIG = {
  // 主流币（高流动性）
  MAINSTREAM: {
    name: '主流币',
    trendMarket: {
      maxDurationHours: 168, // 7天
      minDurationHours: 24,  // 1天
      timeStopMinutes: 60,   // 1小时时间止损
      profitTarget: 4.5,     // 4.5倍ATR止盈（3:1盈亏比）
      stopLoss: 0.5          // 0.5倍ATR止损（超紧止损）
    },
    rangeMarket: {
      maxDurationHours: 12,  // 12小时
      minDurationHours: 1,   // 1小时
      timeStopMinutes: 30,   // 30分钟时间止损
      profitTarget: 4.5,     // 4.5倍ATR止盈（3:1盈亏比）
      stopLoss: 0.5          // 0.5倍ATR止损（超紧止损）
    }
  },

  // 高市值强趋势币
  HIGH_CAP_TREND: {
    name: '高市值强趋势币',
    trendMarket: {
      maxDurationHours: 4,   // 4小时（调整为4小时）
      minDurationHours: 1,   // 1小时
      timeStopMinutes: 120,  // 2小时时间止损
      profitTarget: 6.0,     // 6倍ATR止盈（3:1盈亏比）
      stopLoss: 0.7          // 0.7倍ATR止损（超紧止损）
    },
    rangeMarket: {
      maxDurationHours: 4,   // 4小时
      minDurationHours: 1,   // 1小时
      timeStopMinutes: 45,   // 45分钟时间止损
      profitTarget: 6.0,     // 6倍ATR止盈（3:1盈亏比）
      stopLoss: 0.7          // 0.7倍ATR止损（超紧止损）
    }
  },

  // 热点币（Trending）
  HOT: {
    name: '热点币',
    trendMarket: {
      maxDurationHours: 4,   // 4小时（调整为4小时）
      minDurationHours: 1,   // 1小时
      timeStopMinutes: 180,  // 3小时时间止损
      profitTarget: 7.5,     // 7.5倍ATR止盈（3:1盈亏比）
      stopLoss: 0.8          // 0.8倍ATR止损（超紧止损）
    },
    rangeMarket: {
      maxDurationHours: 4,   // 4小时（调整为4小时）
      minDurationHours: 1,   // 1小时
      timeStopMinutes: 60,   // 1小时时间止损
      profitTarget: 7.5,     // 7.5倍ATR止盈（3:1盈亏比）
      stopLoss: 0.8          // 0.8倍ATR止损（超紧止损）
    }
  },

  // 小币（低流动性）
  SMALL_CAP: {
    name: '小币',
    trendMarket: {
      maxDurationHours: 4,   // 4小时（调整为4小时）
      minDurationHours: 0.5, // 0.5小时
      timeStopMinutes: 30,   // 30分钟时间止损
      profitTarget: 4.5,     // 4.5倍ATR止盈（3:1盈亏比）
      stopLoss: 0.5          // 0.5倍ATR止损（超紧止损）
    },
    rangeMarket: {
      maxDurationHours: 4,   // 4小时（调整为4小时）
      minDurationHours: 0.5, // 0.5小时
      timeStopMinutes: 30,   // 30分钟时间止损
      profitTarget: 4.5,     // 4.5倍ATR止盈（3:1盈亏比）
      stopLoss: 0.5          // 0.5倍ATR止损（超紧止损）
    }
  }
};

class PositionDurationManager {
  constructor() {
    this.activePositions = new Map(); // 跟踪活跃仓位
  }

  /**
   * 获取交易对的持仓时长配置
   * @param {string} symbol - 交易对符号
   * @param {string} marketType - 市场类型 'TREND' 或 'RANGE'
   * @returns {Object} 持仓时长配置
   */
  static getPositionConfig(symbol, marketType) {
    const category = TokenClassifier.classify(symbol);
    const config = POSITION_DURATION_CONFIG[category];

    if (!config) {
      logger.warn(`未找到 ${symbol} 的持仓配置，使用默认配置`);
      return POSITION_DURATION_CONFIG.HOT.rangeMarket; // 默认使用热点币震荡市配置
    }

    const marketConfig = marketType === 'TREND' ? config.trendMarket : config.rangeMarket;

    logger.info(`${symbol} (${config.name}) ${marketType}市配置: 最大持仓${marketConfig.maxDurationHours}小时, 时间止损${marketConfig.timeStopMinutes}分钟`);

    return {
      ...marketConfig,
      category: config.name,
      marketType
    };
  }

  /**
   * 计算基于持仓时长的止损止盈
   * @param {string} symbol - 交易对符号
   * @param {string} signal - 交易信号 'BUY' 或 'SELL'
   * @param {number} entryPrice - 入场价格
   * @param {number} atr - ATR值
   * @param {string} marketType - 市场类型
   * @param {string} confidence - 置信度 'high'/'med'/'low'
   * @returns {Object} 止损止盈参数
   */
  static calculateDurationBasedStopLoss(symbol, signal, entryPrice, atr, marketType, confidence = 'med') {
    const config = this.getPositionConfig(symbol, marketType);

    // 根据置信度调整止损止盈倍数
    const confidenceMultiplier = {
      high: 1.0,
      med: 1.2,
      low: 1.5
    };

    const multiplier = confidenceMultiplier[confidence] || 1.2;

    let stopLoss = 0;
    let takeProfit = 0;

    // 计算止损止盈价格
    if (signal === 'BUY') {
      stopLoss = entryPrice - (atr * config.stopLoss * multiplier);
      takeProfit = entryPrice + (atr * config.profitTarget * multiplier);
    } else if (signal === 'SELL') {
      stopLoss = entryPrice + (atr * config.stopLoss * multiplier);
      takeProfit = entryPrice - (atr * config.profitTarget * multiplier);
    }

    return {
      stopLoss: parseFloat(stopLoss.toFixed(4)),
      takeProfit: parseFloat(takeProfit.toFixed(4)),
      timeStopMinutes: config.timeStopMinutes,
      maxDurationHours: config.maxDurationHours,
      config: config
    };
  }

  /**
   * 检查持仓是否超过最大时长限制
   * @param {Object} trade - 交易对象
   * @returns {Object} 检查结果
   */
  static checkMaxDurationExceeded(trade) {
    try {
      const { symbol, entryTime, marketType } = trade;
      const config = this.getPositionConfig(symbol, marketType || 'RANGE');

      const now = new Date();
      const entryDate = new Date(entryTime);
      const hoursHeld = (now - entryDate) / (1000 * 60 * 60);

      if (hoursHeld >= config.maxDurationHours) {
        logger.warn(`⏰ ${symbol} 持仓时长超限: ${hoursHeld.toFixed(2)}小时 >= ${config.maxDurationHours}小时，建议平仓`);
        return {
          exceeded: true,
          hoursHeld: parseFloat(hoursHeld.toFixed(2)),
          maxHours: config.maxDurationHours,
          action: 'force_close',
          reason: `持仓时长超过${config.maxDurationHours}小时限制`
        };
      }

      // 检查是否接近时长限制（提前1小时警告）
      if (hoursHeld >= config.maxDurationHours - 1) {
        logger.info(`⚠️ ${symbol} 接近持仓时长限制: ${hoursHeld.toFixed(2)}小时/${config.maxDurationHours}小时`);
        return {
          exceeded: false,
          hoursHeld: parseFloat(hoursHeld.toFixed(2)),
          maxHours: config.maxDurationHours,
          warning: true,
          action: 'monitor',
          reason: `接近${config.maxDurationHours}小时持仓限制`
        };
      }

      return {
        exceeded: false,
        hoursHeld: parseFloat(hoursHeld.toFixed(2)),
        maxHours: config.maxDurationHours,
        warning: false
      };
    } catch (error) {
      logger.error(`检查持仓时长失败: ${error.message}`);
      return {
        exceeded: false,
        error: error.message
      };
    }
  }

  /**
   * 检查时间止损
   * @param {Object} trade - 交易对象
   * @param {number} currentPrice - 当前价格
   * @returns {Object} 时间止损结果
   */
  static checkTimeStopLoss(trade, currentPrice) {
    try {
      const { symbol, entryTime, entryPrice, side, marketType } = trade;
      const config = this.getPositionConfig(symbol, marketType || 'RANGE');

      const now = new Date();
      const entryDate = new Date(entryTime);
      const minutesHeld = (now - entryDate) / (1000 * 60);

      // 检查是否超过时间止损
      if (minutesHeld < config.timeStopMinutes) {
        return {
          triggered: false,
          minutesHeld: Math.floor(minutesHeld),
          threshold: config.timeStopMinutes
        };
      }

      // 计算盈亏
      const pnl = side === 'LONG'
        ? currentPrice - entryPrice
        : entryPrice - currentPrice;
      const isProfitable = pnl > 0;

      // 如果超时且未盈利，触发时间止损
      if (!isProfitable) {
        logger.info(`⏰ ${symbol} 时间止损触发: 持仓${Math.floor(minutesHeld)}分钟, 未盈利, 强制平仓`);
        return {
          triggered: true,
          reason: `时间止损 - 持仓${Math.floor(minutesHeld)}分钟未盈利`,
          minutesHeld: Math.floor(minutesHeld),
          threshold: config.timeStopMinutes,
          action: 'close'
        };
      }

      logger.debug(`${symbol} 时间止损检查: 持仓${Math.floor(minutesHeld)}分钟, 盈利中, 继续持有`);
      return {
        triggered: false,
        minutesHeld: Math.floor(minutesHeld),
        threshold: config.timeStopMinutes,
        isProfitable: true
      };
    } catch (error) {
      logger.error(`时间止损检查失败: ${error.message}`);
      return {
        triggered: false,
        error: error.message
      };
    }
  }

  /**
   * 获取所有交易对的持仓时长建议
   * @returns {Object} 所有交易对的持仓时长建议
   */
  static getAllPositionDurations() {
    const result = {};

    Object.keys(POSITION_DURATION_CONFIG).forEach(category => {
      const config = POSITION_DURATION_CONFIG[category];
      result[category] = {
        name: config.name,
        trendMarket: {
          ...config.trendMarket,
          maxDurationDisplay: `${config.trendMarket.maxDurationHours}小时`,
          timeStopDisplay: `${config.trendMarket.timeStopMinutes}分钟`
        },
        rangeMarket: {
          ...config.rangeMarket,
          maxDurationDisplay: `${config.rangeMarket.maxDurationHours}小时`,
          timeStopDisplay: `${config.rangeMarket.timeStopMinutes}分钟`
        }
      };
    });

    return result;
  }

  /**
   * 添加活跃仓位跟踪
   * @param {string} symbol - 交易对
   * @param {Object} tradeData - 交易数据
   */
  addActivePosition(symbol, tradeData) {
    this.activePositions.set(symbol, {
      ...tradeData,
      addedAt: new Date()
    });
  }

  /**
   * 移除活跃仓位跟踪
   * @param {string} symbol - 交易对
   */
  removeActivePosition(symbol) {
    this.activePositions.delete(symbol);
  }

  /**
   * 获取所有活跃仓位
   * @returns {Array} 活跃仓位列表
   */
  getActivePositions() {
    return Array.from(this.activePositions.entries()).map(([symbol, data]) => ({
      symbol,
      ...data
    }));
  }
}

module.exports = PositionDurationManager;
