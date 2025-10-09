/**
 * 立即触发AI分析（不等待调度）
 */

async function triggerAINow() {
  try {
    console.log('=== 立即触发AI分析 ===\n');
    console.log('当前时间:', new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));
    
    // 获取全局调度器
    if (!global.aiScheduler) {
      console.error('❌ AI调度器未初始化');
      console.log('\n💡 请确保main-app正在运行');
      process.exit(1);
    }
    
    const scheduler = global.aiScheduler;
    
    // 执行交易对分析
    console.log('\n开始执行交易对AI分析...');
    await scheduler.runSymbolAnalysis();
    console.log('✅ 交易对分析完成\n');
    
    // 查询最新分析结果
    const aiOps = scheduler.aiOps;
    const analysis = await aiOps.getLatestAnalysis('ETHUSDT', 'SYMBOL_TREND');
    
    if (analysis && analysis.analysisData) {
      const price = analysis.analysisData.currentPrice;
      const time = analysis.createdAt;
      console.log('=== 最新AI分析 ===');
      console.log(`交易对: ETHUSDT`);
      console.log(`使用价格: $${price}`);
      console.log(`生成时间: ${time}`);
      console.log(`评分: ${analysis.analysisData.overallScore?.totalScore || 0}/100`);
      console.log(`信号: ${analysis.analysisData.overallScore?.signalRecommendation || 'N/A'}\n`);
      
      // 对比Binance实时价格
      const BinanceAPI = require('./src/api/binance-api');
      const binanceAPI = new BinanceAPI();
      const ticker = await binanceAPI.getTicker24hr('ETHUSDT');
      const realtimePrice = parseFloat(ticker.lastPrice);
      
      console.log('=== 价格对比 ===');
      console.log(`Binance实时: $${realtimePrice}`);
      console.log(`AI使用价格: $${price}`);
      const diff = Math.abs(realtimePrice - price);
      const diffPercent = (diff / realtimePrice * 100).toFixed(2);
      console.log(`差距: $${diff.toFixed(2)} (${diffPercent}%)`);
      
      if (diffPercent < 0.5) {
        console.log('\n✅ 价格准确！差距<0.5%');
      } else if (diffPercent < 5) {
        console.log('\n⚠️  价格有偏差，但在可接受范围（<5%）');
      } else {
        console.log('\n❌ 价格严重偏差！差距>5%，需要检查');
      }
    } else {
      console.log('❌ 未找到ETHUSDT的AI分析数据');
    }
    
    console.log('\n✅ 测试完成');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ 触发失败:', error);
    process.exit(1);
  }
}

// 延迟执行，等待main.js初始化全局对象
setTimeout(() => {
  triggerAINow();
}, 2000);

