# SmartFlow 最终部署指南

## 🎯 系统架构

### Cloudflare Worker (主服务)
- **URL**: https://smartflow-trader.wendy-wang926.workers.dev
- **功能**: 策略分析、API 接口、前端界面
- **技术**: JavaScript, KV Storage, Cron Triggers

### 数据中转服务 (新加坡)
- **URL**: http://47.237.163.85:3000
- **功能**: 数据中转、API 代理
- **技术**: Node.js, Express, PM2

## 🚀 部署步骤

### 1. Cloudflare Worker 部署

```bash
# 安装依赖
npm install

# 部署到 Cloudflare
wrangler deploy
```

### 2. 数据中转服务部署

```bash
# 在服务器上创建目录
mkdir -p /opt/smartflow-data-server
cd /opt/smartflow-data-server

# 复制项目文件
cp -r vps-proxy/* .

# 安装依赖
npm install

# 启动服务
pm2 start server.js --name smartflow-data-server
pm2 startup
pm2 save
```

## 🔧 配置

### Cloudflare Worker 环境变量
- `TG_BOT_TOKEN`: Telegram Bot Token
- `TG_CHAT_ID`: Telegram Chat ID

### 服务器防火墙
- 开放端口: 3000
- 协议: TCP
- 来源: 0.0.0.0/0

## 📊 监控

### Cloudflare Worker
```bash
# 查看日志
wrangler tail --format=pretty

# 重新部署
wrangler deploy
```

### 数据中转服务
```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs smartflow-data-server

# 重启服务
pm2 restart smartflow-data-server
```

## 🌐 访问地址

- **主服务**: https://smartflow-trader.wendy-wang926.workers.dev
- **API 测试**: https://smartflow-trader.wendy-wang926.workers.dev/api/test
- **数据中转**: http://47.237.163.85:3000/health
- **API 中转**: http://47.237.163.85:3000/api/binance/*

## ✅ 验证部署

1. 访问主服务 URL
2. 测试 API 接口
3. 检查数据中转服务
4. 验证 Telegram 通知

系统部署完成！🎉
