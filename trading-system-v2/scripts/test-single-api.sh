#!/bin/bash

# 单个API测试脚本
# 避免内存泄漏，一次只测试一个文件

echo "🧪 运行单个API测试..."

# 设置严格的内存限制
export NODE_OPTIONS="--max-old-space-size=200"

# 测试文件列表
test_files=(
  "tests/api/api-routes.test.js"
  "tests/api/symbols-api.test.js"
  "tests/api/strategies-api.test.js"
  "tests/api/binance-api.test.js"
  "tests/api/trades-api.test.js"
  "tests/api/monitoring-api.test.js"
  "tests/api/tools-api.test.js"
)

# 逐个运行测试文件
for test_file in "${test_files[@]}"; do
  echo "📝 测试文件: $test_file"
  
  # 运行单个测试文件
  npx jest "$test_file" --testTimeout=2000 --maxWorkers=1 --detectOpenHandles --forceExit --verbose=false
  
  # 强制垃圾回收
  if command -v node >/dev/null 2>&1; then
    node -e "if (global.gc) global.gc();"
  fi
  
  echo "✅ $test_file 完成"
  echo "---"
done

echo "✅ 所有API测试完成"
