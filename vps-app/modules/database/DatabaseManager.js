// modules/database/DatabaseManager.js
// 数据库管理模块

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseManager {
  constructor() {
    this.db = null;
    this.dbPath = '/home/admin/smartflow-vps-app/vps-app/smartflow.db';
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('❌ 数据库连接失败:', err.message);
          reject(err);
        } else {
          console.log('✅ 数据库连接成功');
          this.initTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async initTables() {
    const tables = [
      // 信号记录表
      `CREATE TABLE IF NOT EXISTS signal_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        signal_type TEXT NOT NULL,
        signal_data TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        result TEXT,
        notes TEXT
      )`,

      // 入场执行记录表
      `CREATE TABLE IF NOT EXISTS execution_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        execution_type TEXT NOT NULL,
        execution_data TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        result TEXT,
        notes TEXT
      )`,

      // 模拟交易表
      `CREATE TABLE IF NOT EXISTS simulations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        entry_price REAL NOT NULL,
        stop_loss_price REAL NOT NULL,
        take_profit_price REAL NOT NULL,
        max_leverage INTEGER NOT NULL,
        min_margin REAL NOT NULL,
        trigger_reason TEXT NOT NULL,
        status TEXT DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME,
        exit_price REAL,
        exit_reason TEXT,
        is_win BOOLEAN,
        profit_loss REAL
      )`,

      // 胜率统计表
      `CREATE TABLE IF NOT EXISTS win_rate_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        total_trades INTEGER DEFAULT 0,
        winning_trades INTEGER DEFAULT 0,
        losing_trades INTEGER DEFAULT 0,
        win_rate REAL DEFAULT 0,
        total_profit REAL DEFAULT 0,
        total_loss REAL DEFAULT 0,
        net_profit REAL DEFAULT 0,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // 自定义交易对表
      `CREATE TABLE IF NOT EXISTS custom_symbols (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT UNIQUE NOT NULL,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // 用户设置表
      `CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setting_key TEXT UNIQUE NOT NULL,
        setting_value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const table of tables) {
      await this.runQuery(table);
    }

    await this.initWinRateStats();
    await this.initCustomSymbols();
  }

  async initWinRateStats() {
    const checkQuery = 'SELECT COUNT(*) as count FROM win_rate_stats';
    const result = await this.runQuery(checkQuery);

    if (result[0].count === 0) {
      await this.runQuery(`
        INSERT INTO win_rate_stats (total_trades, winning_trades, losing_trades, win_rate, total_profit, total_loss, net_profit)
        VALUES (0, 0, 0, 0, 0, 0, 0)
      `);
    }
  }

  async initCustomSymbols() {
    const defaultSymbols = ['BTCUSDT', 'ETHUSDT', 'LINKUSDT', 'LDOUSDT'];

    for (const symbol of defaultSymbols) {
      try {
        await this.runQuery('INSERT OR IGNORE INTO custom_symbols (symbol) VALUES (?)', [symbol]);
      } catch (err) {
        // 忽略重复插入错误
      }
    }
  }

  async runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  // 记录信号
  async recordSignal(symbol, signalData) {
    const sql = `
      INSERT INTO signal_records (symbol, signal_type, signal_data, result, notes)
      VALUES (?, ?, ?, ?, ?)
    `;

    const params = [
      symbol,
      signalData.signal || 'UNKNOWN',
      JSON.stringify(signalData),
      signalData.result || 'PENDING',
      signalData.notes || ''
    ];

    return await this.run(sql, params);
  }

  // 记录入场执行
  async recordExecution(symbol, executionData) {
    const sql = `
      INSERT INTO execution_records (symbol, execution_type, execution_data, result, notes)
      VALUES (?, ?, ?, ?, ?)
    `;

    const params = [
      symbol,
      executionData.execution || 'UNKNOWN',
      JSON.stringify(executionData),
      executionData.result || 'PENDING',
      executionData.notes || ''
    ];

    return await this.run(sql, params);
  }

  // 标记结果
  async markResult(recordId, recordType, symbol, result, notes = '') {
    const table = recordType === 'signal' ? 'signal_records' : 'execution_records';
    const sql = `UPDATE ${table} SET result = ?, notes = ? WHERE id = ?`;

    return await this.run(sql, [result, notes, recordId]);
  }

  // 获取历史记录
  async getHistoryRecords(symbol = null, limit = 100) {
    let sql = `
      SELECT 'signal' as type, id, symbol, signal_type as data_type, signal_data as data, timestamp, result, notes
      FROM signal_records
      ${symbol ? 'WHERE symbol = ?' : ''}
      UNION ALL
      SELECT 'execution' as type, id, symbol, execution_type as data_type, execution_data as data, timestamp, result, notes
      FROM execution_records
      ${symbol ? 'WHERE symbol = ?' : ''}
      ORDER BY timestamp DESC
      LIMIT ?
    `;

    const params = symbol ? [symbol, symbol, limit] : [limit];
    return await this.runQuery(sql, params);
  }

  // 添加自定义交易对
  async addCustomSymbol(symbol) {
    try {
      await this.runQuery('INSERT INTO custom_symbols (symbol) VALUES (?)', [symbol]);
      return { success: true, message: `交易对 ${symbol} 添加成功` };
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return { success: false, message: `交易对 ${symbol} 已存在` };
      }
      return { success: false, message: `添加失败: ${err.message}` };
    }
  }

  // 删除自定义交易对
  async removeCustomSymbol(symbol) {
    try {
      const result = await this.run('DELETE FROM custom_symbols WHERE symbol = ?', [symbol]);
      if (result.changes > 0) {
        return { success: true, message: `交易对 ${symbol} 删除成功` };
      } else {
        return { success: false, message: `交易对 ${symbol} 不存在` };
      }
    } catch (err) {
      return { success: false, message: `删除失败: ${err.message}` };
    }
  }

  // 获取自定义交易对
  async getCustomSymbols() {
    const rows = await this.runQuery('SELECT symbol FROM custom_symbols ORDER BY added_at ASC');
    return rows.map(row => row.symbol);
  }

  // 获取数据统计
  async getDataStats() {
    const checkComplete = () => {
      return new Promise((resolve) => {
        this.db.get('SELECT COUNT(*) as count FROM signal_records', (err, row) => {
          if (err) {
            resolve({ totalSignals: 0, totalExecutions: 0, totalSimulations: 0 });
          } else {
            this.db.get('SELECT COUNT(*) as count FROM execution_records', (err, execRow) => {
              if (err) {
                resolve({ totalSignals: row.count, totalExecutions: 0, totalSimulations: 0 });
              } else {
                this.db.get('SELECT COUNT(*) as count FROM simulations', (err, simRow) => {
                  resolve({
                    totalSignals: row.count,
                    totalExecutions: execRow.count,
                    totalSimulations: simRow ? simRow.count : 0
                  });
                });
              }
            });
          }
        });
      });
    };

    return await checkComplete();
  }

  // 用户设置相关方法
  async setUserSetting(key, value) {
    try {
      await this.runQuery(
        'INSERT OR REPLACE INTO user_settings (setting_key, setting_value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
        [key, value]
      );
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async getUserSetting(key, defaultValue = null) {
    try {
      const rows = await this.runQuery('SELECT setting_value FROM user_settings WHERE setting_key = ?', [key]);
      return rows.length > 0 ? rows[0].setting_value : defaultValue;
    } catch (err) {
      return defaultValue;
    }
  }

  async getAllUserSettings() {
    try {
      const rows = await this.runQuery('SELECT setting_key, setting_value FROM user_settings');
      const settings = {};
      rows.forEach(row => {
        settings[row.setting_key] = row.setting_value;
      });
      return settings;
    } catch (err) {
      return {};
    }
  }

  async close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = DatabaseManager;
