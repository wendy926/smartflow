#!/bin/bash

echo "🚀 部署更新后的 SmartFlow VPS 应用..."

# 停止现有服务
echo "⏹️ 停止现有服务..."
pm2 stop smartflow-app 2>/dev/null || true
pm2 delete smartflow-app 2>/dev/null || true

# 安装依赖
echo "📦 安装依赖..."
npm install

# 启动服务
echo "🔄 启动服务..."
pm2 start ecosystem.config.js

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 5

# 检查服务状态
echo "📊 检查服务状态..."
pm2 status

# 测试健康检查
echo "🧪 测试健康检查..."
curl -s http://localhost:8080/health | jq . || echo "健康检查失败"

# 测试 WebSocket 状态
echo "🔌 测试 WebSocket 状态..."
curl -s http://localhost:8080/api/websocket-status | jq . || echo "WebSocket 状态检查失败"

echo "✅ 部署完成！"
echo "🌍 访问地址: http://47.237.163.85:8080"
echo "🔌 WebSocket 状态: http://47.237.163.85:8080/api/websocket-status"
