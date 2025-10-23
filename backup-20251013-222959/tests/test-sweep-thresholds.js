const ICTStrategy = require('./src/strategies/ict-strategy');
const BinanceAPI = require('./src/api/binance-api');

/**
 * 测试不同扫荡阈值的效果
 */
async function testSweepThresholds() {
  const ictStrategy = new ICTStrategy();
  const binanceAPI = new BinanceAPI();
  
  const symbols = ['ADAUSDT', 'BNBUSDT', 'BTCUSDT', 'ETHUSDT', 'LDOUSDT'];
  const thresholds = [0.2, 0.15, 0.1];
  
  console.log('🔍 测试不同扫荡阈值的效果\n');
  console.log('符号\t\tATR\t\t0.2阈值\t\t0.15阈值\t0.1阈值\t\t当前扫荡率');
  console.log('─'.repeat(100));
  
  for (const symbol of symbols) {
    try {
      // 获取15分钟K线数据
      const klines15m = await binanceAPI.getKlines(symbol, '15m', 50);
      if (!klines15m || klines15m.length < 10) {
        console.log(`${symbol}\t\t数据不足`);
        continue;
      }
      
      // 计算ATR
      const atr = ictStrategy.calculateATR(klines15m, 14);
      const currentATR = atr[atr.length - 1];
      
      // 计算极值点
      const recent15mKlines = klines15m.slice(-10);
      let recent15mHigh = 0;
      let recent15mLow = Infinity;
      recent15mKlines.forEach(kline => {
        const high = parseFloat(kline[2]);
        const low = parseFloat(kline[3]);
        if (high > recent15mHigh) recent15mHigh = high;
        if (low < recent15mLow) recent15mLow = low;
      });
      
      // 测试不同阈值
      const results = {};
      for (const threshold of thresholds) {
        const sweepUp = testSweepWithThreshold(klines15m, currentATR, recent15mHigh, threshold, 'UP');
        const sweepDown = testSweepWithThreshold(klines15m, currentATR, recent15mLow, threshold, 'DOWN');
        const sweep = sweepUp.detected ? sweepUp : sweepDown;
        results[threshold] = sweep;
      }
      
      // 获取当前实际扫荡率
      const currentSweep = ictStrategy.detectSweepLTF(klines15m, currentATR, recent15mHigh);
      const currentSweepDown = ictStrategy.detectSweepLTF(klines15m, currentATR, recent15mLow);
      const currentSweepResult = currentSweep.detected ? currentSweep : currentSweepDown;
      
      console.log(`${symbol}\t\t${currentATR.toFixed(6)}\t\t${(currentATR * 0.2).toFixed(6)}\t\t${(currentATR * 0.15).toFixed(6)}\t\t${(currentATR * 0.1).toFixed(6)}\t\t${currentSweepResult.speed.toFixed(6)}`);
      
      // 显示检测结果
      console.log(`\n${symbol} 扫荡检测结果:`);
      for (const threshold of thresholds) {
        const result = results[threshold];
        console.log(`  阈值 ${threshold}: ${result.detected ? '✅' : '❌'} ${result.detected ? `速率=${result.speed.toFixed(6)}, 类型=${result.type}` : '未检测到'}`);
      }
      console.log('');
      
    } catch (error) {
      console.log(`${symbol}\t\t错误: ${error.message}`);
    }
  }
}

/**
 * 使用指定阈值测试扫荡检测
 */
function testSweepWithThreshold(klines, atr15, extreme, threshold, direction) {
  if (!klines || klines.length < 5) {
    return { detected: false, type: null, level: 0, confidence: 0, speed: 0 };
  }

  const currentATR = atr15 || 0;
  const recentBars = klines.slice(-5);
  const thresholdValue = threshold * currentATR;

  let detected = false;
  let type = null;
  let level = 0;
  let confidence = 0;
  let speed = 0;

  for (let i = 0; i < Math.min(3, recentBars.length); i++) {
    const bar = recentBars[i];
    const high = parseFloat(bar[2]);
    const low = parseFloat(bar[3]);

    if (direction === 'UP') {
      // 检测上方流动性扫荡
      if (high > extreme) {
        let barsToReturn = 0;
        for (let j = i + 1; j < recentBars.length; j++) {
          barsToReturn++;
          if (parseFloat(recentBars[j][4]) < extreme) {
            const exceed = high - extreme;
            const sweepSpeed = exceed / barsToReturn;

            if (sweepSpeed >= thresholdValue && barsToReturn <= 3) {
              detected = true;
              type = 'LTF_SWEEP_UP';
              level = extreme;
              confidence = Math.min(sweepSpeed / thresholdValue, 1);
              speed = sweepSpeed;
              break;
            }
          }
        }
        if (detected) break;
      }
    } else {
      // 检测下方流动性扫荡
      if (low < extreme) {
        let barsToReturn = 0;
        for (let j = i + 1; j < recentBars.length; j++) {
          barsToReturn++;
          if (parseFloat(recentBars[j][4]) > extreme) {
            const exceed = extreme - low;
            const sweepSpeed = exceed / barsToReturn;

            if (sweepSpeed >= thresholdValue && barsToReturn <= 3) {
              detected = true;
              type = 'LTF_SWEEP_DOWN';
              level = extreme;
              confidence = Math.min(sweepSpeed / thresholdValue, 1);
              speed = sweepSpeed;
              break;
            }
          }
        }
        if (detected) break;
      }
    }
  }

  return { detected, type, level, confidence, speed };
}

// 运行测试
testSweepThresholds().catch(console.error);
