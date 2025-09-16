// ict-strategy-integration.test.js - ICT策略集成测试

const ICTStrategy = require('../../src/core/modules/strategy/ict-trading/ICTStrategy');
const ICTDatabaseManager = require('../../src/core/modules/database/ICTDatabaseManager');
const ICTMigration = require('../../src/core/modules/database/ICTMigration');

// Mock external dependencies
jest.mock('../../src/core/modules/api/BinanceAPI');
jest.mock('../../src/core/modules/monitoring/DataMonitor');

const BinanceAPI = require('../../src/core/modules/api/BinanceAPI');
const { DataMonitor } = require('../../src/core/modules/monitoring/DataMonitor');

describe('ICT策略集成测试', () => {
  let mockDatabase;
  let mockDataManager;
  let mockDeltaManager;
  let ictDatabaseManager;
  let ictMigration;

  beforeEach(async () => {
    // 创建内存数据库
    const Database = require('sqlite3').Database;
    mockDatabase = new Database(':memory:');

    // 初始化基础表结构
    await new Promise((resolve, reject) => {
      setupTestDatabase(mockDatabase);
      resolve();
    });

    mockDataManager = {
      getData: jest.fn(),
      updateData: jest.fn()
    };

    mockDeltaManager = {
      getDeltaData: jest.fn().mockReturnValue({
        delta: 1000,
        oi: 50000,
        fundingRate: 0.0001
      })
    };

    // Mock BinanceAPI
    BinanceAPI.getKlines = jest.fn();

    // Mock DataMonitor
    DataMonitor.mockImplementation(() => ({
      startAnalysis: jest.fn(),
      recordAnalysisLog: jest.fn()
    }));

    // 初始化ICT组件
    ictDatabaseManager = new ICTDatabaseManager(mockDatabase);
    ictMigration = new ICTMigration(mockDatabase);

    // 执行数据库迁移
    await ictMigration.migrate();
    await ictDatabaseManager.initICTTables();

    // 初始化ICT策略
    await ICTStrategy.init(mockDatabase, mockDataManager, mockDeltaManager);
  });

  afterEach(() => {
    mockDatabase.close();
    jest.clearAllMocks();
  });

  describe('完整的ICT策略流程', () => {
    test('应该完成从数据获取到信号生成的完整流程', async () => {
      // Mock 1D数据 - 上升趋势
      BinanceAPI.getKlines
        .mockResolvedValueOnce([
          [1640995200000, '50000', '51000', '49000', '50500', '1000', 1640995259999, '5000', 100, '0', '0', '0'],
          [1640998800000, '50500', '52000', '50000', '51500', '1200', 1640998859999, '6000', 120, '0', '0', '0'],
          [1641002400000, '51500', '53000', '51000', '52500', '1500', 1641002459999, '7500', 150, '0', '0', '0']
        ])
        // Mock 4H数据 - 有OB
        .mockResolvedValueOnce([
          [1640995200000, '50000', '52000', '49000', '51000', '1000', 1640995259999, '5000', 100, '0', '0', '0'],
          [1640998800000, '51000', '53000', '50000', '52000', '1200', 1640998859999, '6000', 120, '0', '0', '0'],
          [1641002400000, '52000', '54000', '51000', '53000', '1500', 1641002459999, '7500', 150, '0', '0', '0']
        ])
        // Mock 15m数据 - 有吞没形态和sweep
        .mockResolvedValueOnce([
          [1640995200000, '50000', '51000', '49000', '50500', '1000', 1640995259999, '5000', 100, '0', '0', '0'],
          [1640995260000, '50500', '52000', '50000', '51500', '1200', 1640995319999, '6000', 120, '0', '0', '0'],
          [1640995320000, '51500', '53000', '51000', '52500', '1500', 1640995379999, '7500', 150, '0', '0', '0']
        ]);

      const result = await ICTStrategy.analyzeSymbol('BTCUSDT', {
        database: mockDatabase,
        maxLossAmount: 100,
        equity: 10000,
        riskPct: 0.01,
        RR: 3
      });

      // 验证结果
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.strategyVersion).toBe('ICT');
      expect(result.dataValid).toBe(true);
      expect(result.dailyTrend).toBe('up');
      expect(result.signalType).toBe('LONG');
      expect(result.signalStrength).toBe('STRONG');
      expect(result.executionMode).toBe('OB_ENGULFING');

      // 验证数据库记录
      const analysisRecord = await ictDatabaseManager.getLatestICTAnalysis('BTCUSDT');
      expect(analysisRecord).toBeTruthy();
      expect(analysisRecord.symbol).toBe('BTCUSDT');
      expect(analysisRecord.signal_type).toBe('LONG');
    });

    test('应该处理震荡市场并生成无信号结果', async () => {
      // Mock 1D数据 - 震荡趋势
      BinanceAPI.getKlines
        .mockResolvedValueOnce([
          [1640995200000, '50000', '50100', '49900', '50050', '1000', 1640995259999, '5000', 100, '0', '0', '0'],
          [1640998800000, '50050', '50150', '49950', '50100', '1200', 1640998859999, '6000', 120, '0', '0', '0'],
          [1641002400000, '50100', '50200', '50000', '50050', '1500', 1641002459999, '7500', 150, '0', '0', '0']
        ]);

      const result = await ICTStrategy.analyzeSymbol('BTCUSDT', {
        database: mockDatabase,
        maxLossAmount: 100
      });

      expect(result.signalType).toBe('NONE');
      expect(result.errorMessage).toContain('1D趋势为震荡');
    });

    test('应该处理4H无结构的情况', async () => {
      // Mock 1D数据 - 上升趋势
      BinanceAPI.getKlines
        .mockResolvedValueOnce([
          [1640995200000, '50000', '51000', '49000', '50500', '1000', 1640995259999, '5000', 100, '0', '0', '0'],
          [1640998800000, '50500', '52000', '50000', '51500', '1200', 1640998859999, '6000', 120, '0', '0', '0'],
          [1641002400000, '51500', '53000', '51000', '52500', '1500', 1641002459999, '7500', 150, '0', '0', '0']
        ])
        // Mock 4H数据 - 无OB/FVG
        .mockResolvedValueOnce([
          [1640995200000, '50000', '50100', '49900', '50050', '1000', 1640995259999, '5000', 100, '0', '0', '0'],
          [1640998800000, '50050', '50150', '49950', '50100', '1200', 1640998859999, '6000', 120, '0', '0', '0']
        ]);

      const result = await ICTStrategy.analyzeSymbol('BTCUSDT', {
        database: mockDatabase,
        maxLossAmount: 100
      });

      expect(result.signalType).toBe('NONE');
      expect(result.errorMessage).toContain('4H未检测到OB/FVG');
    });
  });

  describe('数据库操作集成', () => {
    test('应该正确记录和检索ICT分析结果', async () => {
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

      // 记录分析结果
      await ictDatabaseManager.recordICTAnalysis(analysis);

      // 检索分析结果
      const retrieved = await ictDatabaseManager.getLatestICTAnalysis('BTCUSDT');

      expect(retrieved).toBeTruthy();
      expect(retrieved.symbol).toBe('BTCUSDT');
      expect(retrieved.daily_trend).toBe('up');
      expect(retrieved.signal_type).toBe('LONG');
    });

    test('应该正确创建和管理模拟交易', async () => {
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

      // 创建模拟交易
      const created = await ictDatabaseManager.createICTSimulation(simulationData);
      expect(created.id).toBe(1);
      expect(created.symbol).toBe('BTCUSDT');

      // 更新模拟交易状态
      await ictDatabaseManager.updateICTSimulation(1, {
        status: 'CLOSED',
        exit_price: 53000,
        profit_loss: 3000
      });

      // 获取模拟交易历史
      const history = await ictDatabaseManager.getICTSimulationHistory(10);
      expect(history).toHaveLength(1);
      expect(history[0].symbol).toBe('BTCUSDT');
    });
  });

  describe('错误处理和恢复', () => {
    test('应该处理API错误并返回错误结果', async () => {
      BinanceAPI.getKlines.mockRejectedValue(new Error('API Error'));

      const result = await ICTStrategy.analyzeSymbol('BTCUSDT', {
        database: mockDatabase,
        maxLossAmount: 100
      });

      expect(result.dataValid).toBe(false);
      expect(result.errorMessage).toContain('API Error');
    });

    test('应该处理数据库错误并继续执行', async () => {
      // Mock 正常的数据响应
      BinanceAPI.getKlines
        .mockResolvedValueOnce([
          [1640995200000, '50000', '51000', '49000', '50500', '1000', 1640995259999, '5000', 100, '0', '0', '0']
        ])
        .mockResolvedValueOnce([
          [1640995200000, '50000', '52000', '49000', '51000', '1000', 1640995259999, '5000', 100, '0', '0', '0']
        ])
        .mockResolvedValueOnce([
          [1640995200000, '50000', '51000', '49000', '50500', '1000', 1640995259999, '5000', 100, '0', '0', '0']
        ]);

      // Mock 数据库错误
      mockDatabase.run = jest.fn().mockRejectedValue(new Error('Database Error'));

      const result = await ICTStrategy.analyzeSymbol('BTCUSDT', {
        database: mockDatabase,
        maxLossAmount: 100
      });

      // 策略应该仍然能够执行，只是数据库记录会失败
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.strategyVersion).toBe('ICT');
    });
  });

  describe('性能测试', () => {
    test('应该能够处理大量数据', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT'];

      // Mock 数据响应
      BinanceAPI.getKlines
        .mockResolvedValue([
          [1640995200000, '50000', '51000', '49000', '50500', '1000', 1640995259999, '5000', 100, '0', '0', '0']
        ]);

      const startTime = Date.now();

      const promises = symbols.map(symbol =>
        ICTStrategy.analyzeSymbol(symbol, {
          database: mockDatabase,
          maxLossAmount: 100
        })
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();

      expect(results).toHaveLength(symbols.length);
      expect(endTime - startTime).toBeLessThan(5000); // 应该在5秒内完成
    });
  });
});

// 辅助函数：设置测试数据库
async function setupTestDatabase(db) {
  // 创建基础表结构
  const createTables = [
    `CREATE TABLE IF NOT EXISTS user_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS custom_symbols (
      symbol TEXT PRIMARY KEY
    )`,
    `CREATE TABLE IF NOT EXISTS symbol_categories (
      symbol TEXT PRIMARY KEY,
      category TEXT
    )`
  ];

  for (const sql of createTables) {
    db.exec(sql);
  }

  // 插入测试数据
  db.exec(`
    INSERT OR IGNORE INTO custom_symbols (symbol) VALUES 
    ('BTCUSDT'), ('ETHUSDT'), ('BNBUSDT'), ('ADAUSDT'), ('SOLUSDT')
  `);

  db.exec(`
    INSERT OR IGNORE INTO symbol_categories (symbol, category) VALUES 
    ('BTCUSDT', 'mainstream'),
    ('ETHUSDT', 'mainstream'),
    ('BNBUSDT', 'mainstream'),
    ('ADAUSDT', 'highcap'),
    ('SOLUSDT', 'highcap')
  `);
}
