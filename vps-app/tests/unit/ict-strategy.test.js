// ict-strategy.test.js - ICT策略主入口单元测试

const ICTStrategy = require('../../src/core/modules/strategy/ict-trading/ICTStrategy');

// Mock dependencies
jest.mock('../../src/core/modules/api/BinanceAPI');
jest.mock('../../src/core/modules/monitoring/DataMonitor');

const BinanceAPI = require('../../src/core/modules/api/BinanceAPI');
const { DataMonitor } = require('../../src/core/modules/monitoring/DataMonitor');

describe('ICTStrategy 主策略测试', () => {
  let mockDatabase;
  let mockDataManager;
  let mockDeltaManager;

  beforeEach(() => {
    mockDatabase = {
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn()
    };
    mockDataManager = {
      getData: jest.fn(),
      updateData: jest.fn()
    };
    mockDeltaManager = {
      getDeltaData: jest.fn()
    };

    // Mock BinanceAPI
    BinanceAPI.getKlines = jest.fn();

    // Mock DataMonitor
    DataMonitor.mockImplementation(() => ({
      startAnalysis: jest.fn(),
      recordAnalysisLog: jest.fn()
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('策略初始化 (init)', () => {
    test('应该正确初始化ICT策略', async () => {
      await ICTStrategy.init(mockDatabase, mockDataManager, mockDeltaManager);

      expect(ICTStrategy.dataManager).toBe(mockDataManager);
      expect(ICTStrategy.deltaManager).toBe(mockDeltaManager);
    });
  });

  describe('符号分析 (analyzeSymbol)', () => {
    beforeEach(() => {
      // Mock successful data responses
      BinanceAPI.getKlines
        .mockResolvedValueOnce([ // 1D data
          [1640995200000, '50000', '51000', '49000', '50500', '1000', 1640995259999, '5000', 100, '0', '0', '0'],
          [1640998800000, '50500', '52000', '50000', '51500', '1200', 1640998859999, '6000', 120, '0', '0', '0'],
          [1641002400000, '51500', '53000', '51000', '52500', '1500', 1641002459999, '7500', 150, '0', '0', '0']
        ])
        .mockResolvedValueOnce([ // 4H data
          [1640995200000, '50000', '52000', '49000', '51000', '1000', 1640995259999, '5000', 100, '0', '0', '0'],
          [1640998800000, '51000', '53000', '50000', '52000', '1200', 1640998859999, '6000', 120, '0', '0', '0'],
          [1641002400000, '52000', '54000', '51000', '53000', '1500', 1641002459999, '7500', 150, '0', '0', '0']
        ])
        .mockResolvedValueOnce([ // 15m data
          [1640995200000, '50000', '51000', '49000', '50500', '1000', 1640995259999, '5000', 100, '0', '0', '0'],
          [1640995260000, '50500', '52000', '50000', '51500', '1200', 1640995319999, '6000', 120, '0', '0', '0'],
          [1640995320000, '51500', '53000', '51000', '52500', '1500', 1640995379999, '7500', 150, '0', '0', '0']
        ]);
    });

    test('应该成功分析有效的ICT信号', async () => {
      const result = await ICTStrategy.analyzeSymbol('BTCUSDT', {
        database: mockDatabase,
        maxLossAmount: 100,
        equity: 10000,
        riskPct: 0.01,
        RR: 3
      });

      expect(result.symbol).toBe('BTCUSDT');
      expect(result.strategyVersion).toBe('ICT');
      expect(result.dataValid).toBe(true);
      expect(result.errorMessage).toBeNull();
      expect(result.dailyTrend).toBeDefined();
      expect(result.mtfResult).toBeDefined();
      expect(result.ltfResult).toBeDefined();
      expect(result.riskManagement).toBeDefined();
    });

    test('应该处理震荡市场', async () => {
      // Mock sideways trend data
      BinanceAPI.getKlines
        .mockResolvedValueOnce([ // 1D data - sideways
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

    test('应该处理4H无OB/FVG的情况', async () => {
      // Mock data without OB/FVG
      BinanceAPI.getKlines
        .mockResolvedValueOnce([ // 1D data - uptrend
          [1640995200000, '50000', '51000', '49000', '50500', '1000', 1640995259999, '5000', 100, '0', '0', '0'],
          [1640998800000, '50500', '52000', '50000', '51500', '1200', 1640998859999, '6000', 120, '0', '0', '0'],
          [1641002400000, '51500', '53000', '51000', '52500', '1500', 1641002459999, '7500', 150, '0', '0', '0']
        ])
        .mockResolvedValueOnce([ // 4H data - no OB/FVG
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

    test('应该处理15m无入场信号的情况', async () => {
      // Mock data without entry signal
      BinanceAPI.getKlines
        .mockResolvedValueOnce([ // 1D data - uptrend
          [1640995200000, '50000', '51000', '49000', '50500', '1000', 1640995259999, '5000', 100, '0', '0', '0'],
          [1640998800000, '50500', '52000', '50000', '51500', '1200', 1640998859999, '6000', 120, '0', '0', '0'],
          [1641002400000, '51500', '53000', '51000', '52500', '1500', 1641002459999, '7500', 150, '0', '0', '0']
        ])
        .mockResolvedValueOnce([ // 4H data - with OB
          [1640995200000, '50000', '52000', '49000', '51000', '1000', 1640995259999, '5000', 100, '0', '0', '0'],
          [1640998800000, '51000', '53000', '50000', '52000', '1200', 1640998859999, '6000', 120, '0', '0', '0'],
          [1641002400000, '52000', '54000', '51000', '53000', '1500', 1641002459999, '7500', 150, '0', '0', '0']
        ])
        .mockResolvedValueOnce([ // 15m data - no entry signal
          [1640995200000, '50000', '50100', '49900', '50050', '1000', 1640995259999, '5000', 100, '0', '0', '0'],
          [1640995260000, '50050', '50150', '49950', '50100', '1200', 1640995319999, '6000', 120, '0', '0', '0']
        ]);

      const result = await ICTStrategy.analyzeSymbol('BTCUSDT', {
        database: mockDatabase,
        maxLossAmount: 100
      });

      expect(result.signalType).toBe('NONE');
      expect(result.errorMessage).toContain('15m未检测到入场信号');
    });

    test('应该处理API错误', async () => {
      BinanceAPI.getKlines.mockRejectedValue(new Error('API Error'));

      const result = await ICTStrategy.analyzeSymbol('BTCUSDT', {
        database: mockDatabase,
        maxLossAmount: 100
      });

      expect(result.dataValid).toBe(false);
      expect(result.errorMessage).toContain('API Error');
    });
  });

  describe('信号强度计算 (calculateSignalStrength)', () => {
    test('应该计算强信号', () => {
      const mtfResult = {
        obDetected: true,
        fvgDetected: true,
        sweepHTF: true
      };
      const ltfResult = {
        engulfing: { detected: true },
        sweepLTF: { detected: true },
        volumeConfirm: true
      };

      const result = ICTStrategy.calculateSignalStrength(mtfResult, ltfResult);

      expect(result).toBe('STRONG');
    });

    test('应该计算中等信号', () => {
      const mtfResult = {
        obDetected: true,
        fvgDetected: false,
        sweepHTF: false
      };
      const ltfResult = {
        engulfing: { detected: true },
        sweepLTF: { detected: false },
        volumeConfirm: true
      };

      const result = ICTStrategy.calculateSignalStrength(mtfResult, ltfResult);

      expect(result).toBe('MODERATE');
    });

    test('应该计算弱信号', () => {
      const mtfResult = {
        obDetected: false,
        fvgDetected: false,
        sweepHTF: false
      };
      const ltfResult = {
        engulfing: { detected: false },
        sweepLTF: { detected: false },
        volumeConfirm: false
      };

      const result = ICTStrategy.calculateSignalStrength(mtfResult, ltfResult);

      expect(result).toBe('WEAK');
    });
  });

  describe('信号类型确定 (determineSignalType)', () => {
    test('应该确定多头信号', () => {
      const result = ICTStrategy.determineSignalType('up', { entrySignal: true });

      expect(result).toBe('LONG');
    });

    test('应该确定空头信号', () => {
      const result = ICTStrategy.determineSignalType('down', { entrySignal: true });

      expect(result).toBe('SHORT');
    });

    test('应该确定无信号', () => {
      const result = ICTStrategy.determineSignalType('up', { entrySignal: false });

      expect(result).toBe('NONE');
    });
  });

  describe('执行模式确定 (determineExecutionMode)', () => {
    test('应该确定OB吞没模式', () => {
      const mtfResult = { obDetected: true };
      const ltfResult = { engulfing: { detected: true } };

      const result = ICTStrategy.determineExecutionMode(mtfResult, ltfResult);

      expect(result).toBe('OB_ENGULFING');
    });

    test('应该确定FVG扫荡模式', () => {
      const mtfResult = { fvgDetected: true };
      const ltfResult = { sweepLTF: { detected: true } };

      const result = ICTStrategy.determineExecutionMode(mtfResult, ltfResult);

      expect(result).toBe('FVG_SWEEP');
    });

    test('应该确定吞没扫荡模式', () => {
      const mtfResult = { obDetected: false, fvgDetected: false };
      const ltfResult = {
        engulfing: { detected: true },
        sweepLTF: { detected: true }
      };

      const result = ICTStrategy.determineExecutionMode(mtfResult, ltfResult);

      expect(result).toBe('ENGULFING_SWEEP');
    });

    test('应该确定无执行模式', () => {
      const mtfResult = { obDetected: false, fvgDetected: false };
      const ltfResult = {
        engulfing: { detected: false },
        sweepLTF: { detected: false }
      };

      const result = ICTStrategy.determineExecutionMode(mtfResult, ltfResult);

      expect(result).toBe('NONE');
    });
  });

  describe('结果创建方法', () => {
    test('应该创建无信号结果', () => {
      const result = ICTStrategy.createNoSignalResult('BTCUSDT', '测试原因');

      expect(result.symbol).toBe('BTCUSDT');
      expect(result.signalType).toBe('NONE');
      expect(result.errorMessage).toBe('测试原因');
      expect(result.strategyVersion).toBe('ICT');
    });

    test('应该创建错误结果', () => {
      const result = ICTStrategy.createErrorResult('BTCUSDT', '测试错误');

      expect(result.symbol).toBe('BTCUSDT');
      expect(result.dataValid).toBe(false);
      expect(result.errorMessage).toBe('测试错误');
      expect(result.strategyVersion).toBe('ICT');
    });
  });

  describe('杠杆数据计算 (calculateLeverageData)', () => {
    test('应该正确计算杠杆数据', () => {
      const result = ICTStrategy.calculateLeverageData(
        50000, // entryPrice
        49000, // stopLossPrice
        53000, // takeProfitPrice
        'LONG', // direction
        100 // maxLossAmount
      );

      expect(result.maxLeverage).toBeGreaterThan(0);
      expect(result.minMargin).toBeGreaterThan(0);
      expect(result.stopLossDistance).toBeGreaterThan(0);
      expect(result.atrValue).toBe(1000);
      expect(result.direction).toBe('LONG');
    });

    test('应该处理错误情况', () => {
      const result = ICTStrategy.calculateLeverageData(
        0, // entryPrice
        0, // stopLossPrice
        0, // takeProfitPrice
        'LONG', // direction
        100 // maxLossAmount
      );

      expect(result.maxLeverage).toBe(10);
      expect(result.minMargin).toBe(100);
      expect(result.stopLossDistance).toBe(2.0);
    });
  });

  describe('执行信号格式化 (formatExecution)', () => {
    test('应该正确格式化执行信号', () => {
      const result = ICTStrategy.formatExecution('LONG', 'OB_ENGULFING');

      expect(result).toBe('做多_OB_ENGULFING');
    });

    test('应该处理无信号情况', () => {
      const result = ICTStrategy.formatExecution('NONE', 'NONE');

      expect(result).toBe('NONE');
    });
  });
});
