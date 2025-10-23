/**
 * 调试扫荡检测
 */

const ICTStrategyOptimized = require('../src/strategies/ict-strategy-optimized');

async function debugSweepDetection() {
  console.log('🔍 调试扫荡检测\n');

  const strategy = new ICTStrategyOptimized();

  try {
    // 获取K线数据
    const [kl4h, kl15m] = await Promise.all([
      strategy.fetchKlines('BTCUSDT', '4h', 60),
      strategy.fetchKlines('BTCUSDT', '15m', 200)
    ]);

    console.log('📊 4H K线数据样本:');
    console.log('   最新K线:', kl4h[kl4h.length - 1]);
    console.log('   数据类型:', Array.isArray(kl4h[0]) ? '数组' : '对象');

    console.log('\n📊 15M K线数据样本:');
    console.log('   最新K线:', kl15m[kl15m.length - 1]);
    console.log('   数据类型:', Array.isArray(kl15m[0]) ? '数组' : '对象');

    // 检测订单块
    const orderBlockRes = strategy.analyzeOrderBlocks(kl4h);
    console.log('\n🔍 订单块检测结果:');
    console.log('   订单块有效:', orderBlockRes.valid);
    console.log('   订单块得分:', orderBlockRes.score);
    if (orderBlockRes.block) {
      console.log('   订单块详情:', orderBlockRes.block);
    }

    if (orderBlockRes.block) {
      // 检测扫荡
      const sweepRes = strategy.detectSweep(kl15m, orderBlockRes.block);
      console.log('\n🔍 扫荡检测结果:');
      console.log('   扫荡发生:', sweepRes.swept);
      console.log('   扫荡方向:', sweepRes.direction);
      console.log('   扫荡极值:', sweepRes.extreme);
      console.log('   扫荡置信度:', sweepRes.confidence);

      // 手动检查扫荡
      console.log('\n🔍 手动扫荡检查:');
      const recent = kl15m.slice(-8); // 最近8根15M K线
      console.log(`   检查最近${recent.length}根15M K线:`);

      for (let i = 0; i < recent.length; i++) {
        const bar = recent[i];
        const barHigh = Array.isArray(bar) ? parseFloat(bar[2]) : bar.h;
        const barLow = Array.isArray(bar) ? parseFloat(bar[3]) : bar.l;
        const barClose = Array.isArray(bar) ? parseFloat(bar[4]) : bar.c;

        console.log(`   K线 ${i}: 高=${barHigh.toFixed(2)}, 低=${barLow.toFixed(2)}, 收=${barClose.toFixed(2)}`);
        console.log(`     订单块范围: ${orderBlockRes.block.bottom.toFixed(2)} - ${orderBlockRes.block.top.toFixed(2)}`);

        // 检查下方扫荡
        const belowSweep = barLow < orderBlockRes.block.bottom && barClose > orderBlockRes.block.bottom;
        console.log(`     下方扫荡: 低点${barLow.toFixed(2)} < 订单块底部${orderBlockRes.block.bottom.toFixed(2)} 且 收盘${barClose.toFixed(2)} > 订单块底部 = ${belowSweep ? '✅' : '❌'}`);

        // 检查上方扫荡
        const aboveSweep = barHigh > orderBlockRes.block.top && barClose < orderBlockRes.block.top;
        console.log(`     上方扫荡: 高点${barHigh.toFixed(2)} > 订单块顶部${orderBlockRes.block.top.toFixed(2)} 且 收盘${barClose.toFixed(2)} < 订单块顶部 = ${aboveSweep ? '✅' : '❌'}`);

        if (belowSweep || aboveSweep) {
          console.log(`     ✅ 发现扫荡!`);
        }
        console.log('');
      }
    }

  } catch (error) {
    console.error('❌ 调试失败:', error);
  }
}

// 运行调试
if (require.main === module) {
  debugSweepDetection()
    .then(() => {
      console.log('\n✅ 调试完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ 调试失败:', error);
      process.exit(1);
    });
}

module.exports = { debugSweepDetection };
