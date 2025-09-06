#!/bin/bash

# SmartFlow VPS 部署脚本 v2.0
# 使用方法: ./deploy.sh

set -e  # 遇到错误立即退出

echo "🚀 开始部署 SmartFlow 应用 v2.0..."

# 检查是否在正确的目录
if [ ! -f "server.js" ]; then
    echo "❌ 错误: 请在 vps-app 目录中运行此脚本"
    exit 1
fi

# 检查 Node.js 版本
echo "🔍 检查 Node.js 版本..."
node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$node_version" -lt 14 ]; then
    echo "❌ 错误: 需要 Node.js 14 或更高版本，当前版本: $(node --version)"
    exit 1
fi
echo "✅ Node.js 版本: $(node --version)"

# 备份数据库
echo "💾 备份数据库..."
if [ -f "smartflow.db" ]; then
    cp smartflow.db "smartflow.db.backup.$(date +%Y%m%d_%H%M%S)"
    echo "✅ 数据库已备份"
fi

# 安装依赖
echo "📦 安装依赖..."
npm install --production

# 检查 PM2 是否安装
if ! command -v pm2 &> /dev/null; then
    echo "📦 安装 PM2..."
    npm install -g pm2
fi

# 检查模块化文件是否存在
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
echo "✅ 所有模块化文件检查通过"

# 停止现有应用
echo "🛑 停止现有应用..."
pm2 stop smartflow-app 2>/dev/null || true
pm2 delete smartflow-app 2>/dev/null || true

# 清理日志
echo "🧹 清理旧日志..."
pm2 flush 2>/dev/null || true

# 启动应用
echo "▶️ 启动应用..."
pm2 start ecosystem.config.js

# 等待应用启动
echo "⏳ 等待应用启动..."
sleep 5

# 检查应用状态
if pm2 list | grep -q "smartflow-app.*online"; then
    echo "✅ 应用启动成功！"
else
    echo "❌ 应用启动失败，查看日志："
    pm2 logs smartflow-app --lines 20
    exit 1
fi

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup | grep -v "sudo" || true

echo ""
echo "🎉 部署完成！"
echo "📊 查看状态: pm2 status"
echo "📝 查看日志: pm2 logs smartflow-app"
echo "🔄 重启应用: pm2 restart smartflow-app"
echo "🌐 访问地址: http://your-server-ip:8080"
echo ""
echo "📋 模块化架构:"
echo "   - 后端模块: modules/"
echo "   - 前端模块: public/js/"
echo "   - 样式文件: public/css/main.css"
echo "   - 主入口: server.js"