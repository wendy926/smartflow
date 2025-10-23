/**
 * 主应用重构版本
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// 导入重构后的模块
const backtestRefactoredRouter = require('./routes/backtest-refactored');
const logger = require('./utils/logger');

const app = express();

// 中间件
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100 // 限制每个IP 15分钟内最多100个请求
});
app.use('/api/', limiter);

// 路由
app.use('/api/v1/backtest', backtestRefactoredRouter);

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0-refactored'
  });
});

// 错误处理
app.use((err, req, res, next) => {
  logger.error('应用错误', err);
  res.status(500).json({
    success: false,
    error: '内部服务器错误'
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  logger.info(`重构后回测系统启动成功，端口: ${PORT}`);
  console.log(`重构后回测系统启动成功，端口: ${PORT}`);
});

module.exports = app;
