/**
 * ICT 仓位监控服务
 * 定期检查所有活跃的 ICT 交易并执行仓位管理逻辑
 */

const logger = require('../utils/logger');
const { manageTrade, calculateUnrealizedPnl, formatHours } = require('./ict-position-manager');
const FundingRateCalculator = require('../utils/funding-rate-calculator');

class ICTPositionMonitor {
  constructor(database, binanceAPI) {
    this.database = database;
    this.binanceAPI = binanceAPI;
    this.isRunning = false;
    this.checkInterval = 5 * 60 * 1000; // 5分钟检查一次
    this.intervalId = null;
    this.fundingRateCalculator = new FundingRateCalculator();
  }

  /**
   * 启动监控服务
   */
  async start() {
    if (this.isRunning) {
      logger.warn('[ICT仓位监控] 服务已在运行');
      return;
    }

    this.isRunning = true;
    logger.info('[ICT仓位监控] 启动 ICT 仓位监控服务');

    // 立即检查一次
    await this.checkAllPositions();

    // 设置定时检查
    this.intervalId = setInterval(async () => {
      await this.checkAllPositions();
    }, this.checkInterval);
  }

  /**
   * 停止监控服务
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    logger.info('[ICT仓位监控] 停止 ICT 仓位监控服务');
  }

  /**
   * 检查所有活跃的 ICT 交易
   */
  async checkAllPositions() {
    try {
      // 获取所有 OPEN 状态的 ICT 交易
      const openTrades = await this.database.query(
        `SELECT st.*, s.symbol 
         FROM simulation_trades st 
         JOIN symbols s ON st.symbol_id = s.id 
         WHERE st.strategy_name = 'ICT' AND st.status = 'OPEN'
         ORDER BY st.entry_time ASC`
      );

      if (!openTrades || openTrades.length === 0) {
        logger.debug('[ICT仓位监控] 没有活跃的 ICT 交易');
        return;
      }

      logger.info(`[ICT仓位监控] 检查 ${openTrades.length} 个活跃 ICT 交易`);

      for (const trade of openTrades) {
        try {
          await this.checkSinglePosition(trade);
        } catch (error) {
          logger.error(`[ICT仓位监控] 检查 ${trade.symbol} 交易失败:`, error);
        }
      }
    } catch (error) {
      logger.error('[ICT仓位监控] 检查所有持仓失败:', error);
    }
  }

  /**
   * 检查单个交易
   * @param {Object} trade - 交易对象
   */
  async checkSinglePosition(trade) {
    try {
      const { id, symbol, entry_time, entry_price, stop_loss, trade_type, quantity, take_profit_1, take_profit_2 } = trade;

      // 获取当前价格
      const klines15m = await this.binanceAPI.getKlines(symbol, '15m', 2);
      if (!klines15m || klines15m.length < 1) {
        logger.warn(`[ICT仓位监控] ${symbol} 无法获取当前价格`);
        return;
      }

      const currentPrice = parseFloat(klines15m[klines15m.length - 1][4]);

      // 计算已持仓时长
      const entryDate = new Date(entry_time);
      const now = new Date();
      const timeElapsedHours = (now - entryDate) / (1000 * 60 * 60);

      // 构建交易状态
      const state = {
        plan: {
          direction: trade_type === 'LONG' ? 'long' : 'short',
          entryPrice: parseFloat(entry_price),
          stopPrice: parseFloat(stop_loss),
          stopDistance: Math.abs(parseFloat(entry_price) - parseFloat(stop_loss)),
          qty: parseFloat(quantity),
          partials: [
            { pct: 0.5, tp: parseFloat(take_profit_1), filled: trade.tp1_filled || false },
            { pct: 0.5, tp: parseFloat(take_profit_2), filled: trade.tp2_filled || false }
          ],
          breakevenMove: trade.breakeven_price ? parseFloat(trade.breakeven_price) : null
        },
        remainingQty: parseFloat(trade.remaining_quantity || quantity),
        filledPartialIndices: new Set(
          [
            trade.tp1_filled && 0,
            trade.tp2_filled && 1
          ].filter(x => x !== false)
        ),
        breakevenTriggered: trade.breakeven_triggered || false,
        trailingStopActive: trade.trailing_stop_active || false,
        trailingStopPrice: trade.trailing_stop_price ? parseFloat(trade.trailing_stop_price) : null,
        timeStopTriggered: trade.time_stop_triggered || false
      };

      // 执行仓位管理
      const config = {
        maxHoldingHours: trade.max_holding_hours || 48,
        timeExitPct: parseFloat(trade.time_stop_exit_pct || 0.5),
        trailingStopDistance: trade.atr_multiplier ? trade.stop_distance * trade.atr_multiplier : null
      };

      const actions = manageTrade({ state, price: currentPrice, timeElapsedHours, config });

      // 执行操作
      if (actions.action !== 'HOLD') {
        await this.executeActions(trade, currentPrice, actions, timeElapsedHours);
      } else {
        // 更新未实现盈亏
        const unrealizedPnl = calculateUnrealizedPnl({
          direction: state.plan.direction,
          entryPrice: state.plan.entryPrice,
          currentPrice,
          remainingQty: state.remainingQty
        });

        // 更新仓位管理状态
        await this.updatePositionManagement(trade, currentPrice, state, unrealizedPnl, timeElapsedHours);
      }

    } catch (error) {
      logger.error(`[ICT仓位监控] 检查 ${trade.symbol} 持仓失败:`, error);
    }
  }

  /**
   * 执行操作
   * @param {Object} trade - 交易对象
   * @param {number} currentPrice - 当前价格
   * @param {Object} actions - 操作指令
   * @param {number} timeElapsedHours - 已持仓时长
   */
  async executeActions(trade, currentPrice, actions, timeElapsedHours) {
    try {
      const { id, symbol } = trade;
      const { action, closeSize, newStop, note, realizedPnl } = actions;

      logger.info(`[ICT仓位监控] ${symbol} 执行操作: ${action}, 平仓数量: ${closeSize}, 原因: ${note}`);

      // 记录部分平仓
      if (action === 'PARTIAL_CLOSE' || action === 'TIME_STOP') {
        await this.recordPartialClose(trade, currentPrice, closeSize, action, note, realizedPnl);
      }

      // 更新止损
      if (newStop) {
        await this.updateStopLoss(trade, newStop);
      }

      // 更新仓位管理状态
      const state = {
        plan: {
          direction: trade.trade_type === 'LONG' ? 'long' : 'short',
          entryPrice: parseFloat(trade.entry_price),
          stopPrice: parseFloat(newStop || trade.stop_loss),
          stopDistance: Math.abs(parseFloat(trade.entry_price) - parseFloat(newStop || trade.stop_loss)),
          qty: parseFloat(trade.quantity),
          partials: [
            { pct: 0.5, tp: parseFloat(trade.take_profit_1), filled: trade.tp1_filled || false },
            { pct: 0.5, tp: parseFloat(trade.take_profit_2), filled: trade.tp2_filled || false }
          ]
        },
        remainingQty: parseFloat(trade.remaining_quantity || trade.quantity) - closeSize,
        filledPartialIndices: new Set(
          [
            trade.tp1_filled && 0,
            trade.tp2_filled && 1
          ].filter(x => x !== false)
        ),
        breakevenTriggered: trade.breakeven_triggered || false,
        trailingStopActive: trade.trailing_stop_active || false,
        trailingStopPrice: trade.trailing_stop_price ? parseFloat(trade.trailing_stop_price) : null,
        timeStopTriggered: trade.time_stop_triggered || false
      };

      const unrealizedPnl = calculateUnrealizedPnl({
        direction: state.plan.direction,
        entryPrice: state.plan.entryPrice,
        currentPrice,
        remainingQty: state.remainingQty
      });

      await this.updatePositionManagement(trade, currentPrice, state, unrealizedPnl, timeElapsedHours);

      // 如果全部平仓，更新交易状态
      if (action === 'CLOSE' || state.remainingQty <= 0.0001) {
        await this.closeTrade(trade, currentPrice, note);
      }

    } catch (error) {
      logger.error(`[ICT仓位监控] 执行操作失败:`, error);
    }
  }

  /**
   * 记录部分平仓
   */
  async recordPartialClose(trade, currentPrice, closeSize, closeType, reason, realizedPnl) {
    try {
      const closePct = closeSize / parseFloat(trade.quantity);
      const remainingQty = parseFloat(trade.remaining_quantity || trade.quantity) - closeSize;

      await this.database.query(
        `INSERT INTO ict_partial_closes 
         (trade_id, symbol_id, close_type, close_price, close_quantity, close_pct, realized_pnl, remaining_qty, close_reason) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [trade.id, trade.symbol_id, closeType, currentPrice, closeSize, closePct, realizedPnl, remainingQty, reason]
      );

      // 更新交易记录
      const updates = [];
      const values = [];

      // 更新已实现盈亏
      const newRealizedPnl = parseFloat(trade.realized_pnl || 0) + realizedPnl;
      updates.push('realized_pnl = ?');
      values.push(newRealizedPnl);

      // 更新剩余数量
      updates.push('remaining_quantity = ?');
      values.push(remainingQty);

      // 更新 TP1/TP2 状态
      if (closeType === 'TP1' || (closeType === 'PARTIAL_CLOSE' && !trade.tp1_filled)) {
        updates.push('tp1_filled = TRUE');
      }
      if (closeType === 'TP2' || (closeType === 'PARTIAL_CLOSE' && trade.tp1_filled && !trade.tp2_filled)) {
        updates.push('tp2_filled = TRUE');
      }

      // 更新时间止损状态
      if (closeType === 'TIME_STOP') {
        updates.push('time_stop_triggered = TRUE');
      }

      values.push(trade.id);

      await this.database.query(
        `UPDATE simulation_trades SET ${updates.join(', ')} WHERE id = ?`,
        values
      );

      logger.info(`[ICT仓位监控] ${trade.symbol} 部分平仓记录: ${closeSize} @ ${currentPrice}, 已实现盈亏: ${realizedPnl.toFixed(2)} USDT`);

    } catch (error) {
      logger.error(`[ICT仓位监控] 记录部分平仓失败:`, error);
    }
  }

  /**
   * 更新止损
   */
  async updateStopLoss(trade, newStop) {
    try {
      const updates = ['stop_loss = ?'];
      const values = [newStop];

      // 如果是保本点，标记保本已触发
      if (Math.abs(newStop - parseFloat(trade.breakeven_price)) < 0.01) {
        updates.push('breakeven_triggered = TRUE');
      }

      // 如果是追踪止损
      if (trade.trailing_stop_active) {
        updates.push('trailing_stop_price = ?');
        values.push(newStop);
      } else {
        updates.push('trailing_stop_active = TRUE');
        updates.push('trailing_stop_price = ?');
        values.push(newStop);
      }

      values.push(trade.id);

      await this.database.query(
        `UPDATE simulation_trades SET ${updates.join(', ')} WHERE id = ?`,
        values
      );

      logger.info(`[ICT仓位监控] ${trade.symbol} 更新止损: ${newStop}`);

    } catch (error) {
      logger.error(`[ICT仓位监控] 更新止损失败:`, error);
    }
  }

  /**
   * 更新仓位管理状态
   */
  async updatePositionManagement(trade, currentPrice, state, unrealizedPnl, timeElapsedHours) {
    try {
      const realizedPnl = parseFloat(trade.realized_pnl || 0);

      // 更新或插入仓位管理状态
      await this.database.query(
        `INSERT INTO ict_position_management 
         (trade_id, symbol_id, current_price, remaining_qty, realized_pnl, unrealized_pnl, 
          tp1_filled, tp2_filled, breakeven_triggered, trailing_stop_active, trailing_stop_price, 
          time_elapsed_hours, time_stop_triggered) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         current_price = VALUES(current_price),
         remaining_qty = VALUES(remaining_qty),
         realized_pnl = VALUES(realized_pnl),
         unrealized_pnl = VALUES(unrealized_pnl),
         tp1_filled = VALUES(tp1_filled),
         tp2_filled = VALUES(tp2_filled),
         breakeven_triggered = VALUES(breakeven_triggered),
         trailing_stop_active = VALUES(trailing_stop_active),
         trailing_stop_price = VALUES(trailing_stop_price),
         time_elapsed_hours = VALUES(time_elapsed_hours),
         time_stop_triggered = VALUES(time_stop_triggered)`,
        [
          trade.id, trade.symbol_id, currentPrice, state.remainingQty, realizedPnl, unrealizedPnl,
          state.filledPartialIndices.has(0), state.filledPartialIndices.has(1),
          state.breakevenTriggered, state.trailingStopActive, state.trailingStopPrice,
          timeElapsedHours, state.timeStopTriggered
        ]
      );

      // 更新交易记录的未实现盈亏
      await this.database.query(
        `UPDATE simulation_trades SET unrealized_pnl = ? WHERE id = ?`,
        [unrealizedPnl, trade.id]
      );

    } catch (error) {
      logger.error(`[ICT仓位监控] 更新仓位管理状态失败:`, error);
    }
  }

  /**
   * 关闭交易
   */
  async closeTrade(trade, exitPrice, reason) {
    try {
      const realizedPnl = parseFloat(trade.realized_pnl || 0);
      const unrealizedPnl = parseFloat(trade.unrealized_pnl || 0);
      const rawPnl = realizedPnl + unrealizedPnl;

      // 计算持仓时长（小时）
      const entryTime = new Date(trade.entry_time);
      const exitTime = new Date();
      const holdHours = (exitTime - entryTime) / (1000 * 60 * 60);

      // 计算资金费率和利率成本
      const costsResult = this.fundingRateCalculator.calculateCostsOnly({
        positionSize: parseFloat(trade.margin_used),
        holdHours: holdHours,
        fundingRate: parseFloat(trade.funding_rate || 0.0001),
        interestRate: parseFloat(trade.interest_rate || 0.01),
        feeRate: parseFloat(trade.fee_rate || 0.0004)
      });

      // 实际盈亏 = 原始盈亏 - 总成本
      const netPnl = rawPnl - costsResult.totalCost;
      const pnlPercentage = (rawPnl / parseFloat(trade.margin_used)) * 100;
      const netPnlPercentage = (netPnl / parseFloat(trade.margin_used)) * 100;

      await this.database.query(
        `UPDATE simulation_trades 
         SET status = 'CLOSED', 
             exit_price = ?, 
             exit_time = NOW(),
             pnl = ?,
             pnl_percentage = ?,
             exit_reason = ?,
             hold_hours = ?,
             funding_cost = ?,
             interest_cost = ?,
             fee_cost = ?,
             raw_pnl = ?,
             net_pnl = ?
         WHERE id = ?`,
        [
          exitPrice,
          rawPnl,
          pnlPercentage,
          reason,
          holdHours,
          costsResult.fundingCost,
          costsResult.interestCost,
          costsResult.feeCost,
          rawPnl,
          netPnl,
          trade.id
        ]
      );

      logger.info(`[ICT仓位监控] ${trade.symbol} 交易已关闭:`);
      logger.info(`  原始盈亏: ${rawPnl.toFixed(2)} USDT (${pnlPercentage.toFixed(2)}%)`);
      logger.info(`  实际盈亏: ${netPnl.toFixed(2)} USDT (${netPnlPercentage.toFixed(2)}%)`);
      logger.info(`  成本明细: 手续费=${costsResult.feeCost.toFixed(2)}, 资金费=${costsResult.fundingCost.toFixed(2)}, 利息=${costsResult.interestCost.toFixed(2)}`);
      logger.info(`  持仓时长: ${holdHours.toFixed(2)} 小时`);

      // 更新统计（使用实际盈亏）
      await this.updateStats(trade, netPnl, netPnl > 0);

    } catch (error) {
      logger.error(`[ICT仓位监控] 关闭交易失败:`, error);
    }
  }

  /**
   * 更新统计
   */
  async updateStats(trade, pnl, isWin) {
    try {
      // 这里可以更新 ICT 策略统计表
      // 暂时先不实现，后续可以添加
    } catch (error) {
      logger.error(`[ICT仓位监控] 更新统计失败:`, error);
    }
  }
}

module.exports = ICTPositionMonitor;

