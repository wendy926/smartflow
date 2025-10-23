const express = require('express');
const cors = require('cors');
const BacktestManagerV3 = require('./src/services/backtest-manager-v3');
const logger = require('./src/utils/logger');

const app = express();
app.use(cors());
app.use(express.json());

const backtestManager = new BacktestManagerV3();

// 回测API路由
app.post('/api/v1/backtest/run', async (req, res) => {
  try {
    const { strategyName, mode, timeframe, startDate, endDate, symbol } = req.body;
    
    logger.info(`[旧回测系统V3] 接收回测请求: ${strategyName}-${mode}, 时间框架=${timeframe}`);
    
    const result = await backtestManager.startBacktest({
      strategyName,
      mode,
      timeframe: timeframe || '5m',
      startDate,
      endDate,
      symbol: symbol || 'BTCUSDT'
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('[旧回测系统V3] 回测失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`[旧回测系统V3] 启动在端口 ${PORT}`);
  logger.info(`[旧回测系统V3] 启动在端口 ${PORT}`);
});
