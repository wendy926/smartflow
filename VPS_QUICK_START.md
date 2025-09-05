# VPS 代理快速部署指南

## 🎯 目标

在新加坡 VPS (47.237.163.85) 上部署代理服务器，用于中转 Binance API 请求，绕过 IP 限制。

## 🚀 快速部署

### 1. 连接到 VPS

```bash
ssh root@47.237.163.85
```

### 2. 运行部署脚本

```bash
# 下载并运行简化部署脚本
curl -sSL https://raw.githubusercontent.com/your-repo/smartflow/main/vps-proxy/simple-deploy.sh | bash
```

或者手动执行：

```bash
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
npm install

# 启动服务
nohup node server.js > server.log 2>&1 &
```

### 3. 验证部署

```bash
# 检查服务状态
ps aux | grep "node server.js"

# 测试健康检查
curl http://47.237.163.85:3000/health

# 测试 Binance API 代理
curl "http://47.237.163.85:3000/api/binance/fapi/v1/klines?symbol=BTCUSDT&interval=1h&limit=5"
```

## 🔧 管理命令

### 查看服务状态

```bash
# 查看进程
ps aux | grep "node server.js"

# 查看日志
tail -f /opt/smartflow-proxy/server.log
```

### 重启服务

```bash
# 停止服务
pkill -f "node server.js"

# 启动服务
cd /opt/smartflow-proxy
nohup node server.js > server.log 2>&1 &
```

### 停止服务

```bash
pkill -f "node server.js"
```

## 🧪 测试脚本

创建测试脚本：

```bash
cat > test-vps.js << 'EOF'
const fetch = require('node-fetch');

async function testVPS() {
  const VPS_URL = 'http://47.237.163.85:3000';
  
  try {
    // 测试健康检查
    console.log('测试健康检查...');
    const health = await fetch(`${VPS_URL}/health`);
    const healthData = await health.json();
    console.log('✅ 健康检查:', healthData);
    
    // 测试 Binance API 代理
    console.log('测试 Binance API 代理...');
    const klines = await fetch(`${VPS_URL}/api/binance/fapi/v1/klines?symbol=BTCUSDT&interval=1h&limit=5`);
    const klinesData = await klines.json();
    console.log('✅ K线数据:', klinesData.length, '条');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

testVPS();
EOF

# 运行测试
node test-vps.js
```

## 📊 监控

### 查看实时日志

```bash
tail -f /opt/smartflow-proxy/server.log
```

### 查看系统资源

```bash
# 查看内存使用
free -h

# 查看磁盘使用
df -h

# 查看网络连接
netstat -tlnp | grep :3000
```

## 🔄 更新部署

```bash
# 停止服务
pkill -f "node server.js"

# 更新代码
# ... 更新 server.js 文件 ...

# 重启服务
cd /opt/smartflow-proxy
nohup node server.js > server.log 2>&1 &
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
cat /opt/smartflow-proxy/server.log

# 手动测试
cd /opt/smartflow-proxy
node server.js
```

### 3. 网络连接问题

```bash
# 检查防火墙
sudo ufw status

# 开放端口
sudo ufw allow 3000
```

## ✅ 验证部署

部署完成后，应该能够访问：

- **健康检查**: http://47.237.163.85:3000/health
- **API 代理**: http://47.237.163.85:3000/api/binance/*

Cloudflare Worker 将自动使用这个 VPS 代理来访问 Binance API，绕过 IP 限制。

## 📞 支持

如果遇到问题，请检查：

1. 服务状态：`ps aux | grep "node server.js"`
2. 日志信息：`tail -f /opt/smartflow-proxy/server.log`
3. 网络连接：`curl -I http://47.237.163.85:3000/health`
4. 端口监听：`netstat -tlnp | grep :3000`
