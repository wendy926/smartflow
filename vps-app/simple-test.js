#!/usr/bin/env node

/**
 * 简化测试脚本
 * 用于验证analyze1HScoring方法的基本执行
 */

const { DataMonitor } = require('./modules/monitoring/DataMonitor');
const StrategyV3Core = require('./modules/strategy/StrategyV3Core');

async function simpleTest() {
  console.log('🔍 开始简化测试...');
  
  // 创建实例
  const dataMonitor = new DataMonitor(null);
  const strategyCore = new StrategyV3Core();
  strategyCore.dataMonitor = dataMonitor;
  
  const symbol = 'ETHUSDT';
  
  // 创建符合BinanceAPI格式的测试数据
  const mockKlines1h = [];
  const basePrice = 3000;
  for (let i = 0; i < 50; i++) {
    const timestamp = 1640995200000 + i * 60 * 60 * 1000;
    const price = basePrice + i * 50;
    const closePrice = price + 20;
    mockKlines1h.push([
      timestamp,
      price.toString(),
      (closePrice + 10).toString(),
      (price - 10).toString(),
      closePrice.toString(),
      '1000'
    ]);
  }
  
  console.log('测试数据长度:', mockKlines1h.length);
  console.log('最后一条数据:', mockKlines1h[mockKlines1h.length - 1]);
  
  // 手动计算VWAP
  const testCandles = mockKlines1h.slice(-20).map(k => ({
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5])
  }));
  
  const testVWAP = strategyCore.calculateVWAP(testCandles);
  const lastClose = testCandles[testCandles.length - 1].close;
  
  console.log('VWAP计算结果:', {
    lastClose,
    vwap: testVWAP,
    vwapDirectionConsistent: lastClose > testVWAP,
    candlesCount: testCandles.length
  });
  
  // 检查DataMonitor状态
  console.log('DataMonitor状态:', {
    hasDataMonitor: !!strategyCore.dataMonitor,
    dataMonitorType: typeof strategyCore.dataMonitor
  });
  
  // 测试recordIndicator方法
  try {
    dataMonitor.recordIndicator(symbol, '测试指标', {
      test: 'value',
      score: 100
    }, Date.now());
    
    const analysisLog = dataMonitor.getAnalysisLog(symbol);
    console.log('recordIndicator测试结果:', analysisLog);
  } catch (error) {
    console.error('recordIndicator测试失败:', error);
  }
}

// 运行测试
simpleTest().catch(console.error);
