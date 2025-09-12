// data-refresh-manager.test.js - 数据刷新管理器单元测试

const DataRefreshManager = require('../modules/data/DataRefreshManager');

describe('DataRefreshManager', () => {
  let dataRefreshManager;
  let mockDb;

  beforeEach(() => {
    mockDb = {
      get: jest.fn(),
      run: jest.fn(),
      all: jest.fn()
    };
    dataRefreshManager = new DataRefreshManager(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('shouldRefresh', () => {
    test('首次刷新应该返回true', async () => {
      mockDb.get.mockResolvedValue(null);

      const result = await dataRefreshManager.shouldRefresh('BTCUSDT', '4h_trend');

      expect(result).toBe(true);
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT last_update, next_update FROM data_refresh_log'),
        ['BTCUSDT', '4h_trend']
      );
    });

    test('未到刷新时间应该返回false', async () => {
      const futureTime = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30分钟后
      mockDb.get.mockResolvedValue({
        last_update: new Date().toISOString(),
        next_update: futureTime
      });

      const result = await dataRefreshManager.shouldRefresh('BTCUSDT', '4h_trend');

      expect(result).toBe(false);
    });

    test('已到刷新时间应该返回true', async () => {
      const pastTime = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30分钟前
      mockDb.get.mockResolvedValue({
        last_update: pastTime,
        next_update: pastTime
      });

      const result = await dataRefreshManager.shouldRefresh('BTCUSDT', '4h_trend');

      expect(result).toBe(true);
    });

    test('未知数据类型应该返回true', async () => {
      const result = await dataRefreshManager.shouldRefresh('BTCUSDT', 'unknown_type');

      expect(result).toBe(true);
    });

    test('数据库错误时应该返回true', async () => {
      mockDb.get.mockRejectedValue(new Error('Database error'));

      const result = await dataRefreshManager.shouldRefresh('BTCUSDT', '4h_trend');

      expect(result).toBe(true);
    });
  });

  describe('updateRefreshTime', () => {
    test('应该正确更新刷新时间', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });

      await dataRefreshManager.updateRefreshTime('BTCUSDT', '4h_trend', 85);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO data_refresh_log'),
        expect.arrayContaining([
          'BTCUSDT',
          '4h_trend',
          expect.any(String), // last_update
          expect.any(String), // next_update
          60, // refresh_interval for 4h_trend
          85  // data_freshness_score
        ])
      );
    });

    test('数据库错误时应该记录错误但不抛出异常', async () => {
      mockDb.run.mockRejectedValue(new Error('Database error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(dataRefreshManager.updateRefreshTime('BTCUSDT', '4h_trend')).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        '更新刷新时间失败 [BTCUSDT][4h_trend]:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('calculateDataFreshnessScore', () => {
    test('应该正确计算数据新鲜度得分', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const score = dataRefreshManager.calculateDataFreshnessScore(
        'BTCUSDT',
        '4h_trend',
        oneHourAgo.toISOString()
      );

      // 对于4h_trend（60分钟间隔），1小时前的数据应该得分为0
      expect(score).toBe(0);
    });

    test('最新数据应该得分为100', () => {
      const now = new Date();

      const score = dataRefreshManager.calculateDataFreshnessScore(
        'BTCUSDT',
        '4h_trend',
        now.toISOString()
      );

      expect(score).toBe(100);
    });
  });

  describe('getStaleData', () => {
    test('应该返回需要刷新的数据列表', async () => {
      mockDb.all.mockResolvedValue([{ symbol: 'BTCUSDT' }, { symbol: 'ETHUSDT' }]);
      mockDb.get
        .mockResolvedValueOnce(null) // BTCUSDT 4h_trend - 需要刷新
        .mockResolvedValueOnce({ last_update: new Date().toISOString(), next_update: new Date(Date.now() + 30 * 60 * 1000).toISOString() }) // BTCUSDT 1h_scoring - 不需要刷新
        .mockResolvedValueOnce(null) // BTCUSDT 15m_entry - 需要刷新
        .mockResolvedValueOnce(null) // BTCUSDT delta - 需要刷新
        .mockResolvedValueOnce(null) // ETHUSDT 4h_trend - 需要刷新
        .mockResolvedValueOnce({ last_update: new Date().toISOString(), next_update: new Date(Date.now() + 30 * 60 * 1000).toISOString() }) // ETHUSDT 1h_scoring - 不需要刷新
        .mockResolvedValueOnce(null) // ETHUSDT 15m_entry - 需要刷新
        .mockResolvedValueOnce(null); // ETHUSDT delta - 需要刷新

      const staleData = await dataRefreshManager.getStaleData();

      expect(staleData).toHaveLength(6); // 6个需要刷新的数据
      expect(staleData).toEqual([
        { symbol: 'BTCUSDT', dataType: '4h_trend' },
        { symbol: 'BTCUSDT', dataType: '15m_entry' },
        { symbol: 'BTCUSDT', dataType: 'delta' },
        { symbol: 'ETHUSDT', dataType: '4h_trend' },
        { symbol: 'ETHUSDT', dataType: '15m_entry' },
        { symbol: 'ETHUSDT', dataType: 'delta' }
      ]);
    });

    test('数据库错误时应该返回空数组', async () => {
      mockDb.all.mockRejectedValue(new Error('Database error'));

      const staleData = await dataRefreshManager.getStaleData();

      expect(staleData).toEqual([]);
    });
  });

  describe('getRefreshStats', () => {
    test('应该返回刷新统计数据', async () => {
      const mockStats = [
        {
          data_type: '4h_trend',
          total_symbols: 10,
          avg_freshness: 85.5,
          min_freshness: 60.0,
          max_freshness: 100.0
        },
        {
          data_type: '1h_scoring',
          total_symbols: 10,
          avg_freshness: 90.2,
          min_freshness: 75.0,
          max_freshness: 100.0
        }
      ];

      mockDb.all.mockResolvedValue(mockStats);

      const stats = await dataRefreshManager.getRefreshStats();

      expect(stats).toEqual(mockStats);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT data_type, COUNT(*) as total_symbols')
      );
    });

    test('数据库错误时应该返回空数组', async () => {
      mockDb.all.mockRejectedValue(new Error('Database error'));

      const stats = await dataRefreshManager.getRefreshStats();

      expect(stats).toEqual([]);
    });
  });

  describe('cleanupExpiredRecords', () => {
    test('应该清理24小时前的记录', async () => {
      mockDb.run.mockResolvedValue({ changes: 5 });

      await dataRefreshManager.cleanupExpiredRecords();

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM data_refresh_log WHERE last_update < ?'),
        [expect.any(String)] // cutoffTime
      );
    });

    test('数据库错误时应该记录错误但不抛出异常', async () => {
      mockDb.run.mockRejectedValue(new Error('Database error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(dataRefreshManager.cleanupExpiredRecords()).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        '清理过期记录失败:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('刷新间隔配置', () => {
    test('应该使用正确的刷新间隔', () => {
      expect(dataRefreshManager.refreshIntervals).toEqual({
        '4h_trend': 60,      // 4H趋势：每1小时
        '1h_scoring': 5,     // 1H打分：每5分钟
        '15m_entry': 2,      // 15m入场：每1-3分钟（取2分钟）
        'delta': 0.1         // Delta/盘口：实时（0.1分钟=6秒）
      });
    });
  });
});
