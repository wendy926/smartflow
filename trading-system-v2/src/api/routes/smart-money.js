/**
 * 聪明钱跟踪API路由
 * 提供聪明钱检测相关的REST API接口
 */

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const { toBeijingISO } = require('../../utils/time-helper');

/**
 * 获取聪明钱检测结果（默认使用V2）
 * GET /api/v1/smart-money/detect?symbols=BTCUSDT,ETHUSDT&v2=true
 * GET /api/v1/smart-money/detect → 默认V2（包含isSmartMoney/isTrap）
 */
router.get('/detect', async (req, res) => {
  try {
    const detector = req.app.get('smartMoneyDetector');

    if (!detector) {
      return res.status(503).json({
        success: false,
        error: '聪明钱检测服务未初始化'
      });
    }

    const { symbols, v2 } = req.query;
    const symbolList = symbols ? symbols.split(',') : null;

    // 默认使用V2（包含isSmartMoney/isTrap字段）
    let results;
    if (v2 === 'false') {
      // 明确指定v2=false时才使用V1
      results = await detector.detectBatch(symbolList);
    } else {
      // 默认或v2=true时使用V2
      logger.info('[SmartMoneyAPI] 使用V2检测（包含isSmartMoney/isTrap）');
      results = await detector.detectBatchV2 ? 
        await detector.detectBatchV2(symbolList) : 
        await detector.detectBatch(symbolList);
    }

    res.json({
      success: true,
      data: results,
      timestamp: toBeijingISO()
    });
  } catch (error) {
    logger.error('聪明钱检测失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取监控列表
 * GET /api/v1/smart-money/watch-list
 */
router.get('/watch-list', async (req, res) => {
  try {
    const detector = req.app.get('smartMoneyDetector');

    if (!detector) {
      return res.status(503).json({
        success: false,
        error: '聪明钱检测服务未初始化'
      });
    }

    const watchList = await detector.loadWatchList();

    res.json({
      success: true,
      data: watchList,
      timestamp: toBeijingISO()
    });
  } catch (error) {
    logger.error('获取监控列表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 添加监控交易对
 * POST /api/v1/smart-money/watch-list
 * Body: { symbol: 'ADAUSDT' }
 */
router.post('/watch-list', async (req, res) => {
  try {
    const detector = req.app.get('smartMoneyDetector');

    if (!detector) {
      return res.status(503).json({
        success: false,
        error: '聪明钱检测服务未初始化'
      });
    }

    const { symbol } = req.body;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: '缺少symbol参数'
      });
    }

    const success = await detector.addToWatchList(symbol, 'user');

    if (success) {
      res.json({
        success: true,
        message: `已添加${symbol}到监控列表`,
        timestamp: toBeijingISO()
      });
    } else {
      res.status(500).json({
        success: false,
        error: '添加失败'
      });
    }
  } catch (error) {
    logger.error('添加监控失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 移除监控交易对
 * DELETE /api/v1/smart-money/watch-list/:symbol
 */
router.delete('/watch-list/:symbol', async (req, res) => {
  try {
    const detector = req.app.get('smartMoneyDetector');

    if (!detector) {
      return res.status(503).json({
        success: false,
        error: '聪明钱检测服务未初始化'
      });
    }

    const { symbol } = req.params;

    const success = await detector.removeFromWatchList(symbol);

    if (success) {
      res.json({
        success: true,
        message: `已移除${symbol}`,
        timestamp: toBeijingISO()
      });
    } else {
      res.status(500).json({
        success: false,
        error: '移除失败'
      });
    }
  } catch (error) {
    logger.error('移除监控失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

