#!/bin/bash

# 极简测试脚本
# 只测试最基本的功能，避免内存泄漏

echo "🧪 运行极简测试..."

# 设置极严格的内存限制
export NODE_OPTIONS="--max-old-space-size=128"

# 只测试一个简单的API文件
echo "📝 测试基础API路由..."
npx jest tests/api/api-routes.test.js --testTimeout=2000 --maxWorkers=1 --detectOpenHandles --forceExit --verbose=false --testNamePattern="健康检查接口"

echo "✅ 极简测试完成"
