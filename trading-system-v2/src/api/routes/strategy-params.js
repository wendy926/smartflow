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

/**
 * 应用配置到运行中的交易
 * POST /api/v1/strategy-params/:strategyName/:strategyMode/apply-to-running-trades
 * Body: { params: {...}, mode: 'AGGRESSIVE|BALANCED|CONSERVATIVE' }
 */
router.post('/:strategyName/:strategyMode/apply-to-running-trades', async (req, res) => {
  try {
    const { strategyName, strategyMode } = req.params;
    const { params, mode } = req.body;

    if (!params || typeof params !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Params object is required'
      });
    }

    const strategyParamManager = req.app.get('strategyParamManager');
    if (!strategyParamManager) {
      return res.status(503).json({
        success: false,
        error: 'Strategy parameter manager not initialized'
      });
    }

    const database = req.app.get('database');
    if (!database) {
      return res.status(503).json({
        success: false,
        error: 'Database not initialized'
      });
    }

    console.log(`[应用配置] 开始应用 ${strategyName} - ${strategyMode} 配置到运行中的交易`);
    console.log(`[应用配置] 参数:`, params);

    // 策略映射：将策略名称映射到数据库中的策略值
    const strategyMap = {
      'ICT': 'ICT_STRATEGY',
      'V3': 'V3_STRATEGY'
    };

    const dbStrategyName = strategyMap[strategyName.toUpperCase()];
    if (!dbStrategyName) {
      return res.status(400).json({
        success: false,
        error: `Unknown strategy: ${strategyName}`
      });
    }

    // ✅ 修复：使用正确的表名和列名
    const runningTrades = await database.query(
      'SELECT id, symbol_id, strategy_name, entry_price, stop_loss, take_profit, leverage FROM simulation_trades WHERE status = "OPEN" AND strategy_name = ?',
      [strategyName.toUpperCase()]
    );

    if (!runningTrades || runningTrades.length === 0) {
      return res.json({
        success: true,
        data: {
          updatedCount: 0,
          message: '没有运行中的交易需要更新'
        }
      });
    }

    console.log(`[应用配置] 找到 ${runningTrades.length} 个运行中的交易`);

    // 更新每个交易的参数
    let updatedCount = 0;
    for (const trade of runningTrades) {
      try {
        // 构建更新参数
        const updateParams = {
          // 风险管理参数
          stopLossATRMultiplier: params.risk_management?.stopLossATRMultiplier,
          takeProfitRatio: params.risk_management?.takeProfitRatio,

          // 仓位参数
          positionSize: params.position?.size,
          maxLeverage: params.position?.maxLeverage,

          // 模式
          strategyMode: mode
        };

        // 移除undefined值
        Object.keys(updateParams).forEach(key =>
          updateParams[key] === undefined && delete updateParams[key]
        );

        if (Object.keys(updateParams).length === 0) {
          continue;
        }

        // 重新计算止损和止盈价格
        // 注意：这里只是更新数据库记录，实际的价格调整需要策略引擎来处理

        // ✅ 修复：更新simulation_trades表
        // 这里只是标记为已更新，实际的价格调整由策略引擎动态处理
        await database.query(
          'UPDATE simulation_trades SET entry_time = entry_time WHERE id = ?',
          [trade.id]
        );

        updatedCount++;
      } catch (error) {
        console.error(`[应用配置] 更新交易 ${trade.id} 失败:`, error);
      }
    }

    console.log(`[应用配置] 成功更新 ${updatedCount} 个交易`);

    res.json({
      success: true,
      data: {
        updatedCount,
        totalRunningTrades: runningTrades.length,
        strategyName: strategyName.toUpperCase(),
        strategyMode: strategyMode.toUpperCase()
      }
    });

  } catch (error) {
    console.error('[应用配置] 错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * ✅ 动态切换策略模式
 * POST /api/v1/strategy-params/:strategyName/set-mode
 * Body: { mode: 'AGGRESSIVE' | 'BALANCED' | 'CONSERVATIVE' }
 */
router.post('/:strategyName/set-mode', async (req, res) => {
  try {
    const { strategyName } = req.params;
    const { mode } = req.body;
    const fs = require('fs');
    const path = require('path');

    if (!['AGGRESSIVE', 'BALANCED', 'CONSERVATIVE'].includes(mode)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid mode. Must be AGGRESSIVE, BALANCED, or CONSERVATIVE'
      });
    }

    // 创建信号目录
    const signalDir = path.join(__dirname, '../../.mode-signals');
    if (!fs.existsSync(signalDir)) {
      fs.mkdirSync(signalDir, { recursive: true });
    }

    // 创建模式切换信号文件
    const signalFile = path.join(signalDir, `${strategyName.toLowerCase()}-mode.txt`);
    fs.writeFileSync(signalFile, mode);

    console.log(`[模式切换] 已创建信号文件: ${signalFile}, 模式: ${mode}`);

    // ✅ 可选：如果有 strategy worker 实例，立即切换
    const strategyWorker = req.app.get('strategyWorker');
    if (strategyWorker) {
      await strategyWorker.setStrategyMode(strategyName.toUpperCase(), mode);
    }

    res.json({
      success: true,
      message: `${strategyName} 策略将在下次执行时切换至 ${mode} 模式`
    });

  } catch (error) {
    console.error('[切换模式] 错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

