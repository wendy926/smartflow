/**
 * 策略参数管理 API 路由
 * 提供策略参数的查询、更新、历史记录等功能
 */

const express = require('express');
const router = express.Router();

/**
 * 获取策略参数
 * GET /api/v1/strategy-params/:strategyName/:strategyMode
 * Query: ?paramGroup=xxx (可选)
 */
router.get('/:strategyName/:strategyMode', async (req, res) => {
  try {
    const { strategyName, strategyMode } = req.params;
    const { paramGroup } = req.query;

    const strategyParamManager = req.app.get('strategyParamManager');
    if (!strategyParamManager) {
      return res.status(503).json({
        success: false,
        error: 'Strategy parameter manager not initialized'
      });
    }

    const params = await strategyParamManager.getStrategyParams(
      strategyName.toUpperCase(),
      strategyMode.toUpperCase(),
      paramGroup
    );

    res.json({
      success: true,
      data: {
        strategyName: strategyName.toUpperCase(),
        strategyMode: strategyMode.toUpperCase(),
        paramGroup: paramGroup || 'all',
        params: params
      }
    });

  } catch (error) {
    console.error('Error getting strategy params:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取单个参数
 * GET /api/v1/strategy-params/:strategyName/:strategyMode/:paramGroup/:paramName
 */
router.get('/:strategyName/:strategyMode/:paramGroup/:paramName', async (req, res) => {
  try {
    const { strategyName, strategyMode, paramGroup, paramName } = req.params;

    const strategyParamManager = req.app.get('strategyParamManager');
    if (!strategyParamManager) {
      return res.status(503).json({
        success: false,
        error: 'Strategy parameter manager not initialized'
      });
    }

    const value = await strategyParamManager.getParam(
      strategyName.toUpperCase(),
      strategyMode.toUpperCase(),
      paramGroup,
      paramName
    );

    if (value === null) {
      return res.status(404).json({
        success: false,
        error: 'Parameter not found'
      });
    }

    res.json({
      success: true,
      data: {
        strategyName: strategyName.toUpperCase(),
        strategyMode: strategyMode.toUpperCase(),
        paramGroup,
        paramName,
        value
      }
    });

  } catch (error) {
    console.error('Error getting param:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 更新单个参数
 * PUT /api/v1/strategy-params/:strategyName/:strategyMode/:paramGroup/:paramName
 * Body: { value: xxx, changedBy: xxx, reason: xxx }
 */
router.put('/:strategyName/:strategyMode/:paramGroup/:paramName', async (req, res) => {
  try {
    const { strategyName, strategyMode, paramGroup, paramName } = req.params;
    const { value, changedBy = 'system', reason = '' } = req.body;

    if (value === undefined || value === null) {
      return res.status(400).json({
        success: false,
        error: 'Value is required'
      });
    }

    const strategyParamManager = req.app.get('strategyParamManager');
    if (!strategyParamManager) {
      return res.status(503).json({
        success: false,
        error: 'Strategy parameter manager not initialized'
      });
    }

    const success = await strategyParamManager.updateParam(
      strategyName.toUpperCase(),
      strategyMode.toUpperCase(),
      paramGroup,
      paramName,
      value,
      changedBy,
      reason
    );

    if (!success) {
      return res.status(400).json({
        success: false,
        error: 'Failed to update parameter'
      });
    }

    res.json({
      success: true,
      message: 'Parameter updated successfully'
    });

  } catch (error) {
    console.error('Error updating param:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 批量更新参数
 * PUT /api/v1/strategy-params/:strategyName/:strategyMode
 * Body: { 
 *   updates: { paramGroup: { paramName: value } },
 *   changedBy: xxx,
 *   reason: xxx
 * }
 */
router.put('/:strategyName/:strategyMode', async (req, res) => {
  try {
    const { strategyName, strategyMode } = req.params;
    const { updates, changedBy = 'system', reason = '' } = req.body;

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Updates object is required'
      });
    }

    const strategyParamManager = req.app.get('strategyParamManager');
    if (!strategyParamManager) {
      return res.status(503).json({
        success: false,
        error: 'Strategy parameter manager not initialized'
      });
    }

    const result = await strategyParamManager.updateParams(
      strategyName.toUpperCase(),
      strategyMode.toUpperCase(),
      updates,
      changedBy,
      reason
    );

    res.json({
      success: true,
      data: result,
      message: `Updated ${result.success.length} parameters successfully`
    });

  } catch (error) {
    console.error('Error updating params:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取参数历史
 * GET /api/v1/strategy-params/:strategyName/:strategyMode/history
 * Query: ?limit=50
 */
router.get('/:strategyName/:strategyMode/history', async (req, res) => {
  try {
    const { strategyName, strategyMode } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const strategyParamManager = req.app.get('strategyParamManager');
    if (!strategyParamManager) {
      return res.status(503).json({
        success: false,
        error: 'Strategy parameter manager not initialized'
      });
    }

    const history = await strategyParamManager.getParamHistory(
      strategyName.toUpperCase(),
      strategyMode.toUpperCase(),
      limit
    );

    res.json({
      success: true,
      data: {
        strategyName: strategyName.toUpperCase(),
        strategyMode: strategyMode.toUpperCase(),
        history
      }
    });

  } catch (error) {
    console.error('Error getting param history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 添加回测结果
 * POST /api/v1/strategy-params/backtest
 * Body: { strategyName, strategyMode, backtestPeriod, ... }
 */
router.post('/backtest', async (req, res) => {
  try {
    const result = req.body;

    if (!result.strategyName || !result.strategyMode || !result.backtestPeriod) {
      return res.status(400).json({
        success: false,
        error: 'strategyName, strategyMode, and backtestPeriod are required'
      });
    }

    const strategyParamManager = req.app.get('strategyParamManager');
    if (!strategyParamManager) {
      return res.status(503).json({
        success: false,
        error: 'Strategy parameter manager not initialized'
      });
    }

    const success = await strategyParamManager.addBacktestResult(result);

    if (!success) {
      return res.status(400).json({
        success: false,
        error: 'Failed to add backtest result'
      });
    }

    res.json({
      success: true,
      message: 'Backtest result added successfully'
    });

  } catch (error) {
    console.error('Error adding backtest result:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取回测结果
 * GET /api/v1/strategy-params/:strategyName/:strategyMode/backtest
 * Query: ?limit=10
 */
router.get('/:strategyName/:strategyMode/backtest', async (req, res) => {
  try {
    const { strategyName, strategyMode } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    const strategyParamManager = req.app.get('strategyParamManager');
    if (!strategyParamManager) {
      return res.status(503).json({
        success: false,
        error: 'Strategy parameter manager not initialized'
      });
    }

    const results = await strategyParamManager.getBacktestResults(
      strategyName.toUpperCase(),
      strategyMode.toUpperCase(),
      limit
    );

    res.json({
      success: true,
      data: {
        strategyName: strategyName.toUpperCase(),
        strategyMode: strategyMode.toUpperCase(),
        results
      }
    });

  } catch (error) {
    console.error('Error getting backtest results:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取所有策略模式
 * GET /api/v1/strategy-params/modes
 */
router.get('/modes', (req, res) => {
  try {
    const strategyParamManager = req.app.get('strategyParamManager');
    if (!strategyParamManager) {
      return res.status(503).json({
        success: false,
        error: 'Strategy parameter manager not initialized'
      });
    }

    res.json({
      success: true,
      data: {
        strategyNames: strategyParamManager.getStrategyNames(),
        strategyModes: strategyParamManager.getStrategyModes()
      }
    });

  } catch (error) {
    console.error('Error getting modes:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

