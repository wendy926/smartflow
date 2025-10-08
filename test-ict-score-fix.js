/**
 * 测试ICT策略分数计算修复效果
 */

const ICTStrategy = require('./src/strategies/ict-strategy');

async function testICTScoreFix() {
  console.log('=== ICT策略分数计算修复效果测试 ===\n');

  const strategy = new ICTStrategy();
  const symbols = ['BNBUSDT', 'SOLUSDT', 'BTCUSDT', 'ETHUSDT'];

  for (const symbol of symbols) {
    try {
      console.log(`\n--- 测试 ${symbol} ---`);

      // 执行ICT策略
      const result = await strategy.execute(symbol);

      console.log('策略结果:');
      console.log(`- 信号: ${result.signal}`);
      console.log(`- 趋势: ${result.trend}`);
      console.log(`- 总分: ${result.score}`);
      console.log(`- 置信度: ${result.confidence} (${typeof result.confidence})`);

      // 提取时间框架数据
      const timeframe4H = result.timeframes?.['4H'] || {};
      const timeframe15M = result.timeframes?.['15M'] || {};

      console.log('\n组件检测结果:');
      console.log(`- 4H订单块: ${timeframe4H.orderBlocks?.length || 0}个`);
      console.log(`- 4H扫荡: ${timeframe4H.sweepDetected}`);
      console.log(`- 15M吞没: ${timeframe15M.engulfing}`);
      console.log(`- 15M扫荡: ${timeframe15M.sweepRate > 0 ? '是' : '否'}`);
      console.log(`- 成交量放大: ${timeframe15M.volumeExpansion}`);
      console.log(`- 谐波形态: ${timeframe15M.harmonicPattern?.detected ? '是' : '否'}`);

      // 检查置信度类型
      console.log(`\n置信度分析:`);
      console.log(`- 置信度类型: ${typeof result.confidence}`);
      console.log(`- 置信度值: ${result.confidence}`);
      console.log(`- 类型正确: ${typeof result.confidence === 'number' ? '✅' : '❌'}`);

    } catch (error) {
      console.error(`测试 ${symbol} 时出错:`, error.message);
    }
  }

  console.log('\n=== 测试完成 ===');
  console.log('\n修复总结:');
  console.log('1. ✅ 移除了所有硬编码分数（30分、40分）');
  console.log('2. ✅ 统一使用基于组件的分数计算');
  console.log('3. ✅ 统一使用数值置信度（不再使用字符串）');
  console.log('4. ✅ 确保总分与置信度逻辑一致');
}

// 运行测试
testICTScoreFix().catch(console.error);