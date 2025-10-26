/**
 * 回测API路由
 * 提供策略参数化回测的RESTful API接口
 */

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');

// 回测管理器实例（在main.js中注入）
let backtestManager = null;
let backtestDataService = null;
let backtestStrategyEngine = null;
let marketDataPreloader = null;

/**
 * 设置回测服务实例
 * @param {Object} manager - 回测管理器
 * @param {Object} dataService - 数据服务
 * @param {Object} strategyEngine - 策略引擎
 * @param {Object} preloader - 市场数据预加载器
 */
function setBacktestServices(manager, dataService, strategyEngine, preloader) {
  backtestManager = manager;
  backtestDataService = dataService;
  backtestStrategyEngine = strategyEngine;
  marketDataPreloader = preloader;
}

/**
 * 预加载2024年市场数据
 * POST /api/v1/backtest/data/preload-2024
 */
router.post('/data/preload-2024', async (req, res) => {
  try {
    const { symbols, timeframes } = req.body;

    if (!marketDataPreloader) {
      return res.status(500).json({
        success: false,
        error: '数据预加载服务未初始化'
      });
    }

    // 启动2024年数据预加载任务
    const result = await marketDataPreloader.preload2024Data(
      symbols || ['BTCUSDT', 'ETHUSDT'],
      timeframes || ['1h', '5m']
    );

    res.json({
      success: result.success,
      message: '2024年数据预加载任务已启动',
      data: result
    });

  } catch (error) {
    logger.error('[回测API] 2024年数据预加载失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 预加载市场数据
 * POST /api/v1/backtest/data/preload
 */
router.post('/data/preload', async (req, res) => {
  try {
    const { symbols, timeframes } = req.body;

    if (!marketDataPreloader) {
      return res.status(500).json({
        success: false,
        error: '数据预加载服务未初始化'
      });
    }

    // 启动预加载任务
    const result = await marketDataPreloader.preloadAllData(
      symbols || ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT'],
      timeframes || ['15m', '1h', '4h', '1d']
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error(`[回测API] 预加载数据失败:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 预加载指定时间范围的数据
 * POST /api/v1/backtest/data/preload/range
 */
router.post('/data/preload/range', async (req, res) => {
  try {
    const { symbol, timeframe, startDate, endDate } = req.body;

    if (!marketDataPreloader) {
      return res.status(500).json({
        success: false,
        error: '数据预加载服务未初始化'
      });
    }

    // 验证参数
    if (!symbol || !timeframe || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: symbol, timeframe, startDate, endDate'
      });
    }

    // 转换日期为时间戳
    const startTime = new Date(startDate).getTime();
    const endTime = new Date(endDate).getTime();

    if (isNaN(startTime) || isNaN(endTime)) {
      return res.status(400).json({
        success: false,
        error: '日期格式错误，请使用 YYYY-MM-DD 格式'
      });
    }

    // 启动预加载任务
    const result = await marketDataPreloader.preloadDataByRange(
      symbol,
      timeframe,
      startTime,
      endTime
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error(`[回测API] 预加载指定时间范围数据失败:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取预加载状态
 * GET /api/v1/backtest/data/preload/status
 */
router.get('/data/preload/status', async (req, res) => {
  try {
    if (!marketDataPreloader) {
      return res.status(500).json({
        success: false,
        error: '数据预加载服务未初始化'
      });
    }

    const status = marketDataPreloader.getPreloadStatus();

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    logger.error(`[回测API] 获取预加载状态失败:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 启动策略回测
 * POST /api/v1/backtest/:strategy/:mode
 */
router.post('/:strategy/:mode', async (req, res) => {
  try {
    const { strategy, mode } = req.params;
    const { symbols, timeframe = '15m', forceRefresh = false } = req.body;

    console.log(`[回测API] 收到回测请求: ${strategy}-${mode} (${timeframe})`);
    logger.info(`[回测API] 收到回测请求: ${strategy}-${mode} (${timeframe})`);

    // 验证参数
    if (!['ICT', 'V3'].includes(strategy)) {
      console.log(`[回测API] 不支持的策略类型: ${strategy}`);
      logger.warn(`[回测API] 不支持的策略类型: ${strategy}`);
      return res.status(400).json({
        success: false,
        error: '不支持的策略类型'
      });
    }

    if (!['AGGRESSIVE', 'BALANCED', 'CONSERVATIVE'].includes(mode)) {
      console.log(`[回测API] 不支持的策略模式: ${mode}`);
      logger.warn(`[回测API] 不支持的策略模式: ${mode}`);
      return res.status(400).json({
        success: false,
        error: '不支持的策略模式'
      });
    }

    if (!backtestManager) {
      console.log(`[回测API] 回测服务未初始化`);
      logger.error(`[回测API] 回测服务未初始化`);
      return res.status(500).json({
        success: false,
        error: '回测服务未初始化'
      });
    }

    console.log(`[回测API] 回测管理器状态: ${backtestManager ? '已初始化' : '未初始化'}`);
    logger.info(`[回测API] 回测管理器状态: ${backtestManager ? '已初始化' : '未初始化'}`);

    console.log(`[回测API] 开始调用backtestManager.startBacktest`);
    logger.info(`[回测API] 开始调用backtestManager.startBacktest`);

    // 启动回测
    const result = await backtestManager.startBacktest(strategy, mode, {
      symbols: symbols || backtestManager.getDefaultSymbols(),
      timeframe: timeframe,
      forceRefresh
    });

    console.log(`[回测API] backtestManager.startBacktest返回结果:`, result);
    logger.info(`[回测API] backtestManager.startBacktest返回结果:`, result);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error(`[回测API] 启动回测失败:`, error);
    logger.error(`[回测API] 启动回测失败:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取运行中的任务状态
 * GET /api/v1/backtest/running-tasks
 */
router.get('/running-tasks', async (req, res) => {
  try {
    if (!backtestManager) {
      return res.status(500).json({
        success: false,
        error: '回测服务未初始化'
      });
    }

    const status = backtestManager.getRunningTasksStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error(`[回测API] 获取运行任务状态失败:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取回测结果
 * GET /api/v1/backtest/:strategy/:mode
 */
router.get('/:strategy/:mode', async (req, res) => {
  try {
    const { strategy, mode } = req.params;

    // 验证参数
    if (!['ICT', 'V3'].includes(strategy)) {
      return res.status(400).json({
        success: false,
        error: '不支持的策略类型'
      });
    }

    if (!['AGGRESSIVE', 'BALANCED', 'CONSERVATIVE'].includes(mode)) {
      return res.status(400).json({
        success: false,
        error: '不支持的策略模式'
      });
    }

    if (!backtestManager) {
      return res.status(500).json({
        success: false,
        error: '回测服务未初始化'
      });
    }

    // 获取回测结果
    const result = await backtestManager.getBacktestResult(strategy, mode);

    if (!result) {
      return res.json({
        success: true,
        data: {
          strategy,
          mode,
          status: 'NO_DATA',
          message: '暂无回测数据'
        }
      });
    }

    res.json({
      success: true,
      data: {
        strategy: result.strategy_name,
        mode: result.strategy_mode,
        status: result.backtest_status,
        winRate: result.win_rate,
        profitLoss: result.total_pnl,
        maxDrawdown: result.max_drawdown,
        totalTrades: result.total_trades,
        winningTrades: result.winning_trades,
        losingTrades: result.losing_trades,
        avgWin: result.avg_win,
        avgLoss: result.avg_loss,
        sharpeRatio: result.sharpe_ratio,
        profitFactor: result.profit_factor,
        avgTradeDuration: result.avg_trade_duration,
        maxConsecutiveWins: result.max_consecutive_wins,
        maxConsecutiveLosses: result.max_consecutive_losses,
        totalFees: result.total_fees,
        netProfit: result.net_profit,
        backtestStartDate: result.backtest_start_date,
        backtestEndDate: result.backtest_end_date,
        totalDays: result.total_days,
        createdAt: result.created_at
      }
    });

  } catch (error) {
    logger.error(`[回测API] 获取回测结果失败:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取策略的所有回测结果
 * GET /api/v1/backtest/:strategy
 */
router.get('/:strategy', async (req, res) => {
  try {
    const { strategy } = req.params;

    // 验证参数
    if (!['ICT', 'V3'].includes(strategy)) {
      return res.status(400).json({
        success: false,
        error: '不支持的策略类型'
      });
    }

    if (!backtestManager) {
      return res.status(500).json({
        success: false,
        error: '回测服务未初始化'
      });
    }

    // 获取所有回测结果
    const results = await backtestManager.getAllBacktestResults(strategy);

    const formattedResults = results.map(result => ({
      strategy: result.strategy_name,
      mode: result.strategy_mode,
      status: result.backtest_status,
      winRate: result.win_rate,
      profitLoss: result.total_pnl,
      maxDrawdown: result.max_drawdown,
      totalTrades: result.total_trades,
      winningTrades: result.winning_trades,
      losingTrades: result.losing_trades,
      avgWin: result.avg_win,
      avgLoss: result.avg_loss,
      sharpeRatio: result.sharpe_ratio,
      profitFactor: result.profit_factor,
      avgTradeDuration: result.avg_trade_duration,
      maxConsecutiveWins: result.max_consecutive_wins,
      maxConsecutiveLosses: result.max_consecutive_losses,
      totalFees: result.total_fees,
      netProfit: result.net_profit,
      backtestStartDate: result.backtest_start_date,
      backtestEndDate: result.backtest_end_date,
      totalDays: result.total_days,
      createdAt: result.created_at
    }));

    res.json({
      success: true,
      data: formattedResults
    });

  } catch (error) {
    logger.error(`[回测API] 获取策略回测结果失败:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取回测任务状态
 * GET /api/v1/backtest/tasks/:taskId
 */
router.get('/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!backtestManager) {
      return res.status(500).json({
        success: false,
        error: '回测服务未初始化'
      });
    }

    // 检查运行中的任务
    const runningTask = backtestManager.runningTasks.get(taskId);
    if (runningTask) {
      return res.json({
        success: true,
        data: {
          taskId,
          status: 'RUNNING',
          progress: 50, // 简化实现
          startTime: runningTask.startTime
        }
      });
    }

    // 从数据库查询任务状态
    const query = `
      SELECT * FROM backtest_tasks 
      WHERE id = ?
    `;
    const tasks = await backtestManager.database.query(query, [taskId]);

    if (tasks.length === 0) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }

    const task = tasks[0];
    res.json({
      success: true,
      data: {
        taskId: task.id,
        strategy: task.strategy_name,
        mode: task.target_mode,
        status: task.status,
        progress: task.progress_percent,
        startTime: task.start_time,
        endTime: task.end_time,
        errorMessage: task.error_message
      }
    });

  } catch (error) {
    logger.error(`[回测API] 获取任务状态失败:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取市场数据状态
 * GET /api/v1/backtest/data/status
 */
router.get('/data/status', async (req, res) => {
  try {
    if (!backtestDataService) {
      return res.status(500).json({
        success: false,
        error: '数据服务未初始化'
      });
    }

    const symbols = backtestManager ? backtestManager.getDefaultSymbols() : [];
    const reports = await backtestDataService.batchCheckDataIntegrity(symbols, '1h');

    const status = {
      totalSymbols: symbols.length,
      completeSymbols: reports.filter(r => r.isComplete).length,
      incompleteSymbols: reports.filter(r => !r.isComplete).length,
      reports: reports.map(r => ({
        symbol: r.symbol,
        completeness: r.completeness,
        isComplete: r.isComplete,
        totalRecords: r.totalRecords,
        uniqueDays: r.uniqueDays
      }))
    };

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    logger.error(`[回测API] 获取数据状态失败:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 刷新市场数据
 * POST /api/v1/backtest/data/refresh
 */
router.post('/data/refresh', async (req, res) => {
  try {
    const { symbols, timeframe = '15m' } = req.body;

    if (!backtestDataService) {
      return res.status(500).json({
        success: false,
        error: '数据服务未初始化'
      });
    }

    const targetSymbols = symbols || (backtestManager ? backtestManager.getDefaultSymbols() : []);

    logger.info(`[回测API] 刷新市场数据: ${targetSymbols.join(', ')}`);

    // 批量获取数据
    const results = await backtestDataService.getBatchHistoricalData(targetSymbols, timeframe, true);

    const successCount = Object.values(results).filter(data => data.length > 0).length;

    res.json({
      success: true,
      data: {
        requestedSymbols: targetSymbols.length,
        successCount,
        results: Object.keys(results).map(symbol => ({
          symbol,
          dataCount: results[symbol].length,
          success: results[symbol].length > 0
        }))
      }
    });

  } catch (error) {
    logger.error(`[回测API] 刷新市场数据失败:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取缓存统计
 * GET /api/v1/backtest/cache/stats
 */
router.get('/cache/stats', async (req, res) => {
  try {
    if (!backtestDataService) {
      return res.status(500).json({
        success: false,
        error: '数据服务未初始化'
      });
    }

    const stats = backtestDataService.getCacheStats();

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error(`[回测API] 获取缓存统计失败:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 清空缓存
 * DELETE /api/v1/backtest/cache
 */
router.delete('/cache', async (req, res) => {
  try {
    if (!backtestDataService) {
      return res.status(500).json({
        success: false,
        error: '数据服务未初始化'
      });
    }

    backtestDataService.clearCache();

    res.json({
      success: true,
      message: '缓存已清空'
    });

  } catch (error) {
    logger.error(`[回测API] 清空缓存失败:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = {
  router,
  setBacktestServices
};
