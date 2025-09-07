#!/bin/bash

# SmartFlow 快速部署脚本
# 用于在VPS上快速获取最新代码并部署

set -e

echo "🚀 SmartFlow 快速部署开始..."

# 检查是否在正确的目录
if [ ! -f "server.js" ]; then
    echo "❌ 请在 vps-app 目录中运行此脚本"
    exit 1
fi

# 停止应用
echo "🛑 停止现有应用..."
pm2 stop smartflow-app 2>/dev/null || true

# 备份数据库
echo "💾 备份数据库..."
if [ -f "smartflow.db" ]; then
    cp smartflow.db "smartflow.db.backup.$(date +%Y%m%d_%H%M%S)"
fi

# 获取最新代码
echo "📥 获取最新代码..."
git stash push -m "Auto-stash $(date)" || true
git fetch origin
git pull origin main

# 安装依赖
echo "📦 安装依赖..."
npm install --production

# 启动应用
echo "▶️ 启动应用..."
pm2 start ecosystem.config.js

# 等待启动
sleep 5

# 检查状态
if pm2 list | grep -q "smartflow-app.*online"; then
    echo "✅ 部署成功！"
    echo "🌐 访问地址: http://$(hostname -I | awk '{print $1}'):8080"
    echo "📱 测试页面: http://$(hostname -I | awk '{print $1}'):8080/test-iphone.html"
else
    echo "❌ 部署失败，查看日志："
    pm2 logs smartflow-app --lines 20
fi
