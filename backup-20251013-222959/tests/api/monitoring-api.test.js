/**
 * 系统监控API单测 - 字段格式验证
 * 测试系统监控、统计数据和配置管理的API响应格式
 */

const request = require('supertest');
const express = require('express');

// 模拟API路由
const app = express();
app.use(express.json());

// 模拟中间件
const mockAuth = (req, res, next) => {
  req.user = { id: 1, role: 'user' };
  next();
};

// 模拟监控数据
const mockMonitoringData = {
  timestamp: new Date().toISOString(),
  system: {
    cpu_usage: 45.2,
    memory_usage: 62.1,
    disk_usage: 35.8,
    network_latency: 12.5,
    uptime: 86400 // 秒
  },
  api: {
    success_rate: 98.5,
    response_time: 150.2,
    error_rate: 1.5,
    total_requests: 15000,
    requests_per_minute: 250
  },
  strategy: {
    v3_success_rate: 87.3,
    ict_success_rate: 82.1,
    data_collection_rate: 95.8,
    active_symbols: 8,
    total_judgments: 1200,
    judgments_per_minute: 20
  },
  database: {
    connection_pool: 8,
    query_time: 25.3,
    cache_hit_rate: 94.2,
    slow_queries: 5,
    deadlocks: 0
  },
  redis: {
    memory_usage: 45.6,
    hit_rate: 96.8,
    connected_clients: 12,
    keyspace_hits: 50000,
    keyspace_misses: 1500
  }
};

// 模拟统计数据
const mockStatisticsData = {
  symbol: 'BTCUSDT',
  period: '30d',
  trades: {
    total: 150,
    win: 95,
    loss: 55,
    win_rate: 63.33,
    avg_trade_duration: 2.5 // 小时
  },
  performance: {
    total_profit: 1250.75,
    max_profit: 350.25,
    max_drawdown: -180.25,
    sharpe_ratio: 1.85,
    sortino_ratio: 2.12,
    calmar_ratio: 0.95
  },
  risk: {
    max_risk_per_trade: 0.02,
    avg_risk_per_trade: 0.015,
    risk_reward_ratio: 1.8,
    var_95: -50.25,
    cvar_95: -75.30
  },
  timeframes: {
    '1D': { trades: 45, win_rate: 66.67, profit: 450.25 },
    '4H': { trades: 60, win_rate: 61.67, profit: 380.50 },
    '1H': { trades: 30, win_rate: 60.00, profit: 200.75 },
    '15m': { trades: 15, win_rate: 53.33, profit: 119.25 }
  },
  strategies: {
    'V3': { trades: 80, win_rate: 65.00, profit: 750.50 },
    'ICT': { trades: 70, win_rate: 61.43, profit: 500.25 }
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

// 模拟配置数据
const mockConfigData = {
  key: 'strategy_refresh_interval',
  value: '300000',
  type: 'number',
  description: '策略刷新间隔（毫秒）',
  category: 'strategy',
  is_editable: true,
  validation: {
    min: 60000,
    max: 600000,
    pattern: '^\\d+$'
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

// 设置路由
app.get('/api/v1/monitoring', mockAuth, (req, res) => {
  res.json({
    success: true,
    data: mockMonitoringData,
    timestamp: new Date().toISOString(),
    meta: {
      monitoring_interval: 60000,
      alert_thresholds: {
        cpu: 60,
        memory: 60,
        disk: 80,
        error_rate: 5
      },
      last_alert: null
    }
  });
});

app.get('/api/v1/statistics/:symbol', mockAuth, (req, res) => {
  const { symbol } = req.params;
  const { period = '30d', strategy, timeframe } = req.query;

  if (symbol !== 'BTCUSDT') {
    return res.status(404).json({
      success: false,
      error: 'Statistics not found for symbol',
      code: 'STATISTICS_NOT_FOUND',
      symbol: symbol,
      timestamp: new Date().toISOString()
    });
  }

  let statistics = { ...mockStatisticsData };
  statistics.symbol = symbol;
  statistics.period = period;

  // 策略过滤
  if (strategy) {
    statistics.strategies = { [strategy]: statistics.strategies[strategy] || {} };
  }

  // 时间级别过滤
  if (timeframe) {
    statistics.timeframes = { [timeframe]: statistics.timeframes[timeframe] || {} };
  }

  res.json({
    success: true,
    data: statistics,
    symbol: symbol,
    period: period,
    timestamp: new Date().toISOString(),
    meta: {
      available_periods: ['7d', '30d', '90d', '1y'],
      available_strategies: ['V3', 'ICT'],
      available_timeframes: ['1D', '4H', '1H', '15m'],
      last_updated: new Date().toISOString()
    }
  });
});

app.get('/api/v1/config/:key', mockAuth, (req, res) => {
  const { key } = req.params;

  if (key !== 'strategy_refresh_interval') {
    return res.status(404).json({
      success: false,
      error: 'Configuration not found',
      code: 'CONFIG_NOT_FOUND',
      key: key,
      timestamp: new Date().toISOString()
    });
  }

  res.json({
    success: true,
    data: mockConfigData,
    key: key,
    timestamp: new Date().toISOString()
  });
});

app.put('/api/v1/config/:key', mockAuth, (req, res) => {
  const { key } = req.params;
  const { value, description } = req.body;

  if (key !== 'strategy_refresh_interval') {
    return res.status(404).json({
      success: false,
      error: 'Configuration not found',
      code: 'CONFIG_NOT_FOUND',
      key: key,
      timestamp: new Date().toISOString()
    });
  }

  // 验证值
  if (value && !/^\d+$/.test(value)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid value format',
      code: 'INVALID_VALUE_FORMAT',
      expected_format: 'number',
      provided_value: value,
      timestamp: new Date().toISOString()
    });
  }

  const updatedConfig = {
    ...mockConfigData,
    value: value || mockConfigData.value,
    description: description || mockConfigData.description,
    updated_at: new Date().toISOString()
  };

  res.json({
    success: true,
    data: updatedConfig,
    message: 'Configuration updated successfully',
    key: key,
    timestamp: new Date().toISOString()
  });
});

describe('系统监控API - 字段格式验证', () => {
  describe('GET /api/v1/monitoring', () => {
    it('应该返回系统监控的完整格式', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring')
        .expect(200);

      // 验证响应结构
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('meta');

      // 验证监控数据结构
      const monitoring = response.body.data;
      expect(monitoring).toHaveProperty('timestamp');
      expect(monitoring).toHaveProperty('system');
      expect(monitoring).toHaveProperty('api');
      expect(monitoring).toHaveProperty('strategy');
      expect(monitoring).toHaveProperty('database');
      expect(monitoring).toHaveProperty('redis');

      // 验证系统指标
      expect(monitoring.system).toHaveProperty('cpu_usage');
      expect(monitoring.system).toHaveProperty('memory_usage');
      expect(monitoring.system).toHaveProperty('disk_usage');
      expect(monitoring.system).toHaveProperty('network_latency');
      expect(monitoring.system).toHaveProperty('uptime');

      // 验证API指标
      expect(monitoring.api).toHaveProperty('success_rate');
      expect(monitoring.api).toHaveProperty('response_time');
      expect(monitoring.api).toHaveProperty('error_rate');
      expect(monitoring.api).toHaveProperty('total_requests');
      expect(monitoring.api).toHaveProperty('requests_per_minute');

      // 验证策略指标
      expect(monitoring.strategy).toHaveProperty('v3_success_rate');
      expect(monitoring.strategy).toHaveProperty('ict_success_rate');
      expect(monitoring.strategy).toHaveProperty('data_collection_rate');
      expect(monitoring.strategy).toHaveProperty('active_symbols');
      expect(monitoring.strategy).toHaveProperty('total_judgments');
      expect(monitoring.strategy).toHaveProperty('judgments_per_minute');

      // 验证数据库指标
      expect(monitoring.database).toHaveProperty('connection_pool');
      expect(monitoring.database).toHaveProperty('query_time');
      expect(monitoring.database).toHaveProperty('cache_hit_rate');
      expect(monitoring.database).toHaveProperty('slow_queries');
      expect(monitoring.database).toHaveProperty('deadlocks');

      // 验证Redis指标
      expect(monitoring.redis).toHaveProperty('memory_usage');
      expect(monitoring.redis).toHaveProperty('hit_rate');
      expect(monitoring.redis).toHaveProperty('connected_clients');
      expect(monitoring.redis).toHaveProperty('keyspace_hits');
      expect(monitoring.redis).toHaveProperty('keyspace_misses');

      // 验证字段类型
      expect(typeof monitoring.system.cpu_usage).toBe('number');
      expect(typeof monitoring.system.memory_usage).toBe('number');
      expect(typeof monitoring.system.disk_usage).toBe('number');
      expect(typeof monitoring.system.network_latency).toBe('number');
      expect(typeof monitoring.system.uptime).toBe('number');
      expect(typeof monitoring.api.success_rate).toBe('number');
      expect(typeof monitoring.api.response_time).toBe('number');
      expect(typeof monitoring.api.error_rate).toBe('number');
      expect(typeof monitoring.api.total_requests).toBe('number');
      expect(typeof monitoring.api.requests_per_minute).toBe('number');
    });
  });

  describe('GET /api/v1/statistics/:symbol', () => {
    it('应该返回交易对统计的完整格式', async () => {
      const response = await request(app)
        .get('/api/v1/statistics/BTCUSDT')
        .expect(200);

      // 验证响应结构
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('symbol', 'BTCUSDT');
      expect(response.body).toHaveProperty('period', '30d');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('meta');

      // 验证统计数据格式
      const statistics = response.body.data;
      expect(statistics).toHaveProperty('symbol', 'BTCUSDT');
      expect(statistics).toHaveProperty('period', '30d');
      expect(statistics).toHaveProperty('trades');
      expect(statistics).toHaveProperty('performance');
      expect(statistics).toHaveProperty('risk');
      expect(statistics).toHaveProperty('timeframes');
      expect(statistics).toHaveProperty('strategies');
      expect(statistics).toHaveProperty('created_at');
      expect(statistics).toHaveProperty('updated_at');

      // 验证交易统计
      expect(statistics.trades).toHaveProperty('total');
      expect(statistics.trades).toHaveProperty('win');
      expect(statistics.trades).toHaveProperty('loss');
      expect(statistics.trades).toHaveProperty('win_rate');
      expect(statistics.trades).toHaveProperty('avg_trade_duration');

      // 验证性能统计
      expect(statistics.performance).toHaveProperty('total_profit');
      expect(statistics.performance).toHaveProperty('max_profit');
      expect(statistics.performance).toHaveProperty('max_drawdown');
      expect(statistics.performance).toHaveProperty('sharpe_ratio');
      expect(statistics.performance).toHaveProperty('sortino_ratio');
      expect(statistics.performance).toHaveProperty('calmar_ratio');

      // 验证风险统计
      expect(statistics.risk).toHaveProperty('max_risk_per_trade');
      expect(statistics.risk).toHaveProperty('avg_risk_per_trade');
      expect(statistics.risk).toHaveProperty('risk_reward_ratio');
      expect(statistics.risk).toHaveProperty('var_95');
      expect(statistics.risk).toHaveProperty('cvar_95');

      // 验证时间级别统计
      expect(statistics.timeframes).toHaveProperty('1D');
      expect(statistics.timeframes).toHaveProperty('4H');
      expect(statistics.timeframes).toHaveProperty('1H');
      expect(statistics.timeframes).toHaveProperty('15m');

      // 验证策略统计
      expect(statistics.strategies).toHaveProperty('V3');
      expect(statistics.strategies).toHaveProperty('ICT');

      // 验证字段类型
      expect(typeof statistics.trades.total).toBe('number');
      expect(typeof statistics.trades.win).toBe('number');
      expect(typeof statistics.trades.loss).toBe('number');
      expect(typeof statistics.trades.win_rate).toBe('number');
      expect(typeof statistics.performance.total_profit).toBe('number');
      expect(typeof statistics.performance.max_profit).toBe('number');
      expect(typeof statistics.performance.max_drawdown).toBe('number');
      expect(typeof statistics.performance.sharpe_ratio).toBe('number');
      expect(typeof statistics.risk.max_risk_per_trade).toBe('number');
      expect(typeof statistics.risk.avg_risk_per_trade).toBe('number');
      expect(typeof statistics.risk.risk_reward_ratio).toBe('number');
    });

    it('应该支持按周期过滤', async () => {
      const response = await request(app)
        .get('/api/v1/statistics/BTCUSDT?period=7d')
        .expect(200);

      expect(response.body.period).toBe('7d');
      expect(response.body.data.period).toBe('7d');
    });

    it('应该支持按策略过滤', async () => {
      const response = await request(app)
        .get('/api/v1/statistics/BTCUSDT?strategy=V3')
        .expect(200);

      expect(response.body.data.strategies).toHaveProperty('V3');
      expect(response.body.data.strategies).not.toHaveProperty('ICT');
    });

    it('应该支持按时间级别过滤', async () => {
      const response = await request(app)
        .get('/api/v1/statistics/BTCUSDT?timeframe=4H')
        .expect(200);

      expect(response.body.data.timeframes).toHaveProperty('4H');
      expect(response.body.data.timeframes).not.toHaveProperty('1D');
    });

    it('应该返回404当交易对不存在', async () => {
      const response = await request(app)
        .get('/api/v1/statistics/INVALID')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Statistics not found for symbol');
      expect(response.body.code).toBe('STATISTICS_NOT_FOUND');
      expect(response.body.symbol).toBe('INVALID');
    });
  });

  describe('GET /api/v1/config/:key', () => {
    it('应该返回配置的完整格式', async () => {
      const response = await request(app)
        .get('/api/v1/config/strategy_refresh_interval')
        .expect(200);

      // 验证响应结构
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('key', 'strategy_refresh_interval');
      expect(response.body).toHaveProperty('timestamp');

      // 验证配置数据格式
      const config = response.body.data;
      expect(config).toHaveProperty('key', 'strategy_refresh_interval');
      expect(config).toHaveProperty('value');
      expect(config).toHaveProperty('type');
      expect(config).toHaveProperty('description');
      expect(config).toHaveProperty('category');
      expect(config).toHaveProperty('is_editable');
      expect(config).toHaveProperty('validation');
      expect(config).toHaveProperty('created_at');
      expect(config).toHaveProperty('updated_at');

      // 验证验证规则
      expect(config.validation).toHaveProperty('min');
      expect(config.validation).toHaveProperty('max');
      expect(config.validation).toHaveProperty('pattern');

      // 验证字段类型
      expect(typeof config.value).toBe('string');
      expect(typeof config.type).toBe('string');
      expect(typeof config.description).toBe('string');
      expect(typeof config.category).toBe('string');
      expect(typeof config.is_editable).toBe('boolean');
      expect(typeof config.validation.min).toBe('number');
      expect(typeof config.validation.max).toBe('number');
      expect(typeof config.validation.pattern).toBe('string');
    });

    it('应该返回404当配置不存在', async () => {
      const response = await request(app)
        .get('/api/v1/config/invalid_key')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Configuration not found');
      expect(response.body.code).toBe('CONFIG_NOT_FOUND');
      expect(response.body.key).toBe('invalid_key');
    });
  });

  describe('PUT /api/v1/config/:key', () => {
    it('应该更新配置', async () => {
      const updateData = {
        value: '600000',
        description: 'Updated strategy refresh interval'
      };

      const response = await request(app)
        .put('/api/v1/config/strategy_refresh_interval')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.value).toBe('600000');
      expect(response.body.data.description).toBe('Updated strategy refresh interval');
      expect(response.body.message).toBe('Configuration updated successfully');
    });

    it('应该返回404当配置不存在', async () => {
      const response = await request(app)
        .put('/api/v1/config/invalid_key')
        .send({ value: 'test' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Configuration not found');
      expect(response.body.code).toBe('CONFIG_NOT_FOUND');
    });

    it('应该返回400当值格式无效', async () => {
      const response = await request(app)
        .put('/api/v1/config/strategy_refresh_interval')
        .send({ value: 'invalid' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid value format');
      expect(response.body.code).toBe('INVALID_VALUE_FORMAT');
      expect(response.body.expected_format).toBe('number');
      expect(response.body.provided_value).toBe('invalid');
    });
  });
});
