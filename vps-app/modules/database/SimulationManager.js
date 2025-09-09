// modules/database/SimulationManager.js
// 模拟交易管理模块

const BinanceAPI = require('../api/BinanceAPI');

class SimulationManager {
  constructor(db) {
    this.db = db;
    // 移除activeSimulations Map，直接从数据库查询，避免重复存储
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
    const { entry_price, stop_loss_price, take_profit_price, trigger_reason } = simulation;

    // 根据交易方向判断止损和止盈条件
    if (trigger_reason.includes('LONG')) {
      // 多头交易：价格跌破止损价则止损，价格突破止盈价则止盈
      if (currentPrice <= stop_loss_price) {
        return { shouldExit: true, reason: 'STOP_LOSS', exitPrice: stop_loss_price };
      }
      if (currentPrice >= take_profit_price) {
        return { shouldExit: true, reason: 'TAKE_PROFIT', exitPrice: take_profit_price };
      }
    } else if (trigger_reason.includes('SHORT')) {
      // 空头交易：价格突破止损价则止损，价格跌破止盈价则止盈
      if (currentPrice >= stop_loss_price) {
        return { shouldExit: true, reason: 'STOP_LOSS', exitPrice: stop_loss_price };
      }
      if (currentPrice <= take_profit_price) {
        return { shouldExit: true, reason: 'TAKE_PROFIT', exitPrice: take_profit_price };
      }
    }

    // 只有止盈或止损才能结束交易，没有时间限制
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

      // 根据出场原因确定正确的出场价格
      let actualExitPrice = exitPrice;
      if (exitReason === 'STOP_LOSS') {
        actualExitPrice = parseFloat(sim.stop_loss_price.toFixed(4));
      } else if (exitReason === 'TAKE_PROFIT') {
        actualExitPrice = parseFloat(sim.take_profit_price.toFixed(4));
      } else {
        actualExitPrice = parseFloat(exitPrice.toFixed(4));
      }

      // 计算盈亏
      const profitLoss = this.calculateProfitLoss(sim, actualExitPrice);

      // 根据实际盈亏结果判断胜负
      const isWin = profitLoss > 0;

      // 更新数据库
      await this.db.run(
        `UPDATE simulations SET 
         status = ?, closed_at = ?, exit_price = ?, exit_reason = ?, is_win = ?, profit_loss = ?
         WHERE id = ?`,
        ['CLOSED', new Date().toISOString(), actualExitPrice, exitReason, isWin, profitLoss, simulationId]
      );

      // 更新胜率统计
      await this.updateWinRateStats();

      console.log(`✅ 模拟交易 ${simulationId} 已关闭: ${exitReason}, 出场价: ${actualExitPrice}, 盈亏: ${profitLoss.toFixed(2)}U`);
    } catch (error) {
      console.error('关闭模拟交易时出错:', error);
    }
  }

  calculateProfitLoss(simulation, exitPrice) {
    const { entry_price, max_leverage, min_margin, direction } = simulation;

    let priceChange;
    if (direction === 'LONG') {
      // 做多：价格上涨为盈利
      priceChange = (exitPrice - entry_price) / entry_price;
    } else if (direction === 'SHORT') {
      // 做空：价格下跌为盈利
      priceChange = (entry_price - exitPrice) / entry_price;
    } else {
      // 兼容旧数据，假设为做多
      priceChange = (exitPrice - entry_price) / entry_price;
    }

    const leveragedReturn = priceChange * max_leverage;
    return parseFloat((min_margin * leveragedReturn).toFixed(4));
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
      // 确保价格保留4位小数
      const formattedEntryPrice = parseFloat(entryPrice.toFixed(4));
      const formattedStopLossPrice = parseFloat(stopLossPrice.toFixed(4));
      const formattedTakeProfitPrice = parseFloat(takeProfitPrice.toFixed(4));

      // 根据triggerReason判断交易方向
      let direction = 'SHORT'; // 默认空头
      if (triggerReason.includes('多头') || triggerReason.includes('LONG')) {
        direction = 'LONG';
      } else if (triggerReason.includes('空头') || triggerReason.includes('SHORT')) {
        direction = 'SHORT';
      }

      const result = await this.db.run(`
        INSERT INTO simulations 
        (symbol, entry_price, stop_loss_price, take_profit_price, max_leverage, min_margin, trigger_reason, status, stop_loss_distance, atr_value, direction)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [symbol, formattedEntryPrice, formattedStopLossPrice, formattedTakeProfitPrice, maxLeverage, minMargin, triggerReason, 'ACTIVE', stopLossDistance, atrValue, direction]);

      console.log(`✅ 创建模拟交易: ${symbol}, 入场价: ${formattedEntryPrice}, 止损: ${formattedStopLossPrice}, 止盈: ${formattedTakeProfitPrice}, 杠杆: ${maxLeverage}x, 保证金: ${minMargin}, 止损距离: ${stopLossDistance}%, ATR: ${atrValue}`);
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

  async getRecentSimulations(minutes = 5) {
    try {
      const history = await this.db.runQuery(`
        SELECT * FROM simulations 
        WHERE created_at >= datetime('now', '-${minutes} minutes')
        ORDER BY created_at DESC
      `);
      return history;
    } catch (error) {
      console.error('获取最近模拟交易记录失败:', error);
      return [];
    }
  }

  // 更新模拟交易状态（价格监控和结果判断）
  async updateSimulationStatus(symbol, currentPrice, dataMonitor = null, analysisData = null) {
    try {
      // 获取该交易对的所有活跃模拟交易
      const activeSimulations = await this.db.runQuery(`
        SELECT * FROM simulations 
        WHERE symbol = ? AND status = 'ACTIVE'
        ORDER BY created_at DESC
      `, [symbol]);

      let completedCount = 0;

      for (const sim of activeSimulations) {
        // 使用新的出场检查逻辑
        const exitResult = this.checkExitConditions(sim, currentPrice, analysisData);

        if (exitResult.exit) {
          const profitLoss = this.calculateProfitLoss(sim, exitResult.exitPrice);
          const isWin = profitLoss > 0;

          await this.db.run(`
            UPDATE simulations 
            SET status = 'CLOSED', 
                closed_at = datetime('now'), 
                exit_price = ?, 
                exit_reason = ?, 
                is_win = ?, 
                profit_loss = ?
            WHERE id = ?
          `, [exitResult.exitPrice, exitResult.reason, isWin, profitLoss, sim.id]);

          // 记录模拟交易完成
          if (dataMonitor) {
            dataMonitor.recordSimulation(symbol, 'COMPLETED', {
              simulationId: sim.id,
              exitReason: exitResult.reason,
              isWin,
              profitLoss
            }, true);
          }

          completedCount++;
          console.log(`✅ 模拟交易平仓: ${sim.symbol} - ${exitResult.reason} - ${isWin ? '盈利' : '亏损'} ${profitLoss.toFixed(2)} USDT`);
        }
      }

      return { activeCount: activeSimulations.length, completedCount };
    } catch (error) {
      console.error('更新模拟交易状态失败:', error);
      throw error;
    }
  }

  /**
   * 出场判断（严格按照strategy-v2.md文档实现）
   * @param {Object} sim - 模拟交易记录
   * @param {number} currentPrice - 当前价格
   * @param {Object} analysisData - 分析数据
   * @returns {Object} { exit: boolean, reason: string, exitPrice: number }
   */
  checkExitConditions(sim, currentPrice, analysisData = null) {
    const position = sim.direction === 'LONG' ? 'long' : 'short';
    const entryPrice = parseFloat(sim.entry_price);
    const stopLoss = parseFloat(sim.stop_loss_price);
    const takeProfit = parseFloat(sim.take_profit_price);
    const atr14 = parseFloat(sim.atr_value);

    // 计算已持仓时间（15分钟K线数）
    const createdTime = new Date(sim.created_at);
    const now = new Date();
    const timeInPosition = Math.floor((now - createdTime) / (15 * 60 * 1000)); // 15分钟K线数
    const maxTimeInPosition = 12; // 最大允许12根15m K线（3小时）

    // 从分析数据中获取必要信息
    let score1h = 0;
    let trend4h = '震荡';
    let deltaBuy = 0;
    let deltaSell = 0;
    let ema20 = 0;
    let ema50 = 0;
    let prevHigh = 0;
    let prevLow = 0;

    if (analysisData) {
      score1h = analysisData.hourlyConfirmation?.score || 0;
      trend4h = analysisData.trend4h?.trend === 'UPTREND' ? '多头' :
        analysisData.trend4h?.trend === 'DOWNTREND' ? '空头' : '震荡';

      // 从Delta数据获取买卖盘信息
      if (analysisData.deltaData) {
        deltaBuy = analysisData.deltaData.deltaBuy || 0;
        deltaSell = analysisData.deltaData.deltaSell || 0;
      }

      // 从技术指标获取EMA和价格信息
      if (analysisData.indicators) {
        ema20 = analysisData.indicators.EMA20?.value || 0;
        ema50 = analysisData.indicators.EMA50?.value || 0;
      }

      // 从K线数据获取前高前低
      if (analysisData.rawData && analysisData.rawData['15m K线']?.data) {
        const klines15m = analysisData.rawData['15m K线'].data;
        if (klines15m.length > 0) {
          const recentKlines = klines15m.slice(-20); // 最近20根K线
          prevHigh = Math.max(...recentKlines.map(k => parseFloat(k.high)));
          prevLow = Math.min(...recentKlines.map(k => parseFloat(k.low)));
        }
      }
    }

    // 1️⃣ 止损触发
    if ((position === 'long' && currentPrice <= stopLoss) ||
      (position === 'short' && currentPrice >= stopLoss)) {
      return { exit: true, reason: 'STOP_LOSS', exitPrice: stopLoss };
    }

    // 2️⃣ 止盈触发
    if ((position === 'long' && currentPrice >= takeProfit) ||
      (position === 'short' && currentPrice <= takeProfit)) {
      return { exit: true, reason: 'TAKE_PROFIT', exitPrice: takeProfit };
    }

    // 3️⃣ 趋势反转
    if ((position === 'long' && (trend4h !== '多头' || score1h < 3)) ||
      (position === 'short' && (trend4h !== '空头' || score1h < 3))) {
      return { exit: true, reason: 'TREND_REVERSAL', exitPrice: currentPrice };
    }

    // 4️⃣ Delta / 买卖盘减弱
    if ((position === 'long' && deltaBuy / (deltaSell || 1) < 1.1) ||
      (position === 'short' && deltaSell / (deltaBuy || 1) < 1.1)) {
      return { exit: true, reason: 'DELTA_WEAKENING', exitPrice: currentPrice };
    }

    // 5️⃣ 价格跌破关键支撑 / 突破关键阻力
    if ((position === 'long' && (currentPrice < ema20 || currentPrice < ema50 || currentPrice < prevLow)) ||
      (position === 'short' && (currentPrice > ema20 || currentPrice > ema50 || currentPrice > prevHigh))) {
      return { exit: true, reason: 'SUPPORT_RESISTANCE_BREAK', exitPrice: currentPrice };
    }

    // 6️⃣ 时间止损
    if (timeInPosition >= maxTimeInPosition) {
      return { exit: true, reason: 'TIME_STOP', exitPrice: currentPrice };
    }

    // 否则继续持仓
    return { exit: false, reason: '', exitPrice: null };
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
