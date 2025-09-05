# 数据中转服务器

## 🎯 概述

数据中转服务器用于数据中转，部署在新加坡服务器上。

## 🚀 快速部署

### 1. 部署到服务器

```bash
# 创建项目目录
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

### 2. 验证部署

```bash
# 检查服务状态
pm2 status

# 测试健康检查
curl http://47.237.163.85:3000/health

# 测试 API 中转
curl "http://47.237.163.85:3000/api/binance/fapi/v1/klines?symbol=BTCUSDT&interval=1h&limit=5"
```

## 🔧 管理命令

```bash
# 查看服务状态
pm2 status

# 查看日志
pm2 logs smartflow-data-server

# 重启服务
pm2 restart smartflow-data-server

# 停止服务
pm2 stop smartflow-data-server
```

## 🌐 访问地址

- **健康检查**: http://47.237.163.85:3000/health
- **API 中转**: http://47.237.163.85:3000/api/binance/*