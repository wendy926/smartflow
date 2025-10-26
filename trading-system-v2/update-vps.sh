#!/bin/bash

# VPS更新脚本 - 拉取代码并重启加密货币策略服务

set -e

echo "=========================================="
echo "VPS代码更新和重启脚本"
echo "=========================================="
echo ""

# 进入项目目录
cd /home/admin/smartflow-vps-app/vps-app || {
    echo "错误: 无法进入项目目录"
    exit 1
}

# 显示当前状态
echo "1. 检查当前PM2进程状态..."
pm2 list

echo ""
echo "2. 检查Git状态..."
git status

echo ""
echo "3. 拉取最新代码..."
git pull origin main || {
    echo "警告: Git拉取失败，尝试stash..."
    git stash
    git pull origin main
}

echo ""
echo "4. 安装依赖（如果需要）..."
npm install

echo ""
echo "5. 重启加密货币策略服务..."

# 重启strategy-worker（加密货币策略）
if pm2 list | grep -q "strategy-worker"; then
    echo "   重启strategy-worker..."
    pm2 restart strategy-worker
else
    echo "   未找到strategy-worker进程"
fi

# 重启main-app（Web服务）
if pm2 list | grep -q "main-app"; then
    echo "   重启main-app..."
    pm2 restart main-app
else
    echo "   未找到main-app进程"
fi

echo ""
echo "6. 检查服务状态..."
sleep 3
pm2 list

echo ""
echo "7. 检查内存使用..."
free -h

echo ""
echo "=========================================="
echo "更新完成！"
echo "=========================================="
echo ""
echo "PM2进程状态:"
pm2 list

echo ""
echo "查看日志:"
echo "  pm2 logs strategy-worker --lines 50"
echo "  pm2 logs main-app --lines 50"
echo ""
echo "实时监控:"
echo "  pm2 monit"
echo ""

