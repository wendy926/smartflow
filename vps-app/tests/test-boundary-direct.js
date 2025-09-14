const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('smartflow.db');

console.log('🔍 直接测试边界判断函数...\n');

// 模拟StrategyV3Core的analyzeRangeBoundary函数
async function testAnalyzeRangeBoundary(symbol) {
  try {
    console.log(`🔍 开始震荡市1H边界判断 [${symbol}]`);

    // 获取1H K线数据
    const klines1h = await getKlineDataFromDB(symbol, '1h', 50);

    if (!klines1h || klines1h.length < 20) {
      console.log(`❌ 1H K线数据不足: ${klines1h ? klines1h.length : 0}条，需要至少20条`);
      return { error: '1H K线数据不足' };
    }

    console.log(`✅ 获取到1H K线数据: ${klines1h.length}条`);

    const candles = klines1h.map(k => ({
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5])
    }));

    // 计算布林带
    const bb = calculateBollingerBands(candles, 20, 2);
    const lastBB = bb[bb.length - 1];

    console.log(`✅ 布林带计算完成:`);
    console.log(`   上轨: ${lastBB.upper.toFixed(4)}`);
    console.log(`   中轨: ${lastBB.middle.toFixed(4)}`);
    console.log(`   下轨: ${lastBB.lower.toFixed(4)}`);

    // 计算连续触碰因子
    const touchScore = calculateTouchScore(candles, lastBB);

    // 计算成交量因子
    const recentVolume = candles.slice(-1)[0].volume;
    const avgVolume = candles.slice(-20).reduce((sum, c) => sum + c.volume, 0) / Math.min(20, candles.length);
    const volumeRatio = recentVolume / avgVolume;
    const volumeScore = volumeRatio <= 1.7 ? 1 : (volumeRatio <= 2.0 ? 0.5 : 0);

    // 计算Delta因子
    const deltaScore = 1; // 简化处理

    // 计算OI因子
    const oiScore = 1; // 简化处理

    // 计算最终得分
    const totalScore = (touchScore * 0.4 + volumeScore * 0.3 + deltaScore * 0.2 + oiScore * 0.1);
    const lowerBoundaryValid = totalScore >= 0.6 ? 1 : 0;
    const upperBoundaryValid = totalScore >= 0.6 ? 1 : 0;

    console.log(`✅ 边界判断完成:`);
    console.log(`   总分: ${totalScore.toFixed(4)}`);
    console.log(`   下边界有效: ${lowerBoundaryValid}`);
    console.log(`   上边界有效: ${upperBoundaryValid}`);

    return {
      totalScore,
      lowerBoundaryValid,
      upperBoundaryValid,
      bb_upper: lastBB.upper,
      bb_middle: lastBB.middle,
      bb_lower: lastBB.lower,
      range_touches_lower: 0,
      range_touches_upper: 0,
      last_breakout: 0
    };

  } catch (error) {
    console.error(`❌ 边界判断失败 [${symbol}]:`, error);
    return { error: error.message };
  }
}

// 从数据库获取K线数据
function getKlineDataFromDB(symbol, interval, limit = 250) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        open_time,
        close_time,
        open_price,
        high_price,
        low_price,
        close_price,
        volume
      FROM kline_data 
      WHERE symbol = ? AND interval = ?
      ORDER BY close_time DESC
      LIMIT ?
    `;
    
    db.all(sql, [symbol, interval, limit], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      // 转换为Binance API格式
      const klines = rows.map(row => [
        row.open_time,
        row.open_price,
        row.high_price,
        row.low_price,
        row.close_price,
        row.volume,
        row.close_time,
        row.volume * row.close_price, // quote_volume
        0, // trades_count
        0, // taker_buy_volume
        0, // taker_buy_quote_volume
        0  // ignore
      ]);
      
      resolve(klines);
    });
  });
}

// 计算布林带
function calculateBollingerBands(candles, period = 20, k = 2) {
  const closes = candles.map(c => c.close);
  const ma = calculateMA(candles, period);
  const stdDev = [];

  for (let i = period - 1; i < candles.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = ma[i];
    const variance = slice.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / period;
    stdDev[i] = Math.sqrt(variance);
  }

  return ma.map((m, i) => ({
    middle: m,
    upper: m + (k * (stdDev[i] || 0)),
    lower: m - (k * (stdDev[i] || 0)),
    bandwidth: stdDev[i] ? (4 * stdDev[i] / m) : 0
  }));
}

// 计算移动平均
function calculateMA(candles, period) {
  const closes = candles.map(c => c.close);
  const ma = [];
  
  for (let i = period - 1; i < candles.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const sum = slice.reduce((a, b) => a + b, 0);
    ma[i] = sum / period;
  }
  
  return ma;
}

// 计算触碰得分
function calculateTouchScore(candles, bb) {
  let lowerTouches = 0;
  let upperTouches = 0;
  
  // 只检查有布林带数据的K线
  const startIndex = 20 - 1; // 布林带从第20根K线开始
  
  for (let i = startIndex; i < candles.length; i++) {
    const candle = candles[i];
    const bbData = bb[i - startIndex]; // 调整索引
    
    if (bbData && candle.low <= bbData.lower * 1.001) {
      lowerTouches++;
    }
    if (bbData && candle.high >= bbData.upper * 0.999) {
      upperTouches++;
    }
  }
  
  const totalTouches = lowerTouches + upperTouches;
  return totalTouches >= 4 ? 1 : (totalTouches >= 2 ? 0.5 : 0);
}

// 测试边界判断
async function runTest() {
  const testSymbols = ['BTCUSDT', 'ETHUSDT', 'XRPUSDT'];
  
  for (const symbol of testSymbols) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`测试交易对: ${symbol}`);
    console.log(`${'='.repeat(60)}`);
    
    const result = await testAnalyzeRangeBoundary(symbol);
    
    if (result.error) {
      console.log(`❌ 测试失败: ${result.error}`);
    } else {
      console.log(`✅ 测试成功`);
    }
  }
  
  db.close();
}

runTest().catch(console.error);
