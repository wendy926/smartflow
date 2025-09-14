#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 开始运行SmartFlow策略V3核心修复逻辑测试...\n');

// 核心测试文件列表（只运行修复相关的测试）
const coreTestFiles = [
  'test/strategy-v3-fixes.test.js',
  'test/strategy-v3.test.js',
  'test/4h-trend-scoring.test.js',
  'test/trend-market-logic.test.js'
];

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

console.log('📋 核心测试文件列表:');
coreTestFiles.forEach((file, index) => {
  console.log(`  ${index + 1}. ${file}`);
});
console.log('');

// 运行每个测试文件
for (const testFile of coreTestFiles) {
  try {
    console.log(`\n🧪 运行测试: ${testFile}`);
    console.log('─'.repeat(50));

    const startTime = Date.now();
    const result = execSync(`npx jest ${testFile} --verbose --no-cache`, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: 'pipe'
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`✅ ${testFile} 通过 (${duration}s)`);

    // 解析测试结果
    const lines = result.split('\n');
    const testSummary = lines.find(line => line.includes('Tests:') || line.includes('test'));
    if (testSummary) {
      const match = testSummary.match(/(\d+) passed|(\d+) failed/);
      if (match) {
        const passed = parseInt(match[1]) || 0;
        const failed = parseInt(match[2]) || 0;
        passedTests += passed;
        failedTests += failed;
        totalTests += passed + failed;
      }
    }

  } catch (error) {
    console.log(`❌ ${testFile} 失败`);
    console.log(error.stdout || error.message);
    failedTests++;
  }
}

// 输出测试总结
console.log('\n' + '='.repeat(60));
console.log('📊 核心测试总结');
console.log('='.repeat(60));
console.log(`总测试数: ${totalTests}`);
console.log(`通过: ${passedTests} ✅`);
console.log(`失败: ${failedTests} ❌`);
console.log(`成功率: ${totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(2) : 0}%`);

if (failedTests === 0) {
  console.log('\n🎉 所有核心测试通过！策略V3修复逻辑验证成功！');
  process.exit(0);
} else {
  console.log('\n⚠️  部分核心测试失败，请检查修复逻辑');
  process.exit(1);
}
