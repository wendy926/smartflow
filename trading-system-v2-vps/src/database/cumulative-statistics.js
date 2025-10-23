const logger = require('../utils/logger');

/**
 * 获取每日累计统计数据
 * @param {Object} connection - 数据库连接
 * @param {string} strategy - 策略名称 ('V3' 或 'ICT')
 * @param {number} days - 查询天数
 * @returns {Array} 每日累计统计数据
 */
async function getDailyCumulativeStatistics(connection, strategy, days = 30) {
  try {
    const strategyName = strategy.toUpperCase();
    
    // 查询：计算每天截止到该日的累计统计
    const query = `
      WITH RECURSIVE date_series AS (
        SELECT CURDATE() - INTERVAL ? DAY as trade_date
        UNION ALL
        SELECT trade_date + INTERVAL 1 DAY
        FROM date_series
        WHERE trade_date < CURDATE()
      ),
      daily_stats AS (
        SELECT 
          DATE(entry_time) as trade_date,
          COUNT(*) as daily_trades,
          SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as daily_winning,
          SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as daily_losing
        FROM simulation_trades
        WHERE strategy_name = ?
          AND status = 'CLOSED'
          AND entry_time >= CURDATE() - INTERVAL ? DAY
        GROUP BY DATE(entry_time)
      )
      SELECT 
        ds.trade_date as date,
        COALESCE((
          SELECT SUM(t.daily_trades)
          FROM daily_stats t
          WHERE t.trade_date <= ds.trade_date
        ), 0) as cumulative_trades,
        COALESCE((
          SELECT SUM(t.daily_winning)
          FROM daily_stats t
          WHERE t.trade_date <= ds.trade_date
        ), 0) as cumulative_winning,
        COALESCE((
          SELECT SUM(t.daily_losing)
          FROM daily_stats t
          WHERE t.trade_date <= ds.trade_date
        ), 0) as cumulative_losing,
        CASE 
          WHEN COALESCE((SELECT SUM(t.daily_trades) FROM daily_stats t WHERE t.trade_date <= ds.trade_date), 0) > 0
          THEN ROUND(
            COALESCE((SELECT SUM(t.daily_winning) FROM daily_stats t WHERE t.trade_date <= ds.trade_date), 0) * 100.0 / 
            COALESCE((SELECT SUM(t.daily_trades) FROM daily_stats t WHERE t.trade_date <= ds.trade_date), 0),
            2
          )
          ELSE 0
        END as cumulative_win_rate
      FROM date_series ds
      ORDER BY ds.trade_date ASC
    `;
    
    const [rows] = await connection.execute(query, [days - 1, strategyName, days]);
    
    return rows.map(row => ({
      date: row.date,
      cumulativeTrades: parseInt(row.cumulative_trades) || 0,
      cumulativeWinning: parseInt(row.cumulative_winning) || 0,
      cumulativeLosing: parseInt(row.cumulative_losing) || 0,
      cumulativeWinRate: parseFloat(row.cumulative_win_rate) || 0
    }));
    
  } catch (error) {
    logger.error(`获取${strategy}策略每日累计统计失败:`, error);
    throw error;
  }
}

/**
 * 获取周累计统计数据
 * @param {Object} connection - 数据库连接
 * @param {string} strategy - 策略名称
 * @param {number} weeks - 查询周数
 * @returns {Array} 每周累计统计数据
 */
async function getWeeklyCumulativeStatistics(connection, strategy, weeks = 4) {
  try {
    const strategyName = strategy.toUpperCase();
    const days = weeks * 7;
    
    const query = `
      WITH RECURSIVE week_series AS (
        SELECT 
          DATE_SUB(CURDATE(), INTERVAL ? WEEK) as week_start,
          DATE_SUB(CURDATE(), INTERVAL ? WEEK) + INTERVAL 6 DAY as week_end
        UNION ALL
        SELECT 
          week_start + INTERVAL 1 WEEK,
          week_end + INTERVAL 1 WEEK
        FROM week_series
        WHERE week_end < CURDATE()
      ),
      weekly_stats AS (
        SELECT 
          YEARWEEK(entry_time, 1) as year_week,
          COUNT(*) as weekly_trades,
          SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as weekly_winning,
          SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as weekly_losing
        FROM simulation_trades
        WHERE strategy_name = ?
          AND status = 'CLOSED'
          AND entry_time >= DATE_SUB(CURDATE(), INTERVAL ? WEEK)
        GROUP BY YEARWEEK(entry_time, 1)
      )
      SELECT 
        ws.week_start as date,
        ws.week_end,
        COALESCE((
          SELECT SUM(t.weekly_trades)
          FROM weekly_stats t
          WHERE t.year_week <= YEARWEEK(ws.week_end, 1)
        ), 0) as cumulative_trades,
        COALESCE((
          SELECT SUM(t.weekly_winning)
          FROM weekly_stats t
          WHERE t.year_week <= YEARWEEK(ws.week_end, 1)
        ), 0) as cumulative_winning,
        COALESCE((
          SELECT SUM(t.weekly_losing)
          FROM weekly_stats t
          WHERE t.year_week <= YEARWEEK(ws.week_end, 1)
        ), 0) as cumulative_losing,
        CASE 
          WHEN COALESCE((SELECT SUM(t.weekly_trades) FROM weekly_stats t WHERE t.year_week <= YEARWEEK(ws.week_end, 1)), 0) > 0
          THEN ROUND(
            COALESCE((SELECT SUM(t.weekly_winning) FROM weekly_stats t WHERE t.year_week <= YEARWEEK(ws.week_end, 1)), 0) * 100.0 / 
            COALESCE((SELECT SUM(t.weekly_trades) FROM weekly_stats t WHERE t.year_week <= YEARWEEK(ws.week_end, 1)), 0),
            2
          )
          ELSE 0
        END as cumulative_win_rate
      FROM week_series ws
      ORDER BY ws.week_start ASC
    `;
    
    const [rows] = await connection.execute(query, [weeks - 1, weeks - 1, strategyName, weeks]);
    
    return rows.map(row => ({
      date: row.date,
      weekEnd: row.week_end,
      cumulativeTrades: parseInt(row.cumulative_trades) || 0,
      cumulativeWinning: parseInt(row.cumulative_winning) || 0,
      cumulativeLosing: parseInt(row.cumulative_losing) || 0,
      cumulativeWinRate: parseFloat(row.cumulative_win_rate) || 0
    }));
    
  } catch (error) {
    logger.error(`获取${strategy}策略每周累计统计失败:`, error);
    throw error;
  }
}

module.exports = {
  getDailyCumulativeStatistics,
  getWeeklyCumulativeStatistics
};

