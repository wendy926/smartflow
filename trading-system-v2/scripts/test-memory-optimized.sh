#!/bin/bash

# 内存优化的测试脚本
# 只运行API测试，严格控制内存使用

echo "🧪 运行内存优化测试..."

# 设置严格的内存限制
export NODE_OPTIONS="--max-old-space-size=256 --expose-gc"

# 只运行API测试，使用内存优化配置
npx jest --config jest.config.memory-optimized.js --testPathPattern="api" --testTimeout=3000 --maxWorkers=1 --detectOpenHandles --forceExit --verbose=false

echo "✅ 内存优化测试完成"
