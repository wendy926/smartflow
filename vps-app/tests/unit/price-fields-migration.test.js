// price-fields-migration.test.js - 价格字段迁移单元测试

const Database = require('better-sqlite3');
const PriceFieldsMigration = require('../../src/core/modules/database/PriceFieldsMigration');

describe('价格字段数据库迁移测试', () => {
  let db;
  let migration;

  beforeEach(() => {
    // 使用内存数据库进行测试
    db = new Database(':memory:');
    migration = new PriceFieldsMigration(db);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  describe('数据库迁移', () => {
    test('应该成功执行完整迁移', async () => {
      const result = await migration.migrate();
      
      expect(result.success).toBe(true);
      expect(result.version).toBe('1.0.0');
      expect(result.timestamp).toBeDefined();
    });

    test('应该创建ICT价格表', async () => {
      await migration.createPriceDataTables();
      
      // 检查表是否存在
      const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ict_price_ranges'").get();
      expect(tableInfo).toBeDefined();
      expect(tableInfo.name).toBe('ict_price_ranges');
    });

    test('应该创建V3价格表', async () => {
      await migration.createPriceDataTables();
      
      // 检查表是否存在
      const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='v3_price_ranges'").get();
      expect(tableInfo).toBeDefined();
      expect(tableInfo.name).toBe('v3_price_ranges');
    });

    test('ICT价格表应该有正确的字段', async () => {
      await migration.createPriceDataTables();
      
      const columns = db.prepare('PRAGMA table_info(ict_price_ranges)').all();
      const columnNames = columns.map(col => col.name);
      
      // 检查关键字段
      expect(columnNames).toContain('symbol');
      expect(columnNames).toContain('ob_upper_price');
      expect(columnNames).toContain('ob_lower_price');
      expect(columnNames).toContain('fvg_upper_price');
      expect(columnNames).toContain('fvg_lower_price');
      expect(columnNames).toContain('priority_score');
      expect(columnNames).toContain('is_active');
    });

    test('V3价格表应该有正确的字段', async () => {
      await migration.createPriceDataTables();
      
      const columns = db.prepare('PRAGMA table_info(v3_price_ranges)').all();
      const columnNames = columns.map(col => col.name);
      
      // 检查关键字段
      expect(columnNames).toContain('symbol');
      expect(columnNames).toContain('range_upper_boundary');
      expect(columnNames).toContain('range_lower_boundary');
      expect(columnNames).toContain('trend_entry_price');
      expect(columnNames).toContain('trend_confirmation_price');
      expect(columnNames).toContain('market_type');
      expect(columnNames).toContain('priority_score');
    });
  });

  describe('索引创建', () => {
    test('应该创建必要的索引', async () => {
      await migration.createPriceDataTables();
      await migration.createPerformanceIndexes();
      
      const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all();
      const indexNames = indexes.map(idx => idx.name);
      
      // 检查关键索引
      expect(indexNames).toContain('idx_ict_symbol_active');
      expect(indexNames).toContain('idx_v3_symbol_active');
      expect(indexNames).toContain('idx_ict_strength_scores');
      expect(indexNames).toContain('idx_v3_market_type');
    });
  });

  describe('数据验证', () => {
    test('应该验证迁移结果', async () => {
      await migration.createPriceDataTables();
      
      // 验证应该成功
      await expect(migration.validateMigration()).resolves.not.toThrow();
    });

    test('缺少表时验证应该失败', async () => {
      // 不创建表，直接验证
      await expect(migration.validateMigration()).rejects.toThrow();
    });
  });

  describe('迁移状态管理', () => {
    test('应该记录迁移状态', async () => {
      await migration.checkMigrationStatus();
      await migration.recordMigrationStatus();
      
      const record = db.prepare(
        'SELECT * FROM migration_history WHERE migration_name = ? AND version = ?'
      ).get('PriceFieldsMigration', '1.0.0');
      
      expect(record).toBeDefined();
      expect(record.status).toBe('completed');
    });

    test('重复迁移应该被跳过', async () => {
      // 第一次迁移
      await migration.migrate();
      
      // 创建新的迁移实例
      const migration2 = new PriceFieldsMigration(db);
      
      // 检查状态应该返回false（跳过）
      const shouldMigrate = await migration2.checkMigrationStatus();
      expect(shouldMigrate).toBe(false);
    });
  });

  describe('默认数据初始化', () => {
    test('应该为现有交易对初始化默认数据', async () => {
      // 先创建一些测试数据
      db.exec(`
        CREATE TABLE IF NOT EXISTS strategy_analysis (
          id INTEGER PRIMARY KEY,
          symbol TEXT NOT NULL
        );
        INSERT INTO strategy_analysis (symbol) VALUES ('BTCUSDT'), ('ETHUSDT');
      `);

      await migration.createPriceDataTables();
      await migration.initializeDefaultData();
      
      // 检查是否创建了默认记录
      const ictRecords = db.prepare('SELECT COUNT(*) as count FROM ict_price_ranges').get();
      const v3Records = db.prepare('SELECT COUNT(*) as count FROM v3_price_ranges').get();
      
      expect(ictRecords.count).toBeGreaterThan(0);
      expect(v3Records.count).toBeGreaterThan(0);
    });
  });

  describe('错误处理', () => {
    test('应该处理数据库错误', async () => {
      // 关闭数据库连接来模拟错误
      db.close();
      
      await expect(migration.migrate()).rejects.toThrow();
    });

    test('应该处理无效的数据库状态', async () => {
      // 创建一个损坏的表结构
      db.exec('CREATE TABLE ict_price_ranges (invalid_structure TEXT)');
      
      await expect(migration.validateMigration()).rejects.toThrow();
    });
  });

  describe('性能测试', () => {
    test('迁移应该在合理时间内完成', async () => {
      const startTime = Date.now();
      await migration.migrate();
      const duration = Date.now() - startTime;
      
      // 迁移应该在5秒内完成
      expect(duration).toBeLessThan(5000);
    });

    test('批量插入应该高效执行', async () => {
      await migration.createPriceDataTables();
      
      // 创建大量测试数据
      const symbols = Array.from({ length: 100 }, (_, i) => `TEST${i}USDT`);
      const records = symbols.map(symbol => ({
        symbol,
        priority_score: 50,
        is_active: true,
        calculation_version: 1
      }));

      const startTime = Date.now();
      await migration.batchInsertDefaultRecords('ict_price_ranges', records);
      const duration = Date.now() - startTime;
      
      // 批量插入应该在1秒内完成
      expect(duration).toBeLessThan(1000);
      
      // 验证数据插入正确
      const count = db.prepare('SELECT COUNT(*) as count FROM ict_price_ranges').get();
      expect(count.count).toBe(100);
    });
  });

  describe('并发安全性', () => {
    test('应该支持并发迁移请求', async () => {
      // 并发执行多个迁移
      const migrations = Array.from({ length: 3 }, () => migration.migrate());
      
      const results = await Promise.allSettled(migrations);
      
      // 至少有一个应该成功
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBeGreaterThan(0);
    });
  });
});
