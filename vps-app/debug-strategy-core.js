const StrategyV3Core = require('./modules/strategy/StrategyV3Core');

async function debugStrategyCore() {
    try {
        console.log('🔍 直接测试StrategyV3Core.analyze4HTrend...\n');
        
        const strategyCore = new StrategyV3Core();
        
        // 直接调用analyze4HTrend方法
        const result = await strategyCore.analyze4HTrend('ETHUSDT');
        
        console.log('📊 StrategyV3Core分析结果:');
        console.log(JSON.stringify(result, null, 2));
        
        // 分析结果
        console.log(`\n🎯 分析结论:`);
        console.log(`4H趋势: ${result.trend4h}`);
        console.log(`市场类型: ${result.marketType}`);
        console.log(`总得分: ${result.score}`);
        console.log(`多头得分: ${result.bullScore}`);
        console.log(`空头得分: ${result.bearScore}`);
        console.log(`MA20: ${result.ma20}`);
        console.log(`MA50: ${result.ma50}`);
        console.log(`MA200: ${result.ma200}`);
        
    } catch (error) {
        console.error('❌ 调试失败:', error.message);
        console.error('错误堆栈:', error.stack);
    }
}

debugStrategyCore();

