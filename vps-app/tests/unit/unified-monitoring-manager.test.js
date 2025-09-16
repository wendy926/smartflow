// unified-monitoring-manager.test.js - 统一监控管理器测试

const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const UnifiedMonitoringManager = require('../../src/core/modules/monitoring/UnifiedMonitoringManager');

describe('统一监控管理器测试', () => {
  let db;
  let manager;

  beforeAll(async () => {
    // 创建内存数据库
    db = new sqlite3.Database(':memory:');

    // 创建基础表结构
    await createBaseTables(db);

    manager = new UnifiedMonitoringManager(db);
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

  describe('统一监控中心数据获取', () => {
    test('应该成功获取统一监控中心数据', async () => {
      const dashboardData = await manager.getUnifiedMonitoringDashboard();

      expect(dashboardData).toHaveProperty('summary');
      expect(dashboardData).toHaveProperty('completionRates');
      expect(dashboardData).toHaveProperty('detailedStats');
      expect(dashboardData).toHaveProperty('recentAlerts');
    });

    test('应该包含V3和ICT策略的汇总统计', async () => {
      const dashboardData = await manager.getUnifiedMonitoringDashboard();

      expect(dashboardData.summary).toHaveProperty('v3Strategy');
      expect(dashboardData.summary).toHaveProperty('ictStrategy');
      expect(dashboardData.summary).toHaveProperty('totalSymbols');
      expect(dashboardData.summary).toHaveProperty('overallHealth');
    });

    test('应该包含完成率数据', async () => {
      const dashboardData = await manager.getUnifiedMonitoringDashboard();

      expect(dashboardData.completionRates).toHaveProperty('v3Strategy');
      expect(dashboardData.completionRates).toHaveProperty('ictStrategy');

      expect(dashboardData.completionRates.v3Strategy).toHaveProperty('dataCollection');
      expect(dashboardData.completionRates.v3Strategy).toHaveProperty('dataValidation');
      expect(dashboardData.completionRates.v3Strategy).toHaveProperty('simulationTrading');
    });
  });

  describe('交易对监控数据获取', () => {
    test('应该成功获取指定交易对的监控数据', async () => {
      const symbolData = await manager.getSymbolMonitoringData('BTCUSDT');

      expect(symbolData).toHaveProperty('symbol', 'BTCUSDT');
      expect(symbolData).toHaveProperty('v3Strategy');
      expect(symbolData).toHaveProperty('ictStrategy');
    });

    test('应该包含V3和ICT策略的详细数据', async () => {
      const symbolData = await manager.getSymbolMonitoringData('BTCUSDT');

      expect(symbolData.v3Strategy).toHaveProperty('dataCollection');
      expect(symbolData.v3Strategy).toHaveProperty('dataValidation');
      expect(symbolData.v3Strategy).toHaveProperty('simulationCompletion');

      expect(symbolData.ictStrategy).toHaveProperty('dataCollection');
      expect(symbolData.ictStrategy).toHaveProperty('dataValidation');
      expect(symbolData.ictStrategy).toHaveProperty('simulationCompletion');
    });
  });

  describe('数据刷新状态管理', () => {
    test('应该成功获取数据刷新状态', async () => {
      const refreshStatus = await manager.getDataRefreshStatus();

      expect(refreshStatus).toHaveProperty('v3Strategy');
      expect(refreshStatus).toHaveProperty('ictStrategy');
    });

    test('应该包含V3策略的数据类型', async () => {
      const refreshStatus = await manager.getDataRefreshStatus();

      expect(refreshStatus.v3Strategy).toHaveProperty('BTCUSDT');
      expect(refreshStatus.v3Strategy.BTCUSDT).toHaveProperty('4h_trend');
      expect(refreshStatus.v3Strategy.BTCUSDT).toHaveProperty('1h_scoring');
      expect(refreshStatus.v3Strategy.BTCUSDT).toHaveProperty('15m_entry');
    });

    test('应该包含ICT策略的数据类型', async () => {
      const refreshStatus = await manager.getDataRefreshStatus();

      expect(refreshStatus.ictStrategy).toHaveProperty('BTCUSDT');
      expect(refreshStatus.ictStrategy.BTCUSDT).toHaveProperty('daily_trend');
      expect(refreshStatus.ictStrategy.BTCUSDT).toHaveProperty('mtf_analysis');
      expect(refreshStatus.ictStrategy.BTCUSDT).toHaveProperty('ltf_analysis');
    });

    test('应该成功强制刷新数据', async () => {
      const result = await manager.forceRefreshSymbolData('BTCUSDT', 'V3', '4h_trend');

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('message');
    });
  });

  describe('统一模拟交易管理', () => {
    test('应该成功获取模拟交易历史', async () => {
      const result = await manager.getUnifiedSimulationHistory(1, 20);

      expect(result).toHaveProperty('simulations');
      expect(result).toHaveProperty('pagination');
      expect(Array.isArray(result.simulations)).toBe(true);
    });

    test('应该支持分页', async () => {
      const result = await manager.getUnifiedSimulationHistory(1, 10);

      expect(result.pagination).toHaveProperty('currentPage', 1);
      expect(result.pagination).toHaveProperty('pageSize', 10);
      expect(result.pagination).toHaveProperty('total');
      expect(result.pagination).toHaveProperty('totalPages');
    });

    test('应该支持按策略筛选', async () => {
      const result = await manager.getUnifiedSimulationHistory(1, 20, 'V3');

      expect(result.simulations.every(sim => sim.strategy_type === 'V3')).toBe(true);
    });

    test('应该成功获取模拟交易统计', async () => {
      const stats = await manager.getUnifiedSimulationStats();

      expect(stats).toHaveProperty('overall');
      expect(stats).toHaveProperty('byStrategy');
      expect(stats).toHaveProperty('bySymbol');
    });

    test('应该包含整体统计', async () => {
      const stats = await manager.getUnifiedSimulationStats();

      expect(stats.overall).toHaveProperty('totalTrades');
      expect(stats.overall).toHaveProperty('winningTrades');
      expect(stats.overall).toHaveProperty('losingTrades');
      expect(stats.overall).toHaveProperty('winRate');
      expect(stats.overall).toHaveProperty('netProfit');
    });

    test('应该包含按策略统计', async () => {
      const stats = await manager.getUnifiedSimulationStats();

      expect(stats.byStrategy).toHaveProperty('V3');
      expect(stats.byStrategy).toHaveProperty('ICT');

      expect(stats.byStrategy.V3).toHaveProperty('totalTrades');
      expect(stats.byStrategy.V3).toHaveProperty('winRate');
      expect(stats.byStrategy.V3).toHaveProperty('netProfit');
    });
  });

  describe('交易对管理统计', () => {
    test('应该成功获取交易对管理统计', async () => {
      const stats = await manager.getSymbolManagementStats();

      expect(stats).toHaveProperty('totalSymbols');
      expect(stats).toHaveProperty('byStrategy');
      expect(stats).toHaveProperty('byCategory');
    });

    test('应该包含按策略统计', async () => {
      const stats = await manager.getSymbolManagementStats();

      expect(stats.byStrategy).toHaveProperty('V3');
      expect(stats.byStrategy).toHaveProperty('ICT');

      expect(stats.byStrategy.V3).toHaveProperty('totalSymbols');
      expect(stats.byStrategy.V3).toHaveProperty('healthySymbols');
      expect(stats.byStrategy.V3).toHaveProperty('dataCollectionRate');
    });
  });

  describe('监控告警管理', () => {
    test('应该成功获取监控告警列表', async () => {
      const result = await manager.getMonitoringAlerts(1, 20);

      expect(result).toHaveProperty('alerts');
      expect(result).toHaveProperty('pagination');
      expect(Array.isArray(result.alerts)).toBe(true);
    });

    test('应该支持按策略筛选告警', async () => {
      const result = await manager.getMonitoringAlerts(1, 20, 'V3');

      expect(result.alerts.every(alert => alert.strategy_type === 'V3')).toBe(true);
    });

    test('应该支持按告警类型筛选', async () => {
      const result = await manager.getMonitoringAlerts(1, 20, null, 'DATA_QUALITY');

      expect(result.alerts.every(alert => alert.alert_type === 'DATA_QUALITY')).toBe(true);
    });

    test('应该成功解决告警', async () => {
      // 先创建一个告警
      await createTestAlert(db);

      const result = await manager.resolveAlert(1);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('message', '告警已解决');
    });
  });

  describe('缓存机制', () => {
    test('应该使用缓存提高性能', async () => {
      const start1 = Date.now();
      await manager.getUnifiedMonitoringDashboard();
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      await manager.getUnifiedMonitoringDashboard();
      const time2 = Date.now() - start2;

      // 第二次调用应该更快（使用缓存）
      expect(time2).toBeLessThan(time1);
    });
  });

  describe('错误处理', () => {
    test('应该处理数据库连接错误', async () => {
      const invalidManager = new UnifiedMonitoringManager(null);

      await expect(invalidManager.getUnifiedMonitoringDashboard()).rejects.toThrow();
    });

    test('应该处理无效的交易对参数', async () => {
      await expect(manager.getSymbolMonitoringData('')).rejects.toThrow();
    });

    test('应该处理无效的告警ID', async () => {
      await expect(manager.resolveAlert(99999)).rejects.toThrow();
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
