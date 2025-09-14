// data-refresh-integration.test.js - 数据刷新集成测试

const SmartFlowStrategyV3 = require('../modules/strategy/SmartFlowStrategyV3');
const DataRefreshManager = require('../modules/data/DataRefreshManager');

describe('数据刷新集成测试', () => {
  let mockDb;
  let dataRefreshManager;

  beforeEach(() => {
    mockDb = {
      get: jest.fn(),
      run: jest.fn(),
      all: jest.fn()
    };
    
    dataRefreshManager = new DataRefreshManager(mockDb);
    
    // 初始化SmartFlowStrategyV3
    SmartFlowStrategyV3.init(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('SmartFlowStrategyV3.analyzeSymbol 与 DataRefreshManager 集成', () => {
    test('应该检查数据刷新状态并记录日志', async () => {
      // Mock 数据刷新状态
      mockDb.get
        .mockResolvedValueOnce(null) // 4h_trend - 需要刷新
        .mockResolvedValueOnce({ last_update: new Date().toISOString(), next_update: new Date(Date.now() + 30 * 60 * 1000).toISOString() }) // 1h_scoring - 不需要刷新
        .mockResolvedValueOnce(null); // 15m_entry - 需要刷新

      // Mock 4H趋势分析
      SmartFlowStrategyV3.core.analyze4HTrend = jest.fn().mockResolvedValue({
        trend4h: '上涨',
        marketType: '趋势市',
        confidence: 85
      });

      // Mock 趋势市分析
      SmartFlowStrategyV3.analyzeTrendMarket = jest.fn().mockResolvedValue({
        signal: 'BUY',
        score: 75,
        factors: {}
      });

      // Mock 价格获取
      const BinanceAPI = require('../modules/api/BinanceAPI');
      BinanceAPI.getTicker = jest.fn().mockResolvedValue({
        lastPrice: '50000'
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await SmartFlowStrategyV3.analyzeSymbol('BTCUSDT', {
        dataRefreshManager: dataRefreshManager
      });

      // 验证数据刷新状态检查被调用
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT last_update, next_update FROM data_refresh_log'),
        ['BTCUSDT', '4h_trend']
      );
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT last_update, next_update FROM data_refresh_log'),
        ['BTCUSDT', '1h_scoring']
      );
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT last_update, next_update FROM data_refresh_log'),
        ['BTCUSDT', '15m_entry']
      );

      // 验证日志输出
      expect(consoleSpy).toHaveBeenCalledWith(
        '📊 数据刷新状态 [BTCUSDT]: 4H=true, 1H=false, 15M=true'
      );

      consoleSpy.mockRestore();
    });

    test('应该更新数据刷新时间', async () => {
      // Mock 4H趋势分析
      SmartFlowStrategyV3.core.analyze4HTrend = jest.fn().mockResolvedValue({
        trend4h: '上涨',
        marketType: '趋势市',
        confidence: 85
      });

      // Mock 趋势市分析
      SmartFlowStrategyV3.analyzeTrendMarket = jest.fn().mockResolvedValue({
        signal: 'BUY',
        score: 75,
        factors: {}
      });

      // Mock 价格获取
      const BinanceAPI = require('../modules/api/BinanceAPI');
      BinanceAPI.getTicker = jest.fn().mockResolvedValue({
        lastPrice: '50000'
      });

      await SmartFlowStrategyV3.analyzeSymbol('BTCUSDT', {
        dataRefreshManager: dataRefreshManager
      });

      // 验证数据刷新时间更新被调用
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO data_refresh_log'),
        expect.arrayContaining(['BTCUSDT', '4h_trend'])
      );
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO data_refresh_log'),
        expect.arrayContaining(['BTCUSDT', '1h_scoring'])
      );
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO data_refresh_log'),
        expect.arrayContaining(['BTCUSDT', '15m_entry'])
      );
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO data_refresh_log'),
        expect.arrayContaining(['BTCUSDT', 'delta'])
      );
    });

    test('没有传递dataRefreshManager时应该跳过数据刷新逻辑', async () => {
      // Mock 4H趋势分析
      SmartFlowStrategyV3.core.analyze4HTrend = jest.fn().mockResolvedValue({
        trend4h: '上涨',
        marketType: '趋势市',
        confidence: 85
      });

      // Mock 趋势市分析
      SmartFlowStrategyV3.analyzeTrendMarket = jest.fn().mockResolvedValue({
        signal: 'BUY',
        score: 75,
        factors: {}
      });

      // Mock 价格获取
      const BinanceAPI = require('../modules/api/BinanceAPI');
      BinanceAPI.getTicker = jest.fn().mockResolvedValue({
        lastPrice: '50000'
      });

      await SmartFlowStrategyV3.analyzeSymbol('BTCUSDT', {});

      // 验证数据刷新相关方法没有被调用
      expect(mockDb.get).not.toHaveBeenCalledWith(
        expect.stringContaining('data_refresh_log'),
        expect.any(Array)
      );
      expect(mockDb.run).not.toHaveBeenCalledWith(
        expect.stringContaining('data_refresh_log'),
        expect.any(Array)
      );
    });
  });

  describe('数据刷新API端点集成', () => {
    test('getRefreshStats应该返回正确的统计格式', async () => {
      const mockStats = [
        {
          data_type: '4h_trend',
          total_symbols: 5,
          avg_freshness: 85.5,
          min_freshness: 60.0,
          max_freshness: 100.0
        }
      ];

      mockDb.all.mockResolvedValue(mockStats);

      const stats = await dataRefreshManager.getRefreshStats();

      expect(stats).toEqual(mockStats);
      expect(stats[0]).toHaveProperty('data_type');
      expect(stats[0]).toHaveProperty('total_symbols');
      expect(stats[0]).toHaveProperty('avg_freshness');
      expect(stats[0]).toHaveProperty('min_freshness');
      expect(stats[0]).toHaveProperty('max_freshness');
    });

    test('getStaleData应该返回过期数据列表', async () => {
      mockDb.all.mockResolvedValue([{ symbol: 'BTCUSDT' }]);
      mockDb.get.mockResolvedValue(null); // 所有数据都需要刷新

      const staleData = await dataRefreshManager.getStaleData();

      expect(staleData).toHaveLength(4); // 4种数据类型
      expect(staleData.every(item => item.symbol === 'BTCUSDT')).toBe(true);
      expect(staleData.map(item => item.dataType)).toEqual([
        '4h_trend',
        '1h_scoring', 
        '15m_entry',
        'delta'
      ]);
    });
  });

  describe('数据刷新频率验证', () => {
    test('应该按照文档要求设置正确的刷新间隔', () => {
      expect(dataRefreshManager.refreshIntervals).toEqual({
        '4h_trend': 60,      // 4H趋势：每1小时
        '1h_scoring': 5,     // 1H打分：每5分钟  
        '15m_entry': 2,      // 15m入场：每1-3分钟（取2分钟）
        'delta': 0.1         // Delta/盘口：实时（0.1分钟=6秒）
      });
    });

    test('刷新间隔应该符合strategy-v3.md文档要求', () => {
      const intervals = dataRefreshManager.refreshIntervals;
      
      // 验证4H趋势刷新频率（每1小时）
      expect(intervals['4h_trend']).toBe(60);
      
      // 验证1H打分刷新频率（每5分钟）
      expect(intervals['1h_scoring']).toBe(5);
      
      // 验证15m入场刷新频率（每1-3分钟，取2分钟）
      expect(intervals['15m_entry']).toBe(2);
      
      // 验证Delta实时刷新频率（实时，6秒）
      expect(intervals['delta']).toBe(0.1);
    });
  });
});
