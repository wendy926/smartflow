# VPS 代理部署完整指南

## 🎯 概述

由于 Binance API 有 IP 限制，我们需要在新加坡 VPS 上部署代理服务器来中转所有 API 请求。

## 📋 部署步骤

### 1. 连接到 VPS

```bash
ssh root@47.237.163.85
```

### 2. 安装 Node.js

```bash
# 安装 Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version
npm --version
```

### 3. 创建项目目录

```bash
mkdir -p /opt/smartflow-proxy
cd /opt/smartflow-proxy
```

### 4. 上传项目文件

将以下文件上传到 VPS：

```bash
# 创建必要的文件
mkdir -p vps-proxy
cd vps-proxy

# 创建 package.json
cat > package.json << 'EOF'
{
  "name": "smartflow-vps-proxy",
  "version": "1.0.0",
  "description": "VPS 代理服务器 - 新加坡中转 Binance API",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "http-proxy-middleware": "^2.0.6",
    "cors": "^2.8.5",
    "express-rate-limit": "^6.7.0"
  },
  "engines": {
    "node": ">=16.0.0"
  }
}
EOF
```

### 5. 创建服务器文件

```bash
cat > server.js << 'EOF'
/**
 * VPS 代理服务器 - 新加坡中转
 * 用于绕过 Binance API 的 IP 限制
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
    server: 'VPS Proxy Server',
    location: 'Singapore'
  });
});

// Binance API 代理配置
const binanceProxy = createProxyMiddleware({
  target: 'https://fapi.binance.com',
  changeOrigin: true,
  pathRewrite: {
    '^/api/binance': '' // 移除 /api/binance 前缀
  },
  onProxyReq: (proxyReq, req, res) => {
    // 添加必要的请求头
    proxyReq.setHeader('User-Agent', 'SmartFlow-Trader/1.0');
    proxyReq.setHeader('X-Forwarded-For', req.ip);
    
    console.log(`[${new Date().toISOString()}] 代理请求: ${req.method} ${req.url}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    // 添加 CORS 头
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    
    console.log(`[${new Date().toISOString()}] 代理响应: ${proxyRes.statusCode} ${req.url}`);
  },
  onError: (err, req, res) => {
    console.error(`[${new Date().toISOString()}] 代理错误:`, err.message);
    res.status(500).json({
      error: 'Proxy Error',
      message: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 应用 Binance API 代理
app.use('/api/binance', binanceProxy);

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
  console.log(`🚀 VPS 代理服务器启动成功！`);
  console.log(`📍 服务器地址: http://0.0.0.0:${PORT}`);
  console.log(`🌍 外部访问: http://47.237.163.85:${PORT}`);
  console.log(`🔗 Binance API 代理: http://47.237.163.85:${PORT}/api/binance`);
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
EOF
```

### 6. 安装依赖

```bash
npm install
```

### 7. 启动服务

```bash
# 使用 PM2 管理进程
npm install -g pm2

# 启动服务
pm2 start server.js --name smartflow-proxy

# 设置开机自启
pm2 startup
pm2 save
```

### 8. 配置防火墙

```bash
# 开放端口
sudo ufw allow 3000

# 检查防火墙状态
sudo ufw status
```

### 9. 测试服务

```bash
# 测试健康检查
curl http://47.237.163.85:3000/health

# 测试 Binance API 代理
curl "http://47.237.163.85:3000/api/binance/fapi/v1/klines?symbol=BTCUSDT&interval=1h&limit=5"
```

## 🔧 管理命令

### 查看服务状态

```bash
pm2 status
pm2 logs smartflow-proxy
```

### 重启服务

```bash
pm2 restart smartflow-proxy
```

### 停止服务

```bash
pm2 stop smartflow-proxy
```

### 删除服务

```bash
pm2 delete smartflow-proxy
```

## 🧪 测试脚本

创建测试脚本：

```bash
cat > test-proxy.js << 'EOF'
const fetch = require('node-fetch');

const VPS_URL = 'http://47.237.163.85:3000';

async function testProxy() {
  console.log('🧪 开始测试 VPS 代理服务器...\n');

  // 测试健康检查
  try {
    console.log('1. 测试健康检查...');
    const healthResponse = await fetch(`${VPS_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ 健康检查通过:', healthData);
  } catch (error) {
    console.log('❌ 健康检查失败:', error.message);
    return;
  }

  // 测试 Binance API 代理
  const tests = [
    {
      name: 'K线数据',
      url: `${VPS_URL}/api/binance/fapi/v1/klines?symbol=BTCUSDT&interval=1h&limit=5`
    },
    {
      name: '资金费率',
      url: `${VPS_URL}/api/binance/fapi/v1/fundingRate?symbol=BTCUSDT&limit=1`
    }
  ];

  for (const test of tests) {
    try {
      console.log(`\n2. 测试 ${test.name}...`);
      const response = await fetch(test.url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ ${test.name} 测试通过`);
      
    } catch (error) {
      console.log(`❌ ${test.name} 测试失败:`, error.message);
    }
  }

  console.log('\n🎉 VPS 代理测试完成！');
}

testProxy().catch(console.error);
EOF

# 运行测试
node test-proxy.js
```

## 📊 监控

### 查看实时日志

```bash
pm2 logs smartflow-proxy --lines 100
```

### 查看系统资源

```bash
pm2 monit
```

## 🔄 更新部署

```bash
# 停止服务
pm2 stop smartflow-proxy

# 更新代码
# ... 更新 server.js 文件 ...

# 重启服务
pm2 restart smartflow-proxy
```

## 🚨 故障排除

### 1. 端口被占用

```bash
# 查看端口使用情况
netstat -tlnp | grep :3000

# 杀死占用端口的进程
sudo kill -9 <PID>
```

### 2. 服务无法启动

```bash
# 查看详细错误
pm2 logs smartflow-proxy --err

# 手动测试
node server.js
```

### 3. 网络连接问题

```bash
# 检查防火墙
sudo ufw status

# 检查端口监听
netstat -tlnp | grep :3000
```

## ✅ 验证部署

部署完成后，应该能够访问：

- **健康检查**: http://47.237.163.85:3000/health
- **API 代理**: http://47.237.163.85:3000/api/binance/*

Cloudflare Worker 将自动使用这个 VPS 代理来访问 Binance API，绕过 IP 限制。
