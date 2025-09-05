#!/bin/bash

# 快速部署脚本 - 适用于已有 Node.js 环境的 VPS

echo "🚀 快速部署 VPS 代理服务器..."

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 请先安装 Node.js"
    exit 1
fi

# 创建项目目录
mkdir -p /opt/smartflow-proxy
cd /opt/smartflow-proxy

# 复制文件（假设当前目录包含 vps-proxy 文件夹）
cp -r vps-proxy/* .

# 安装依赖
echo "📦 安装依赖..."
npm install --production

# 启动服务
echo "🚀 启动服务..."
nohup node server.js > server.log 2>&1 &

# 等待服务启动
sleep 3

# 检查服务状态
if pgrep -f "node server.js" > /dev/null; then
    echo "✅ 服务启动成功！"
    echo "🌍 访问地址: http://47.237.163.85:3000"
    echo "🔗 API 代理: http://47.237.163.85:3000/api/binance"
    echo "📝 日志文件: /opt/smartflow-proxy/server.log"
else
    echo "❌ 服务启动失败，请检查日志"
    cat server.log
fi
