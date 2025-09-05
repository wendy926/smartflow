#!/bin/bash

echo "🔧 设置Telegram环境变量..."

# 检查是否提供了参数
if [ $# -ne 2 ]; then
    echo "用法: $0 <TELEGRAM_BOT_TOKEN> <TELEGRAM_CHAT_ID>"
    echo "示例: $0 123456789:ABCdefGHIjklMNOpqrsTUVwxyz 987654321"
    exit 1
fi

BOT_TOKEN=$1
CHAT_ID=$2

echo "📝 设置环境变量..."
export TELEGRAM_BOT_TOKEN="$BOT_TOKEN"
export TELEGRAM_CHAT_ID="$CHAT_ID"

# 写入.bashrc文件
echo "export TELEGRAM_BOT_TOKEN=\"$BOT_TOKEN\"" >> ~/.bashrc
echo "export TELEGRAM_CHAT_ID=\"$CHAT_ID\"" >> ~/.bashrc

# 创建.env文件
cat > .env << EOF
TELEGRAM_BOT_TOKEN=$BOT_TOKEN
TELEGRAM_CHAT_ID=$CHAT_ID
PORT=8080
EOF

echo "✅ 环境变量已设置:"
echo "TELEGRAM_BOT_TOKEN: $TELEGRAM_BOT_TOKEN"
echo "TELEGRAM_CHAT_ID: $TELEGRAM_CHAT_ID"

# 重新加载环境变量
source ~/.bashrc

echo "🔄 停止现有应用..."
pm2 stop smartflow-app
pm2 delete smartflow-app

echo "🔄 使用新配置启动应用..."
pm2 start ecosystem.config.js --env production

echo "🔄 保存PM2配置..."
pm2 save

echo "⏳ 等待应用启动..."
sleep 5

echo "🧪 测试Telegram配置..."
curl -s "http://localhost:8080/api/telegram-status" | jq .

echo "✅ 设置完成！请访问网页检查配置状态。"
