#!/usr/bin/env node

/**
 * 全面修复技术指标计算问题
 * 解决所有指标计算中的数据格式不匹配问题
 */

const fs = require('fs');

console.log('🔧 开始全面修复技术指标计算问题...');

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

// 数据访问辅助函数
const dataAccessHelpers = `
  /**
   * 数据访问辅助函数 - 统一处理数组和对象格式的K线数据
   */
  getCandleValue(candle, field) {
    if (!candle) return null;
    
    if (Array.isArray(candle)) {
      // 数组格式: [timestamp, open, high, low, close, volume]
      const fieldMap = {
        'timestamp': 0,
        'open': 1,
        'high': 2,
        'low': 3,
        'close': 4,
        'volume': 5
      };
      const index = fieldMap[field];
      return index !== undefined ? parseFloat(candle[index]) : null;
    }
    
    if (typeof candle === 'object') {
      // 对象格式: {open, high, low, close, volume, ...}
      return parseFloat(candle[field]);
    }
    
    return null;
  }
  
  validateCandle(candle) {
    if (!candle) return false;
    
    if (Array.isArray(candle)) {
      if (candle.length < 6) return false;
      const close = parseFloat(candle[4]);
      const volume = parseFloat(candle[5]);
      return !isNaN(close) && close > 0 && !isNaN(volume) && volume >= 0;
    }
    
    if (typeof candle === 'object') {
      const close = parseFloat(candle.close);
      const volume = parseFloat(candle.volume || 0);
      return !isNaN(close) && close > 0 && !isNaN(volume) && volume >= 0;
    }
    
    return false;
  }
  
  filterValidCandles(candles) {
    return candles.filter(candle => this.validateCandle(candle));
  }`;

// 修复后的calculateMA方法
const fixedCalculateMA = `  /**
   * 计算移动平均线 - 修复版本
   */
  calculateMA(candles, period = 20) {
    if (!candles || candles.length === 0) {
      console.warn('⚠️ K线数据为空，无法计算MA');
      return [];
    }
    
    const validCandles = this.filterValidCandles(candles);
    
    if (validCandles.length < period) {
      console.warn(\`⚠️ 有效数据不足: \${validCandles.length}/\${period}\`);
      return [];
    }
    
    console.log(\`📊 使用 \${validCandles.length} 条有效数据进行MA\${period}计算\`);
    
    const ma = [];
    for (let i = period - 1; i < validCandles.length; i++) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const close = this.getCandleValue(validCandles[j], 'close');
        sum += close;
      }
      const avg = sum / period;
      ma.push(avg);
    }
    
    return ma;
  }`;

// 修复后的calculateEMA方法
const fixedCalculateEMA = `  /**
   * 计算指数移动平均线 - 修复版本
   */
  calculateEMA(candles, period = 20) {
    if (!candles || candles.length === 0) {
      console.warn('⚠️ K线数据为空，无法计算EMA');
      return [];
    }
    
    const validCandles = this.filterValidCandles(candles);
    
    if (validCandles.length === 0) {
      console.warn('⚠️ 无有效数据，无法计算EMA');
      return [];
    }
    
    const multiplier = 2 / (period + 1);
    const ema = [];
    
    for (let i = 0; i < validCandles.length; i++) {
      const close = this.getCandleValue(validCandles[i], 'close');
      
      if (i === 0) {
        ema[i] = close;
      } else {
        ema[i] = (close * multiplier) + (ema[i - 1] * (1 - multiplier));
      }
    }
    
    return ema;
  }`;

// 修复后的calculateADX方法
const fixedCalculateADX = `  /**
   * 计算ADX指标 - 修复版本
   */
  calculateADX(candles, period = 14) {
    if (!candles || candles.length < period + 1) {
      console.warn(\`⚠️ 数据不足，无法计算ADX: \${candles?.length || 0} < \${period + 1}\`);
      return null;
    }
    
    const validCandles = this.filterValidCandles(candles);
    
    if (validCandles.length < period + 1) {
      console.warn(\`⚠️ 有效数据不足，无法计算ADX: \${validCandles.length} < \${period + 1}\`);
      return null;
    }

    const TR = [], DMplus = [], DMminus = [];
    
    for (let i = 1; i < validCandles.length; i++) {
      const high = this.getCandleValue(validCandles[i], 'high');
      const low = this.getCandleValue(validCandles[i], 'low');
      const closePrev = this.getCandleValue(validCandles[i - 1], 'close');
      const highPrev = this.getCandleValue(validCandles[i - 1], 'high');
      const lowPrev = this.getCandleValue(validCandles[i - 1], 'low');

      const tr = Math.max(high - low, Math.abs(high - closePrev), Math.abs(low - closePrev));
      TR.push(tr);

      const upMove = high - highPrev;
      const downMove = lowPrev - low;

      DMplus.push(upMove > downMove && upMove > 0 ? upMove : 0);
      DMminus.push(downMove > upMove && downMove > 0 ? downMove : 0);
    }

    function smooth(arr) {
      const smoothed = [];
      let sum = arr.slice(0, period).reduce((a, b) => a + b, 0);
      smoothed[period - 1] = sum;
      for (let i = period; i < arr.length; i++) {
        sum = smoothed[i - 1] - smoothed[i - 1] / period + arr[i];
        smoothed[i] = sum;
      }
      return smoothed;
    }

    const smTR = smooth(TR), smDMplus = smooth(DMplus), smDMminus = smooth(DMminus);
    const DIplus = smDMplus.map((v, i) => i >= period - 1 ? 100 * v / smTR[i] : null);
    const DIminus = smDMminus.map((v, i) => i >= period - 1 ? 100 * v / smTR[i] : null);
    
    const DX = DIplus.map((diplus, i) => {
      if (diplus === null || DIminus[i] === null) return null;
      const sum = diplus + DIminus[i];
      return sum === 0 ? 0 : 100 * Math.abs(diplus - DIminus[i]) / sum;
    });

    const ADX = [];
    let adxSum = 0;
    let adxCount = 0;
    
    for (let i = 0; i < DX.length; i++) {
      if (DX[i] !== null) {
        adxSum += DX[i];
        adxCount++;
      }
      
      if (adxCount >= period) {
        ADX.push(adxSum / adxCount);
        if (DX[i - period + 1] !== null) {
          adxSum -= DX[i - period + 1];
          adxCount--;
        }
      } else {
        ADX.push(null);
      }
    }

    return {
      ADX: ADX[ADX.length - 1],
      DIplus: DIplus[DIplus.length - 1],
      DIminus: DIminus[DIminus.length - 1]
    };
  }`;

// 修复后的calculateBollingerBands方法
const fixedCalculateBollingerBands = `  /**
   * 计算布林带 - 修复版本
   */
  calculateBollingerBands(candles, period = 20, multiplier = 2) {
    if (!candles || candles.length === 0) {
      console.warn('⚠️ K线数据为空，无法计算布林带');
      return [];
    }
    
    const validCandles = this.filterValidCandles(candles);
    
    if (validCandles.length < period) {
      console.warn(\`⚠️ 有效数据不足，无法计算布林带: \${validCandles.length} < \${period}\`);
      return [];
    }
    
    const bb = [];
    
    for (let i = period - 1; i < validCandles.length; i++) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const close = this.getCandleValue(validCandles[j], 'close');
        sum += close;
      }
      
      const sma = sum / period;
      
      let variance = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const close = this.getCandleValue(validCandles[j], 'close');
        variance += Math.pow(close - sma, 2);
      }
      
      const stdDev = Math.sqrt(variance / period);
      
      bb.push({
        upper: sma + (multiplier * stdDev),
        middle: sma,
        lower: sma - (multiplier * stdDev),
        bandwidth: (multiplier * stdDev) / sma * 100
      });
    }
    
    return bb;
  }`;

// 应用修复
console.log('🔧 应用修复...');

// 1. 添加数据访问辅助函数
content = content.replace(
  /class StrategyV3Core \{[\s\S]*?constructor\(db\) \{/,
  (match) => match + dataAccessHelpers
);

// 2. 修复calculateMA
content = content.replace(
  /\/\*\*[\s\S]*?\*\/[\s\S]*?calculateMA\(candles, period = 20\) \{[\s\S]*?\}/,
  fixedCalculateMA
);

// 3. 修复calculateEMA
content = content.replace(
  /\/\*\*[\s\S]*?\*\/[\s\S]*?calculateEMA\(candles, period = 20\) \{[\s\S]*?\}/,
  fixedCalculateEMA
);

// 4. 修复calculateADX
content = content.replace(
  /\/\*\*[\s\S]*?\*\/[\s\S]*?calculateADX\(candles, period = 14\) \{[\s\S]*?\}/,
  fixedCalculateADX
);

// 5. 修复calculateBollingerBands
content = content.replace(
  /\/\*\*[\s\S]*?\*\/[\s\S]*?calculateBollingerBands\(candles, period = 20, multiplier = 2\) \{[\s\S]*?\}/,
  fixedCalculateBollingerBands
);

// 写入修复后的内容
fs.writeFileSync(strategyPath, content);

console.log('✅ 技术指标计算修复完成');
console.log('📝 修复内容:');
console.log('   - 添加了统一的数据访问辅助函数');
console.log('   - 修复了calculateMA方法');
console.log('   - 修复了calculateEMA方法');
console.log('   - 修复了calculateADX方法');
console.log('   - 修复了calculateBollingerBands方法');
console.log('   - 所有方法都支持数组和对象两种格式');
console.log('   - 添加了完善的数据验证和错误处理');

console.log('\n🚀 下一步: 重启服务并运行测试验证修复效果');
