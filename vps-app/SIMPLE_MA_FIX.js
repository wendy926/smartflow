#!/usr/bin/env node

/**
 * 简单修复calculateMA方法
 * 只修复最关键的数据格式问题
 */

const fs = require('fs');

console.log('🔧 开始简单修复calculateMA方法...');

const strategyPath = './modules/strategy/StrategyV3Core.js';

if (!fs.existsSync(strategyPath)) {
  console.error('❌ StrategyV3Core.js文件不存在');
  process.exit(1);
}

let content = fs.readFileSync(strategyPath, 'utf8');

// 备份原文件
const backupPath = strategyPath + '.backup.' + Date.now();
fs.writeFileSync(backupPath, content);
console.log('📋 已创建备份文件:', backupPath);

// 简单修复：只修改数据访问方式
// 将 x.close 改为 x[4]，将 x.high 改为 x[2]，等等
content = content.replace(/x\.close/g, 'x[4]');
content = content.replace(/x\.high/g, 'x[2]');
content = content.replace(/x\.low/g, 'x[3]');
content = content.replace(/x\.open/g, 'x[1]');
content = content.replace(/x\.volume/g, 'x[5]');

// 修复对象访问方式
content = content.replace(/candles\[i\]\.close/g, 'candles[i][4]');
content = content.replace(/candles\[i\]\.high/g, 'candles[i][2]');
content = content.replace(/candles\[i\]\.low/g, 'candles[i][3]');
content = content.replace(/candles\[i\]\.open/g, 'candles[i][1]');
content = content.replace(/candles\[i\]\.volume/g, 'candles[i][5]');

content = content.replace(/candles\[i - 1\]\.close/g, 'candles[i - 1][4]');
content = content.replace(/candles\[i - 1\]\.high/g, 'candles[i - 1][2]');
content = content.replace(/candles\[i - 1\]\.low/g, 'candles[i - 1][3]');
content = content.replace(/candles\[i - 1\]\.open/g, 'candles[i - 1][1]');
content = content.replace(/candles\[i - 1\]\.volume/g, 'candles[i - 1][5]');

// 写入修复后的内容
fs.writeFileSync(strategyPath, content);

console.log('✅ calculateMA方法简单修复完成');
console.log('📝 修复内容:');
console.log('   - 修复了数据访问方式');
console.log('   - 将对象访问改为数组访问');
console.log('   - 保持了原有的计算逻辑');

console.log('\n🚀 下一步: 重启服务并运行测试验证修复效果');
