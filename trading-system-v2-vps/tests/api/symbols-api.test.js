/**
 * 交易对管理API单测 - 字段格式验证
 * 测试交易对CRUD接口的响应格式
 */

const request = require('supertest');
const express = require('express');
const { createMockSymbol } = require('../setup');

// 内存清理函数
const cleanupMemory = () => {
  if (global.gc) {
    global.gc();
  }
  // 清理可能的缓存
  if (global.gc) {
    global.gc();
  }
};

// 模拟API路由
const app = express();
app.use(express.json());

// 模拟中间件
const mockAuth = (req, res, next) => {
  req.user = { id: 1, role: 'user' };
  next();
};

// 默认交易对列表（Mock数据）
const defaultSymbols = ['BTCUSDT', 'ETHUSDT', 'ONDOUSDT', 'MKRUSDT', 'PENDLEUSDT', 'MPLUSDT', 'LINKUSDT', 'LDOUSDT'];

// 创建模拟交易对数据的函数 - 延迟创建避免内存泄漏
const createMockSymbols = () => defaultSymbols.map((symbol, index) => createMockSymbol(symbol));

// 设置路由
app.get('/api/v1/symbols', mockAuth, (req, res) => {
  const { page = 1, limit = 10, status, search } = req.query;

  // 每次请求时创建数据，避免内存累积
  const mockSymbols = createMockSymbols();
  let filteredSymbols = [...mockSymbols];

  // 状态过滤
  if (status) {
    filteredSymbols = filteredSymbols.filter(s => s.status === status);
  }

  // 搜索过滤
  if (search) {
    filteredSymbols = filteredSymbols.filter(s =>
      s.symbol.toLowerCase().includes(search.toLowerCase())
    );
  }

  // 分页
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + parseInt(limit);
  const paginatedSymbols = filteredSymbols.slice(startIndex, endIndex);

  res.json({
    success: true,
    data: paginatedSymbols,
    total: filteredSymbols.length,
    page: parseInt(page),
    limit: parseInt(limit),
    pages: Math.ceil(filteredSymbols.length / limit),
    timestamp: new Date().toISOString(),
    meta: {
      default_symbols: defaultSymbols,
      total_active: filteredSymbols.filter(s => s.status === 'ACTIVE').length,
      total_inactive: filteredSymbols.filter(s => s.status === 'INACTIVE').length
    }
  });
});

app.get('/api/v1/symbols/:symbol', mockAuth, (req, res) => {
  const { symbol } = req.params;
  const mockSymbols = createMockSymbols();
  const symbolData = mockSymbols.find(s => s.symbol === symbol);

  if (!symbolData) {
    return res.status(404).json({
      success: false,
      error: 'Symbol not found',
      code: 'SYMBOL_NOT_FOUND',
      timestamp: new Date().toISOString()
    });
  }

  res.json({
    success: true,
    data: symbolData,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/v1/symbols', mockAuth, (req, res) => {
  const { symbol, status = 'ACTIVE', funding_rate = 0.0001 } = req.body;
  const mockSymbols = createMockSymbols();

  // 验证必填字段
  if (!symbol) {
    return res.status(400).json({
      success: false,
      error: 'Symbol is required',
      code: 'MISSING_SYMBOL',
      timestamp: new Date().toISOString()
    });
  }

  // 检查是否已存在
  if (mockSymbols.find(s => s.symbol === symbol)) {
    return res.status(409).json({
      success: false,
      error: 'Symbol already exists',
      code: 'SYMBOL_EXISTS',
      timestamp: new Date().toISOString()
    });
  }

  const newSymbol = createMockSymbol(symbol);
  newSymbol.status = status;
  newSymbol.funding_rate = funding_rate;
  // 注意：这里只是模拟，实际不会持久化

  res.status(201).json({
    success: true,
    data: newSymbol,
    message: 'Symbol created successfully',
    timestamp: new Date().toISOString()
  });
});

app.put('/api/v1/symbols/:symbol', mockAuth, (req, res) => {
  const { symbol } = req.params;
  const { status, funding_rate, last_price, volume_24h, price_change_24h } = req.body;
  const mockSymbols = createMockSymbols();

  const symbolIndex = mockSymbols.findIndex(s => s.symbol === symbol);
  if (symbolIndex === -1) {
    return res.status(404).json({
      success: false,
      error: 'Symbol not found',
      code: 'SYMBOL_NOT_FOUND',
      timestamp: new Date().toISOString()
    });
  }

  // 更新字段 - 注意：这里只是模拟，实际不会持久化
  if (status) mockSymbols[symbolIndex].status = status;
  if (funding_rate !== undefined) mockSymbols[symbolIndex].funding_rate = funding_rate;
  if (last_price !== undefined) mockSymbols[symbolIndex].last_price = last_price;
  if (volume_24h !== undefined) mockSymbols[symbolIndex].volume_24h = volume_24h;
  if (price_change_24h !== undefined) mockSymbols[symbolIndex].price_change_24h = price_change_24h;

  mockSymbols[symbolIndex].updated_at = new Date();

  res.json({
    success: true,
    data: mockSymbols[symbolIndex],
    message: 'Symbol updated successfully',
    timestamp: new Date().toISOString()
  });
});

app.delete('/api/v1/symbols/:symbol', mockAuth, (req, res) => {
  const { symbol } = req.params;
  const mockSymbols = createMockSymbols();
  const symbolIndex = mockSymbols.findIndex(s => s.symbol === symbol);

  if (symbolIndex === -1) {
    return res.status(404).json({
      success: false,
      error: 'Symbol not found',
      code: 'SYMBOL_NOT_FOUND',
      timestamp: new Date().toISOString()
    });
  }

  // 注意：这里只是模拟，实际不会持久化
  mockSymbols.splice(symbolIndex, 1);

  res.json({
    success: true,
    message: 'Symbol deleted successfully',
    timestamp: new Date().toISOString()
  });
});

describe('交易对管理API - 字段格式验证', () => {
  // 每个测试前清理内存
  beforeEach(() => {
    cleanupMemory();
  });

  // 每个测试后清理内存
  afterEach(() => {
    cleanupMemory();
  });

  describe('GET /api/v1/symbols', () => {
    it('应该返回所有默认交易对的完整格式', async () => {
      const response = await request(app)
        .get('/api/v1/symbols')
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
      expect(response.body.data.length).toBe(8); // 8个默认交易对
      expect(response.body.total).toBe(8);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
      expect(response.body.pages).toBe(1);

      // 验证每个交易对的字段格式
      response.body.data.forEach(symbol => {
        expect(symbol).toHaveProperty('id');
        expect(symbol).toHaveProperty('symbol');
        expect(symbol).toHaveProperty('status');
        expect(symbol).toHaveProperty('funding_rate');
        expect(symbol).toHaveProperty('last_price');
        expect(symbol).toHaveProperty('volume_24h');
        expect(symbol).toHaveProperty('price_change_24h');
        expect(symbol).toHaveProperty('created_at');
        expect(symbol).toHaveProperty('updated_at');

        // 验证字段类型
        expect(typeof symbol.id).toBe('number');
        expect(typeof symbol.symbol).toBe('string');
        expect(['ACTIVE', 'INACTIVE', 'MAINTENANCE']).toContain(symbol.status);
        expect(typeof symbol.funding_rate).toBe('number');
        expect(typeof symbol.last_price).toBe('number');
        expect(typeof symbol.volume_24h).toBe('number');
        expect(typeof symbol.price_change_24h).toBe('number');
        expect(typeof symbol.created_at).toBe('string');
        expect(typeof symbol.updated_at).toBe('string');
      });

      // 验证包含所有默认交易对
      const symbols = response.body.data.map(s => s.symbol);
      expect(symbols).toEqual(expect.arrayContaining(defaultSymbols));
    });

    it('应该支持分页查询', async () => {
      const response = await request(app)
        .get('/api/v1/symbols?page=1&limit=3')
        .expect(200);

      expect(response.body.data.length).toBe(3);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(3);
      expect(response.body.pages).toBe(3); // 8个交易对，每页3个，共3页
    });

    it('应该支持状态过滤', async () => {
      const response = await request(app)
        .get('/api/v1/symbols?status=ACTIVE')
        .expect(200);

      expect(response.body.data.every(s => s.status === 'ACTIVE')).toBe(true);
    });

    it('应该支持搜索过滤', async () => {
      const response = await request(app)
        .get('/api/v1/symbols?search=BTC')
        .expect(200);

      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].symbol).toBe('BTCUSDT');
    });
  });

  describe('GET /api/v1/symbols/:symbol', () => {
    it('应该返回指定交易对的完整信息', async () => {
      const response = await request(app)
        .get('/api/v1/symbols/BTCUSDT')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.symbol).toBe('BTCUSDT');
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('funding_rate');
      expect(response.body.data).toHaveProperty('last_price');
      expect(response.body.data).toHaveProperty('volume_24h');
      expect(response.body.data).toHaveProperty('price_change_24h');
      expect(response.body.data).toHaveProperty('created_at');
      expect(response.body.data).toHaveProperty('updated_at');
    });

    it('应该返回404当交易对不存在', async () => {
      const response = await request(app)
        .get('/api/v1/symbols/INVALID')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Symbol not found');
      expect(response.body.code).toBe('SYMBOL_NOT_FOUND');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('POST /api/v1/symbols', () => {
    it('应该创建新交易对', async () => {
      const newSymbol = {
        symbol: 'TESTUSDT',
        status: 'ACTIVE',
        funding_rate: 0.0002
      };

      const response = await request(app)
        .post('/api/v1/symbols')
        .send(newSymbol)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.symbol).toBe('TESTUSDT');
      expect(response.body.data.status).toBe('ACTIVE');
      expect(response.body.data.funding_rate).toBe(0.0002);
      expect(response.body.message).toBe('Symbol created successfully');
    });

    it('应该返回400当缺少必填字段', async () => {
      const response = await request(app)
        .post('/api/v1/symbols')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Symbol is required');
      expect(response.body.code).toBe('MISSING_SYMBOL');
    });

    it('应该返回409当交易对已存在', async () => {
      const response = await request(app)
        .post('/api/v1/symbols')
        .send({ symbol: 'BTCUSDT' })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Symbol already exists');
      expect(response.body.code).toBe('SYMBOL_EXISTS');
    });
  });

  describe('PUT /api/v1/symbols/:symbol', () => {
    it('应该更新交易对信息', async () => {
      const updateData = {
        status: 'INACTIVE',
        funding_rate: 0.0003,
        last_price: 51000.00
      };

      const response = await request(app)
        .put('/api/v1/symbols/BTCUSDT')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('INACTIVE');
      expect(response.body.data.funding_rate).toBe(0.0003);
      expect(response.body.data.last_price).toBe(51000.00);
      expect(response.body.message).toBe('Symbol updated successfully');
    });

    it('应该返回404当交易对不存在', async () => {
      const response = await request(app)
        .put('/api/v1/symbols/INVALID')
        .send({ status: 'ACTIVE' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Symbol not found');
      expect(response.body.code).toBe('SYMBOL_NOT_FOUND');
    });
  });

  describe('DELETE /api/v1/symbols/:symbol', () => {
    it('应该删除交易对', async () => {
      const response = await request(app)
        .delete('/api/v1/symbols/BTCUSDT')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Symbol deleted successfully');
    });

    it('应该返回404当交易对不存在', async () => {
      const response = await request(app)
        .delete('/api/v1/symbols/INVALID')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Symbol not found');
      expect(response.body.code).toBe('SYMBOL_NOT_FOUND');
    });
  });
});
