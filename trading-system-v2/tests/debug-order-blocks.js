/**
 * 调试订单块检测
 */

const ICTStrategyOptimized = require('../src/strategies/ict-strategy-optimized');

async function debugOrderBlocks() {
  console.log('🔍 调试订单块检测\n');

  const strategy = new ICTStrategyOptimized();

  try {
    // 获取4H K线数据
    const kl4h = await strategy.fetchKlines('BTCUSDT', '4h', 60);
    console.log('📊 4H K线数据样本:');
    console.log('   最新K线:', kl4h[kl4h.length - 1]);
    console.log('   数据类型:', Array.isArray(kl4h[0]) ? '数组' : '对象');
    console.log('   数据长度:', kl4h.length);

    // 手动检测订单块
    const recent = kl4h.slice(-24);
    console.log('\n🔍 最近24根4H K线分析:');
    console.log('   分析窗口数量:', recent.length - 2);

    const blocks = [];
    for (let i = 0; i < recent.length - 2; i++) {
      const window = recent.slice(i, i + 3);

      // 支持数组格式
      const top = Math.max(...window.map(k => Array.isArray(k) ? parseFloat(k[2]) : k.h));
      const bot = Math.min(...window.map(k => Array.isArray(k) ? parseFloat(k[3]) : k.l));
      const range = top - bot;
      const avgPrice = strategy.sma(window.map(k => Array.isArray(k) ? parseFloat(k[4]) : k.c));
      const rangeRatio = range / avgPrice;

      console.log(`   窗口 ${i}: 最高=${top.toFixed(2)}, 最低=${bot.toFixed(2)}, 范围=${range.toFixed(2)}, 平均价格=${avgPrice.toFixed(2)}, 范围比例=${(rangeRatio * 100).toFixed(3)}%`);

      if (rangeRatio < 0.05) { // 使用5%阈值
        blocks.push({ top, bottom: bot, center: (top + bot) / 2, createdIdx: i, rangeRatio });
        console.log(`   ✅ 发现订单块: 顶部=${top.toFixed(2)}, 底部=${bot.toFixed(2)}, 中心=${((top + bot) / 2).toFixed(2)}`);
      }
    }

    console.log(`\n📋 订单块检测结果:`);
    console.log(`   发现订单块数量: ${blocks.length}`);

    if (blocks.length > 0) {
      const block = blocks[blocks.length - 1];
      console.log(`   最新订单块:`, block);

      // 检查年龄
      const ageBars = recent.length - 1 - block.createdIdx;
      console.log(`   订单块年龄: ${ageBars} 根K线`);
      console.log(`   最大允许年龄: ${strategy.config.orderBlockMaxAge} 根K线`);
      console.log(`   年龄检查: ${ageBars <= strategy.config.orderBlockMaxAge ? '✅ 通过' : '❌ 超时'}`);

      // 检查重新进入
      let sweptIdx = -1;
      const last12 = kl4h.slice(-12);
      console.log(`\n🔍 扫荡检测 (最近12根4H K线):`);

      for (let i = 0; i < last12.length; i++) {
        const k = last12[i];
        const kLow = Array.isArray(k) ? parseFloat(k[3]) : k.l;
        const kHigh = Array.isArray(k) ? parseFloat(k[2]) : k.h;
        const kClose = Array.isArray(k) ? parseFloat(k[4]) : k.c;

        console.log(`   K线 ${i}: 低=${kLow.toFixed(2)}, 高=${kHigh.toFixed(2)}, 收=${kClose.toFixed(2)}`);

        if (kLow < block.bottom && kClose > block.bottom) {
          sweptIdx = i;
          console.log(`   ✅ 发现下方扫荡: 低点${kLow.toFixed(2)} < 订单块底部${block.bottom.toFixed(2)} 且 收盘${kClose.toFixed(2)} > 订单块底部`);
        }
        if (kHigh > block.top && kClose < block.top) {
          sweptIdx = i;
          console.log(`   ✅ 发现上方扫荡: 高点${kHigh.toFixed(2)} > 订单块顶部${block.top.toFixed(2)} 且 收盘${kClose.toFixed(2)} < 订单块顶部`);
        }
      }

      console.log(`   扫荡索引: ${sweptIdx >= 0 ? sweptIdx : '未发现'}`);

      // 检查重新进入
      let reentryConfirmed = false;
      if (sweptIdx >= 0) {
        const post = last12.slice(sweptIdx + 1, sweptIdx + 4);
        console.log(`   扫荡后K线数量: ${post.length}`);
        if (post.length) {
          const ok = post.some(b => {
            const bClose = Array.isArray(b) ? parseFloat(b[4]) : b.c;
            const inRange = bClose >= block.bottom && bClose <= block.top;
            console.log(`   K线收盘${bClose.toFixed(2)} 在订单块范围内: ${inRange ? '✅' : '❌'}`);
            return inRange;
          });
          reentryConfirmed = ok;
        }
      } else {
        const latest = strategy.last(kl4h);
        const latestClose = Array.isArray(latest) ? parseFloat(latest[4]) : latest.c;
        reentryConfirmed = (latestClose >= block.bottom && latestClose <= block.top);
        console.log(`   最新收盘${latestClose.toFixed(2)} 在订单块范围内: ${reentryConfirmed ? '✅' : '❌'}`);
      }

      console.log(`   重新进入确认: ${reentryConfirmed ? '✅' : '❌'}`);
      const score = reentryConfirmed ? 20 : 8;
      console.log(`   订单块得分: ${score}`);
      console.log(`   订单块有效: ${reentryConfirmed ? '✅' : '❌'}`);
    }

  } catch (error) {
    console.error('❌ 调试失败:', error);
  }
}

// 运行调试
if (require.main === module) {
  debugOrderBlocks()
    .then(() => {
      console.log('\n✅ 调试完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ 调试失败:', error);
      process.exit(1);
    });
}

module.exports = { debugOrderBlocks };
