/**
 * 简化版资金费率测试
 */

const BinanceAPI = require('./src/api/binance-api');
const mysql = require('mysql2/promise');

async function testFundingRate() {
  console.log('=== 测试资金费率实时获取 ===\n');

  try {
    // 初始化Binance API
    const binanceAPI = new BinanceAPI();
    console.log('✅ Binance API初始化成功\n');

    // 测试ETHUSDT
    console.log('📊 测试ETHUSDT资金费率...');
    const ethRate = await binanceAPI.getFundingRate('ETHUSDT');
    console.log('API实时:', ethRate, '(' + (ethRate >= 0 ? '正数' : '负数') + ')');
    console.log('百分比:', (ethRate * 100).toFixed(4) + '%\n');

    // 测试BTCUSDT
    console.log('📊 测试BTCUSDT资金费率...');
    const btcRate = await binanceAPI.getFundingRate('BTCUSDT');
    console.log('API实时:', btcRate, '(' + (btcRate >= 0 ? '正数' : '负数') + ')');
    console.log('百分比:', (btcRate * 100).toFixed(4) + '%\n');

    // 检查数据库中的数据
    console.log('=== 数据库中的资金费率 ===\n');
    const pool = mysql.createPool({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: 'SmartFlow@2024',
      database: 'trading_system'
    });

    const [ethRows] = await pool.query(
      'SELECT symbol, funding_rate, updated_at FROM symbols WHERE symbol = ?',
      ['ETHUSDT']
    );

    const [btcRows] = await pool.query(
      'SELECT symbol, funding_rate, updated_at FROM symbols WHERE symbol = ?',
      ['BTCUSDT']
    );

    console.log('ETHUSDT数据库数据:');
    if (ethRows.length > 0) {
      const eth = ethRows[0];
      console.log('  资金费率:', eth.funding_rate, '(' + (eth.funding_rate >= 0 ? '正数' : '负数') + ')');
      console.log('  更新时间:', eth.updated_at);
      const ageDays = Math.round((Date.now() - new Date(eth.updated_at).getTime()) / (1000 * 60 * 60 * 24));
      console.log('  数据年龄:', ageDays + '天');
    }

    console.log('\nBTCUSDT数据库数据:');
    if (btcRows.length > 0) {
      const btc = btcRows[0];
      console.log('  资金费率:', btc.funding_rate, '(' + (btc.funding_rate >= 0 ? '正数' : '负数') + ')');
      console.log('  更新时间:', btc.updated_at);
      const ageDays = Math.round((Date.now() - new Date(btc.updated_at).getTime()) / (1000 * 60 * 60 * 24));
      console.log('  数据年龄:', ageDays + '天');
    }

    // 对比
    console.log('\n=== 数据对比 ===\n');
    console.log('ETHUSDT:');
    console.log('  API实时:', ethRate, '(' + (ethRate >= 0 ? '正' : '负') + ')');
    console.log('  数据库:', ethRows[0]?.funding_rate, '(' + (ethRows[0]?.funding_rate >= 0 ? '正' : '负') + ')');
    console.log('  是否一致:', Math.abs(ethRate - ethRows[0]?.funding_rate) < 0.00000001 ? '✅ 是' : '❌ 否');
    console.log('  数据是否过期:', (Date.now() - new Date(ethRows[0]?.updated_at).getTime()) > (24 * 60 * 60 * 1000) ? '❌ 是（超过24小时）' : '✅ 否');

    console.log('\nBTCUSDT:');
    console.log('  API实时:', btcRate, '(' + (btcRate >= 0 ? '正' : '负') + ')');
    console.log('  数据库:', btcRows[0]?.funding_rate, '(' + (btcRows[0]?.funding_rate >= 0 ? '正' : '负') + ')');
    console.log('  是否一致:', Math.abs(btcRate - btcRows[0]?.funding_rate) < 0.00000001 ? '✅ 是' : '❌ 否');
    console.log('  数据是否过期:', (Date.now() - new Date(btcRows[0]?.updated_at).getTime()) > (24 * 60 * 60 * 1000) ? '❌ 是（超过24小时）' : '✅ 否');

    await pool.end();
    console.log('\n✅ 测试完成');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

testFundingRate();
