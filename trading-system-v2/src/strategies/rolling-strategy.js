const logger = require('../utils/logger');
const config = require('../config');

/**
 * 动态杠杆滚仓策略
 * 基于rolling-v1.md文档实现
 */
class RollingStrategy {
  constructor() {
    this.name = 'ROLLING';
    this.minLeverage = 5; // 最低杠杆
    this.maxLeverage = 50; // 最高杠杆
    this.leverageDecayRate = 0.5; // 杠杆递减系数
    this.profitLockRate = 0.5; // 落袋比例
    this.triggerRatio = 1.0; // 滚仓触发阈值（浮盈达到本金）
    this.riskThreshold = 0.2; // 风险阈值 20%
  }

  /**
   * 计算滚仓后新仓位
   * @param {Object} params - 参数
   * @returns {Object} 滚仓结果
   */
  async calculateRollingPosition(params) {
    const {
      currentLeverage = 50,
      lockedProfit = 0,
      principal = 1000,
      currentPrice = 50000,
      entryPrice = 48000,
      floatingProfit = 0,
      leverageDecay = this.leverageDecayRate,
      profitLockRatio = this.profitLockRate
    } = params;

    // 简化计算，直接使用传入的参数
    const newLeverage = Math.max(this.minLeverage, currentLeverage * leverageDecay);
    const rollingAmount = floatingProfit * profitLockRatio;
    const newPosition = rollingAmount * newLeverage;

    return {
      newLeverage,
      lockedProfit: rollingAmount,
      rollingAmount,
      newPosition
    };
  }

  /**
   * 模拟滚仓过程
   * @param {Object} params - 参数
   * @returns {Object} 模拟结果
   */
  async simulateRolling(params) {
    const {
      currentLeverage = 50,
      lockedProfit = 0,
      principal = 1000,
      currentPrice = 50000,
      entryPrice = 48000,
      maxRollings = 3
    } = params;

    const rollingHistory = [];
    let currentLeverageValue = currentLeverage;
    let currentLockedProfit = lockedProfit;

    for (let i = 0; i < maxRollings; i++) {
      if (currentLockedProfit <= 0) break;

      const rollingResult = await this.calculateRollingPosition({
        currentLeverage: currentLeverageValue,
        lockedProfit: currentLockedProfit,
        principal,
        currentPrice,
        entryPrice
      });

      rollingHistory.push(rollingResult);
      currentLeverageValue = rollingResult.newLeverage;
      currentLockedProfit = rollingResult.lockedProfit - rollingResult.rollingAmount;
    }

    return {
      rollingHistory,
      finalLeverage: currentLeverageValue,
      totalRollings: rollingHistory.length
    };
  }

  /**
   * 计算新杠杆
   * @param {Object} params - 参数
   * @returns {number} 新杠杆
   */
  calculateNewLeverage(params) {
    const { currentLeverage = 50, lockedProfit = 0 } = params;

    if (this.leverageDecayRate <= 0 || this.leverageDecayRate >= 1) {
      throw new Error('杠杆递减系数必须在0和1之间');
    }

    const newLeverage = Math.max(
      this.minLeverage,
      currentLeverage * this.leverageDecayRate
    );

    return newLeverage;
  }

  /**
   * 计算止损价格
   * @param {number} entryPrice - 入场价格
   * @param {number} atr - ATR值
   * @param {number} riskPercentage - 风险百分比
   * @returns {number} 止损价格
   */
  async calculateStopLoss(entryPrice, atr, riskPercentage) {
    return entryPrice - (atr * 2 * riskPercentage);
  }

  /**
   * 计算动态止损价格
   * @param {number} currentPrice - 当前价格
   * @param {number} entryPrice - 入场价格
   * @param {number} atr - ATR值
   * @param {number} lockedProfit - 锁定利润
   * @returns {number} 动态止损价格
   */
  async calculateDynamicStopLoss(currentPrice, entryPrice, atr, lockedProfit) {
    const baseStopLoss = entryPrice - (atr * 2);
    const profitAdjustment = lockedProfit * 0.1; // 根据锁定利润调整
    return baseStopLoss + profitAdjustment;
  }

  /**
   * 计算风险收益比
   * @param {number} entryPrice - 入场价格
   * @param {number} stopLoss - 止损价格
   * @param {number} takeProfit - 止盈价格
   * @returns {number} 风险收益比
   */
  async calculateRiskRewardRatio(entryPrice, stopLoss, takeProfit) {
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(takeProfit - entryPrice);
    return risk > 0 ? reward / risk : 0;
  }

  /**
   * 检查风险限制
   * @param {Object} params - 参数
   * @returns {Object} 风险检查结果
   */
  async checkRiskLimit(params) {
    const {
      position = 10000,
      margin = 1000,
      totalBalance = 10000,
      riskThreshold = this.riskThreshold,
      principal = 1000,
      maxRiskPercentage = 0.1
    } = params;

    // 使用principal作为totalBalance的默认值
    const actualTotalBalance = totalBalance || principal;
    const riskPercentage = position / actualTotalBalance;
    const isValid = riskPercentage <= maxRiskPercentage;

    return {
      isValid,
      riskPercentage,
      riskThreshold: maxRiskPercentage,
      position,
      totalBalance: actualTotalBalance
    };
  }

  /**
   * 计算仓位大小
   * @param {Object} params - 参数
   * @returns {Object} 仓位计算结果
   */
  async calculatePositionSize(params) {
    const {
      balance = 1000,
      leverage = 10,
      price = 50000,
      riskPercentage = 0.02,
      principal = balance,
      entryPrice = price,
      availableBalance = balance
    } = params;

    const position = availableBalance * leverage;
    const margin = position / leverage;
    const quantity = position / entryPrice;

    return {
      position,
      margin,
      quantity
    };
  }

  /**
   * 计算保证金需求
   * @param {Object} params - 参数
   * @returns {Object} 保证金计算结果
   */
  async calculateMarginRequirement(params) {
    const {
      position = 10000,
      leverage = 10,
      maintenanceMarginRate = 0.01
    } = params;

    const initialMargin = position / leverage;
    const maintenanceMargin = position * maintenanceMarginRate;
    const totalMargin = initialMargin + maintenanceMargin;

    return {
      initialMargin,
      maintenanceMargin,
      totalMargin
    };
  }

  /**
   * 计算可用余额
   * @param {Object} params - 参数
   * @returns {number} 可用余额
   */
  async calculateAvailableBalance(params) {
    const {
      totalBalance = 2000,
      usedMargin = 1000,
      lockedProfit = 200,
      balance = totalBalance,
      margin = usedMargin,
      profit = lockedProfit,
      floatingPnL = profit
    } = params;

    return totalBalance - usedMargin + floatingPnL;
  }


  /**
   * 执行滚仓策略
   * @param {string|Object} symbolOrParams - 交易对或参数对象
   * @param {Object} params - 参数（如果第一个参数是交易对）
   * @returns {Object} 执行结果
   */
  async execute(symbolOrParams, params) {
    try {
      // 处理参数：如果第一个参数是对象，则直接使用；否则使用第二个参数
      const actualParams = typeof symbolOrParams === 'object' ? symbolOrParams : (params || {});

      console.log(`Rolling execute called with params=`, actualParams);

      const {
        principal = 1000,
        initialLeverage = 50,
        entryPrice = 50000,
        currentPrice = 50000,
        triggerRatio = this.triggerRatio,
        maxRollings = 3,
        quantity = principal * initialLeverage
      } = actualParams;

      // 如果传入了quantity，重新计算principal
      const actualPrincipal = quantity ? quantity / initialLeverage : principal;

      // 计算浮动盈亏
      const floatingProfit = this.calculateFloatingProfit(currentPrice, entryPrice, quantity);

      // 检查滚仓触发条件
      const triggered = this.checkRollingTrigger(floatingProfit, actualPrincipal, triggerRatio);

      // 调试信息
      console.log(`Rolling debug: currentPrice=${currentPrice}, entryPrice=${entryPrice}, principal=${principal}, floatingProfit=${floatingProfit}, triggered=${triggered}`);

      if (triggered) {
        // 执行滚仓模拟
        const rollingResult = await this.simulateRolling({
          currentLeverage: initialLeverage,
          lockedProfit: floatingProfit,
          principal,
          currentPrice,
          entryPrice,
          maxRollings
        });

        return {
          success: true,
          totalProfit: floatingProfit,
          lockedProfit: floatingProfit * this.profitLockRate,
          finalLeverage: rollingResult.finalLeverage,
          rollingHistory: rollingResult.rollingHistory,
          strategy: 'ROLLING',
          signal: 'ROLL',
          triggered: true,
          floatingProfit,
          parameters: {
            currentLeverage: initialLeverage,
            lockedProfit: floatingProfit * this.profitLockRate,
            principal
          }
        };
      } else {
        return {
          success: true,
          totalProfit: floatingProfit,
          lockedProfit: 0,
          finalLeverage: initialLeverage,
          rollingHistory: [],
          strategy: 'ROLLING',
          signal: 'HOLD',
          triggered: false,
          floatingProfit,
          parameters: {
            currentLeverage: initialLeverage,
            lockedProfit: 0,
            principal
          }
        };
      }
    } catch (error) {
      logger.error(`Rolling strategy execution error: ${error.message}`);
      throw error;
    }
  }

  /**
   * 动态杠杆滚仓计算器（基于rolling-v1.md）
   * @param {Object} params - 计算参数
   * @returns {Object} 计算结果
   */
  async calculateDynamicRolling(params) {
    const {
      principal = 200,
      initialLeverage = 50,
      priceStart = 4700,
      priceTarget = 5200,
      triggerRatio = 1.0,
      leverageDecay = 0.5,
      profitLockRatio = 0.5,
      minLeverage = 5,
      steps = 100
    } = params;

    let equity = principal; // 当前总净值
    let lockedProfit = 0;   // 已落袋利润
    let floatingProfit = 0; // 当前浮盈
    let leverage = initialLeverage;
    let position = principal * leverage; // 仓位价值
    let price = priceStart;
    const totalPriceIncrease = priceTarget - priceStart;
    const priceStep = totalPriceIncrease / steps; // 模拟steps步上涨
    const history = [];

    for (let i = 1; i <= steps; i++) {
      price += priceStep;
      floatingProfit = position * (price - priceStart) / priceStart;

      // 判断是否触发滚仓
      if (floatingProfit >= principal * triggerRatio) {
        // 抽回本金
        equity += principal;
        floatingProfit -= principal;

        // 落袋部分利润
        const locked = floatingProfit * profitLockRatio;
        lockedProfit += locked;
        floatingProfit -= locked;

        // 滚仓
        leverage = Math.max(minLeverage, leverage * leverageDecay);
        position = floatingProfit * leverage;

        // 重置开仓价
        priceStart = price;
      }

      // 保存历史记录
      history.push({
        step: i,
        price: parseFloat(price.toFixed(2)),
        position: parseFloat(position.toFixed(2)),
        floatingProfit: parseFloat(floatingProfit.toFixed(2)),
        lockedProfit: parseFloat(lockedProfit.toFixed(2)),
        equity: parseFloat((equity + floatingProfit + lockedProfit).toFixed(2)),
        leverage: parseFloat(leverage.toFixed(2))
      });
    }

    return {
      success: true,
      strategy: 'DYNAMIC_ROLLING',
      finalEquity: equity + floatingProfit + lockedProfit,
      totalLockedProfit: lockedProfit,
      finalFloatingProfit: floatingProfit,
      finalLeverage: leverage,
      totalReturn: ((equity + floatingProfit + lockedProfit) - principal) / principal * 100,
      history: history,
      summary: {
        principal,
        initialLeverage,
        finalLeverage: leverage,
        totalProfit: lockedProfit + floatingProfit,
        returnPercentage: ((equity + floatingProfit + lockedProfit) - principal) / principal * 100,
        rollingCount: history.filter(h => h.leverage !== initialLeverage).length
      }
    };
  }

  /**
   * 计算浮动盈亏
   * @param {number} currentPrice - 当前价格
   * @param {number} entryPrice - 入场价格
   * @param {number} quantity - 仓位数量
   * @returns {number} 浮动盈亏
   */
  calculateFloatingProfit(currentPrice, entryPrice, quantity) {
    return (currentPrice - entryPrice) * quantity / entryPrice;
  }

  /**
   * 检查滚仓触发条件
   * @param {number} floatingProfit - 浮动盈亏
   * @param {number} principal - 本金
   * @param {number} triggerRatio - 触发比例
   * @returns {boolean} 是否触发滚仓
   */
  checkRollingTrigger(floatingProfit, principal, triggerRatio) {
    return floatingProfit >= principal * triggerRatio;
  }

  /**
   * 执行滚仓
   * @param {number} floatingProfit - 浮动盈亏
   * @param {number} principal - 本金
   * @param {number} currentLeverage - 当前杠杆
   * @param {number} lockedProfit - 已锁定利润
   * @returns {Object} 滚仓结果
   */
  executeRolling(floatingProfit, principal, currentLeverage, lockedProfit) {
    // 计算新杠杆
    const newLeverage = this.calculateNewLeverage(currentLeverage);

    // 计算落袋利润
    const profitToLock = floatingProfit * this.profitLockRate;
    const newLockedProfit = lockedProfit + profitToLock;

    // 计算滚仓金额
    const rollingAmount = floatingProfit - profitToLock;

    // 计算新仓位
    const newPosition = rollingAmount * newLeverage;

    return {
      newLeverage,
      lockedProfit: newLockedProfit,
      rollingAmount,
      newPosition,
      profitToLock
    };
  }

  /**
   * 计算新杠杆（杠杆递减公式）
   * @param {number} currentLeverage - 当前杠杆
   * @returns {number} 新杠杆
   */
  calculateNewLeverage(currentLeverage) {
    const newLeverage = currentLeverage * this.leverageDecayRate;
    return Math.max(this.minLeverage, Math.min(newLeverage, this.maxLeverage));
  }

  /**
   * 计算止损价格
   * @param {number} entryPrice - 入场价格
   * @param {number} currentPrice - 当前价格
   * @param {number} leverage - 杠杆
   * @param {number} riskPercentage - 风险百分比
   * @returns {number} 止损价格
   */
  calculateStopLoss(entryPrice, currentPrice, leverage, riskPercentage = this.riskThreshold) {
    const riskAmount = entryPrice * riskPercentage;
    return entryPrice - riskAmount;
  }

  /**
   * 计算动态止损
   * @param {number} entryPrice - 入场价格
   * @param {number} currentPrice - 当前价格
   * @param {number} lockedProfit - 已锁定利润
   * @param {number} principal - 本金
   * @returns {number} 动态止损价格
   */
  calculateDynamicStopLoss(entryPrice, currentPrice, lockedProfit, principal) {
    // 保护本金和已锁定利润
    const protectedAmount = principal + lockedProfit;
    const profitRatio = (currentPrice - entryPrice) / entryPrice;

    if (profitRatio > 0) {
      // 盈利时，止损价格随价格上涨而上移
      return entryPrice + (currentPrice - entryPrice) * 0.5;
    } else {
      // 亏损时，使用固定止损
      return this.calculateStopLoss(entryPrice, currentPrice, 1, this.riskThreshold);
    }
  }

  /**
   * 计算风险回报比
   * @param {number} entryPrice - 入场价格
   * @param {number} stopLoss - 止损价格
   * @param {number} takeProfit - 止盈价格
   * @returns {number} 风险回报比
   */
  calculateRiskRewardRatio(entryPrice, stopLoss, takeProfit) {
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(takeProfit - entryPrice);
    return risk > 0 ? reward / risk : 0;
  }




  /**
   * 计算初始仓位
   * @param {Object} params - 参数
   * @returns {Object} 初始仓位信息
   */
  async calculateInitialPosition(params) {
    const {
      principal = 1000,
      leverage = 10,
      price = 50000,
      riskPercentage = this.riskThreshold,
      initialLeverage = leverage,
      entryPrice = price
    } = params;

    // 参数验证
    if (initialLeverage <= 0) {
      throw new Error('杠杆不能为零');
    }
    if (entryPrice <= 0) {
      throw new Error('价格不能为负数');
    }
    if (principal <= 0) {
      throw new Error('本金不能为零或负数');
    }

    const position = principal * initialLeverage;
    const margin = position / initialLeverage;
    const quantity = position / entryPrice;

    return {
      position,
      margin,
      quantity,
      leverage,
      riskAmount: principal * riskPercentage
    };
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
   * 计算杠杆衰减（时间衰减）
   * @param {number} currentLeverage - 当前杠杆
   * @param {number} timeElapsed - 经过时间（小时）
   * @returns {number} 衰减后的杠杆
   */
  calculateLeverageDecay(currentLeverage, timeElapsed) {
    // 杠杆衰减公式: newLeverage = currentLeverage * (1 - decayRate * timeElapsed)
    const decayFactor = Math.max(0, 1 - this.leverageDecayRate * timeElapsed);
    const newLeverage = currentLeverage * decayFactor;
    return Math.max(this.minLeverage, Math.min(newLeverage, this.maxLeverage));
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
   * 计算新杠杆
   * @param {Object} params - 参数
   * @returns {number} 新杠杆
   */
  async calculateNewLeverage(params) {
    const { currentLeverage, leverageDecay = 0.5, minLeverage = 5 } = params;

    if (leverageDecay < 0 || leverageDecay > 1) {
      throw new Error('杠杆递减系数必须在0和1之间');
    }

    const newLeverage = currentLeverage * leverageDecay;
    return Math.max(minLeverage, newLeverage);
  }

  /**
   * 计算止损价格
   * @param {number} entryPrice - 入场价格
   * @param {number} atr - ATR值
   * @param {number} riskPercentage - 风险百分比
   * @returns {number} 止损价格
   */
  async calculateStopLoss(entryPrice, atr, riskPercentage = 0.02) {
    return entryPrice - (atr * riskPercentage * 100);
  }

  /**
   * 计算动态止损
   * @param {number} currentPrice - 当前价格
   * @param {number} entryPrice - 入场价格
   * @param {number} atr - ATR值
   * @param {number} lockedProfit - 锁定利润
   * @returns {number} 动态止损价格
   */
  async calculateDynamicStopLoss(currentPrice, entryPrice, atr, lockedProfit) {
    const profit = currentPrice - entryPrice;
    const dynamicStop = entryPrice + (profit * 0.5); // 保护50%利润
    return Math.max(dynamicStop, entryPrice - atr);
  }

  /**
   * 计算风险回报比
   * @param {number} entryPrice - 入场价格
   * @param {number} stopLoss - 止损价格
   * @param {number} takeProfit - 止盈价格
   * @returns {number} 风险回报比
   */
  async calculateRiskRewardRatio(entryPrice, stopLoss, takeProfit) {
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(takeProfit - entryPrice);
    return reward / risk;
  }




}

module.exports = RollingStrategy;
