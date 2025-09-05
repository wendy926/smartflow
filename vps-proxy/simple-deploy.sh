#!/bin/bash

# 简化版 VPS 部署脚本
# 适用于快速部署代理服务器

echo "🚀 开始部署 VPS 代理服务器..."

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，正在安装..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# 创建项目目录
mkdir -p /opt/smartflow-proxy
cd /opt/smartflow-proxy

# 创建 package.json
cat > package.json << 'EOF'
{
  "name": "smartflow-vps-proxy",
  "version": "1.0.0",
  "description": "VPS 代理服务器 - 新加坡中转 Binance API",
  "main": "server.js",
  "dependencies": {
    "express": "^4.18.2",
    "http-proxy-middleware": "^2.0.6",
    "cors": "^2.8.5",
    "express-rate-limit": "^6.7.0"
  }
}
EOF

# 创建服务器文件
cat > server.js << 'EOF'
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    server: 'VPS Proxy Server',
    location: 'Singapore'
  });
});

// Binance API 代理
const binanceProxy = createProxyMiddleware({
  target: 'https://fapi.binance.com',
  changeOrigin: true,
  pathRewrite: {
    '^/api/binance': ''
  },
  onProxyReq: (proxyReq, req, res) => {
    proxyReq.setHeader('User-Agent', 'SmartFlow-Trader/1.0');
    console.log(`[${new Date().toISOString()}] 代理请求: ${req.method} ${req.url}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    console.log(`[${new Date().toISOString()}] 代理响应: ${proxyRes.statusCode} ${req.url}`);
  }
});

app.use('/api/binance', binanceProxy);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 VPS 代理服务器启动成功！`);
  console.log(`🌍 外部访问: http://47.237.163.85:${PORT}`);
  console.log(`🔗 Binance API 代理: http://47.237.163.85:${PORT}/api/binance`);
});

process.on('SIGINT', () => {
  console.log('正在关闭服务器...');
  process.exit(0);
});
EOF

# 安装依赖
echo "📦 安装依赖..."
npm install

# 启动服务
echo "🚀 启动服务..."
nohup node server.js > server.log 2>&1 &

# 等待服务启动
sleep 5

# 检查服务状态
if pgrep -f "node server.js" > /dev/null; then
    echo "✅ 服务启动成功！"
    echo "🌍 访问地址: http://47.237.163.85:3000"
    echo "🔗 API 代理: http://47.237.163.85:3000/api/binance"
    echo "📝 日志文件: /opt/smartflow-proxy/server.log"
    
    # 测试健康检查
    echo "🧪 测试健康检查..."
    curl -s http://47.237.163.85:3000/health | head -3
else
    echo "❌ 服务启动失败，请检查日志"
    cat server.log
fi
