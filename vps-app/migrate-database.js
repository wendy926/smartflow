#!/usr/bin/env node

/**
 * 数据库迁移脚本 - 为strategy-v2.md策略逻辑创建新的表结构
 * 运行方式: node migrate-database.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseMigrator {
  constructor() {
    this.dbPath = path.join(__dirname, 'smartflow.db');
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('❌ 数据库连接失败:', err.message);
          reject(err);
        } else {
          console.log('✅ 数据库连接成功');
          resolve();
        }
      });
    });
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

  async migrate() {
    try {
      console.log('🚀 开始数据库迁移...');

      // 检查strategy_analysis表是否已存在
      const tableExists = await this.runQuery(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='strategy_analysis'
      `);

      if (tableExists.length === 0) {
        console.log('📊 创建strategy_analysis表...');

        await this.run(`
          CREATE TABLE strategy_analysis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            -- 天级趋势数据
            trend TEXT,
            trend_strength TEXT,
            ma20 REAL,
            ma50 REAL,
            ma200 REAL,
            bbw_expanding BOOLEAN,
            -- 小时级趋势加强数据
            signal TEXT,
            signal_strength TEXT,
            hourly_score INTEGER,
            vwap REAL,
            oi_change REAL,
            funding_rate REAL,
            -- 15分钟入场执行数据
            execution TEXT,
            execution_mode TEXT,
            mode_a BOOLEAN,
            mode_b BOOLEAN,
            entry_signal REAL,
            stop_loss REAL,
            take_profit REAL,
            -- 基础信息
            current_price REAL,
            data_collection_rate REAL,
            -- 完整数据JSON
            full_analysis_data TEXT,
            -- 数据质量
            data_valid BOOLEAN DEFAULT TRUE,
            error_message TEXT
          )
        `);

        console.log('✅ strategy_analysis表创建成功');

        // 创建索引以提高查询性能
        console.log('📈 创建索引...');
        await this.run('CREATE INDEX IF NOT EXISTS idx_strategy_analysis_symbol ON strategy_analysis(symbol)');
        await this.run('CREATE INDEX IF NOT EXISTS idx_strategy_analysis_timestamp ON strategy_analysis(timestamp)');
        await this.run('CREATE INDEX IF NOT EXISTS idx_strategy_analysis_trend ON strategy_analysis(trend)');
        await this.run('CREATE INDEX IF NOT EXISTS idx_strategy_analysis_signal ON strategy_analysis(signal)');
        await this.run('CREATE INDEX IF NOT EXISTS idx_strategy_analysis_execution ON strategy_analysis(execution)');

        console.log('✅ 索引创建成功');
      } else {
        console.log('ℹ️  strategy_analysis表已存在，跳过创建');
      }

      // 检查现有表的数据统计
      const stats = await this.getTableStats();
      console.log('📊 数据库统计信息:');
      console.log(`   - strategy_analysis: ${stats.strategyAnalysis} 条记录`);
      console.log(`   - signal_records: ${stats.signalRecords} 条记录`);
      console.log(`   - execution_records: ${stats.executionRecords} 条记录`);
      console.log(`   - simulations: ${stats.simulations} 条记录`);

      console.log('✅ 数据库迁移完成');
    } catch (error) {
      console.error('❌ 数据库迁移失败:', error);
      throw error;
    }
  }

  async getTableStats() {
    const stats = {
      strategyAnalysis: 0,
      signalRecords: 0,
      executionRecords: 0,
      simulations: 0
    };

    try {
      const strategyResult = await this.runQuery('SELECT COUNT(*) as count FROM strategy_analysis');
      stats.strategyAnalysis = strategyResult[0].count;
    } catch (err) {
      // 表可能不存在
    }

    try {
      const signalResult = await this.runQuery('SELECT COUNT(*) as count FROM signal_records');
      stats.signalRecords = signalResult[0].count;
    } catch (err) {
      // 表可能不存在
    }

    try {
      const executionResult = await this.runQuery('SELECT COUNT(*) as count FROM execution_records');
      stats.executionRecords = executionResult[0].count;
    } catch (err) {
      // 表可能不存在
    }

    try {
      const simulationResult = await this.runQuery('SELECT COUNT(*) as count FROM simulations');
      stats.simulations = simulationResult[0].count;
    } catch (err) {
      // 表可能不存在
    }

    return stats;
  }

  async close() {
    if (this.db) {
      this.db.close();
    }
  }
}

// 主执行函数
async function main() {
  const migrator = new DatabaseMigrator();

  try {
    await migrator.init();
    await migrator.migrate();
  } catch (error) {
    console.error('迁移失败:', error);
    process.exit(1);
  } finally {
    await migrator.close();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = DatabaseMigrator;
