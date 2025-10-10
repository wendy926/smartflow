/**
 * 交易对管理API路由
 */

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const { toBeijingISO } = require('../../utils/time-helper');

// 延迟初始化数据库操作
let dbOps = null;
const getDbOps = () => {
  if (!dbOps) {
    dbOps = require('../../database/operations');
  }
  return dbOps;
};

/**
 * 获取所有交易对
 * GET /api/v1/symbols
 */
router.get('/', async (req, res) => {
  try {
    logger.info('开始获取交易对列表');
    const symbols = await getDbOps().getAllSymbols();
    logger.info(`获取到 ${symbols.length} 个交易对`);

    const response = {
      success: true,
      data: symbols,
      count: symbols.length,
      timestamp: toBeijingISO()
    };

    logger.info('准备发送响应');
    res.json(response);
    logger.info('响应已发送');
  } catch (error) {
    logger.error('获取交易对列表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取单个交易对信息
 * GET /api/v1/symbols/:symbol
 */
router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const symbolInfo = await getDbOps().getSymbol(symbol);

    if (!symbolInfo) {
      return res.status(404).json({
        success: false,
        error: '交易对不存在'
      });
    }

    res.json({
      success: true,
      data: symbolInfo,
      timestamp: toBeijingISO()
    });
  } catch (error) {
    logger.error('获取交易对信息失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 添加新交易对
 * POST /api/v1/symbols
 */
router.post('/', async (req, res) => {
  try {
    const { symbol, status = 'ACTIVE', funding_rate = 0, last_price = 0, volume_24h = 0, price_change_24h = 0 } = req.body;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: '交易对符号不能为空'
      });
    }

    const result = await getDbOps().addSymbol({
      symbol,
      status,
      funding_rate,
      last_price,
      volume_24h,
      price_change_24h
    });

    res.json({
      success: true,
      data: result,
      message: '交易对添加成功',
      timestamp: toBeijingISO()
    });
  } catch (error) {
    logger.error('添加交易对失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 更新交易对信息
 * PUT /api/v1/symbols/:symbol
 */
router.put('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const updateData = req.body;

    const result = await getDbOps().updateSymbol(symbol, updateData);

    res.json({
      success: true,
      data: result,
      message: '交易对更新成功',
      timestamp: toBeijingISO()
    });
  } catch (error) {
    logger.error('更新交易对失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 删除交易对
 * DELETE /api/v1/symbols/:symbol
 */
router.delete('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;

    await getDbOps().deleteSymbol(symbol);

    res.json({
      success: true,
      message: '交易对删除成功',
      timestamp: toBeijingISO()
    });
  } catch (error) {
    logger.error('删除交易对失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取活跃交易对
 * GET /api/v1/symbols/active
 */
router.get('/active', async (req, res) => {
  try {
    const activeSymbols = await getDbOps().getActiveSymbols();

    res.json({
      success: true,
      data: activeSymbols,
      count: activeSymbols.length,
      timestamp: toBeijingISO()
    });
  } catch (error) {
    logger.error('获取活跃交易对失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 手动更新交易对数据
 * POST /api/v1/symbols/update
 */
router.post('/update', async (req, res) => {
  try {
    // 这里应该调用数据更新服务
    // 暂时返回成功响应
    res.json({
      success: true,
      message: '数据更新已触发',
      timestamp: toBeijingISO()
    });
  } catch (error) {
    logger.error('Error updating symbols:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
