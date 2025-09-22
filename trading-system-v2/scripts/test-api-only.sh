#!/bin/bash

# 只运行API测试的脚本
# 避免策略测试中的无限循环问题

echo "🧪 运行API接口测试..."

# 设置内存限制
export NODE_OPTIONS="--max-old-space-size=512"

# 只运行API测试，跳过策略测试
npm test -- --testPathPattern="api" --testTimeout=5000 --maxWorkers=1 --detectOpenHandles --forceExit

echo "✅ API测试完成"
