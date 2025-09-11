// test/database-optimization.test.js
// 数据库优化模块单元测试

const DatabaseOptimization = require('../modules/database/DatabaseOptimization');
const DatabaseManager = require('../modules/database/DatabaseManager');

// Mock DatabaseManager
jest.mock('../modules/database/DatabaseManager', () => {
  return jest.fn().mockImplementation(() => ({
    run: jest.fn().mockResolvedValue(),
    all: jest.fn().mockResolvedValue([])
  }));
});

describe('DatabaseOptimization', () => {
  let dbOptimization;
  let mockDb;

  beforeEach(() => {
    mockDb = new DatabaseManager();
    dbOptimization = new DatabaseOptimization();
    dbOptimization.db = mockDb;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createDataRefreshStatusTable', () => {
    test('应该创建数据刷新状态表', async () => {
      await dbOptimization.createDataRefreshStatusTable();

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS data_refresh_status')
      );
    });
  });

  describe('createStrategyV3AnalysisTable', () => {
    test('应该创建V3策略分析表', async () => {
      await dbOptimization.createStrategyV3AnalysisTable();

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS strategy_v3_analysis')
      );
    });
  });

  describe('optimizeExistingTables', () => {
    test('应该优化现有表结构', async () => {
      mockDb.run.mockResolvedValue();

      await dbOptimization.optimizeExistingTables();

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('ALTER TABLE strategy_analysis ADD COLUMN trend4h TEXT')
      );
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('ALTER TABLE simulations ADD COLUMN strategy_version TEXT')
      );
    });

    test('应该处理字段已存在的错误', async () => {
      const error = new Error('duplicate column name');
      mockDb.run.mockRejectedValueOnce(error);
      mockDb.run.mockResolvedValue();

      await dbOptimization.optimizeExistingTables();

      // 应该继续执行其他字段的添加
      expect(mockDb.run).toHaveBeenCalledTimes(13); // 实际调用了13次
    });
  });

  describe('createOptimizedIndexes', () => {
    test('应该创建优化索引', async () => {
      await dbOptimization.createOptimizedIndexes();

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX IF NOT EXISTS idx_strategy_analysis_symbol_time')
      );
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX IF NOT EXISTS idx_strategy_v3_analysis_symbol_time')
      );
    });
  });

  describe('implementDataCleanup', () => {
    test('应该实施数据清理策略', async () => {
      await dbOptimization.implementDataCleanup();

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM strategy_analysis')
      );
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM analysis_logs')
      );
    });
  });

  describe('optimizeDatabase', () => {
    test('应该执行完整的数据库优化', async () => {
      mockDb.run.mockResolvedValue();
      mockDb.all.mockResolvedValue([]);

      const result = await dbOptimization.optimizeDatabase();

      expect(result).toBe(true);
      expect(mockDb.run).toHaveBeenCalled();
    });

    test('应该处理优化过程中的错误', async () => {
      mockDb.run.mockRejectedValue(new Error('Database error'));

      await expect(dbOptimization.optimizeDatabase()).rejects.toThrow('Database error');
    });
  });

  describe('getPerformanceStats', () => {
    test('应该获取数据库性能统计', async () => {
      const mockTableStats = [
        { name: 'strategy_analysis', row_count: 1000 },
        { name: 'simulations', row_count: 500 }
      ];
      const mockIndexStats = [
        { name: 'idx_strategy_analysis_symbol', sql: 'CREATE INDEX...' }
      ];

      mockDb.all
        .mockResolvedValueOnce(mockTableStats)
        .mockResolvedValueOnce(mockIndexStats);

      const stats = await dbOptimization.getPerformanceStats();

      expect(stats.tables).toEqual(mockTableStats);
      expect(stats.indexes).toEqual(mockIndexStats);
    });
  });
});
