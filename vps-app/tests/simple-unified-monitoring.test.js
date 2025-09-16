// simple-unified-monitoring.test.js - 简化统一监控测试

const sqlite3 = require('sqlite3').verbose();
const UnifiedMonitoringMigration = require('../src/core/modules/database/UnifiedMonitoringMigration');

describe('简化统一监控测试', () => {
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

  test('应该成功创建数据库表', async () => {
    // 只测试表创建，不测试数据初始化
    await migration.createStrategyMonitoringStatsTable();
    await migration.createDataRefreshStatusTable();
    await migration.createUnifiedSimulationsTable();
    await migration.createMonitoringAlertsTable();

    const tables = await getTableNames(db);
    expect(tables).toContain('strategy_monitoring_stats');
    expect(tables).toContain('data_refresh_status');
    expect(tables).toContain('unified_simulations');
    expect(tables).toContain('monitoring_alerts');
  });

  test('应该成功创建索引', async () => {
    await migration.createIndexes();

    const indexes = await getIndexes(db);
    expect(indexes.length).toBeGreaterThan(0);
  });

  test('应该成功获取交易对列表', async () => {
    const symbols = await migration.getCustomSymbols();
    expect(Array.isArray(symbols)).toBe(true);
    expect(symbols.length).toBeGreaterThan(0);
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
          // 添加测试数据
          addTestData(db).then(resolve).catch(reject);
        }
      });
    });
  });
}

async function addTestData(db) {
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

async function getIndexes(db) {
  return new Promise((resolve, reject) => {
    db.all("SELECT name FROM sqlite_master WHERE type='index' AND name IS NOT NULL", (err, rows) => {
      if (err) reject(err);
      resolve(rows.map(row => row.name));
    });
  });
}
