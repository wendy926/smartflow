/**
 * 系统设置API路由
 */

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');

// 内存中存储最大损失金额设置（可以改为数据库存储）
let maxLossAmountSetting = 100; // 默认100 USDT（与前端保持一致）

/**
 * 获取最大损失金额设置
 * GET /api/v1/settings/maxLossAmount
 */
router.get('/maxLossAmount', async (req, res) => {
  try {
    res.json({
      success: true,
      value: maxLossAmountSetting,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('获取最大损失金额失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 保存最大损失金额设置
 * POST /api/v1/settings/maxLossAmount
 */
router.post('/maxLossAmount', async (req, res) => {
  try {
    const { value } = req.body;

    if (!value || typeof value !== 'number') {
      return res.status(400).json({
        success: false,
        error: '无效的最大损失金额'
      });
    }

    // 验证值在允许范围内
    const allowedValues = [20, 50, 100, 200];
    if (!allowedValues.includes(value)) {
      return res.status(400).json({
        success: false,
        error: '最大损失金额必须是20、50、100或200 USDT之一'
      });
    }

    maxLossAmountSetting = value;

    logger.info(`最大损失金额已更新为: ${value} USDT`);

    res.json({
      success: true,
      value: maxLossAmountSetting,
      message: '最大损失金额已保存',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('保存最大损失金额失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取当前设置（供其他模块调用）
 */
function getMaxLossAmount() {
  return maxLossAmountSetting;
}

module.exports = router;
module.exports.getMaxLossAmount = getMaxLossAmount;
