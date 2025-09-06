#!/bin/bash

# SmartFlow 项目清理脚本
# 使用方法: ./cleanup.sh

echo "🧹 开始清理 SmartFlow 项目..."

# 检查是否在正确的目录
if [ ! -f "server.js" ]; then
    echo "❌ 错误: 请在 vps-app 目录中运行此脚本"
    exit 1
fi

# 清理备份文件
echo "🗑️ 清理备份文件..."
rm -f *.backup.*
rm -f smartflow.db.backup.*
rm -rf backup_*

# 清理测试文件
echo "🗑️ 清理测试文件..."
rm -f test-*.html
rm -f test-*.js

# 清理旧版本文件
echo "🗑️ 清理旧版本文件..."
rm -f index-old.html
rm -f server-old.js

# 清理日志文件
echo "🗑️ 清理日志文件..."
rm -f *.log
rm -rf logs/

# 清理临时文件
echo "🗑️ 清理临时文件..."
rm -f .DS_Store
rm -f Thumbs.db
find . -name "*.tmp" -delete
find . -name "*.temp" -delete

# 清理 node_modules 并重新安装
echo "📦 清理并重新安装依赖..."
rm -rf node_modules/
npm install --production

# 清理 PM2 日志
echo "🗑️ 清理 PM2 日志..."
pm2 flush 2>/dev/null || true

echo ""
echo "✅ 项目清理完成！"
echo "📊 当前项目大小:"
du -sh . 2>/dev/null || echo "无法计算大小"

echo ""
echo "📋 清理内容:"
echo "   - 备份文件"
echo "   - 测试文件"
echo "   - 旧版本文件"
echo "   - 日志文件"
echo "   - 临时文件"
echo "   - 重新安装依赖"
