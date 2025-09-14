#!/usr/bin/env node

/**
 * 修复calculateMA方法的数据验证问题
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 开始修复calculateMA方法...');

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

// 修复calculateMA方法
const newCalculateMA = `  /**
   * 计算移动平均线 - 修复版本，包含数据验证
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
const calculateMARegex = /\/\*\*[\s\S]*?\*\/[\s\S]*?calculateMA\(candles, period = 20\) \{[\s\S]*?\}/;
content = content.replace(calculateMARegex, newCalculateMA);

// 添加数据验证方法
const validateKlineDataMethod = `
  /**
   * 验证K线数据质量
   */
  validateKlineData(klines, symbol) {
    if (!klines || klines.length === 0) {
      console.warn(\`⚠️ [\${symbol}] K线数据为空\`);
      return false;
    }
    
    const invalidCount = klines.filter(kline => {
      if (!kline) return true;
      
      if (Array.isArray(kline)) {
        if (kline.length < 6) return true;
        const close = parseFloat(kline[4]);
        const volume = parseFloat(kline[5]);
        return isNaN(close) || close <= 0 || isNaN(volume) || volume < 0;
      }
      
      if (typeof kline === 'object') {
        const close = parseFloat(kline.close);
        const volume = parseFloat(kline.volume || 0);
        return isNaN(close) || close <= 0 || isNaN(volume) || volume < 0;
      }
      
      return true;
    }).length;
    
    const validCount = klines.length - invalidCount;
    console.log(\`📊 [\${symbol}] 数据验证完成: \${validCount}/\${klines.length} 条有效\`);
    
    if (invalidCount > 0) {
      console.warn(\`⚠️ [\${symbol}] 发现 \${invalidCount} 条无效数据\`);
    }
    
    return validCount > 0;
  }`;

// 在类中添加数据验证方法
const classRegex = /class StrategyV3Core \{[\s\S]*?constructor\(db\) \{/;
content = content.replace(classRegex, (match) => match + validateKlineDataMethod);

// 写入修复后的内容
fs.writeFileSync(strategyPath, content);

console.log('✅ calculateMA方法修复完成');
console.log('📝 修复内容:');
console.log('   - 添加了数据验证和清理逻辑');
console.log('   - 支持数组和对象格式的K线数据');
console.log('   - 添加了详细的数据质量日志');
console.log('   - 新增了validateKlineData方法');

console.log('\n🚀 下一步: 重启服务以应用修复');
