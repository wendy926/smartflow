# VPS 代理服务器部署指南

## 🎯 概述

这个 VPS 代理服务器用于绕过 Binance API 的 IP 限制，通过新加坡 VPS 中转所有 API 请求。

## 🚀 快速部署

### 1. 连接到 VPS

```bash
ssh root@47.237.163.85
```

### 2. 运行部署脚本

```bash
# 下载项目文件到 VPS
git clone <your-repo-url> /opt/smartflow-proxy
cd /opt/smartflow-proxy/vps-proxy

# 运行部署脚本
chmod +x deploy.sh
./deploy.sh
```

### 3. 验证部署

```bash
# 检查服务状态
sudo systemctl status smartflow-proxy

# 测试健康检查
curl http://47.237.163.85:3000/health

# 测试 Binance API 代理
curl "http://47.237.163.85:3000/api/binance/fapi/v1/klines?symbol=BTCUSDT&interval=1h&limit=5"
```

## 🔧 手动部署

如果自动部署失败，可以手动执行以下步骤：

### 1. 安装 Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. 安装依赖

```bash
cd /opt/smartflow-proxy/vps-proxy
npm install --production
```

### 3. 创建 systemd 服务

```bash
sudo tee /etc/systemd/system/smartflow-proxy.service > /dev/null <<EOF
[Unit]
Description=SmartFlow VPS Proxy Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/smartflow-proxy/vps-proxy
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF
```

### 4. 启动服务

```bash
sudo systemctl daemon-reload
sudo systemctl enable smartflow-proxy
sudo systemctl start smartflow-proxy
```

## 📊 监控和管理

### 查看服务状态

```bash
sudo systemctl status smartflow-proxy
```

### 查看日志

```bash
# 实时日志
sudo journalctl -u smartflow-proxy -f

# 最近日志
sudo journalctl -u smartflow-proxy --since "1 hour ago"
```

### 重启服务

```bash
sudo systemctl restart smartflow-proxy
```

### 停止服务

```bash
sudo systemctl stop smartflow-proxy
```

## 🔍 故障排除

### 1. 端口被占用

```bash
# 查看端口使用情况
netstat -tlnp | grep :3000

# 杀死占用端口的进程
sudo kill -9 <PID>
```

### 2. 权限问题

```bash
# 确保文件权限正确
sudo chown -R root:root /opt/smartflow-proxy
sudo chmod +x /opt/smartflow-proxy/vps-proxy/server.js
```

### 3. 网络问题

```bash
# 检查防火墙
sudo ufw status

# 开放端口
sudo ufw allow 3000
```

### 4. 服务无法启动

```bash
# 查看详细错误
sudo journalctl -u smartflow-proxy --no-pager

# 手动测试
cd /opt/smartflow-proxy/vps-proxy
node server.js
```

## 🌐 API 端点

- **健康检查**: `GET /health`
- **Binance API 代理**: `GET /api/binance/*`

### 示例请求

```bash
# 获取 BTCUSDT K线数据
curl "http://47.237.163.85:3000/api/binance/fapi/v1/klines?symbol=BTCUSDT&interval=1h&limit=5"

# 获取资金费率
curl "http://47.237.163.85:3000/api/binance/fapi/v1/fundingRate?symbol=BTCUSDT&limit=1"

# 获取持仓量
curl "http://47.237.163.85:3000/api/binance/futures/data/openInterestHist?symbol=BTCUSDT&period=1h&limit=5"
```

## 🔒 安全配置

### 1. 防火墙设置

```bash
# 只允许 Cloudflare IP 访问
sudo ufw allow from 173.245.48.0/20 to any port 3000
sudo ufw allow from 103.21.244.0/22 to any port 3000
sudo ufw allow from 103.22.200.0/22 to any port 3000
sudo ufw allow from 103.31.4.0/22 to any port 3000
sudo ufw allow from 141.101.64.0/18 to any port 3000
sudo ufw allow from 108.162.192.0/18 to any port 3000
sudo ufw allow from 190.93.240.0/20 to any port 3000
sudo ufw allow from 188.114.96.0/20 to any port 3000
sudo ufw allow from 197.234.240.0/22 to any port 3000
sudo ufw allow from 198.41.128.0/17 to any port 3000
sudo ufw allow from 162.158.0.0/15 to any port 3000
sudo ufw allow from 104.16.0.0/13 to any port 3000
sudo ufw allow from 104.24.0.0/14 to any port 3000
sudo ufw allow from 172.64.0.0/13 to any port 3000
sudo ufw allow from 131.0.72.0/22 to any port 3000
```

### 2. 速率限制

代理服务器已配置速率限制：
- 每分钟最多 100 个请求
- 超过限制返回 429 错误

## 📈 性能优化

### 1. 启用 gzip 压缩

```bash
# 安装 compression 中间件
npm install compression

# 在 server.js 中添加
const compression = require('compression');
app.use(compression());
```

### 2. 启用缓存

```bash
# 安装 redis 缓存
sudo apt-get install redis-server

# 安装 redis 客户端
npm install redis
```

### 3. 负载均衡

如果需要处理大量请求，可以部署多个实例：

```bash
# 启动多个实例
PORT=3001 node server.js &
PORT=3002 node server.js &
PORT=3003 node server.js &
```

## 🔄 更新部署

```bash
# 拉取最新代码
cd /opt/smartflow-proxy
git pull origin main

# 重启服务
sudo systemctl restart smartflow-proxy
```

## 📞 支持

如果遇到问题，请检查：

1. 服务状态：`sudo systemctl status smartflow-proxy`
2. 日志信息：`sudo journalctl -u smartflow-proxy -f`
3. 网络连接：`curl -I http://47.237.163.85:3000/health`
4. 端口监听：`netstat -tlnp | grep :3000`
