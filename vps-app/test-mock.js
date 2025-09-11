#!/usr/bin/env node

/**
 * 测试mock设置
 */

// Mock BinanceAPI
jest.mock('./modules/api/BinanceAPI');
const BinanceAPI = require('./modules/api/BinanceAPI');

async function testMock() {
  console.log('🔍 测试BinanceAPI mock设置...');

  // 创建测试数据
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

  // 设置mock
  BinanceAPI.getKlines.mockImplementation((symbol, interval, limit) => {
    console.log(`Mock getKlines called: ${symbol}, ${interval}, ${limit}`);
    if (interval === '1h') {
      return Promise.resolve(mockKlines1h);
    }
    return Promise.resolve(mockKlines1h);
  });

  BinanceAPI.get24hrTicker.mockResolvedValue({
    lastPrice: '3100',
    volume: '1000000'
  });

  BinanceAPI.getFundingRate.mockResolvedValue({
    fundingRate: '0.0001'
  });

  BinanceAPI.getOpenInterestHist.mockResolvedValue([
    { openInterest: '1000000', timestamp: 1640995200000 },
    { openInterest: '1050000', timestamp: 1641000000000 }
  ]);

  try {
    // 测试mock调用
    const result = await BinanceAPI.getKlines('ETHUSDT', '1h', 50);
    console.log('Mock getKlines result:', result);
    console.log('Result type:', typeof result);
    console.log('Result length:', result ? result.length : 'undefined');

    if (result && result.length > 0) {
      console.log('First kline:', result[0]);
      console.log('Last kline:', result[result.length - 1]);
    }

  } catch (error) {
    console.error('Mock test failed:', error);
  }
}

// 运行测试
testMock().catch(console.error);
