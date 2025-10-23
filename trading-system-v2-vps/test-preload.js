/**
 * 测试数据预加载功能
 */

const MarketDataPreloader = require('./src/services/market-data-preloader');
const database = require('./src/database/connection');

async function testPreload() {
  try {
    console.log('开始测试数据预加载...');
    
    // 连接数据库
    await database.connect();
    console.log('数据库连接成功');
    
    const preloader = new MarketDataPreloader(database);
    
    // 测试预加载BTCUSDT和ETHUSDT的1h数据
    const result = await preloader.preloadAllData(
      ['BTCUSDT', 'ETHUSDT'],
      ['1h']
    );
    
    console.log('预加载结果:', JSON.stringify(result, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('测试失败:', error);
    process.exit(1);
  }
}

testPreload();
