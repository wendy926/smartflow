#!/bin/bash

echo "🔄 重启SmartFlow应用..."

# 停止现有应用
echo "⏹️ 停止现有应用..."
pm2 stop smartflow-app
pm2 delete smartflow-app

# 等待进程完全停止
sleep 2

# 检查端口是否被占用
echo "🔍 检查端口8080..."
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️ 端口8080被占用，正在释放..."
    fuser -k 8080/tcp
    sleep 2
fi

# 设置环境变量
export TELEGRAM_BOT_TOKEN="8023308948:AAEOK1pHRP5Mgd7oTRC7fheVTKUKwMnQjiA"
export TELEGRAM_CHAT_ID="8307452638"
export PORT=8080

# 直接启动应用
echo "🚀 启动应用..."
cd /home/admin/smartflow-vps-app/vps-app
pm2 start server.js --name smartflow-app --env production

# 等待应用启动
echo "⏳ 等待应用启动..."
sleep 5

# 检查状态
echo "📊 检查应用状态..."
pm2 status

# 检查日志
echo "📋 检查应用日志..."
pm2 logs smartflow-app --lines 10

# 测试API
echo "🧪 测试API..."
curl -s "http://localhost:8080/api/telegram-status" | jq . || echo "API测试失败"

echo "✅ 重启完成！"
