/**
 * A股策略测试脚本 - 使用Python数据服务
 * 本地测试A股指数交易策略和回测
 */

require('dotenv').config();
const CNStockServiceAPI = require('./src/api/cn-stock-service-api');
const ChinaStockAdapter = require('./src/adapters/ChinaStockAdapter');
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
 * 测试Python数据服务
 */
async function testPythonService() {
  try {
    logger.info('=== 测试Python数据服务 ===');
    
    const api = new CNStockServiceAPI({
      baseURL: 'http://localhost:5001',
      timeout: 30000
    });
    
    // 健康检查
    logger.info('1. 健康检查...');
    const health = await api.health();
    logger.info(`服务状态: ${health.status}`);
    
    // 获取指数列表
    logger.info('2. 获取指数列表...');
    const indexes = await api.getIndexes();
    logger.info(`支持的指数: ${indexes.map(i => i.name).join(', ')}`);
    
    // 获取沪深300日线数据
    logger.info('3. 获取沪深300日线数据...');
    const code = '000300';
    const endDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);
    const startDateStr = startDate.toISOString().slice(0, 10).replace(/-/g, '');
    
    const data = await api.getIndexDaily(code, startDateStr, endDate, 100);
    logger.info(`获取到 ${data.length} 条数据`);
    
    if (data.length > 0) {
      const last = data[data.length - 1];
      logger.info(`最新数据: ${last.trade_date} - 收盘: ${last.close}, 涨跌幅: ${last.pct_chg}%`);
    }
    
    // 获取实时行情
    logger.info('4. 获取实时行情...');
    const ticker = await api.getIndexRealtime(code);
    logger.info(`实时行情: 价格=${ticker.price}, 涨跌=${ticker.change}%`);
    
    logger.info('✅ Python数据服务测试完成');
  } catch (error) {
    logger.error(`❌ Python数据服务测试失败: ${error.message}`);
    throw error;
  }
}

/**
 * 测试适配器
 */
async function testAdapter() {
  try {
    logger.info('=== 测试A股适配器 ===');
    
    const adapter = new ChinaStockAdapter({
      serviceURL: 'http://localhost:5001',
      symbols: MAIN_INDICES,
      simulationMode: true
    });
    
    // 测试获取市场信息
    logger.info('1. 获取市场信息...');
    const marketInfo = adapter.getMarketInfo();
    logger.info(`市场类型: ${marketInfo.marketType}`);
    logger.info(`交易时间: ${marketInfo.tradingHours.sessions.map(s => s.open + '-' + s.close).join(', ')}`);
    
    // 测试获取K线数据
    logger.info('2. 获取沪深300 K线数据...');
    const klines = await adapter.getKlines('000300.SH', '1d', 30);
    logger.info(`获取到 ${klines.length} 条K线数据`);
    
    if (klines.length > 0) {
      const last = klines[klines.length - 1];
      logger.info(`最新K线: ${last.timestamp.toISOString()} - ${last.close}`);
    }
    
    // 测试获取实时行情
    logger.info('3. 获取实时行情...');
    const ticker = await adapter.getTicker('000300.SH');
    logger.info(`沪深300: 价格=${ticker.price}, 涨跌幅=${ticker.changePercent}%`);
    
    // 测试模拟下单
    logger.info('4. 测试模拟下单...');
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
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  logger.info('🚀 开始A股策略测试（使用Python数据服务）...');
  
  try {
    // 1. 测试Python数据服务
    await testPythonService();
    
    logger.info('');
    
    // 2. 测试适配器
    await testAdapter();
    
    logger.info('');
    logger.info('🎉 所有测试完成');
  } catch (error) {
    logger.error(`❌ 测试失败: ${error.message}`);
    console.error(error);
    
    if (error.message.includes('ECONNREFUSED')) {
      logger.error('');
      logger.error('💡 提示: Python数据服务未启动');
      logger.error('   请先运行: cd cn-stock-data-service && ./start.sh');
    }
    
    process.exit(1);
  }
  
  process.exit(0);
}

// 运行测试
if (require.main === module) {
  main();
}

module.exports = { testPythonService, testAdapter };

