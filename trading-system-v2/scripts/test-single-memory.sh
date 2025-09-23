#!/bin/bash
echo "🔍 单文件内存泄漏检测..."

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

# 运行单个测试文件
echo "🧪 运行 symbols-api.test.js..."
npx jest --config jest.config.memory-strict.js --testPathPattern=tests/api/symbols-api.test.js --testTimeout=1000 --maxWorkers=1 --detectOpenHandles=false --forceExit --verbose=false

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

echo "✅ 单文件内存检测完成"
