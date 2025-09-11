#!/usr/bin/env node

/**
 * 数据库表结构修复脚本
 * 基于database-optimization-analysis.md报告修复表结构问题
 */

const DatabaseManager = require('../modules/database/DatabaseManager');

async function fixDatabaseStructure() {
  console.log('🔧 开始修复数据库表结构...');
  
  try {
    const dbManager = new DatabaseManager();
    await dbManager.init();
    
    // 1. 创建复合索引
    console.log('📊 创建复合索引...');
    await createCompositeIndexes(dbManager);
    
    // 2. 删除冗余索引
    console.log('🗑️ 删除冗余索引...');
    await removeRedundantIndexes(dbManager);
    
    // 3. 统一数据类型
    console.log('🔧 统一数据类型...');
    await standardizeDataTypes(dbManager);
    
    // 4. 创建枚举值表
    console.log('📋 创建枚举值表...');
    await createEnumTables(dbManager);
    
    // 5. 数据清理
    console.log('🧹 清理历史数据...');
    await cleanupHistoricalData(dbManager);
    
    // 6. 数据库优化
    console.log('💾 执行数据库优化...');
    await optimizeDatabase(dbManager);
    
    // 7. 生成修复报告
    console.log('📋 生成修复报告...');
    await generateFixReport(dbManager);
    
    console.log('✅ 数据库表结构修复完成！');
    
  } catch (error) {
    console.error('❌ 数据库表结构修复失败:', error);
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
    },
    {
      name: 'idx_data_quality_issues_symbol_time_severity',
      table: 'data_quality_issues',
      columns: ['symbol', 'timestamp', 'severity'],
      description: '数据质量问题查询：按交易对、时间、严重程度查询'
    }
  ];
  
  for (const index of indexes) {
    try {
      const columns = index.columns.join(', ');
      await dbManager.runQuery(`
        CREATE INDEX IF NOT EXISTS ${index.name} 
        ON ${index.table}(${columns})
      `);
      console.log(`✅ 创建复合索引: ${index.name} - ${index.description}`);
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

async function standardizeDataTypes(dbManager) {
  // 统一布尔值类型 - 将BOOLEAN改为INTEGER
  const booleanFields = [
    { table: 'strategy_analysis', field: 'trend_confirmed' },
    { table: 'strategy_analysis', field: 'vwap_direction_consistent' },
    { table: 'strategy_analysis', field: 'breakout_confirmed' },
    { table: 'strategy_analysis', field: 'range_lower_boundary_valid' },
    { table: 'strategy_analysis', field: 'range_upper_boundary_valid' },
    { table: 'strategy_analysis', field: 'last_breakout' },
    { table: 'strategy_analysis', field: 'fake_breakout_detected' },
    { table: 'strategy_analysis', field: 'data_valid' }
  ];
  
  for (const field of booleanFields) {
    try {
      // 检查字段是否存在
      const exists = await dbManager.runQuery(`
        SELECT COUNT(*) as count 
        FROM pragma_table_info('${field.table}') 
        WHERE name = '${field.field}'
      `);
      
      if (exists[0].count > 0) {
        // 更新现有数据：将BOOLEAN值转换为INTEGER
        await dbManager.runQuery(`
          UPDATE ${field.table} 
          SET ${field.field} = CASE 
            WHEN ${field.field} = 1 THEN 1 
            WHEN ${field.field} = 'true' THEN 1 
            WHEN ${field.field} = 'TRUE' THEN 1 
            ELSE 0 
          END
          WHERE ${field.field} IS NOT NULL
        `);
        console.log(`✅ 统一布尔值类型: ${field.table}.${field.field}`);
      }
    } catch (error) {
      console.warn(`⚠️ 统一布尔值类型失败: ${field.table}.${field.field} - ${error.message}`);
    }
  }
}

async function createEnumTables(dbManager) {
  // 创建信号类型枚举表
  try {
    await dbManager.runQuery(`
      CREATE TABLE IF NOT EXISTS signal_types (
        id INTEGER PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        description TEXT
      )
    `);
    
    // 插入枚举值
    await dbManager.runQuery(`
      INSERT OR IGNORE INTO signal_types (id, name, description) VALUES 
      (1, 'LONG', '做多信号'),
      (2, 'SHORT', '做空信号'),
      (3, 'NONE', '无信号'),
      (4, 'BUY', '买入信号'),
      (5, 'SELL', '卖出信号')
    `);
    console.log('✅ 创建信号类型枚举表');
  } catch (error) {
    console.warn(`⚠️ 创建信号类型枚举表失败: ${error.message}`);
  }
  
  // 创建市场类型枚举表
  try {
    await dbManager.runQuery(`
      CREATE TABLE IF NOT EXISTS market_types (
        id INTEGER PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        description TEXT
      )
    `);
    
    await dbManager.runQuery(`
      INSERT OR IGNORE INTO market_types (id, name, description) VALUES 
      (1, 'UPTREND', '多头趋势'),
      (2, 'DOWNTREND', '空头趋势'),
      (3, 'SIDEWAYS', '震荡市'),
      (4, 'TRENDING', '趋势市'),
      (5, 'RANGING', '区间市')
    `);
    console.log('✅ 创建市场类型枚举表');
  } catch (error) {
    console.warn(`⚠️ 创建市场类型枚举表失败: ${error.message}`);
  }
  
  // 创建执行模式枚举表
  try {
    await dbManager.runQuery(`
      CREATE TABLE IF NOT EXISTS execution_modes (
        id INTEGER PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        description TEXT
      )
    `);
    
    await dbManager.runQuery(`
      INSERT OR IGNORE INTO execution_modes (id, name, description) VALUES 
      (1, 'PULLBACK_CONFIRMATION', '回踩确认模式'),
      (2, 'MOMENTUM_BREAKOUT', '动能突破模式'),
      (3, 'FAKE_BREAKOUT_REVERSAL', '假突破反手模式'),
      (4, 'RANGE_TRADING', '区间交易模式'),
      (5, 'NONE', '无执行模式')
    `);
    console.log('✅ 创建执行模式枚举表');
  } catch (error) {
    console.warn(`⚠️ 创建执行模式枚举表失败: ${error.message}`);
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
    },
    {
      table: 'alert_history',
      condition: "timestamp < datetime('now', '-30 days')",
      description: '清理30天前的告警历史'
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

async function optimizeDatabase(dbManager) {
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
    
    // 设置优化参数
    await dbManager.runQuery('PRAGMA synchronous = NORMAL');
    await dbManager.runQuery('PRAGMA journal_mode = WAL');
    await dbManager.runQuery('PRAGMA cache_size = 10000');
    console.log('✅ 设置数据库优化参数');
    
  } catch (error) {
    console.warn(`⚠️ 数据库优化失败: ${error.message}`);
  }
}

async function generateFixReport(dbManager) {
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
    
    console.log('\n📊 数据库表结构修复报告');
    console.log('='.repeat(50));
    console.log(`数据库文件大小: ${totalSize.toFixed(2)} MB`);
    console.log(`表数量: ${tables.length}`);
    console.log(`索引数量: ${indexes.length}`);
    console.log('\n📋 表统计信息:');
    
    tables.forEach(table => {
      console.log(`  ${table.name}: ${table.index_count} 个索引`);
    });
    
    console.log('\n🔍 新增复合索引:');
    const compositeIndexes = indexes.filter(idx => 
      idx.name.includes('symbol_time') || 
      idx.name.includes('symbol_status_time')
    );
    compositeIndexes.forEach(index => {
      console.log(`  ${index.name} (${index.tbl_name})`);
    });
    
    console.log('\n✅ 修复完成项目:');
    console.log('  - 创建复合索引');
    console.log('  - 删除冗余索引');
    console.log('  - 统一数据类型');
    console.log('  - 创建枚举值表');
    console.log('  - 清理历史数据');
    console.log('  - 数据库优化');
    
  } catch (error) {
    console.warn(`⚠️ 生成报告失败: ${error.message}`);
  }
}

// 运行修复
fixDatabaseStructure();
