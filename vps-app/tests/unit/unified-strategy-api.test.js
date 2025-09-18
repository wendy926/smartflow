const express = require('express');
const request = require('supertest');

// Under test
const UnifiedStrategyAPI = require('../../src/core/modules/api/UnifiedStrategyAPI');

// 完整的Mock数据库，兼容DatabaseManager接口
class MockDb {
  constructor() {
    this.rows = {
      custom_symbols: [{ symbol: 'BTCUSDT' }, { symbol: 'ETHUSDT' }],
      strategy_monitoring_stats: [
        {
          symbol: 'BTCUSDT',
          strategy_type: 'V3',
          data_collection_rate: 95.5,
          data_collection_attempts: 100,
          data_collection_successes: 95,
          data_validation_status: 'VALID',
          data_validation_errors: 0,
          data_validation_warnings: 2,
          simulation_completion_rate: 100,
          simulation_triggers: 10,
          simulation_completions: 10,
          overall_health: 'HEALTHY'
        },
        {
          symbol: 'BTCUSDT',
          strategy_type: 'ICT',
          data_collection_rate: 92.3,
          data_collection_attempts: 100,
          data_collection_successes: 92,
          data_validation_status: 'VALID',
          data_validation_errors: 0,
          data_validation_warnings: 1,
          simulation_completion_rate: 100,
          simulation_triggers: 8,
          simulation_completions: 8,
          overall_health: 'HEALTHY'
        }
      ],
      unified_simulations: [
        {
          id: 1,
          symbol: 'BTCUSDT',
          strategy_type: 'V3',
          entry_price: 45000.5,
          stop_loss_price: 44000,
          take_profit_price: 47000,
          max_leverage: 20,
          min_margin: 100,
          direction: 'LONG',
          status: 'CLOSED',
          trigger_reason: 'SIGNAL_TEST',
          created_at: new Date().toISOString(),
          closed_at: new Date().toISOString(),
          exit_price: 47000,
          exit_reason: 'TAKE_PROFIT',
          is_win: 1,
          profit_loss: 100.25,
        },
      ],
      monitoring_alerts: [
        {
          id: 1,
          symbol: 'BTCUSDT',
          strategy_type: 'V3',
          alert_type: 'DATA_QUALITY',
          severity: 'MEDIUM',
          message: 'test alert',
          details: JSON.stringify({}),
          resolved: 0,
          created_at: new Date().toISOString(),
        },
      ],
      data_refresh_status: [
        {
          symbol: 'BTCUSDT',
          strategy_type: 'V3',
          data_type: '4h_trend',
          last_refresh: null,
          next_refresh: null,
          should_refresh: 1,
          refresh_interval: 14400,
        },
        {
          symbol: 'BTCUSDT',
          strategy_type: 'ICT',
          data_type: 'daily_trend',
          last_refresh: null,
          next_refresh: null,
          should_refresh: 0,
          refresh_interval: 86400,
        },
      ],
    };
  }

  // 实现runQuery方法（DatabaseManager的主要接口）
  async runQuery(sql, params = []) {
    if (/SELECT\s+DISTINCT\s+symbol\s+FROM\s+custom_symbols/i.test(sql)) {
      return this.rows.custom_symbols;
    }
    if (/FROM\s+strategy_monitoring_stats/i.test(sql)) {
      return this.rows.strategy_monitoring_stats.filter(row => {
        if (params.length >= 2) {
          return row.symbol === params[0] && row.strategy_type === params[1];
        }
        return true;
      });
    }
    if (/FROM\s+monitoring_alerts/i.test(sql)) {
      return this.rows.monitoring_alerts;
    }
    if (/FROM\s+unified_simulations/i.test(sql)) {
      if (/COUNT\(\*\)/i.test(sql)) {
        return [{ total: this.rows.unified_simulations.length }];
      }
      if (/GROUP BY/i.test(sql)) {
        // stats queries
        return [];
      }
      return this.rows.unified_simulations;
    }
    if (/FROM\s+data_refresh_status/i.test(sql)) {
      return this.rows.data_refresh_status.filter(row => {
        if (params.length >= 1) {
          return row.symbol === params[0];
        }
        return true;
      });
    }
    if (/UPDATE\s+data_refresh_status/i.test(sql)) {
      return [{ changes: 1 }];
    }
    if (/UPDATE\s+monitoring_alerts/i.test(sql)) {
      const id = params[0];
      const row = this.rows.monitoring_alerts.find((a) => a.id === Number(id));
      if (row) row.resolved = 1;
      return [{ changes: row ? 1 : 0 }];
    }
    return [];
  }

  // 兼容旧接口
  async all(sql, params = []) {
    return this.runQuery(sql, params);
  }
  
  async get(sql, params = []) {
    const results = await this.runQuery(sql, params);
    return results[0] || {};
  }
  
  async run(sql, params = []) {
    const results = await this.runQuery(sql, params);
    return results[0] || { changes: 0 };
  }
}

function createAppWithUnifiedAPI() {
  const app = express();
  app.use(express.json());
  const db = new MockDb();
  const api = new UnifiedStrategyAPI(db);
  api.setupRoutes(app);
  return app;
}

describe('UnifiedStrategyAPI', () => {
  let app;
  beforeAll(() => {
    app = createAppWithUnifiedAPI();
  });

  test('GET /api/unified-monitoring/dashboard returns success', async () => {
    const res = await request(app).get('/api/unified-monitoring/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.summary).toBeDefined();
  });

  test('GET /api/data-refresh/status returns structured data', async () => {
    const res = await request(app).get('/api/data-refresh/status');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.v3Strategy).toBeDefined();
    expect(res.body.data.ictStrategy).toBeDefined();
  });

  test('POST /api/data-refresh/force-refresh/:symbol works', async () => {
    const res = await request(app)
      .post('/api/data-refresh/force-refresh/BTCUSDT')
      .send({ strategyType: 'V3', dataType: '4h_trend' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('GET /api/unified-simulations/history returns simulations with strategyType', async () => {
    const res = await request(app).get('/api/unified-simulations/history?page=1&pageSize=10');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.simulations.length).toBeGreaterThan(0);
    expect(res.body.data.simulations[0].strategyType).toBe('V3');
  });

  test('GET /api/monitoring/alerts returns alerts', async () => {
    const res = await request(app).get('/api/monitoring/alerts?page=1&pageSize=10');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.alerts.length).toBeGreaterThanOrEqual(0);
  });

  test('POST /api/monitoring/alerts/:id/resolve resolves alert', async () => {
    const res = await request(app).post('/api/monitoring/alerts/1/resolve');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
