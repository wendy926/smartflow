/**
 * 数据库表结构修复的基础测试
 */

const DatabaseManager = require('../modules/database/DatabaseManager');

describe('数据库表结构修复基础测试', () => {
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
  });

  test('应该创建枚举值表', async () => {
    // 检查信号类型枚举表
    const signalTypes = await dbManager.runQuery(`
      SELECT name FROM signal_types ORDER BY id
    `);
    
    expect(signalTypes.length).toBeGreaterThan(0);
    const signalTypeNames = signalTypes.map(type => type.name);
    expect(signalTypeNames).toContain('LONG');
  });

  test('应该设置数据库优化参数', async () => {
    // 检查同步模式
    const synchronous = await dbManager.runQuery('PRAGMA synchronous');
    expect(synchronous[0].synchronous).toBe(2); // 2 = NORMAL

    // 检查日志模式
    const journalMode = await dbManager.runQuery('PRAGMA journal_mode');
    expect(journalMode[0].journal_mode).toBe('wal');
  });
});
