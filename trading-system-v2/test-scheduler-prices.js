/**
 * 测试scheduler的getStrategyData是否正确获取实时价格
 */

const AIOperations = require('./src/database/ai-operations');
const BinanceAPI = require('./src/api/binance-api');
const AIAnalysisScheduler = require('./src/services/ai-agent/scheduler');
const TelegramAlert = require('./src/services/telegram');

async function test() {
  try {
    console.log('=== 初始化组件 ===');
    const aiOps = AIOperations();
    const binanceAPI = new BinanceAPI();
    const telegram = new TelegramAlert();

    const scheduler = new AIAnalysisScheduler(aiOps, binanceAPI, telegram);

    console.log('\n=== 测试getStrategyData ===');
    const symbols = ['BTCUSDT', 'ETHUSDT'];
    const strategyData = await scheduler.getStrategyData(symbols);

    console.log('\n结果:');
    for (const [symbol, data] of Object.entries(strategyData)) {
      console.log(`\n${symbol}:`);
      console.log(`  currentPrice: $${data.currentPrice}`);
      console.log(`  trend4h: ${data.trend4h}`);
      console.log(`  trend1h: ${data.trend1h}`);
    }

    console.log('\n=== 对比Binance实时价格 ===');
    for (const symbol of symbols) {
      const ticker = await binanceAPI.getTicker24hr(symbol);
      console.log(`${symbol}: $${ticker.lastPrice}`);
    }

    process.exit(0);

  } catch (error) {
    console.error('测试失败:', error);
    process.exit(1);
  }
}

test();

