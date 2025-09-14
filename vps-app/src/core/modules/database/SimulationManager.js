// modules/database/SimulationManager.js
// 模拟交易管理模块

const BinanceAPI = require('../api/BinanceAPI');
const TelegramNotifier = require('../notification/TelegramNotifier');

class SimulationManager {
  constructor(db) {
    this.db = db;
    // 移除activeSimulations Map，直接从数据库查询，避免重复存储
    this.priceCheckInterval = null;
    this.telegramNotifier = null; // 将从外部设置
  }

  /**
   * 设置Telegram通知器
   * @param {TelegramNotifier} telegramNotifier - Telegram通知器实例
   */
  setTelegramNotifier(telegramNotifier) {
    this.telegramNotifier = telegramNotifier;
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
          if (exitConditions.exit) {
            await this.closeSimulation(
              simulation.id,
              exitConditions.exitPrice,
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
         status = ?, closed_at = datetime('now', '+8 hours'), exit_price = ?, exit_reason = ?, is_win = ?, profit_loss = ?
         WHERE id = ?`,
        ['CLOSED', actualExitPrice, exitReason, isWin, profitLoss, simulationId]
      );

      // 更新胜率统计
      await this.updateWinRateStats();

      console.log(`✅ 模拟交易 ${simulationId} 已关闭: ${exitReason}, 出场价: ${actualExitPrice}, 盈亏: ${profitLoss.toFixed(2)}U`);

      // 发送Telegram通知
      const simulationData = {
        id: simulationId,
        symbol: sim.symbol,
        entryPrice: sim.entry_price,
        exitPrice: actualExitPrice,
        stopLossPrice: sim.stop_loss_price,
        takeProfitPrice: sim.take_profit_price,
        direction: sim.direction,
        exitReason,
        profitLoss,
        isWin,
        duration: this.calculateDuration(sim.created_at, new Date())
      };

      // 异步发送通知，不阻塞主流程
      this.telegramNotifier.sendSimulationEndNotification(simulationData).catch(error => {
        console.error(`❌ 模拟交易结束通知发送失败: ${sim.symbol}`, error);
      });
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

  /**
   * 计算持仓时长
   */
  calculateDuration(startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟${seconds}秒`;
    } else {
      return `${seconds}秒`;
    }
  }

  updateSimulationInDB(simulationId, exitPrice, exitReason, isWin, profitLoss) {
    return this.db.run(
      `UPDATE simulations SET 
       status = ?, closed_at = datetime('now', '+8 hours'), exit_price = ?, exit_reason = ?, is_win = ?, profit_loss = ?
       WHERE id = ?`,
      ['CLOSED', exitPrice, exitReason, isWin, profitLoss, simulationId]
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
            last_updated = datetime('now', '+8 hours')
        `, [
          stat.total_trades, stat.winning_trades, stat.losing_trades,
          winRate, stat.total_profit, stat.total_loss, stat.net_profit
        ]);
      }
    } catch (error) {
      console.error('更新胜率统计时出错:', error);
    }
  }

  async createSimulation(symbol, entryPrice, stopLossPrice, takeProfitPrice, maxLeverage, minMargin, triggerReason = 'SIGNAL', stopLossDistance = null, atrValue = null, atr14 = null, executionModeV3 = null, marketType = null, setupCandleHigh = null, setupCandleLow = null) {
    try {
      // 根据triggerReason判断交易方向
      let direction = 'SHORT'; // 默认空头
      if (triggerReason.includes('多头') || triggerReason.includes('LONG')) {
        direction = 'LONG';
      } else if (triggerReason.includes('空头') || triggerReason.includes('SHORT')) {
        direction = 'SHORT';
      }

      // 检查是否在最近10分钟内已经为同一交易对创建了相同方向的模拟交易
      const recentSimulations = await this.db.runQuery(`
        SELECT * FROM simulations 
        WHERE symbol = ? AND direction = ? AND created_at > datetime('now', '+8 hours', '-10 minutes')
        ORDER BY created_at DESC
        LIMIT 1
      `, [symbol, direction]);

      if (recentSimulations.length > 0) {
        const recentSim = recentSimulations[0];
        console.log(`⏭️ 跳过重复模拟交易: ${symbol} ${direction} (最近10分钟内已存在 ID: ${recentSim.id})`);
        return { id: recentSim.id, message: '重复交易已跳过' };
      }

      // 获取全局最大损失设置进行验证
      const globalMaxLoss = await this.db.getUserSetting('maxLossAmount', 100);
      const maxLossAmount = parseFloat(globalMaxLoss);

      // 计算实际损失金额进行验证
      const actualLoss = Math.abs(entryPrice - stopLossPrice) * minMargin / entryPrice;
      if (actualLoss > maxLossAmount) {
        console.warn(`⚠️ 模拟交易 ${symbol} 实际损失 ${actualLoss.toFixed(2)} USDT 超过全局设置 ${maxLossAmount} USDT，已调整杠杆`);
        // 调整杠杆以符合全局最大损失设置
        const adjustedLeverage = Math.floor(maxLossAmount * entryPrice / (Math.abs(entryPrice - stopLossPrice) * minMargin));
        maxLeverage = Math.max(1, Math.min(maxLeverage, adjustedLeverage));
        console.log(`🔧 调整后杠杆: ${maxLeverage}x`);
      }

      // 确保价格保留4位小数
      const formattedEntryPrice = parseFloat(entryPrice.toFixed(4));
      const formattedStopLossPrice = parseFloat(stopLossPrice.toFixed(4));
      const formattedTakeProfitPrice = parseFloat(takeProfitPrice.toFixed(4));

      const result = await this.db.run(`
        INSERT INTO simulations 
        (symbol, entry_price, stop_loss_price, take_profit_price, max_leverage, min_margin, trigger_reason, status, stop_loss_distance, atr_value, direction, atr14, execution_mode_v3, market_type, setup_candle_high, setup_candle_low, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+8 hours'))
      `, [symbol, formattedEntryPrice, formattedStopLossPrice, formattedTakeProfitPrice, maxLeverage, minMargin, triggerReason, 'ACTIVE', stopLossDistance, atrValue, direction, atr14, executionModeV3, marketType, setupCandleHigh, setupCandleLow]);

      console.log(`✅ 创建模拟交易: ${symbol}, 入场价: ${formattedEntryPrice}, 止损: ${formattedStopLossPrice}, 止盈: ${formattedTakeProfitPrice}, 杠杆: ${maxLeverage}x, 保证金: ${minMargin}, 止损距离: ${stopLossDistance}%, ATR: ${atrValue}, 全局最大损失: ${maxLossAmount} USDT`);

      // 发送Telegram通知
      const simulationData = {
        id: result.id,
        symbol,
        entryPrice: formattedEntryPrice,
        stopLossPrice: formattedStopLossPrice,
        takeProfitPrice: formattedTakeProfitPrice,
        maxLeverage,
        minMargin,
        direction,
        triggerReason,
        stopLossDistance,
        atrValue
      };

      // 异步发送通知，不阻塞主流程
      this.telegramNotifier.sendSimulationStartNotification(simulationData).catch(error => {
        console.error(`❌ 模拟交易开始通知发送失败: ${symbol}`, error);
      });

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
      if (limit === -1) {
        // 无限制，返回所有记录
        return await this.db.runQuery(`
          SELECT * FROM simulations 
          ORDER BY created_at DESC
        `);
      } else {
        // 限制记录数
        return await this.db.runQuery(`
          SELECT * FROM simulations 
          ORDER BY created_at DESC 
          LIMIT ?
        `, [limit]);
      }
    } catch (error) {
      console.error('获取模拟交易历史时出错:', error);
      return [];
    }
  }

  /**
   * 计算震荡市多因子得分 - 按照strategy-v3.md实现
   */
  calculateRangeFactorScore(factors, signalType) {
    let score = 0;
    
    if (signalType === "long") {
      // 多头信号：VWAP、Delta、OI、Volume都应该是正值
      score += factors.vwap ? +1 : -1;
      score += factors.delta ? +1 : -1;
      score += factors.oi ? +1 : -1;
      score += factors.volume ? +1 : -1;
    } else if (signalType === "short") {
      // 空头信号：VWAP、Delta、OI、Volume都应该是负值
      score += factors.vwap ? -1 : +1;
      score += factors.delta ? -1 : +1;
      score += factors.oi ? -1 : +1;
      score += factors.volume ? -1 : +1;
    }
    
    return score;
  }

  // 获取分页模拟交易历史
  async getSimulationHistoryPaginated(page = 1, pageSize = 20) {
    try {
      const offset = (page - 1) * pageSize;

      // 获取总数
      const countResult = await this.db.runQuery(`
        SELECT COUNT(*) as total FROM simulations WHERE status = 'CLOSED'
      `);
      const total = countResult[0].total;

      // 获取分页数据
      const simulations = await this.db.runQuery(`
        SELECT * FROM simulations 
        WHERE status = 'CLOSED'
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `, [pageSize, offset]);

      return {
        simulations,
        pagination: {
          currentPage: page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
          hasNext: page < Math.ceil(total / pageSize),
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('获取分页模拟交易历史时出错:', error);
      return {
        simulations: [],
        pagination: {
          currentPage: 1,
          pageSize: 20,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        }
      };
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

  // 获取方向统计
  async getDirectionStats() {
    try {
      const stats = await this.db.runQuery(`
        SELECT 
          direction,
          COUNT(*) as total_trades,
          SUM(CASE WHEN is_win = 1 THEN 1 ELSE 0 END) as winning_trades,
          SUM(CASE WHEN is_win = 0 THEN 1 ELSE 0 END) as losing_trades,
          SUM(profit_loss) as net_profit,
          SUM(CASE WHEN is_win = 1 THEN profit_loss ELSE 0 END) as total_profit,
          SUM(CASE WHEN is_win = 0 THEN ABS(profit_loss) ELSE 0 END) as total_loss
        FROM simulations 
        WHERE status = 'CLOSED'
        GROUP BY direction
      `);

      const result = {
        long: { total_trades: 0, winning_trades: 0, losing_trades: 0, win_rate: 0, net_profit: 0, total_profit: 0, total_loss: 0 },
        short: { total_trades: 0, winning_trades: 0, losing_trades: 0, win_rate: 0, net_profit: 0, total_profit: 0, total_loss: 0 }
      };

      stats.forEach(stat => {
        const winRate = stat.total_trades > 0 ? (stat.winning_trades / stat.total_trades) * 100 : 0;

        if (stat.direction === 'LONG') {
          result.long = {
            total_trades: stat.total_trades,
            winning_trades: stat.winning_trades,
            losing_trades: stat.losing_trades,
            win_rate: winRate,
            net_profit: stat.net_profit,
            total_profit: stat.total_profit,
            total_loss: stat.total_loss
          };
        } else if (stat.direction === 'SHORT') {
          result.short = {
            total_trades: stat.total_trades,
            winning_trades: stat.winning_trades,
            losing_trades: stat.losing_trades,
            win_rate: winRate,
            net_profit: stat.net_profit,
            total_profit: stat.total_profit,
            total_loss: stat.total_loss
          };
        }
      });

      return result;
    } catch (error) {
      console.error('获取方向统计时出错:', error);
      return {
        long: { total_trades: 0, winning_trades: 0, losing_trades: 0, win_rate: 0, net_profit: 0, total_profit: 0, total_loss: 0 },
        short: { total_trades: 0, winning_trades: 0, losing_trades: 0, win_rate: 0, net_profit: 0, total_profit: 0, total_loss: 0 }
      };
    }
  }

  // 获取出场原因统计
  async getExitReasonStats() {
    try {
      const stats = await this.db.runQuery(`
        SELECT 
          exit_reason,
          COUNT(*) as count,
          SUM(CASE WHEN is_win = 1 THEN 1 ELSE 0 END) as wins,
          SUM(CASE WHEN is_win = 0 THEN 1 ELSE 0 END) as losses,
          AVG(CASE WHEN is_win = 1 THEN profit_loss ELSE 0 END) as avg_profit,
          AVG(CASE WHEN is_win = 0 THEN profit_loss ELSE 0 END) as avg_loss,
          SUM(profit_loss) as total_profit_loss
        FROM simulations 
        WHERE status = 'CLOSED' AND exit_reason IS NOT NULL
        GROUP BY exit_reason
        ORDER BY count DESC
      `);

      return stats.map(stat => ({
        exit_reason: stat.exit_reason,
        count: stat.count,
        wins: stat.wins,
        losses: stat.losses,
        win_rate: stat.count > 0 ? (stat.wins / stat.count) * 100 : 0,
        avg_profit: stat.avg_profit || 0,
        avg_loss: stat.avg_loss || 0,
        total_profit_loss: stat.total_profit_loss || 0
      }));
    } catch (error) {
      console.error('获取出场原因统计时出错:', error);
      return [];
    }
  }

  // 获取交易对统计
  async getSymbolStats() {
    try {
      const stats = await this.db.runQuery(`
        SELECT 
          symbol,
          COUNT(*) as total_trades,
          SUM(CASE WHEN is_win = 1 THEN 1 ELSE 0 END) as winning_trades,
          SUM(CASE WHEN is_win = 0 THEN 1 ELSE 0 END) as losing_trades,
          SUM(profit_loss) as net_profit,
          AVG(profit_loss) as avg_profit
        FROM simulations 
        WHERE status = 'CLOSED'
        GROUP BY symbol
        ORDER BY total_trades DESC
      `);

      return stats.map(stat => ({
        symbol: stat.symbol,
        total_trades: stat.total_trades,
        winning_trades: stat.winning_trades,
        losing_trades: stat.losing_trades,
        win_rate: stat.total_trades > 0 ? (stat.winning_trades / stat.total_trades) * 100 : 0,
        net_profit: stat.net_profit,
        avg_profit: stat.avg_profit
      }));
    } catch (error) {
      console.error('获取交易对统计时出错:', error);
      return [];
    }
  }

  async getSymbolTradeCounts() {
    try {
      // 获取每日交易次数（今天）
      const dailyCounts = await this.db.runQuery(`
        SELECT 
          symbol,
          COUNT(*) as daily_count
        FROM simulations 
        WHERE DATE(created_at) = DATE('now')
        GROUP BY symbol
      `);

      // 获取每周交易次数（本周）
      const weeklyCounts = await this.db.runQuery(`
        SELECT 
          symbol,
          COUNT(*) as weekly_count
        FROM simulations 
        WHERE DATE(created_at) >= DATE('now', 'weekday 1', '-6 days')
        GROUP BY symbol
      `);

      // 合并数据
      const countsMap = new Map();

      // 添加每日数据
      dailyCounts.forEach(item => {
        countsMap.set(item.symbol, {
          symbol: item.symbol,
          daily_count: item.daily_count,
          weekly_count: 0
        });
      });

      // 添加每周数据
      weeklyCounts.forEach(item => {
        if (countsMap.has(item.symbol)) {
          countsMap.get(item.symbol).weekly_count = item.weekly_count;
        } else {
          countsMap.set(item.symbol, {
            symbol: item.symbol,
            daily_count: 0,
            weekly_count: item.weekly_count
          });
        }
      });

      return Array.from(countsMap.values());
    } catch (error) {
      console.error('获取交易对交易次数时出错:', error);
      return [];
    }
  }

  // 清理有盈亏金额但状态为进行中的错误记录
  async cleanupInconsistentSimulations() {
    try {
      // 查找有盈亏金额但状态为ACTIVE的记录
      const inconsistentSims = await this.db.runQuery(`
        SELECT * FROM simulations 
        WHERE status = 'ACTIVE' AND profit_loss IS NOT NULL AND profit_loss != 0
        ORDER BY created_at DESC
      `);

      for (const sim of inconsistentSims) {
        // 将这些记录标记为已关闭
        await this.db.run(`
          UPDATE simulations 
          SET status = 'CLOSED', 
              closed_at = datetime('now', '+8 hours'), 
              exit_reason = '数据清理修复',
              is_win = ?
          WHERE id = ?
        `, [sim.profit_loss > 0, sim.id]);

        console.log(`🔧 修复不一致记录: ${sim.symbol} - ID: ${sim.id} - 盈亏: ${sim.profit_loss}`);
      }

      if (inconsistentSims.length > 0) {
        console.log(`✅ 修复了 ${inconsistentSims.length} 条不一致的模拟交易记录`);
        // 更新胜率统计
        await this.updateWinRateStats();
      }

      return inconsistentSims.length;
    } catch (error) {
      console.error('清理不一致模拟交易记录失败:', error);
      return 0;
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

          // 确保有盈亏金额时交易状态为已关闭
          if (profitLoss !== 0) {
            await this.db.run(`
              UPDATE simulations 
              SET status = 'CLOSED', 
                  closed_at = datetime('now', '+8 hours'), 
                  exit_price = ?, 
                  exit_reason = ?, 
                  is_win = ?, 
                  profit_loss = ?
              WHERE id = ?
            `, [exitResult.exitPrice, exitResult.reason, isWin, profitLoss, sim.id]);
          } else {
            // 如果没有盈亏金额，也关闭交易但标记为平仓
            await this.db.run(`
              UPDATE simulations 
              SET status = 'CLOSED', 
                  closed_at = datetime('now', '+8 hours'), 
                  exit_price = ?, 
                  exit_reason = ?, 
                  is_win = ?, 
                  profit_loss = ?
              WHERE id = ?
            `, [exitResult.exitPrice, exitResult.reason, false, 0, sim.id]);
          }

          // 发送Telegram通知
          try {
            if (this.telegramNotifier) {
              await this.telegramNotifier.sendSimulationEndNotification({
                symbol: sim.symbol,
                direction: sim.direction,
                exitPrice: exitResult.exitPrice,
                exitReason: exitResult.reason,
                profitLoss,
                isWin,
                entryPrice: sim.entry_price,
                stopLoss: sim.stop_loss_price,
                takeProfit: sim.take_profit_price,
                maxLeverage: sim.max_leverage,
                minMargin: sim.min_margin,
                timeInPosition: sim.time_in_position || 0,
                maxTimeInPosition: sim.max_time_in_position || 48,
                triggerReason: sim.trigger_reason
              });
            }
          } catch (notificationError) {
            console.warn('⚠️ 发送模拟交易结束通知失败:', notificationError.message);
          }

          // 更新胜率统计
          await this.updateWinRateStats();

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
    const maxTimeInPosition = 24; // 最大允许24根15m K线（6小时）- 严格按照strategy-v3.md文档

    // 从分析数据中获取必要信息
    let score1h = 0;
    let trend4h = '震荡';
    let marketType = sim.market_type || '震荡市'; // 优先从模拟交易记录获取市场类型
    let deltaBuy = 0;
    let deltaSell = 0;
    let ema20 = 0;
    let ema50 = 0;
    let prevHigh = 0;
    let prevLow = 0;
    let rangeResult = null; // 震荡市边界数据

    if (analysisData) {
      score1h = analysisData.hourlyConfirmation?.score || 0;
      trend4h = analysisData.trend4h?.trend === 'UPTREND' ? '多头' :
        analysisData.trend4h?.trend === 'DOWNTREND' ? '空头' : '震荡';

      // 获取市场类型 - 优先使用模拟交易记录中的market_type，其次使用analysisData
      marketType = sim.market_type || analysisData.marketType || '震荡市';

      // 获取震荡市边界数据
      rangeResult = analysisData.rangeResult || null;

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

    // 调试信息
    console.log(`🔍 检查出场条件 [${sim.symbol}]:`, {
      marketType,
      triggerReason: sim.trigger_reason,
      executionModeV3: sim.execution_mode_v3,
      position,
      trend4h,
      score1h,
      simMarketType: sim.market_type,
      analysisMarketType: analysisData?.marketType,
      isRangeSignal: sim.trigger_reason?.includes('区间')
    });

    // 3️⃣ 根据市场类型使用不同的出场条件
    // 特殊处理：如果触发原因是区间交易，强制使用震荡市出场条件
    const isRangeSignal = sim.trigger_reason?.includes('区间');
    
    console.log(`🎯 市场类型判断 [${sim.symbol}]:`, {
      marketType,
      isRangeSignal,
      triggerReason: sim.trigger_reason,
      willUseRangeExit: marketType === '震荡市' || isRangeSignal
    });
    
    if (marketType === '震荡市' || isRangeSignal) {
      // 震荡市出场条件 - 严格按照strategy-v3.md重新实现
      
      // 1. 结构性止损：区间边界失效
      if (rangeResult && rangeResult.bb1h) {
        const { upper: rangeHigh, lower: rangeLow } = rangeResult.bb1h;
        const effectiveATR = atr14 && atr14 > 0 ? atr14 : entryPrice * 0.01;

        // 区间边界失效止损
        if (position === 'long' && currentPrice < (rangeLow - effectiveATR)) {
          return { exit: true, reason: 'RANGE_BOUNDARY_BREAK', exitPrice: currentPrice };
        }
        if (position === 'short' && currentPrice > (rangeHigh + effectiveATR)) {
          return { exit: true, reason: 'RANGE_BOUNDARY_BREAK', exitPrice: currentPrice };
        }
      }

      // 2. 多因子打分止损 - 严格按照strategy-v3.md文档
      if (rangeResult) {
        // 获取多因子数据
        const factors = {
          vwap: rangeResult.vwapDirectionConsistent || false,
          delta: Math.abs(rangeResult.delta || 0) <= 0.02,
          oi: Math.abs(rangeResult.oiChange || 0) <= 0.02,
          volume: (rangeResult.volFactor || 0) <= 1.7
        };

        // 计算因子得分
        const signalType = position === 'long' ? 'long' : 'short';
        const factorScore = this.calculateRangeFactorScore(factors, signalType);

        // 多因子打分止损：得分 <= -2
        if (factorScore <= -2) {
          return { exit: true, reason: 'FACTOR_STOP', exitPrice: currentPrice, factorScore };
        }
      }

      // 3. 时间止盈/止损 - 严格按照strategy-v3.md文档
      if (sim.entry_time) {
        const entryTime = new Date(sim.entry_time);
        const now = new Date();
        const holdingMinutes = (now - entryTime) / 60000;
        
        // 时间止盈：持仓超过3小时
        if (holdingMinutes > 180) {
          return { exit: true, reason: 'TIME_STOP', exitPrice: currentPrice, holdingMinutes };
        }
      }

      // 4. 固定RR目标止盈 - 按照strategy-v3.md文档
      if (sim.stop_loss && sim.take_profit) {
        const stopLoss = parseFloat(sim.stop_loss);
        const takeProfit = parseFloat(sim.take_profit);
        
        if (position === 'long' && currentPrice >= takeProfit) {
          return { exit: true, reason: 'TAKE_PROFIT', exitPrice: currentPrice };
        }
        if (position === 'short' && currentPrice <= takeProfit) {
          return { exit: true, reason: 'TAKE_PROFIT', exitPrice: currentPrice };
        }
      }
    } else if (marketType === '趋势市') {
      // 趋势市出场条件
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
    }

    // 6️⃣ 时间止损（所有市场类型通用）
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
        `DELETE FROM ${tableName} WHERE created_at < datetime('now', '+8 hours', '-30 days') OR timestamp < datetime('now', '+8 hours', '-30 days')`
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
