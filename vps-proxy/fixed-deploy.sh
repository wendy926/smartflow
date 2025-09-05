#!/bin/bash

# 修复版 VPS 部署脚本
# 解决权限和依赖问题

echo "🚀 开始部署 VPS 代理服务器..."

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then
    echo "❌ 请使用 root 用户运行此脚本"
    echo "请执行: sudo su -"
    exit 1
fi

# 更新系统包
echo "📦 更新系统包..."
apt update -y

# 安装 Node.js 18
echo "📦 安装 Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# 验证安装
echo "✅ Node.js 版本: $(node --version)"
echo "✅ npm 版本: $(npm --version)"

# 创建项目目录（使用用户目录避免权限问题）
PROJECT_DIR="/home/admin/smartflow-proxy"
mkdir -p $PROJECT_DIR
cd $PROJECT_DIR

# 创建 package.json
echo "📝 创建 package.json..."
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
echo "📝 创建服务器文件..."
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

# 检查依赖是否安装成功
if [ ! -d "node_modules" ]; then
    echo "❌ 依赖安装失败"
    exit 1
fi

# 安装 PM2 用于进程管理
echo "📦 安装 PM2..."
npm install -g pm2

# 启动服务
echo "🚀 启动服务..."
pm2 start server.js --name smartflow-proxy

# 设置开机自启
pm2 startup
pm2 save

# 等待服务启动
sleep 5

# 检查服务状态
echo "📊 检查服务状态..."
pm2 status

# 测试健康检查
echo "🧪 测试健康检查..."
curl -s http://localhost:3000/health | head -3

# 开放防火墙端口
echo "🔧 配置防火墙..."
ufw allow 3000

echo "✅ VPS 代理服务器部署完成！"
echo "🌍 访问地址: http://47.237.163.85:3000"
echo "🔗 API 代理: http://47.237.163.85:3000/api/binance"
echo "📊 管理命令: pm2 status, pm2 logs smartflow-proxy"
