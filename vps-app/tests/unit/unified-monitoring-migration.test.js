// unified-monitoring-migration.test.js - 统一监控中心数据库迁移测试

const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const UnifiedMonitoringMigration = require('../../src/core/modules/database/UnifiedMonitoringMigration');

describe('统一监控中心数据库迁移测试', () => {
  let db;
  let migration;

  beforeAll(async () => {
    // 创建内存数据库
    db = new sqlite3.Database(':memory:');

    // 添加getCustomSymbols方法
    db.getCustomSymbols = async function () {
      const result = await this.all('SELECT symbol FROM custom_symbols ORDER BY symbol');
      return result.map(row => row.symbol);
    };

    // 创建基础表结构
    await createBaseTables(db);

    migration = new UnifiedMonitoringMigration(db);
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
  });

  describe('数据库迁移', () => {
    test('应该成功执行完整迁移', async () => {
      await expect(migration.migrate()).resolves.toBe(true);
    });

    test('应该创建策略监控统计表', async () => {
      await migration.migrate();

      const tables = await getTableNames(db);
      expect(tables).toContain('strategy_monitoring_stats');
    });

    test('应该创建数据刷新状态表', async () => {
      await migration.migrate();

      const tables = await getTableNames(db);
      expect(tables).toContain('data_refresh_status');
    });

    test('应该创建统一模拟交易表', async () => {
      await migration.migrate();

      const tables = await getTableNames(db);
      expect(tables).toContain('unified_simulations');
    });

    test('应该创建监控告警表', async () => {
      await migration.migrate();

      const tables = await getTableNames(db);
      expect(tables).toContain('monitoring_alerts');
    });
  });

  describe('表结构验证', () => {
    beforeEach(async () => {
      await migration.migrate();
    });

    test('策略监控统计表应该有正确的字段', async () => {
      const columns = await getTableColumns(db, 'strategy_monitoring_stats');

      expect(columns).toContain('id');
      expect(columns).toContain('symbol');
      expect(columns).toContain('strategy_type');
      expect(columns).toContain('data_collection_rate');
      expect(columns).toContain('data_validation_status');
      expect(columns).toContain('simulation_completion_rate');
      expect(columns).toContain('overall_health');
    });

    test('数据刷新状态表应该有正确的字段', async () => {
      const columns = await getTableColumns(db, 'data_refresh_status');

      expect(columns).toContain('symbol');
      expect(columns).toContain('strategy_type');
      expect(columns).toContain('data_type');
      expect(columns).toContain('should_refresh');
      expect(columns).toContain('last_refresh');
      expect(columns).toContain('next_refresh');
    });

    test('统一模拟交易表应该有正确的字段', async () => {
      const columns = await getTableColumns(db, 'unified_simulations');

      expect(columns).toContain('symbol');
      expect(columns).toContain('strategy_type');
      expect(columns).toContain('entry_price');
      expect(columns).toContain('direction');
      expect(columns).toContain('status');
    });

    test('监控告警表应该有正确的字段', async () => {
      const columns = await getTableColumns(db, 'monitoring_alerts');

      expect(columns).toContain('symbol');
      expect(columns).toContain('strategy_type');
      expect(columns).toContain('alert_type');
      expect(columns).toContain('severity');
      expect(columns).toContain('message');
      expect(columns).toContain('resolved');
    });
  });

  describe('索引创建', () => {
    beforeEach(async () => {
      await migration.migrate();
    });

    test('应该创建必要的索引', async () => {
      const indexes = await getIndexes(db);

      expect(indexes).toContain('idx_strategy_monitoring_symbol_type');
      expect(indexes).toContain('idx_data_refresh_symbol_type');
      expect(indexes).toContain('idx_unified_simulations_symbol');
      expect(indexes).toContain('idx_monitoring_alerts_symbol_strategy');
    });
  });

  describe('数据初始化', () => {
    beforeEach(async () => {
      // 添加测试交易对
      await addTestSymbols(db);
      await migration.migrate();
    });

    test('应该为每个交易对初始化数据刷新状态', async () => {
      const v3Status = await db.all(
        "SELECT COUNT(*) as count FROM data_refresh_status WHERE strategy_type = 'V3'"
      );
      const ictStatus = await db.all(
        "SELECT COUNT(*) as count FROM data_refresh_status WHERE strategy_type = 'ICT'"
      );

      expect(v3Status[0].count).toBe(3); // 3个交易对 × 3个数据类型
      expect(ictStatus[0].count).toBe(3); // 3个交易对 × 3个数据类型
    });

    test('应该为每个交易对初始化监控统计', async () => {
      const v3Stats = await db.all(
        "SELECT COUNT(*) as count FROM strategy_monitoring_stats WHERE strategy_type = 'V3'"
      );
      const ictStats = await db.all(
        "SELECT COUNT(*) as count FROM strategy_monitoring_stats WHERE strategy_type = 'ICT'"
      );

      expect(v3Stats[0].count).toBe(3); // 3个交易对
      expect(ictStats[0].count).toBe(3); // 3个交易对
    });
  });

  describe('现有表扩展', () => {
    beforeEach(async () => {
      await migration.migrate();
    });

    test('应该扩展strategy_analysis表', async () => {
      const columns = await getTableColumns(db, 'strategy_analysis');

      expect(columns).toContain('strategy_type');
      expect(columns).toContain('unified_monitoring_data');
    });

    test('应该扩展ict_strategy_analysis表', async () => {
      const columns = await getTableColumns(db, 'ict_strategy_analysis');

      expect(columns).toContain('strategy_type');
      expect(columns).toContain('unified_monitoring_data');
    });
  });

  describe('迁移统计', () => {
    test('应该返回迁移统计信息', async () => {
      await migration.migrate();

      const stats = await migration.getMigrationStats();

      expect(stats).toHaveProperty('strategyMonitoringStats');
      expect(stats).toHaveProperty('dataRefreshStatus');
      expect(stats).toHaveProperty('unifiedSimulations');
      expect(stats).toHaveProperty('monitoringAlerts');
    });
  });

  describe('错误处理', () => {
    test('应该处理数据库连接错误', async () => {
      const invalidDb = null;
      const invalidMigration = new UnifiedMonitoringMigration(invalidDb);

      await expect(invalidMigration.migrate()).rejects.toThrow();
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
      `CREATE TABLE strategy_analysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE ict_strategy_analysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE simulations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        entry_price REAL NOT NULL,
        stop_loss_price REAL NOT NULL,
        take_profit_price REAL NOT NULL,
        direction TEXT NOT NULL,
        status TEXT DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE ict_simulations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        entry_price REAL,
        stop_loss REAL,
        take_profit REAL,
        direction TEXT,
        status TEXT DEFAULT 'ACTIVE',
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
      'custom_symbols',
      'strategy_analysis',
      'ict_strategy_analysis',
      'simulations',
      'ict_simulations'
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

async function addTestSymbols(db) {
  return new Promise((resolve, reject) => {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'];
    let completed = 0;

    symbols.forEach(symbol => {
      db.run('INSERT INTO custom_symbols (symbol) VALUES (?)', [symbol], (err) => {
        if (err) reject(err);
        completed++;
        if (completed === symbols.length) {
          resolve();
        }
      });
    });
  });
}

async function getTableNames(db) {
  return new Promise((resolve, reject) => {
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
      if (err) reject(err);
      resolve(rows.map(row => row.name));
    });
  });
}

async function getTableColumns(db, tableName) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
      if (err) reject(err);
      resolve(rows.map(row => row.name));
    });
  });
}

async function getIndexes(db) {
  return new Promise((resolve, reject) => {
    db.all("SELECT name FROM sqlite_master WHERE type='index' AND name IS NOT NULL", (err, rows) => {
      if (err) reject(err);
      resolve(rows.map(row => row.name));
    });
  });
}
