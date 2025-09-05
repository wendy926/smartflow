#!/bin/bash

echo "🚀 部署带数据监控功能的 SmartFlow VPS 应用..."

# 检查是否在正确的目录
if [ ! -f "server.js" ]; then
    echo "❌ 错误: 请在包含 server.js 的目录中运行此脚本"
    exit 1
fi

# 停止现有服务
echo "🛑 停止现有服务..."
pm2 stop smartflow-app 2>/dev/null || true
pm2 delete smartflow-app 2>/dev/null || true

# 备份现有文件
echo "💾 备份现有文件..."
if [ -f "server.js" ]; then
    cp server.js server.js.backup.$(date +%Y%m%d_%H%M%S)
fi

# 安装依赖
echo "📦 安装依赖..."
npm install

# 启动服务
echo "🚀 启动服务..."
pm2 start server.js --name smartflow-app

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 5

# 检查服务状态
echo "📊 检查服务状态..."
pm2 status smartflow-app

# 测试服务
echo "🧪 测试服务..."
if curl -s http://localhost:8080/health > /dev/null; then
    echo "✅ 服务健康检查通过"
else
    echo "❌ 服务健康检查失败"
    pm2 logs smartflow-app --lines 10
    exit 1
fi

# 测试数据监控API
echo "📊 测试数据监控API..."
if curl -s http://localhost:8080/api/data-monitor > /dev/null; then
    echo "✅ 数据监控API正常"
else
    echo "⚠️ 数据监控API可能有问题"
fi

echo ""
echo "🎉 部署完成！"
echo "🌍 访问地址: http://47.237.163.85:8080"
echo "🔗 健康检查: http://47.237.163.85:8080/health"
echo "📊 数据监控: http://47.237.163.85:8080/api/data-monitor"
echo "📋 管理命令:"
echo "  - 查看状态: pm2 status"
echo "  - 查看日志: pm2 logs smartflow-app"
echo "  - 重启服务: pm2 restart smartflow-app"
echo "  - 停止服务: pm2 stop smartflow-app"
