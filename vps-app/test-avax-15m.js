const BinanceAPI = require('./modules/api/BinanceAPI');

async function testAVAX15m() {
  try {
    // 获取15分钟K线数据
    const klines = await BinanceAPI.getKlines('AVAXUSDT', '15m', 50);
    console.log('AVAXUSDT 15分钟K线数据:');
    console.log('最新K线:', klines[klines.length - 1]);
    console.log('前一根K线:', klines[klines.length - 2]);
    
    const candles = klines.map(k => ({
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5])
    }));
    
    const last15m = candles[candles.length - 1];
    const prev15m = candles[candles.length - 2];
    
    // 计算EMA20/50
    const ema20 = calculateEMA(candles, 20);
    const ema50 = calculateEMA(candles, 50);
    const lastEMA20 = ema20[ema20.length - 1];
    const lastEMA50 = ema50[ema50.length - 1];
    
    console.log('\n技术指标:');
    console.log('EMA20:', lastEMA20);
    console.log('EMA50:', lastEMA50);
    
    // 检查空头入场条件
    const priceAtResistance = last15m.close <= lastEMA20 && last15m.close <= lastEMA50;
    const setupBreakdown = last15m.low < prev15m.low && last15m.close < prev15m.low;
    
    const avgVol = candles.slice(-20).reduce((a, c) => a + c.volume, 0) / 20;
    const volConfirm = last15m.volume >= avgVol * 1.2;
    
    console.log('\n空头入场条件检查:');
    console.log('价格反抽阻力:', priceAtResistance, `(收盘价: ${last15m.close}, EMA20: ${lastEMA20}, EMA50: ${lastEMA50})`);
    console.log('跌破setup:', setupBreakdown, `(当前低点: ${last15m.low}, 前一根低点: ${prev15m.low}, 收盘价: ${last15m.close})`);
    console.log('成交量确认:', volConfirm, `(当前成交量: ${last15m.volume}, 平均成交量: ${avgVol}, 需要: ${avgVol * 1.2})`);
    
  } catch (error) {
    console.error('测试失败:', error);
  }
}

function calculateEMA(candles, period) {
  const ema = [];
  const multiplier = 2 / (period + 1);
  
  // 第一个EMA值使用SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += candles[i].close;
  }
  ema[period - 1] = sum / period;
  
  // 计算后续EMA值
  for (let i = period; i < candles.length; i++) {
    ema[i] = (candles[i].close * multiplier) + (ema[i - 1] * (1 - multiplier));
  }
  
  return ema;
}

testAVAX15m();
