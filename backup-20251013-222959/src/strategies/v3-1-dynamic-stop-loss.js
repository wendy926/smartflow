/**
 * V3.1策略优化 - 动态止损策略模块
 * 实现基于strategy-v3.1.md的dynamicStopLoss功能
 * 
 * @module v3-1-dynamic-stop-loss
 */

const logger = require('../utils/logger');

/**
 * 动态止损管理器
 * 根据置信度、趋势确认和持仓时间动态调整止损
 */
class DynamicStopLossManager {
  constructor(params = {}) {
    // 默认参数（可通过数据库配置覆盖）
    this.params = {
      // 初始止损ATR倍数（按置信度）
      kEntryHigh: params.kEntryHigh || 1.5,
      kEntryMed: params.kEntryMed || 2.0,
      kEntryLow: params.kEntryLow || 2.6,
      
      // 趋势确认后扩大止损
      kHold: params.kHold || 2.8,
      
      // 时间止损
      timeStopMinutes: params.timeStopMinutes || 60,
      
      // 追踪止盈参数
      profitTrigger: params.profitTrigger || 1.0, // 盈利达到1x止损距离时启用
      trailStep: params.trailStep || 0.5,         // 追踪步长(ATR倍数)
      
      // 止盈因子
      tpFactor: params.tpFactor || 1.3
    };
  }

  /**
   * 计算初始止损和止盈
   * @param {number} entryPrice - 入场价格
   * @param {string} side - 方向 'LONG' 或 'SHORT'
   * @param {number} atr15 - 15M ATR值
   * @param {string} confidence - 置信度 'high' / 'med' / 'low'
   * @returns {Object} 止损止盈参数
   */
  calculateInitial(entryPrice, side, atr15, confidence) {
    try {
      // 根据置信度选择ATR倍数
      let kEntry;
      if (confidence === 'high') {
        kEntry = this.params.kEntryHigh;
      } else if (confidence === 'med') {
        kEntry = this.params.kEntryMed;
      } else {
        kEntry = this.params.kEntryLow;
      }

      // 计算初始止损
      let initialSL, tp;
      if (side === 'LONG') {
        initialSL = entryPrice - (atr15 * kEntry);
        tp = entryPrice + (atr15 * kEntry * this.params.tpFactor);
      } else if (side === 'SHORT') {
        initialSL = entryPrice + (atr15 * kEntry);
        tp = entryPrice - (atr15 * kEntry * this.params.tpFactor);
      } else {
        throw new Error(`Invalid side: ${side}`);
      }

      // 计算追踪止盈参数
      const trailStep = atr15 * this.params.trailStep;
      const stopDistance = Math.abs(entryPrice - initialSL);
      const profitTriggerPrice = side === 'LONG' 
        ? entryPrice + (stopDistance * this.params.profitTrigger)
        : entryPrice - (stopDistance * this.params.profitTrigger);

      const result = {
        initialSL: parseFloat(initialSL.toFixed(8)),
        tp: parseFloat(tp.toFixed(8)),
        kEntry,
        trailStep: parseFloat(trailStep.toFixed(8)),
        profitTriggerPrice: parseFloat(profitTriggerPrice.toFixed(8)),
        stopDistance,
        timeStopMinutes: this.params.timeStopMinutes,
        timestamp: new Date()
      };

      logger.info(`初始止损计算: 置信度=${confidence}, ATR倍数=${kEntry}, 止损=${initialSL.toFixed(4)}, 止盈=${tp.toFixed(4)}`);
      
      return result;
    } catch (error) {
      logger.error(`初始止损计算失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 根据趋势确认调整止损
   * @param {Object} trade - 交易对象
   * @param {Object} trendConfirm - 趋势确认信息
   * @param {number} currentATR - 当前ATR
   * @returns {Object} 调整后的止损参数
   */
  adjustForTrendConfirm(trade, trendConfirm, currentATR) {
    try {
      const { entryPrice, side, initialSL } = trade;
      
      // 检查是否需要扩大止损
      if (!this._shouldExpandStop(trendConfirm)) {
        return {
          adjusted: false,
          reason: 'Trend not strong enough to expand stop',
          currentSL: initialSL
        };
      }

      // 扩大止损到kHold倍ATR或移至breakeven
      let newSL;
      const breakeven = entryPrice; // 简化：保本点即入场价
      
      if (side === 'LONG') {
        // 多头：止损上移，但不超过breakeven
        const expandedSL = entryPrice - (currentATR * this.params.kHold);
        newSL = Math.max(expandedSL, initialSL);
        newSL = Math.min(newSL, breakeven); // 不超过保本点
      } else {
        // 空头：止损下移，但不超过breakeven
        const expandedSL = entryPrice + (currentATR * this.params.kHold);
        newSL = Math.min(expandedSL, initialSL);
        newSL = Math.max(newSL, breakeven); // 不超过保本点
      }

      logger.info(`趋势确认调整: 原止损=${initialSL.toFixed(4)}, 新止损=${newSL.toFixed(4)}, ATR倍数=${this.params.kHold}`);

      return {
        adjusted: true,
        reason: 'Trend confirmed - stop expanded/moved to breakeven',
        currentSL: parseFloat(newSL.toFixed(8)),
        stopType: 'dynamic',
        kMultiplier: this.params.kHold,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error(`趋势确认止损调整失败: ${error.message}`);
      return {
        adjusted: false,
        reason: `Error: ${error.message}`,
        currentSL: trade.initialSL
      };
    }
  }

  /**
   * 检查时间止损
   * @param {Object} trade - 交易对象
   * @param {number} currentPrice - 当前价格
   * @returns {Object} 时间止损结果
   */
  checkTimeStop(trade, currentPrice) {
    try {
      const { entryTime, entryPrice, side } = trade;
      const now = new Date();
      const entryDate = new Date(entryTime);
      const minutesHeld = (now - entryDate) / (1000 * 60);

      // 检查是否超过时间止损
      if (minutesHeld < this.params.timeStopMinutes) {
        return {
          triggered: false,
          minutesHeld: Math.floor(minutesHeld),
          threshold: this.params.timeStopMinutes
        };
      }

      // 计算盈亏
      const pnl = side === 'LONG' 
        ? currentPrice - entryPrice 
        : entryPrice - currentPrice;
      const isProfitable = pnl > 0;

      // 如果超时且未盈利，触发时间止损
      if (!isProfitable) {
        logger.info(`⏰ 时间止损触发: 持仓${Math.floor(minutesHeld)}分钟, 未盈利, 强制平仓`);
        return {
          triggered: true,
          reason: 'Time stop - unprofitable after time limit',
          minutesHeld: Math.floor(minutesHeld),
          threshold: this.params.timeStopMinutes,
          action: 'close'
        };
      }

      logger.debug(`时间止损检查: 持仓${Math.floor(minutesHeld)}分钟, 盈利中, 继续持有`);
      return {
        triggered: false,
        minutesHeld: Math.floor(minutesHeld),
        threshold: this.params.timeStopMinutes,
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
   * 更新追踪止损
   * @param {Object} trade - 交易对象
   * @param {number} currentPrice - 当前价格
   * @param {Object} stopParams - 止损参数
   * @returns {Object} 追踪止损结果
   */
  updateTrailingStop(trade, currentPrice, stopParams) {
    try {
      const { entryPrice, side, initialSL } = trade;
      const { profitTriggerPrice, trailStep, trailingActivated } = stopParams;
      
      let currentSL = stopParams.currentSL || initialSL;

      // 检查是否达到盈利触发点
      const profitTriggered = this._isProfitTriggered(side, currentPrice, profitTriggerPrice);
      
      if (!profitTriggered && !trailingActivated) {
        return {
          updated: false,
          reason: 'Profit trigger not reached',
          currentSL,
          trailingActivated: false
        };
      }

      // 计算新的追踪止损
      let newSL;
      if (side === 'LONG') {
        // 多头：每当价格上涨trailStep，止损也上移trailStep
        const potentialSL = currentPrice - trailStep;
        newSL = Math.max(potentialSL, currentSL); // 只能上移，不能下移
      } else {
        // 空头：每当价格下跌trailStep，止损也下移trailStep
        const potentialSL = currentPrice + trailStep;
        newSL = Math.min(potentialSL, currentSL); // 只能下移，不能上移
      }

      // 检查止损是否更新
      const slChanged = Math.abs(newSL - currentSL) > 0.00000001;
      
      if (slChanged) {
        logger.info(`📈 追踪止损更新: 原=${currentSL.toFixed(4)}, 新=${newSL.toFixed(4)}, 当前价=${currentPrice.toFixed(4)}`);
      }

      return {
        updated: slChanged,
        reason: slChanged ? 'Trailing stop updated' : 'No trailing stop update needed',
        currentSL: parseFloat(newSL.toFixed(8)),
        trailingActivated: true,
        profitTriggered: true,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error(`追踪止损更新失败: ${error.message}`);
      return {
        updated: false,
        reason: `Error: ${error.message}`,
        currentSL: trade.initialSL,
        trailingActivated: false
      };
    }
  }

  /**
   * 检查止损是否触发
   * @param {Object} trade - 交易对象
   * @param {number} currentPrice - 当前价格
   * @param {number} currentSL - 当前止损价格
   * @returns {Object} 止损触发结果
   */
  checkStopLoss(trade, currentPrice, currentSL) {
    const { side } = trade;
    
    let triggered = false;
    if (side === 'LONG') {
      triggered = currentPrice <= currentSL;
    } else if (side === 'SHORT') {
      triggered = currentPrice >= currentSL;
    }

    if (triggered) {
      logger.info(`🛑 止损触发: 方向=${side}, 当前价=${currentPrice.toFixed(4)}, 止损=${currentSL.toFixed(4)}`);
    }

    return {
      triggered,
      currentPrice,
      currentSL,
      side
    };
  }

  /**
   * 检查止盈是否触发
   * @param {Object} trade - 交易对象
   * @param {number} currentPrice - 当前价格
   * @param {number} tp - 止盈价格
   * @returns {Object} 止盈触发结果
   */
  checkTakeProfit(trade, currentPrice, tp) {
    const { side } = trade;
    
    let triggered = false;
    if (side === 'LONG') {
      triggered = currentPrice >= tp;
    } else if (side === 'SHORT') {
      triggered = currentPrice <= tp;
    }

    if (triggered) {
      logger.info(`🎯 止盈触发: 方向=${side}, 当前价=${currentPrice.toFixed(4)}, 止盈=${tp.toFixed(4)}`);
    }

    return {
      triggered,
      currentPrice,
      tp,
      side
    };
  }

  /**
   * 检查是否应该扩大止损
   * @private
   */
  _shouldExpandStop(trendConfirm) {
    // 检查1H/4H动量是否进一步确认
    const macdIncrease = trendConfirm.macdHistIncrease || 0;
    const adxRising = trendConfirm.adxRising || false;
    
    // MACD histogram增幅 > 30% 且 4H ADX上升
    return macdIncrease > 0.3 && adxRising;
  }

  /**
   * 检查是否达到盈利触发点
   * @private
   */
  _isProfitTriggered(side, currentPrice, profitTriggerPrice) {
    if (side === 'LONG') {
      return currentPrice >= profitTriggerPrice;
    } else if (side === 'SHORT') {
      return currentPrice <= profitTriggerPrice;
    }
    return false;
  }

  /**
   * 更新参数配置
   * @param {Object} newParams - 新参数
   */
  updateParams(newParams) {
    this.params = { ...this.params, ...newParams };
    logger.info(`动态止损管理器参数已更新: ${JSON.stringify(this.params)}`);
  }

  /**
   * 获取当前参数配置
   * @returns {Object} 当前参数
   */
  getParams() {
    return { ...this.params };
  }

  /**
   * 获取置信度对应的ATR倍数
   * @param {string} confidence - 置信度
   * @returns {number} ATR倍数
   */
  getKEntry(confidence) {
    if (confidence === 'high') return this.params.kEntryHigh;
    if (confidence === 'med') return this.params.kEntryMed;
    return this.params.kEntryLow;
  }
}

module.exports = DynamicStopLossManager;

