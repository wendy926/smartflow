const ICTStrategy = require('./src/strategies/ict-strategy');

async function debug15MSweep() {
  console.log('🔍 详细调试ICT策略15分钟扫荡检测\n');

  const strategy = new ICTStrategy();

  try {
    // 获取BNBUSDT数据
    console.log('📊 获取BNBUSDT数据...');
    const kl15m = await strategy.binanceAPI.getKlines('BNBUSDT', '15m', 50);
    const kl4h = await strategy.binanceAPI.getKlines('BNBUSDT', '4h', 20);

    if (!kl15m || kl15m.length < 5) {
      console.log('❌ 15M数据不足');
      return;
    }

    if (!kl4h || kl4h.length < 5) {
      console.log('❌ 4H数据不足');
      return;
    }

    // 计算ATR
    const atr15 = strategy.calculateATR(kl15m, 14);
    const currentATR = atr15[atr15.length - 1];
    console.log(`📈 15M ATR: ${currentATR.toFixed(6)}`);
    console.log(`🎯 新阈值 (0.1×ATR): ${(0.1 * currentATR).toFixed(6)}`);

    // 获取订单块
    const orderBlocks = strategy.analyzeOrderBlocks(kl4h);
    console.log(`📦 订单块数量: ${orderBlocks?.blocks?.length || 0}`);

    if (orderBlocks && orderBlocks.blocks && orderBlocks.blocks.length > 0) {
      const block = orderBlocks.blocks[0];
      console.log(`📦 订单块详情:`);
      console.log(`  - 类型: ${block.type}`);
      console.log(`  - 范围: [${block.bottom.toFixed(6)}, ${block.top.toFixed(6)}]`);
      console.log(`  - 高度: ${block.height.toFixed(6)}`);
      console.log(`  - 强度: ${block.strength.toFixed(4)}`);

      // 手动检查最近15M K线
      console.log(`\n🔍 手动检查最近15M K线扫荡情况:`);
      const recentBars = kl15m.slice(-10); // 检查最近10根K线
      const currentATR = atr15;
      const extreme = block.top; // 使用订单块上沿作为极值点

      console.log(`🎯 极值点 (订单块上沿): ${extreme.toFixed(6)}`);
      console.log(`📊 最近10根15M K线分析:`);

      let maxSweepSpeed = 0;
      let foundSweep = false;

      for (let i = 0; i < Math.min(5, recentBars.length); i++) {
        const bar = recentBars[i];
        const high = parseFloat(bar[2]);
        const low = parseFloat(bar[3]);
        const close = parseFloat(bar[4]);
        const timestamp = new Date(parseFloat(bar[0]));

        console.log(`\n  K线${i + 1} (${timestamp.toISOString()}):`);
        console.log(`    最高价: ${high.toFixed(6)}`);
        console.log(`    最低价: ${low.toFixed(6)}`);
        console.log(`    收盘价: ${close.toFixed(6)}`);

        // 检查上破
        if (high > extreme) {
          console.log(`    🔺 上破极值点! 超出: ${(high - extreme).toFixed(6)}`);

          // 检查后续K线是否收回
          let barsToReturn = 0;
          for (let j = i + 1; j < recentBars.length; j++) {
            barsToReturn++;
            if (parseFloat(recentBars[j][4]) < extreme) {
              const exceed = high - extreme;
              const sweepSpeed = exceed / barsToReturn;

              console.log(`    📈 在${barsToReturn}根K线后收回`);
              console.log(`    ⚡ 扫荡速率: ${sweepSpeed.toFixed(6)}`);
              console.log(`    🎯 阈值要求: ${(0.1 * currentATR).toFixed(6)}`);
              console.log(`    ✅ 满足阈值: ${sweepSpeed >= 0.1 * currentATR ? '是' : '否'}`);
              console.log(`    ⏱️ 收回时间: ${barsToReturn <= 3 ? '满足' : '超时'}`);

              if (sweepSpeed > maxSweepSpeed) {
                maxSweepSpeed = sweepSpeed;
              }

              if (sweepSpeed >= 0.1 * currentATR && barsToReturn <= 3) {
                foundSweep = true;
                console.log(`    🎉 检测到有效扫荡!`);
              }
              break;
            }
          }
        }

        // 检查下破
        if (low < extreme) {
          console.log(`    🔻 下破极值点! 超出: ${(extreme - low).toFixed(6)}`);

          // 检查后续K线是否收回
          let barsToReturn = 0;
          for (let j = i + 1; j < recentBars.length; j++) {
            barsToReturn++;
            if (parseFloat(recentBars[j][4]) > extreme) {
              const exceed = extreme - low;
              const sweepSpeed = exceed / barsToReturn;

              console.log(`    📉 在${barsToReturn}根K线后收回`);
              console.log(`    ⚡ 扫荡速率: ${sweepSpeed.toFixed(6)}`);
              console.log(`    🎯 阈值要求: ${(0.1 * currentATR).toFixed(6)}`);
              console.log(`    ✅ 满足阈值: ${sweepSpeed >= 0.1 * currentATR ? '是' : '否'}`);
              console.log(`    ⏱️ 收回时间: ${barsToReturn <= 3 ? '满足' : '超时'}`);

              if (sweepSpeed > maxSweepSpeed) {
                maxSweepSpeed = sweepSpeed;
              }

              if (sweepSpeed >= 0.1 * currentATR && barsToReturn <= 3) {
                foundSweep = true;
                console.log(`    🎉 检测到有效扫荡!`);
              }
              break;
            }
          }
        }
      }

      console.log(`\n📊 总结:`);
      console.log(`  - 最大扫荡速率: ${maxSweepSpeed.toFixed(6)}`);
      console.log(`  - 是否检测到扫荡: ${foundSweep ? '是' : '否'}`);
      console.log(`  - 阈值: ${(0.1 * currentATR).toFixed(6)}`);

      // 调用实际的detectSweepLTF方法
      console.log(`\n🔧 调用detectSweepLTF方法:`);
      const sweepRes = strategy.detectSweepLTF(kl15m, currentATR, extreme);
      console.log(`  - 检测到: ${sweepRes.detected}`);
      console.log(`  - 类型: ${sweepRes.type || 'NONE'}`);
      console.log(`  - 速率: ${sweepRes.speed.toFixed(6)}`);
      console.log(`  - 置信度: ${sweepRes.confidence.toFixed(4)}`);

    } else {
      console.log('❌ 没有检测到订单块');
    }

  } catch (error) {
    console.log(`❌ 错误: ${error.message}`);
  }
}

// 运行调试
debug15MSweep().catch(console.error);
