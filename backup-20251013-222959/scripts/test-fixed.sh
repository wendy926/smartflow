#!/bin/bash

# 修复后的测试脚本
# 避免内存泄漏和死循环

echo "🧪 运行修复后的单测..."

# 设置严格的内存限制
export NODE_OPTIONS="--max-old-space-size=256"

# 检查当前资源使用
echo "📊 测试前资源使用:"
free -h 2>/dev/null || echo "本地环境，无法获取内存信息"
echo "---"

# 运行API单测（这些通常比较稳定）
echo "🧪 运行API单测..."
npx jest tests/api/ --testTimeout=3000 --maxWorkers=1 --detectOpenHandles --forceExit --verbose=false

echo "---"

# 运行单个策略测试，避免并发
echo "🧪 运行V3策略单测..."
npx jest tests/strategies/v3-strategy.test.js --testTimeout=5000 --maxWorkers=1 --detectOpenHandles --forceExit --verbose=false

echo "---"

# 运行ICT策略单测
echo "🧪 运行ICT策略单测..."
npx jest tests/strategies/ict-strategy.test.js --testTimeout=5000 --maxWorkers=1 --detectOpenHandles --forceExit --verbose=false

echo "---"

# 运行Rolling策略单测
echo "🧪 运行Rolling策略单测..."
npx jest tests/strategies/rolling-strategy.test.js --testTimeout=5000 --maxWorkers=1 --detectOpenHandles --forceExit --verbose=false

echo "---"

# 最终资源检查
echo "📊 测试后资源使用:"
free -h 2>/dev/null || echo "本地环境，无法获取内存信息"

echo "✅ 修复后的单测完成"
