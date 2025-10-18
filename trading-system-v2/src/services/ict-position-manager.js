/**
 * ICT 策略仓位管理器
 * 基于 ict-plus-2.0.md 文档的优化方案
 * 实现分层止盈、时间止损、移动止损、保本等功能
 */

const logger = require('../utils/logger');

/**
 * 计算每单头寸数量（合约数量或币数）
 * @param {Object} params - 参数对象
 * @param {number} params.accountBalance - 总账户资金（USDT）
 * @param {number} params.riskPercent - 每单风险百分比（0.01 = 1%）
 * @param {number} params.entryPrice - 入场价格
 * @param {number} params.stopPrice - 止损价格
 * @returns {Object} { riskCash, stopDistance, qty }
 */
function calculatePositionSize({ accountBalance, riskPercent, entryPrice, stopPrice }) {
  // 风险现金 = 账户余额 × 风险百分比
  const riskCash = accountBalance * riskPercent;
  
  // 止损距离 = |入场价格 - 止损价格|
  const stopDistance = Math.abs(entryPrice - stopPrice);
  
  // 数量 = 风险现金 / 止损距离
  const qty = stopDistance === 0 ? 0 : riskCash / stopDistance;
  
  return {
    riskCash: roundTo(riskCash, 8),
    stopDistance: roundTo(stopDistance, 8),
    qty: roundTo(qty, 8)
  };
}

/**
 * 生成交易计划：止损 / 分层止盈（TP1/TP2）/ 保本点
 * @param {Object} params - 参数对象
 * @param {string} params.direction - 方向 'long' 或 'short'
 * @param {number} params.entryPrice - 入场价格
 * @param {number} params.stopPrice - 止损价格
 * @param {number} params.qty - 数量
 * @param {Array<number>} params.profitMultipliers - 止盈倍数数组，默认 [2, 3]
 * @returns {Object} 交易计划
 */
function buildTradePlan({ direction, entryPrice, stopPrice, qty, profitMultipliers = [2, 3] }) {
  const stopDistance = Math.abs(entryPrice - stopPrice);
  
  // 计算分层止盈位
  const tps = profitMultipliers.map(m => {
    if (direction === 'long') {
      return roundTo(entryPrice + m * stopDistance, 8);
    } else {
      return roundTo(entryPrice - m * stopDistance, 8);
    }
  });
  
  // 默认分批：50% 在 TP1，50% 在 TP2
  const partials = [
    { pct: 0.5, tp: tps[0], filled: false },
    { pct: 0.5, tp: tps[1], filled: false }
  ];
  
  // 保本点 = entry + 0.25 * stopDistance
  const breakevenMove = direction === 'long' 
    ? roundTo(entryPrice + 0.25 * stopDistance, 8)
    : roundTo(entryPrice - 0.25 * stopDistance, 8);
  
  // 计算风险回报比
  const rr_at_tp1 = roundTo((tps[0] - entryPrice) / stopDistance, 4);
  
  return {
    direction,
    entryPrice,
    stopPrice,
    stopDistance: roundTo(stopDistance, 8),
    qty,
    tps,
    partials,
    breakevenMove,
    rr_at_tp1,
    profitMultipliers
  };
}

/**
 * 管理已开仓的交易
 * @param {Object} params - 参数对象
 * @param {Object} params.state - 交易状态
 * @param {number} params.price - 当前市场价格
 * @param {number} params.timeElapsedHours - 已持仓时长（小时）
 * @param {Object} params.config - 配置对象
 * @returns {Object} 操作指令 { closeSize, newStop, note, action }
 */
function manageTrade({ state, price, timeElapsedHours, config = {} }) {
  const {
    maxHoldingHours = 48,
    timeExitPct = 0.5,
    trailingStopDistance = null
  } = config;
  
  const plan = state.plan;
  let actions = { 
    closeSize: 0, 
    newStop: null, 
    note: '', 
    action: 'HOLD',
    realizedPnl: 0
  };
  
  // 1) 检查止损
  if (plan.direction === 'long') {
    if (price <= plan.stopPrice) {
      actions.closeSize = state.remainingQty;
      actions.note = 'Hit stop-loss';
      actions.action = 'CLOSE';
      return actions;
    }
  } else {
    if (price >= plan.stopPrice) {
      actions.closeSize = state.remainingQty;
      actions.note = 'Hit stop-loss (short)';
      actions.action = 'CLOSE';
      return actions;
    }
  }
  
  // 2) 检查追踪止损
  if (state.trailingStopActive && state.trailingStopPrice) {
    if (plan.direction === 'long') {
      if (price <= state.trailingStopPrice) {
        actions.closeSize = state.remainingQty;
        actions.note = 'Hit trailing stop';
        actions.action = 'CLOSE';
        return actions;
      }
    } else {
      if (price >= state.trailingStopPrice) {
        actions.closeSize = state.remainingQty;
        actions.note = 'Hit trailing stop (short)';
        actions.action = 'CLOSE';
        return actions;
      }
    }
  }
  
  // 3) 检查 TP 命中
  for (let i = 0; i < plan.partials.length; i++) {
    if (state.filledPartialIndices.has(i)) continue;
    
    const p = plan.partials[i];
    const tpHit = (plan.direction === 'long' && price >= p.tp) || 
                  (plan.direction === 'short' && price <= p.tp);
    
    if (tpHit) {
      const closeQty = roundTo(state.remainingQty * p.pct, 8);
      state.remainingQty = roundTo(state.remainingQty - closeQty, 8);
      state.filledPartialIndices.add(i);
      
      // 计算已实现盈亏
      const pnl = plan.direction === 'long' 
        ? (price - plan.entryPrice) * closeQty
        : (plan.entryPrice - price) * closeQty;
      
      actions.realizedPnl = roundTo(pnl, 8);
      actions.closeSize = closeQty;
      actions.action = 'PARTIAL_CLOSE';
      
      // 达到 TP1 后，移动止损到保本点
      if (i === 0) {
        actions.newStop = plan.breakevenMove;
        actions.note = `Partial ${(p.pct * 100).toFixed(0)}% taken at TP${i + 1} (${price.toFixed(2)}); move stop to breakeven (${plan.breakevenMove.toFixed(2)})`;
        state.breakevenTriggered = true;
      } else {
        actions.note = `Partial ${(p.pct * 100).toFixed(0)}% taken at TP${i + 1} (${price.toFixed(2)})`;
      }
      
      // 如果所有 TP 都平仓了，关闭剩余仓位
      if (state.filledPartialIndices.size === plan.partials.length) {
        actions.closeSize = state.remainingQty;
        actions.action = 'CLOSE';
        actions.note += '; All TPs hit, closing remaining position';
      }
      
      return actions;
    }
  }
  
  // 4) 检查时间止损
  if (timeElapsedHours >= maxHoldingHours && !state.timeStopTriggered) {
    const closeQty = roundTo(state.remainingQty * timeExitPct, 8);
    state.remainingQty = roundTo(state.remainingQty - closeQty, 8);
    state.timeStopTriggered = true;
    
    actions.closeSize = closeQty;
    actions.newStop = plan.breakevenMove; // 收紧剩余仓位的止损
    actions.action = 'TIME_STOP';
    actions.note = `Time-exit: closed ${(timeExitPct * 100).toFixed(0)}% after ${timeElapsedHours.toFixed(1)}h`;
    
    return actions;
  }
  
  // 5) 更新追踪止损
  if (trailingStopDistance && state.breakevenTriggered && !state.trailingStopActive) {
    const newTrailingStop = plan.direction === 'long'
      ? roundTo(price - trailingStopDistance, 8)
      : roundTo(price + trailingStopDistance, 8);
    
    // 追踪止损必须优于当前止损
    if (plan.direction === 'long' && newTrailingStop > plan.stopPrice) {
      actions.newStop = newTrailingStop;
      state.trailingStopPrice = newTrailingStop;
      state.trailingStopActive = true;
      actions.note = `Trailing stop activated at ${newTrailingStop.toFixed(2)}`;
      actions.action = 'UPDATE_STOP';
    } else if (plan.direction === 'short' && newTrailingStop < plan.stopPrice) {
      actions.newStop = newTrailingStop;
      state.trailingStopPrice = newTrailingStop;
      state.trailingStopActive = true;
      actions.note = `Trailing stop activated at ${newTrailingStop.toFixed(2)}`;
      actions.action = 'UPDATE_STOP';
    }
  }
  
  // 6) 更新追踪止损价格（如果已激活）
  if (state.trailingStopActive && trailingStopDistance) {
    const newTrailingStop = plan.direction === 'long'
      ? roundTo(price - trailingStopDistance, 8)
      : roundTo(price + trailingStopDistance, 8);
    
    // 只向上移动追踪止损
    if (plan.direction === 'long' && newTrailingStop > state.trailingStopPrice) {
      actions.newStop = newTrailingStop;
      state.trailingStopPrice = newTrailingStop;
      actions.note = `Trailing stop updated to ${newTrailingStop.toFixed(2)}`;
      actions.action = 'UPDATE_STOP';
    } else if (plan.direction === 'short' && newTrailingStop < state.trailingStopPrice) {
      actions.newStop = newTrailingStop;
      state.trailingStopPrice = newTrailingStop;
      actions.note = `Trailing stop updated to ${newTrailingStop.toFixed(2)}`;
      actions.action = 'UPDATE_STOP';
    }
  }
  
  // 7) 无操作
  if (actions.action === 'HOLD') {
    actions.note = 'No action';
  }
  
  return actions;
}

/**
 * 计算未实现盈亏
 * @param {Object} params - 参数对象
 * @param {string} params.direction - 方向 'long' 或 'short'
 * @param {number} params.entryPrice - 入场价格
 * @param {number} params.currentPrice - 当前价格
 * @param {number} params.remainingQty - 剩余数量
 * @returns {number} 未实现盈亏
 */
function calculateUnrealizedPnl({ direction, entryPrice, currentPrice, remainingQty }) {
  const pnl = direction === 'long'
    ? (currentPrice - entryPrice) * remainingQty
    : (entryPrice - currentPrice) * remainingQty;
  
  return roundTo(pnl, 8);
}

/**
 * 计算当前风险回报比
 * @param {Object} params - 参数对象
 * @param {string} params.direction - 方向 'long' 或 'short'
 * @param {number} params.entryPrice - 入场价格
 * @param {number} params.currentPrice - 当前价格
 * @param {number} params.stopDistance - 止损距离
 * @returns {number} 当前 RR 比
 */
function calculateCurrentRR({ direction, entryPrice, currentPrice, stopDistance }) {
  const profit = Math.abs(currentPrice - entryPrice);
  const rr = profit / stopDistance;
  return roundTo(rr, 4);
}

/**
 * 四舍五入到指定小数位
 * @param {number} x - 数值
 * @param {number} decimals - 小数位数
 * @returns {number} 四舍五入后的数值
 */
function roundTo(x, decimals = 8) {
  const p = Math.pow(10, decimals);
  return Math.round(x * p) / p;
}

/**
 * 格式化时间（小时）
 * @param {number} hours - 小时数
 * @returns {string} 格式化后的时间字符串
 */
function formatHours(hours) {
  if (hours < 1) {
    return `${Math.round(hours * 60)}分钟`;
  } else if (hours < 24) {
    return `${hours.toFixed(1)}小时`;
  } else {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}天${remainingHours.toFixed(1)}小时`;
  }
}

module.exports = {
  calculatePositionSize,
  buildTradePlan,
  manageTrade,
  calculateUnrealizedPnl,
  calculateCurrentRR,
  roundTo,
  formatHours
};

