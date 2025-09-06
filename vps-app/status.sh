#!/bin/bash

# SmartFlow 项目状态检查脚本
# 使用方法: ./status.sh

echo "📊 SmartFlow 项目状态检查"
echo "================================"

# 检查是否在正确的目录
if [ ! -f "server.js" ]; then
    echo "❌ 错误: 请在 vps-app 目录中运行此脚本"
    exit 1
fi

# 检查 Node.js 版本
echo "🔍 Node.js 版本: $(node --version)"

# 检查 PM2 状态
echo ""
echo "📱 PM2 应用状态:"
if command -v pm2 &> /dev/null; then
    pm2 list
else
    echo "❌ PM2 未安装"
fi

# 检查端口占用
echo ""
echo "🌐 端口状态:"
if netstat -tuln 2>/dev/null | grep -q ":8080"; then
    echo "✅ 端口 8080 正在使用"
    netstat -tuln | grep ":8080"
else
    echo "❌ 端口 8080 未使用"
fi

# 检查文件结构
echo ""
echo "📁 项目文件结构:"
echo "✅ 服务器文件: $(test -f server.js && echo "存在" || echo "缺失")"
echo "✅ 前端文件: $(test -f public/index.html && echo "存在" || echo "缺失")"
echo "✅ 样式文件: $(test -f public/css/main.css && echo "存在" || echo "缺失")"
echo "✅ 主JS文件: $(test -f public/js/main.js && echo "存在" || echo "缺失")"

# 检查模块化文件
echo ""
echo "🔧 模块化文件:"
modules=(
    "modules/database/DatabaseManager.js"
    "modules/strategy/SmartFlowStrategy.js"
    "modules/monitoring/DataMonitor.js"
    "modules/api/BinanceAPI.js"
    "modules/notifications/TelegramNotifier.js"
)

for module in "${modules[@]}"; do
    if [ -f "$module" ]; then
        echo "✅ $module"
    else
        echo "❌ $module"
    fi
done

# 检查数据库
echo ""
echo "💾 数据库状态:"
if [ -f "smartflow.db" ]; then
    db_size=$(du -h smartflow.db | cut -f1)
    echo "✅ 数据库文件存在 (大小: $db_size)"
else
    echo "❌ 数据库文件不存在"
fi

# 检查依赖
echo ""
echo "📦 依赖状态:"
if [ -d "node_modules" ]; then
    echo "✅ node_modules 存在"
    echo "📊 依赖数量: $(ls node_modules | wc -l)"
else
    echo "❌ node_modules 不存在"
fi

# 检查日志
echo ""
echo "📝 日志状态:"
if command -v pm2 &> /dev/null; then
    echo "📊 应用日志 (最近5行):"
    pm2 logs smartflow-app --lines 5 2>/dev/null || echo "无日志"
fi

# 检查内存使用
echo ""
echo "💻 系统资源:"
if command -v free &> /dev/null; then
    echo "内存使用:"
    free -h
fi

if command -v df &> /dev/null; then
    echo "磁盘使用:"
    df -h . 2>/dev/null || echo "无法获取磁盘信息"
fi

echo ""
echo "🎯 建议操作:"
echo "   - 查看完整日志: pm2 logs smartflow-app"
echo "   - 重启应用: ./restart.sh"
echo "   - 更新应用: ./update.sh"
echo "   - 清理项目: ./cleanup.sh"
