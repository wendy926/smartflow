const logger = require('../utils/logger');
const config = require('../config');

/**
 * 动态杠杆滚仓策略
 * 基于rolling-v1.md文档实现
 */
class RollingStrategy {
  constructor() {
    this.name = 'ROLLING';
    this.baseLeverage = 1;
    this.maxLeverage = 10;
    this.leverageDecayRate = 0.1; // 杠杆衰减率
    this.profitLockRate = 0.3; // 利润锁定率
    this.riskThreshold = 0.05; // 风险阈值 5%
    this.maxDrawdown = 0.15; // 最大回撤 15%
  }

  /**
   * 计算杠杆衰减
   * @param {number} currentLeverage - 当前杠杆
   * @param {number} timeElapsed - 经过时间（小时）
   * @returns {number} 衰减后的杠杆
   */
  calculateLeverageDecay(currentLeverage, timeElapsed) {
    // 杠杆衰减公式: newLeverage = currentLeverage * (1 - decayRate * timeElapsed)
    const decayFactor = Math.max(0, 1 - this.leverageDecayRate * timeElapsed);
    const newLeverage = currentLeverage * decayFactor;
    return Math.max(this.baseLeverage, Math.min(newLeverage, this.maxLeverage));
  }

  /**
   * 计算利润锁定
   * @param {number} currentProfit - 当前利润
   * @param {number} totalProfit - 总利润
   * @returns {number} 锁定利润
   */
  calculateProfitLock(currentProfit, totalProfit) {
    // 利润锁定公式: lockProfit = totalProfit * profitLockRate
    const lockProfit = totalProfit * this.profitLockRate;
    return Math.min(lockProfit, currentProfit);
  }

  /**
   * 计算风险调整杠杆
   * @param {number} baseLeverage - 基础杠杆
   * @param {number} currentDrawdown - 当前回撤
   * @param {number} volatility - 波动率
   * @returns {number} 风险调整后的杠杆
   */
  calculateRiskAdjustedLeverage(baseLeverage, currentDrawdown, volatility) {
    // 风险调整公式: adjustedLeverage = baseLeverage * (1 - currentDrawdown) * (1 - volatility)
    const drawdownFactor = Math.max(0.1, 1 - currentDrawdown);
    const volatilityFactor = Math.max(0.5, 1 - volatility);
    const adjustedLeverage = baseLeverage * drawdownFactor * volatilityFactor;
    return Math.max(this.baseLeverage, Math.min(adjustedLeverage, this.maxLeverage));
  }

  /**
   * 计算仓位大小
   * @param {number} accountBalance - 账户余额
   * @param {number} leverage - 杠杆倍数
   * @param {number} riskPercentage - 风险百分比
   * @param {number} entryPrice - 入场价格
   * @param {number} stopLossPrice - 止损价格
   * @returns {number} 仓位大小
   */
  calculatePositionSize(accountBalance, leverage, riskPercentage, entryPrice, stopLossPrice) {
    // 仓位大小公式: positionSize = (accountBalance * riskPercentage) / (entryPrice - stopLossPrice) * leverage
    const riskAmount = accountBalance * riskPercentage;
    const priceDifference = Math.abs(entryPrice - stopLossPrice);
    const positionSize = (riskAmount / priceDifference) * leverage;
    return Math.max(0, positionSize);
  }

  /**
   * 计算滚仓参数
   * @param {Object} position - 当前仓位信息
   * @param {Object} marketData - 市场数据
   * @returns {Object} 滚仓参数
   */
  calculateRollingParameters(position, marketData) {
    const {
      entryPrice,
      currentPrice,
      quantity,
      leverage,
      entryTime,
      totalProfit,
      currentDrawdown
    } = position;

    const {
      volatility,
      trend,
      volume,
      atr
    } = marketData;

    // 计算时间衰减
    const timeElapsed = (Date.now() - new Date(entryTime).getTime()) / (1000 * 60 * 60); // 小时
    const decayedLeverage = this.calculateLeverageDecay(leverage, timeElapsed);

    // 计算风险调整杠杆
    const riskAdjustedLeverage = this.calculateRiskAdjustedLeverage(
      decayedLeverage,
      currentDrawdown,
      volatility
    );

    // 计算利润锁定
    const currentProfit = (currentPrice - entryPrice) * quantity;
    const lockProfit = this.calculateProfitLock(currentProfit, totalProfit);

    // 计算新的仓位大小
    const newPositionSize = this.calculatePositionSize(
      position.accountBalance,
      riskAdjustedLeverage,
      this.riskThreshold,
      currentPrice,
      position.stopLoss
    );

    // 计算滚仓建议
    let rollingAction = 'HOLD';
    let rollingReason = 'No rolling needed';

    if (riskAdjustedLeverage < leverage * 0.8) {
      rollingAction = 'REDUCE';
      rollingReason = 'Leverage decayed significantly';
    } else if (currentDrawdown > this.maxDrawdown) {
      rollingAction = 'CLOSE';
      rollingReason = 'Maximum drawdown exceeded';
    } else if (currentProfit > 0 && lockProfit > 0) {
      rollingAction = 'PARTIAL_CLOSE';
      rollingReason = 'Lock in profits';
    } else if (trend === 'STRONG' && volatility < 0.02) {
      rollingAction = 'INCREASE';
      rollingReason = 'Strong trend with low volatility';
    }

    return {
      rollingAction,
      rollingReason,
      newLeverage: riskAdjustedLeverage,
      newPositionSize,
      lockProfit,
      timeElapsed,
      riskScore: this.calculateRiskScore(position, marketData),
      recommendations: this.generateRecommendations(position, marketData)
    };
  }

  /**
   * 计算风险评分
   * @param {Object} position - 仓位信息
   * @param {Object} marketData - 市场数据
   * @returns {number} 风险评分 (0-100)
   */
  calculateRiskScore(position, marketData) {
    const {
      currentDrawdown,
      leverage,
      timeElapsed
    } = position;

    const {
      volatility,
      trend,
      volume
    } = marketData;

    let riskScore = 0;

    // 回撤风险 (40%)
    riskScore += Math.min(currentDrawdown * 100 * 2, 40);

    // 杠杆风险 (30%)
    riskScore += Math.min((leverage - 1) * 10, 30);

    // 时间风险 (20%)
    riskScore += Math.min(timeElapsed * 2, 20);

    // 市场风险 (10%)
    riskScore += Math.min(volatility * 100, 10);

    return Math.min(100, Math.max(0, riskScore));
  }

  /**
   * 生成建议
   * @param {Object} position - 仓位信息
   * @param {Object} marketData - 市场数据
   * @returns {Array} 建议列表
   */
  generateRecommendations(position, marketData) {
    const recommendations = [];
    const { currentDrawdown, leverage, timeElapsed } = position;
    const { volatility, trend, volume } = marketData;

    // 回撤建议
    if (currentDrawdown > this.maxDrawdown * 0.8) {
      recommendations.push({
        type: 'WARNING',
        message: 'High drawdown detected, consider reducing position size',
        priority: 'HIGH'
      });
    }

    // 杠杆建议
    if (leverage > this.maxLeverage * 0.8) {
      recommendations.push({
        type: 'WARNING',
        message: 'High leverage detected, consider reducing risk',
        priority: 'HIGH'
      });
    }

    // 时间建议
    if (timeElapsed > 24) {
      recommendations.push({
        type: 'INFO',
        message: 'Position held for extended period, consider rolling',
        priority: 'MEDIUM'
      });
    }

    // 市场建议
    if (volatility > 0.05) {
      recommendations.push({
        type: 'WARNING',
        message: 'High volatility detected, consider reducing position size',
        priority: 'HIGH'
      });
    }

    // 趋势建议
    if (trend === 'STRONG') {
      recommendations.push({
        type: 'SUCCESS',
        message: 'Strong trend detected, consider increasing position size',
        priority: 'LOW'
      });
    }

    return recommendations;
  }

  /**
   * 模拟动态滚仓
   * @param {Object} initialPosition - 初始仓位
   * @param {Array} marketDataHistory - 市场数据历史
   * @returns {Object} 滚仓模拟结果
   */
  async simulateDynamicRolling(initialPosition, marketDataHistory) {
    try {
      const simulation = {
        initialPosition,
        rollingHistory: [],
        finalPosition: null,
        totalProfit: 0,
        totalLoss: 0,
        maxDrawdown: 0,
        rollingCount: 0,
        successRate: 0
      };

      let currentPosition = { ...initialPosition };
      let totalProfit = 0;
      let maxDrawdown = 0;
      let rollingCount = 0;
      let successfulRolls = 0;

      // 模拟每个时间点的滚仓决策
      for (let i = 0; i < marketDataHistory.length; i++) {
        const marketData = marketDataHistory[i];
        const currentTime = new Date(initialPosition.entryTime).getTime() + (i * 60 * 60 * 1000); // 每小时

        // 更新当前价格
        currentPosition.currentPrice = marketData.price;
        currentPosition.currentTime = new Date(currentTime).toISOString();

        // 计算当前利润和回撤
        const currentProfit = (marketData.price - currentPosition.entryPrice) * currentPosition.quantity;
        const currentDrawdown = Math.max(0, -currentProfit / currentPosition.accountBalance);
        currentPosition.currentDrawdown = currentDrawdown;
        currentPosition.totalProfit = totalProfit + currentProfit;

        // 更新最大回撤
        maxDrawdown = Math.max(maxDrawdown, currentDrawdown);

        // 计算滚仓参数
        const rollingParams = this.calculateRollingParameters(currentPosition, marketData);

        // 记录滚仓历史
        const rollingRecord = {
          timestamp: currentPosition.currentTime,
          marketData,
          position: { ...currentPosition },
          rollingParams,
          action: rollingParams.rollingAction
        };

        simulation.rollingHistory.push(rollingRecord);

        // 执行滚仓动作
        if (rollingParams.rollingAction === 'REDUCE') {
          currentPosition.quantity *= 0.8;
          currentPosition.leverage = rollingParams.newLeverage;
          rollingCount++;
        } else if (rollingParams.rollingAction === 'INCREASE') {
          currentPosition.quantity *= 1.2;
          currentPosition.leverage = rollingParams.newLeverage;
          rollingCount++;
          successfulRolls++;
        } else if (rollingParams.rollingAction === 'PARTIAL_CLOSE') {
          const closeQuantity = currentPosition.quantity * 0.5;
          const profit = (marketData.price - currentPosition.entryPrice) * closeQuantity;
          totalProfit += profit;
          currentPosition.quantity -= closeQuantity;
          rollingCount++;
          successfulRolls++;
        } else if (rollingParams.rollingAction === 'CLOSE') {
          const profit = (marketData.price - currentPosition.entryPrice) * currentPosition.quantity;
          totalProfit += profit;
          currentPosition.quantity = 0;
          rollingCount++;
          break; // 结束模拟
        }

        // 更新总利润
        totalProfit += currentProfit;
      }

      // 计算最终结果
      simulation.finalPosition = currentPosition;
      simulation.totalProfit = totalProfit;
      simulation.totalLoss = Math.max(0, -totalProfit);
      simulation.maxDrawdown = maxDrawdown;
      simulation.rollingCount = rollingCount;
      simulation.successRate = rollingCount > 0 ? (successfulRolls / rollingCount) * 100 : 0;

      logger.info(`Rolling simulation completed: ${rollingCount} rolls, ${simulation.successRate.toFixed(2)}% success rate`);
      return simulation;
    } catch (error) {
      logger.error('Error in rolling simulation:', error);
      throw error;
    }
  }

  /**
   * 执行滚仓策略
   * @param {string} symbol - 交易对
   * @param {Object} position - 当前仓位
   * @returns {Object} 滚仓策略结果
   */
  async execute(symbol, position) {
    try {
      logger.info(`Executing rolling strategy for ${symbol}`);

      // 获取市场数据（这里应该从实际API获取）
      const marketData = {
        price: position.currentPrice || position.entryPrice,
        volatility: 0.02, // 默认波动率
        trend: 'NEUTRAL', // 默认趋势
        volume: 1000000, // 默认成交量
        atr: 0.01 // 默认ATR
      };

      // 计算滚仓参数
      const rollingParams = this.calculateRollingParameters(position, marketData);

      // 生成策略结果
      const result = {
        symbol,
        strategy: 'ROLLING',
        signal: rollingParams.rollingAction,
        score: 100 - rollingParams.riskScore,
        confidence: Math.max(0, 1 - rollingParams.riskScore / 100),
        reasons: rollingParams.rollingReason,
        recommendations: rollingParams.recommendations,
        parameters: {
          newLeverage: rollingParams.newLeverage,
          newPositionSize: rollingParams.newPositionSize,
          lockProfit: rollingParams.lockProfit,
          timeElapsed: rollingParams.timeElapsed,
          riskScore: rollingParams.riskScore
        },
        timestamp: new Date().toISOString()
      };

      return result;
    } catch (error) {
      logger.error(`Rolling strategy execution error for ${symbol}:`, error);
      return {
        symbol,
        strategy: 'ROLLING',
        signal: 'HOLD',
        score: 0,
        confidence: 0,
        reasons: 'Execution error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = RollingStrategy;
