/**
 * BacktestManager 单元测试
 * 测试回测管理器的核心功能
 */

const BacktestManager = require('../../src/services/backtest-manager');

describe('BacktestManager', () => {
  let manager;
  let mockDatabase;
  let mockBinanceAPI;

  beforeEach(() => {
    // 创建模拟数据库
    mockDatabase = {
      query: jest.fn(),
      pool: {
        query: jest.fn()
      }
    };

    // 创建模拟Binance API
    mockBinanceAPI = {
      getKlines: jest.fn()
    };

    manager = new BacktestManager(mockDatabase, mockBinanceAPI);
  });

  describe('getStrategyParameters', () => {
    test('应该正确获取策略参数', async () => {
      const mockParams = [
        {
          param_name: 'stopLossMultiplier',
          param_value: '2.0',
          param_type: 'number',
          param_group: 'risk',
          unit: '',
          min_value: '1.0',
          max_value: '5.0',
          description: '止损倍数'
        }
      ];

      mockDatabase.query.mockResolvedValue(mockParams);

      const params = await manager.getStrategyParameters('ICT', 'AGGRESSIVE');

      expect(params).toBeDefined();
      expect(params.risk).toBeDefined();
      expect(params.risk.stopLossMultiplier).toBeDefined();
      expect(params.risk.stopLossMultiplier.value).toBe(2.0);
      expect(params.risk.stopLossMultiplier.type).toBe('number');
    });
  });

  describe('calculateBacktestMetrics', () => {
    test('应该正确计算回测指标', () => {
      const trades = [
        { pnl: 100, fees: 0.1, durationHours: 1 },
        { pnl: -50, fees: 0.05, durationHours: 2 },
        { pnl: 200, fees: 0.2, durationHours: 1.5 },
        { pnl: -30, fees: 0.03, durationHours: 0.5 },
        { pnl: 150, fees: 0.15, durationHours: 3 }
      ];

      const metrics = manager.calculateBacktestMetrics(trades, 'AGGRESSIVE');

      expect(metrics).toBeDefined();
      expect(metrics.totalTrades).toBe(5);
      expect(metrics.winRate).toBe(0.6); // 3/5 = 0.6
      expect(metrics.totalPnl).toBe(370);
      expect(metrics.netProfit).toBe(370 - 0.53); // totalPnl - totalFees
      expect(metrics.winningTrades).toBe(3);
      expect(metrics.losingTrades).toBe(2);
    });

    test('应该正确处理空交易数组', () => {
      const trades = [];
      const metrics = manager.calculateBacktestMetrics(trades, 'AGGRESSIVE');

      expect(metrics).toBeDefined();
      expect(metrics.totalTrades).toBe(0);
      expect(metrics.winRate).toBe(0);
      expect(metrics.netProfit).toBe(0);
    });
  });

  describe('saveBacktestResult', () => {
    test('应该正确保存回测结果', async () => {
      const result = {
        totalTrades: 10,
        winningTrades: 6,
        losingTrades: 4,
        winRate: 0.6,
        totalPnl: 1000,
        avgWin: 200,
        avgLoss: -50,
        maxDrawdown: 100,
        sharpeRatio: 1.5,
        profitFactor: 2.0,
        avgTradeDuration: 2.5,
        maxConsecutiveWins: 3,
        maxConsecutiveLosses: 2,
        totalFees: 10,
        netProfit: 990
      };

      mockDatabase.query.mockResolvedValue([{ insertId: 1 }]);

      await manager.saveBacktestResult(1, 'ICT', 'AGGRESSIVE', result);

      expect(mockDatabase.query).toHaveBeenCalled();
    });
  });
});
