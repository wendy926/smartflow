#!/usr/bin/env node

// 内存优化脚本 - 创建数据库表存储原始数据和指标

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'smartflow.db');

async function createMemoryOptimizationTables() {
  const db = new sqlite3.Database(dbPath);

  try {
    console.log('🔧 创建内存优化相关数据库表...');

    // 1. 原始K线数据表
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS kline_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          symbol TEXT NOT NULL,
          interval TEXT NOT NULL,
          open_time INTEGER NOT NULL,
          close_time INTEGER NOT NULL,
          open_price REAL NOT NULL,
          high_price REAL NOT NULL,
          low_price REAL NOT NULL,
          close_price REAL NOT NULL,
          volume REAL NOT NULL,
          quote_volume REAL NOT NULL,
          trades_count INTEGER NOT NULL,
          taker_buy_volume REAL NOT NULL,
          taker_buy_quote_volume REAL NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(symbol, interval, open_time)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 2. 技术指标数据表
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS technical_indicators (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          symbol TEXT NOT NULL,
          interval TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          atr REAL,
          atr14 REAL,
          vwap REAL,
          vwap_direction TEXT,
          delta REAL,
          delta_direction TEXT,
          oi REAL,
          oi_direction TEXT,
          volume_direction TEXT,
          trend_4h TEXT,
          trend_1h TEXT,
          score_1h REAL,
          market_type TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(symbol, interval, timestamp)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 3. 聚合指标表（15分钟数据）
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS aggregated_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          symbol TEXT NOT NULL,
          time_window TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          avg_atr REAL,
          avg_vwap REAL,
          avg_delta REAL,
          avg_oi REAL,
          trend_consistency REAL,
          signal_strength REAL,
          market_volatility REAL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(symbol, time_window, timestamp)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 4. 内存缓存状态表
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS memory_cache_status (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cache_key TEXT UNIQUE NOT NULL,
          cache_type TEXT NOT NULL,
          data_size INTEGER NOT NULL,
          last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME NOT NULL
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 5. 创建索引优化查询性能
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_kline_symbol_time ON kline_data(symbol, open_time)',
      'CREATE INDEX IF NOT EXISTS idx_indicators_symbol_time ON technical_indicators(symbol, timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_aggregated_symbol_time ON aggregated_metrics(symbol, timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_cache_expires ON memory_cache_status(expires_at)',
      'CREATE INDEX IF NOT EXISTS idx_kline_interval ON kline_data(interval)',
      'CREATE INDEX IF NOT EXISTS idx_indicators_interval ON technical_indicators(interval)'
    ];

    for (const indexSQL of indexes) {
      await new Promise((resolve, reject) => {
        db.run(indexSQL, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    console.log('✅ 数据库表创建完成');

    // 6. 清理旧数据
    const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
    
    await new Promise((resolve, reject) => {
      db.run(`
        DELETE FROM memory_cache_status 
        WHERE expires_at < datetime('now', '-15 minutes')
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log('✅ 清理过期缓存数据完成');

  } catch (error) {
    console.error('❌ 创建表失败:', error);
  } finally {
    db.close();
  }
}

createMemoryOptimizationTables();
