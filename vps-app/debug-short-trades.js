// 调试做空交易止损止盈价格问题的脚本

const StrategyV3Execution = require('./modules/strategy/StrategyV3Execution');

async function debugShortTrades() {
  console.log('🔍 开始调试做空交易止损止盈价格问题...');

  try {
    // 创建执行器实例
    const execution = new StrategyV3Execution();

    // 模拟震荡市数据
    const mockRangeResult = {
      lowerBoundaryValid: false,
      upperBoundaryValid: true,
      bbUpper: 111000,
      bbMiddle: 110500,
      bbLower: 110000
    };

    // 模拟15分钟K线数据
    const mockCandles15m = [];
    for (let i = 0; i < 20; i++) {
      mockCandles15m.push({
        open: 110800 + Math.random() * 200,
        high: 110900 + Math.random() * 200,
        low: 110700 + Math.random() * 200,
        close: 110800 + Math.random() * 200,
        volume: 1000 + Math.random() * 500
      });
    }

    // 设置最后两根K线数据以触发做空信号
    mockCandles15m[18] = {
      open: 110900,
      high: 111050,  // 高于上轨
      low: 110850,
      close: 110950,
      volume: 800
    };

    mockCandles15m[19] = {
      open: 110950,
      high: 110980,
      low: 110850,
      close: 110900,  // 接近上轨
      volume: 600    // 小成交量
    };

    console.log('📊 模拟数据设置完成');
    console.log('上轨:', mockRangeResult.bbUpper);
    console.log('中轨:', mockRangeResult.bbMiddle);
    console.log('下轨:', mockRangeResult.bbLower);
    console.log('最新K线收盘价:', mockCandles15m[19].close);

    // 执行震荡市分析
    const result = execution.analyzeRangeExecution('TESTUSDT', mockRangeResult, mockCandles15m, null);
    
    console.log('\n📈 震荡市分析结果:');
    console.log('信号:', result.signal);
    console.log('模式:', result.mode);
    console.log('入场价:', result.entry);
    console.log('止损价:', result.stopLoss);
    console.log('止盈价:', result.takeProfit);
    console.log('ATR14:', result.atr14);

    // 验证价格逻辑
    if (result.signal === 'SELL') {
      console.log('\n✅ 做空交易价格验证:');
      
      const isStopLossCorrect = result.stopLoss > result.entry;
      const isTakeProfitCorrect = result.takeProfit < result.entry;
      
      console.log('止损价格高于入场价:', isStopLossCorrect ? '✅' : '❌', `(${result.stopLoss} > ${result.entry})`);
      console.log('止盈价格低于入场价:', isTakeProfitCorrect ? '✅' : '❌', `(${result.takeProfit} < ${result.entry})`);
      
      if (!isStopLossCorrect || !isTakeProfitCorrect) {
        console.log('❌ 发现价格逻辑错误！');
      } else {
        console.log('✅ 价格逻辑正确');
      }
    } else {
      console.log('⚠️ 未触发做空信号');
    }

  } catch (error) {
    console.error('❌ 调试过程中出现错误:', error);
  }
}

// 运行调试
debugShortTrades();
