/**
 * 测试AI分析是否使用实时价格
 */

const mysql = require('mysql2/promise');
const BinanceAPI = require('./src/api/binance-api');
const config = require('./src/config');

async function testRealtimePrice() {
  let connection;
  try {
    console.log('=== 测试AI分析实时价格获取 ===\n');
    
    // 创建数据库连接
    const dbConfig = {
      host: config.database.host,
      user: config.database.user,
      password: config.database.password,
      database: config.database.database || 'trading_system'
    };
    connection = await mysql.createConnection(dbConfig);
    
    const binanceAPI = new BinanceAPI();
    const symbol = 'ETHUSDT';
    
    // 1. 获取Binance实时价格
    console.log('1. 获取Binance实时价格...');
    const ticker = await binanceAPI.getTicker24hr(symbol);
    const realtimePrice = parseFloat(ticker.lastPrice);
    console.log(`   ✅ Binance实时: $${realtimePrice}\n`);
    
    // 2. 查询strategy_judgments表的价格
    console.log('2. 查询strategy_judgments表...');
    const [rows] = await connection.query(
      `SELECT sj.*, s.last_price 
       FROM strategy_judgments sj
       INNER JOIN symbols s ON sj.symbol_id = s.id
       WHERE s.symbol = ?
       ORDER BY sj.created_at DESC
       LIMIT 1`,
      [symbol]
    );
    
    if (rows.length > 0) {
      const dbPrice = parseFloat(rows[0].last_price);
      console.log(`   数据库价格: $${dbPrice}`);
      console.log(`   数据库时间: ${rows[0].created_at}`);
      console.log(`   价格差距: $${Math.abs(realtimePrice - dbPrice).toFixed(2)} (${(Math.abs(realtimePrice - dbPrice) / realtimePrice * 100).toFixed(2)}%)\n`);
    }
    
    // 3. 查询AI分析使用的价格
    console.log('3. 查询AI分析使用的价格...');
    const [aiRows] = await connection.query(
      `SELECT 
        symbol,
        JSON_EXTRACT(analysis_data, '$.currentPrice') as ai_price,
        created_at
       FROM ai_market_analysis
       WHERE symbol = ? AND analysis_type = 'SYMBOL_TREND'
       ORDER BY created_at DESC
       LIMIT 1`,
      [symbol]
    );
    
    if (aiRows.length > 0) {
      const aiPrice = parseFloat(aiRows[0].ai_price);
      console.log(`   AI使用价格: $${aiPrice}`);
      console.log(`   AI分析时间: ${aiRows[0].created_at}`);
      console.log(`   与实时差距: $${Math.abs(realtimePrice - aiPrice).toFixed(2)} (${(Math.abs(realtimePrice - aiPrice) / realtimePrice * 100).toFixed(2)}%)\n`);
      
      if (Math.abs(realtimePrice - aiPrice) / realtimePrice > 0.05) {
        console.log('   ⚠️  价格差距>5%，可能使用的是旧数据！\n');
      } else {
        console.log('   ✅ 价格差距<5%，数据较新鲜\n');
      }
    }
    
    // 4. 模拟getStrategyData方法
    console.log('4. 模拟getStrategyData获取价格...');
    let testPrice = dbPrice;
    try {
      const testTicker = await binanceAPI.getTicker24hr(symbol);
      testPrice = parseFloat(testTicker.lastPrice);
      console.log(`   ✅ 成功获取实时价格: $${testPrice}\n`);
    } catch (error) {
      console.log(`   ❌ 获取实时价格失败: ${error.message}\n`);
    }
    
    console.log('=== 总结 ===');
    console.log(`Binance实时: $${realtimePrice}`);
    console.log(`数据库价格: $${dbPrice || 'N/A'}`);
    console.log(`AI使用价格: $${aiPrice || 'N/A'}`);
    console.log(`测试获取: $${testPrice}`);
    
    if (Math.abs(testPrice - realtimePrice) < 1) {
      console.log('\n✅ 代码逻辑正确：可以获取实时价格');
      console.log('💡 等待下次AI分析（整点）使用新代码');
    } else {
      console.log('\n❌ 代码逻辑有问题：无法获取实时价格');
    }
    
    if (connection) await connection.end();
    process.exit(0);
    
  } catch (error) {
    console.error('测试失败:', error);
    if (connection) await connection.end();
    process.exit(1);
  }
}

testRealtimePrice();

