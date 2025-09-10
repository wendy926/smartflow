// debug-get-all-signals.js
// 调试getAllSignals方法

const fetch = require('node-fetch');

async function debugGetAllSignals() {
  try {
    console.log('🔍 开始调试getAllSignals方法...');
    
    // 直接调用API
    console.log('📊 测试getAllSignals API...');
    const response = await fetch('http://localhost:8080/api/signals');
    const signals = await response.json();
    
    console.log(`获取到 ${signals.length} 个信号`);
    
    // 查找TRXUSDT信号
    const trxSignal = signals.find(s => s.symbol === 'TRXUSDT');
    if (trxSignal) {
      console.log('TRXUSDT信号:');
      console.log(`  执行: ${trxSignal.execution}`);
      console.log(`  入场价: ${trxSignal.entrySignal}`);
      console.log(`  止损价: ${trxSignal.stopLoss}`);
      console.log(`  止盈价: ${trxSignal.takeProfit}`);
      console.log(`  最大杠杆: ${trxSignal.maxLeverage}`);
      console.log(`  最小保证金: ${trxSignal.minMargin}`);
      console.log(`  止损距离: ${trxSignal.stopLossDistance}`);
      console.log(`  ATR值: ${trxSignal.atrValue}`);
      console.log(`  ATR14: ${trxSignal.atr14}`);
    } else {
      console.log('❌ 未找到TRXUSDT信号');
    }
    
    // 显示所有信号的基本信息
    console.log('\n📊 所有信号基本信息:');
    signals.forEach(signal => {
      console.log(`${signal.symbol}: ${signal.execution || 'NONE'} - ATR: ${signal.atrValue || 'null'}`);
    });
    
  } catch (error) {
    console.error('❌ 调试过程出错:', error);
    console.error('错误堆栈:', error.stack);
  }
}

// 运行调试
debugGetAllSignals().catch(console.error);
