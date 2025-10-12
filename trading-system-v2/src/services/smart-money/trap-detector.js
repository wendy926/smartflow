/**
 * TrapDetector - 诱多/诱空检测器
 * 
 * 功能：
 * - 识别诱多（Bull Trap）：大买单闪现后撤单，价格不涨反跌
 * - 识别诱空（Bear Trap）：大卖单闪现后撤单，价格不跌反涨
 * - 4重防御系统：持续性、成交验证、时序验证、综合判断
 * 
 * 基于smartmoney.md文档（行681-858）
 * @module smart-money/trap-detector
 */

const logger = require('../../utils/logger');

/**
 * 陷阱类型
 */
const TrapType = {
  BULL_TRAP: 'BULL_TRAP',    // 诱多
  BEAR_TRAP: 'BEAR_TRAP',    // 诱空
  NONE: 'NONE'               // 无陷阱
};

class TrapDetector {
  constructor(params = {}) {
    this.params = {
      persistenceThreshold: params.persistenceThreshold || 10000,  // 10秒
      flashThreshold: params.flashThreshold || 3000,               // 3秒
      filledRatioThreshold: params.filledRatioThreshold || 0.30,   // 30%成交
      cancelRatioThreshold: params.cancelRatioThreshold || 0.80,   // 80%撤单
      minTrapConfidence: params.minTrapConfidence || 0.60          // 最小置信度
    };

    logger.info('[TrapDetector] 初始化诱多诱空检测器', this.params);
  }

  /**
   * 1️⃣ 信号过滤：检查挂单持续性
   * @param {Array} trackedEntries - 追踪的挂单
   * @returns {Object} 持续性统计
   */
  checkPersistence(trackedEntries) {
    const now = Date.now();
    let persistentCount = 0;  // 持续挂单数(>=10s)
    let flashCount = 0;       // 闪现挂单数(<3s)
    let totalDuration = 0;

    for (const entry of trackedEntries) {
      const duration = entry.canceledAt 
        ? entry.canceledAt - entry.createdAt
        : now - entry.createdAt;

      if (duration >= this.params.persistenceThreshold) {
        persistentCount++;
      } else if (entry.canceledAt && duration <= this.params.flashThreshold) {
        flashCount++;
      }

      totalDuration += duration;
    }

    const avgDuration = trackedEntries.length > 0 
      ? totalDuration / trackedEntries.length
      : 0;

    return {
      persistentCount,
      flashCount,
      avgDuration,
      flashRatio: trackedEntries.length > 0 ? flashCount / trackedEntries.length : 0
    };
  }

  /**
   * 2️⃣ 成交验证：检查挂单是否真实被成交
   * @param {Array} trackedEntries - 追踪的挂单
   * @param {number} cvdChange - CVD变化
   * @param {number} oiChange - OI变化  
   * @param {number} priceChange - 价格变化
   * @returns {Object} 成交验证结果
   */
  checkExecution(trackedEntries, cvdChange, oiChange, priceChange) {
    let filledCount = 0;
    let canceledCount = 0;
    let totalFilled = 0;
    let totalCanceled = 0;

    for (const entry of trackedEntries) {
      if (entry.wasConsumed) {
        filledCount++;
        const filledRatio = entry.filledVolumeObserved / entry.qty;
        totalFilled += filledRatio;
      }
      if (entry.canceledAt) {
        canceledCount++;
        const remainRatio = entry.canceledAt ? (1 - (entry.filledVolumeObserved || 0) / entry.qty) : 0;
        totalCanceled += remainRatio;
      }
    }

    const avgFilledRatio = filledCount > 0 ? totalFilled / filledCount : 0;
    const avgCancelRatio = canceledCount > 0 ? totalCanceled / canceledCount : 0;

    // CVD对齐检查（买单应伴随CVD上升）
    const buyEntries = trackedEntries.filter(e => e.side === 'bid');
    const sellEntries = trackedEntries.filter(e => e.side === 'ask');
    
    const cvdAlignedBuy = buyEntries.length > 0 && cvdChange > 0;
    const cvdAlignedSell = sellEntries.length > 0 && cvdChange < 0;
    const cvdAligned = cvdAlignedBuy || cvdAlignedSell;

    // OI对齐检查
    const oiAligned = Math.abs(oiChange) > 0;

    // 价格对齐检查
    const priceAlignedBuy = buyEntries.length > 0 && priceChange > 0;
    const priceAlignedSell = sellEntries.length > 0 && priceChange < 0;
    const priceAligned = priceAlignedBuy || priceAlignedSell;

    return {
      filledCount,
      canceledCount,
      avgFilledRatio,
      avgCancelRatio,
      cvdAligned,
      oiAligned,
      priceAligned
    };
  }

  /**
   * 3️⃣ 时序验证：检查信号在时间序列上的一致性
   * @param {Array} priceHistory - 价格历史
   * @param {Array} cvdSeries - CVD序列
   * @param {Array} oiSeries - OI序列
   * @returns {Object} 时序验证结果
   */
  checkTemporalSequence(priceHistory, cvdSeries, oiSeries) {
    // 检查CVD/OI/价格是否同步
    if (!priceHistory || priceHistory.length < 2) {
      return { synchronized: false, spikeDetected: false };
    }

    // 价格趋势
    const priceOld = priceHistory[0];
    const priceNew = priceHistory[priceHistory.length - 1];
    const priceTrend = priceNew > priceOld ? 1 : (priceNew < priceOld ? -1 : 0);

    // CVD趋势
    let cvdTrend = 0;
    if (cvdSeries && cvdSeries.length >= 2) {
      const cvdOld = cvdSeries[0];
      const cvdNew = cvdSeries[cvdSeries.length - 1];
      cvdTrend = cvdNew > cvdOld ? 1 : (cvdNew < cvdOld ? -1 : 0);
    }

    // OI趋势
    let oiTrend = 0;
    if (oiSeries && oiSeries.length >= 2) {
      const oiOld = oiSeries[0];
      const oiNew = oiSeries[oiSeries.length - 1];
      oiTrend = oiNew > oiOld ? 1 : (oiNew < oiOld ? -1 : 0);
    }

    // 同步：CVD和价格同向
    const synchronized = (priceTrend === cvdTrend) && priceTrend !== 0;

    // Spike检测：价格剧烈波动后快速反转
    let spikeDetected = false;
    if (priceHistory.length >= 3) {
      const mid = Math.floor(priceHistory.length / 2);
      const priceMid = priceHistory[mid];
      const volatility = Math.abs(priceMid - priceOld) / priceOld;
      const reversal = (priceMid > priceOld && priceNew < priceMid) || 
                       (priceMid < priceOld && priceNew > priceMid);
      spikeDetected = volatility > 0.01 && reversal;  // 1%波动后反转
    }

    return {
      synchronized,
      spikeDetected,
      priceTrend,
      cvdTrend,
      oiTrend
    };
  }

  /**
   * 综合检测诱多/诱空
   * @param {Object} data - 检测数据
   * @returns {Object} 检测结果
   */
  detect(data) {
    const {
      trackedEntries,
      cvdChange,
      oiChange,
      priceChange,
      priceHistory,
      cvdSeries,
      oiSeries
    } = data;

    // 如果没有追踪挂单，直接返回无陷阱
    if (!trackedEntries || trackedEntries.length === 0) {
      return {
        detected: false,
        type: TrapType.NONE,
        confidence: 0,
        indicators: null
      };
    }

    // 1. 持续性检查
    const persistence = this.checkPersistence(trackedEntries);

    // 2. 成交验证
    const execution = this.checkExecution(trackedEntries, cvdChange, oiChange, priceChange);

    // 3. 时序验证
    const temporal = this.checkTemporalSequence(priceHistory, cvdSeries, oiSeries);

    // === 诱多（Bull Trap）判断 ===
    const bullTrapIndicators = {
      flashOrders: persistence.flashCount > 0 && persistence.flashRatio > 0.5,  // 50%闪现
      highCancelRatio: execution.avgCancelRatio > this.params.cancelRatioThreshold,
      lowFilledRatio: execution.avgFilledRatio < this.params.filledRatioThreshold,
      cvdNotAligned: !execution.cvdAligned,
      priceNotAligned: !execution.priceAligned,
      spikeReversal: temporal.spikeDetected
    };

    const bullTrapScore = 
      (bullTrapIndicators.flashOrders ? 0.25 : 0) +
      (bullTrapIndicators.highCancelRatio ? 0.30 : 0) +
      (bullTrapIndicators.lowFilledRatio ? 0.15 : 0) +
      (bullTrapIndicators.cvdNotAligned ? 0.15 : 0) +
      (bullTrapIndicators.priceNotAligned ? 0.10 : 0) +
      (bullTrapIndicators.spikeReversal ? 0.05 : 0);

    // === 诱空（Bear Trap）判断 ===
    // 逻辑与诱多类似，但方向相反
    const bearTrapIndicators = {
      flashOrders: persistence.flashCount > 0 && persistence.flashRatio > 0.5,
      highCancelRatio: execution.avgCancelRatio > this.params.cancelRatioThreshold,
      lowFilledRatio: execution.avgFilledRatio < this.params.filledRatioThreshold,
      cvdNotAligned: !execution.cvdAligned,
      priceNotAligned: !execution.priceAligned,
      spikeReversal: temporal.spikeDetected
    };

    const bearTrapScore = 
      (bearTrapIndicators.flashOrders ? 0.25 : 0) +
      (bearTrapIndicators.highCancelRatio ? 0.30 : 0) +
      (bearTrapIndicators.lowFilledRatio ? 0.15 : 0) +
      (bearTrapIndicators.cvdNotAligned ? 0.15 : 0) +
      (bearTrapIndicators.priceNotAligned ? 0.10 : 0) +
      (bearTrapIndicators.spikeReversal ? 0.05 : 0);

    // 判断主要方向（买单多还是卖单多）
    const buyEntries = trackedEntries.filter(e => e.side === 'bid');
    const sellEntries = trackedEntries.filter(e => e.side === 'ask');
    const dominantSide = buyEntries.length > sellEntries.length ? 'bid' : 'ask';

    // 最终判断
    let trapType = TrapType.NONE;
    let trapConfidence = 0;

    if (dominantSide === 'bid' && bullTrapScore >= this.params.minTrapConfidence) {
      trapType = TrapType.BULL_TRAP;
      trapConfidence = bullTrapScore;
    } else if (dominantSide === 'ask' && bearTrapScore >= this.params.minTrapConfidence) {
      trapType = TrapType.BEAR_TRAP;
      trapConfidence = bearTrapScore;
    }

    return {
      detected: trapType !== TrapType.NONE,
      type: trapType,
      confidence: parseFloat(trapConfidence.toFixed(2)),
      indicators: {
        persistence: persistence.avgDuration,
        persistentCount: persistence.persistentCount,
        flashCount: persistence.flashCount,
        filledRatio: execution.avgFilledRatio,
        cancelRatio: execution.avgCancelRatio,
        cvdAligned: execution.cvdAligned,
        oiAligned: execution.oiAligned,
        priceAligned: execution.priceAligned,
        synchronized: temporal.synchronized,
        spikeDetected: temporal.spikeDetected
      },
      // 数据库字段
      trap_detected: trapType !== TrapType.NONE,
      trap_type: trapType,
      trap_confidence: trapConfidence * 100,  // 转为百分比
      trap_indicators: JSON.stringify({
        flashOrders: persistence.flashCount,
        cancelRatio: execution.avgCancelRatio,
        cvdAligned: execution.cvdAligned,
        synchronized: temporal.synchronized
      }),
      persistent_orders_count: persistence.persistentCount,
      flash_orders_count: persistence.flashCount,
      cancel_ratio: execution.avgCancelRatio * 100
    };
  }
}

module.exports = { TrapDetector, TrapType };

