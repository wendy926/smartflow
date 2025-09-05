#!/bin/bash

# SmartFlow VPS 部署脚本
# 使用方法: ./deploy.sh

echo "🚀 开始部署 SmartFlow 应用..."

# 检查是否在正确的目录
if [ ! -f "server.js" ]; then
    echo "❌ 错误: 请在 vps-app 目录中运行此脚本"
    exit 1
fi

# 安装依赖
echo "📦 安装依赖..."
npm install

# 检查 PM2 是否安装
if ! command -v pm2 &> /dev/null; then
    echo "📦 安装 PM2..."
    npm install -g pm2
fi

# 停止现有应用
echo "🛑 停止现有应用..."
pm2 stop smartflow-app 2>/dev/null || true
pm2 delete smartflow-app 2>/dev/null || true

# 启动应用
echo "▶️ 启动应用..."
pm2 start ecosystem.config.js

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup

echo "✅ 部署完成！"
echo "📊 查看状态: pm2 status"
echo "📝 查看日志: pm2 logs smartflow-app"
echo "🔄 重启应用: pm2 restart smartflow-app"
