/**
 * 美股模拟交易服务
 * 记录模拟交易到数据库
 */

const DatabaseConnection = require('../database/database-connection');
const logger = require('../utils/logger');

class USStockSimulationTrades {
  constructor() {
    this.database = DatabaseConnection.getInstance();
  }

  /**
   * 创建模拟订单
   */
  async createTrade(order) {
    try {
      const orderId = order.orderId || `SIM_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date();

      const sql = `
        INSERT INTO us_stock_trades 
        (order_id, symbol, side, type, quantity, price, stop_price, status, 
         filled_quantity, avg_fill_price, entry_price, strategy_name, strategy_mode, 
         stop_loss, take_profit, created_at, filled_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.database.query(sql, [
        orderId,
        order.symbol,
        order.side,
        order.type || 'MARKET',
        order.quantity,
        order.price,
        order.stopPrice || null,
        'FILLED',  // 模拟订单直接成交
        order.quantity,
        order.price,
        order.price,  // entry_price
        order.strategyName || 'UNKNOWN',
        order.strategyMode || 'BALANCED',
        order.stopLoss || null,
        order.takeProfit || null,
        now,
        now
      ]);

      logger.info(`[USStockSimulationTrades] Created trade: ${orderId} for ${order.symbol}`);

      return {
        orderId,
        symbol: order.symbol,
        side: order.side,
        quantity: order.quantity,
        price: order.price,
        status: 'FILLED'
      };

    } catch (error) {
      logger.error('[USStockSimulationTrades] Failed to create trade:', error);
      throw error;
    }
  }

  /**
   * 平仓
   */
  async closeTrade(orderId, exitPrice) {
    try {
      const sql = `
        UPDATE us_stock_trades
        SET exit_price = ?,
            closed_at = NOW(),
            status = 'FILLED'
        WHERE order_id = ?
      `;

      await this.database.query(sql, [exitPrice, orderId]);

      logger.info(`[USStockSimulationTrades] Closed trade: ${orderId} at ${exitPrice}`);

    } catch (error) {
      logger.error(`[USStockSimulationTrades] Failed to close trade ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * 更新PnL
   */
  async updatePnL(orderId, realizedPnl, unrealizedPnl = 0) {
    try {
      const sql = `
        UPDATE us_stock_trades
        SET realized_pnl = ?,
            unrealized_pnl = ?
        WHERE order_id = ?
      `;

      await this.database.query(sql, [realizedPnl, unrealizedPnl, orderId]);

    } catch (error) {
      logger.error(`[USStockSimulationTrades] Failed to update PnL for ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * 获取未平仓订单
   */
  async getOpenTrades(symbol = null) {
    try {
      let sql = `
        SELECT * FROM us_stock_trades
        WHERE status = 'FILLED' AND exit_price IS NULL
      `;

      const params = [];

      if (symbol) {
        sql += ' AND symbol = ?';
        params.push(symbol);
      }

      sql += ' ORDER BY created_at DESC';

      const trades = await this.database.query(sql, params);
      return trades;

    } catch (error) {
      logger.error('[USStockSimulationTrades] Failed to get open trades:', error);
      return [];
    }
  }

  /**
   * 计算PnL
   */
  calculatePnL(trade, currentPrice) {
    const entryPrice = parseFloat(trade.entry_price);
    const quantity = parseFloat(trade.filled_quantity);

    if (trade.side === 'BUY') {
      // 做多盈亏
      return (currentPrice - entryPrice) * quantity;
    } else {
      // 做空盈亏
      return (entryPrice - currentPrice) * quantity;
    }
  }

  /**
   * 批量计算未平仓订单的PnL
   */
  async calculateOpenTradesPnL(symbol = null, currentPrice) {
    try {
      const openTrades = await this.getOpenTrades(symbol);

      for (const trade of openTrades) {
        const unrealizedPnl = this.calculatePnL(trade, currentPrice);
        await this.updatePnL(trade.order_id, 0, unrealizedPnl);
      }

      return openTrades.length;

    } catch (error) {
      logger.error('[USStockSimulationTrades] Failed to calculate open trades PnL:', error);
      return 0;
    }
  }

  /**
   * 获取交易历史
   */
  async getTradeHistory(symbol, limit = 100) {
    try {
      const sql = `
        SELECT * FROM us_stock_trades
        WHERE symbol = ?
        ORDER BY created_at DESC
        LIMIT ?
      `;

      const trades = await this.database.query(sql, [symbol, limit]);
      return trades;

    } catch (error) {
      logger.error(`[USStockSimulationTrades] Failed to get trade history for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * 保存回测结果
   */
  async saveBacktestResult(result) {
    try {
      const sql = `
        INSERT INTO us_stock_backtest_results
        (strategy_name, strategy_mode, symbol, start_date, end_date,
         total_trades, winning_trades, losing_trades, win_rate,
         total_profit, total_loss, net_pnl, max_drawdown, sharpe_ratio,
         profit_factor, avg_win, avg_loss, avg_holding_period)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.database.query(sql, [
        result.strategy_name,
        result.strategy_mode || 'BALANCED',
        result.symbol,
        result.start_date,
        result.end_date,
        result.total_trades || 0,
        result.winning_trades || 0,
        result.losing_trades || 0,
        result.win_rate || 0,
        result.total_profit || 0,
        result.total_loss || 0,
        result.net_pnl || 0,
        result.max_drawdown || 0,
        result.sharpe_ratio || 0,
        result.profit_factor || 0,
        result.avg_win || 0,
        result.avg_loss || 0,
        result.avg_holding_period || 0
      ]);

      logger.info(`[USStockSimulationTrades] Saved backtest result for ${result.strategy_name}`);

    } catch (error) {
      logger.error('[USStockSimulationTrades] Failed to save backtest result:', error);
      throw error;
    }
  }

  /**
   * 获取回测结果
   */
  async getBacktestResults(strategyName, symbol = null) {
    try {
      let sql = `
        SELECT * FROM us_stock_backtest_results
        WHERE strategy_name = ?
      `;

      const params = [strategyName];

      if (symbol) {
        sql += ' AND symbol = ?';
        params.push(symbol);
      }

      sql += ' ORDER BY created_at DESC';

      const results = await this.database.query(sql, params);
      return results;

    } catch (error) {
      logger.error(`[USStockSimulationTrades] Failed to get backtest results:`, error);
      return [];
    }
  }
}

module.exports = USStockSimulationTrades;

