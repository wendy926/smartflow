#!/usr/bin/env node

/**
 * 正确修复calculateMA方法
 * 解决数据格式不匹配导致的NaN问题
 */

const fs = require('fs');

console.log('🔧 开始正确修复calculateMA方法...');

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

// 正确的calculateMA方法
const correctCalculateMA = `  /**
   * 计算移动平均线
   */
  calculateMA(candles, period = 20) {
    if (!candles || candles.length === 0) {
      console.warn('⚠️ K线数据为空，无法计算MA');
      return [];
    }
    
    // 数据清理和验证
    const validCandles = candles.filter(candle => {
      if (!candle) return false;
      
      // 处理数组格式的K线数据 [timestamp, open, high, low, close, volume]
      if (Array.isArray(candle)) {
        if (candle.length < 6) return false;
        const close = parseFloat(candle[4]);
        const volume = parseFloat(candle[5]);
        return !isNaN(close) && close > 0 && !isNaN(volume) && volume >= 0;
      }
      
      // 处理对象格式的K线数据 {close, volume, ...}
      if (typeof candle === 'object') {
        const close = parseFloat(candle.close);
        const volume = parseFloat(candle.volume || 0);
        return !isNaN(close) && close > 0 && !isNaN(volume) && volume >= 0;
      }
      
      return false;
    });
    
    if (validCandles.length < period) {
      console.warn(\`⚠️ 有效数据不足: \${validCandles.length}/\${period}\`);
      return [];
    }
    
    console.log(\`📊 使用 \${validCandles.length} 条有效数据进行MA\${period}计算\`);
    
    const ma = [];
    for (let i = period - 1; i < validCandles.length; i++) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const candle = validCandles[j];
        const close = Array.isArray(candle) ? parseFloat(candle[4]) : parseFloat(candle.close);
        sum += close;
      }
      const avg = sum / period;
      ma.push(avg);
    }
    
    return ma;
  }`;

// 替换calculateMA方法
content = content.replace(
  /\/\*\*[\s\S]*?\*\/[\s\S]*?calculateMA\(candles, period = 20\) \{[\s\S]*?\}/,
  correctCalculateMA
);

// 写入修复后的内容
fs.writeFileSync(strategyPath, content);

console.log('✅ calculateMA方法修复完成');
console.log('📝 修复内容:');
console.log('   - 修复了数据格式不匹配问题');
console.log('   - 正确处理数组格式的K线数据');
console.log('   - 添加了数据验证和清理逻辑');
console.log('   - 支持数组和对象两种格式');

console.log('\n🚀 下一步: 重启服务以应用修复');
