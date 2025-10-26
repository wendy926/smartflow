/**
 * A股策略测试脚本
 * 本地测试A股指数交易策略
 */

require('dotenv').config();
const ChinaStockAdapter = require('./src/adapters/ChinaStockAdapter');
const CNStockMarketDataLoader = require('./src/services/cn-stock-market-data-loader');
const logger = require('./src/utils/logger');

// A股主要指数
const MAIN_INDICES = [
  '000300.SH', // 沪深300
  '000905.SH', // 中证500
  '000852.SH', // 中证1000
  '399001.SZ', // 深证成指
  '399006.SZ'  // 创业板指
];

/**
 * 测试数据加载
 */
async function testDataLoader() {
  try {
    logger.info('=== 测试A股数据加载 ===');
    
    const loader = new CNStockMarketDataLoader({
      tushare: {
        token: process.env.TUSHARE_TOKEN
      }
    });
    
    await loader.initialize();
    
    // 加载指数基本信息
    await loader.loadIndexBasic();
    
    // 加载最近3个月的历史数据
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);
    
    const startDateStr = loader.formatDate(startDate);
    const endDateStr = loader.formatDate(endDate);
    
    logger.info(`加载历史数据: ${startDateStr} - ${endDateStr}`);
    await loader.loadHistoricalData(MAIN_INDICES, startDateStr, endDateStr);
    
    // 获取数据统计
    await loader.getDataStatistics();
    
    logger.info('✅ 数据加载测试完成');
  } catch (error) {
    logger.error(`❌ 数据加载测试失败: ${error.message}`);
    console.error(error);
  }
}

/**
 * 测试适配器
 */
async function testAdapter() {
  try {
    logger.info('=== 测试A股适配器 ===');
    
    const adapter = new ChinaStockAdapter({
      tushare: {
        token: process.env.TUSHARE_TOKEN
      },
      symbols: MAIN_INDICES,
      simulationMode: true
    });
    
    // 测试获取市场信息
    const marketInfo = adapter.getMarketInfo();
    logger.info(`市场类型: ${marketInfo.marketType}`);
    logger.info(`交易时间: ${marketInfo.tradingHours.sessions.map(s => s.open + '-' + s.close).join(', ')}`);
    logger.info(`支持符号: ${marketInfo.symbols.slice(0, 3).join(', ')}...`);
    
    // 测试获取K线数据
    logger.info('测试获取沪深300 K线数据...');
    const klines = await adapter.getKlines('000300.SH', '1d', 30);
    logger.info(`获取到 ${klines.length} 条K线数据`);
    
    if (klines.length > 0) {
      const last = klines[klines.length - 1];
      logger.info(`最新K线: ${last.timestamp.toISOString()} - ${last.close}`);
    }
    
    // 测试获取实时行情
    logger.info('测试获取实时行情...');
    const ticker = await adapter.getTicker('000300.SH');
    logger.info(`沪深300价格: ${ticker.price}`);
    logger.info(`涨跌幅: ${ticker.changePercent}%`);
    
    // 测试获取市场指标
    logger.info('测试获取市场指标...');
    const metrics = await adapter.getMarketMetrics('000300.SH');
    logger.info(`成交量: ${metrics.volume}`);
    logger.info(`成交额: ${metrics.turnover || 0}`);
    
    // 测试模拟下单
    logger.info('测试模拟下单...');
    const order = await adapter.placeOrder({
      symbol: '000300.SH',
      side: 'BUY',
      type: 'MARKET',
      quantity: 100
    });
    logger.info(`模拟订单创建成功: ${order.orderId}`);
    
    logger.info('✅ 适配器测试完成');
  } catch (error) {
    logger.error(`❌ 适配器测试失败: ${error.message}`);
    console.error(error);
  }
}

/**
 * 测试策略执行
 */
async function testStrategy() {
  try {
    logger.info('=== 测试策略执行 ===');
    
    // TODO: 实现策略逻辑
    logger.info('策略执行逻辑待实现');
    
    logger.info('✅ 策略测试完成');
  } catch (error) {
    logger.error(`❌ 策略测试失败: ${error.message}`);
    console.error(error);
  }
}

/**
 * 主函数
 */
async function main() {
  logger.info('🚀 开始A股策略测试...');
  
  try {
    // 1. 测试数据加载
    await testDataLoader();
    
    // 2. 测试适配器
    await testAdapter();
    
    // 3. 测试策略
    await testStrategy();
    
    logger.info('🎉 所有测试完成');
  } catch (error) {
    logger.error(`❌ 测试失败: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
  
  process.exit(0);
}

// 运行测试
if (require.main === module) {
  main();
}

module.exports = { testDataLoader, testAdapter, testStrategy };

