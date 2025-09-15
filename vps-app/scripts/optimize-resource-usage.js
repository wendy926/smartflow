#!/usr/bin/env node

/**
 * 资源使用优化脚本
 * 解决单测导致VPS实例CPU、IO、内存上涨的问题
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'smartflow.db');

class ResourceOptimizer {
  constructor() {
    this.db = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(dbPath, (err) => {
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

  async close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('❌ 关闭数据库失败:', err.message);
          } else {
            console.log('✅ 数据库连接已关闭');
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * 优化定时器配置
   */
  async optimizeTimerConfiguration() {
    console.log('🔧 优化定时器配置...');

    // 创建定时器配置表
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS timer_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timer_name TEXT UNIQUE NOT NULL,
        interval_ms INTEGER NOT NULL,
        is_enabled BOOLEAN DEFAULT 1,
        last_run TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await this.runQuery(createTableSQL);

    // 优化的定时器配置
    const optimizedTimers = [
      { name: 'kline_update', interval: 45 * 60 * 1000, enabled: 1 }, // 45分钟
      { name: 'trend_analysis', interval: 90 * 60 * 1000, enabled: 1 }, // 90分钟
      { name: 'signal_scoring', interval: 10 * 60 * 1000, enabled: 1 }, // 10分钟
      { name: 'execution_check', interval: 5 * 60 * 1000, enabled: 1 }, // 5分钟
      { name: 'simulation_monitor', interval: 15 * 60 * 1000, enabled: 1 }, // 15分钟
      { name: 'delta_reset', interval: 20 * 60 * 1000, enabled: 1 }, // 20分钟
      { name: 'alert_check', interval: 30 * 60 * 1000, enabled: 1 }, // 30分钟
      { name: 'memory_cleanup', interval: 60 * 60 * 1000, enabled: 1 }, // 60分钟
      { name: 'memory_monitor', interval: 5 * 60 * 1000, enabled: 1 } // 5分钟
    ];

    for (const timer of optimizedTimers) {
      const insertSQL = `
        INSERT OR REPLACE INTO timer_config (timer_name, interval_ms, is_enabled, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `;
      await this.runQuery(insertSQL, [timer.name, timer.interval, timer.enabled]);
      console.log(`  ✅ 配置定时器: ${timer.name} - ${timer.interval / 1000 / 60}分钟`);
    }
  }

  /**
   * 优化数据库索引
   */
  async optimizeDatabaseIndexes() {
    console.log('📊 优化数据库索引...');

    const indexes = [
      {
        name: 'idx_strategy_analysis_symbol_timestamp',
        sql: 'CREATE INDEX IF NOT EXISTS idx_strategy_analysis_symbol_timestamp ON strategy_analysis (symbol, timestamp)'
      },
      {
        name: 'idx_simulations_symbol_status',
        sql: 'CREATE INDEX IF NOT EXISTS idx_simulations_symbol_status ON simulations (symbol, status)'
      },
      {
        name: 'idx_indicator_monitoring_timestamp',
        sql: 'CREATE INDEX IF NOT EXISTS idx_indicator_monitoring_timestamp ON indicator_monitoring (timestamp)'
      },
      {
        name: 'idx_kline_data_symbol_interval',
        sql: 'CREATE INDEX IF NOT EXISTS idx_kline_data_symbol_interval ON kline_data (symbol, interval)'
      }
    ];

    for (const index of indexes) {
      try {
        await this.runQuery(index.sql);
        console.log(`  ✅ 创建索引: ${index.name}`);
      } catch (error) {
        console.warn(`  ⚠️ 创建索引失败: ${index.name} - ${error.message}`);
      }
    }
  }

  /**
   * 清理过期的监控数据
   */
  async cleanupOldMonitoringData() {
    console.log('🧹 清理过期的监控数据...');

    const cleanupTasks = [
      {
        name: '清理7天前的指标监控数据',
        sql: 'DELETE FROM indicator_monitoring WHERE timestamp < datetime("now", "-7 days")'
      },
      {
        name: '清理3天前的分析日志',
        sql: 'DELETE FROM analysis_logs WHERE timestamp < datetime("now", "-3 days")'
      },
      {
        name: '清理1天前的数据刷新日志',
        sql: 'DELETE FROM data_refresh_log WHERE timestamp < datetime("now", "-1 day")'
      }
    ];

    for (const task of cleanupTasks) {
      try {
        const result = await this.runQuery(task.sql);
        console.log(`  ✅ ${task.name}完成`);
      } catch (error) {
        console.warn(`  ⚠️ ${task.name}失败: ${error.message}`);
      }
    }
  }

  /**
   * 设置资源限制配置
   */
  async setResourceLimits() {
    console.log('⚙️ 设置资源限制配置...');

    // 创建资源限制配置表
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS resource_limits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        limit_name TEXT UNIQUE NOT NULL,
        limit_value INTEGER NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await this.runQuery(createTableSQL);

    const limits = [
      { name: 'max_concurrent_analysis', value: 3, description: '最大并发策略分析数' },
      { name: 'max_memory_usage_mb', value: 512, description: '最大内存使用量(MB)' },
      { name: 'max_api_calls_per_minute', value: 60, description: '每分钟最大API调用数' },
      { name: 'max_database_connections', value: 5, description: '最大数据库连接数' }
    ];

    for (const limit of limits) {
      const insertSQL = `
        INSERT OR REPLACE INTO resource_limits (limit_name, limit_value, description, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `;
      await this.runQuery(insertSQL, [limit.name, limit.value, limit.description]);
      console.log(`  ✅ 设置限制: ${limit.name} = ${limit.value}`);
    }
  }

  /**
   * 执行查询
   */
  runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes, lastID: this.lastID });
        }
      });
    });
  }

  /**
   * 执行所有优化
   */
  async run() {
    try {
      await this.connect();
      
      console.log('🚀 开始资源使用优化...\n');

      await this.optimizeTimerConfiguration();
      console.log('');

      await this.optimizeDatabaseIndexes();
      console.log('');

      await this.cleanupOldMonitoringData();
      console.log('');

      await this.setResourceLimits();
      console.log('');

      // 执行数据库压缩
      console.log('💾 执行数据库压缩...');
      await this.runQuery('VACUUM');
      console.log('✅ 数据库压缩完成');

      console.log('\n🎉 资源使用优化完成!');
      console.log('\n📋 优化总结:');
      console.log('  - 优化了定时器配置，减少了执行频率');
      console.log('  - 创建了数据库索引，提高查询效率');
      console.log('  - 清理了过期的监控数据');
      console.log('  - 设置了资源使用限制');
      console.log('  - 执行了数据库压缩');

    } catch (error) {
      console.error('❌ 优化失败:', error);
    } finally {
      await this.close();
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const optimizer = new ResourceOptimizer();
  optimizer.run().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('❌ 运行失败:', error);
    process.exit(1);
  });
}

module.exports = ResourceOptimizer;
