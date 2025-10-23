/**
 * 工具API路由单元测试
 */

const request = require('supertest');
const express = require('express');
const toolsRoutes = require('../../../src/api/routes/tools');
const RollingStrategy = require('../../../src/strategies/rolling-strategy');

// 模拟依赖
jest.mock('../../../src/strategies/rolling-strategy');
jest.mock('../../../src/utils/logger');

describe('Tools API Routes', () => {
  let app;
  let mockRollingStrategy;

  beforeEach(() => {
    jest.clearAllMocks();

    // 创建Express应用
    app = express();
    app.use(express.json());
    app.use('/api/v1/tools', toolsRoutes);

    // 模拟RollingStrategy实例
    mockRollingStrategy = {
      calculate: jest.fn(),
      calculateDynamicRolling: jest.fn(),
      getRecommendedParameters: jest.fn()
    };

    // 替换模块实例
    RollingStrategy.mockImplementation(() => mockRollingStrategy);
  });

  describe('POST /api/v1/tools/rolling-calculator', () => {
    it('应该成功计算滚仓策略', async () => {
      const mockResult = {
        success: true,
        data: {
          principal: 10000,
          targetPrice: 60000,
          currentPrice: 50000,
          leverage: 10,
          positionSize: 0.2,
          marginRequired: 1000,
          riskAmount: 1000,
          potentialProfit: 2000,
          riskRewardRatio: 2.0
        }
      };

      mockRollingStrategy.calculate.mockResolvedValue(mockResult);

      const requestData = {
        principal: 10000,
        targetPrice: 60000,
        currentPrice: 50000,
        leverage: 10,
        riskPercentage: 10
      };

      const response = await request(app)
        .post('/api/v1/tools/rolling-calculator')
        .send(requestData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult.data);
      expect(mockRollingStrategy.calculate).toHaveBeenCalledWith(requestData);
    });

    it('应该拒绝无效的请求数据', async () => {
      const invalidData = {
        principal: 10000
        // 缺少其他必需字段
      };

      const response = await request(app)
        .post('/api/v1/tools/rolling-calculator')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('请求数据不完整');
    });

    it('应该处理计算错误', async () => {
      const mockResult = {
        success: false,
        error: '计算失败'
      };

      mockRollingStrategy.calculate.mockResolvedValue(mockResult);

      const requestData = {
        principal: 10000,
        targetPrice: 60000,
        currentPrice: 50000,
        leverage: 10,
        riskPercentage: 10
      };

      const response = await request(app)
        .post('/api/v1/tools/rolling-calculator')
        .send(requestData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('计算失败');
    });
  });

  describe('POST /api/v1/tools/dynamic-rolling-calculator', () => {
    it('应该成功计算动态滚仓策略', async () => {
      const mockResult = {
        success: true,
        data: {
          summary: {
            totalRolls: 5,
            finalLeverage: 2.5,
            totalProfit: 1500,
            maxDrawdown: 200,
            profitFactor: 7.5
          },
          history: [
            {
              roll: 1,
              price: 50000,
              leverage: 10,
              position: 0.2,
              profit: 200,
              principal: 1000
            },
            {
              roll: 2,
              price: 52000,
              leverage: 8,
              position: 0.15,
              profit: 300,
              principal: 1200
            }
          ]
        }
      };

      mockRollingStrategy.calculateDynamicRolling.mockResolvedValue(mockResult);

      const requestData = {
        principal: 10000,
        initialLeverage: 10,
        priceStart: 50000,
        priceTarget: 60000,
        triggerRatio: 0.1,
        leverageDecay: 0.2,
        profitLockRatio: 0.3,
        minLeverage: 1
      };

      const response = await request(app)
        .post('/api/v1/tools/dynamic-rolling-calculator')
        .send(requestData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult.data);
      expect(mockRollingStrategy.calculateDynamicRolling).toHaveBeenCalledWith(requestData);
    });

    it('应该拒绝无效的请求数据', async () => {
      const invalidData = {
        principal: 10000,
        initialLeverage: 10
        // 缺少其他必需字段
      };

      const response = await request(app)
        .post('/api/v1/tools/dynamic-rolling-calculator')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('请求数据不完整');
    });

    it('应该处理计算错误', async () => {
      const mockResult = {
        success: false,
        error: '动态滚仓计算失败'
      };

      mockRollingStrategy.calculateDynamicRolling.mockResolvedValue(mockResult);

      const requestData = {
        principal: 10000,
        initialLeverage: 10,
        priceStart: 50000,
        priceTarget: 60000,
        triggerRatio: 0.1,
        leverageDecay: 0.2,
        profitLockRatio: 0.3,
        minLeverage: 1
      };

      const response = await request(app)
        .post('/api/v1/tools/dynamic-rolling-calculator')
        .send(requestData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('动态滚仓计算失败');
    });
  });

  describe('GET /api/v1/tools/rolling-parameters', () => {
    it('应该返回推荐的滚仓参数', async () => {
      const mockParams = {
        conservative: {
          initialLeverage: 5,
          triggerRatio: 0.05,
          leverageDecay: 0.1,
          profitLockRatio: 0.2,
          minLeverage: 1
        },
        moderate: {
          initialLeverage: 10,
          triggerRatio: 0.1,
          leverageDecay: 0.2,
          profitLockRatio: 0.3,
          minLeverage: 1
        },
        aggressive: {
          initialLeverage: 20,
          triggerRatio: 0.15,
          leverageDecay: 0.3,
          profitLockRatio: 0.4,
          minLeverage: 2
        }
      };

      mockRollingStrategy.getRecommendedParameters.mockResolvedValue(mockParams);

      const response = await request(app)
        .get('/api/v1/tools/rolling-parameters')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockParams);
      expect(mockRollingStrategy.getRecommendedParameters).toHaveBeenCalled();
    });

    it('应该处理获取参数失败', async () => {
      mockRollingStrategy.getRecommendedParameters.mockRejectedValue(new Error('获取参数失败'));

      const response = await request(app)
        .get('/api/v1/tools/rolling-parameters')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('获取参数失败');
    });
  });

  describe('POST /api/v1/tools/risk-calculator', () => {
    it('应该成功计算风险参数', async () => {
      const mockResult = {
        success: true,
        data: {
          positionSize: 0.1,
          marginRequired: 500,
          riskAmount: 100,
          stopLossPrice: 49000,
          takeProfitPrice: 52000,
          riskRewardRatio: 2.0,
          maxLoss: 100,
          maxProfit: 200
        }
      };

      mockRollingStrategy.calculateRisk.mockResolvedValue(mockResult);

      const requestData = {
        accountBalance: 10000,
        riskPercentage: 1,
        entryPrice: 50000,
        stopLossPrice: 49000,
        takeProfitPrice: 52000,
        leverage: 10
      };

      const response = await request(app)
        .post('/api/v1/tools/risk-calculator')
        .send(requestData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult.data);
      expect(mockRollingStrategy.calculateRisk).toHaveBeenCalledWith(requestData);
    });

    it('应该拒绝无效的风险计算数据', async () => {
      const invalidData = {
        accountBalance: 10000
        // 缺少其他必需字段
      };

      const response = await request(app)
        .post('/api/v1/tools/risk-calculator')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('请求数据不完整');
    });
  });

  describe('GET /api/v1/tools/market-analysis', () => {
    it('应该返回市场分析结果', async () => {
      const mockAnalysis = {
        success: true,
        data: {
          symbol: 'BTCUSDT',
          trend: 'UP',
          volatility: 'HIGH',
          support: 48000,
          resistance: 52000,
          recommendation: 'BUY',
          confidence: 85.5,
          factors: {
            technical: 8.5,
            fundamental: 7.0,
            sentiment: 8.0
          }
        }
      };

      mockRollingStrategy.analyzeMarket.mockResolvedValue(mockAnalysis);

      const response = await request(app)
        .get('/api/v1/tools/market-analysis?symbol=BTCUSDT')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAnalysis.data);
      expect(mockRollingStrategy.analyzeMarket).toHaveBeenCalledWith('BTCUSDT');
    });

    it('应该拒绝缺少交易对参数的请求', async () => {
      const response = await request(app)
        .get('/api/v1/tools/market-analysis')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('交易对参数不能为空');
    });
  });
});
