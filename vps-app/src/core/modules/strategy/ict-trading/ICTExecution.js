// ICTExecution.js - ICT策略执行逻辑
// 实现风险管理、止损止盈、仓位计算

const ICTExitConditions = require('./ICTExitConditions');

class ICTExecution {
  constructor(database = null) {
    this.database = database;
    this.exitConditions = new ICTExitConditions(database);
  }

  /**
   * 风险管理计算 - 按照ICT文档实现
   * @param {Object} ltfResult - 15m分析结果
   * @param {Object} options - 风险参数
   * @returns {Object} 风险管理结果
   */
  static calculateRiskManagement(ltfResult, options = {}) {
    try {
      const {
        equity = 10000,
        riskPct = 0.01,
        RR = 3,
        maxLossAmount = 100
      } = options;

      const entry = ltfResult.entryPrice;

      // 输入验证
      if (!entry || entry <= 0) {
        throw new Error('Invalid entry price');
      }
      const SL = ICTExecution.calculateStopLoss(ltfResult);
      const TP = ICTExecution.calculateTakeProfit(entry, SL, RR);

      const stopDist = Math.abs(entry - SL);
      const riskAmount = Math.min(equity * riskPct, maxLossAmount);
      const units = riskAmount / stopDist;
      const notional = entry * units;
      const leverage = 5; // 默认杠杆
      const margin = notional / leverage;

      return {
        entry,
        stopLoss: SL,
        takeProfit: TP,
        stopDistance: stopDist,
        stopDistancePercent: (stopDist / entry) * 100,
        units,
        notional,
        margin,
        leverage,
        riskAmount,
        riskRewardRatio: RR,
        equity
      };
    } catch (error) {
      console.error('风险管理计算失败:', error);
      return {
        entry: 0,
        stopLoss: 0,
        takeProfit: 0,
        stopDistance: 0,
        stopDistancePercent: 0,
        units: 0,
        notional: 0,
        margin: 0,
        leverage: 1,
        riskAmount: 0,
        riskRewardRatio: 0,
        equity: 0,
        error: error.message
      };
    }
  }

  /**
   * 止损计算 - 按照ICT文档实现
   * @param {Object} ltfResult - 15m分析结果
   * @returns {number} 止损价格
   */
  static calculateStopLoss(ltfResult) {
    try {
      const { entryPrice, atr15, data15M } = ltfResult;

      if (!data15M || data15M.length < 3) {
        // 如果没有15m数据，使用ATR计算
        return entryPrice * 0.98; // 默认2%止损
      }

      // 上升趋势：最近3根15m的最低点 - 1.5×ATR(15m)
      // 下降趋势：最近3根15m的最高点 + 1.5×ATR(15m)
      const last3 = data15M.slice(-3);
      const lowest = Math.min(...last3.map(c => parseFloat(c[3])));
      const highest = Math.max(...last3.map(c => parseFloat(c[2])));

      // 判断趋势方向（简化判断）
      const currentPrice = parseFloat(data15M[data15M.length - 1][4]);
      const isUptrend = currentPrice > parseFloat(data15M[data15M.length - 2][4]);

      if (isUptrend) {
        return Math.max(lowest - 1.5 * atr15, entryPrice * 0.95);
      } else {
        return Math.min(highest + 1.5 * atr15, entryPrice * 1.05);
      }
    } catch (error) {
      console.error('止损计算失败:', error);
      return {
        error: error.message,
        stopLoss: ltfResult.entryPrice * 0.98 // 默认2%止损
      };
    }
  }

  /**
   * 止盈计算 - 按照ICT文档实现
   * @param {number} entry - 入场价格
   * @param {number} stopLoss - 止损价格
   * @param {number} RR - 风险回报比
   * @returns {number} 止盈价格
   */
  static calculateTakeProfit(entry, stopLoss, RR = 3) {
    try {
      const stopDist = Math.abs(entry - stopLoss);
      const isLong = entry > stopLoss;

      if (isLong) {
        return entry + (RR * stopDist);
      } else {
        return entry - (RR * stopDist);
      }
    } catch (error) {
      console.error('止盈计算失败:', error);
      return {
        error: error.message,
        takeProfit: entry * (entry > stopLoss ? 1.06 : 0.94) // 默认6%止盈
      };
    }
  }

  /**
   * 计算杠杆数据 - 按照ICT文档实现
   * @param {number} entryPrice - 入场价格
   * @param {number} stopLossPrice - 止损价格
   * @param {number} takeProfitPrice - 止盈价格
   * @param {string} direction - 交易方向
   * @param {number} maxLossAmount - 最大损失金额
   * @returns {Object} 杠杆数据
   */
  static calculateLeverageData(entryPrice, stopLossPrice, takeProfitPrice, direction = 'LONG', maxLossAmount = 100) {
    try {
      // 输入验证
      if (!entryPrice || entryPrice <= 0 || !stopLossPrice || stopLossPrice <= 0) {
        throw new Error('Invalid price parameters');
      }

      // 计算止损距离百分比
      const stopLossDistance = direction === 'LONG'
        ? (entryPrice - stopLossPrice) / entryPrice
        : (stopLossPrice - entryPrice) / entryPrice;

      // 最大杠杆 = 1 / (止损距离% + 0.5%)
      const maxLeverage = Math.floor(1 / (stopLossDistance + 0.005));

      // 最小保证金 = 最大损失金额 / (杠杆数 × 止损距离%)
      const minMargin = Math.ceil(maxLossAmount / (maxLeverage * stopLossDistance));

      // 计算ATR值
      const atrValue = Math.abs(entryPrice - stopLossPrice);

      return {
        maxLeverage: Math.max(1, Math.min(maxLeverage, 125)),
        minMargin: Math.max(10, minMargin),
        stopLossDistance: stopLossDistance * 100,
        atrValue: atrValue,
        atr14: atrValue,
        direction,
        maxLossAmount
      };
    } catch (error) {
      console.error('杠杆计算失败:', error);
      return {
        maxLeverage: 10,
        minMargin: 100,
        stopLossDistance: 2.0,
        atrValue: 0,
        atr14: 0,
        direction,
        maxLossAmount,
        error: error.message
      };
    }
  }

  /**
   * 验证交易信号
   * @param {Object} signal - 交易信号
   * @returns {Object} 验证结果
   */
  static validateSignal(signal) {
    try {
      const errors = [];

      // 检查必要字段
      if (!signal.symbol) errors.push('缺少交易对');
      if (!signal.entryPrice || signal.entryPrice <= 0) errors.push('无效入场价格');
      if (!signal.stopLoss || signal.stopLoss <= 0) errors.push('无效止损价格');
      if (!signal.takeProfit || signal.takeProfit <= 0) errors.push('无效止盈价格');

      // 检查价格逻辑
      if (signal.signalType === 'LONG') {
        if (signal.stopLoss >= signal.entryPrice) {
          errors.push('多头交易止损价格应低于入场价格');
        }
        if (signal.takeProfit <= signal.entryPrice) {
          errors.push('多头交易止盈价格应高于入场价格');
        }
      } else if (signal.signalType === 'SHORT') {
        if (signal.stopLoss <= signal.entryPrice) {
          errors.push('空头交易止损价格应高于入场价格');
        }
        if (signal.takeProfit >= signal.entryPrice) {
          errors.push('空头交易止盈价格应低于入场价格');
        }
      }

      // 检查风险回报比
      const stopDist = Math.abs(signal.entryPrice - signal.stopLoss);
      const profitDist = Math.abs(signal.takeProfit - signal.entryPrice);
      const actualRR = profitDist / stopDist;

      if (actualRR < 1.5) {
        errors.push(`风险回报比过低: ${actualRR.toFixed(2)}`);
      }

      return {
        valid: errors.length === 0,
        errors,
        actualRR: actualRR.toFixed(2)
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`验证失败: ${error.message}`],
        actualRR: 0
      };
    }
  }

  /**
   * 格式化执行信号
   * @param {string} signalType - 信号类型
   * @param {string} executionMode - 执行模式
   * @returns {string} 格式化后的执行信号
   */
  static formatExecution(signalType, executionMode) {
    if (signalType === 'NONE' || executionMode === 'NONE') {
      return 'NONE';
    }

    const direction = signalType === 'LONG' ? '做多' : '做空';
    const mode = executionMode.replace('_', '_');

    return `${direction}_${mode}`;
  }

  /**
   * 创建模拟交易记录
   * @param {Object} signal - 交易信号
   * @param {Object} options - 选项
   * @returns {Object} 模拟交易记录
   */
  static createSimulationRecord(signal, options = {}) {
    try {
      const {
        triggerReason = 'ICT_SIGNAL',
        maxLossAmount = 100
      } = options;

      const leverageData = ICTExecution.calculateLeverageData(
        signal.entryPrice,
        signal.stopLoss,
        signal.takeProfit,
        signal.signalType,
        maxLossAmount
      );

      // 检查杠杆计算是否有错误
      if (leverageData.error) {
        throw new Error(leverageData.error);
      }

      return {
        symbol: signal.symbol,
        entry_price: signal.entryPrice,
        stop_loss_price: signal.stopLoss,
        take_profit_price: signal.takeProfit,
        max_leverage: leverageData.maxLeverage,
        min_margin: leverageData.minMargin,
        position_size: leverageData.minMargin * leverageData.maxLeverage,
        risk_reward_ratio: leverageData.actualRR || 3,
        trigger_reason: triggerReason,
        signal_type: signal.signalType,
        execution_mode: signal.executionMode,
        status: 'ACTIVE',
        atr_4h: signal.mtfResult?.atr4h || 0,
        atr_15m: signal.ltfResult?.atr15 || 0,
        ob_high: signal.mtfResult?.ob?.high || 0,
        ob_low: signal.mtfResult?.ob?.low || 0,
        fvg_high: signal.mtfResult?.fvg?.high || 0,
        fvg_low: signal.mtfResult?.fvg?.low || 0,
        sweep_htf_detected: signal.mtfResult?.sweepHTF || false,
        sweep_ltf_detected: signal.ltfResult?.sweepLTF?.detected || false,
        engulfing_detected: signal.ltfResult?.engulfing?.detected || false,
        volume_confirmation: signal.ltfResult?.volumeConfirm || false,
        created_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('创建模拟交易记录失败:', error);
      return {
        error: error.message,
        symbol: signal.symbol || 'UNKNOWN',
        status: 'ERROR'
      };
    }
  }

  /**
   * ICT策略出场条件检查 - 按照ict.md文档实现
   * @param {Object} params - 出场条件参数
   * @returns {Object} 出场条件检查结果
   */
  checkExitConditions(params) {
    try {
      return this.exitConditions.checkICTExitConditions(params);
    } catch (error) {
      console.error('ICT出场条件检查失败:', error);
      return { 
        exit: false, 
        reason: 'ERROR', 
        exitPrice: null,
        description: `检查失败: ${error.message}`
      };
    }
  }
}

module.exports = ICTExecution;
