// 强制重新加载环境变量
delete require.cache[require.resolve('../.env')];
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env'), override: true });

// 清除配置和数据库连接缓存
delete require.cache[require.resolve('./config')];
delete require.cache[require.resolve('./database/connection')];

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const winston = require('winston');

// 重新加载配置
const config = require('./config');

// 打印数据库配置以诊断
console.log('[启动] 数据库配置:', {
  host: config.database.host,
  user: config.database.user,
  password: config.database.password ? '***' + config.database.password.slice(-3) : 'empty',
  database: config.database.name
});

const BacktestManagerRefactored = require('./services/backtest-manager-refactored');
const createBacktestRoutesRefactored = require('./routes/backtest-refactored');
const { StrategyEngine, ParameterManager, SignalProcessor } = require('./core/strategy-engine');
const V3StrategyRefactored = require('./strategies/v3-strategy-refactored');
const ICTStrategyRefactored = require('./strategies/ict-strategy-refactored');
const DatabaseAdapter = require('./core/database-adapter');

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', message: 'Refactored backtest system is healthy' });
});

// Setup backtest routes
const backtestManager = new BacktestManagerRefactored();
const backtestRoutes = createBacktestRoutesRefactored(backtestManager, logger);
app.use('/api/v1/backtest', backtestRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('未处理的错误:', err);
  res.status(500).json({ 
    success: false, 
    error: err.message || '服务器内部错误' 
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`重构后回测系统启动成功，端口: ${PORT}`);
  console.log(`重构后回测系统启动成功，端口: ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('收到SIGTERM信号，优雅关闭...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('收到SIGINT信号，优雅关闭...');
  process.exit(0);
});
