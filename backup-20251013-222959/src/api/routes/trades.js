/**
 * 模拟交易API路由
 */

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const { toBeijingISO } = require('../../utils/time-helper');
const tradeManager = require('../../core/trade-manager');

// 延迟初始化数据库操作
let dbOps = null;
const getDbOps = () => {
  if (!dbOps) {
    dbOps = require('../../database/operations');
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

    const trades = await getDbOps().getTrades(strategy, symbol, limit);

    res.json({
      success: true,
      data: trades,
      count: trades.length,
      timestamp: toBeijingISO()
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
      position_size,
      entry_reason = ''
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
      position_size: position_size || 1,
      entry_reason
    };

    const result = await tradeManager.createTrade(tradeData);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: result.message,
        timestamp: toBeijingISO()
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        data: result.data
      });
    }
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
      timestamp: toBeijingISO()
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

    const result = await tradeManager.closeTrade(id, {
      exit_price,
      exit_reason
    });

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: result.message,
        timestamp: toBeijingISO()
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
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

    const stats = await tradeManager.getTradeStatistics(strategy, symbol);

    res.json({
      success: true,
      data: stats,
      timestamp: toBeijingISO()
    });
  } catch (error) {
    logger.error('获取交易统计失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 检查交易创建条件
 * GET /api/v1/trades/check-creation
 */
router.get('/check-creation', async (req, res) => {
  try {
    const { symbol, strategy } = req.query;

    if (!symbol || !strategy) {
      return res.status(400).json({
        success: false,
        error: '交易对和策略参数不能为空'
      });
    }

    const result = await tradeManager.canCreateTrade(symbol, strategy);

    res.json({
      success: true,
      data: result,
      timestamp: toBeijingISO()
    });
  } catch (error) {
    logger.error('检查交易创建条件失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取活跃交易
 * GET /api/v1/trades/active
 */
router.get('/active', async (req, res) => {
  try {
    const { symbol, strategy } = req.query;

    let activeTrades;
    if (symbol && strategy) {
      activeTrades = await tradeManager.getActiveTrade(symbol, strategy);
      activeTrades = activeTrades ? [activeTrades] : [];
    } else {
      activeTrades = await tradeManager.getAllActiveTrades();
    }

    res.json({
      success: true,
      data: activeTrades,
      count: activeTrades.length,
      timestamp: toBeijingISO()
    });
  } catch (error) {
    logger.error('获取活跃交易失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取冷却时间状态
 * GET /api/v1/trades/cooldown-status
 */
router.get('/cooldown-status', async (req, res) => {
  try {
    const { symbol, strategy } = req.query;

    if (!symbol || !strategy) {
      return res.status(400).json({
        success: false,
        error: '交易对和策略参数不能为空'
      });
    }

    const status = tradeManager.getCooldownStatus(symbol, strategy);

    res.json({
      success: true,
      data: status,
      timestamp: toBeijingISO()
    });
  } catch (error) {
    logger.error('获取冷却时间状态失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 自动检查并关闭交易
 * POST /api/v1/trades/auto-close
 */
router.post('/auto-close', async (req, res) => {
  try {
    const { symbol, current_price } = req.body;

    if (!symbol || !current_price) {
      return res.status(400).json({
        success: false,
        error: '交易对和当前价格参数不能为空'
      });
    }

    const closedTrades = await tradeManager.autoCloseTrades(symbol, current_price);

    res.json({
      success: true,
      data: closedTrades,
      count: closedTrades.length,
      message: `自动关闭了 ${closedTrades.length} 个交易`,
      timestamp: toBeijingISO()
    });
  } catch (error) {
    logger.error('自动关闭交易失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
