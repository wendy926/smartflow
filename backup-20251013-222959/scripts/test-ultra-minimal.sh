#!/bin/bash

# 超轻量VPS测试脚本
# 资源使用最小化

echo "🧪 运行超轻量VPS测试..."

# 设置极严格的内存限制
export NODE_OPTIONS="--max-old-space-size=30"

# 检查当前资源使用
echo "📊 测试前资源使用:"
free -h
echo "---"

# 启动极简服务
echo "🚀 启动极简服务..."
pm2 start ecosystem-minimal.config.js

# 等待服务启动
sleep 1

# 检查服务状态
echo "📊 服务状态:"
pm2 status

echo "---"

# 测试API
echo "🧪 测试API:"
curl -s http://localhost:8080/api/v1/health | head -2

echo "---"

# 运行超轻量测试
echo "🧪 运行超轻量单测..."
npx jest --config jest.config.ultra-minimal.js --testTimeout=1000 --maxWorkers=1 --detectOpenHandles=false --forceExit --verbose=false

echo "---"

# 最终资源检查
echo "📊 最终资源使用:"
free -h

# 停止服务
echo "🛑 停止服务..."
pm2 stop minimal-app

echo "✅ 超轻量测试完成"
