// debug-atr-issue.js
// 调试ATR计算问题

const BinanceAPI = require('./modules/api/BinanceAPI');
const StrategyV3Execution = require('./modules/strategy/StrategyV3Execution');
const StrategyV3Core = require('./modules/strategy/StrategyV3Core');

async function debugATRIssue() {
  try {
    console.log('🔍 开始调试ATR计算问题...');
    
    const symbol = 'LINKUSDT';
    
    // 1. 获取K线数据
    console.log(`📊 获取 ${symbol} K线数据...`);
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
    
    // 2. 测试ATR计算
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
    
    // 3. 测试震荡市分析
    console.log('\n📊 测试震荡市分析...');
    const core = new StrategyV3Core();
    const rangeResult = await core.analyzeRangeBoundary(symbol);
    console.log('1H边界结果:', rangeResult);
    
    if (rangeResult.error) {
      console.error('❌ 1H边界分析失败:', rangeResult.error);
      return;
    }
    
    // 4. 测试完整的震荡市执行分析
    console.log('\n🧮 测试完整的震荡市执行分析...');
    const klines1h = await BinanceAPI.getKlines(symbol, '1h', 50);
    const candles1h = klines1h.map(k => ({
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5])
    }));
    
    const executionResult = execution.analyzeRangeExecution(symbol, rangeResult, candles15m, candles1h);
    console.log('执行分析结果:', executionResult);
    
  } catch (error) {
    console.error('❌ 调试过程出错:', error);
    console.error('错误堆栈:', error.stack);
  }
}

// 运行调试
debugATRIssue().catch(console.error);
