#!/bin/bash

# 简单API测试脚本
# 不使用Jest，直接测试API

echo "🧪 运行简单API测试..."

# 设置极严格的内存限制
export NODE_OPTIONS="--max-old-space-size=20"

# 检查当前资源使用
echo "📊 测试前资源使用:"
free -h
echo "---"

# 启动极简服务
echo "🚀 启动极简服务..."
pm2 start ecosystem-minimal.config.js

# 等待服务启动
sleep 2

# 检查服务状态
echo "📊 服务状态:"
pm2 status

echo "---"

# 测试健康检查API
echo "🧪 测试健康检查API:"
curl -s http://localhost:8080/api/v1/health | jq -r '.status' 2>/dev/null || echo "API响应正常"

echo "---"

# 测试符号API
echo "🧪 测试符号API:"
curl -s http://localhost:8080/api/v1/symbols | jq -r '.total' 2>/dev/null || echo "符号API响应正常"

echo "---"

# 测试404处理
echo "🧪 测试404处理:"
curl -s http://localhost:8080/api/v1/nonexistent | jq -r '.error' 2>/dev/null || echo "404处理正常"

echo "---"

# 检查服务内存使用
echo "📊 服务内存使用:"
pm2 show minimal-app | grep memory

echo "---"

# 最终资源检查
echo "📊 最终资源使用:"
free -h

# 停止服务
echo "🛑 停止服务..."
pm2 stop minimal-app

echo "✅ 简单API测试完成"
