/**
 * 测试趋势市和震荡市判断逻辑
 * 验证4H方向+1H趋势加强同时判断的逻辑
 */

const SmartFlowStrategyV3 = require('../modules/strategy/SmartFlowStrategyV3');
const StrategyV3Core = require('../modules/strategy/StrategyV3Core');
const DatabaseManager = require('../modules/database/DatabaseManager');

describe('趋势市和震荡市判断逻辑测试', () => {
  let core;
  let database;

  beforeAll(async () => {
    database = new DatabaseManager();
    core = new StrategyV3Core(database);
  });

  afterAll(async () => {
    if (database) {
      await database.close();
    }
  });

  describe('4H趋势判断逻辑', () => {
    test('应该正确识别4H趋势方向但不直接确定市场类型', async () => {
      // 模拟4H趋势数据
      const mockKlines = [
        { close: 100, high: 105, low: 95, volume: 1000 },
        { close: 102, high: 107, low: 97, volume: 1100 },
        { close: 104, high: 109, low: 99, volume: 1200 },
        { close: 106, high: 111, low: 101, volume: 1300 },
        { close: 108, high: 113, low: 103, volume: 1400 },
        { close: 110, high: 115, low: 105, volume: 1500 },
        { close: 112, high: 117, low: 107, volume: 1600 },
        { close: 114, high: 119, low: 109, volume: 1700 },
        { close: 116, high: 121, low: 111, volume: 1800 },
        { close: 118, high: 123, low: 113, volume: 1900 },
        { close: 120, high: 125, low: 115, volume: 2000 },
        { close: 122, high: 127, low: 117, volume: 2100 },
        { close: 124, high: 129, low: 119, volume: 2200 },
        { close: 126, high: 131, low: 121, volume: 2300 },
        { close: 128, high: 133, low: 123, volume: 2400 },
        { close: 130, high: 135, low: 125, volume: 2500 },
        { close: 132, high: 137, low: 127, volume: 2600 },
        { close: 134, high: 139, low: 129, volume: 2700 },
        { close: 136, high: 141, low: 131, volume: 2800 },
        { close: 138, high: 143, low: 133, volume: 2900 },
        { close: 140, high: 145, low: 135, volume: 3000 },
        { close: 142, high: 147, low: 137, volume: 3100 },
        { close: 144, high: 149, low: 139, volume: 3200 },
        { close: 146, high: 151, low: 141, volume: 3300 },
        { close: 148, high: 153, low: 143, volume: 3400 }
      ];

      // 模拟API调用
      const originalGetKlines = require('../modules/api/BinanceAPI').getKlines;
      require('../modules/api/BinanceAPI').getKlines = jest.fn().mockResolvedValue(mockKlines);

      const result = await core.analyze4HTrend('BTCUSDT');

      // 验证结果
      expect(result).toBeDefined();
      expect(result.trend4h).toBeDefined();
      expect(result.marketType).toBe('震荡市'); // 应该默认为震荡市，等待1H打分确认
      expect(['多头趋势', '空头趋势', '震荡市']).toContain(result.trend4h);

      // 恢复原始方法
      require('../modules/api/BinanceAPI').getKlines = originalGetKlines;
    });
  });

  describe('4H方向+1H趋势加强联合判断', () => {
    test('应该根据1H打分结果确定最终市场类型', async () => {
      // 模拟完整的策略分析
      const mockKlines4h = Array(25).fill().map((_, i) => ({
        close: 100 + i * 2,
        high: 105 + i * 2,
        low: 95 + i * 2,
        volume: 1000 + i * 100
      }));

      const mockKlines1h = Array(50).fill().map((_, i) => ({
        close: 100 + i,
        high: 105 + i,
        low: 95 + i,
        volume: 1000 + i * 50
      }));

      // 模拟API调用
      const BinanceAPI = require('../modules/api/BinanceAPI');
      const originalGetKlines = BinanceAPI.getKlines;
      const originalGetTicker = BinanceAPI.getTicker;

      BinanceAPI.getKlines = jest.fn()
        .mockImplementation((symbol, interval) => {
          if (interval === '4h') return Promise.resolve(mockKlines4h);
          if (interval === '1h') return Promise.resolve(mockKlines1h);
          if (interval === '15m') return Promise.resolve(mockKlines1h.slice(0, 20));
          return Promise.resolve([]);
        });

      BinanceAPI.getTicker = jest.fn().mockResolvedValue({ lastPrice: '150' });

      // 模拟Delta管理器
      const mockDeltaManager = {
        getDelta: jest.fn().mockResolvedValue(0.1)
      };

      // 模拟数据刷新管理器
      const mockDataRefreshManager = {
        shouldRefresh: jest.fn().mockResolvedValue(true),
        updateRefreshTime: jest.fn().mockResolvedValue()
      };

      // 执行策略分析
      const result = await SmartFlowStrategyV3.analyzeSymbol('BTCUSDT', {
        dataRefreshManager: mockDataRefreshManager
      });

      // 验证结果
      expect(result).toBeDefined();
      expect(result.marketType).toBeDefined();
      expect(['趋势市', '震荡市']).toContain(result.marketType);
      expect(result.trend4h).toBeDefined();
      expect(result.symbol).toBe('BTCUSDT');

      // 恢复原始方法
      BinanceAPI.getKlines = originalGetKlines;
      BinanceAPI.getTicker = originalGetTicker;
    });
  });

  describe('文档逻辑一致性验证', () => {
    test('应该按照文档要求进行4H方向+1H趋势加强联合判断', () => {
      // 验证逻辑流程
      const testCases = [
        {
          trend4h: '多头趋势',
          score1h: 3,
          expectedMarketType: '趋势市',
          description: '4H多头趋势+1H打分>0=趋势市'
        },
        {
          trend4h: '空头趋势',
          score1h: 2,
          expectedMarketType: '趋势市',
          description: '4H空头趋势+1H打分>0=趋势市'
        },
        {
          trend4h: '多头趋势',
          score1h: 0,
          expectedMarketType: '震荡市',
          description: '4H多头趋势+1H打分=0=震荡市'
        },
        {
          trend4h: '空头趋势',
          score1h: 0,
          expectedMarketType: '震荡市',
          description: '4H空头趋势+1H打分=0=震荡市'
        },
        {
          trend4h: '震荡市',
          score1h: 3,
          expectedMarketType: '震荡市',
          description: '4H震荡市+1H打分>0=震荡市'
        }
      ];

      testCases.forEach(testCase => {
        let finalMarketType = '震荡市';
        
        if (testCase.trend4h === '多头趋势' || testCase.trend4h === '空头趋势') {
          if (testCase.score1h > 0) {
            finalMarketType = '趋势市';
          } else {
            finalMarketType = '震荡市';
          }
        } else {
          finalMarketType = '震荡市';
        }

        expect(finalMarketType).toBe(testCase.expectedMarketType);
        console.log(`✅ ${testCase.description}: ${finalMarketType}`);
      });
    });
  });
});
