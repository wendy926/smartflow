// debug-atr-calculation.js
// 调试ATR计算问题

const BinanceAPI = require('./modules/api/BinanceAPI');
const StrategyV3Execution = require('./modules/strategy/StrategyV3Execution');

async function debugATRCalculation() {
  try {
    console.log('🔍 开始调试ATR计算...');
    
    const symbol = 'TRXUSDT';
    
    // 获取15分钟K线数据
    console.log(`📊 获取 ${symbol} 15分钟K线数据...`);
    const klines15m = await BinanceAPI.getKlines(symbol, '15m', 50);
    console.log(`K线数据长度: ${klines15m.length}`);
    
    if (klines15m.length < 15) {
      console.error('❌ K线数据不足');
      return;
    }
    
    // 转换为对象格式
    const candles15m = klines15m.map(k => ({
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5])
    }));
    
    console.log('📈 最新几根K线数据:');
    candles15m.slice(-5).forEach((candle, index) => {
      console.log(`  ${candles15m.length - 5 + index}: H=${candle.high}, L=${candle.low}, C=${candle.close}`);
    });
    
    // 测试ATR计算
    console.log('\n🧮 测试ATR计算...');
    const execution = new StrategyV3Execution();
    const atr14 = execution.calculateATR(candles15m, 14);
    
    console.log(`ATR数组长度: ${atr14.length}`);
    if (atr14.length > 0) {
      console.log(`最新ATR值: ${atr14[atr14.length - 1]}`);
      console.log('ATR数组最后5个值:', atr14.slice(-5));
    } else {
      console.error('❌ ATR计算失败，返回空数组');
    }
    
    // 测试EMA计算
    console.log('\n📊 测试EMA计算...');
    const testData = [
      { close: 1.0 },
      { close: 1.1 },
      { close: 1.2 },
      { close: 1.3 },
      { close: 1.4 }
    ];
    const ema = execution.calculateEMA(testData, 3);
    console.log(`测试EMA结果: ${ema}`);
    
  } catch (error) {
    console.error('❌ 调试过程出错:', error);
  }
}

// 运行调试
debugATRCalculation().catch(console.error);
