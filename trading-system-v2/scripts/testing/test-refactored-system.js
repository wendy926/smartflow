/**
 * 重构后系统测试脚本
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:8080';

async function testRefactoredSystem() {
  try {
    console.log('=== 重构后系统测试 ===');

    // 测试1: 健康检查
    console.log('\n1. 健康检查:');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log(healthResponse.data);

    // 测试2: 获取支持的策略列表
    console.log('\n2. 获取支持的策略列表:');
    const strategiesResponse = await axios.get(`${BASE_URL}/api/v1/backtest/strategies`);
    console.log(strategiesResponse.data);

    // 测试3: 获取支持的时间框架
    console.log('\n3. 获取支持的时间框架:');
    const timeframesResponse = await axios.get(`${BASE_URL}/api/v1/backtest/timeframes`);
    console.log(timeframesResponse.data);

    // 测试4: 设置V3策略参数
    console.log('\n4. 设置V3策略参数:');
    const setParamsResponse = await axios.post(`${BASE_URL}/api/v1/backtest/V3/BALANCED/parameters`, {
      trend4HStrongThreshold: 0.6,
      trend4HModerateThreshold: 0.4,
      trend4HWeakThreshold: 0.2,
      entry15MStrongThreshold: 0.5,
      entry15MModerateThreshold: 0.3,
      entry15MWeakThreshold: 0.15,
      stopLossATRMultiplier: 0.5,
      takeProfitRatio: 3.0
    });
    console.log(setParamsResponse.data);

    // 测试5: 获取V3策略参数
    console.log('\n5. 获取V3策略参数:');
    const getParamsResponse = await axios.get(`${BASE_URL}/api/v1/backtest/V3/BALANCED/parameters`);
    console.log(getParamsResponse.data);

    // 测试6: 启动V3策略回测
    console.log('\n6. 启动V3策略回测:');
    const backtestResponse = await axios.post(`${BASE_URL}/api/v1/backtest/V3/BALANCED`, {
      timeframe: '1h',
      startDate: '2025-04-25',
      endDate: '2025-10-22'
    });
    console.log(backtestResponse.data);

    // 测试7: 获取回测结果
    console.log('\n7. 获取回测结果:');
    const resultsResponse = await axios.get(`${BASE_URL}/api/v1/backtest/V3`);
    console.log(resultsResponse.data);

    console.log('\n=== 测试完成 ===');

  } catch (error) {
    console.error('测试失败:', error.response?.data || error.message);
  }
}

testRefactoredSystem();
