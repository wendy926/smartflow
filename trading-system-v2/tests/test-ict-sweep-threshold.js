const ICTStrategy = require('./src/strategies/ict-strategy');

async function testSweepThreshold() {
  console.log('🔍 测试ICT策略15分钟扫荡速率阈值调整效果\n');

  const strategy = new ICTStrategy();
  const symbols = ['ADAUSDT', 'BNBUSDT', 'BTCUSDT', 'ETHUSDT'];

  for (const symbol of symbols) {
    try {
      console.log(`\n📊 测试 ${symbol}:`);

      // 获取15M K线数据
      const kl15m = await strategy.fetchKlines(symbol, '15m', 50);
      if (!kl15m || kl15m.length < 5) {
        console.log('  ❌ 数据不足');
        continue;
      }

      // 计算ATR
      const atr15 = strategy.calcATR(kl15m, 14);
      console.log(`  📈 ATR: ${atr15.toFixed(6)}`);

      // 计算阈值
      const threshold = 0.1 * atr15;
      console.log(`  🎯 新阈值 (0.1×ATR): ${threshold.toFixed(6)}`);

      // 获取4H订单块
      const kl4h = await strategy.fetchKlines(symbol, '4h', 20);
      const orderBlocks = strategy.analyzeOrderBlocks(kl4h);

      if (orderBlocks && orderBlocks.blocks && orderBlocks.blocks.length > 0) {
        const block = orderBlocks.blocks[0];
        console.log(`  📦 订单块: ${block.type} [${block.bottom.toFixed(6)}, ${block.top.toFixed(6)}]`);

        // 检测扫荡
        const sweepRes = strategy.detectSweepLTF(kl15m, atr15, block.top);
        console.log(`  🔍 扫荡检测:`);
        console.log(`    - 检测到: ${sweepRes.detected}`);
        console.log(`    - 类型: ${sweepRes.type || 'NONE'}`);
        console.log(`    - 速率: ${sweepRes.speed.toFixed(6)}`);
        console.log(`    - 置信度: ${sweepRes.confidence.toFixed(4)}`);
        console.log(`    - 是否满足阈值: ${sweepRes.speed >= threshold ? '✅' : '❌'}`);

        // 检查最近K线的实际扫荡情况
        const recentBars = kl15m.slice(-5);
        console.log(`  📊 最近5根K线分析:`);
        for (let i = 0; i < recentBars.length; i++) {
          const bar = recentBars[i];
          const high = parseFloat(bar[2]);
          const low = parseFloat(bar[3]);
          const close = parseFloat(bar[4]);

          // 检查是否突破订单块
          const breakUp = high > block.top;
          const breakDown = low < block.bottom;

          if (breakUp || breakDown) {
            const exceed = breakUp ? (high - block.top) : (block.bottom - low);
            const sweepSpeed = exceed / (recentBars.length - i);
            console.log(`    K线${i + 1}: ${breakUp ? '上破' : '下破'} ${exceed.toFixed(6)}, 速率: ${sweepSpeed.toFixed(6)}`);
          }
        }
      } else {
        console.log('  ❌ 无有效订单块');
      }

    } catch (error) {
      console.log(`  ❌ 错误: ${error.message}`);
    }
  }
}

// 运行测试
testSweepThreshold().catch(console.error);
