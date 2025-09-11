#!/usr/bin/env node

/**
 * 调试测试脚本
 * 用于验证analyze1HScoring方法的执行流程
 */

const { DataMonitor } = require('./modules/monitoring/DataMonitor');
const StrategyV3Core = require('./modules/strategy/StrategyV3Core');

async function debugAnalyze1HScoring() {
  console.log('🔍 开始调试analyze1HScoring方法...');
  
  // 创建实例
  const dataMonitor = new DataMonitor(null);
  const strategyCore = new StrategyV3Core();
  strategyCore.dataMonitor = dataMonitor;
  
  const symbol = 'ETHUSDT';
  
  // 创建测试数据
  const mockKlines1h = [];
  const basePrice = 3000;
  for (let i = 0; i < 50; i++) {
    const timestamp = 1640995200000 + i * 60 * 60 * 1000;
    const price = basePrice + i * 20;
    const closePrice = price + 10;
    mockKlines1h.push([
      timestamp,
      price.toString(),
      (closePrice + 5).toString(),
      (price - 5).toString(),
      closePrice.toString(),
      '1000'
    ]);
  }
  
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
  
  console.log('测试数据验证:', {
    lastClose,
    vwap: testVWAP,
    vwapDirectionConsistent: lastClose > testVWAP,
    candlesCount: testCandles.length
  });
  
  // Mock BinanceAPI
  const BinanceAPI = require('./modules/api/BinanceAPI');
  BinanceAPI.getKlines = jest.fn().mockImplementation((symbol, interval, limit) => {
    if (interval === '1h') {
      return Promise.resolve(mockKlines1h);
    }
    return Promise.resolve(mockKlines1h);
  });
  BinanceAPI.get24hrTicker = jest.fn().mockResolvedValue({
    lastPrice: '3100',
    volume: '1000000'
  });
  BinanceAPI.getFundingRate = jest.fn().mockResolvedValue({
    fundingRate: '0.0001'
  });
  BinanceAPI.getOpenInterestHist = jest.fn().mockResolvedValue([
    { openInterest: '1000000', timestamp: 1640995200000 },
    { openInterest: '1050000', timestamp: 1641000000000 }
  ]);
  
  try {
    const result = await strategyCore.analyze1HScoring(symbol, '多头趋势');
    console.log('analyze1HScoring结果:', result);
    
    const analysisLog = dataMonitor.getAnalysisLog(symbol);
    console.log('Analysis log:', JSON.stringify(analysisLog, null, 2));
    console.log('Indicators:', analysisLog.indicators);
    
    if (analysisLog.indicators['1H多因子打分']) {
      console.log('✅ 指标记录成功');
    } else {
      console.log('❌ 指标记录失败');
    }
  } catch (error) {
    console.error('测试执行失败:', error);
  }
}

// 运行调试
debugAnalyze1HScoring().catch(console.error);
