/**
 * 交易API路由单元测试
 */

const request = require('supertest');
const express = require('express');
const tradesRoutes = require('../../../src/api/routes/trades');
const TradeManager = require('../../../src/core/trade-manager');
const dbOps = require('../../../src/database/operations');

// 模拟依赖
jest.mock('../../../src/core/trade-manager');
jest.mock('../../../src/database/operations');
jest.mock('../../../src/utils/logger');

describe('Trades API Routes', () => {
  let app;
  let mockTradeManager;

  beforeEach(() => {
    jest.clearAllMocks();

    // 创建Express应用
    app = express();
    app.use(express.json());
    app.use('/api/v1/trades', tradesRoutes);

    // 模拟TradeManager
    mockTradeManager = {
      getTrades: jest.fn(),
      createTrade: jest.fn(),
      closeTrade: jest.fn(),
      getTradeStatistics: jest.fn(),
      canCreateTrade: jest.fn(),
      getActiveTrade: jest.fn(),
      getAllActiveTrades: jest.fn(),
      getCooldownStatus: jest.fn(),
      autoCloseTrades: jest.fn()
    };

    // 替换模块实例
    TradeManager.mockImplementation(() => mockTradeManager);
  });

  describe('GET /api/v1/trades', () => {
    it('应该返回交易记录列表', async () => {
      const mockTrades = [
        {
          id: 1,
          symbol: 'BTCUSDT',
          strategy_type: 'V3',
          direction: 'LONG',
          entry_price: 50000,
          status: 'ACTIVE'
        },
        {
          id: 2,
          symbol: 'ETHUSDT',
          strategy_type: 'ICT',
          direction: 'SHORT',
          entry_price: 3500,
          status: 'CLOSED'
        }
      ];

      dbOps.getTrades.mockResolvedValue(mockTrades);

      const response = await request(app)
        .get('/api/v1/trades')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockTrades);
      expect(dbOps.getTrades).toHaveBeenCalledWith(null, null, null);
    });

    it('应该支持查询参数过滤', async () => {
      const mockTrades = [
        {
          id: 1,
          symbol: 'BTCUSDT',
          strategy_type: 'V3',
          direction: 'LONG',
          entry_price: 50000,
          status: 'ACTIVE'
        }
      ];

      dbOps.getTrades.mockResolvedValue(mockTrades);

      const response = await request(app)
        .get('/api/v1/trades?strategy=V3&symbol=BTCUSDT&limit=10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(dbOps.getTrades).toHaveBeenCalledWith('V3', 'BTCUSDT', 10);
    });

    it('应该处理数据库错误', async () => {
      dbOps.getTrades.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/v1/trades')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database error');
    });
  });

  describe('POST /api/v1/trades', () => {
    it('应该成功创建新交易', async () => {
      const tradeData = {
        symbol: 'BTCUSDT',
        strategy_type: 'V3',
        direction: 'LONG',
        entry_price: 50000,
        stop_loss: 49000,
        take_profit: 52000,
        leverage: 10,
        position_size: 0.01,
        entry_reason: '测试交易'
      };

      const mockResult = {
        success: true,
        data: { id: 1 },
        message: '模拟交易创建成功'
      };

      mockTradeManager.createTrade.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/trades')
        .send(tradeData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({ id: 1 });
      expect(mockTradeManager.createTrade).toHaveBeenCalledWith(tradeData);
    });

    it('应该拒绝无效的交易数据', async () => {
      const invalidData = {
        symbol: 'BTCUSDT'
        // 缺少其他必需字段
      };

      const response = await request(app)
        .post('/api/v1/trades')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('交易数据不完整');
    });

    it('应该处理创建失败', async () => {
      const tradeData = {
        symbol: 'BTCUSDT',
        strategy_type: 'V3',
        direction: 'LONG',
        entry_price: 50000,
        stop_loss: 49000,
        take_profit: 52000,
        leverage: 10,
        position_size: 0.01,
        entry_reason: '测试交易'
      };

      const mockResult = {
        success: false,
        error: '该交易对和策略已有活跃交易'
      };

      mockTradeManager.createTrade.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/trades')
        .send(tradeData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('该交易对和策略已有活跃交易');
    });
  });

  describe('POST /api/v1/trades/:id/close', () => {
    it('应该成功关闭交易', async () => {
      const closeData = {
        exit_price: 51000,
        exit_reason: 'MANUAL'
      };

      const mockResult = {
        success: true,
        data: { id: 1 },
        message: '模拟交易关闭成功'
      };

      mockTradeManager.closeTrade.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/trades/1/close')
        .send(closeData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({ id: 1 });
      expect(mockTradeManager.closeTrade).toHaveBeenCalledWith(1, closeData);
    });

    it('应该拒绝无效的关闭数据', async () => {
      const response = await request(app)
        .post('/api/v1/trades/1/close')
        .send({}) // 缺少exit_price
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('退出价格不能为空');
    });

    it('应该处理关闭失败', async () => {
      const closeData = {
        exit_price: 51000,
        exit_reason: 'MANUAL'
      };

      const mockResult = {
        success: false,
        error: '交易记录不存在'
      };

      mockTradeManager.closeTrade.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/trades/999/close')
        .send(closeData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('交易记录不存在');
    });
  });

  describe('GET /api/v1/trades/statistics', () => {
    it('应该返回交易统计信息', async () => {
      const mockStats = {
        totalTrades: 100,
        winningTrades: 60,
        losingTrades: 40,
        winRate: 60,
        totalPnL: 1000,
        averagePnL: 10,
        bestTrade: 100,
        worstTrade: -50,
        averagePnLPercentage: 2.5
      };

      mockTradeManager.getTradeStatistics.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/v1/trades/statistics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
      expect(mockTradeManager.getTradeStatistics).toHaveBeenCalledWith(undefined, undefined);
    });

    it('应该支持查询参数过滤', async () => {
      const mockStats = {
        totalTrades: 50,
        winningTrades: 30,
        losingTrades: 20,
        winRate: 60,
        totalPnL: 500,
        averagePnL: 10,
        bestTrade: 50,
        worstTrade: -25,
        averagePnLPercentage: 2.5
      };

      mockTradeManager.getTradeStatistics.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/v1/trades/statistics?strategy=V3&symbol=BTCUSDT')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockTradeManager.getTradeStatistics).toHaveBeenCalledWith('V3', 'BTCUSDT');
    });
  });

  describe('GET /api/v1/trades/check-creation', () => {
    it('应该检查交易创建条件', async () => {
      const mockResult = {
        canCreate: true,
        reason: '可以创建交易'
      };

      mockTradeManager.canCreateTrade.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/v1/trades/check-creation?symbol=BTCUSDT&strategy=V3')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockTradeManager.canCreateTrade).toHaveBeenCalledWith('BTCUSDT', 'V3');
    });

    it('应该拒绝缺少参数的请求', async () => {
      const response = await request(app)
        .get('/api/v1/trades/check-creation?symbol=BTCUSDT')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('交易对和策略参数不能为空');
    });
  });

  describe('GET /api/v1/trades/active', () => {
    it('应该返回所有活跃交易', async () => {
      const mockTrades = [
        {
          id: 1,
          symbol: 'BTCUSDT',
          strategy_type: 'V3',
          direction: 'LONG',
          entry_price: 50000,
          status: 'ACTIVE'
        }
      ];

      mockTradeManager.getAllActiveTrades.mockResolvedValue(mockTrades);

      const response = await request(app)
        .get('/api/v1/trades/active')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockTrades);
      expect(response.body.count).toBe(1);
      expect(mockTradeManager.getAllActiveTrades).toHaveBeenCalled();
    });

    it('应该支持按交易对和策略过滤', async () => {
      const mockTrade = {
        id: 1,
        symbol: 'BTCUSDT',
        strategy_type: 'V3',
        direction: 'LONG',
        entry_price: 50000,
        status: 'ACTIVE'
      };

      mockTradeManager.getActiveTrade.mockResolvedValue(mockTrade);

      const response = await request(app)
        .get('/api/v1/trades/active?symbol=BTCUSDT&strategy=V3')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([mockTrade]);
      expect(response.body.count).toBe(1);
      expect(mockTradeManager.getActiveTrade).toHaveBeenCalledWith('BTCUSDT', 'V3');
    });
  });

  describe('GET /api/v1/trades/cooldown-status', () => {
    it('应该返回冷却时间状态', async () => {
      const mockStatus = {
        canCreate: false,
        remainingTime: 180000, // 3分钟
        lastTradeTime: new Date(Date.now() - 120000) // 2分钟前
      };

      mockTradeManager.getCooldownStatus.mockReturnValue(mockStatus);

      const response = await request(app)
        .get('/api/v1/trades/cooldown-status?symbol=BTCUSDT&strategy=V3')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStatus);
      expect(mockTradeManager.getCooldownStatus).toHaveBeenCalledWith('BTCUSDT', 'V3');
    });

    it('应该拒绝缺少参数的请求', async () => {
      const response = await request(app)
        .get('/api/v1/trades/cooldown-status?symbol=BTCUSDT')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('交易对和策略参数不能为空');
    });
  });

  describe('POST /api/v1/trades/auto-close', () => {
    it('应该自动关闭达到条件的交易', async () => {
      const mockClosedTrades = [
        {
          id: 1,
          symbol: 'BTCUSDT',
          strategy_type: 'V3',
          direction: 'LONG',
          entry_price: 50000,
          take_profit: 51000,
          status: 'CLOSED'
        }
      ];

      mockTradeManager.autoCloseTrades.mockResolvedValue(mockClosedTrades);

      const response = await request(app)
        .post('/api/v1/trades/auto-close')
        .send({
          symbol: 'BTCUSDT',
          current_price: 51000
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockClosedTrades);
      expect(response.body.count).toBe(1);
      expect(response.body.message).toBe('自动关闭了 1 个交易');
      expect(mockTradeManager.autoCloseTrades).toHaveBeenCalledWith('BTCUSDT', 51000);
    });

    it('应该拒绝缺少参数的请求', async () => {
      const response = await request(app)
        .post('/api/v1/trades/auto-close')
        .send({
          symbol: 'BTCUSDT'
          // 缺少current_price
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('交易对和当前价格参数不能为空');
    });
  });
});
