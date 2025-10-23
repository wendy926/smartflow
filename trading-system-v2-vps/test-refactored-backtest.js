/**
 * 重构后回测系统测试脚本
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:8080';

async function testRefactoredBacktest() {
  try {
    console.log('=== 重构后回测系统测试 ===');
    
    // 测试1: 健康检查
    console.log('\n1. 健康检查:');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log(healthResponse.data);
    
    // 测试2: 获取支持的策略列表
    console.log('\n2. 获取支持的策略列表:');
    const strategiesResponse = await axios.get(`${BASE_URL}/api/v1/backtest/strategies`);
    console.log(strategiesResponse.data);
    
    // 测试3: 设置V3策略参数
    console.log('\n3. 设置V3策略参数:');
    const v3Params = {
      trend4HStrongThreshold: 0.6,
      trend4HModerateThreshold: 0.4,
      trend4HWeakThreshold: 0.2,
      entry15MStrongThreshold: 0.5,
      entry15MModerateThreshold: 0.3,
      entry15MWeakThreshold: 0.15,
      stopLossATRMultiplier: 0.5,
      takeProfitRatio: 3.0
    };
    
    try {
      const setV3ParamsResponse = await axios.post(`${BASE_URL}/api/v1/backtest/V3/BALANCED/parameters`, v3Params);
      console.log('V3参数设置结果:', setV3ParamsResponse.data);
    } catch (error) {
      console.log('V3参数设置失败:', error.response?.data || error.message);
    }
    
    // 测试4: 设置ICT策略参数
    console.log('\n4. 设置ICT策略参数:');
    const ictParams = {
      trend4HStrongThreshold: 0.6,
      trend4HModerateThreshold: 0.4,
      trend4HWeakThreshold: 0.2,
      entry15MStrongThreshold: 0.5,
      entry15MModerateThreshold: 0.3,
      entry15MWeakThreshold: 0.15,
      stopLossATRMultiplier: 0.5,
      takeProfitRatio: 3.0,
      liquiditySweepThreshold: 0.002,
      orderBlockStrength: 0.6,
      fairValueGapThreshold: 0.001,
      marketStructureBreakThreshold: 0.005
    };
    
    try {
      const setIctParamsResponse = await axios.post(`${BASE_URL}/api/v1/backtest/ICT/BALANCED/parameters`, ictParams);
      console.log('ICT参数设置结果:', setIctParamsResponse.data);
    } catch (error) {
      console.log('ICT参数设置失败:', error.response?.data || error.message);
    }
    
    // 测试5: 启动V3策略回测
    console.log('\n5. 启动V3策略回测:');
    try {
      const v3BacktestResponse = await axios.post(`${BASE_URL}/api/v1/backtest/V3/BALANCED`, {
        timeframe: '1h',
        startDate: '2025-04-25',
        endDate: '2025-10-22'
      });
      console.log('V3回测启动结果:', v3BacktestResponse.data);
    } catch (error) {
      console.log('V3回测启动失败:', error.response?.data || error.message);
    }
    
    // 测试6: 启动ICT策略回测
    console.log('\n6. 启动ICT策略回测:');
    try {
      const ictBacktestResponse = await axios.post(`${BASE_URL}/api/v1/backtest/ICT/BALANCED`, {
        timeframe: '1h',
        startDate: '2025-04-25',
        endDate: '2025-10-22'
      });
      console.log('ICT回测启动结果:', ictBacktestResponse.data);
    } catch (error) {
      console.log('ICT回测启动失败:', error.response?.data || error.message);
    }
    
    // 测试7: 获取回测结果
    console.log('\n7. 获取回测结果:');
    try {
      const resultsResponse = await axios.get(`${BASE_URL}/api/v1/backtest/V3`);
      console.log('V3回测结果:', resultsResponse.data);
    } catch (error) {
      console.log('获取V3回测结果失败:', error.response?.data || error.message);
    }
    
    try {
      const ictResultsResponse = await axios.get(`${BASE_URL}/api/v1/backtest/ICT`);
      console.log('ICT回测结果:', ictResultsResponse.data);
    } catch (error) {
      console.log('获取ICT回测结果失败:', error.response?.data || error.message);
    }
    
    console.log('\n=== 测试完成 ===');
    
  } catch (error) {
    console.error('测试失败:', error.response?.data || error.message);
  }
}

testRefactoredBacktest();
