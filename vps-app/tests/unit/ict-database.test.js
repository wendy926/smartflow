// ict-database.test.js - ICT数据库管理单元测试

const ICTDatabaseManager = require('../../src/core/modules/database/ICTDatabaseManager');
const ICTMigration = require('../../src/core/modules/database/ICTMigration');

describe('ICT数据库管理测试', () => {
  let mockDatabase;
  let ictDatabaseManager;
  let ictMigration;

  beforeEach(() => {
    mockDatabase = {
      run: jest.fn().mockResolvedValue({ lastID: 1, changes: 1 }),
      get: jest.fn().mockResolvedValue({ id: 1, name: 'test' }),
      all: jest.fn().mockResolvedValue([])
    };

    ictDatabaseManager = new ICTDatabaseManager(mockDatabase);
    ictMigration = new ICTMigration(mockDatabase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('ICTDatabaseManager', () => {
    describe('初始化ICT表 (initICTTables)', () => {
      test('应该成功创建ICT表', async () => {
        await ictDatabaseManager.initICTTables();

        expect(mockDatabase.run).toHaveBeenCalled();
        // 验证创建了主要表
        const calls = mockDatabase.run.mock.calls;
        const tableNames = calls.map(call => call[0]).join(' ');

        expect(tableNames).toContain('ict_strategy_analysis');
        expect(tableNames).toContain('ict_simulations');
        expect(tableNames).toContain('ict_data_refresh_status');
      });

      test('应该创建索引', async () => {
        await ictDatabaseManager.initICTTables();

        const calls = mockDatabase.run.mock.calls;
        const indexCalls = calls.filter(call => call[0].includes('CREATE INDEX'));

        expect(indexCalls.length).toBeGreaterThan(0);
      });
    });

    describe('记录ICT分析结果 (recordICTAnalysis)', () => {
      test('应该成功记录分析结果', async () => {
        const analysis = {
          symbol: 'BTCUSDT',
          dailyTrend: 'up',
          dailyTrendScore: 3,
          mtfResult: {
            obDetected: true,
            fvgDetected: false,
            ob: { high: 52000, low: 50000, height: 2000, ageDays: 1 },
            atr4h: 1000
          },
          ltfResult: {
            engulfing: { detected: true, bodyRatio: 2.0 },
            sweepLTF: { detected: true, speed: 100 },
            volumeConfirm: true,
            atr15: 500
          },
          riskManagement: {
            entry: 51000,
            stopLoss: 50000,
            takeProfit: 54000,
            riskRewardRatio: 3,
            leverage: 10,
            margin: 1000
          },
          signalType: 'LONG',
          signalStrength: 'STRONG',
          executionMode: 'OB_ENGULFING',
          dataCollectionRate: 100,
          timestamp: new Date().toISOString(),
          strategyVersion: 'ICT',
          dataValid: true
        };

        await ictDatabaseManager.recordICTAnalysis(analysis);

        expect(mockDatabase.run).toHaveBeenCalled();
        const call = mockDatabase.run.mock.calls[0];
        expect(call[0]).toContain('INSERT OR REPLACE INTO ict_strategy_analysis');
        expect(call[1]).toContain('BTCUSDT');
      });

      test('应该处理空值情况', async () => {
        const analysis = {
          symbol: 'BTCUSDT',
          dailyTrend: null,
          dailyTrendScore: 0,
          mtfResult: null,
          ltfResult: null,
          riskManagement: null,
          signalType: 'NONE',
          signalStrength: 'NONE',
          executionMode: 'NONE',
          dataCollectionRate: 0,
          timestamp: new Date().toISOString(),
          strategyVersion: 'ICT',
          dataValid: false,
          errorMessage: '测试错误'
        };

        await ictDatabaseManager.recordICTAnalysis(analysis);

        expect(mockDatabase.run).toHaveBeenCalled();
      });
    });

    describe('获取最新ICT分析结果 (getLatestICTAnalysis)', () => {
      test('应该返回最新分析结果', async () => {
        const mockResult = {
          id: 1,
          symbol: 'BTCUSDT',
          daily_trend: 'up',
          signal_type: 'LONG'
        };
        mockDatabase.get.mockResolvedValue(mockResult);

        const result = await ictDatabaseManager.getLatestICTAnalysis('BTCUSDT');

        expect(mockDatabase.get).toHaveBeenCalledWith(
          expect.stringContaining('SELECT * FROM ict_strategy_analysis'),
          ['BTCUSDT']
        );
        expect(result).toEqual(mockResult);
      });

      test('应该处理无结果情况', async () => {
        mockDatabase.get.mockResolvedValue(null);

        const result = await ictDatabaseManager.getLatestICTAnalysis('BTCUSDT');

        expect(result).toBeNull();
      });
    });

    describe('创建ICT模拟交易 (createICTSimulation)', () => {
      test('应该成功创建模拟交易', async () => {
        const simulationData = {
          symbol: 'BTCUSDT',
          entry_price: 50000,
          stop_loss_price: 49000,
          take_profit_price: 53000,
          max_leverage: 10,
          min_margin: 1000,
          position_size: 10000,
          risk_reward_ratio: 3,
          trigger_reason: 'ICT_SIGNAL',
          signal_type: 'LONG',
          execution_mode: 'OB_ENGULFING',
          status: 'ACTIVE'
        };

        const result = await ictDatabaseManager.createICTSimulation(simulationData);

        expect(mockDatabase.run).toHaveBeenCalled();
        expect(result.id).toBe(1);
        expect(result.symbol).toBe('BTCUSDT');
      });

      test('应该处理创建失败', async () => {
        mockDatabase.run.mockRejectedValue(new Error('Database error'));

        const simulationData = {
          symbol: 'BTCUSDT',
          entry_price: 50000,
          stop_loss_price: 49000,
          take_profit_price: 53000,
          max_leverage: 10,
          min_margin: 1000,
          position_size: 10000,
          risk_reward_ratio: 3,
          trigger_reason: 'ICT_SIGNAL',
          signal_type: 'LONG',
          execution_mode: 'OB_ENGULFING'
        };

        await expect(ictDatabaseManager.createICTSimulation(simulationData))
          .rejects.toThrow('Database error');
      });
    });

    describe('获取ICT模拟交易历史 (getICTSimulationHistory)', () => {
      test('应该返回模拟交易历史', async () => {
        const mockHistory = [
          { id: 1, symbol: 'BTCUSDT', signal_type: 'LONG' },
          { id: 2, symbol: 'ETHUSDT', signal_type: 'SHORT' }
        ];
        mockDatabase.all.mockResolvedValue(mockHistory);

        const result = await ictDatabaseManager.getICTSimulationHistory(10);

        expect(mockDatabase.all).toHaveBeenCalledWith(
          expect.stringContaining('SELECT * FROM ict_simulations'),
          [10]
        );
        expect(result).toEqual(mockHistory);
      });

      test('应该处理查询失败', async () => {
        mockDatabase.all.mockRejectedValue(new Error('Query error'));

        const result = await ictDatabaseManager.getICTSimulationHistory(10);

        expect(result).toEqual([]);
      });
    });

    describe('更新ICT模拟交易 (updateICTSimulation)', () => {
      test('应该成功更新模拟交易', async () => {
        const updateData = {
          status: 'CLOSED',
          exit_price: 53000,
          profit_loss: 3000
        };

        await ictDatabaseManager.updateICTSimulation(1, updateData);

        expect(mockDatabase.run).toHaveBeenCalled();
        const call = mockDatabase.run.mock.calls[0];
        expect(call[0]).toContain('UPDATE ict_simulations');
        expect(call[1]).toContain('CLOSED');
      });

      test('应该处理空更新数据', async () => {
        await ictDatabaseManager.updateICTSimulation(1, {});

        expect(mockDatabase.run).not.toHaveBeenCalled();
      });
    });

    describe('获取ICT数据刷新状态 (getICTRefreshStatus)', () => {
      test('应该返回刷新状态', async () => {
        const mockStatus = [
          { data_type: 'daily_trend', should_refresh: true, last_refresh: null },
          { data_type: 'mtf_analysis', should_refresh: true, last_refresh: null },
          { data_type: 'ltf_analysis', should_refresh: true, last_refresh: null }
        ];
        mockDatabase.all.mockResolvedValue(mockStatus);

        const result = await ictDatabaseManager.getICTRefreshStatus('BTCUSDT');

        expect(result.daily_trend.shouldRefresh).toBe(true);
        expect(result.mtf_analysis.shouldRefresh).toBe(true);
        expect(result.ltf_analysis.shouldRefresh).toBe(true);
      });

      test('应该返回默认状态', async () => {
        mockDatabase.all.mockRejectedValue(new Error('Query error'));

        const result = await ictDatabaseManager.getICTRefreshStatus('BTCUSDT');

        expect(result.daily_trend.shouldRefresh).toBe(true);
        expect(result.mtf_analysis.shouldRefresh).toBe(true);
        expect(result.ltf_analysis.shouldRefresh).toBe(true);
      });
    });

    describe('更新ICT数据刷新状态 (updateICTRefreshStatus)', () => {
      test('应该成功更新刷新状态', async () => {
        const status = {
          lastRefresh: new Date().toISOString(),
          nextRefresh: new Date(Date.now() + 3600000).toISOString(),
          shouldRefresh: false,
          refreshInterval: 60
        };

        await ictDatabaseManager.updateICTRefreshStatus('BTCUSDT', 'daily_trend', status);

        expect(mockDatabase.run).toHaveBeenCalled();
        const call = mockDatabase.run.mock.calls[0];
        expect(call[0]).toContain('INSERT OR REPLACE INTO ict_data_refresh_status');
        expect(call[1]).toContain('BTCUSDT');
        expect(call[1]).toContain('daily_trend');
      });
    });
  });

  describe('ICTMigration', () => {
    describe('执行迁移 (migrate)', () => {
      test('应该成功执行迁移', async () => {
        await ictMigration.migrate();

        expect(mockDatabase.run).toHaveBeenCalled();
        // 验证创建了枚举表
        const calls = mockDatabase.run.mock.calls;
        const tableNames = calls.map(call => call[0]).join(' ');

        expect(tableNames).toContain('ict_signal_types');
        expect(tableNames).toContain('ict_execution_modes');
        expect(tableNames).toContain('ict_trend_types');
      });
    });

    describe('验证ICT数据库结构 (validateICTStructure)', () => {
      test('应该通过结构验证', async () => {
        const requiredTables = [
          'ict_strategy_analysis',
          'ict_simulations',
          'ict_data_refresh_status',
          'ict_signal_types',
          'ict_execution_modes',
          'ict_trend_types'
        ];
        const requiredViews = [
          'ict_analysis_summary',
          'ict_simulation_stats',
          'ict_signal_strength_stats'
        ];

        // Mock table existence checks
        requiredTables.forEach(table => {
          mockDatabase.get.mockResolvedValueOnce({ name: table });
        });

        // Mock view existence checks
        requiredViews.forEach(view => {
          mockDatabase.get.mockResolvedValueOnce({ name: view });
        });

        const result = await ictMigration.validateICTStructure();

        expect(result).toBe(true);
      });

      test('应该检测到缺少的表', async () => {
        mockDatabase.get.mockResolvedValue(null); // 表不存在

        const result = await ictMigration.validateICTStructure();

        expect(result).toBe(false);
      });
    });

    describe('清理测试数据 (cleanupTestData)', () => {
      test('应该成功清理测试数据', async () => {
        await ictMigration.cleanupTestData();

        expect(mockDatabase.run).toHaveBeenCalled();
        const calls = mockDatabase.run.mock.calls;
        expect(calls.some(call => call[0].includes('DELETE FROM ict_strategy_analysis'))).toBe(true);
        expect(calls.some(call => call[0].includes('DELETE FROM ict_simulations'))).toBe(true);
        expect(calls.some(call => call[0].includes('DELETE FROM ict_data_refresh_status'))).toBe(true);
      });
    });

    describe('获取ICT统计信息 (getICTStats)', () => {
      test('应该返回统计信息', async () => {
        const mockAnalysisStats = { total: 10, latest: '2023-01-01' };
        const mockSimulationStats = { total: 5, active: 2 };
        const mockSignalStats = [
          { signal_type: 'LONG', count: 3 },
          { signal_type: 'SHORT', count: 2 }
        ];
        const mockExecutionStats = [
          { execution_mode: 'OB_ENGULFING', count: 2 },
          { execution_mode: 'FVG_SWEEP', count: 1 }
        ];

        mockDatabase.get
          .mockResolvedValueOnce(mockAnalysisStats)
          .mockResolvedValueOnce(mockSimulationStats);
        mockDatabase.all
          .mockResolvedValueOnce(mockSignalStats)
          .mockResolvedValueOnce(mockExecutionStats);

        const result = await ictMigration.getICTStats();

        expect(result.analysis).toEqual(mockAnalysisStats);
        expect(result.simulations).toEqual(mockSimulationStats);
        expect(result.signals).toEqual(mockSignalStats);
        expect(result.executions).toEqual(mockExecutionStats);
      });

      test('应该处理查询失败', async () => {
        mockDatabase.get.mockRejectedValue(new Error('Query error'));
        mockDatabase.all.mockRejectedValue(new Error('Query error'));

        const result = await ictMigration.getICTStats();

        expect(result).toEqual({});
      });
    });
  });
});
