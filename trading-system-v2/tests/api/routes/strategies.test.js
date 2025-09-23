/**
 * 策略API路由单测
 */

const request = require('supertest');
const express = require('express');
const strategiesRouter = require('../../../src/api/routes/strategies');

// Mock BinanceAPI
jest.mock('../../../src/api/binance-api', () => {
  return jest.fn().mockImplementation(() => ({
    getKlines: jest.fn().mockResolvedValue([
      [1640995200000, '50000', '51000', '49000', '50500', '1000', 1640995259999, '50000000', 100, '25000000', '25000000', '0'],
      [1640995260000, '50500', '51500', '49500', '51000', '1200', 1640995319999, '60000000', 120, '30000000', '30000000', '0']
    ]),
    getTicker24hr: jest.fn().mockResolvedValue({
      symbol: 'BTCUSDT',
      priceChange: '1000',
      priceChangePercent: '2.0',
      weightedAvgPrice: '50000',
      prevClosePrice: '49000',
      lastPrice: '50000',
      lastQty: '0.1',
      bidPrice: '49990',
      askPrice: '50010',
      openPrice: '49000',
      highPrice: '51000',
      lowPrice: '49000',
      volume: '1000',
      quoteVolume: '50000000',
      openTime: 1640995200000,
      closeTime: 1640995259999,
      firstId: 1,
      lastId: 100,
      count: 100
    }),
    getOpenInterestHist: jest.fn().mockResolvedValue([
      { symbol: 'BTCUSDT', sumOpenInterest: '1000000', sumOpenInterestValue: '50000000000', timestamp: 1640995200000 }
    ]),
    getPremiumIndex: jest.fn().mockResolvedValue({
      symbol: 'BTCUSDT',
      markPrice: '50000',
      indexPrice: '49950',
      estimatedSettlePrice: '49980',
      lastFundingRate: '0.0001',
      nextFundingTime: 1640995200000
    }),
    getDelta: jest.fn().mockResolvedValue({
      symbol: 'BTCUSDT',
      delta: 0.1,
      totalBuyVolume: 55000000,
      totalSellVolume: 45000000,
      totalVolume: 100000000
    })
  }));
});

// 创建测试应用
const app = express();
app.use(express.json());
app.use('/api/v1/strategies', strategiesRouter);

describe('策略API路由', () => {
  describe('GET /api/v1/strategies/status', () => {
    it('应该返回策略状态', async () => {
      const response = await request(app)
        .get('/api/v1/strategies/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('v3');
      expect(response.body.data).toHaveProperty('ict');
      expect(response.body.data).toHaveProperty('rolling');
      expect(response.body.data).toHaveProperty('timestamp');
    });
  });

  describe('POST /api/v1/strategies/v3/analyze', () => {
    it.skip('应该执行V3策略分析', async () => {
      const response = await request(app)
        .post('/api/v1/strategies/v3/analyze')
        .send({ symbol: 'BTCUSDT' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('strategy', 'V3');
      expect(response.body.data).toHaveProperty('signal');
      expect(response.body.data).toHaveProperty('timeframes');
    });

    it.skip('应该处理分析错误', async () => {
      // 模拟策略执行失败
      const originalExecute = require('../../../src/strategies/v3-strategy').prototype.execute;
      require('../../../src/strategies/v3-strategy').prototype.execute = jest.fn().mockRejectedValue(new Error('分析失败'));

      const response = await request(app)
        .post('/api/v1/strategies/v3/analyze')
        .send({ symbol: 'INVALID' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('分析失败');

      // 恢复原始方法
      require('../../../src/strategies/v3-strategy').prototype.execute = originalExecute;
    });
  });

  describe('POST /api/v1/strategies/ict/analyze', () => {
    it.skip('应该执行ICT策略分析', async () => {
      const response = await request(app)
        .post('/api/v1/strategies/ict/analyze')
        .send({ symbol: 'BTCUSDT' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('strategy', 'ICT');
      expect(response.body.data).toHaveProperty('signal');
      expect(response.body.data).toHaveProperty('timeframe');
    });
  });

  describe('POST /api/v1/strategies/rolling/calculate', () => {
    it('应该执行滚仓计算', async () => {
      const params = {
        principal: 1000,
        initialLeverage: 50,
        entryPrice: 50000,
        currentPrice: 51000
      };

      const response = await request(app)
        .post('/api/v1/strategies/rolling/calculate')
        .send(params)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('strategy', 'ROLLING');
      expect(response.body.data).toHaveProperty('signal');
      expect(response.body.data).toHaveProperty('parameters');
    });
  });

  describe('POST /api/v1/strategies/batch-analyze', () => {
    it.skip('应该批量执行策略分析', async () => {
      const response = await request(app)
        .post('/api/v1/strategies/batch-analyze')
        .send({ symbols: ['BTCUSDT', 'ETHUSDT'] })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toHaveProperty('symbol', 'BTCUSDT');
      expect(response.body.data[0]).toHaveProperty('v3');
      expect(response.body.data[0]).toHaveProperty('ict');
    });

    it.skip('应该处理部分分析失败', async () => {
      // 模拟部分策略执行失败
      const originalExecute = require('../../../src/strategies/v3-strategy').prototype.execute;
      require('../../../src/strategies/v3-strategy').prototype.execute = jest.fn()
        .mockResolvedValueOnce({ strategy: 'V3', signal: 'BUY' })
        .mockRejectedValueOnce(new Error('V3分析失败'));

      const response = await request(app)
        .post('/api/v1/strategies/batch-analyze')
        .send({ symbols: ['BTCUSDT', 'ETHUSDT'] })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toHaveProperty('v3');
      expect(response.body.data[1]).toHaveProperty('error', 'V3分析失败');

      // 恢复原始方法
      require('../../../src/strategies/v3-strategy').prototype.execute = originalExecute;
    });
  });
});
