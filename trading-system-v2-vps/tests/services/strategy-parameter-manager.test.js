/**
 * 策略参数管理器单元测试
 */

const StrategyParameterManager = require('../../src/services/strategy-parameter-manager');

jest.mock('../../src/utils/logger');

describe('StrategyParameterManager', () => {
  let manager;
  let mockDatabase;
  let mockPool;

  beforeEach(() => {
    // 创建模拟数据库连接
    mockPool = {
      query: jest.fn()
    };
    mockDatabase = {
      pool: mockPool
    };

    // 创建管理器实例
    manager = new StrategyParameterManager(mockDatabase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getStrategyParams', () => {
    it('应该正确获取策略参数', async () => {
      const mockParams = [
        {
          param_group: 'trend',
          param_name: 'dailyTrendThreshold',
          param_value: '0.02',
          param_type: 'number',
          category: 'trend',
          description: '日线趋势判断阈值',
          unit: '%',
          min_value: '0.01',
          max_value: '0.03'
        },
        {
          param_group: 'position',
          param_name: 'riskPercent',
          param_value: '0.01',
          param_type: 'number',
          category: 'position',
          description: '单笔风险百分比',
          unit: '%',
          min_value: '0.005',
          max_value: '0.02'
        }
      ];

      mockPool.query.mockResolvedValue([mockParams]);

      const result = await manager.getStrategyParams('ICT', 'BALANCED');

      expect(result).toBeDefined();
      expect(result.trend).toBeDefined();
      expect(result.position).toBeDefined();
      expect(result.trend.dailyTrendThreshold.value).toBe(0.02);
      expect(result.position.riskPercent.value).toBe(0.01);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['ICT', 'BALANCED']
      );
    });

    it('应该正确过滤参数组', async () => {
      const mockParams = [
        {
          param_group: 'trend',
          param_name: 'dailyTrendThreshold',
          param_value: '0.02',
          param_type: 'number',
          category: 'trend',
          description: '日线趋势判断阈值',
          unit: '%',
          min_value: '0.01',
          max_value: '0.03'
        }
      ];

      mockPool.query.mockResolvedValue([mockParams]);

      const result = await manager.getStrategyParams('ICT', 'BALANCED', 'trend');

      expect(result).toBeDefined();
      expect(result.trend).toBeDefined();
      expect(Object.keys(result)).toHaveLength(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('param_group = ?'),
        ['ICT', 'BALANCED', 'trend']
      );
    });

    it('应该使用缓存', async () => {
      const mockParams = [
        {
          param_group: 'trend',
          param_name: 'dailyTrendThreshold',
          param_value: '0.02',
          param_type: 'number',
          category: 'trend',
          description: '日线趋势判断阈值',
          unit: '%',
          min_value: '0.01',
          max_value: '0.03'
        }
      ];

      mockPool.query.mockResolvedValue([mockParams]);

      // 第一次调用
      const result1 = await manager.getStrategyParams('ICT', 'BALANCED');

      // 第二次调用（应该使用缓存）
      const result2 = await manager.getStrategyParams('ICT', 'BALANCED');

      expect(result1).toEqual(result2);
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('getParam', () => {
    it('应该正确获取单个参数', async () => {
      const mockParams = [
        {
          param_group: 'trend',
          param_name: 'dailyTrendThreshold',
          param_value: '0.02',
          param_type: 'number',
          category: 'trend',
          description: '日线趋势判断阈值',
          unit: '%',
          min_value: '0.01',
          max_value: '0.03'
        }
      ];

      mockPool.query.mockResolvedValue([mockParams]);

      const value = await manager.getParam('ICT', 'BALANCED', 'trend', 'dailyTrendThreshold');

      expect(value).toBe(0.02);
    });

    it('应该返回null如果参数不存在', async () => {
      mockPool.query.mockResolvedValue([[]]);

      const value = await manager.getParam('ICT', 'BALANCED', 'trend', 'nonExistentParam');

      expect(value).toBeNull();
    });
  });

  describe('updateParam', () => {
    it('应该正确更新参数', async () => {
      const mockParams = [
        {
          param_group: 'trend',
          param_name: 'dailyTrendThreshold',
          param_value: '0.02',
          param_type: 'number',
          category: 'trend',
          description: '日线趋势判断阈值',
          unit: '%',
          min_value: '0.01',
          max_value: '0.03'
        }
      ];

      mockPool.query.mockResolvedValueOnce([mockParams]); // getStrategyParams
      mockPool.query.mockResolvedValueOnce([[]]); // UPDATE
      mockPool.query.mockResolvedValueOnce([[]]); // INSERT history

      const result = await manager.updateParam(
        'ICT',
        'BALANCED',
        'trend',
        'dailyTrendThreshold',
        0.025,
        'test_user',
        '测试更新'
      );

      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledTimes(3);
    });

    it('应该验证参数值范围', async () => {
      const mockParams = [
        {
          param_group: 'trend',
          param_name: 'dailyTrendThreshold',
          param_value: '0.02',
          param_type: 'number',
          category: 'trend',
          description: '日线趋势判断阈值',
          unit: '%',
          min_value: '0.01',
          max_value: '0.03'
        }
      ];

      mockPool.query.mockResolvedValue([mockParams]);

      const result = await manager.updateParam(
        'ICT',
        'BALANCED',
        'trend',
        'dailyTrendThreshold',
        0.05, // 超出最大值
        'test_user',
        '测试更新'
      );

      expect(result).toBe(false);
    });
  });

  describe('updateParams', () => {
    it('应该正确批量更新参数', async () => {
      const mockParams = [
        {
          param_group: 'trend',
          param_name: 'dailyTrendThreshold',
          param_value: '0.02',
          param_type: 'number',
          category: 'trend',
          description: '日线趋势判断阈值',
          unit: '%',
          min_value: '0.01',
          max_value: '0.03'
        },
        {
          param_group: 'position',
          param_name: 'riskPercent',
          param_value: '0.01',
          param_type: 'number',
          category: 'position',
          description: '单笔风险百分比',
          unit: '%',
          min_value: '0.005',
          max_value: '0.02'
        }
      ];

      mockPool.query.mockResolvedValue([mockParams]); // getStrategyParams
      mockPool.query.mockResolvedValue([[]]); // UPDATE
      mockPool.query.mockResolvedValue([[]]); // INSERT history

      const updates = {
        trend: {
          dailyTrendThreshold: 0.025
        },
        position: {
          riskPercent: 0.015
        }
      };

      const result = await manager.updateParams(
        'ICT',
        'BALANCED',
        updates,
        'test_user',
        '批量更新测试'
      );

      expect(result.success).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
    });
  });

  describe('getParamHistory', () => {
    it('应该正确获取参数历史', async () => {
      const mockHistory = [
        {
          param_group: 'trend',
          param_name: 'dailyTrendThreshold',
          old_value: '0.02',
          new_value: '0.025',
          changed_by: 'test_user',
          reason: '测试更新',
          created_at: new Date()
        }
      ];

      mockPool.query.mockResolvedValue([mockHistory]);

      const history = await manager.getParamHistory('ICT', 'BALANCED', 10);

      expect(history).toHaveLength(1);
      expect(history[0].old_value).toBe('0.02');
      expect(history[0].new_value).toBe('0.025');
    });
  });

  describe('addBacktestResult', () => {
    it('应该正确添加回测结果', async () => {
      mockPool.query.mockResolvedValue([[]]);

      const result = await manager.addBacktestResult({
        strategyName: 'ICT',
        strategyMode: 'BALANCED',
        backtestPeriod: '2024-01',
        totalTrades: 100,
        winningTrades: 60,
        losingTrades: 40,
        winRate: 0.6,
        totalPnl: 5000,
        avgWin: 200,
        avgLoss: -100,
        maxDrawdown: 0.1,
        sharpeRatio: 1.5
      });

      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO strategy_parameter_backtest_results'),
        expect.arrayContaining(['ICT', 'BALANCED', '2024-01'])
      );
    });
  });

  describe('getBacktestResults', () => {
    it('应该正确获取回测结果', async () => {
      const mockResults = [
        {
          backtest_period: '2024-01',
          total_trades: 100,
          winning_trades: 60,
          losing_trades: 40,
          win_rate: 0.6,
          total_pnl: 5000,
          avg_win: 200,
          avg_loss: -100,
          max_drawdown: 0.1,
          sharpe_ratio: 1.5,
          created_at: new Date()
        }
      ];

      mockPool.query.mockResolvedValue([mockResults]);

      const results = await manager.getBacktestResults('ICT', 'BALANCED', 10);

      expect(results).toHaveLength(1);
      expect(results[0].win_rate).toBe(0.6);
    });
  });

  describe('clearCache', () => {
    it('应该正确清除缓存', async () => {
      const mockParams = [
        {
          param_group: 'trend',
          param_name: 'dailyTrendThreshold',
          param_value: '0.02',
          param_type: 'number',
          category: 'trend',
          description: '日线趋势判断阈值',
          unit: '%',
          min_value: '0.01',
          max_value: '0.03'
        }
      ];

      mockPool.query.mockResolvedValue([mockParams]);

      // 第一次调用
      await manager.getStrategyParams('ICT', 'BALANCED');

      // 清除缓存
      manager.clearCache();

      // 第二次调用（应该重新查询数据库）
      await manager.getStrategyParams('ICT', 'BALANCED');

      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('convertValue', () => {
    it('应该正确转换数字类型', () => {
      const value = manager.convertValue('0.02', 'number');
      expect(value).toBe(0.02);
    });

    it('应该正确转换布尔类型', () => {
      const value1 = manager.convertValue('true', 'boolean');
      const value2 = manager.convertValue('false', 'boolean');
      expect(value1).toBe(true);
      expect(value2).toBe(false);
    });

    it('应该正确转换字符串类型', () => {
      const value = manager.convertValue('test', 'string');
      expect(value).toBe('test');
    });
  });

  describe('getStrategyModes', () => {
    it('应该返回所有策略模式', () => {
      const modes = manager.getStrategyModes();
      expect(modes).toEqual(['AGGRESSIVE', 'CONSERVATIVE', 'BALANCED']);
    });
  });

  describe('getStrategyNames', () => {
    it('应该返回所有策略名称', () => {
      const names = manager.getStrategyNames();
      expect(names).toEqual(['ICT', 'V3']);
    });
  });
});

