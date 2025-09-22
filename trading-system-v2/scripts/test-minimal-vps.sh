#!/bin/bash

# 极简VPS测试脚本
# 严格控制资源使用

echo "🧪 运行极简VPS测试..."

# 设置极严格的内存限制
export NODE_OPTIONS="--max-old-space-size=50"

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

# 测试API
echo "🧪 测试API:"
curl -s http://localhost:8080/api/v1/health | head -3

echo "---"

# 检查资源使用
echo "📊 测试后资源使用:"
free -h

echo "---"

# 运行极简测试
echo "🧪 运行极简单测..."
npx jest tests/api/api-routes.test.js --testTimeout=2000 --maxWorkers=1 --detectOpenHandles --forceExit --verbose=false --testNamePattern="健康检查接口"

echo "---"

# 最终资源检查
echo "📊 最终资源使用:"
free -h

echo "✅ 极简测试完成"
