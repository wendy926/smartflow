/**
 * ICT策略15M入场有效性测试
 * 验证门槛+容忍逻辑是否正确实现
 */

const ICTStrategyOptimized = require('../src/strategies/ict-strategy-optimized');

async function test15MValidity() {
  console.log('🔍 ICT策略15M入场有效性测试\n');

  const strategy = new ICTStrategyOptimized();
  const testSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT'];

  console.log('📊 测试门槛+容忍逻辑：OrderBlock && Sweep && (Engulfing >= 0.6 || Harmonic >= 0.6)\n');

  for (const symbol of testSymbols) {
    console.log(`🔍 测试 ${symbol}...`);

    try {
      const result = await strategy.check15MEntryValidity(symbol);

      console.log(`   结果: ${result.valid ? '✅ 有效' : '❌ 无效'}`);
      console.log(`   原因: ${result.reason}`);

      if (result.details) {
        const { trend, orderBlock, sweep, engulfing, harmonic, gatePass, secondaryPass } = result.details;

        console.log(`   趋势: ${trend} (${trend === 'RANGE' ? '❌' : '✅'})`);
        console.log(`   订单块: ${orderBlock && orderBlock.valid ? '✅' : '❌'} (得分: ${orderBlock ? orderBlock.score : 'N/A'})`);
        console.log(`   扫荡: ${sweep && sweep.swept ? '✅' : '❌'} (方向: ${sweep ? sweep.direction : 'N/A'})`);
        console.log(`   吞没: ${engulfing ? engulfing.type : 'N/A'} 强度${engulfing ? engulfing.strength.toFixed(3) : 'N/A'} ${engulfing && engulfing.meetsThreshold ? '✅' : '❌'}`);
        console.log(`   谐波: ${harmonic ? harmonic.type : 'N/A'} 得分${harmonic ? harmonic.score.toFixed(3) : 'N/A'} ${harmonic && harmonic.meetsThreshold ? '✅' : '❌'}`);
        console.log(`   门槛通过: ${gatePass ? '✅' : '❌'}`);
        console.log(`   次要条件: ${secondaryPass ? '✅' : '❌'}`);
      }

      console.log('');

    } catch (error) {
      console.error(`❌ ${symbol} 测试失败:`, error.message);
      console.log('');
    }
  }

  console.log('🎯 测试完成！');
  console.log('\n📋 门槛+容忍逻辑说明：');
  console.log('   门槛条件（必须全部满足）：');
  console.log('   1. 日线趋势 != RANGE');
  console.log('   2. 4H订单块有效');
  console.log('   3. 15M扫荡检测通过');
  console.log('');
  console.log('   容忍条件（满足其一即可）：');
  console.log('   1. 吞没形态强度 >= 0.6');
  console.log('   2. 谐波形态得分 >= 0.6');
  console.log('');
  console.log('   最终有效性 = 门槛条件 && 容忍条件');
}

// 运行测试
if (require.main === module) {
  test15MValidity()
    .then(() => {
      console.log('\n✅ 测试完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ 测试失败:', error);
      process.exit(1);
    });
}

module.exports = { test15MValidity };
