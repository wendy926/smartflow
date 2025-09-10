#!/usr/bin/env node

// 测试前端API调用

const https = require('https');

async function testAPI() {
  try {
    console.log('🔍 测试前端API调用...');

    // 测试模拟交易历史API
    const simulationHistory = await makeRequest('https://smart.aimaventop.com/api/simulation-history');
    console.log(`📊 模拟交易历史记录数: ${simulationHistory.length}`);

    if (simulationHistory.length > 0) {
      console.log('📋 前3条记录:');
      simulationHistory.slice(0, 3).forEach((sim, index) => {
        console.log(`  ${index + 1}. ${sim.symbol} ${sim.direction} ${sim.trigger_reason} -> ${sim.exit_reason || 'N/A'} (${sim.status})`);
      });
    }

    // 测试统计数据API
    const winRateStats = await makeRequest('https://smart.aimaventop.com/api/win-rate-stats');
    console.log(`\n📈 胜率统计:`, winRateStats);

    const directionStats = await makeRequest('https://smart.aimaventop.com/api/direction-stats');
    console.log(`📊 方向统计:`, directionStats);

    const symbolStats = await makeRequest('https://smart.aimaventop.com/api/symbol-stats');
    console.log(`📋 交易对统计记录数: ${symbolStats.length}`);

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; API-Test)'
      }
    };

    https.get(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          reject(new Error(`JSON解析失败: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

testAPI();
