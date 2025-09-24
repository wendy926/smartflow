/**
 * 策略API路由单元测试
 */

const request = require('supertest');
const express = require('express');
const strategiesRoutes = require('../../../src/api/routes/strategies');
const V3Strategy = require('../../../src/strategies/v3-strategy');
const ICTStrategy = require('../../../src/strategies/ict-strategy');
const dbOps = require('../../../src/database/operations');

// 模拟依赖
jest.mock('../../../src/strategies/v3-strategy');
jest.mock('../../../src/strategies/ict-strategy');
jest.mock('../../../src/database/operations');
jest.mock('../../../src/utils/logger');

describe('Strategies API Routes', () => {
  let app;
  let mockV3Strategy;
  let mockICTStrategy;

  beforeEach(() => {
    jest.clearAllMocks();

    // 创建Express应用
    app = express();
    app.use(express.json());
    app.use('/api/v1/strategies', strategiesRoutes);

    // 模拟策略实例
    mockV3Strategy = {
      execute: jest.fn(),
      analyze4HTrend: jest.fn(),
      analyze1HFactors: jest.fn(),
      analyze15mExecution: jest.fn()
    };

    mockICTStrategy = {
      execute: jest.fn(),
      analyzeDailyTrend: jest.fn(),
      detectOrderBlocks: jest.fn(),
      detectEngulfingPattern: jest.fn(),
      detectSweepLTF: jest.fn()
    };

    // 替换模块实例
    V3Strategy.mockImplementation(() => mockV3Strategy);
    ICTStrategy.mockImplementation(() => mockICTStrategy);
  });

  describe('GET /api/v1/strategies/status', () => {
    it('应该返回策略状态', async () => {
      const response = await request(app)
        .get('/api/v1/strategies/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('v3');
      expect(response.body.data).toHaveProperty('ict');
      expect(response.body.data.v3.status).toBe('active');
      expect(response.body.data.ict.status).toBe('active');
    });
  });

  describe('POST /api/v1/strategies/v3/analyze', () => {
    it('应该成功执行V3策略分析', async () => {
      const mockResult = {
        success: true,
        data: {
          symbol: 'BTCUSDT',
          trend: 'UP',
          signal: 'BUY',
          score: 85.5,
          factors: {
            trend4H: { direction: 'UP', score: 8 },
            factors1H: { score: 7.5 },
            execution15M: { signal: 'BUY', score: 8.5 }
          }
        }
      };

      mockV3Strategy.execute.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/strategies/v3/analyze')
        .send({ symbol: 'BTCUSDT' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult.data);
      expect(mockV3Strategy.execute).toHaveBeenCalledWith('BTCUSDT');
    });

    it('应该拒绝缺少交易对参数的请求', async () => {
      const response = await request(app)
        .post('/api/v1/strategies/v3/analyze')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('交易对参数不能为空');
    });

    it('应该处理策略执行错误', async () => {
      const mockResult = {
        success: false,
        error: '策略执行失败'
      };

      mockV3Strategy.execute.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/strategies/v3/analyze')
        .send({ symbol: 'BTCUSDT' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('策略执行失败');
    });
  });

  describe('POST /api/v1/strategies/ict/analyze', () => {
    it('应该成功执行ICT策略分析', async () => {
      const mockResult = {
        success: true,
        data: {
          symbol: 'BTCUSDT',
          trend: 'UP',
          signal: 'BUY',
          score: 82.0,
          factors: {
            dailyTrend: { direction: 'UP', score: 8 },
            orderBlocks: { count: 2, score: 7.5 },
            engulfingPattern: { detected: true, score: 8.5 },
            sweepLTF: { detected: true, score: 8.0 }
          }
        }
      };

      mockICTStrategy.execute.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/strategies/ict/analyze')
        .send({ symbol: 'BTCUSDT' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult.data);
      expect(mockICTStrategy.execute).toHaveBeenCalledWith('BTCUSDT');
    });

    it('应该拒绝缺少交易对参数的请求', async () => {
      const response = await request(app)
        .post('/api/v1/strategies/ict/analyze')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('交易对参数不能为空');
    });

    it('应该处理策略执行错误', async () => {
      const mockResult = {
        success: false,
        error: 'ICT策略执行失败'
      };

      mockICTStrategy.execute.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/strategies/ict/analyze')
        .send({ symbol: 'BTCUSDT' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('ICT策略执行失败');
    });
  });

  describe('POST /api/v1/strategies/batch-analyze', () => {
    it('应该成功执行批量策略分析', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT'];

      const mockV3Result = {
        success: true,
        data: {
          symbol: 'BTCUSDT',
          trend: 'UP',
          signal: 'BUY',
          score: 85.5
        }
      };

      const mockICTResult = {
        success: true,
        data: {
          symbol: 'BTCUSDT',
          trend: 'UP',
          signal: 'BUY',
          score: 82.0
        }
      };

      mockV3Strategy.execute.mockResolvedValue(mockV3Result);
      mockICTStrategy.execute.mockResolvedValue(mockICTResult);

      const response = await request(app)
        .post('/api/v1/strategies/batch-analyze')
        .send({ symbols })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('BTCUSDT');
      expect(response.body.data).toHaveProperty('ETHUSDT');
      expect(response.body.data.BTCUSDT).toHaveProperty('v3');
      expect(response.body.data.BTCUSDT).toHaveProperty('ict');
    });

    it('应该拒绝缺少交易对列表的请求', async () => {
      const response = await request(app)
        .post('/api/v1/strategies/batch-analyze')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('交易对列表不能为空');
    });

    it('应该处理部分策略执行失败', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT'];

      const mockV3Result = {
        success: true,
        data: {
          symbol: 'BTCUSDT',
          trend: 'UP',
          signal: 'BUY',
          score: 85.5
        }
      };

      const mockICTResult = {
        success: false,
        error: 'ICT策略执行失败'
      };

      mockV3Strategy.execute.mockResolvedValue(mockV3Result);
      mockICTStrategy.execute.mockResolvedValue(mockICTResult);

      const response = await request(app)
        .post('/api/v1/strategies/batch-analyze')
        .send({ symbols })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.BTCUSDT.v3).toEqual(mockV3Result.data);
      expect(response.body.data.BTCUSDT.ict).toEqual({ error: 'ICT策略执行失败' });
    });
  });

  describe('GET /api/v1/strategies/v3/judgments', () => {
    it('应该返回V3策略判断记录', async () => {
      const mockJudgments = [
        {
          id: 1,
          symbol: 'BTCUSDT',
          strategy_type: 'V3',
          timeframe: '4H',
          trend_direction: 'UP',
          score: 85.5,
          created_at: new Date()
        }
      ];

      dbOps.getStrategyJudgments.mockResolvedValue(mockJudgments);

      const response = await request(app)
        .get('/api/v1/strategies/v3/judgments')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockJudgments);
      expect(dbOps.getStrategyJudgments).toHaveBeenCalledWith('V3', undefined, undefined, undefined);
    });

    it('应该支持查询参数过滤', async () => {
      const mockJudgments = [
        {
          id: 1,
          symbol: 'BTCUSDT',
          strategy_type: 'V3',
          timeframe: '4H',
          trend_direction: 'UP',
          score: 85.5,
          created_at: new Date()
        }
      ];

      dbOps.getStrategyJudgments.mockResolvedValue(mockJudgments);

      const response = await request(app)
        .get('/api/v1/strategies/v3/judgments?symbol=BTCUSDT&timeframe=4H&limit=10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(dbOps.getStrategyJudgments).toHaveBeenCalledWith('V3', 'BTCUSDT', '4H', 10);
    });
  });

  describe('GET /api/v1/strategies/ict/judgments', () => {
    it('应该返回ICT策略判断记录', async () => {
      const mockJudgments = [
        {
          id: 1,
          symbol: 'BTCUSDT',
          strategy_type: 'ICT',
          timeframe: '1D',
          trend_direction: 'UP',
          score: 82.0,
          created_at: new Date()
        }
      ];

      dbOps.getStrategyJudgments.mockResolvedValue(mockJudgments);

      const response = await request(app)
        .get('/api/v1/strategies/ict/judgments')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockJudgments);
      expect(dbOps.getStrategyJudgments).toHaveBeenCalledWith('ICT', undefined, undefined, undefined);
    });
  });

  describe('GET /api/v1/strategies/statistics', () => {
    it('应该返回策略统计信息', async () => {
      const mockStats = {
        v3: {
          totalTrades: 100,
          winningTrades: 60,
          losingTrades: 40,
          winRate: 60,
          totalPnL: 1000,
          maxDrawdown: 5.5
        },
        ict: {
          totalTrades: 80,
          winningTrades: 48,
          losingTrades: 32,
          winRate: 60,
          totalPnL: 800,
          maxDrawdown: 4.2
        },
        overall: {
          totalTrades: 180,
          winningTrades: 108,
          losingTrades: 72,
          winRate: 60,
          totalPnL: 1800,
          maxDrawdown: 5.5
        }
      };

      dbOps.getStrategyStatistics.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/v1/strategies/statistics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
      expect(dbOps.getStrategyStatistics).toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/strategies/current-status', () => {
    it('应该返回策略当前状态', async () => {
      const mockSymbols = [
        {
          id: 1,
          symbol: 'BTCUSDT',
          last_price: 50000,
          price_change_24h: 2.5
        }
      ];

      const mockJudgments = [
        {
          symbol: 'BTCUSDT',
          strategy_type: 'V3',
          timeframe: '4H',
          trend_direction: 'UP',
          score: 85.5
        },
        {
          symbol: 'BTCUSDT',
          strategy_type: 'ICT',
          timeframe: '1D',
          trend_direction: 'UP',
          score: 82.0
        }
      ];

      dbOps.getAllSymbols.mockResolvedValue(mockSymbols);
      dbOps.getLatestJudgments.mockResolvedValue(mockJudgments);

      const response = await request(app)
        .get('/api/v1/strategies/current-status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('BTCUSDT');
      expect(response.body.data.BTCUSDT).toHaveProperty('v3');
      expect(response.body.data.BTCUSDT).toHaveProperty('ict');
    });
  });
});