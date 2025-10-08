const ICTStrategy = require('./src/strategies/ict-strategy');

async function debugICTScore() {
  const ictStrategy = new ICTStrategy();
  const symbols = ['ADAUSDT', 'BNBUSDT', 'BTCUSDT', 'ETHUSDT', 'LDOUSDT'];

  for (const symbol of symbols) {
    console.log(`\n=== ${symbol} ICT策略得分调试 ===`);

    try {
      const result = await ictStrategy.execute(symbol);

      console.log(`信号: ${result.signal}`);
      console.log(`总分: ${result.score}`);
      console.log(`置信度: ${result.confidence}`);

      // 分析各个组件
      const dailyTrend = result.timeframes?.['1D'];
      const timeframe4H = result.timeframes?.['4H'];
      const timeframe15M = result.timeframes?.['15M'];

      console.log(`\n1D趋势分析:`);
      console.log(`  趋势: ${dailyTrend?.trend}`);
      console.log(`  价格变化: ${(dailyTrend?.closeChange * 100)?.toFixed(2)}%`);
      console.log(`  置信度: ${dailyTrend?.confidence}`);

      console.log(`\n4H分析:`);
      console.log(`  订单块数量: ${timeframe4H?.orderBlocks?.length || 0}`);
      console.log(`  HTF扫荡: ${timeframe4H?.sweepDetected}`);
      console.log(`  HTF扫荡速率: ${timeframe4H?.sweepRate}`);

      console.log(`\n15M分析:`);
      console.log(`  吞没形态: ${timeframe15M?.engulfing}`);
      console.log(`  LTF扫荡: ${timeframe15M?.sweepRate > 0 ? '是' : '否'}`);
      console.log(`  LTF扫荡速率: ${timeframe15M?.sweepRate}`);
      console.log(`  成交量放大: ${timeframe15M?.volumeExpansion}`);
      console.log(`  谐波形态: ${timeframe15M?.harmonicPattern?.detected ? timeframe15M?.harmonicPattern?.type : '无'}`);
      console.log(`  谐波得分: ${timeframe15M?.harmonicPattern?.score || 0}`);

      // 计算理论得分
      const trendScore = (dailyTrend?.confidence || 0) * 25;
      const orderBlockScore = (timeframe4H?.orderBlocks?.length > 0) ? 20 : 0;
      const engulfingScore = timeframe15M?.engulfing ? 15 : 0;
      const sweepScore = (timeframe4H?.sweepDetected ? 10 : 0) + (timeframe15M?.sweepRate > 0.1 * timeframe15M?.atr ? 5 : 0);
      const volumeScore = timeframe15M?.volumeExpansion ? 5 : 0;
      const harmonicScore = timeframe15M?.harmonicPattern?.detected ? (timeframe15M?.harmonicPattern?.score || 0) * 20 : 0;

      console.log(`\n得分分解:`);
      console.log(`  趋势得分: ${trendScore.toFixed(1)} (置信度${dailyTrend?.confidence?.toFixed(3)} × 25)`);
      console.log(`  订单块得分: ${orderBlockScore} (有订单块: ${timeframe4H?.orderBlocks?.length > 0})`);
      console.log(`  吞没得分: ${engulfingScore} (检测到: ${timeframe15M?.engulfing})`);
      console.log(`  扫荡得分: ${sweepScore} (HTF: ${timeframe4H?.sweepDetected}, LTF: ${timeframe15M?.sweepRate > 0.1 * timeframe15M?.atr})`);
      console.log(`  成交量得分: ${volumeScore} (放大: ${timeframe15M?.volumeExpansion})`);
      console.log(`  谐波得分: ${harmonicScore.toFixed(1)} (检测到: ${timeframe15M?.harmonicPattern?.detected}, 得分: ${timeframe15M?.harmonicPattern?.score || 0})`);

      const theoreticalTotal = trendScore + orderBlockScore + engulfingScore + sweepScore + volumeScore + harmonicScore;
      console.log(`  理论总分: ${theoreticalTotal.toFixed(1)}`);
      console.log(`  实际总分: ${result.score}`);
      console.log(`  差异: ${(result.score - theoreticalTotal).toFixed(1)}`);

    } catch (error) {
      console.error(`${symbol} 执行失败:`, error.message);
    }
  }
}

debugICTScore().catch(console.error);
