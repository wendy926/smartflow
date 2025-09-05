/**
 * VPS 代理测试脚本
 * 用于测试代理服务器是否正常工作
 */

const fetch = require('node-fetch');

const VPS_URL = 'http://47.237.163.85:3000';

async function testProxy() {
  console.log('🧪 开始测试 VPS 代理服务器...\n');

  // 测试健康检查
  try {
    console.log('1. 测试健康检查...');
    const healthResponse = await fetch(`${VPS_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ 健康检查通过:', healthData);
  } catch (error) {
    console.log('❌ 健康检查失败:', error.message);
    return;
  }

  // 测试 Binance API 代理
  const tests = [
    {
      name: 'K线数据',
      url: `${VPS_URL}/api/binance/fapi/v1/klines?symbol=BTCUSDT&interval=1h&limit=5`
    },
    {
      name: '资金费率',
      url: `${VPS_URL}/api/binance/fapi/v1/fundingRate?symbol=BTCUSDT&limit=1`
    },
    {
      name: '持仓量',
      url: `${VPS_URL}/api/binance/futures/data/openInterestHist?symbol=BTCUSDT&period=1h&limit=5`
    },
    {
      name: '24小时价格',
      url: `${VPS_URL}/api/binance/fapi/v1/ticker/24hr?symbol=BTCUSDT`
    }
  ];

  for (const test of tests) {
    try {
      console.log(`\n2. 测试 ${test.name}...`);
      const response = await fetch(test.url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ ${test.name} 测试通过`);

      // 显示部分数据
      if (Array.isArray(data)) {
        console.log(`   数据条数: ${data.length}`);
        if (data.length > 0) {
          console.log(`   第一条数据: ${JSON.stringify(data[0]).substring(0, 100)}...`);
        }
      } else {
        console.log(`   数据: ${JSON.stringify(data).substring(0, 100)}...`);
      }

    } catch (error) {
      console.log(`❌ ${test.name} 测试失败:`, error.message);
    }
  }

  // 测试速率限制
  console.log('\n3. 测试速率限制...');
  try {
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(fetch(`${VPS_URL}/api/binance/fapi/v1/klines?symbol=BTCUSDT&interval=1h&limit=1`));
    }

    const responses = await Promise.all(promises);
    const successCount = responses.filter(r => r.ok).length;
    console.log(`✅ 并发请求测试: ${successCount}/5 成功`);

  } catch (error) {
    console.log('❌ 并发请求测试失败:', error.message);
  }

  console.log('\n🎉 VPS 代理测试完成！');
}

// 运行测试
testProxy().catch(console.error);
