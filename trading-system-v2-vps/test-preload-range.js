/**
 * 测试指定时间范围的数据预加载
 */

const MarketDataPreloader = require('./src/services/market-data-preloader');
const database = require('./src/database/connection');

async function testPreloadRange() {
  try {
    console.log('开始测试指定时间范围的数据预加载...');
    
    // 连接数据库
    await database.connect();
    console.log('数据库连接成功');
    
    const preloader = new MarketDataPreloader(database);
    
    // 预加载2025-01-01至2025-04-22的BTCUSDT数据
    const startTime = new Date('2025-01-01').getTime();
    const endTime = new Date('2025-04-22').getTime();
    
    console.log(`开始时间: ${new Date(startTime).toISOString()}`);
    console.log(`结束时间: ${new Date(endTime).toISOString()}`);
    
    // 预加载BTCUSDT
    const result1 = await preloader.preloadDataByRange('BTCUSDT', '1h', startTime, endTime);
    console.log('BTCUSDT预加载结果:', JSON.stringify(result1, null, 2));
    
    // 预加载ETHUSDT
    const result2 = await preloader.preloadDataByRange('ETHUSDT', '1h', startTime, endTime);
    console.log('ETHUSDT预加载结果:', JSON.stringify(result2, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('测试失败:', error);
    process.exit(1);
  }
}

testPreloadRange();
