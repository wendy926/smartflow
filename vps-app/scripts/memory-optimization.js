#!/usr/bin/env node

/**
 * VPS内存优化脚本
 * 用于清理历史数据和优化缓存配置
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class MemoryOptimizer {
  constructor() {
    this.dbPath = path.join(__dirname, '..', 'smartflow.db');
    this.db = null;
  }

  async connect() {
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

  async close() {
    if (this.db) {
      return new Promise((resolve) => {
        this.db.close((err) => {
          if (err) {
            console.error('❌ 关闭数据库失败:', err.message);
          } else {
            console.log('✅ 数据库连接已关闭');
          }
          resolve();
        });
      });
    }
  }

  async getTableStats() {
    const tables = [
      'strategy_analysis',
      'simulations', 
      'kline_data',
      'technical_indicators',
      'aggregated_metrics',
      'analysis_logs',
      'data_quality_issues',
      'data_refresh_log'
    ];

    const stats = {};
    
    for (const table of tables) {
      try {
        const count = await this.runQuery(`SELECT COUNT(*) as count FROM ${table}`);
        stats[table] = count[0].count;
      } catch (error) {
        console.warn(`⚠️ 无法获取表 ${table} 的统计信息:`, error.message);
        stats[table] = 0;
      }
    }

    return stats;
  }

  runQuery(sql, params = []) {
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

  async cleanupOldData() {
    console.log('🧹 开始清理历史数据...');
    
    const cleanupTasks = [
      {
        name: '清理7天前的策略分析数据',
        sql: 'DELETE FROM strategy_analysis WHERE created_at < datetime("now", "-7 days")',
        table: 'strategy_analysis'
      },
      {
        name: '清理30天前的K线数据',
        sql: 'DELETE FROM kline_data WHERE timestamp < datetime("now", "-30 days")',
        table: 'kline_data'
      },
      {
        name: '清理30天前的技术指标数据',
        sql: 'DELETE FROM technical_indicators WHERE timestamp < datetime("now", "-30 days")',
        table: 'technical_indicators'
      },
      {
        name: '清理30天前的聚合指标数据',
        sql: 'DELETE FROM aggregated_metrics WHERE timestamp < datetime("now", "-30 days")',
        table: 'aggregated_metrics'
      },
      {
        name: '清理7天前的分析日志',
        sql: 'DELETE FROM analysis_logs WHERE timestamp < datetime("now", "-7 days")',
        table: 'analysis_logs'
      },
      {
        name: '清理7天前的数据质量问题记录',
        sql: 'DELETE FROM data_quality_issues WHERE created_at < datetime("now", "-7 days")',
        table: 'data_quality_issues'
      },
      {
        name: '清理7天前的数据刷新日志',
        sql: 'DELETE FROM data_refresh_log WHERE timestamp < datetime("now", "-7 days")',
        table: 'data_refresh_log'
      }
    ];

    for (const task of cleanupTasks) {
      try {
        console.log(`  🔄 ${task.name}...`);
        const result = await this.runQuery(task.sql);
        console.log(`  ✅ ${task.name}完成`);
      } catch (error) {
        console.warn(`  ⚠️ ${task.name}失败:`, error.message);
      }
    }
  }

  async optimizeDatabase() {
    console.log('🔧 开始优化数据库...');
    
    try {
      // 重建索引
      await this.runQuery('REINDEX');
      console.log('  ✅ 重建索引完成');
      
      // 分析数据库
      await this.runQuery('ANALYZE');
      console.log('  ✅ 数据库分析完成');
      
      // 清理空闲空间
      await this.runQuery('VACUUM');
      console.log('  ✅ 数据库压缩完成');
      
    } catch (error) {
      console.warn('  ⚠️ 数据库优化失败:', error.message);
    }
  }

  async updateCacheConfig() {
    console.log('⚙️ 更新缓存配置...');
    
    // 这里可以更新CacheManager的配置
    // 由于是运行时配置，我们通过环境变量或配置文件来调整
    console.log('  📝 建议的缓存配置:');
    console.log('    - maxMemoryCacheSize: 5000 (从1000增加到5000)');
    console.log('    - 启用更积极的缓存清理');
    console.log('    - 减少监控数据的TTL');
  }

  async run() {
    try {
      await this.connect();
      
      console.log('📊 当前数据库统计:');
      const beforeStats = await this.getTableStats();
      Object.entries(beforeStats).forEach(([table, count]) => {
        console.log(`  ${table}: ${count} 条记录`);
      });
      
      console.log('\n🧹 开始清理历史数据...');
      await this.cleanupOldData();
      
      console.log('\n📊 清理后数据库统计:');
      const afterStats = await this.getTableStats();
      Object.entries(afterStats).forEach(([table, count]) => {
        const before = beforeStats[table] || 0;
        const cleaned = before - count;
        console.log(`  ${table}: ${count} 条记录 (清理了 ${cleaned} 条)`);
      });
      
      console.log('\n🔧 优化数据库...');
      await this.optimizeDatabase();
      
      console.log('\n⚙️ 缓存配置建议:');
      await this.updateCacheConfig();
      
      console.log('\n✅ 内存优化完成!');
      
    } catch (error) {
      console.error('❌ 内存优化失败:', error);
    } finally {
      await this.close();
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const optimizer = new MemoryOptimizer();
  optimizer.run().catch(console.error);
}

module.exports = MemoryOptimizer;
