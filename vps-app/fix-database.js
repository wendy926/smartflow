const sqlite3 = require('sqlite3').verbose();

// 创建数据库连接
const db = new sqlite3.Database('./smartflow.db');

console.log('🔧 开始修复数据库...');

// 创建 custom_symbols 表
db.run(`
  CREATE TABLE IF NOT EXISTS custom_symbols (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT UNIQUE NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1
  )
`, (err) => {
  if (err) {
    console.error('❌ 创建custom_symbols表失败:', err);
  } else {
    console.log('✅ custom_symbols表创建成功');
  }
});

// 创建其他必要的表
const tables = [
  {
    name: 'signal_records',
    sql: `
      CREATE TABLE IF NOT EXISTS signal_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        signal_time DATETIME NOT NULL,
        trend TEXT NOT NULL,
        signal TEXT NOT NULL,
        current_price REAL NOT NULL,
        vwap REAL,
        volume_ratio REAL,
        oi_change REAL,
        funding_rate REAL,
        cvd_direction TEXT,
        raw_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `
  },
  {
    name: 'execution_records',
    sql: `
      CREATE TABLE IF NOT EXISTS execution_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        execution_time DATETIME NOT NULL,
        trend TEXT NOT NULL,
        signal TEXT NOT NULL,
        current_price REAL NOT NULL,
        ema_20 REAL,
        ema_50 REAL,
        atr REAL,
        setup_candle_high REAL,
        setup_candle_low REAL,
        raw_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `
  },
  {
    name: 'simulations',
    sql: `
      CREATE TABLE IF NOT EXISTS simulations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        entry_price REAL NOT NULL,
        stop_loss_price REAL NOT NULL,
        take_profit_price REAL NOT NULL,
        max_leverage INTEGER NOT NULL,
        min_margin REAL NOT NULL,
        entry_time DATETIME NOT NULL,
        exit_time DATETIME,
        exit_price REAL,
        profit_loss REAL,
        status TEXT DEFAULT 'OPEN',
        trigger_reason TEXT DEFAULT 'SIGNAL',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `
  },
  {
    name: 'result_markers',
    sql: `
      CREATE TABLE IF NOT EXISTS result_markers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        marker_time DATETIME NOT NULL,
        marker_type TEXT NOT NULL,
        price REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `
  },
  {
    name: 'win_rate_stats',
    sql: `
      CREATE TABLE IF NOT EXISTS win_rate_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        total_trades INTEGER DEFAULT 0,
        winning_trades INTEGER DEFAULT 0,
        losing_trades INTEGER DEFAULT 0,
        win_rate REAL DEFAULT 0.0,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(symbol)
      )
    `
  }
];

// 创建所有表
let completed = 0;
tables.forEach(table => {
  db.run(table.sql, (err) => {
    if (err) {
      console.error(`❌ 创建${table.name}表失败:`, err);
    } else {
      console.log(`✅ ${table.name}表创建成功`);
    }
    completed++;
    if (completed === tables.length) {
      console.log('🎉 数据库修复完成！');
      db.close();
    }
  });
});
