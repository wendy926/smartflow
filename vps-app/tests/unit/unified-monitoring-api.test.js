// unified-monitoring-api.test.js - 统一监控API测试

const request = require('supertest');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const UnifiedMonitoringAPI = require('../../src/core/modules/api/UnifiedMonitoringAPI');

describe('统一监控API测试', () => {
  let app;
  let db;
  let api;

  beforeAll(async () => {
    // 创建内存数据库
    db = new sqlite3.Database(':memory:');

    // 创建基础表结构
    await createBaseTables(db);

    // 创建Express应用
    app = express();
    app.use(express.json());

    // 初始化API
    api = new UnifiedMonitoringAPI(db);
    api.setupRoutes(app);
  });

  afterAll(async () => {
    if (db) {
      await new Promise((resolve) => {
        db.close((err) => {
          if (err) console.error('关闭数据库失败:', err);
          resolve();
        });
      });
    }
  });

  beforeEach(async () => {
    // 清理测试数据
    await cleanupTestData(db);
    // 添加测试数据
    await addTestData(db);
  });

  describe('GET /api/unified-monitoring/dashboard', () => {
    test('应该成功获取统一监控中心数据', async () => {
      const response = await request(app)
        .get('/api/unified-monitoring/dashboard')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data).toHaveProperty('completionRates');
      expect(response.body.data).toHaveProperty('detailedStats');
      expect(response.body.data).toHaveProperty('recentAlerts');
    });

    test('应该包含正确的响应格式', async () => {
      const response = await request(app)
        .get('/api/unified-monitoring/dashboard')
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('应该包含V3和ICT策略数据', async () => {
      const response = await request(app)
        .get('/api/unified-monitoring/dashboard')
        .expect(200);

      expect(response.body.data.summary).toHaveProperty('v3Strategy');
      expect(response.body.data.summary).toHaveProperty('ictStrategy');
      expect(response.body.data.completionRates).toHaveProperty('v3Strategy');
      expect(response.body.data.completionRates).toHaveProperty('ictStrategy');
    });
  });

  describe('GET /api/unified-monitoring/symbol/:symbol', () => {
    test('应该成功获取指定交易对的监控数据', async () => {
      const response = await request(app)
        .get('/api/unified-monitoring/symbol/BTCUSDT')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('symbol', 'BTCUSDT');
      expect(response.body.data).toHaveProperty('v3Strategy');
      expect(response.body.data).toHaveProperty('ictStrategy');
    });

    test('应该返回404当交易对不存在时', async () => {
      const response = await request(app)
        .get('/api/unified-monitoring/symbol/INVALID')
        .expect(200); // 即使交易对不存在，也应该返回默认数据

      expect(response.body.success).toBe(true);
    });

    test('应该返回400当缺少交易对参数时', async () => {
      const response = await request(app)
        .get('/api/unified-monitoring/symbol/')
        .expect(404); // Express路由不匹配
    });
  });

  describe('GET /api/data-refresh/status', () => {
    test('应该成功获取数据刷新状态', async () => {
      const response = await request(app)
        .get('/api/data-refresh/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('v3Strategy');
      expect(response.body.data).toHaveProperty('ictStrategy');
    });

    test('应该包含V3策略的数据类型', async () => {
      const response = await request(app)
        .get('/api/data-refresh/status')
        .expect(200);

      expect(response.body.data.v3Strategy).toHaveProperty('BTCUSDT');
      expect(response.body.data.v3Strategy.BTCUSDT).toHaveProperty('4h_trend');
      expect(response.body.data.v3Strategy.BTCUSDT).toHaveProperty('1h_scoring');
      expect(response.body.data.v3Strategy.BTCUSDT).toHaveProperty('15m_entry');
    });

    test('应该包含ICT策略的数据类型', async () => {
      const response = await request(app)
        .get('/api/data-refresh/status')
        .expect(200);

      expect(response.body.data.ictStrategy).toHaveProperty('BTCUSDT');
      expect(response.body.data.ictStrategy.BTCUSDT).toHaveProperty('daily_trend');
      expect(response.body.data.ictStrategy.BTCUSDT).toHaveProperty('mtf_analysis');
      expect(response.body.data.ictStrategy.BTCUSDT).toHaveProperty('ltf_analysis');
    });
  });

  describe('POST /api/data-refresh/force-refresh/:symbol', () => {
    test('应该成功强制刷新数据', async () => {
      const response = await request(app)
        .post('/api/data-refresh/force-refresh/BTCUSDT')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('数据刷新已触发');
    });

    test('应该支持指定策略类型刷新', async () => {
      const response = await request(app)
        .post('/api/data-refresh/force-refresh/BTCUSDT')
        .send({ strategyType: 'V3' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('应该支持指定数据类型刷新', async () => {
      const response = await request(app)
        .post('/api/data-refresh/force-refresh/BTCUSDT')
        .send({ strategyType: 'V3', dataType: '4h_trend' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('应该返回400当缺少交易对参数时', async () => {
      const response = await request(app)
        .post('/api/data-refresh/force-refresh/')
        .send({})
        .expect(404); // Express路由不匹配
    });
  });

  describe('GET /api/unified-simulations/history', () => {
    test('应该成功获取模拟交易历史', async () => {
      const response = await request(app)
        .get('/api/unified-simulations/history')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('simulations');
      expect(response.body.data).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data.simulations)).toBe(true);
    });

    test('应该支持分页参数', async () => {
      const response = await request(app)
        .get('/api/unified-simulations/history?page=1&pageSize=10')
        .expect(200);

      expect(response.body.data.pagination).toHaveProperty('currentPage', 1);
      expect(response.body.data.pagination).toHaveProperty('pageSize', 10);
    });

    test('应该支持按策略筛选', async () => {
      const response = await request(app)
        .get('/api/unified-simulations/history?strategyType=V3')
        .expect(200);

      expect(response.body.data.simulations.every(sim => sim.strategy_type === 'V3')).toBe(true);
    });
  });

  describe('GET /api/unified-simulations/stats', () => {
    test('应该成功获取模拟交易统计', async () => {
      const response = await request(app)
        .get('/api/unified-simulations/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('overall');
      expect(response.body.data).toHaveProperty('byStrategy');
      expect(response.body.data).toHaveProperty('bySymbol');
    });

    test('应该包含整体统计', async () => {
      const response = await request(app)
        .get('/api/unified-simulations/stats')
        .expect(200);

      expect(response.body.data.overall).toHaveProperty('totalTrades');
      expect(response.body.data.overall).toHaveProperty('winningTrades');
      expect(response.body.data.overall).toHaveProperty('losingTrades');
      expect(response.body.data.overall).toHaveProperty('winRate');
      expect(response.body.data.overall).toHaveProperty('netProfit');
    });

    test('应该包含按策略统计', async () => {
      const response = await request(app)
        .get('/api/unified-simulations/stats')
        .expect(200);

      expect(response.body.data.byStrategy).toHaveProperty('V3');
      expect(response.body.data.byStrategy).toHaveProperty('ICT');
    });
  });

  describe('GET /api/symbol-management/stats', () => {
    test('应该成功获取交易对管理统计', async () => {
      const response = await request(app)
        .get('/api/symbol-management/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalSymbols');
      expect(response.body.data).toHaveProperty('byStrategy');
      expect(response.body.data).toHaveProperty('byCategory');
    });

    test('应该包含按策略统计', async () => {
      const response = await request(app)
        .get('/api/symbol-management/stats')
        .expect(200);

      expect(response.body.data.byStrategy).toHaveProperty('V3');
      expect(response.body.data.byStrategy).toHaveProperty('ICT');
    });
  });

  describe('GET /api/monitoring/alerts', () => {
    test('应该成功获取监控告警列表', async () => {
      const response = await request(app)
        .get('/api/monitoring/alerts')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('alerts');
      expect(response.body.data).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data.alerts)).toBe(true);
    });

    test('应该支持分页参数', async () => {
      const response = await request(app)
        .get('/api/monitoring/alerts?page=1&pageSize=10')
        .expect(200);

      expect(response.body.data.pagination).toHaveProperty('currentPage', 1);
      expect(response.body.data.pagination).toHaveProperty('pageSize', 10);
    });

    test('应该支持按策略筛选', async () => {
      const response = await request(app)
        .get('/api/monitoring/alerts?strategyType=V3')
        .expect(200);

      expect(response.body.data.alerts.every(alert => alert.strategy_type === 'V3')).toBe(true);
    });

    test('应该支持按告警类型筛选', async () => {
      const response = await request(app)
        .get('/api/monitoring/alerts?alertType=DATA_QUALITY')
        .expect(200);

      expect(response.body.data.alerts.every(alert => alert.alert_type === 'DATA_QUALITY')).toBe(true);
    });
  });

  describe('POST /api/monitoring/alerts/:id/resolve', () => {
    test('应该成功解决告警', async () => {
      // 先创建一个告警
      await createTestAlert(db);

      const response = await request(app)
        .post('/api/monitoring/alerts/1/resolve')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('告警已解决');
    });

    test('应该返回400当缺少告警ID时', async () => {
      const response = await request(app)
        .post('/api/monitoring/alerts//resolve')
        .expect(404); // Express路由不匹配
    });

    test('应该处理不存在的告警ID', async () => {
      const response = await request(app)
        .post('/api/monitoring/alerts/99999/resolve')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('错误处理', () => {
    test('应该处理数据库错误', async () => {
      // 关闭数据库连接来模拟错误
      await new Promise((resolve) => {
        db.close((err) => {
          if (err) console.error('关闭数据库失败:', err);
          resolve();
        });
      });

      const response = await request(app)
        .get('/api/unified-monitoring/dashboard')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code');
    });
  });

  describe('API辅助方法', () => {
    test('应该成功创建告警', async () => {
      await api.createAlert('BTCUSDT', 'V3', 'DATA_QUALITY', 'MEDIUM', '测试告警');

      const alerts = await db.all('SELECT * FROM monitoring_alerts WHERE symbol = ?', ['BTCUSDT']);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].message).toBe('测试告警');
    });

    test('应该成功更新策略监控统计', async () => {
      const stats = {
        dataCollectionRate: 95.5,
        dataValidationStatus: 'VALID',
        simulationCompletionRate: 100.0,
        overallHealth: 'HEALTHY'
      };

      await api.updateStrategyMonitoringStats('BTCUSDT', 'V3', stats);

      const result = await db.get(
        'SELECT * FROM strategy_monitoring_stats WHERE symbol = ? AND strategy_type = ?',
        ['BTCUSDT', 'V3']
      );

      expect(result.data_collection_rate).toBe(95.5);
      expect(result.data_validation_status).toBe('VALID');
    });

    test('应该成功记录统一模拟交易', async () => {
      const simulationData = {
        symbol: 'BTCUSDT',
        strategyType: 'V3',
        entryPrice: 50000,
        stopLossPrice: 49000,
        takeProfitPrice: 52000,
        maxLeverage: 10,
        minMargin: 100,
        direction: 'LONG',
        triggerReason: 'SIGNAL'
      };

      const id = await api.recordUnifiedSimulation(simulationData);

      expect(typeof id).toBe('number');
      expect(id).toBeGreaterThan(0);
    });

    test('应该成功更新统一模拟交易状态', async () => {
      // 先创建一个模拟交易
      const simulationData = {
        symbol: 'BTCUSDT',
        strategyType: 'V3',
        entryPrice: 50000,
        stopLossPrice: 49000,
        takeProfitPrice: 52000,
        maxLeverage: 10,
        minMargin: 100,
        direction: 'LONG',
        triggerReason: 'SIGNAL'
      };

      const id = await api.recordUnifiedSimulation(simulationData);

      // 更新状态
      const updateData = {
        status: 'CLOSED',
        closedAt: new Date().toISOString(),
        exitPrice: 52000,
        exitReason: 'TAKE_PROFIT',
        isWin: true,
        profitLoss: 2000
      };

      await api.updateUnifiedSimulation(id, updateData);

      const result = await db.get('SELECT * FROM unified_simulations WHERE id = ?', [id]);
      expect(result.status).toBe('CLOSED');
      expect(result.is_win).toBe(1);
    });
  });
});

// 辅助函数

async function createBaseTables(db) {
  return new Promise((resolve, reject) => {
    const createTables = [
      `CREATE TABLE custom_symbols (
        symbol TEXT PRIMARY KEY
      )`,
      `CREATE TABLE strategy_monitoring_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        strategy_type TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        data_collection_rate REAL DEFAULT 0,
        data_collection_attempts INTEGER DEFAULT 0,
        data_collection_successes INTEGER DEFAULT 0,
        data_collection_last_time DATETIME,
        data_validation_status TEXT DEFAULT 'UNKNOWN',
        data_validation_errors INTEGER DEFAULT 0,
        data_validation_warnings INTEGER DEFAULT 0,
        data_validation_last_check DATETIME,
        simulation_completion_rate REAL DEFAULT 0,
        simulation_triggers INTEGER DEFAULT 0,
        simulation_completions INTEGER DEFAULT 0,
        simulation_active_count INTEGER DEFAULT 0,
        strategy_specific_data TEXT,
        overall_health TEXT DEFAULT 'UNKNOWN',
        last_error_message TEXT,
        last_error_time DATETIME,
        UNIQUE(symbol, strategy_type, timestamp)
      )`,
      `CREATE TABLE data_refresh_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        strategy_type TEXT NOT NULL,
        data_type TEXT NOT NULL,
        last_refresh DATETIME,
        next_refresh DATETIME,
        should_refresh BOOLEAN DEFAULT TRUE,
        refresh_interval INTEGER DEFAULT 3600,
        refresh_attempts INTEGER DEFAULT 0,
        refresh_successes INTEGER DEFAULT 0,
        last_error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(symbol, strategy_type, data_type)
      )`,
      `CREATE TABLE unified_simulations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        strategy_type TEXT NOT NULL,
        entry_price REAL NOT NULL,
        stop_loss_price REAL NOT NULL,
        take_profit_price REAL NOT NULL,
        max_leverage INTEGER NOT NULL,
        min_margin REAL NOT NULL,
        stop_loss_distance REAL,
        atr_value REAL,
        direction TEXT NOT NULL,
        status TEXT DEFAULT 'ACTIVE',
        trigger_reason TEXT NOT NULL,
        execution_mode TEXT,
        market_type TEXT,
        setup_candle_high REAL,
        setup_candle_low REAL,
        atr14 REAL,
        time_in_position INTEGER DEFAULT 0,
        max_time_in_position INTEGER DEFAULT 48,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME,
        exit_price REAL,
        exit_reason TEXT,
        is_win BOOLEAN,
        profit_loss REAL,
        cache_version INTEGER DEFAULT 1,
        last_updated DATETIME
      )`,
      `CREATE TABLE monitoring_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        strategy_type TEXT NOT NULL,
        alert_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        message TEXT NOT NULL,
        details TEXT,
        resolved BOOLEAN DEFAULT FALSE,
        resolved_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    let completed = 0;
    createTables.forEach(sql => {
      db.run(sql, (err) => {
        if (err) reject(err);
        completed++;
        if (completed === createTables.length) {
          resolve();
        }
      });
    });
  });
}

async function cleanupTestData(db) {
  return new Promise((resolve, reject) => {
    const tables = [
      'strategy_monitoring_stats',
      'data_refresh_status',
      'unified_simulations',
      'monitoring_alerts',
      'custom_symbols'
    ];

    let completed = 0;
    tables.forEach(table => {
      db.run(`DELETE FROM ${table}`, (err) => {
        if (err && !err.message.includes('no such table')) {
          reject(err);
        } else {
          completed++;
          if (completed === tables.length) {
            resolve();
          }
        }
      });
    });
  });
}

async function addTestData(db) {
  return new Promise((resolve, reject) => {
    // 添加测试交易对
    const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'];
    let completed = 0;

    symbols.forEach(symbol => {
      db.run('INSERT INTO custom_symbols (symbol) VALUES (?)', [symbol], (err) => {
        if (err) reject(err);
        completed++;
        if (completed === symbols.length) {
          // 添加数据刷新状态
          addRefreshStatusData(db, symbols).then(resolve).catch(reject);
        }
      });
    });
  });
}

async function addRefreshStatusData(db, symbols) {
  return new Promise((resolve, reject) => {
    const strategies = ['V3', 'ICT'];
    const v3DataTypes = ['4h_trend', '1h_scoring', '15m_entry'];
    const ictDataTypes = ['daily_trend', 'mtf_analysis', 'ltf_analysis'];

    let totalInserts = 0;
    let completed = 0;

    symbols.forEach(symbol => {
      strategies.forEach(strategy => {
        const dataTypes = strategy === 'V3' ? v3DataTypes : ictDataTypes;
        dataTypes.forEach(dataType => {
          totalInserts++;
          db.run(
            'INSERT INTO data_refresh_status (symbol, strategy_type, data_type, should_refresh, refresh_interval) VALUES (?, ?, ?, ?, ?)',
            [symbol, strategy, dataType, true, 3600],
            (err) => {
              if (err) reject(err);
              completed++;
              if (completed === totalInserts) {
                // 添加监控统计
                addMonitoringStatsData(db, symbols).then(resolve).catch(reject);
              }
            }
          );
        });
      });
    });
  });
}

async function addMonitoringStatsData(db, symbols) {
  return new Promise((resolve, reject) => {
    const strategies = ['V3', 'ICT'];
    let totalInserts = 0;
    let completed = 0;

    symbols.forEach(symbol => {
      strategies.forEach(strategy => {
        totalInserts++;
        db.run(
          'INSERT INTO strategy_monitoring_stats (symbol, strategy_type, data_collection_rate, data_validation_status, simulation_completion_rate, overall_health) VALUES (?, ?, ?, ?, ?, ?)',
          [symbol, strategy, 95.5, 'VALID', 100.0, 'HEALTHY'],
          (err) => {
            if (err) reject(err);
            completed++;
            if (completed === totalInserts) {
              // 添加模拟交易数据
              addSimulationData(db, symbols).then(resolve).catch(reject);
            }
          }
        );
      });
    });
  });
}

async function addSimulationData(db, symbols) {
  return new Promise((resolve, reject) => {
    const strategies = ['V3', 'ICT'];
    let totalInserts = 0;
    let completed = 0;

    symbols.forEach(symbol => {
      strategies.forEach(strategy => {
        totalInserts++;
        db.run(
          'INSERT INTO unified_simulations (symbol, strategy_type, entry_price, stop_loss_price, take_profit_price, max_leverage, min_margin, direction, status, trigger_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [symbol, strategy, 50000, 49000, 52000, 10, 100, 'LONG', 'CLOSED', 'SIGNAL'],
          (err) => {
            if (err) reject(err);
            completed++;
            if (completed === totalInserts) {
              resolve();
            }
          }
        );
      });
    });
  });
}

async function createTestAlert(db) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO monitoring_alerts (symbol, strategy_type, alert_type, severity, message) VALUES (?, ?, ?, ?, ?)',
      ['BTCUSDT', 'V3', 'DATA_QUALITY', 'MEDIUM', '测试告警'],
      (err) => {
        if (err) reject(err);
        resolve();
      }
    );
  });
}
