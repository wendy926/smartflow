#!/bin/bash

# SmartFlow 应用更新脚本 v2.0
# 使用方法: ./update.sh

set -e

echo "🔄 开始更新 SmartFlow 应用..."

# 检查是否在正确的目录
if [ ! -f "server.js" ]; then
    echo "❌ 错误: 请在 vps-app 目录中运行此脚本"
    exit 1
fi

# 备份当前版本
echo "💾 备份当前版本..."
backup_dir="backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$backup_dir"
cp -r . "$backup_dir/" 2>/dev/null || true
echo "✅ 备份到: $backup_dir"

# 备份数据库
if [ -f "smartflow.db" ]; then
    cp smartflow.db "smartflow.db.backup.$(date +%Y%m%d_%H%M%S)"
    echo "✅ 数据库已备份"
fi

# 停止应用
echo "🛑 停止应用..."
pm2 stop smartflow-app 2>/dev/null || true

# 更新依赖
echo "📦 更新依赖..."
npm install --production

# 检查模块化文件
echo "🔍 检查模块化文件..."
required_files=(
    "modules/database/DatabaseManager.js"
    "modules/strategy/SmartFlowStrategy.js"
    "modules/monitoring/DataMonitor.js"
    "public/css/main.css"
    "public/js/main.js"
)

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ 错误: 缺少必要文件 $file"
        exit 1
    fi
done

# 重启应用
echo "▶️ 重启应用..."
pm2 restart smartflow-app

# 等待应用启动
sleep 3

# 检查应用状态
if pm2 list | grep -q "smartflow-app.*online"; then
    echo "✅ 应用更新成功！"
else
    echo "❌ 应用启动失败，回滚到备份版本..."
    rm -rf ./*
    cp -r "$backup_dir"/* .
    pm2 restart smartflow-app
    echo "🔄 已回滚到备份版本"
    exit 1
fi

echo ""
echo "🎉 更新完成！"
echo "📊 查看状态: pm2 status"
echo "📝 查看日志: pm2 logs smartflow-app"