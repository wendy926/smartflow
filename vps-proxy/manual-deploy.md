# VPS 手动部署步骤

## 🚨 问题分析

从错误信息看，主要问题是：
1. 没有 root 权限创建 `/opt` 目录
2. Node.js 和 npm 没有安装
3. 依赖包没有安装

## 🔧 手动解决步骤

### 1. 切换到 root 用户

```bash
sudo su -
```

### 2. 更新系统并安装 Node.js

```bash
# 更新系统包
apt update -y

# 安装 Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# 验证安装
node --version
npm --version
```

### 3. 创建项目目录

```bash
# 使用用户目录避免权限问题
mkdir -p /home/admin/smartflow-proxy
cd /home/admin/smartflow-proxy
```

### 4. 创建 package.json

```bash
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
```

### 5. 创建服务器文件

```bash
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
```

### 6. 安装依赖

```bash
npm install
```

### 7. 安装 PM2 进程管理器

```bash
npm install -g pm2
```

### 8. 启动服务

```bash
# 使用 PM2 启动
pm2 start server.js --name smartflow-proxy

# 设置开机自启
pm2 startup
pm2 save
```

### 9. 配置防火墙

```bash
# 开放端口
ufw allow 3000

# 检查防火墙状态
ufw status
```

### 10. 测试服务

```bash
# 检查服务状态
pm2 status

# 测试健康检查
curl http://localhost:3000/health

# 测试 Binance API 代理
curl "http://localhost:3000/api/binance/fapi/v1/klines?symbol=BTCUSDT&interval=1h&limit=5"
```

## 🔍 故障排除

### 如果 npm install 失败

```bash
# 清理 npm 缓存
npm cache clean --force

# 重新安装
rm -rf node_modules package-lock.json
npm install
```

### 如果端口被占用

```bash
# 查看端口使用情况
netstat -tlnp | grep :3000

# 杀死占用端口的进程
kill -9 <PID>
```

### 如果服务无法启动

```bash
# 查看 PM2 日志
pm2 logs smartflow-proxy

# 手动测试
node server.js
```

## 📊 管理命令

```bash
# 查看服务状态
pm2 status

# 查看日志
pm2 logs smartflow-proxy

# 重启服务
pm2 restart smartflow-proxy

# 停止服务
pm2 stop smartflow-proxy

# 删除服务
pm2 delete smartflow-proxy
```

## ✅ 验证部署

部署完成后，应该能够访问：

- **健康检查**: http://47.237.163.85:3000/health
- **API 代理**: http://47.237.163.85:3000/api/binance/*

## 🎯 下一步

VPS 代理部署成功后，Cloudflare Worker 将自动使用这个代理来访问 Binance API，绕过 IP 限制。
