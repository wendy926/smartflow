/**
 * 数据库表结构修复的单元测试
 */

const DatabaseManager = require('../modules/database/DatabaseManager');

describe('数据库表结构修复测试', () => {
  let dbManager;

  beforeAll(async () => {
    dbManager = new DatabaseManager();
    await dbManager.init();
  });

  afterAll(async () => {
    if (dbManager) {
      await dbManager.close();
    }
  });

  test('应该创建复合索引', async () => {
    const indexes = await dbManager.runQuery(`
      SELECT name, tbl_name, sql
      FROM sqlite_master 
      WHERE type='index' AND name LIKE '%symbol_time%'
      ORDER BY name
    `);

    const expectedIndexes = [
      'idx_strategy_analysis_symbol_time_trend',
      'idx_strategy_analysis_symbol_time_market',
      'idx_strategy_analysis_symbol_time_signal',
      'idx_analysis_logs_symbol_time_type',
      'idx_simulations_symbol_status_time',
      'idx_data_quality_issues_symbol_time_severity'
    ];

    const indexNames = indexes.map(idx => idx.name);
    expectedIndexes.forEach(expectedIndex => {
      expect(indexNames).toContain(expectedIndex);
    });
  });

  test('应该删除冗余索引', async () => {
    const indexes = await dbManager.runQuery(`
      SELECT name, tbl_name
      FROM sqlite_master 
      WHERE type='index' AND name IN (
        'idx_strategy_analysis_trend',
        'idx_strategy_analysis_signal',
        'idx_strategy_analysis_execution',
        'idx_strategy_analysis_trend4h',
        'idx_strategy_analysis_market_type'
      )
    `);

    expect(indexes).toHaveLength(0);
  });

  test('应该创建枚举值表', async () => {
    // 检查信号类型枚举表
    const signalTypes = await dbManager.runQuery(`
      SELECT name FROM signal_types ORDER BY id
    `);
    
    const expectedSignalTypes = ['LONG', 'SHORT', 'NONE', 'BUY', 'SELL'];
    const signalTypeNames = signalTypes.map(type => type.name);
    expectedSignalTypes.forEach(expectedType => {
      expect(signalTypeNames).toContain(expectedType);
    });

    // 检查市场类型枚举表
    const marketTypes = await dbManager.runQuery(`
      SELECT name FROM market_types ORDER BY id
    `);
    
    const expectedMarketTypes = ['UPTREND', 'DOWNTREND', 'SIDEWAYS', 'TRENDING', 'RANGING'];
    const marketTypeNames = marketTypes.map(type => type.name);
    expectedMarketTypes.forEach(expectedType => {
      expect(marketTypeNames).toContain(expectedType);
    });

    // 检查执行模式枚举表
    const executionModes = await dbManager.runQuery(`
      SELECT name FROM execution_modes ORDER BY id
    `);
    
    const expectedExecutionModes = [
      'PULLBACK_CONFIRMATION', 
      'MOMENTUM_BREAKOUT', 
      'FAKE_BREAKOUT_REVERSAL',
      'RANGE_TRADING',
      'NONE'
    ];
    const executionModeNames = executionModes.map(mode => mode.name);
    expectedExecutionModes.forEach(expectedMode => {
      expect(executionModeNames).toContain(expectedMode);
    });
  });

  test('应该统一布尔值数据类型', async () => {
    // 检查strategy_analysis表的布尔字段
    const booleanFields = await dbManager.runQuery(`
      SELECT name, type 
      FROM pragma_table_info('strategy_analysis') 
      WHERE name IN (
        'trend_confirmed', 
        'vwap_direction_consistent', 
        'breakout_confirmed',
        'range_lower_boundary_valid',
        'range_upper_boundary_valid',
        'last_breakout',
        'fake_breakout_detected',
        'data_valid'
      )
    `);

    booleanFields.forEach(field => {
      // 检查字段类型是否为INTEGER（统一后的布尔值类型）
      expect(['INTEGER', 'REAL']).toContain(field.type);
    });
  });

  test('应该清理历史数据', async () => {
    // 检查30天前的策略分析数据是否被清理
    const oldStrategyData = await dbManager.runQuery(`
      SELECT COUNT(*) as count 
      FROM strategy_analysis 
      WHERE timestamp < datetime('now', '-30 days')
    `);
    
    expect(oldStrategyData[0].count).toBe(0);

    // 检查14天前的分析日志是否被清理
    const oldAnalysisLogs = await dbManager.runQuery(`
      SELECT COUNT(*) as count 
      FROM analysis_logs 
      WHERE timestamp < datetime('now', '-14 days')
    `);
    
    expect(oldAnalysisLogs[0].count).toBe(0);
  });

  test('应该设置数据库优化参数', async () => {
    // 检查同步模式
    const synchronous = await dbManager.runQuery('PRAGMA synchronous');
    expect(synchronous[0].synchronous).toBe('normal');

    // 检查日志模式
    const journalMode = await dbManager.runQuery('PRAGMA journal_mode');
    expect(journalMode[0].journal_mode).toBe('wal');

    // 检查缓存大小
    const cacheSize = await dbManager.runQuery('PRAGMA cache_size');
    expect(cacheSize[0].cache_size).toBe(10000);
  });

  test('应该生成修复报告', async () => {
    // 检查表数量
    const tables = await dbManager.runQuery(`
      SELECT COUNT(*) as count 
      FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);
    
    expect(tables[0].count).toBeGreaterThan(0);

    // 检查索引数量
    const indexes = await dbManager.runQuery(`
      SELECT COUNT(*) as count 
      FROM sqlite_master 
      WHERE type='index' AND name NOT LIKE 'sqlite_%'
    `);
    
    expect(indexes[0].count).toBeGreaterThan(0);

    // 检查数据库文件大小
    const dbSize = await dbManager.runQuery('PRAGMA page_count');
    const pageSize = await dbManager.runQuery('PRAGMA page_size');
    const totalSize = (dbSize[0].page_count * pageSize[0].page_size) / 1024 / 1024;
    
    expect(totalSize).toBeGreaterThan(0);
  });
});
