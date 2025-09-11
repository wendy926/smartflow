#!/usr/bin/env node

/**
 * 数据库优化脚本 V2
 * 基于分析报告进行数据库结构优化
 */

const DatabaseManager = require('../modules/database/DatabaseManager');

async function optimizeDatabase() {
  console.log('🚀 开始数据库优化 V2...');
  
  try {
    const dbManager = new DatabaseManager();
    await dbManager.init();
    
    // 1. 创建复合索引
    console.log('📊 创建复合索引...');
    await createCompositeIndexes(dbManager);
    
    // 2. 删除冗余索引
    console.log('🗑️ 删除冗余索引...');
    await removeRedundantIndexes(dbManager);
    
    // 3. 数据清理
    console.log('🧹 清理历史数据...');
    await cleanupHistoricalData(dbManager);
    
    // 4. 数据库压缩
    console.log('💾 执行数据库压缩...');
    await compressDatabase(dbManager);
    
    // 5. 生成优化报告
    console.log('📋 生成优化报告...');
    await generateOptimizationReport(dbManager);
    
    console.log('✅ 数据库优化完成！');
    
  } catch (error) {
    console.error('❌ 数据库优化失败:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

async function createCompositeIndexes(dbManager) {
  const indexes = [
    {
      name: 'idx_strategy_analysis_symbol_time_trend',
      table: 'strategy_analysis',
      columns: ['symbol', 'timestamp', 'trend4h'],
      description: '主要查询模式：按交易对、时间、趋势查询'
    },
    {
      name: 'idx_strategy_analysis_symbol_time_market',
      table: 'strategy_analysis',
      columns: ['symbol', 'timestamp', 'market_type'],
      description: '市场类型查询：按交易对、时间、市场类型查询'
    },
    {
      name: 'idx_strategy_analysis_symbol_time_signal',
      table: 'strategy_analysis',
      columns: ['symbol', 'timestamp', 'signal'],
      description: '信号查询：按交易对、时间、信号查询'
    },
    {
      name: 'idx_analysis_logs_symbol_time_type',
      table: 'analysis_logs',
      columns: ['symbol', 'timestamp', 'analysis_type'],
      description: '分析日志查询：按交易对、时间、分析类型查询'
    },
    {
      name: 'idx_simulations_symbol_status_time',
      table: 'simulations',
      columns: ['symbol', 'status', 'created_at'],
      description: '模拟交易查询：按交易对、状态、创建时间查询'
    }
  ];
  
  for (const index of indexes) {
    try {
      const columns = index.columns.join(', ');
      await dbManager.runQuery(`
        CREATE INDEX IF NOT EXISTS ${index.name} 
        ON ${index.table}(${columns})
      `);
      console.log(`✅ 创建索引: ${index.name} - ${index.description}`);
    } catch (error) {
      console.warn(`⚠️ 创建索引失败: ${index.name} - ${error.message}`);
    }
  }
}

async function removeRedundantIndexes(dbManager) {
  const redundantIndexes = [
    'idx_strategy_analysis_trend',
    'idx_strategy_analysis_signal',
    'idx_strategy_analysis_execution',
    'idx_strategy_analysis_trend4h',
    'idx_strategy_analysis_market_type'
  ];
  
  for (const indexName of redundantIndexes) {
    try {
      await dbManager.runQuery(`DROP INDEX IF EXISTS ${indexName}`);
      console.log(`✅ 删除冗余索引: ${indexName}`);
    } catch (error) {
      console.warn(`⚠️ 删除索引失败: ${indexName} - ${error.message}`);
    }
  }
}

async function cleanupHistoricalData(dbManager) {
  const cleanupQueries = [
    {
      table: 'strategy_analysis',
      condition: "timestamp < datetime('now', '-30 days')",
      description: '清理30天前的策略分析数据'
    },
    {
      table: 'analysis_logs',
      condition: "timestamp < datetime('now', '-14 days')",
      description: '清理14天前的分析日志'
    },
    {
      table: 'data_quality_issues',
      condition: "timestamp < datetime('now', '-7 days')",
      description: '清理7天前的数据质量问题记录'
    },
    {
      table: 'validation_results',
      condition: "timestamp < datetime('now', '-3 days')",
      description: '清理3天前的验证结果'
    }
  ];
  
  for (const query of cleanupQueries) {
    try {
      const result = await dbManager.runQuery(`
        DELETE FROM ${query.table} 
        WHERE ${query.condition}
      `);
      console.log(`✅ ${query.description}: 删除了 ${result.changes || 0} 条记录`);
    } catch (error) {
      console.warn(`⚠️ 清理数据失败: ${query.table} - ${error.message}`);
    }
  }
}

async function compressDatabase(dbManager) {
  try {
    // 执行VACUUM优化
    await dbManager.runQuery('VACUUM');
    console.log('✅ 执行VACUUM优化');
    
    // 重建索引
    await dbManager.runQuery('REINDEX');
    console.log('✅ 重建索引');
    
    // 分析数据库
    await dbManager.runQuery('ANALYZE');
    console.log('✅ 分析数据库统计信息');
    
  } catch (error) {
    console.warn(`⚠️ 数据库压缩失败: ${error.message}`);
  }
}

async function generateOptimizationReport(dbManager) {
  try {
    // 获取表统计信息
    const tables = await dbManager.runQuery(`
      SELECT name, 
             (SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND tbl_name=name) as index_count
      FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);
    
    // 获取索引统计信息
    const indexes = await dbManager.runQuery(`
      SELECT name, tbl_name, sql
      FROM sqlite_master 
      WHERE type='index' AND name NOT LIKE 'sqlite_%'
      ORDER BY tbl_name, name
    `);
    
    // 获取数据库文件大小
    const dbSize = await dbManager.runQuery("PRAGMA page_count");
    const pageSize = await dbManager.runQuery("PRAGMA page_size");
    const totalSize = (dbSize[0].page_count * pageSize[0].page_size) / 1024 / 1024; // MB
    
    console.log('\n📊 数据库优化报告');
    console.log('='.repeat(50));
    console.log(`数据库文件大小: ${totalSize.toFixed(2)} MB`);
    console.log(`表数量: ${tables.length}`);
    console.log(`索引数量: ${indexes.length}`);
    console.log('\n📋 表统计信息:');
    
    tables.forEach(table => {
      console.log(`  ${table.name}: ${table.index_count} 个索引`);
    });
    
    console.log('\n🔍 索引详情:');
    indexes.forEach(index => {
      console.log(`  ${index.name} (${index.tbl_name})`);
    });
    
  } catch (error) {
    console.warn(`⚠️ 生成报告失败: ${error.message}`);
  }
}

// 运行优化
optimizeDatabase();
