/**
 * V3.1-Plus 优化 - 胜率跟踪模块
 * 
 * 功能：
 * - 查询最近N笔交易的胜率
 * - 判断是否需要启动胜率保护（节流）
 * - 计算调整参数（分数惩罚、仓位缩减）
 * 
 * 设计原则：
 * - 单一职责：仅负责胜率相关统计
 * - 高性能：限制查询范围，使用索引
 * - 自适应：根据胜率动态调整策略
 * 
 * @module v3-1-plus/winrate-tracker
 */

const logger = require('../../utils/logger');

/**
 * 胜率跟踪器
 * 统计最近N笔交易的胜率，并提供节流建议
 */
class WinRateTracker {
  constructor(database) {
    this.database = database;
    logger.info('[WinRateTracker] 初始化胜率跟踪器');
  }

  /**
   * 获取最近N笔交易的胜率统计
   * @param {number} symbolId - 交易对ID
   * @param {number} window - 窗口大小（默认12笔）
   * @returns {Promise<Object>} 胜率统计
   */
  async getRecentWinRate(symbolId, window = 12) {
    try {
      const [rows] = await this.database.pool.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
          SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losses,
          AVG(pnl) as avg_pnl,
          AVG(CASE WHEN pnl > 0 THEN pnl END) as avg_win,
          AVG(CASE WHEN pnl < 0 THEN pnl END) as avg_loss,
          MAX(exit_time) as last_exit_time
        FROM (
          SELECT pnl, exit_time
          FROM simulation_trades
          WHERE symbol_id = ?
            AND strategy_name = 'V3'
            AND status = 'CLOSED'
          ORDER BY exit_time DESC
          LIMIT ?
        ) recent
      `, [symbolId, window]);

      const row = rows[0];
      const total = parseInt(row.total) || 0;
      const wins = parseInt(row.wins) || 0;
      const losses = parseInt(row.losses) || 0;

      // 计算胜率
      const winRate = total > 0 ? wins / total : null;

      // 计算盈亏比
      const rewardRiskRatio = (row.avg_win && row.avg_loss) 
        ? Math.abs(row.avg_win / row.avg_loss)
        : null;

      const result = {
        symbolId,
        window,
        total,
        wins,
        losses,
        winRate,
        winRatePct: winRate !== null ? parseFloat((winRate * 100).toFixed(2)) : null,
        avgPnl: parseFloat((row.avg_pnl || 0).toFixed(2)),
        avgWin: parseFloat((row.avg_win || 0).toFixed(2)),
        avgLoss: parseFloat((row.avg_loss || 0).toFixed(2)),
        rewardRiskRatio: rewardRiskRatio ? parseFloat(rewardRiskRatio.toFixed(2)) : null,
        lastExitTime: row.last_exit_time,
        sufficientData: total >= Math.min(window, 5) // 至少5笔数据才认为充足
      };

      logger.debug(`[WinRateTracker] symbolId=${symbolId}, 胜率=${result.winRatePct}%, 样本=${total}笔`);
      return result;
    } catch (error) {
      logger.error('[WinRateTracker] getRecentWinRate错误:', error);
      return {
        symbolId,
        window,
        total: 0,
        wins: 0,
        losses: 0,
        winRate: null,
        winRatePct: null,
        sufficientData: false,
        error: error.message
      };
    }
  }

  /**
   * 判断是否需要启动胜率保护（节流）
   * @param {number} symbolId - 交易对ID
   * @param {number} threshold - 胜率阈值（默认0.30，即30%）
   * @param {number} window - 窗口大小（默认12笔）
   * @returns {Promise<Object>} 节流建议
   */
  async shouldThrottle(symbolId, threshold = 0.30, window = 12) {
    try {
      const stats = await this.getRecentWinRate(symbolId, window);

      // 如果数据不足，不启动保护（避免早期过度限制）
      if (!stats.sufficientData) {
        return {
          throttle: false,
          reason: 'insufficient_data',
          stats,
          adjustments: null
        };
      }

      // 如果胜率为null（全部未平仓），不启动保护
      if (stats.winRate === null) {
        return {
          throttle: false,
          reason: 'no_closed_trades',
          stats,
          adjustments: null
        };
      }

      // 检查胜率是否低于阈值
      if (stats.winRate < threshold) {
        // 计算惩罚力度（胜率越低，惩罚越重）
        const gap = threshold - stats.winRate; // 0-0.30之间
        const penaltyFactor = Math.min(gap / threshold, 1); // 0-1之间

        const adjustments = {
          scoreBonus: Math.round(-10 - penaltyFactor * 10), // -10 到 -20
          sizeMultiplier: Math.max(0.3, 1 - penaltyFactor * 0.5), // 0.3 到 1.0
          message: `胜率${stats.winRatePct}%低于阈值${(threshold * 100).toFixed(0)}%，启动保护`
        };

        logger.warn(`[WinRateTracker] ⚠️ symbolId=${symbolId} 胜率保护启动`, {
          winRate: stats.winRatePct,
          threshold: (threshold * 100).toFixed(0),
          adjustments
        });

        return {
          throttle: true,
          reason: 'low_winrate',
          stats,
          adjustments
        };
      }

      // 胜率正常，不需要保护
      return {
        throttle: false,
        reason: 'ok',
        stats,
        adjustments: null
      };
    } catch (error) {
      logger.error('[WinRateTracker] shouldThrottle错误:', error);
      // 发生错误时，保守策略：不启动保护（避免过度限制）
      return {
        throttle: false,
        reason: 'error',
        stats: null,
        adjustments: null,
        error: error.message
      };
    }
  }

  /**
   * 获取交易对的胜率趋势（与前一窗口对比）
   * @param {number} symbolId - 交易对ID
   * @param {number} window - 窗口大小
   * @returns {Promise<Object>} 趋势分析
   */
  async getWinRateTrend(symbolId, window = 12) {
    try {
      // 获取最近窗口的胜率
      const recent = await this.getRecentWinRate(symbolId, window);

      // 获取前一窗口的胜率
      const [rows] = await this.database.pool.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins
        FROM (
          SELECT pnl
          FROM simulation_trades
          WHERE symbol_id = ?
            AND strategy_name = 'V3'
            AND status = 'CLOSED'
          ORDER BY exit_time DESC
          LIMIT ? OFFSET ?
        ) previous
      `, [symbolId, window, window]);

      const row = rows[0];
      const prevTotal = parseInt(row.total) || 0;
      const prevWins = parseInt(row.wins) || 0;
      const prevWinRate = prevTotal > 0 ? prevWins / prevTotal : null;

      // 计算趋势
      let trend = 'stable';
      let change = null;

      if (recent.winRate !== null && prevWinRate !== null) {
        change = recent.winRate - prevWinRate;
        if (change > 0.05) trend = 'improving';
        else if (change < -0.05) trend = 'declining';
      }

      return {
        symbolId,
        window,
        recent: {
          winRate: recent.winRatePct,
          total: recent.total
        },
        previous: {
          winRate: prevWinRate !== null ? parseFloat((prevWinRate * 100).toFixed(2)) : null,
          total: prevTotal
        },
        trend,
        change: change !== null ? parseFloat((change * 100).toFixed(2)) : null,
        sufficientData: recent.total >= window && prevTotal >= window
      };
    } catch (error) {
      logger.error('[WinRateTracker] getWinRateTrend错误:', error);
      return {
        symbolId,
        window,
        trend: 'unknown',
        error: error.message
      };
    }
  }

  /**
   * 获取所有活跃交易对的胜率排名
   * @param {number} window - 窗口大小
   * @param {number} minTrades - 最少交易笔数
   * @returns {Promise<Array>} 胜率排名列表
   */
  async getWinRateRanking(window = 12, minTrades = 5) {
    try {
      const [rows] = await this.database.pool.query(`
        SELECT 
          s.symbol,
          s.id as symbol_id,
          COUNT(*) as trade_count,
          SUM(CASE WHEN t.pnl > 0 THEN 1 ELSE 0 END) as wins,
          ROUND(SUM(CASE WHEN t.pnl > 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as win_rate_pct,
          ROUND(AVG(t.pnl), 2) as avg_pnl,
          MAX(t.exit_time) as last_trade
        FROM (
          SELECT symbol_id, pnl, exit_time,
                 ROW_NUMBER() OVER (PARTITION BY symbol_id ORDER BY exit_time DESC) as rn
          FROM simulation_trades
          WHERE strategy_name = 'V3' AND status = 'CLOSED'
        ) t
        JOIN symbols s ON t.symbol_id = s.id
        WHERE t.rn <= ?
        GROUP BY s.symbol, s.id
        HAVING trade_count >= ?
        ORDER BY win_rate_pct DESC, avg_pnl DESC
      `, [window, minTrades]);

      logger.debug(`[WinRateTracker] 获取胜率排名，共${rows.length}个交易对`);
      return rows;
    } catch (error) {
      logger.error('[WinRateTracker] getWinRateRanking错误:', error);
      return [];
    }
  }
}

module.exports = WinRateTracker;

