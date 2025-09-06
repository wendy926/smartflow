#!/bin/bash

# SmartFlow 应用快速重启脚本
# 使用方法: ./restart.sh

echo "🔄 重启 SmartFlow 应用..."

# 检查 PM2 是否运行
if ! command -v pm2 &> /dev/null; then
    echo "❌ 错误: PM2 未安装"
    exit 1
fi

# 重启应用
pm2 restart smartflow-app

# 等待应用启动
sleep 3

# 检查状态
if pm2 list | grep -q "smartflow-app.*online"; then
    echo "✅ 应用重启成功！"
    echo "📊 查看状态: pm2 status"
    echo "📝 查看日志: pm2 logs smartflow-app"
else
    echo "❌ 应用重启失败，查看日志："
    pm2 logs smartflow-app --lines 10
    exit 1
fi
