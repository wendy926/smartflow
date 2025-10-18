/**
 * 资金费率和利率成本计算工具
 * 计算实际盈亏（考虑资金费率、利率和手续费）
 * 
 * 设计原则：
 * 1. 单一职责：专注于资金费率和利率成本计算
 * 2. 开闭原则：支持参数扩展和阈值调整
 * 3. 依赖倒置：依赖抽象接口而非具体实现
 * 4. 接口隔离：提供简洁的计算接口
 * 5. 函数式编程：纯函数，无副作用
 * 6. 可测试性：易于单元测试
 */

const logger = require('./logger');

/**
 * 资金费率计算器
 */
class FundingRateCalculator {
  /**
   * 构造函数
   * @param {Object} config - 配置参数
   * @param {number} config.defaultFundingRate - 默认资金费率（每8小时）
   * @param {number} config.defaultInterestRate - 默认利率（年化）
   * @param {number} config.defaultFeeRate - 默认手续费率
   */
  constructor(config = {}) {
    this.config = {
      defaultFundingRate: 0.0001, // 0.01% 每8小时
      defaultInterestRate: 0.01, // 1% 年化
      defaultFeeRate: 0.0004, // 0.04% 双向
      ...config
    };
  }

  /**
   * 计算实际盈亏（考虑资金费率、利率和手续费）
   * @param {Object} params - 计算参数
   * @param {number} params.entryPrice - 开仓价格
   * @param {number} params.exitPrice - 平仓价格
   * @param {number} params.positionSize - 仓位大小（USDT）
   * @param {number} params.feeRate - 手续费率（默认 0.0004）
   * @param {number} params.fundingRate - 资金费率（默认 0.0001，每8小时）
   * @param {number} params.interestRate - 利率（默认 0.01，年化）
   * @param {number} params.holdHours - 持仓时长（小时）
   * @param {boolean} params.isLong - 是否多头
   * @returns {Object} 盈亏计算结果
   */
  calculatePnLWithCosts(params) {
    const {
      entryPrice,
      exitPrice,
      positionSize,
      feeRate = this.config.defaultFeeRate,
      fundingRate = this.config.defaultFundingRate,
      interestRate = this.config.defaultInterestRate,
      holdHours,
      isLong
    } = params;

    // 参数验证
    if (!entryPrice || !exitPrice || !positionSize || !holdHours) {
      throw new Error('缺少必要参数：entryPrice, exitPrice, positionSize, holdHours');
    }

    // === 基础盈亏 ===
    const rawPnL = isLong
      ? (exitPrice - entryPrice) * (positionSize / entryPrice)
      : (entryPrice - exitPrice) * (positionSize / entryPrice);

    // === 手续费成本（双向）===
    const feeCost = positionSize * feeRate * 2;

    // === 资金费率成本（每8小时结算一次）===
    const fundingCost = positionSize * fundingRate * Math.floor(holdHours / 8);

    // === 利息成本（按小时折算年化）===
    const interestCost = positionSize * (interestRate / 365 / 24) * holdHours;

    // === 实际盈亏 ===
    const netPnL = rawPnL - feeCost - fundingCost - interestCost;

    // 计算盈亏百分比
    const rawPnLPercentage = (rawPnL / positionSize) * 100;
    const netPnLPercentage = (netPnL / positionSize) * 100;

    // 计算成本占比
    const totalCost = feeCost + fundingCost + interestCost;
    const costPercentage = (totalCost / positionSize) * 100;

    return {
      rawPnL: parseFloat(rawPnL.toFixed(8)),
      netPnL: parseFloat(netPnL.toFixed(8)),
      rawPnLPercentage: parseFloat(rawPnLPercentage.toFixed(4)),
      netPnLPercentage: parseFloat(netPnLPercentage.toFixed(4)),
      feeCost: parseFloat(feeCost.toFixed(8)),
      fundingCost: parseFloat(fundingCost.toFixed(8)),
      interestCost: parseFloat(interestCost.toFixed(8)),
      totalCost: parseFloat(totalCost.toFixed(8)),
      costPercentage: parseFloat(costPercentage.toFixed(4)),
      holdHours: parseFloat(holdHours.toFixed(2))
    };
  }

  /**
   * 计算持仓中的未实现盈亏（考虑资金费率和利息）
   * @param {Object} params - 计算参数
   * @param {number} params.entryPrice - 开仓价格
   * @param {number} params.currentPrice - 当前价格
   * @param {number} params.positionSize - 仓位大小（USDT）
   * @param {number} params.feeRate - 手续费率
   * @param {number} params.fundingRate - 资金费率
   * @param {number} params.interestRate - 利率
   * @param {number} params.holdHours - 持仓时长（小时）
   * @param {boolean} params.isLong - 是否多头
   * @returns {Object} 未实现盈亏计算结果
   */
  calculateUnrealizedPnL(params) {
    const {
      entryPrice,
      currentPrice,
      positionSize,
      feeRate = this.config.defaultFeeRate,
      fundingRate = this.config.defaultFundingRate,
      interestRate = this.config.defaultInterestRate,
      holdHours,
      isLong
    } = params;

    // 参数验证
    if (!entryPrice || !currentPrice || !positionSize || !holdHours) {
      throw new Error('缺少必要参数：entryPrice, currentPrice, positionSize, holdHours');
    }

    // 使用当前价格计算未实现盈亏
    return this.calculatePnLWithCosts({
      entryPrice,
      exitPrice: currentPrice,
      positionSize,
      feeRate,
      fundingRate,
      interestRate,
      holdHours,
      isLong
    });
  }

  /**
   * 计算持仓成本（不包括基础盈亏）
   * @param {Object} params - 计算参数
   * @param {number} params.positionSize - 仓位大小（USDT）
   * @param {number} params.feeRate - 手续费率
   * @param {number} params.fundingRate - 资金费率
   * @param {number} params.interestRate - 利率
   * @param {number} params.holdHours - 持仓时长（小时）
   * @returns {Object} 成本计算结果
   */
  calculateCostsOnly(params) {
    const {
      positionSize,
      feeRate = this.config.defaultFeeRate,
      fundingRate = this.config.defaultFundingRate,
      interestRate = this.config.defaultInterestRate,
      holdHours
    } = params;

    // 参数验证
    if (!positionSize || !holdHours) {
      throw new Error('缺少必要参数：positionSize, holdHours');
    }

    // === 手续费成本（双向）===
    const feeCost = positionSize * feeRate * 2;

    // === 资金费率成本（每8小时结算一次）===
    const fundingCost = positionSize * fundingRate * Math.floor(holdHours / 8);

    // === 利息成本（按小时折算年化）===
    const interestCost = positionSize * (interestRate / 365 / 24) * holdHours;

    // === 总成本 ===
    const totalCost = feeCost + fundingCost + interestCost;

    // 计算成本占比
    const costPercentage = (totalCost / positionSize) * 100;

    return {
      feeCost: parseFloat(feeCost.toFixed(8)),
      fundingCost: parseFloat(fundingCost.toFixed(8)),
      interestCost: parseFloat(interestCost.toFixed(8)),
      totalCost: parseFloat(totalCost.toFixed(8)),
      costPercentage: parseFloat(costPercentage.toFixed(4)),
      holdHours: parseFloat(holdHours.toFixed(2))
    };
  }

  /**
   * 格式化资金费率显示
   * @param {number} fundingRate - 资金费率
   * @returns {string} 格式化后的资金费率
   */
  formatFundingRate(fundingRate) {
    if (!fundingRate) return '--';
    return `${(fundingRate * 100).toFixed(4)}%`;
  }

  /**
   * 格式化利率显示
   * @param {number} interestRate - 利率
   * @returns {string} 格式化后的利率
   */
  formatInterestRate(interestRate) {
    if (!interestRate) return '--';
    return `${(interestRate * 100).toFixed(2)}%`;
  }

  /**
   * 判断资金费率是否偏高
   * @param {number} fundingRate - 资金费率
   * @param {number} threshold - 阈值（默认 0.0001，即 0.01%）
   * @returns {boolean} 是否偏高
   */
  isFundingRateHigh(fundingRate, threshold = 0.0001) {
    return Math.abs(fundingRate) > threshold;
  }

  /**
   * 获取资金费率建议
   * @param {number} fundingRate - 资金费率
   * @returns {string} 建议
   */
  getFundingRateAdvice(fundingRate) {
    if (!fundingRate) return '暂无数据';

    const absRate = Math.abs(fundingRate);

    if (absRate > 0.0005) { // > 0.05%
      return '资金费率偏高，建议谨慎持仓或提前止盈';
    } else if (absRate > 0.0001) { // > 0.01%
      return '资金费率较高，注意持仓成本';
    } else {
      return '资金费率正常';
    }
  }
}

module.exports = FundingRateCalculator;

