/**
 * SignalAggregator - 信号聚合器
 * 整合大额挂单信号、CVD、OI，输出最终动作判断
 * 
 * @module SignalAggregator
 */

const logger = require('../../utils/logger');
const { Classification } = require('./classifier');

/**
 * 最终动作类型
 * @enum {string}
 */
const FinalAction = {
  ACCUMULATE_MARKUP: 'ACCUMULATE/MARKUP',   // 吸筹/拉升（看多）
  DISTRIBUTION_MARKDOWN: 'DISTRIBUTION/MARKDOWN', // 派发/砸盘（看空）
  MANIPULATION: 'MANIPULATION',             // 操纵（警惕）
  NEUTRAL: 'NEUTRAL',                       // 中性
  UNKNOWN: 'UNKNOWN'                        // 未知
};

class SignalAggregator {
  constructor(config) {
    this.config = config;
    logger.info('[SignalAggregator] 初始化完成');
  }

  /**
   * 聚合信号并输出最终动作
   * @param {Array} trackedEntries - 追踪的挂单条目
   * @param {number} cvdCum - CVD累积值
   * @param {number} oi - 当前持仓量
   * @param {number} prevOI - 前一次持仓量
   * @returns {Object} 聚合结果
   */
  aggregate(trackedEntries, cvdCum, oi, prevOI) {
    try {
      // 1. 计算买卖得分
      const { buyScore, sellScore } = this._calculateScores(trackedEntries);

      // 2. 计算 OI 变化
      const oiChangePct = prevOI ? ((oi - prevOI) / prevOI) * 100 : 0;

      // 3. CVD 方向
      const cvdDirection = cvdCum > 0 ? 'positive' : cvdCum < 0 ? 'negative' : 'neutral';

      // 4. Spoof 计数
      const spoofCount = trackedEntries.filter(e => e.isSpoof).length;

      // 5. 综合判断最终动作
      const finalAction = this._decideFinalAction({
        buyScore,
        sellScore,
        cvdDirection,
        oiChangePct,
        spoofCount
      });

      return {
        finalAction,
        buyScore: parseFloat(buyScore.toFixed(2)),
        sellScore: parseFloat(sellScore.toFixed(2)),
        cvdCum: parseFloat(cvdCum.toFixed(8)),
        oi: oi ? parseFloat(oi.toFixed(2)) : null,
        oiChangePct: parseFloat(oiChangePct.toFixed(4)),
        spoofCount,
        trackedEntriesCount: trackedEntries.length
      };
    } catch (error) {
      logger.error('[SignalAggregator] 聚合失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 计算买卖得分
   * @private
   */
  _calculateScores(entries) {
    let buyScore = 0;
    let sellScore = 0;

    entries.forEach(entry => {
      const weight = entry.isPersistent ? 2.0 : 1.0;
      const impactBonus = entry.impactRatio >= this.config.impactRatioThreshold ? 1.5 : 1.0;
      const score = weight * impactBonus * (entry.valueUSD / 100000000); // 以100M为单位

      switch (entry.classification) {
        case Classification.DEFENSIVE_BUY:
          buyScore += score;
          break;
        case Classification.DEFENSIVE_SELL:
          sellScore += score;
          break;
        case Classification.SWEEP_BUY:
          buyScore += score * 1.5; // SWEEP权重更高
          break;
        case Classification.SWEEP_SELL:
          sellScore += score * 1.5;
          break;
        case Classification.SPOOF:
          // Spoof不计入得分，但影响最终判断
          break;
        default:
          break;
      }
    });

    return { buyScore, sellScore };
  }

  /**
   * 决定最终动作
   * @private
   */
  _decideFinalAction({ buyScore, sellScore, cvdDirection, oiChangePct, spoofCount }) {
    // 1. Spoof过多 → MANIPULATION
    if (spoofCount >= 3) {
      return FinalAction.MANIPULATION;
    }

    // 2. 买卖得分差异明显
    const scoreDiff = buyScore - sellScore;
    const scoreThreshold = 2.0;

    if (Math.abs(scoreDiff) < scoreThreshold) {
      // 得分相近，看 CVD + OI
      if (cvdDirection === 'positive' && oiChangePct > 2) {
        return FinalAction.ACCUMULATE_MARKUP;
      } else if (cvdDirection === 'negative' && oiChangePct < -2) {
        return FinalAction.DISTRIBUTION_MARKDOWN;
      }
      return FinalAction.NEUTRAL;
    }

    // 3. 买方占优
    if (scoreDiff > scoreThreshold) {
      // CVD 确认
      if (cvdDirection === 'positive' || cvdDirection === 'neutral') {
        return FinalAction.ACCUMULATE_MARKUP;
      } else {
        // CVD矛盾 → 可能操纵
        return FinalAction.MANIPULATION;
      }
    }

    // 4. 卖方占优
    if (scoreDiff < -scoreThreshold) {
      // CVD 确认
      if (cvdDirection === 'negative' || cvdDirection === 'neutral') {
        return FinalAction.DISTRIBUTION_MARKDOWN;
      } else {
        // CVD矛盾 → 可能操纵
        return FinalAction.MANIPULATION;
      }
    }

    return FinalAction.UNKNOWN;
  }
}

module.exports = { SignalAggregator, FinalAction };

