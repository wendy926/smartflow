/**
 * 数据库表结构修复的简化单元测试
 */

const DatabaseManager = require('../modules/database/DatabaseManager');

describe('数据库表结构修复测试（简化版）', () => {
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
      SELECT name, tbl_name
      FROM sqlite_master 
      WHERE type='index' AND name LIKE '%symbol_time%'
      ORDER BY name
    `);

    // 检查是否有复合索引
    expect(indexes.length).toBeGreaterThan(0);

    // 检查特定的复合索引
    const indexNames = indexes.map(idx => idx.name);
    expect(indexNames).toContain('idx_strategy_analysis_symbol_time_trend');
    expect(indexNames).toContain('idx_strategy_analysis_symbol_time_market');
    expect(indexNames).toContain('idx_strategy_analysis_symbol_time_signal');
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

    expect(signalTypes.length).toBeGreaterThan(0);
    const signalTypeNames = signalTypes.map(type => type.name);
    expect(signalTypeNames).toContain('LONG');
    expect(signalTypeNames).toContain('SHORT');
    expect(signalTypeNames).toContain('NONE');

    // 检查市场类型枚举表
    const marketTypes = await dbManager.runQuery(`
      SELECT name FROM market_types ORDER BY id
    `);

    expect(marketTypes.length).toBeGreaterThan(0);
    const marketTypeNames = marketTypes.map(type => type.name);
    expect(marketTypeNames).toContain('UPTREND');
    expect(marketTypeNames).toContain('DOWNTREND');
    expect(marketTypeNames).toContain('SIDEWAYS');

    // 检查执行模式枚举表
    const executionModes = await dbManager.runQuery(`
      SELECT name FROM execution_modes ORDER BY id
    `);

    expect(executionModes.length).toBeGreaterThan(0);
    const executionModeNames = executionModes.map(mode => mode.name);
    expect(executionModeNames).toContain('PULLBACK_CONFIRMATION');
    expect(executionModeNames).toContain('MOMENTUM_BREAKOUT');
    expect(executionModeNames).toContain('NONE');
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

    // 确保至少有一些布尔字段被检查
    expect(booleanFields.length).toBeGreaterThan(0);

    // 检查字段类型是否为INTEGER或REAL（统一后的布尔值类型）
    booleanFields.forEach(field => {
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

    // 检查3天前的验证结果是否被清理
    const oldValidationResults = await dbManager.runQuery(`
      SELECT COUNT(*) as count 
      FROM validation_results 
      WHERE timestamp < datetime('now', '-3 days')
    `);

    expect(oldValidationResults[0].count).toBe(0);
  });

  test('应该设置数据库优化参数', async () => {
    // 检查同步模式
    const synchronous = await dbManager.runQuery('PRAGMA synchronous');
    expect(synchronous[0].synchronous).toBe(2); // 2 = NORMAL

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
