/**
 * 中转服务器 - 新加坡
 * 用于数据中转
 */

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置
app.use(cors());
app.use(express.json());

// 速率限制
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 100, // 最多100个请求
  message: 'Too many requests from this IP'
});
app.use(limiter);

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    server: 'Data Server',
    location: 'Singapore'
  });
});

// API 中转配置
const apiProxy = createProxyMiddleware({
  target: 'https://fapi.binance.com',
  changeOrigin: true,
  pathRewrite: {
    '^/api/binance': '' // 移除 /api/binance 前缀
  },
  onProxyReq: (proxyReq, req, res) => {
    // 添加必要的请求头
    proxyReq.setHeader('User-Agent', 'SmartFlow-Trader/1.0');
    proxyReq.setHeader('X-Forwarded-For', req.ip);

    console.log(`[${new Date().toISOString()}] 请求: ${req.method} ${req.url}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    // 添加 CORS 头
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';

    console.log(`[${new Date().toISOString()}] 响应: ${proxyRes.statusCode} ${req.url}`);
  },
  onError: (err, req, res) => {
    console.error(`[${new Date().toISOString()}] 错误:`, err.message);
    res.status(500).json({
      error: 'Service Error',
      message: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 应用 API 中转
app.use('/api/binance', apiProxy);

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] 服务器错误:`, err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// 404 处理
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found',
    timestamp: new Date().toISOString()
  });
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 中转服务器启动成功！`);
  console.log(`📍 服务器地址: http://0.0.0.0:${PORT}`);
  console.log(`🌍 外部访问: http://47.237.163.85:${PORT}`);
  console.log(`🔗 API 中转: http://47.237.163.85:${PORT}/api/binance`);
  console.log(`⏰ 启动时间: ${new Date().toISOString()}`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号，正在关闭服务器...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('收到 SIGINT 信号，正在关闭服务器...');
  process.exit(0);
});
