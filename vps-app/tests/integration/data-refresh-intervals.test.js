// data-refresh-intervals.test.js - 数据刷新间隔配置测试
const DatabaseManager = require('../modules/database/DatabaseManager');
const DataRefreshManager = require('../modules/data/DataRefreshManager');

describe('数据刷新间隔配置测试', () => {
  let db;
  let dataRefreshManager;

  beforeAll(async () => {
    // 创建临时数据库
    db = new DatabaseManager(':memory:');
    await db.init();
    dataRefreshManager = new DataRefreshManager(db);
  });

  afterAll(async () => {
    if (db) {
      await db.close();
    }
  });

  describe('刷新间隔配置', () => {
    test('应该正确配置4H趋势判断为60分钟', () => {
      expect(dataRefreshManager.refreshIntervals.trend_analysis).toBe(60);
    });

    test('应该正确配置1H多因子打分为5分钟', () => {
      expect(dataRefreshManager.refreshIntervals.trend_scoring).toBe(5);
    });

    test('应该正确配置1H加强趋势判断为5分钟', () => {
      expect(dataRefreshManager.refreshIntervals.trend_strength).toBe(5);
    });

    test('应该正确配置趋势市15分钟入场判断为2分钟', () => {
      expect(dataRefreshManager.refreshIntervals.trend_entry).toBe(2);
    });

    test('应该正确配置震荡市1H边界判断为5分钟', () => {
      expect(dataRefreshManager.refreshIntervals.range_boundary).toBe(5);
    });

    test('应该正确配置震荡市15分钟入场判断为2分钟', () => {
      expect(dataRefreshManager.refreshIntervals.range_entry).toBe(2);
    });
  });

  describe('数据刷新时间更新', () => {
    beforeEach(async () => {
      // 清理测试数据
      await db.run('DELETE FROM data_refresh_log');
    });

    test('应该正确更新4H趋势判断的刷新时间', async () => {
      await dataRefreshManager.updateRefreshTime('BTCUSDT', 'trend_analysis', 100);
      
      const rows = await db.runQuery(
        'SELECT * FROM data_refresh_log WHERE symbol = ? AND data_type = ?',
        ['BTCUSDT', 'trend_analysis']
      );
      
      expect(rows).toHaveLength(1);
      expect(rows[0].refresh_interval).toBe(60);
      expect(rows[0].data_freshness_score).toBe(100);
    });

    test('应该正确更新1H多因子打分的刷新时间', async () => {
      await dataRefreshManager.updateRefreshTime('BTCUSDT', 'trend_scoring', 95);
      
      const rows = await db.runQuery(
        'SELECT * FROM data_refresh_log WHERE symbol = ? AND data_type = ?',
        ['BTCUSDT', 'trend_scoring']
      );
      
      expect(rows).toHaveLength(1);
      expect(rows[0].refresh_interval).toBe(5);
      expect(rows[0].data_freshness_score).toBe(95);
    });

    test('应该正确更新1H加强趋势判断的刷新时间', async () => {
      await dataRefreshManager.updateRefreshTime('BTCUSDT', 'trend_strength', 90);
      
      const rows = await db.runQuery(
        'SELECT * FROM data_refresh_log WHERE symbol = ? AND data_type = ?',
        ['BTCUSDT', 'trend_strength']
      );
      
      expect(rows).toHaveLength(1);
      expect(rows[0].refresh_interval).toBe(5);
      expect(rows[0].data_freshness_score).toBe(90);
    });

    test('应该正确更新趋势市15分钟入场判断的刷新时间', async () => {
      await dataRefreshManager.updateRefreshTime('BTCUSDT', 'trend_entry', 85);
      
      const rows = await db.runQuery(
        'SELECT * FROM data_refresh_log WHERE symbol = ? AND data_type = ?',
        ['BTCUSDT', 'trend_entry']
      );
      
      expect(rows).toHaveLength(1);
      expect(rows[0].refresh_interval).toBe(2);
      expect(rows[0].data_freshness_score).toBe(85);
    });

    test('应该正确更新震荡市1H边界判断的刷新时间', async () => {
      await dataRefreshManager.updateRefreshTime('BTCUSDT', 'range_boundary', 80);
      
      const rows = await db.runQuery(
        'SELECT * FROM data_refresh_log WHERE symbol = ? AND data_type = ?',
        ['BTCUSDT', 'range_boundary']
      );
      
      expect(rows).toHaveLength(1);
      expect(rows[0].refresh_interval).toBe(5);
      expect(rows[0].data_freshness_score).toBe(80);
    });

    test('应该正确更新震荡市15分钟入场判断的刷新时间', async () => {
      await dataRefreshManager.updateRefreshTime('BTCUSDT', 'range_entry', 75);
      
      const rows = await db.runQuery(
        'SELECT * FROM data_refresh_log WHERE symbol = ? AND data_type = ?',
        ['BTCUSDT', 'range_entry']
      );
      
      expect(rows).toHaveLength(1);
      expect(rows[0].refresh_interval).toBe(2);
      expect(rows[0].data_freshness_score).toBe(75);
    });
  });

  describe('刷新状态检查', () => {
    beforeEach(async () => {
      // 清理测试数据
      await db.run('DELETE FROM data_refresh_log');
    });

    test('应该正确检查4H趋势判断的刷新状态', async () => {
      // 首次刷新应该返回true
      const shouldRefresh1 = await dataRefreshManager.shouldRefresh('BTCUSDT', 'trend_analysis');
      expect(shouldRefresh1).toBe(true);

      // 更新刷新时间
      await dataRefreshManager.updateRefreshTime('BTCUSDT', 'trend_analysis', 100);

      // 立即检查应该返回false（还没到刷新时间）
      const shouldRefresh2 = await dataRefreshManager.shouldRefresh('BTCUSDT', 'trend_analysis');
      expect(shouldRefresh2).toBe(false);
    });

    test('应该正确检查1H多因子打分的刷新状态', async () => {
      // 首次刷新应该返回true
      const shouldRefresh1 = await dataRefreshManager.shouldRefresh('BTCUSDT', 'trend_scoring');
      expect(shouldRefresh1).toBe(true);

      // 更新刷新时间
      await dataRefreshManager.updateRefreshTime('BTCUSDT', 'trend_scoring', 100);

      // 立即检查应该返回false（还没到刷新时间）
      const shouldRefresh2 = await dataRefreshManager.shouldRefresh('BTCUSDT', 'trend_scoring');
      expect(shouldRefresh2).toBe(false);
    });

    test('应该正确检查1H加强趋势判断的刷新状态', async () => {
      // 首次刷新应该返回true
      const shouldRefresh1 = await dataRefreshManager.shouldRefresh('BTCUSDT', 'trend_strength');
      expect(shouldRefresh1).toBe(true);

      // 更新刷新时间
      await dataRefreshManager.updateRefreshTime('BTCUSDT', 'trend_strength', 100);

      // 立即检查应该返回false（还没到刷新时间）
      const shouldRefresh2 = await dataRefreshManager.shouldRefresh('BTCUSDT', 'trend_strength');
      expect(shouldRefresh2).toBe(false);
    });
  });

  describe('数据刷新统计', () => {
    beforeEach(async () => {
      // 清理测试数据
      await db.run('DELETE FROM data_refresh_log');
      
      // 添加测试数据
      await dataRefreshManager.updateRefreshTime('BTCUSDT', 'trend_analysis', 100);
      await dataRefreshManager.updateRefreshTime('ETHUSDT', 'trend_analysis', 95);
      await dataRefreshManager.updateRefreshTime('BNBUSDT', 'trend_analysis', 90);
      
      await dataRefreshManager.updateRefreshTime('BTCUSDT', 'trend_scoring', 100);
      await dataRefreshManager.updateRefreshTime('ETHUSDT', 'trend_scoring', 95);
      
      await dataRefreshManager.updateRefreshTime('BTCUSDT', 'trend_strength', 100);
      await dataRefreshManager.updateRefreshTime('ETHUSDT', 'trend_strength', 95);
      await dataRefreshManager.updateRefreshTime('BNBUSDT', 'trend_strength', 90);
    });

    test('应该正确统计各数据类型的唯一交易对数量', async () => {
      const stats = await dataRefreshManager.getRefreshStats();
      
      const trendAnalysisStat = stats.find(s => s.data_type === 'trend_analysis');
      const trendScoringStat = stats.find(s => s.data_type === 'trend_scoring');
      const trendStrengthStat = stats.find(s => s.data_type === 'trend_strength');
      
      expect(trendAnalysisStat).toBeDefined();
      expect(trendAnalysisStat.total_symbols).toBe(3);
      expect(trendAnalysisStat.avg_freshness).toBe(95);
      
      expect(trendScoringStat).toBeDefined();
      expect(trendScoringStat.total_symbols).toBe(2);
      expect(trendScoringStat.avg_freshness).toBe(97.5);
      
      expect(trendStrengthStat).toBeDefined();
      expect(trendStrengthStat.total_symbols).toBe(3);
      expect(trendStrengthStat.avg_freshness).toBe(95);
    });
  });
});
