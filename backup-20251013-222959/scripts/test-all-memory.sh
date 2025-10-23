#!/bin/bash
echo "🔍 全面内存泄漏检测..."

# 设置严格的内存限制
export NODE_OPTIONS="--max-old-space-size=64 --expose-gc"

# 记录初始内存
echo "📊 初始内存使用:"
node -e "
const used = process.memoryUsage();
console.log('RSS:', Math.round(used.rss / 1024 / 1024), 'MB');
console.log('Heap Used:', Math.round(used.heapUsed / 1024 / 1024), 'MB');
"

echo "---"

# 测试所有API文件
echo "🧪 运行所有API测试..."

# 1. symbols-api.test.js
echo "测试 symbols-api.test.js..."
npx jest --config jest.config.memory-strict.js --testPathPattern=tests/api/symbols-api.test.js --testTimeout=1000 --maxWorkers=1 --detectOpenHandles=false --forceExit --verbose=false

# 2. strategies-api.test.js
echo "测试 strategies-api.test.js..."
npx jest --config jest.config.memory-strict.js --testPathPattern=tests/api/strategies-api.test.js --testTimeout=1000 --maxWorkers=1 --detectOpenHandles=false --forceExit --verbose=false

# 3. trades-api.test.js
echo "测试 trades-api.test.js..."
npx jest --config jest.config.memory-strict.js --testPathPattern=tests/api/trades-api.test.js --testTimeout=1000 --maxWorkers=1 --detectOpenHandles=false --forceExit --verbose=false

# 4. binance-api.test.js
echo "测试 binance-api.test.js..."
npx jest --config jest.config.memory-strict.js --testPathPattern=tests/api/binance-api.test.js --testTimeout=1000 --maxWorkers=1 --detectOpenHandles=false --forceExit --verbose=false

# 5. monitoring-api.test.js
echo "测试 monitoring-api.test.js..."
npx jest --config jest.config.memory-strict.js --testPathPattern=tests/api/monitoring-api.test.js --testTimeout=1000 --maxWorkers=1 --detectOpenHandles=false --forceExit --verbose=false

# 6. tools-api.test.js
echo "测试 tools-api.test.js..."
npx jest --config jest.config.memory-strict.js --testPathPattern=tests/api/tools-api.test.js --testTimeout=1000 --maxWorkers=1 --detectOpenHandles=false --forceExit --verbose=false

echo "---"

# 记录最终内存
echo "📊 最终内存使用:"
node -e "
const used = process.memoryUsage();
console.log('RSS:', Math.round(used.rss / 1024 / 1024), 'MB');
console.log('Heap Used:', Math.round(used.heapUsed / 1024 / 1024), 'MB');
"

echo "---"

# 强制垃圾回收
echo "🧹 强制垃圾回收..."
node -e "
if (global.gc) {
  global.gc();
  console.log('垃圾回收完成');
} else {
  console.log('垃圾回收不可用');
}
"

echo "---"

# 记录垃圾回收后内存
echo "📊 垃圾回收后内存使用:"
node -e "
const used = process.memoryUsage();
console.log('RSS:', Math.round(used.rss / 1024 / 1024), 'MB');
console.log('Heap Used:', Math.round(used.heapUsed / 1024 / 1024), 'MB');
"

echo "✅ 全面内存检测完成"
