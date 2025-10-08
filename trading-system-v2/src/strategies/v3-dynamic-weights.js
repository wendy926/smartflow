/**
 * V3策略动态权重调整器
 * 根据strategy-v3-plus.md：基于历史因子胜率动态调整权重
 * 
 * 核心逻辑：
 * - 记录每个因子的历史表现（胜率）
 * - 胜率>50%的因子增加权重，<50%的因子降低权重
 * - 使用alpha系数控制调整幅度（避免过度反应）
 */

const logger = require('../utils/logger');

class DynamicWeightAdjuster {
  constructor(alpha = 0.25) {
    this.factorHistory = {}; // {symbol: {factor: {wins, total}}}
    this.alpha = alpha; // 调整系数（0.15-0.35推荐）
    this.minSamples = 10; // 最小样本数
  }

  /**
   * 基于历史胜率调整权重
   * @param {Object} baseWeights - 基础权重 {factor: weight}
   * @param {Object} factorWinRates - 因子胜率 {factor: winRate}
   * @returns {Object} 调整后的权重
   */
  adjustWeights(baseWeights, factorWinRates) {
    const adjusted = {};

    for (const factor in baseWeights) {
      const baseWeight = baseWeights[factor];
      const winRate = factorWinRates[factor];

      if (winRate !== undefined && winRate !== null) {
        // 根据胜率调整：胜率>50%增加权重，<50%减少权重
        // 公式：adjustedWeight = baseWeight × (1 + alpha × (winRate - 0.5))
        adjusted[factor] = baseWeight * (1 + this.alpha * (winRate - 0.5));

        logger.debug(`权重调整 ${factor}: base=${(baseWeight * 100).toFixed(1)}% winRate=${(winRate * 100).toFixed(1)}% → adjusted=${(adjusted[factor] * 100).toFixed(1)}%`);
      } else {
        // 如果没有历史数据，使用基础权重
        adjusted[factor] = baseWeight;
      }
    }

    // 归一化权重（确保总和为1）
    const sum = Object.values(adjusted).reduce((a, b) => a + b, 0);
    if (sum > 0) {
      for (const factor in adjusted) {
        adjusted[factor] /= sum;
      }
    }

    logger.info(`权重调整完成，归一化后总和：${Object.values(adjusted).reduce((a, b) => a + b, 0).toFixed(2)}`);

    return adjusted;
  }

  /**
   * 记录因子表现
   * @param {string} symbol - 交易对
   * @param {Object} factors - 触发的因子 {factor: 0/1}
   * @param {boolean} win - 是否获胜
   */
  recordFactorPerformance(symbol, factors, win) {
    if (!this.factorHistory[symbol]) {
      this.factorHistory[symbol] = {};
    }

    for (const factor in factors) {
      if (factors[factor]) { // 因子被触发（值为1）
        if (!this.factorHistory[symbol][factor]) {
          this.factorHistory[symbol][factor] = { wins: 0, total: 0 };
        }
        this.factorHistory[symbol][factor].total++;
        if (win) {
          this.factorHistory[symbol][factor].wins++;
        }

        logger.debug(`${symbol} 因子${factor}记录: ${win ? '胜' : '负'}, 累计${this.factorHistory[symbol][factor].wins}/${this.factorHistory[symbol][factor].total}`);
      }
    }
  }

  /**
   * 获取因子胜率
   * @param {string} symbol - 交易对
   * @returns {Object} 因子胜率 {factor: winRate}
   */
  getFactorWinRates(symbol) {
    const history = this.factorHistory[symbol] || {};
    const winRates = {};

    for (const factor in history) {
      const { wins, total } = history[factor];
      if (total >= this.minSamples) {
        winRates[factor] = wins / total;
        logger.debug(`${symbol} 因子${factor}胜率: ${(winRates[factor] * 100).toFixed(1)}% (${wins}/${total})`);
      }
    }

    return winRates;
  }

  /**
   * 获取调整后的权重（主方法）
   * @param {string} symbol - 交易对
   * @param {Object} baseWeights - 基础权重
   * @returns {Object} 调整后的权重
   */
  getAdjustedWeights(symbol, baseWeights) {
    const winRates = this.getFactorWinRates(symbol);

    if (Object.keys(winRates).length === 0) {
      logger.info(`${symbol} 暂无历史数据，使用基础权重`);
      return baseWeights;
    }

    const adjusted = this.adjustWeights(baseWeights, winRates);
    logger.info(`${symbol} 使用动态调整权重（样本数：${Object.keys(winRates).length}因子）`);

    return adjusted;
  }

  /**
   * 清理过期数据（可选）
   * @param {number} maxAge - 最大保留天数
   */
  cleanupOldData(maxAge = 30) {
    // 简化版：在生产环境中可以添加时间戳并清理旧数据
    logger.info('动态权重数据清理（功能预留）');
  }
}

// 导出单例（也可以每次new）
const globalAdjuster = new DynamicWeightAdjuster(0.25);

module.exports = {
  DynamicWeightAdjuster,
  globalAdjuster
};

