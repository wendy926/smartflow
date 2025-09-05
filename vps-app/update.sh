#!/bin/bash

# SmartFlow VPS 更新脚本
# 使用方法: ./update.sh

echo "🔄 开始更新 SmartFlow 应用..."

# 检查是否在正确的目录
if [ ! -f "server.js" ]; then
    echo "❌ 错误: 请在 vps-app 目录中运行此脚本"
    exit 1
fi

# 备份当前版本
echo "💾 备份当前版本..."
cp server.js server.js.backup
cp -r public public.backup

# 重启应用以加载新代码
echo "🔄 重启应用..."
pm2 restart smartflow-app

# 等待应用启动
sleep 3

# 检查应用状态
if pm2 list | grep -q "smartflow-app.*online"; then
    echo "✅ 更新成功！应用正在运行"
    echo "📊 查看状态: pm2 status"
    echo "📝 查看日志: pm2 logs smartflow-app"
else
    echo "❌ 更新失败！应用未正常启动"
    echo "🔄 恢复备份..."
    cp server.js.backup server.js
    cp -r public.backup public
    pm2 restart smartflow-app
    echo "📝 查看错误日志: pm2 logs smartflow-app --err"
fi
