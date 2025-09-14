// data-refresh-new-types.test.js - 新数据类型和新鲜度计算测试

const DataRefreshManager = require('../modules/data/DataRefreshManager');

describe('DataRefreshManager 新数据类型和新鲜度计算', () => {
  let dataRefreshManager;
  let mockDb;

  beforeEach(() => {
    mockDb = {
      runQuery: jest.fn(),
      run: jest.fn()
    };
    dataRefreshManager = new DataRefreshManager(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('新数据类型配置', () => {
    test('应该使用正确的新数据类型和刷新间隔', () => {
      expect(dataRefreshManager.refreshIntervals).toEqual({
        'trend_analysis': 60,        // 4H和1H趋势判断：每1小时
        'trend_scoring': 5,          // 趋势市1H多因子打分：每5分钟
        'trend_entry': 2,            // 趋势市15分钟入场判断：每2分钟
        'range_boundary': 5,         // 震荡市1H边界判断：每5分钟
        'range_entry': 2             // 震荡市15分钟入场判断：每2分钟
      });
    });
  });

  describe('新鲜度计算', () => {
    test('应该正确计算数据新鲜度得分', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const score = dataRefreshManager.calculateDataFreshnessScore(
        'BTCUSDT',
        'trend_analysis',
        oneHourAgo.toISOString()
      );

      // 对于trend_analysis（60分钟间隔），1小时前的数据应该得分为0
      expect(score).toBe(0);
    });

    test('最新数据应该得分为100', () => {
      const now = new Date();

      const score = dataRefreshManager.calculateDataFreshnessScore(
        'BTCUSDT',
        'trend_analysis',
        now.toISOString()
      );

      expect(score).toBe(100);
    });

    test('30分钟前的数据应该得分为50', () => {
      const now = new Date();
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

      const score = dataRefreshManager.calculateDataFreshnessScore(
        'BTCUSDT',
        'trend_analysis',
        thirtyMinutesAgo.toISOString()
      );

      // 对于60分钟间隔，30分钟前应该得分为50
      expect(score).toBe(50);
    });

    test('不同数据类型的刷新间隔应该影响新鲜度计算', () => {
      const now = new Date();
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

      // trend_analysis (60分钟间隔)
      const trendScore = dataRefreshManager.calculateDataFreshnessScore(
        'BTCUSDT',
        'trend_analysis',
        tenMinutesAgo.toISOString()
      );

      // trend_scoring (5分钟间隔)
      const scoringScore = dataRefreshManager.calculateDataFreshnessScore(
        'BTCUSDT',
        'trend_scoring',
        tenMinutesAgo.toISOString()
      );

      // trend_analysis应该还有83.33%新鲜度，trend_scoring应该为0
      expect(trendScore).toBeCloseTo(83.33, 1);
      expect(scoringScore).toBe(0);
    });
  });

  describe('updateRefreshTime 新鲜度计算', () => {
    test('应该自动计算新鲜度得分', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });

      await dataRefreshManager.updateRefreshTime('BTCUSDT', 'trend_analysis');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO data_refresh_log'),
        expect.arrayContaining([
          'BTCUSDT',
          'trend_analysis',
          expect.any(String), // last_update
          expect.any(String), // next_update
          60, // refresh_interval
          100 // data_freshness_score (最新数据应该是100)
        ])
      );
    });

    test('应该使用传入的新鲜度得分', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });

      await dataRefreshManager.updateRefreshTime('BTCUSDT', 'trend_analysis', 75.5);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO data_refresh_log'),
        expect.arrayContaining([
          'BTCUSDT',
          'trend_analysis',
          expect.any(String), // last_update
          expect.any(String), // next_update
          60, // refresh_interval
          75.5 // data_freshness_score
        ])
      );
    });
  });

  describe('getRefreshStats 新数据类型', () => {
    test('应该返回新数据类型的统计信息', async () => {
      const mockStats = [
        {
          data_type: 'trend_analysis',
          total_symbols: 10,
          avg_freshness: 85.5,
          min_freshness: 60.0,
          max_freshness: 100.0
        },
        {
          data_type: 'trend_scoring',
          total_symbols: 8,
          avg_freshness: 90.2,
          min_freshness: 75.0,
          max_freshness: 100.0
        },
        {
          data_type: 'range_boundary',
          total_symbols: 5,
          avg_freshness: 70.0,
          min_freshness: 50.0,
          max_freshness: 90.0
        }
      ];

      mockDb.runQuery.mockResolvedValue(mockStats);

      const stats = await dataRefreshManager.getRefreshStats();

      expect(stats).toEqual(mockStats);
      expect(stats).toHaveLength(3);
      expect(stats[0].data_type).toBe('trend_analysis');
      expect(stats[1].data_type).toBe('trend_scoring');
      expect(stats[2].data_type).toBe('range_boundary');
    });
  });

  describe('getStaleData 新数据类型', () => {
    test('应该返回新数据类型的过期数据', async () => {
      mockDb.runQuery
        .mockResolvedValueOnce([{ symbol: 'BTCUSDT' }, { symbol: 'ETHUSDT' }]) // getStaleData中的symbols查询
        .mockResolvedValueOnce([]) // BTCUSDT trend_analysis - 需要刷新
        .mockResolvedValueOnce([]) // BTCUSDT trend_scoring - 需要刷新
        .mockResolvedValueOnce([]) // BTCUSDT trend_entry - 需要刷新
        .mockResolvedValueOnce([]) // BTCUSDT range_boundary - 需要刷新
        .mockResolvedValueOnce([]) // BTCUSDT range_entry - 需要刷新
        .mockResolvedValueOnce([]) // ETHUSDT trend_analysis - 需要刷新
        .mockResolvedValueOnce([]) // ETHUSDT trend_scoring - 需要刷新
        .mockResolvedValueOnce([]) // ETHUSDT trend_entry - 需要刷新
        .mockResolvedValueOnce([]) // ETHUSDT range_boundary - 需要刷新
        .mockResolvedValueOnce([]); // ETHUSDT range_entry - 需要刷新

      const staleData = await dataRefreshManager.getStaleData();

      expect(staleData).toHaveLength(10); // 2个交易对 × 5种数据类型
      expect(staleData).toEqual([
        { symbol: 'BTCUSDT', dataType: 'trend_analysis' },
        { symbol: 'BTCUSDT', dataType: 'trend_scoring' },
        { symbol: 'BTCUSDT', dataType: 'trend_entry' },
        { symbol: 'BTCUSDT', dataType: 'range_boundary' },
        { symbol: 'BTCUSDT', dataType: 'range_entry' },
        { symbol: 'ETHUSDT', dataType: 'trend_analysis' },
        { symbol: 'ETHUSDT', dataType: 'trend_scoring' },
        { symbol: 'ETHUSDT', dataType: 'trend_entry' },
        { symbol: 'ETHUSDT', dataType: 'range_boundary' },
        { symbol: 'ETHUSDT', dataType: 'range_entry' }
      ]);
    });
  });

  describe('边界情况测试', () => {
    test('应该处理未知数据类型', async () => {
      const result = await dataRefreshManager.shouldRefresh('BTCUSDT', 'unknown_type');

      expect(result).toBe(true);
    });

    test('应该处理数据库错误', async () => {
      mockDb.runQuery.mockRejectedValue(new Error('Database error'));

      const result = await dataRefreshManager.shouldRefresh('BTCUSDT', 'trend_analysis');

      expect(result).toBe(true);
    });

    test('应该处理空的新鲜度得分', () => {
      const score = dataRefreshManager.calculateDataFreshnessScore(
        'BTCUSDT',
        'trend_analysis',
        null
      );

      expect(score).toBe(0);
    });
  });
});
