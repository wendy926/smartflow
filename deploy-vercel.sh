#!/bin/bash

# Vercel 部署脚本
echo "🚀 开始部署到 Vercel..."

# 检查是否安装了 Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "❌ 未找到 Vercel CLI，正在安装..."
    npm install -g vercel
fi

# 检查是否已登录
if ! vercel whoami &> /dev/null; then
    echo "⚠️  未登录 Vercel，请先登录:"
    vercel login
fi

# 设置环境变量
echo "📝 设置环境变量..."
vercel env add TG_BOT_TOKEN
vercel env add TG_CHAT_ID

# 部署到生产环境
echo "📦 部署到 Vercel..."
vercel --prod

echo "✅ 部署完成！"
echo "🌐 你的应用现在可以在中国正常访问了！"
