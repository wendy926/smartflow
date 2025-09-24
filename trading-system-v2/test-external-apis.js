/**
 * 测试外部API接口连通性
 * 验证所有宏观监控模块使用的外部API是否正常
 */

const logger = require('./src/utils/logger');

async function testExternalAPIs() {
  console.log('开始测试外部API接口...\n');
  
  const results = {
    success: 0,
    failed: 0,
    total: 0
  };

  // 测试函数
  async function testAPI(name, url, description) {
    results.total++;
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(url, { timeout: 10000 });
      const data = await response.json();
      
      if (response.ok) {
        console.log(`✅ ${name}: ${description}`);
        console.log(`   状态码: ${response.status}`);
        console.log(`   响应数据: ${JSON.stringify(data).substring(0, 100)}...`);
        results.success++;
      } else {
        console.log(`❌ ${name}: ${description}`);
        console.log(`   状态码: ${response.status}`);
        console.log(`   错误信息: ${JSON.stringify(data)}`);
        results.failed++;
      }
    } catch (error) {
      console.log(`❌ ${name}: ${description}`);
      console.log(`   错误: ${error.message}`);
      results.failed++;
    }
    console.log('');
  }

  // 1. 测试Blockchair API (BTC大额交易)
  await testAPI(
    'Blockchair API',
    'https://api.blockchair.com/bitcoin/transactions?q=value_usd(gt.1000000)',
    'BTC大额交易监控'
  );

  // 2. 测试Etherscan API (ETH大额转账)
  await testAPI(
    'Etherscan API',
    'https://api.etherscan.io/api?module=account&action=txlist&address=0x28C6c06298d514Db089934071355E5743bf21d60&apikey=AZAZFVBNA16WCUMAHPGDFTVSXB5KJUHCIM',
    'ETH大额转账监控'
  );

  // 3. 测试Fear & Greed Index API
  await testAPI(
    'Fear & Greed Index API',
    'https://api.alternative.me/fng/?limit=1',
    '市场情绪指数'
  );

  // 4. 测试Binance API (多空比)
  await testAPI(
    'Binance API (多空比)',
    'https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=5m',
    '多空比数据'
  );

  // 5. 测试Binance API (未平仓合约)
  await testAPI(
    'Binance API (未平仓合约)',
    'https://fapi.binance.com/futures/data/openInterestHist?symbol=BTCUSDT&period=5m',
    '未平仓合约数据'
  );

  // 6. 测试Bybit API (多空比)
  await testAPI(
    'Bybit API (多空比)',
    'https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=BTCUSDT&period=5m',
    '多空比数据'
  );

  // 7. 测试Bybit API (资金费率)
  await testAPI(
    'Bybit API (资金费率)',
    'https://api.bybit.com/v5/market/funding/history?category=linear&symbol=BTCUSDT&limit=1',
    '资金费率数据'
  );

  // 8. 测试OKX API (未平仓合约)
  await testAPI(
    'OKX API (未平仓合约)',
    'https://www.okx.com/api/v5/public/open-interest?instId=BTC-USDT-SWAP',
    '未平仓合约数据'
  );

  // 9. 测试OKX API (资金费率)
  await testAPI(
    'OKX API (资金费率)',
    'https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USDT-SWAP',
    '资金费率数据'
  );

  // 10. 测试FRED API (美联储利率)
  await testAPI(
    'FRED API (美联储利率)',
    'https://api.stlouisfed.org/fred/series/observations?series_id=FEDFUNDS&api_key=fbfe3e85bdec733f71b17800eaa614fd&file_type=json',
    '美联储利率数据'
  );

  // 11. 测试FRED API (CPI通胀率)
  await testAPI(
    'FRED API (CPI通胀率)',
    'https://api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL&api_key=fbfe3e85bdec733f71b17800eaa614fd&file_type=json',
    'CPI通胀率数据'
  );

  // 输出测试结果
  console.log('='.repeat(50));
  console.log('测试结果汇总:');
  console.log(`总测试数: ${results.total}`);
  console.log(`成功: ${results.success}`);
  console.log(`失败: ${results.failed}`);
  console.log(`成功率: ${((results.success / results.total) * 100).toFixed(2)}%`);
  console.log('='.repeat(50));

  if (results.failed > 0) {
    console.log('\n⚠️  部分API测试失败，请检查网络连接和API密钥配置');
    process.exit(1);
  } else {
    console.log('\n🎉 所有API测试通过！');
    process.exit(0);
  }
}

// 运行测试
testExternalAPIs().catch(error => {
  console.error('测试过程中发生错误:', error);
  process.exit(1);
});
