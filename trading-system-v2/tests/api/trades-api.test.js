/**
 * 交易管理API单测 - 字段格式验证
 * 测试模拟交易CRUD接口的响应格式
 */

const request = require('supertest');
const express = require('express');
const { createMockTrade } = require('../setup');

// 模拟API路由
const app = express();
app.use(express.json());

// 模拟中间件
const mockAuth = (req, res, next) => {
  req.user = { id: 1, role: 'user' };
  next();
};

// 默认交易对列表
const defaultSymbols = ['BTCUSDT', 'ETHUSDT', 'ONDOUSDT', 'MKRUSDT', 'PENDLEUSDT', 'MPLUSDT', 'LINKUSDT', 'LDOUSDT'];
const strategies = ['V3', 'ICT'];

// 模拟交易数据
const mockTrades = [];

// 生成模拟交易数据
defaultSymbols.forEach((symbol, symbolIndex) => {
  strategies.forEach((strategy, strategyIndex) => {
    const trade = createMockTrade(symbol, strategy);
    trade.symbol = symbol;
    mockTrades.push(trade);
  });
});

// 设置路由
app.get('/api/v1/trades', mockAuth, (req, res) => {
  const { symbol, strategy, status, trade_type, page = 1, limit = 100 } = req.query;

  let filteredTrades = [...mockTrades];

  // 交易对过滤
  if (symbol) {
    filteredTrades = filteredTrades.filter(t => t.symbol === symbol);
  }

  // 策略过滤
  if (strategy) {
    filteredTrades = filteredTrades.filter(t => t.strategy_name === strategy.toUpperCase());
  }

  // 状态过滤
  if (status) {
    filteredTrades = filteredTrades.filter(t => t.status === status.toUpperCase());
  }

  // 交易类型过滤
  if (trade_type) {
    filteredTrades = filteredTrades.filter(t => t.trade_type === trade_type.toUpperCase());
  }

  // 分页
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + parseInt(limit);
  const paginatedTrades = filteredTrades.slice(startIndex, endIndex);

  res.json({
    success: true,
    data: paginatedTrades,
    total: filteredTrades.length,
    page: parseInt(page),
    limit: parseInt(limit),
    pages: Math.ceil(filteredTrades.length / limit),
    timestamp: new Date().toISOString(),
    meta: {
      available_symbols: defaultSymbols,
      available_strategies: strategies,
      available_statuses: ['OPEN', 'CLOSED', 'CANCELLED'],
      available_trade_types: ['LONG', 'SHORT'],
      total_open: filteredTrades.filter(t => t.status === 'OPEN').length,
      total_closed: filteredTrades.filter(t => t.status === 'CLOSED').length,
      total_pnl: filteredTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
    }
  });
});

app.get('/api/v1/trades/:id', mockAuth, (req, res) => {
  const { id } = req.params;
  const trade = mockTrades.find(t => t.id === parseInt(id));

  if (!trade) {
    return res.status(404).json({
      success: false,
      error: 'Trade not found',
      code: 'TRADE_NOT_FOUND',
      timestamp: new Date().toISOString()
    });
  }

  res.json({
    success: true,
    data: trade,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/v1/trades', mockAuth, (req, res) => {
  const {
    symbol_id,
    strategy_name,
    trade_type,
    entry_price,
    quantity,
    leverage,
    stop_loss,
    take_profit
  } = req.body;

  // 验证必填字段
  if (!symbol_id || !strategy_name || !trade_type || !entry_price || !quantity) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields',
      code: 'MISSING_FIELDS',
      details: {
        required: ['symbol_id', 'strategy_name', 'trade_type', 'entry_price', 'quantity'],
        provided: { symbol_id, strategy_name, trade_type, entry_price, quantity }
      },
      timestamp: new Date().toISOString()
    });
  }

  // 验证字段值
  if (!['V3', 'ICT'].includes(strategy_name)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid strategy_name value',
      code: 'INVALID_STRATEGY',
      valid_values: ['V3', 'ICT'],
      timestamp: new Date().toISOString()
    });
  }

  if (!['LONG', 'SHORT'].includes(trade_type)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid trade_type value',
      code: 'INVALID_TRADE_TYPE',
      valid_values: ['LONG', 'SHORT'],
      timestamp: new Date().toISOString()
    });
  }

  const newTrade = {
    id: mockTrades.length + 1,
    symbol_id: parseInt(symbol_id),
    symbol: 'BTCUSDT', // 默认交易对
    strategy_name: strategy_name,
    trade_type: trade_type,
    entry_price: parseFloat(entry_price),
    exit_price: null,
    quantity: parseFloat(quantity),
    leverage: parseInt(leverage) || 1,
    margin_used: parseFloat(entry_price) * parseFloat(quantity) / (parseInt(leverage) || 1),
    stop_loss: stop_loss ? parseFloat(stop_loss) : null,
    take_profit: take_profit ? parseFloat(take_profit) : null,
    pnl: 0,
    pnl_percentage: 0,
    status: 'OPEN',
    entry_time: new Date(),
    exit_time: null,
    created_at: new Date()
  };

  mockTrades.push(newTrade);

  res.status(201).json({
    success: true,
    data: newTrade,
    message: 'Trade created successfully',
    timestamp: new Date().toISOString()
  });
});

app.put('/api/v1/trades/:id', mockAuth, (req, res) => {
  const { id } = req.params;
  const {
    exit_price,
    status,
    pnl,
    pnl_percentage,
    stop_loss,
    take_profit
  } = req.body;

  const tradeIndex = mockTrades.findIndex(t => t.id === parseInt(id));
  if (tradeIndex === -1) {
    return res.status(404).json({
      success: false,
      error: 'Trade not found',
      code: 'TRADE_NOT_FOUND',
      timestamp: new Date().toISOString()
    });
  }

  // 验证状态值
  if (status && !['OPEN', 'CLOSED', 'CANCELLED'].includes(status)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid status value',
      code: 'INVALID_STATUS',
      valid_values: ['OPEN', 'CLOSED', 'CANCELLED'],
      timestamp: new Date().toISOString()
    });
  }

  // 更新字段
  if (exit_price !== undefined) mockTrades[tradeIndex].exit_price = parseFloat(exit_price);
  if (status) mockTrades[tradeIndex].status = status;
  if (pnl !== undefined) mockTrades[tradeIndex].pnl = parseFloat(pnl);
  if (pnl_percentage !== undefined) mockTrades[tradeIndex].pnl_percentage = parseFloat(pnl_percentage);
  if (stop_loss !== undefined) mockTrades[tradeIndex].stop_loss = stop_loss ? parseFloat(stop_loss) : null;
  if (take_profit !== undefined) mockTrades[tradeIndex].take_profit = take_profit ? parseFloat(take_profit) : null;

  // 如果状态变为CLOSED，设置退出时间
  if (status === 'CLOSED') {
    mockTrades[tradeIndex].exit_time = new Date();
  }

  res.json({
    success: true,
    data: mockTrades[tradeIndex],
    message: 'Trade updated successfully',
    timestamp: new Date().toISOString()
  });
});

app.delete('/api/v1/trades/:id', mockAuth, (req, res) => {
  const { id } = req.params;
  const tradeIndex = mockTrades.findIndex(t => t.id === parseInt(id));

  if (tradeIndex === -1) {
    return res.status(404).json({
      success: false,
      error: 'Trade not found',
      code: 'TRADE_NOT_FOUND',
      timestamp: new Date().toISOString()
    });
  }

  mockTrades.splice(tradeIndex, 1);

  res.json({
    success: true,
    message: 'Trade deleted successfully',
    timestamp: new Date().toISOString()
  });
});

describe('交易管理API - 字段格式验证', () => {
  describe('GET /api/v1/trades', () => {
    it('应该返回所有交易的完整格式', async () => {
      const response = await request(app)
        .get('/api/v1/trades')
        .expect(200);

      // 验证响应结构
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(response.body).toHaveProperty('pages');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('meta');

      // 验证数据格式
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // 验证每个交易的字段格式
      response.body.data.forEach(trade => {
        expect(trade).toHaveProperty('id');
        expect(trade).toHaveProperty('symbol_id');
        expect(trade).toHaveProperty('strategy_name');
        expect(trade).toHaveProperty('trade_type');
        expect(trade).toHaveProperty('entry_price');
        expect(trade).toHaveProperty('exit_price');
        expect(trade).toHaveProperty('quantity');
        expect(trade).toHaveProperty('leverage');
        expect(trade).toHaveProperty('margin_used');
        expect(trade).toHaveProperty('stop_loss');
        expect(trade).toHaveProperty('take_profit');
        expect(trade).toHaveProperty('pnl');
        expect(trade).toHaveProperty('pnl_percentage');
        expect(trade).toHaveProperty('status');
        expect(trade).toHaveProperty('entry_time');
        expect(trade).toHaveProperty('exit_time');
        expect(trade).toHaveProperty('created_at');

        // 验证字段类型
        expect(typeof trade.id).toBe('number');
        expect(typeof trade.symbol_id).toBe('number');
        expect(['V3', 'ICT']).toContain(trade.strategy_name);
        expect(['LONG', 'SHORT']).toContain(trade.trade_type);
        expect(typeof trade.entry_price).toBe('number');
        expect(trade.exit_price === null || typeof trade.exit_price === 'number').toBe(true);
        expect(typeof trade.quantity).toBe('number');
        expect(typeof trade.leverage).toBe('number');
        expect(typeof trade.margin_used).toBe('number');
        expect(trade.stop_loss === null || typeof trade.stop_loss === 'number').toBe(true);
        expect(trade.take_profit === null || typeof trade.take_profit === 'number').toBe(true);
        expect(typeof trade.pnl).toBe('number');
        expect(typeof trade.pnl_percentage).toBe('number');
        expect(['OPEN', 'CLOSED', 'CANCELLED']).toContain(trade.status);
        expect(typeof trade.entry_time).toBe('string');
        expect(trade.exit_time === null || typeof trade.exit_time === 'string').toBe(true);
        expect(typeof trade.created_at).toBe('string');
      });
    });

    it('应该支持按交易对过滤', async () => {
      const response = await request(app)
        .get('/api/v1/trades?symbol=BTCUSDT')
        .expect(200);

      expect(response.body.data.every(t => t.symbol === 'BTCUSDT')).toBe(true);
    });

    it('应该支持按策略过滤', async () => {
      const response = await request(app)
        .get('/api/v1/trades?strategy=V3')
        .expect(200);

      expect(response.body.data.every(t => t.strategy_name === 'V3')).toBe(true);
    });

    it('应该支持按状态过滤', async () => {
      const response = await request(app)
        .get('/api/v1/trades?status=OPEN')
        .expect(200);

      expect(response.body.data.every(t => t.status === 'OPEN')).toBe(true);
    });

    it('应该支持按交易类型过滤', async () => {
      const response = await request(app)
        .get('/api/v1/trades?trade_type=LONG')
        .expect(200);

      expect(response.body.data.every(t => t.trade_type === 'LONG')).toBe(true);
    });

    it('应该支持分页查询', async () => {
      const response = await request(app)
        .get('/api/v1/trades?page=1&limit=5')
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(5);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(5);
    });
  });

  describe('GET /api/v1/trades/:id', () => {
    it('应该返回指定交易的完整信息', async () => {
      const response = await request(app)
        .get('/api/v1/trades/1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(1);
      expect(response.body.data).toHaveProperty('symbol_id');
      expect(response.body.data).toHaveProperty('strategy_name');
      expect(response.body.data).toHaveProperty('trade_type');
      expect(response.body.data).toHaveProperty('entry_price');
      expect(response.body.data).toHaveProperty('status');
    });

    it('应该返回404当交易不存在', async () => {
      const response = await request(app)
        .get('/api/v1/trades/99999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Trade not found');
      expect(response.body.code).toBe('TRADE_NOT_FOUND');
    });
  });

  describe('POST /api/v1/trades', () => {
    it('应该创建新交易', async () => {
      const tradeData = {
        symbol_id: 1,
        strategy_name: 'V3',
        trade_type: 'LONG',
        entry_price: 50000.00,
        quantity: 0.1,
        leverage: 10,
        stop_loss: 49000.00,
        take_profit: 52000.00
      };

      const response = await request(app)
        .post('/api/v1/trades')
        .send(tradeData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.strategy_name).toBe('V3');
      expect(response.body.data.trade_type).toBe('LONG');
      expect(response.body.data.entry_price).toBe(50000.00);
      expect(response.body.data.quantity).toBe(0.1);
      expect(response.body.data.leverage).toBe(10);
      expect(response.body.data.stop_loss).toBe(49000.00);
      expect(response.body.data.take_profit).toBe(52000.00);
      expect(response.body.data.status).toBe('OPEN');
      expect(response.body.message).toBe('Trade created successfully');
    });

    it('应该返回400当缺少必填字段', async () => {
      const response = await request(app)
        .post('/api/v1/trades')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Missing required fields');
      expect(response.body.code).toBe('MISSING_FIELDS');
      expect(response.body.details).toHaveProperty('required');
      expect(response.body.details).toHaveProperty('provided');
    });

    it('应该返回400当策略名称无效', async () => {
      const response = await request(app)
        .post('/api/v1/trades')
        .send({
          symbol_id: 1,
          strategy_name: 'INVALID',
          trade_type: 'LONG',
          entry_price: 50000.00,
          quantity: 0.1
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid strategy_name value');
      expect(response.body.code).toBe('INVALID_STRATEGY');
      expect(response.body.valid_values).toEqual(['V3', 'ICT']);
    });

    it('应该返回400当交易类型无效', async () => {
      const response = await request(app)
        .post('/api/v1/trades')
        .send({
          symbol_id: 1,
          strategy_name: 'V3',
          trade_type: 'INVALID',
          entry_price: 50000.00,
          quantity: 0.1
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid trade_type value');
      expect(response.body.code).toBe('INVALID_TRADE_TYPE');
      expect(response.body.valid_values).toEqual(['LONG', 'SHORT']);
    });
  });

  describe('PUT /api/v1/trades/:id', () => {
    it('应该更新交易信息', async () => {
      const updateData = {
        exit_price: 51000.00,
        status: 'CLOSED',
        pnl: 100.00,
        pnl_percentage: 2.0
      };

      const response = await request(app)
        .put('/api/v1/trades/1')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.exit_price).toBe(51000.00);
      expect(response.body.data.status).toBe('CLOSED');
      expect(response.body.data.pnl).toBe(100.00);
      expect(response.body.data.pnl_percentage).toBe(2.0);
      expect(typeof response.body.data.exit_time).toBe('string');
      expect(response.body.message).toBe('Trade updated successfully');
    });

    it('应该返回404当交易不存在', async () => {
      const response = await request(app)
        .put('/api/v1/trades/99999')
        .send({ status: 'CLOSED' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Trade not found');
      expect(response.body.code).toBe('TRADE_NOT_FOUND');
    });

    it('应该返回400当状态无效', async () => {
      const response = await request(app)
        .put('/api/v1/trades/1')
        .send({ status: 'INVALID' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid status value');
      expect(response.body.code).toBe('INVALID_STATUS');
      expect(response.body.valid_values).toEqual(['OPEN', 'CLOSED', 'CANCELLED']);
    });
  });

  describe('DELETE /api/v1/trades/:id', () => {
    it('应该删除交易', async () => {
      const response = await request(app)
        .delete('/api/v1/trades/1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Trade deleted successfully');
    });

    it('应该返回404当交易不存在', async () => {
      const response = await request(app)
        .delete('/api/v1/trades/99999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Trade not found');
      expect(response.body.code).toBe('TRADE_NOT_FOUND');
    });
  });
});
