#!/bin/bash

# VPS安全测试脚本
# 避免内存泄漏和CPU占用过高

echo "🧪 运行VPS安全测试..."

# 设置严格的内存限制
export NODE_OPTIONS="--max-old-space-size=128"

# 检查当前资源使用
echo "📊 测试前资源使用:"
free -h
echo "---"

# 只运行API测试，这些比较稳定
echo "🧪 运行API单测..."
npx jest --config jest.config.vps.js --testTimeout=2000 --maxWorkers=1 --detectOpenHandles=false --forceExit --verbose=false

echo "---"

# 最终资源检查
echo "📊 测试后资源使用:"
free -h

echo "✅ VPS安全测试完成"
