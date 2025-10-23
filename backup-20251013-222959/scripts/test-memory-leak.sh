#!/bin/bash
echo "🔍 内存泄漏检测测试..."

# 设置严格的内存限制
export NODE_OPTIONS="--max-old-space-size=64 --expose-gc"

# 记录初始内存使用
echo "📊 测试前内存使用:"
node -e "
const used = process.memoryUsage();
console.log('RSS:', Math.round(used.rss / 1024 / 1024), 'MB');
console.log('Heap Used:', Math.round(used.heapUsed / 1024 / 1024), 'MB');
console.log('Heap Total:', Math.round(used.heapTotal / 1024 / 1024), 'MB');
"

echo "---"

# 运行单个API测试文件，监控内存使用
echo "🧪 测试 symbols-api.test.js..."
node -e "
const { spawn } = require('child_process');
const fs = require('fs');

let maxMemory = 0;
let testCount = 0;

const runTest = () => {
  testCount++;
  console.log(\`第 \${testCount} 次测试...\`);
  
  const child = spawn('npx', [
    'jest',
    '--config', 'jest.config.memory-strict.js',
    '--testPathPattern=tests/api/symbols-api.test.js',
    '--testTimeout=1000',
    '--maxWorkers=1',
    '--detectOpenHandles=false',
    '--forceExit',
    '--verbose=false'
  ], {
    stdio: 'pipe',
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=64 --expose-gc' }
  });

  let output = '';
  child.stdout.on('data', (data) => {
    output += data.toString();
  });

  child.stderr.on('data', (data) => {
    output += data.toString();
  });

  child.on('close', (code) => {
    const used = process.memoryUsage();
    const currentMemory = Math.round(used.heapUsed / 1024 / 1024);
    maxMemory = Math.max(maxMemory, currentMemory);
    
    console.log(\`测试 \${testCount} 完成，当前内存: \${currentMemory}MB，最大内存: \${maxMemory}MB\`);
    
    if (testCount < 5) {
      // 等待2秒后运行下一次测试
      setTimeout(runTest, 2000);
    } else {
      console.log(\`\\n📊 内存泄漏检测结果:\`);
      console.log(\`最大内存使用: \${maxMemory}MB\`);
      if (maxMemory > 50) {
        console.log(\`❌ 检测到内存泄漏！最大内存超过50MB\`);
      } else {
        console.log(\`✅ 内存使用正常\`);
      }
    }
  });
};

runTest();
"

echo "---"
echo "✅ 内存泄漏检测完成"
