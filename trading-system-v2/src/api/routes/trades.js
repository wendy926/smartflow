/**
 * 模拟交易API路由
 */

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');

// 延迟初始化数据库操作
let dbOps = null;
const getDbOps = () => {
  if (!dbOps) {
    const DatabaseOperations = require('../../database/operations');
    dbOps = new DatabaseOperations();
  }
  return dbOps;
};

/**
 * 获取模拟交易记录
 * GET /api/v1/trades
 */
router.get('/', async (req, res) => {
  try {
    const { strategy, symbol, status, limit = 100, offset = 0 } = req.query;

    const trades = await getDbOps().getTrades(strategy, symbol, status, limit, offset);

    res.json({
      success: true,
      data: trades,
      count: trades.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('获取模拟交易记录失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 创建模拟交易
 * POST /api/v1/trades
 */
router.post('/', async (req, res) => {
  try {
    const {
      symbol,
      strategy_type,
      direction,
      entry_price,
      stop_loss,
      take_profit,
      leverage = 1,
      margin_required,
      risk_amount,
      position_size
    } = req.body;

    if (!symbol || !strategy_type || !direction || !entry_price || !stop_loss || !take_profit) {
      return res.status(400).json({
        success: false,
        error: '必填字段不能为空'
      });
    }

    const tradeData = {
      symbol,
      strategy_type,
      direction,
      entry_price,
      stop_loss,
      take_profit,
      leverage,
      margin_required: margin_required || (entry_price * position_size) / leverage,
      risk_amount: risk_amount || Math.abs(entry_price - stop_loss) * position_size,
      position_size: position_size || 1
    };

    const result = await getDbOps().addTrade(tradeData);

    res.json({
      success: true,
      data: result,
      message: '模拟交易创建成功',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('创建模拟交易失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 更新模拟交易
 * PUT /api/v1/trades/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const result = await getDbOps().updateTrade(id, updateData);

    res.json({
      success: true,
      data: result,
      message: '模拟交易更新成功',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('更新模拟交易失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 关闭模拟交易
 * POST /api/v1/trades/:id/close
 */
router.post('/:id/close', async (req, res) => {
  try {
    const { id } = req.params;
    const { exit_price, exit_reason = 'MANUAL' } = req.body;

    if (!exit_price) {
      return res.status(400).json({
        success: false,
        error: '退出价格不能为空'
      });
    }

    // 获取交易信息
    const trade = await getDbOps().getTradeById(id);
    if (!trade) {
      return res.status(404).json({
        success: false,
        error: '交易记录不存在'
      });
    }

    // 计算盈亏
    const pnl = trade.direction === 'LONG'
      ? (exit_price - trade.entry_price) * trade.position_size
      : (trade.entry_price - exit_price) * trade.position_size;

    const pnl_percentage = (pnl / (trade.entry_price * trade.position_size)) * 100;

    const updateData = {
      status: 'CLOSED',
      exit_price,
      exit_reason,
      pnl,
      pnl_percentage,
      closed_at: new Date()
    };

    const result = await getDbOps().updateTrade(id, updateData);

    res.json({
      success: true,
      data: result,
      message: '模拟交易关闭成功',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('关闭模拟交易失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取交易统计
 * GET /api/v1/trades/statistics
 */
router.get('/statistics', async (req, res) => {
  try {
    const { strategy, symbol } = req.query;

    const stats = await getDbOps().getTradeStatistics(strategy, symbol);

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('获取交易统计失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
