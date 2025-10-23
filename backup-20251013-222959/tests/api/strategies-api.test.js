/**
 * 策略判断API单测 - 字段格式验证
 * 测试V3策略和ICT策略的API响应格式
 */

const request = require('supertest');
const express = require('express');
const { createMockJudgment } = require('../setup');

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
const timeframes = ['1D', '4H', '1H', '15M'];

// 模拟策略判断数据
const mockJudgments = [];

// 生成模拟判断数据
defaultSymbols.forEach((symbol, symbolIndex) => {
  timeframes.forEach((timeframe, tfIndex) => {
    // V3策略判断
    const v3Judgment = createMockJudgment(symbol, 'V3', timeframe);
    v3Judgment.symbol = symbol;
    mockJudgments.push(v3Judgment);
    // ICT策略判断
    const ictJudgment = createMockJudgment(symbol, 'ICT', timeframe);
    ictJudgment.symbol = symbol;
    mockJudgments.push(ictJudgment);
  });
});

// 设置路由
app.get('/api/v1/strategies/:strategy/judgments', mockAuth, (req, res) => {
  const { strategy } = req.params;
  const { symbol, timeframe, limit = 100, page = 1 } = req.query;

  let filteredJudgments = mockJudgments.filter(j => j.strategy_name === strategy.toUpperCase());

  // 交易对过滤
  if (symbol) {
    filteredJudgments = filteredJudgments.filter(j => j.symbol === symbol);
  }

  // 时间级别过滤
  if (timeframe) {
    filteredJudgments = filteredJudgments.filter(j => j.timeframe === timeframe);
  }

  // 分页
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + parseInt(limit);
  const paginatedJudgments = filteredJudgments.slice(startIndex, endIndex);

  res.json({
    success: true,
    data: paginatedJudgments,
    total: filteredJudgments.length,
    page: parseInt(page),
    limit: parseInt(limit),
    pages: Math.ceil(filteredJudgments.length / limit),
    strategy: strategy.toUpperCase(),
    timeframe: timeframe || 'all',
    timestamp: new Date().toISOString(),
    meta: {
      available_timeframes: timeframes,
      available_symbols: defaultSymbols,
      strategy_description: strategy.toUpperCase() === 'V3'
        ? 'Multi-factor trend following strategy'
        : 'ICT order block and liquidity strategy'
    }
  });
});

app.post('/api/v1/strategies/:strategy/judgments', mockAuth, (req, res) => {
  const { strategy } = req.params;
  const { symbol, timeframe, trend_direction, entry_signal, confidence_score, indicators_data } = req.body;

  // 验证必填字段
  if (!symbol || !timeframe || !trend_direction || !entry_signal) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields',
      code: 'MISSING_FIELDS',
      details: {
        required: ['symbol', 'timeframe', 'trend_direction', 'entry_signal'],
        provided: { symbol, timeframe, trend_direction, entry_signal }
      },
      timestamp: new Date().toISOString()
    });
  }

  // 验证字段值
  if (!['RANGE', 'UP', 'DOWN'].includes(trend_direction)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid trend_direction value',
      code: 'INVALID_TREND_DIRECTION',
      valid_values: ['RANGE', 'UP', 'DOWN'],
      timestamp: new Date().toISOString()
    });
  }

  if (!['BUY', 'SELL', 'HOLD'].includes(entry_signal)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid entry_signal value',
      code: 'INVALID_ENTRY_SIGNAL',
      valid_values: ['BUY', 'SELL', 'HOLD'],
      timestamp: new Date().toISOString()
    });
  }

  if (!['1D', '4H', '1H', '15M'].includes(timeframe)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid timeframe value',
      code: 'INVALID_TIMEFRAME',
      valid_values: ['1D', '4H', '1H', '15M'],
      timestamp: new Date().toISOString()
    });
  }

  const newJudgment = {
    id: mockJudgments.length + 1,
    symbol_id: 1,
    symbol: symbol,
    strategy_name: strategy.toUpperCase(),
    timeframe,
    trend_direction,
    entry_signal,
    confidence_score: confidence_score || 0,
    indicators_data: indicators_data || {},
    created_at: new Date()
  };

  mockJudgments.push(newJudgment);

  res.status(201).json({
    success: true,
    data: newJudgment,
    message: `${strategy.toUpperCase()} judgment created successfully`,
    timestamp: new Date().toISOString()
  });
});

describe('策略判断API - 字段格式验证', () => {
  describe('GET /api/v1/strategies/:strategy/judgments', () => {
    it('应该返回V3策略判断的完整格式', async () => {
      const response = await request(app)
        .get('/api/v1/strategies/v3/judgments')
        .expect(200);

      // 验证响应结构
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(response.body).toHaveProperty('pages');
      expect(response.body).toHaveProperty('strategy', 'V3');
      expect(response.body).toHaveProperty('timeframe', 'all');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('meta');

      // 验证数据格式
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data.every(j => j.strategy_name === 'V3')).toBe(true);

      // 验证每个判断的字段格式
      response.body.data.forEach(judgment => {
        expect(judgment).toHaveProperty('id');
        expect(judgment).toHaveProperty('symbol_id');
        expect(judgment).toHaveProperty('strategy_name', 'V3');
        expect(judgment).toHaveProperty('timeframe');
        expect(judgment).toHaveProperty('trend_direction');
        expect(judgment).toHaveProperty('entry_signal');
        expect(judgment).toHaveProperty('confidence_score');
        expect(judgment).toHaveProperty('indicators_data');
        expect(judgment).toHaveProperty('created_at');

        // 验证字段类型和值
        expect(typeof judgment.id).toBe('number');
        expect(typeof judgment.symbol_id).toBe('number');
        expect(['1D', '4H', '1H', '15M']).toContain(judgment.timeframe);
        expect(['RANGE', 'UP', 'DOWN']).toContain(judgment.trend_direction);
        expect(['BUY', 'SELL', 'HOLD']).toContain(judgment.entry_signal);
        expect(typeof judgment.confidence_score).toBe('number');
        expect(judgment.confidence_score).toBeGreaterThanOrEqual(0);
        expect(judgment.confidence_score).toBeLessThanOrEqual(100);
        expect(typeof judgment.indicators_data).toBe('object');
        expect(typeof judgment.created_at).toBe('string');
      });
    });

    it('应该返回ICT策略判断的完整格式', async () => {
      const response = await request(app)
        .get('/api/v1/strategies/ict/judgments')
        .expect(200);

      expect(response.body.strategy).toBe('ICT');
      expect(response.body.data.every(j => j.strategy_name === 'ICT')).toBe(true);
    });

    it('应该支持按交易对过滤', async () => {
      const response = await request(app)
        .get('/api/v1/strategies/v3/judgments?symbol=BTCUSDT')
        .expect(200);

      expect(response.body.data.every(j => j.symbol === 'BTCUSDT')).toBe(true);
    });

    it('应该支持按时间级别过滤', async () => {
      const response = await request(app)
        .get('/api/v1/strategies/v3/judgments?timeframe=4H')
        .expect(200);

      expect(response.body.data.every(j => j.timeframe === '4H')).toBe(true);
      expect(response.body.timeframe).toBe('4H');
    });

    it('应该支持分页查询', async () => {
      const response = await request(app)
        .get('/api/v1/strategies/v3/judgments?page=1&limit=5')
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(5);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(5);
    });
  });

  describe('POST /api/v1/strategies/:strategy/judgments', () => {
    it('应该创建V3策略判断', async () => {
      const judgmentData = {
        symbol: 'BTCUSDT',
        timeframe: '4H',
        trend_direction: 'UP',
        entry_signal: 'BUY',
        confidence_score: 85.5,
        indicators_data: {
          ma20: 49500,
          ma50: 49000,
          adx: 25.5,
          bbw: 0.05
        }
      };

      const response = await request(app)
        .post('/api/v1/strategies/v3/judgments')
        .send(judgmentData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.strategy_name).toBe('V3');
      expect(response.body.data.symbol).toBe('BTCUSDT');
      expect(response.body.data.timeframe).toBe('4H');
      expect(response.body.data.trend_direction).toBe('UP');
      expect(response.body.data.entry_signal).toBe('BUY');
      expect(response.body.data.confidence_score).toBe(85.5);
      expect(response.body.data.indicators_data).toEqual(judgmentData.indicators_data);
      expect(response.body.message).toBe('V3 judgment created successfully');
    });

    it('应该创建ICT策略判断', async () => {
      const judgmentData = {
        symbol: 'ETHUSDT',
        timeframe: '1D',
        trend_direction: 'DOWN',
        entry_signal: 'SELL',
        confidence_score: 78.2,
        indicators_data: {
          atr: 150.5,
          order_blocks: [],
          fvg: [],
          sweep_htf: false,
          engulfing: true
        }
      };

      const response = await request(app)
        .post('/api/v1/strategies/ict/judgments')
        .send(judgmentData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.strategy_name).toBe('ICT');
      expect(response.body.message).toBe('ICT judgment created successfully');
    });

    it('应该返回400当缺少必填字段', async () => {
      const response = await request(app)
        .post('/api/v1/strategies/v3/judgments')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Missing required fields');
      expect(response.body.code).toBe('MISSING_FIELDS');
      expect(response.body.details).toHaveProperty('required');
      expect(response.body.details).toHaveProperty('provided');
    });

    it('应该返回400当趋势方向无效', async () => {
      const response = await request(app)
        .post('/api/v1/strategies/v3/judgments')
        .send({
          symbol: 'BTCUSDT',
          timeframe: '4H',
          trend_direction: 'INVALID',
          entry_signal: 'BUY'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid trend_direction value');
      expect(response.body.code).toBe('INVALID_TREND_DIRECTION');
      expect(response.body.valid_values).toEqual(['RANGE', 'UP', 'DOWN']);
    });

    it('应该返回400当入场信号无效', async () => {
      const response = await request(app)
        .post('/api/v1/strategies/v3/judgments')
        .send({
          symbol: 'BTCUSDT',
          timeframe: '4H',
          trend_direction: 'UP',
          entry_signal: 'INVALID'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid entry_signal value');
      expect(response.body.code).toBe('INVALID_ENTRY_SIGNAL');
      expect(response.body.valid_values).toEqual(['BUY', 'SELL', 'HOLD']);
    });

    it('应该返回400当时间级别无效', async () => {
      const response = await request(app)
        .post('/api/v1/strategies/v3/judgments')
        .send({
          symbol: 'BTCUSDT',
          timeframe: 'INVALID',
          trend_direction: 'UP',
          entry_signal: 'BUY'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid timeframe value');
      expect(response.body.code).toBe('INVALID_TIMEFRAME');
      expect(response.body.valid_values).toEqual(['1D', '4H', '1H', '15M']);
    });
  });
});
