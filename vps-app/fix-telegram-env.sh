#!/bin/bash

echo "🔧 修复Telegram环境变量问题..."

# 确保环境变量已设置
if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$TELEGRAM_CHAT_ID" ]; then
    echo "❌ 环境变量未设置，请先运行："
    echo "export TELEGRAM_BOT_TOKEN=\"your_bot_token\""
    echo "export TELEGRAM_CHAT_ID=\"your_chat_id\""
    exit 1
fi

echo "✅ 环境变量已设置："
echo "TELEGRAM_BOT_TOKEN: $TELEGRAM_BOT_TOKEN"
echo "TELEGRAM_CHAT_ID: $TELEGRAM_CHAT_ID"

# 停止现有应用
echo "🔄 停止现有应用..."
pm2 stop smartflow-app
pm2 delete smartflow-app

# 使用新配置启动
echo "🔄 使用新配置启动应用..."
pm2 start ecosystem.config.js --env production

# 保存PM2配置
echo "🔄 保存PM2配置..."
pm2 save

# 等待应用启动
echo "⏳ 等待应用启动..."
sleep 5

# 检查应用状态
echo "📊 检查应用状态..."
pm2 status

# 测试API
echo "🧪 测试Telegram配置..."
curl -s "http://localhost:8080/api/telegram-status" | jq .

echo "✅ 修复完成！"
