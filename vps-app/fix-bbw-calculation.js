const fs = require('fs');

// 修复布林带带宽计算问题
function fixBBWCalculation() {
  const filePath = './modules/strategy/StrategyV3Core.js';
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 修复布林带带宽计算公式
  const oldPattern = /bandwidth: stdDev\[i\] \? \(4 \* stdDev\[i\] \/ m\) : 0/;
  const newPattern = 'bandwidth: (stdDev[i] && m) ? (4 * stdDev[i] / m) : 0';
  
  if (oldPattern.test(content)) {
    content = content.replace(oldPattern, newPattern);
    fs.writeFileSync(filePath, content);
    console.log('✅ 布林带带宽计算公式已修复');
  } else {
    console.log('⚠️ 未找到需要修复的布林带带宽计算公式');
  }
}

fixBBWCalculation();
