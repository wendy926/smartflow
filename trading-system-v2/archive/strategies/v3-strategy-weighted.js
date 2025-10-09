/**
 * V3策略加权评分扩展
 * 根据代币类别应用不同的多因子权重
 */

const TokenClassifier = require('../utils/token-classifier');
const logger = require('../utils/logger');

/**
 * 计算1H多因子加权得分（趋势市）
 * @param {string} symbol - 交易对
 * @param {string} trend4H - 4H趋势方向
 * @param {Object} factorScores - 各因子得分（0或1）
 * @returns {number} 加权总分（0-1之间）
 */
function calculate1HTrendWeightedScore(symbol, trend4H, factorScores) {
  const {
    vwapDirection,      // VWAP方向（必须满足，不计分）
    breakout,           // 突破确认 0/1
    volume,             // 成交量确认 0/1
    oiChange,           // OI变化 0/1
    delta,              // Delta不平衡 0/1
    fundingRate         // 资金费率 0/1
  } = factorScores;

  // VWAP方向必须一致，否则返回0
  if (!vwapDirection) {
    logger.info(`${symbol} VWAP方向不一致，1H趋势市得分=0`);
    return 0;
  }

  // 获取该代币的权重配置
  const weights = TokenClassifier.getTrend1HWeights(symbol);
  const category = TokenClassifier.getCategoryInfo(symbol);

  // 计算加权得分
  const weightedScore =
    (breakout || 0) * weights.breakout +
    (volume || 0) * weights.volume +
    (oiChange || 0) * weights.oiChange +
    (delta || 0) * weights.delta +
    (fundingRate || 0) * weights.fundingRate;

  logger.info(`${symbol} (${category.name}) 1H趋势市加权得分: ${(weightedScore * 100).toFixed(1)}%, ` +
    `因子[突破:${breakout} 成交量:${volume} OI:${oiChange} Delta:${delta} 资金费率:${fundingRate}]`);

  return weightedScore;
}

/**
 * 计算1H多因子加权得分（震荡市）
 * @param {string} symbol - 交易对
 * @param {Object} factorScores - 各因子得分（0或1）
 * @returns {number} 加权总分（0-1之间）
 */
function calculate1HRangeWeightedScore(symbol, factorScores) {
  const {
    vwap,              // VWAP因子 0/1
    touch,             // 触碰因子 0/1
    volume,            // 成交量因子 0/1
    delta,             // Delta因子 0/1
    oi,                // OI因子 0/1
    noBreakout         // 无突破因子 0/1
  } = factorScores;

  // 获取该代币的权重配置
  const weights = TokenClassifier.getRange1HWeights(symbol);
  const category = TokenClassifier.getCategoryInfo(symbol);

  // 计算加权得分
  const weightedScore =
    (vwap || 0) * weights.vwap +
    (touch || 0) * weights.touch +
    (volume || 0) * weights.volume +
    (delta || 0) * weights.delta +
    (oi || 0) * weights.oi +
    (noBreakout || 0) * (weights.noBreakout || 0);

  logger.info(`${symbol} (${category.name}) 1H震荡市加权得分: ${(weightedScore * 100).toFixed(1)}%, ` +
    `因子[VWAP:${vwap} 触碰:${touch} 成交量:${volume} Delta:${delta} OI:${oi} 无突破:${noBreakout}]`);

  return weightedScore;
}

/**
 * 计算15M入场加权得分
 * @param {string} symbol - 交易对
 * @param {string} marketType - 市场类型 'TREND' 或 'RANGE'
 * @param {Object} factorScores - 各因子得分（0或1）
 * @returns {number} 加权总分（0-1之间）
 */
function calculate15MWeightedScore(symbol, marketType, factorScores) {
  const {
    vwap,              // VWAP方向 0/1
    delta,             // Delta 0/1
    oi,                // OI变化 0/1
    volume             // Volume 0/1
  } = factorScores;

  // 使用TokenClassifier的calculate15MScore方法
  const weightedScore = TokenClassifier.calculate15MScore(symbol, marketType, factorScores);
  const category = TokenClassifier.getCategoryInfo(symbol);

  logger.info(`${symbol} (${category.name}) 15M ${marketType}市加权得分: ${(weightedScore * 100).toFixed(1)}%, ` +
    `因子[VWAP:${vwap} Delta:${delta} OI:${oi} Volume:${volume}]`);

  return weightedScore;
}

/**
 * 判断因子得分（将数值转换为0/1）
 * @param {number} value - 实际值
 * @param {number} threshold - 阈值
 * @param {string} compareType - 比较类型 'gt'(大于) 或 'lt'(小于) 或 'abs_lt'(绝对值小于)
 * @returns {number} 0 或 1
 */
function evaluateFactor(value, threshold, compareType = 'gt') {
  if (value === null || value === undefined) return 0;

  switch (compareType) {
    case 'gt':
      return value > threshold ? 1 : 0;
    case 'lt':
      return value < threshold ? 1 : 0;
    case 'abs_lt':
      return Math.abs(value) < threshold ? 1 : 0;
    case 'gte':
      return value >= threshold ? 1 : 0;
    case 'lte':
      return value <= threshold ? 1 : 0;
    default:
      return 0;
  }
}

module.exports = {
  calculate1HTrendWeightedScore,
  calculate1HRangeWeightedScore,
  calculate15MWeightedScore,
  evaluateFactor
};

