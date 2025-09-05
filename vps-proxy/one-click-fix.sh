#!/bin/bash

# 一键修复 VPS 部署问题
# 解决权限、Node.js 和依赖问题

echo "🔧 开始修复 VPS 部署问题..."

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then
    echo "❌ 请使用 root 用户运行此脚本"
    echo "请执行: sudo su -"
    exit 1
fi

# 1. 更新系统
echo "📦 更新系统包..."
apt update -y

# 2. 安装 Node.js 18
echo "📦 安装 Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# 验证安装
echo "✅ Node.js 版本: $(node --version)"
echo "✅ npm 版本: $(npm --version)"

# 3. 创建项目目录
PROJECT_DIR="/home/admin/smartflow-proxy"
echo "📁 创建项目目录: $PROJECT_DIR"
mkdir -p $PROJECT_DIR
cd $PROJECT_DIR

# 4. 创建 package.json
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

# 5. 创建服务器文件
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

# 6. 安装依赖
echo "📦 安装依赖..."
npm install

# 检查依赖是否安装成功
if [ ! -d "node_modules" ]; then
    echo "❌ 依赖安装失败，尝试清理后重新安装..."
    rm -rf node_modules package-lock.json
    npm cache clean --force
    npm install
fi

# 7. 安装 PM2
echo "📦 安装 PM2..."
npm install -g pm2

# 8. 启动服务
echo "🚀 启动服务..."
pm2 start server.js --name smartflow-proxy

# 设置开机自启
pm2 startup
pm2 save

# 9. 配置防火墙
echo "🔧 配置防火墙..."
ufw allow 3000

# 10. 等待服务启动
echo "⏳ 等待服务启动..."
sleep 5

# 11. 检查服务状态
echo "📊 检查服务状态..."
pm2 status

# 12. 测试服务
echo "🧪 测试服务..."
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ 健康检查通过"
    curl -s http://localhost:3000/health | head -3
else
    echo "❌ 健康检查失败"
    echo "查看日志: pm2 logs smartflow-proxy"
fi

echo ""
echo "🎉 VPS 代理服务器部署完成！"
echo "🌍 访问地址: http://47.237.163.85:3000"
echo "🔗 API 代理: http://47.237.163.85:3000/api/binance"
echo "📊 管理命令: pm2 status, pm2 logs smartflow-proxy"
echo "🔄 重启命令: pm2 restart smartflow-proxy"
