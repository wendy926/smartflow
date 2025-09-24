const V3Strategy = require('./src/strategies/v3-strategy');
const BinanceAPI = require('./src/api/binance-api');

async function testV3() {
  try {
    const binanceAPI = new BinanceAPI();
    const v3Strategy = new V3Strategy(binanceAPI);
    
    console.log('开始测试V3策略...');
    
    // 获取15M K线数据
    const klines = await binanceAPI.getKlines('BTCUSDT', '15m', 50);
    console.log('K线数据长度:', klines ? klines.length : 0);
    
    if (klines && klines.length > 0) {
      console.log('最后一条K线:', klines[klines.length - 1]);
      
      // 测试15M分析
      const result = v3Strategy.analyze15mExecution(klines, {});
      console.log('15M分析结果:', result);
    }
    
  } catch (error) {
    console.error('测试失败:', error.message);
  }
}

testV3();
