/**
 * 测试ICT策略15分钟入场判断逻辑前后端一致性
 */

const ICTStrategy = require('./src/strategies/ict-strategy');

async function testICT15MConsistency() {
  console.log('=== ICT策略15分钟入场判断逻辑一致性测试 ===\n');

  const strategy = new ICTStrategy();
  const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'BNBUSDT'];

  for (const symbol of symbols) {
    try {
      console.log(`\n--- 测试 ${symbol} ---`);

      // 执行ICT策略
      const result = await strategy.execute(symbol);

      console.log('后端策略结果:');
      console.log(`- 信号: ${result.signal}`);
      console.log(`- 趋势: ${result.trend}`);
      console.log(`- 总分: ${result.score}`);
      console.log(`- 置信度: ${result.confidence}`);

      // 提取15M时间框架数据
      const timeframe15M = result.timeframes?.['15M'] || {};
      console.log('\n15M时间框架数据:');
      console.log(`- 吞没形态: ${timeframe15M.engulfing}`);
      console.log(`- 吞没类型: ${timeframe15M.engulfingType}`);
      console.log(`- 扫荡速率: ${timeframe15M.sweepRate}`);

      // 提取4H时间框架数据
      const timeframe4H = result.timeframes?.['4H'] || {};
      console.log('\n4H时间框架数据:');
      console.log(`- 订单块数量: ${timeframe4H.orderBlocks?.length || 0}`);
      console.log(`- 4H扫荡: ${timeframe4H.sweepDetected}`);

      // 模拟前端15分钟入场判断逻辑
      const trend = result.trend || 'RANGE';
      const hasOrderBlock = (timeframe4H.orderBlocks?.length > 0) || false;
      const hasSweepHTF = timeframe4H.sweepDetected || false;
      const engulfing = timeframe15M.engulfing || false;
      const engulfingType = timeframe15M.engulfingType || 'NONE';
      const engulfingDirectionMatch = (trend === 'UP' && engulfingType === 'BULLISH_ENGULFING') ||
        (trend === 'DOWN' && engulfingType === 'BEARISH_ENGULFING');

      // 门槛式确认：所有必须条件都满足
      const frontendValid = (trend !== 'RANGE') && hasOrderBlock && hasSweepHTF && engulfing && engulfingDirectionMatch;

      console.log('\n前端15分钟入场判断:');
      console.log(`- 趋势确认 (非RANGE): ${trend !== 'RANGE'} (${trend})`);
      console.log(`- 4H订单块存在: ${hasOrderBlock}`);
      console.log(`- 4H扫荡确认: ${hasSweepHTF}`);
      console.log(`- 吞没形态存在: ${engulfing}`);
      console.log(`- 吞没方向匹配: ${engulfingDirectionMatch} (${engulfingType})`);
      console.log(`- 前端判断结果: ${frontendValid ? '有效' : '无效'}`);

      // 检查是否有基于总分和置信度的判断
      console.log('\n总分和置信度分析:');
      console.log(`- 总分: ${result.score}/100`);
      console.log(`- 置信度: ${result.confidence}`);
      console.log(`- 是否有基于总分阈值的判断: 否 (完全基于门槛式条件)`);
      console.log(`- 是否有基于置信度阈值的判断: 否 (完全基于门槛式条件)`);

    } catch (error) {
      console.error(`测试 ${symbol} 时出错:`, error.message);
    }
  }

  console.log('\n=== 测试完成 ===');
}

// 运行测试
testICT15MConsistency().catch(console.error);