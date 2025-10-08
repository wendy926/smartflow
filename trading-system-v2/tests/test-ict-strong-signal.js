/**
 * 测试ICT策略15分钟入场判断：门槛式结构确认 + 总分强信号
 */

const ICTStrategy = require('./src/strategies/ict-strategy');

async function testICTStrongSignal() {
  console.log('=== ICT策略15分钟入场判断测试：门槛式 + 强信号 ===\n');

  const strategy = new ICTStrategy();
  const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT'];

  console.log('新规则：');
  console.log('1. 门槛式条件（必须全部满足）：');
  console.log('   ✓ 日线趋势确认（非RANGE）');
  console.log('   ✓ 4H订单块存在');
  console.log('   ✓ 4H扫荡确认');
  console.log('   ✓ 吞没形态方向匹配');
  console.log('2. 强信号条件：');
  console.log('   ✓ 总分 >= 60分\n');
  console.log('='.repeat(80));

  for (const symbol of symbols) {
    try {
      console.log(`\n【${symbol}】`);

      // 执行ICT策略
      const result = await strategy.execute(symbol);

      // 提取关键信息
      const signal = result.signal;
      const trend = result.trend;
      const score = result.score;
      const confidence = result.confidence;

      const timeframe4H = result.timeframes?.['4H'] || {};
      const timeframe15M = result.timeframes?.['15M'] || {};

      const hasOrderBlock = (timeframe4H.orderBlocks?.length > 0);
      const hasSweepHTF = timeframe4H.sweepDetected || false;
      const engulfing = timeframe15M.engulfing || false;
      const engulfingType = timeframe15M.engulfingType || 'NONE';

      // 判断门槛式条件
      const threshold1 = trend !== 'RANGE';
      const threshold2 = hasOrderBlock;
      const threshold3 = hasSweepHTF;
      const threshold4 = engulfing && (
        (trend === 'UP' && engulfingType === 'BULLISH_ENGULFING') ||
        (trend === 'DOWN' && engulfingType === 'BEARISH_ENGULFING')
      );
      const thresholdPassed = threshold1 && threshold2 && threshold3 && threshold4;

      // 判断强信号条件
      const isStrongSignal = score >= 60;

      // 最终判断
      const shouldTrigger = thresholdPassed && isStrongSignal;
      const actuallyTriggered = (signal === 'BUY' || signal === 'SELL');

      // 输出结果
      console.log('─'.repeat(80));
      console.log(`信号: ${signal} | 趋势: ${trend} | 总分: ${score}/100 | 置信度: ${typeof confidence === 'number' ? confidence.toFixed(3) : confidence}`);
      console.log('');
      console.log('门槛式条件检查：');
      console.log(`  ${threshold1 ? '✓' : '✗'} 门槛1: 日线趋势 = ${trend} ${threshold1 ? '(明确)' : '(震荡)'}`);
      console.log(`  ${threshold2 ? '✓' : '✗'} 门槛2: 4H订单块 = ${hasOrderBlock ? `${timeframe4H.orderBlocks.length}个` : '0个'}`);
      console.log(`  ${threshold3 ? '✓' : '✗'} 门槛3: 4H扫荡 = ${hasSweepHTF ? '是' : '否'}`);
      console.log(`  ${threshold4 ? '✓' : '✗'} 门槛4: 吞没匹配 = ${engulfing ? engulfingType : '无'} ${threshold4 ? '(方向匹配)' : '(方向不匹配或无)'}`);
      console.log(`  门槛式条件: ${thresholdPassed ? '✓ 全部通过' : '✗ 未通过'}`);
      console.log('');
      console.log('强信号条件检查：');
      console.log(`  ${isStrongSignal ? '✓' : '✗'} 总分 >= 60: ${score}/100 ${isStrongSignal ? '(强信号)' : '(信号不足)'}`);
      console.log('');
      console.log('最终判断：');
      console.log(`  预期: ${shouldTrigger ? '触发交易' : '不触发交易'}`);
      console.log(`  实际: ${actuallyTriggered ? '触发交易' : '不触发交易'}`);
      console.log(`  结果: ${shouldTrigger === actuallyTriggered ? '✓ 一致' : '✗ 不一致'}`);

      if (result.reasons) {
        console.log(`  理由: ${Array.isArray(result.reasons) ? result.reasons.join('; ') : result.reasons}`);
      }

    } catch (error) {
      console.error(`\n测试 ${symbol} 时出错:`, error.message);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('测试完成！');
  console.log('\n总结：');
  console.log('- 门槛式条件必须全部通过');
  console.log('- 总分必须 >= 60分（强信号）');
  console.log('- 只有同时满足这两个条件，才会触发交易信号');
}

// 运行测试
testICTStrongSignal().catch(console.error);
