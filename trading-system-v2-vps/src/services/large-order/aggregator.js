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
// 按smartmoney.md文档要求的6种动作分类
const FinalAction = {
  ACCUMULATE: 'ACCUMULATE',       // 吸筹/防守
  DISTRIBUTION: 'DISTRIBUTION',   // 派发/出货  
  MARKUP: 'MARKUP',               // 拉升
  MARKDOWN: 'MARKDOWN',           // 砸盘
  MANIPULATION: 'MANIPULATION',   // 操纵/诱导
  UNKNOWN: 'UNKNOWN'              // 未知/无明确信号
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
   * 决定最终动作（按smartmoney.md文档要求）
   * @private
   */
  _decideFinalAction({ buyScore, sellScore, cvdDirection, oiChangePct, spoofCount }) {
    // 1. MANIPULATION（操纵/诱导）
    // 条件：频繁Spoof（>=2个）
    if (spoofCount >= 2) {
      return FinalAction.MANIPULATION;
    }

    const scoreDiff = buyScore - sellScore;
    const oiRising = oiChangePct > 1; // OI上升阈值1%
    const oiFalling = oiChangePct < -1;

    // 2. MARKDOWN（砸盘）
    // 条件：大额ask被吃掉 + 价格下破 OR 大量ask + CVD负 + OI上升
    if (sellScore > buyScore + 2) {
      if (cvdDirection === 'negative') {
        // 有明显卖压
        if (oiRising) {
          // OI上升说明有杠杆空头进场或多头被迫平仓
          return FinalAction.MARKDOWN;
        } else if (oiFalling) {
          // OI下降说明多头被清算
          return FinalAction.MARKDOWN;
        }
      }
    }

    // 3. MARKUP（拉升）
    // 条件：大额bid被吃 + 价格上破 + CVD正 + OI上升
    if (buyScore > sellScore + 2) {
      if (cvdDirection === 'positive' && oiRising) {
        return FinalAction.MARKUP;
      }
    }

    // 4. ACCUMULATE（吸筹）
    // 条件：大额bid持续存在但未被吃掉 + CVD正或OI上升
    if (buyScore > sellScore) {
      // 买方占优但不是明显优势（说明防守而非进攻）
      if (cvdDirection === 'positive' || cvdDirection === 'neutral') {
        return FinalAction.ACCUMULATE;
      }
    }

    // 5. DISTRIBUTION（派发）
    // 条件：大额ask持续但未被吃掉 + OI上升 + CVD负
    if (sellScore > buyScore) {
      // 卖方占优但不是明显优势
      if (cvdDirection === 'negative' || cvdDirection === 'neutral') {
        if (oiRising) {
          return FinalAction.DISTRIBUTION;
        }
      }
    }

    // 6. UNKNOWN（无明确信号）
    // 条件：指标冲突或无持续大单或得分差距小
    return FinalAction.UNKNOWN;
  }
}

module.exports = { SignalAggregator, FinalAction };

