// debug-range-analysis.js
// 调试震荡市分析问题

const BinanceAPI = require('./modules/api/BinanceAPI');
const StrategyV3Core = require('./modules/strategy/StrategyV3Core');
const StrategyV3Execution = require('./modules/strategy/StrategyV3Execution');

async function debugRangeAnalysis() {
  try {
    console.log('🔍 开始调试震荡市分析...');
    
    const symbol = 'TRXUSDT';
    
    // 1. 获取4H趋势数据
    console.log(`📊 获取 ${symbol} 4H趋势数据...`);
    const core = new StrategyV3Core();
    const trend4hResult = await core.analyze4HTrend(symbol);
    console.log('4H趋势结果:', trend4hResult);
    
    // 2. 获取1H边界数据
    console.log(`📊 获取 ${symbol} 1H边界数据...`);
    const rangeResult = await core.analyzeRangeBoundary(symbol);
    console.log('1H边界结果:', rangeResult);
    
    // 3. 获取K线数据
    console.log(`📊 获取 ${symbol} K线数据...`);
    const [klines15m, klines1h] = await Promise.all([
      BinanceAPI.getKlines(symbol, '15m', 50),
      BinanceAPI.getKlines(symbol, '1h', 50)
    ]);
    
    const candles15m = klines15m.map(k => ({
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5])
    }));
    
    const candles1h = klines1h.map(k => ({
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5])
    }));
    
    console.log(`15m K线数据长度: ${candles15m.length}`);
    console.log(`1h K线数据长度: ${candles1h.length}`);
    
    // 4. 测试15分钟执行分析
    console.log(`🧮 测试15分钟执行分析...`);
    const execution = new StrategyV3Execution();
    const executionResult = execution.analyzeRangeExecution(symbol, rangeResult, candles15m, candles1h);
    
    console.log('执行结果:', executionResult);
    console.log(`信号: ${executionResult.signal}`);
    console.log(`模式: ${executionResult.mode}`);
    console.log(`ATR14: ${executionResult.atr14}`);
    console.log(`入场价: ${executionResult.entry}`);
    console.log(`止损价: ${executionResult.stopLoss}`);
    console.log(`止盈价: ${executionResult.takeProfit}`);
    
  } catch (error) {
    console.error('❌ 调试过程出错:', error);
    console.error('错误堆栈:', error.stack);
  }
}

// 运行调试
debugRangeAnalysis().catch(console.error);
