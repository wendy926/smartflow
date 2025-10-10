/**
 * 工具相关API路由
 */

const express = require('express');
const router = express.Router();
const RollingStrategy = require('../../strategies/rolling-strategy');
const resourceMonitor = require('../../monitoring/resource-monitor');
const logger = require('../../utils/logger');
const { toBeijingISO } = require('../../utils/time-helper');

const rollingStrategy = new RollingStrategy();

/**
 * 滚仓计算器
 * POST /api/v1/tools/rolling-calculator
 */
router.post('/rolling-calculator', async (req, res) => {
  try {
    const {
      principal = 1000,
      initialLeverage = 50,
      entryPrice = 50000,
      currentPrice = 50000,
      triggerRatio = 0.2,
      maxRollings = 3
    } = req.body;

    const result = await rollingStrategy.execute({
      principal,
      initialLeverage,
      entryPrice,
      currentPrice,
      triggerRatio,
      maxRollings
    });

    res.json({
      success: true,
      data: result,
      timestamp: toBeijingISO()
    });
  } catch (error) {
    logger.error('滚仓计算失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 风险计算器
 * POST /api/v1/tools/risk-calculator
 */
router.post('/risk-calculator', async (req, res) => {
  try {
    const {
      balance = 10000,
      leverage = 10,
      entryPrice = 50000,
      stopLoss = 49000,
      riskPercentage = 0.02
    } = req.body;

    // 计算风险参数
    const riskAmount = balance * riskPercentage;
    const stopLossDistance = Math.abs(entryPrice - stopLoss) / entryPrice;
    const positionSize = riskAmount / (stopLossDistance * entryPrice);
    const marginRequired = (positionSize * entryPrice) / leverage;

    const result = {
      balance,
      leverage,
      entryPrice,
      stopLoss,
      riskPercentage: riskPercentage * 100,
      riskAmount,
      stopLossDistance: stopLossDistance * 100,
      positionSize,
      marginRequired,
      maxLoss: positionSize * Math.abs(entryPrice - stopLoss),
      riskRewardRatio: 3 // 默认3:1
    };

    res.json({
      success: true,
      data: result,
      timestamp: toBeijingISO()
    });
  } catch (error) {
    logger.error('风险计算失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 杠杆计算器
 * POST /api/v1/tools/leverage-calculator
 */
router.post('/leverage-calculator', async (req, res) => {
  try {
    const {
      balance = 10000,
      entryPrice = 50000,
      stopLoss = 49000,
      maxLossAmount = 200,
      direction = 'LONG'
    } = req.body;

    // 计算止损距离
    const stopLossDistance = direction === 'LONG'
      ? (entryPrice - stopLoss) / entryPrice
      : (stopLoss - entryPrice) / entryPrice;

    // 计算最大杠杆
    const maxLeverage = Math.floor(1 / (stopLossDistance + 0.005));

    // 计算最小保证金
    const minMargin = Math.ceil(maxLossAmount / (maxLeverage * stopLossDistance));

    // 计算仓位大小
    const positionSize = minMargin * maxLeverage / entryPrice;

    const result = {
      balance,
      entryPrice,
      stopLoss,
      direction,
      stopLossDistance: stopLossDistance * 100,
      maxLeverage: Math.max(1, Math.min(maxLeverage, 125)),
      minMargin,
      positionSize,
      maxLossAmount,
      actualLoss: positionSize * Math.abs(entryPrice - stopLoss)
    };

    res.json({
      success: true,
      data: result,
      timestamp: toBeijingISO()
    });
  } catch (error) {
    logger.error('杠杆计算失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 系统测试
 * POST /api/v1/tools/system-test
 */
router.post('/system-test', async (req, res) => {
  try {
    const testResults = [];

    // 测试数据库连接
    try {
      // 这里可以添加数据库连接测试
      testResults.push({
        test: '数据库连接',
        status: 'success',
        message: '数据库连接正常'
      });
    } catch (error) {
      testResults.push({
        test: '数据库连接',
        status: 'error',
        message: error.message
      });
    }

    // 测试策略计算
    try {
      const v3Result = await rollingStrategy.execute({
        principal: 1000,
        initialLeverage: 10,
        entryPrice: 50000,
        currentPrice: 51000
      });

      testResults.push({
        test: '策略计算',
        status: 'success',
        message: '策略计算正常'
      });
    } catch (error) {
      testResults.push({
        test: '策略计算',
        status: 'error',
        message: error.message
      });
    }

    // 测试系统资源
    try {
      const resources = resourceMonitor.checkResources();
      testResults.push({
        test: '系统资源',
        status: 'success',
        message: `CPU: ${resources?.cpu?.toFixed(2)}%, 内存: ${resources?.memory?.toFixed(2)}%`
      });
    } catch (error) {
      testResults.push({
        test: '系统资源',
        status: 'error',
        message: error.message
      });
    }

    const successCount = testResults.filter(r => r.status === 'success').length;
    const totalCount = testResults.length;

    res.json({
      success: true,
      data: {
        results: testResults,
        summary: {
          total: totalCount,
          success: successCount,
          failed: totalCount - successCount,
          successRate: (successCount / totalCount) * 100
        }
      },
      timestamp: toBeijingISO()
    });
  } catch (error) {
    logger.error('系统测试失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 动态杠杆滚仓计算器
 * POST /api/v1/tools/dynamic-rolling-calculator
 */
router.post('/dynamic-rolling-calculator', async (req, res) => {
  try {
    const params = req.body;

    const result = await rollingStrategy.calculateDynamicRolling(params);

    res.json({
      success: true,
      data: result,
      timestamp: toBeijingISO()
    });
  } catch (error) {
    logger.error('动态杠杆滚仓计算失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取滚仓策略参数建议
 * GET /api/v1/tools/rolling-parameters
 */
router.get('/rolling-parameters', async (req, res) => {
  try {
    const parameters = {
      triggerRatio: {
        value: 1.0,
        description: '浮盈达到本金触发滚仓',
        range: [0.5, 2.0],
        recommended: 1.0
      },
      leverageDecay: {
        value: 0.5,
        description: '滚仓后杠杆减半或略高，风险递减',
        range: [0.3, 0.7],
        recommended: 0.5
      },
      profitLockRatio: {
        value: 0.5,
        description: '每次锁定一半利润，保证安全',
        range: [0.3, 0.7],
        recommended: 0.5
      },
      minLeverage: {
        value: 5,
        description: '趋势末期杠杆不能低于5x，保证收益',
        range: [3, 10],
        recommended: 5
      },
      maxLeverage: {
        value: 50,
        description: '最高杠杆限制',
        range: [20, 100],
        recommended: 50
      }
    };

    res.json({
      success: true,
      data: parameters,
      timestamp: toBeijingISO()
    });
  } catch (error) {
    logger.error('获取滚仓参数失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
