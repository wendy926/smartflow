/**
 * V3.1-Plus 优化 - 动态止损Plus版本
 * 
 * 功能：
 * - 置信度分层止损（High: 1.4, Med: 2.0, Low: 3.0）
 * - 入场模式调整（Breakout: ×1.25, Pullback: ×0.9）
 * - 时间止损优化（60分钟基准 + 动量确认）
 * - 追踪止盈优化（步长0.4×ATR，目标2.0×ATR）
 * 
 * 设计原则：
 * - 继承DynamicStopLossManager
 * - 扩展而非修改
 * - 向后兼容V3.1
 * 
 * @module v3-1-plus/dynamic-stop-loss-plus
 */

const DynamicStopLossManager = require('../../strategies/v3-1-dynamic-stop-loss');
const logger = require('../../utils/logger');

/**
 * 动态止损管理器Plus版
 * 在原V3.1基础上增加入场模式调整和优化的时间止损
 */
class DynamicStopLossPlus extends DynamicStopLossManager {
  constructor(params = {}) {
    // 调用父类构造函数，传入优化的参数
    super({
      kEntryHigh: params.kEntryHigh || 1.4,      // V3.1是1.5，收紧10%
      kEntryMed: params.kEntryMed || 2.0,        // 保持不变
      kEntryLow: params.kEntryLow || 3.0,        // V3.1是2.6，放宽15%
      kHold: params.kHold || 2.8,                // 保持不变
      timeStopMinutes: params.timeStopMinutes || 60,
      profitTrigger: params.profitTrigger || 1.0,
      trailStep: params.trailStep || 0.4,        // V3.1是0.5，更敏感
      tpFactor: params.tpFactor || 2.0           // V3.1是1.3，提高目标
    });

    // Plus版本的额外参数
    this.plusParams = {
      breakoutMultiplier: params.breakoutMultiplier || 1.25,  // 突破模式止损倍数
      pullbackMultiplier: params.pullbackMultiplier || 0.9,   // 回撤模式止损倍数
      timeStopExtended: params.timeStopExtended || 120,       // 扩展时间止损（分钟）
      momentumReversalThreshold: params.momentumReversalThreshold || 0.3 // 动量反转阈值
    };

    logger.info('[DynamicStopLossPlus] 初始化Plus版动态止损管理器', {
      base: this.params,
      plus: this.plusParams
    });
  }

  /**
   * 计算止损系数K（考虑置信度和入场模式）
   * @param {string} confidence - 置信度 'high'/'med'/'low'
   * @param {string} entryMode - 入场模式 'breakout'/'pullback'/'momentum'
   * @returns {number} 止损ATR倍数
   */
  computeStopK(confidence, entryMode) {
    // 基础K值（根据置信度）
    let K;
    if (confidence === 'high') {
      K = this.params.kEntryHigh; // 1.4
    } else if (confidence === 'med') {
      K = this.params.kEntryMed; // 2.0
    } else {
      K = this.params.kEntryLow; // 3.0
    }

    // 根据入场模式调整
    if (entryMode === 'breakout') {
      K *= this.plusParams.breakoutMultiplier; // ×1.25 (突破风险高，放宽止损)
    } else if (entryMode === 'pullback') {
      K *= this.plusParams.pullbackMultiplier; // ×0.9 (回撤风险低，收紧止损)
    }
    // momentum模式保持原K值

    return parseFloat(K.toFixed(2));
  }

  /**
   * 计算初始止损和止盈（Plus版）
   * @param {number} entryPrice - 入场价格
   * @param {string} side - 方向 'LONG' 或 'SHORT'
   * @param {number} atr15 - 15M ATR值
   * @param {string} confidence - 置信度
   * @param {string} entryMode - 入场模式
   * @returns {Object} 止损止盈参数
   */
  calculateInitialPlus(entryPrice, side, atr15, confidence, entryMode = 'momentum') {
    try {
      // 计算动态K值
      const K = this.computeStopK(confidence, entryMode);

      // 计算初始止损
      let initialSL, tp;
      if (side === 'LONG') {
        initialSL = entryPrice - (atr15 * K);
        tp = entryPrice + (atr15 * K * this.params.tpFactor);
      } else if (side === 'SHORT') {
        initialSL = entryPrice + (atr15 * K);
        tp = entryPrice - (atr15 * K * this.params.tpFactor);
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
        kEntry: K,
        confidence,
        entryMode,
        trailStep: parseFloat(trailStep.toFixed(8)),
        profitTriggerPrice: parseFloat(profitTriggerPrice.toFixed(8)),
        stopDistance,
        timeStopMinutes: this.params.timeStopMinutes,
        timestamp: new Date()
      };

      logger.info(`[DynamicStopLossPlus] 初始止损计算: 置信度=${confidence}, 模式=${entryMode}, K=${K}, SL=${initialSL.toFixed(4)}, TP=${tp.toFixed(4)}`);
      
      return result;
    } catch (error) {
      logger.error('[DynamicStopLossPlus] calculateInitialPlus错误:', error);
      throw error;
    }
  }

  /**
   * 判断是否应该时间止损（优化版）
   * @param {Object} trade - 交易对象
   * @param {Object} momentumData - 动量数据 {macdHist1h, prevMacdHist1h, ema20Cross}
   * @returns {Object} {shouldStop: boolean, reason: string}
   */
  shouldTimeStop(trade, momentumData = {}) {
    try {
      const now = Date.now();
      const entryTime = new Date(trade.entry_time).getTime();
      const minutesHeld = (now - entryTime) / 1000 / 60;

      // 检查是否有盈利
      const currentPrice = parseFloat(trade.current_price || trade.entry_price);
      const entryPrice = parseFloat(trade.entry_price);
      const isProfitable = (trade.trade_type === 'LONG') 
        ? currentPrice > entryPrice
        : currentPrice < entryPrice;

      // 基准时间止损（60分钟）
      if (minutesHeld >= this.params.timeStopMinutes && !isProfitable) {
        // 检查是否有动量反转
        const { macdHist1h, prevMacdHist1h, ema20Cross } = momentumData;

        // 动量反转判断
        let momentumReversed = false;
        if (macdHist1h !== undefined && prevMacdHist1h !== undefined) {
          const histChange = Math.abs(macdHist1h - prevMacdHist1h) / Math.abs(prevMacdHist1h || 1);
          momentumReversed = histChange > this.plusParams.momentumReversalThreshold;
        }

        // 如果有EMA交叉，也视为动量反转
        if (ema20Cross) {
          momentumReversed = true;
        }

        if (momentumReversed) {
          return {
            shouldStop: true,
            reason: 'time_stop_with_momentum_reversal',
            minutesHeld: Math.round(minutesHeld),
            momentumReversed: true
          };
        }
      }

      // 扩展时间止损（120分钟）- 减仓50%
      if (minutesHeld >= this.plusParams.timeStopExtended && !isProfitable) {
        return {
          shouldStop: true,
          reason: 'extended_time_stop',
          minutesHeld: Math.round(minutesHeld),
          action: 'reduce_50_percent'
        };
      }

      // 不需要时间止损
      return {
        shouldStop: false,
        reason: 'ok',
        minutesHeld: Math.round(minutesHeld),
        isProfitable
      };
    } catch (error) {
      logger.error('[DynamicStopLossPlus] shouldTimeStop错误:', error);
      return { shouldStop: false, reason: 'error', error: error.message };
    }
  }

  /**
   * 获取Plus版本的统计信息
   * @returns {Object} 统计信息
   */
  getStatistics() {
    return {
      version: 'V3.1-Plus',
      baseParams: this.params,
      plusParams: this.plusParams,
      improvements: {
        kEntryHigh: { v31: 1.5, plus: 1.4, change: '-6.7%' },
        kEntryLow: { v31: 2.6, plus: 3.0, change: '+15.4%' },
        trailStep: { v31: 0.5, plus: 0.4, change: '-20%' },
        tpFactor: { v31: 1.3, plus: 2.0, change: '+53.8%' }
      }
    };
  }
}

module.exports = DynamicStopLossPlus;

