// modules/database/SimulationManager.js
// 模拟交易管理模块

const BinanceAPI = require('../api/BinanceAPI');

class SimulationManager {
  constructor(db) {
    this.db = db;
    this.activeSimulations = new Map();
    this.priceCheckInterval = null;
  }

  startPriceMonitoring() {
    if (this.priceCheckInterval) {
      clearInterval(this.priceCheckInterval);
    }

    this.priceCheckInterval = setInterval(() => {
      this.checkActiveSimulations();
    }, 5000); // 每5秒检查一次
  }

  async checkActiveSimulations() {
    try {
      const activeSims = await this.db.runQuery(
        'SELECT * FROM simulations WHERE status = ?',
        ['ACTIVE']
      );

      for (const simulation of activeSims) {
        const currentPrice = await this.getCurrentPrice(simulation.symbol);
        if (currentPrice) {
          const exitConditions = this.checkExitConditions(simulation, currentPrice);
          if (exitConditions.shouldExit) {
            await this.closeSimulation(
              simulation.id,
              currentPrice,
              exitConditions.reason
            );
          }
        }
      }
    } catch (error) {
      console.error('检查活跃模拟交易时出错:', error);
    }
  }

  async getCurrentPrice(symbol) {
    try {
      const ticker = await BinanceAPI.get24hrTicker(symbol);
      return parseFloat(ticker.lastPrice);
    } catch (error) {
      console.error(`获取 ${symbol} 当前价格失败:`, error);
      return null;
    }
  }

  checkExitConditions(simulation, currentPrice) {
    const { entry_price, stop_loss_price, take_profit_price, created_at } = simulation;
    const entryTime = new Date(created_at);
    const now = new Date();
    const hoursSinceEntry = (now - entryTime) / (1000 * 60 * 60);

    // 止损条件
    if (currentPrice <= stop_loss_price) {
      return { shouldExit: true, reason: 'STOP_LOSS' };
    }

    // 止盈条件
    if (currentPrice >= take_profit_price) {
      return { shouldExit: true, reason: 'TAKE_PROFIT' };
    }

    // 时间止损（8小时）
    if (hoursSinceEntry >= 8) {
      return { shouldExit: true, reason: 'TIME_STOP' };
    }

    return { shouldExit: false };
  }

  async closeSimulation(simulationId, exitPrice, exitReason) {
    try {
      const simulation = await this.db.runQuery(
        'SELECT * FROM simulations WHERE id = ?',
        [simulationId]
      );

      if (simulation.length === 0) {
        console.error(`模拟交易 ${simulationId} 不存在`);
        return;
      }

      const sim = simulation[0];
      const profitLoss = this.calculateProfitLoss(sim, exitPrice);
      const isWin = profitLoss > 0;

      // 更新数据库
      await this.db.run(
        `UPDATE simulations SET 
         status = ?, closed_at = ?, exit_price = ?, exit_reason = ?, is_win = ?, profit_loss = ?
         WHERE id = ?`,
        ['CLOSED', new Date().toISOString(), exitPrice, exitReason, isWin, profitLoss, simulationId]
      );

      // 更新胜率统计
      await this.updateWinRateStats();

      console.log(`✅ 模拟交易 ${simulationId} 已关闭: ${exitReason}, 盈亏: ${profitLoss.toFixed(2)}U`);
    } catch (error) {
      console.error('关闭模拟交易时出错:', error);
    }
  }

  calculateProfitLoss(simulation, exitPrice) {
    const { entry_price, max_leverage, min_margin } = simulation;
    const priceChange = (exitPrice - entry_price) / entry_price;
    const leveragedReturn = priceChange * max_leverage;
    return min_margin * leveragedReturn;
  }

  updateSimulationInDB(simulationId, exitPrice, exitReason, isWin, profitLoss) {
    return this.db.run(
      `UPDATE simulations SET 
       status = ?, closed_at = ?, exit_price = ?, exit_reason = ?, is_win = ?, profit_loss = ?
       WHERE id = ?`,
      ['CLOSED', new Date().toISOString(), exitPrice, exitReason, isWin, profitLoss, simulationId]
    );
  }

  async updateWinRateStats() {
    try {
      const stats = await this.db.runQuery(`
        SELECT 
          COUNT(*) as total_trades,
          SUM(CASE WHEN is_win = 1 THEN 1 ELSE 0 END) as winning_trades,
          SUM(CASE WHEN is_win = 0 THEN 1 ELSE 0 END) as losing_trades,
          SUM(CASE WHEN is_win = 1 THEN profit_loss ELSE 0 END) as total_profit,
          SUM(CASE WHEN is_win = 0 THEN ABS(profit_loss) ELSE 0 END) as total_loss,
          SUM(profit_loss) as net_profit
        FROM simulations 
        WHERE status = 'CLOSED'
      `);

      if (stats.length > 0) {
        const stat = stats[0];
        const winRate = stat.total_trades > 0 ? (stat.winning_trades / stat.total_trades) * 100 : 0;

        await this.db.run(`
          UPDATE win_rate_stats SET 
            total_trades = ?, winning_trades = ?, losing_trades = ?, 
            win_rate = ?, total_profit = ?, total_loss = ?, net_profit = ?,
            last_updated = ?
        `, [
          stat.total_trades, stat.winning_trades, stat.losing_trades,
          winRate, stat.total_profit, stat.total_loss, stat.net_profit,
          new Date().toISOString()
        ]);
      }
    } catch (error) {
      console.error('更新胜率统计时出错:', error);
    }
  }

  async createSimulation(symbol, entryPrice, stopLossPrice, takeProfitPrice, maxLeverage, minMargin, triggerReason = 'SIGNAL', stopLossDistance = null, atrValue = null) {
    try {
      const result = await this.db.run(`
        INSERT INTO simulations 
        (symbol, entry_price, stop_loss_price, take_profit_price, max_leverage, min_margin, trigger_reason, status, stop_loss_distance, atr_value)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [symbol, entryPrice, stopLossPrice, takeProfitPrice, maxLeverage, minMargin, triggerReason, 'ACTIVE', stopLossDistance, atrValue]);

      console.log(`✅ 创建模拟交易: ${symbol}, 入场价: ${entryPrice}, 止损: ${stopLossPrice}, 止盈: ${takeProfitPrice}, 杠杆: ${maxLeverage}x, 保证金: ${minMargin}, 止损距离: ${stopLossDistance}%, ATR: ${atrValue}`);
      return result.id;
    } catch (error) {
      console.error('创建模拟交易时出错:', error);
      throw error;
    }
  }

  async getWinRateStats() {
    try {
      const stats = await this.db.runQuery('SELECT * FROM win_rate_stats ORDER BY last_updated DESC LIMIT 1');
      return stats.length > 0 ? stats[0] : {
        total_trades: 0,
        winning_trades: 0,
        losing_trades: 0,
        win_rate: 0,
        total_profit: 0,
        total_loss: 0,
        net_profit: 0
      };
    } catch (error) {
      console.error('获取胜率统计时出错:', error);
      return null;
    }
  }

  async getSimulationHistory(limit = 50) {
    try {
      return await this.db.runQuery(`
        SELECT * FROM simulations 
        ORDER BY created_at DESC 
        LIMIT ?
      `, [limit]);
    } catch (error) {
      console.error('获取模拟交易历史时出错:', error);
      return [];
    }
  }

  // 更新模拟交易状态（价格监控和结果判断）
  async updateSimulationStatus(symbol, currentPrice, dataMonitor = null) {
    try {
      // 获取该交易对的所有活跃模拟交易
      const activeSimulations = await this.db.runQuery(`
        SELECT * FROM simulations 
        WHERE symbol = ? AND status = 'ACTIVE'
        ORDER BY created_at DESC
      `, [symbol]);

      let completedCount = 0;

      for (const sim of activeSimulations) {
        let shouldClose = false;
        let exitReason = '';
        let isWin = null;
        let profitLoss = 0;

        // 判断是否触发止损或止盈
        if (sim.trigger_reason.includes('LONG')) {
          // 多头交易
          if (currentPrice <= sim.stop_loss_price) {
            // 触发止损
            shouldClose = true;
            exitReason = '止损';
            isWin = false;
            profitLoss = -this.calculateLoss(sim.entry_price, sim.stop_loss_price, sim.min_margin, sim.max_leverage);
          } else if (currentPrice >= sim.take_profit_price) {
            // 触发止盈
            shouldClose = true;
            exitReason = '止盈';
            isWin = true;
            profitLoss = this.calculateProfit(sim.entry_price, sim.take_profit_price, sim.min_margin, sim.max_leverage);
          }
        } else if (sim.trigger_reason.includes('SHORT')) {
          // 空头交易
          if (currentPrice >= sim.stop_loss_price) {
            // 触发止损
            shouldClose = true;
            exitReason = '止损';
            isWin = false;
            profitLoss = -this.calculateLoss(sim.entry_price, sim.stop_loss_price, sim.min_margin, sim.max_leverage);
          } else if (currentPrice <= sim.take_profit_price) {
            // 触发止盈
            shouldClose = true;
            exitReason = '止盈';
            isWin = true;
            profitLoss = this.calculateProfit(sim.entry_price, sim.take_profit_price, sim.min_margin, sim.max_leverage);
          }
        }

        // 如果应该平仓，更新交易记录
        if (shouldClose) {
          await this.db.run(`
            UPDATE simulations 
            SET status = 'CLOSED', 
                closed_at = datetime('now'), 
                exit_price = ?, 
                exit_reason = ?, 
                is_win = ?, 
                profit_loss = ?
            WHERE id = ?
          `, [currentPrice, exitReason, isWin, profitLoss, sim.id]);

          // 记录模拟交易完成
          if (dataMonitor) {
            dataMonitor.recordSimulation(symbol, 'COMPLETED', {
              simulationId: sim.id,
              exitReason,
              isWin,
              profitLoss
            }, true);
          }

          completedCount++;
          console.log(`✅ 模拟交易平仓: ${sim.symbol} - ${exitReason} - ${isWin ? '盈利' : '亏损'} ${profitLoss.toFixed(2)} USDT`);
        }
      }

      return { activeCount: activeSimulations.length, completedCount };
    } catch (error) {
      console.error('更新模拟交易状态失败:', error);
      throw error;
    }
  }

  // 计算亏损金额
  calculateLoss(entryPrice, exitPrice, minMargin, maxLeverage) {
    // 亏损 = 保证金 × 杠杆 × 价格变化百分比
    const priceChangePercent = Math.abs(exitPrice - entryPrice) / entryPrice;
    return minMargin * maxLeverage * priceChangePercent;
  }

  // 计算盈利金额
  calculateProfit(entryPrice, exitPrice, minMargin, maxLeverage) {
    // 盈利 = 保证金 × 杠杆 × 价格变化百分比
    const priceChangePercent = Math.abs(exitPrice - entryPrice) / entryPrice;
    return minMargin * maxLeverage * priceChangePercent;
  }

  async cleanOldData() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30); // 保留30天数据

      await this.cleanTable('simulations', cutoffDate);
      await this.cleanTable('signal_records', cutoffDate);
      await this.cleanTable('execution_records', cutoffDate);

      console.log('✅ 旧数据清理完成');
    } catch (error) {
      console.error('清理旧数据时出错:', error);
    }
  }

  async cleanTable(tableName, cutoffDate) {
    try {
      const result = await this.db.run(
        `DELETE FROM ${tableName} WHERE created_at < ? OR timestamp < ?`,
        [cutoffDate.toISOString(), cutoffDate.toISOString()]
      );

      if (result.changes > 0) {
        console.log(`✅ 清理 ${tableName} 表: 删除 ${result.changes} 条记录`);
      }
    } catch (error) {
      console.error(`清理 ${tableName} 表时出错:`, error);
    }
  }
}

module.exports = SimulationManager;
