/**
 * ICT 仓位管理 API 路由
 */

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const { toBeijingISO } = require('../../utils/time-helper');

/**
 * 获取 ICT 仓位监控状态
 * GET /api/v1/ict-position/status
 */
router.get('/status', (req, res) => {
  try {
    const ictPositionMonitor = req.app.get('ictPositionMonitor');
    
    if (!ictPositionMonitor) {
      return res.status(503).json({
        success: false,
        error: 'ICT仓位监控服务未启动'
      });
    }

    res.json({
      success: true,
      data: {
        isRunning: ictPositionMonitor.isRunning,
        checkInterval: ictPositionMonitor.checkInterval,
        nextCheck: new Date(Date.now() + ictPositionMonitor.checkInterval).toISOString()
      },
      timestamp: toBeijingISO()
    });
  } catch (error) {
    logger.error('获取ICT仓位监控状态失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 手动触发 ICT 仓位检查
 * POST /api/v1/ict-position/check
 */
router.post('/check', async (req, res) => {
  try {
    const ictPositionMonitor = req.app.get('ictPositionMonitor');
    
    if (!ictPositionMonitor) {
      return res.status(503).json({
        success: false,
        error: 'ICT仓位监控服务未启动'
      });
    }

    await ictPositionMonitor.checkAllPositions();

    res.json({
      success: true,
      data: {
        success: true,
        timestamp: toBeijingISO(),
        message: '手动ICT仓位检查完成'
      },
      timestamp: toBeijingISO()
    });
  } catch (error) {
    logger.error('手动ICT仓位检查失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取 ICT 活跃仓位列表
 * GET /api/v1/ict-position/active
 */
router.get('/active', async (req, res) => {
  try {
    const database = req.app.get('database');
    
    const openTrades = await database.query(
      `SELECT st.*, s.symbol, ipm.current_price, ipm.remaining_qty, ipm.realized_pnl, 
              ipm.unrealized_pnl, ipm.tp1_filled, ipm.tp2_filled, ipm.breakeven_triggered,
              ipm.trailing_stop_active, ipm.trailing_stop_price, ipm.time_elapsed_hours,
              ipm.time_stop_triggered, ipm.last_update_time
       FROM simulation_trades st
       JOIN symbols s ON st.symbol_id = s.id
       LEFT JOIN ict_position_management ipm ON st.id = ipm.trade_id
       WHERE st.strategy_name = 'ICT' AND st.status = 'OPEN'
       ORDER BY st.entry_time DESC`
    );

    res.json({
      success: true,
      data: openTrades || [],
      count: openTrades ? openTrades.length : 0,
      timestamp: toBeijingISO()
    });
  } catch (error) {
    logger.error('获取ICT活跃仓位失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取 ICT 部分平仓记录
 * GET /api/v1/ict-position/partial-closes/:tradeId
 */
router.get('/partial-closes/:tradeId', async (req, res) => {
  try {
    const { tradeId } = req.params;
    const database = req.app.get('database');
    
    const partialCloses = await database.query(
      `SELECT ipc.*, s.symbol
       FROM ict_partial_closes ipc
       JOIN symbols s ON ipc.symbol_id = s.id
       WHERE ipc.trade_id = ?
       ORDER BY ipc.close_time DESC`,
      [tradeId]
    );

    res.json({
      success: true,
      data: partialCloses || [],
      count: partialCloses ? partialCloses.length : 0,
      timestamp: toBeijingISO()
    });
  } catch (error) {
    logger.error('获取ICT部分平仓记录失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取 ICT 策略统计
 * GET /api/v1/ict-position/stats/:symbol?
 */
router.get('/stats/:symbol?', async (req, res) => {
  try {
    const { symbol } = req.params;
    const database = req.app.get('database');
    
    let stats;
    if (symbol) {
      // 获取特定交易对的统计
      stats = await database.query(
        `SELECT iss.*, s.symbol
         FROM ict_strategy_stats iss
         JOIN symbols s ON iss.symbol_id = s.id
         WHERE s.symbol = ?`,
        [symbol]
      );
    } else {
      // 获取所有交易对的统计
      stats = await database.query(
        `SELECT iss.*, s.symbol
         FROM ict_strategy_stats iss
         JOIN symbols s ON iss.symbol_id = s.id
         ORDER BY iss.total_pnl DESC`
      );
    }

    res.json({
      success: true,
      data: stats || [],
      count: stats ? stats.length : 0,
      timestamp: toBeijingISO()
    });
  } catch (error) {
    logger.error('获取ICT策略统计失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取 ICT 仓位详情
 * GET /api/v1/ict-position/details/:tradeId
 */
router.get('/details/:tradeId', async (req, res) => {
  try {
    const { tradeId } = req.params;
    const database = req.app.get('database');
    
    const trade = await database.query(
      `SELECT st.*, s.symbol, ipm.*
       FROM simulation_trades st
       JOIN symbols s ON st.symbol_id = s.id
       LEFT JOIN ict_position_management ipm ON st.id = ipm.trade_id
       WHERE st.id = ?`,
      [tradeId]
    );

    if (!trade || trade.length === 0) {
      return res.status(404).json({
        success: false,
        error: '交易不存在'
      });
    }

    // 获取部分平仓记录
    const partialCloses = await database.query(
      `SELECT * FROM ict_partial_closes WHERE trade_id = ? ORDER BY close_time DESC`,
      [tradeId]
    );

    res.json({
      success: true,
      data: {
        trade: trade[0],
        partialCloses: partialCloses || []
      },
      timestamp: toBeijingISO()
    });
  } catch (error) {
    logger.error('获取ICT仓位详情失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

