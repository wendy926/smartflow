// ict-execution.test.js - ICT执行逻辑单元测试

const ICTExecution = require('../../src/core/modules/strategy/ict-trading/ICTExecution');

describe('ICTExecution 执行逻辑测试', () => {
  let mockDatabase;

  beforeEach(() => {
    mockDatabase = {
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('风险管理计算 (calculateRiskManagement)', () => {
    test('应该正确计算多头风险管理', () => {
      const ltfResult = {
        entryPrice: 50000,
        atr15: 500,
        data15M: [
          [1640995200000, '50000', '51000', '49000', '50500', '1000', 1640995259999, '5000', 100, '0', '0', '0'],
          [1640995260000, '50500', '52000', '50000', '51500', '1200', 1640995319999, '6000', 120, '0', '0', '0'],
          [1640995320000, '51500', '53000', '51000', '52500', '1500', 1640995379999, '7500', 150, '0', '0', '0']
        ]
      };
      const options = {
        equity: 10000,
        riskPct: 0.01,
        RR: 3,
        maxLossAmount: 100
      };

      const result = ICTExecution.calculateRiskManagement(ltfResult, options);

      expect(result.entry).toBe(50000);
      expect(result.stopLoss).toBeLessThan(50000);
      expect(result.takeProfit).toBeGreaterThan(50000);
      expect(result.riskRewardRatio).toBe(3);
      expect(result.equity).toBe(10000);
      expect(result.riskAmount).toBe(100);
      expect(result.leverage).toBeGreaterThan(0);
      expect(result.margin).toBeGreaterThan(0);
    });

    test('应该正确计算空头风险管理', () => {
      const ltfResult = {
        entryPrice: 50000,
        atr15: 500,
        data15M: [
          [1640995200000, '50000', '51000', '49000', '50500', '1000', 1640995259999, '5000', 100, '0', '0', '0'],
          [1640995260000, '50500', '50000', '48000', '48500', '1200', 1640995319999, '6000', 120, '0', '0', '0'],
          [1640995320000, '48500', '49000', '47000', '47500', '1500', 1640995379999, '7500', 150, '0', '0', '0']
        ]
      };
      const options = {
        equity: 10000,
        riskPct: 0.01,
        RR: 3,
        maxLossAmount: 100
      };

      const result = ICTExecution.calculateRiskManagement(ltfResult, options);

      expect(result.entry).toBe(50000);
      expect(result.stopLoss).toBeGreaterThan(50000);
      expect(result.takeProfit).toBeLessThan(50000);
      expect(result.riskRewardRatio).toBe(3);
    });

    test('应该处理错误情况', () => {
      const ltfResult = {
        entryPrice: 0, // 无效价格
        atr15: 0,
        data15M: []
      };
      const options = {
        equity: 10000,
        riskPct: 0.01,
        RR: 3,
        maxLossAmount: 100
      };

      const result = ICTExecution.calculateRiskManagement(ltfResult, options);

      expect(result.error).toBeDefined();
      expect(result.entry).toBe(0);
      expect(result.stopLoss).toBe(0);
      expect(result.takeProfit).toBe(0);
    });
  });

  describe('止损计算 (calculateStopLoss)', () => {
    test('应该正确计算多头止损', () => {
      const ltfResult = {
        entryPrice: 50000,
        atr15: 500,
        data15M: [
          [1640995200000, '50000', '51000', '49000', '50500', '1000', 1640995259999, '5000', 100, '0', '0', '0'],
          [1640995260000, '50500', '52000', '50000', '51500', '1200', 1640995319999, '6000', 120, '0', '0', '0'],
          [1640995320000, '51500', '53000', '51000', '52500', '1500', 1640995379999, '7500', 150, '0', '0', '0']
        ]
      };

      const result = ICTExecution.calculateStopLoss(ltfResult);

      expect(result).toBeLessThan(50000);
      expect(result).toBeGreaterThan(0);
    });

    test('应该正确计算空头止损', () => {
      const ltfResult = {
        entryPrice: 50000,
        atr15: 500,
        data15M: [
          [1640995200000, '50000', '51000', '49000', '50500', '1000', 1640995259999, '5000', 100, '0', '0', '0'],
          [1640995260000, '50500', '50000', '48000', '48500', '1200', 1640995319999, '6000', 120, '0', '0', '0'],
          [1640995320000, '48500', '49000', '47000', '47500', '1500', 1640995379999, '7500', 150, '0', '0', '0']
        ]
      };

      const result = ICTExecution.calculateStopLoss(ltfResult);

      expect(result).toBeGreaterThan(50000);
    });

    test('应该处理数据不足的情况', () => {
      const ltfResult = {
        entryPrice: 50000,
        atr15: 500,
        data15M: []
      };

      const result = ICTExecution.calculateStopLoss(ltfResult);

      expect(result).toBe(49000); // 默认2%止损
    });
  });

  describe('止盈计算 (calculateTakeProfit)', () => {
    test('应该正确计算多头止盈', () => {
      const entry = 50000;
      const stopLoss = 49000;
      const RR = 3;

      const result = ICTExecution.calculateTakeProfit(entry, stopLoss, RR);

      expect(result).toBe(53000); // 50000 + (3 * 1000)
    });

    test('应该正确计算空头止盈', () => {
      const entry = 50000;
      const stopLoss = 51000;
      const RR = 3;

      const result = ICTExecution.calculateTakeProfit(entry, stopLoss, RR);

      expect(result).toBe(47000); // 50000 - (3 * 1000)
    });

    test('应该处理错误情况', () => {
      const entry = 0;
      const stopLoss = 0;
      const RR = 3;

      const result = ICTExecution.calculateTakeProfit(entry, stopLoss, RR);

      expect(result).toBe(0);
    });
  });

  describe('杠杆数据计算 (calculateLeverageData)', () => {
    test('应该正确计算杠杆数据', () => {
      const entryPrice = 50000;
      const stopLossPrice = 49000;
      const takeProfitPrice = 53000;
      const direction = 'LONG';
      const maxLossAmount = 100;

      const result = ICTExecution.calculateLeverageData(
        entryPrice,
        stopLossPrice,
        takeProfitPrice,
        direction,
        maxLossAmount
      );

      expect(result.maxLeverage).toBeGreaterThan(0);
      expect(result.minMargin).toBeGreaterThan(0);
      expect(result.stopLossDistance).toBeGreaterThan(0);
      expect(result.atrValue).toBe(1000);
      expect(result.direction).toBe('LONG');
      expect(result.maxLossAmount).toBe(100);
    });

    test('应该限制最大杠杆', () => {
      const entryPrice = 50000;
      const stopLossPrice = 49900; // 很小的止损距离
      const takeProfitPrice = 53000;
      const direction = 'LONG';
      const maxLossAmount = 100;

      const result = ICTExecution.calculateLeverageData(
        entryPrice,
        stopLossPrice,
        takeProfitPrice,
        direction,
        maxLossAmount
      );

      expect(result.maxLeverage).toBeLessThanOrEqual(125);
    });

    test('应该处理错误情况', () => {
      const entryPrice = 0;
      const stopLossPrice = 0;
      const takeProfitPrice = 0;
      const direction = 'LONG';
      const maxLossAmount = 100;

      const result = ICTExecution.calculateLeverageData(
        entryPrice,
        stopLossPrice,
        takeProfitPrice,
        direction,
        maxLossAmount
      );

      expect(result.error).toBeDefined();
      expect(result.maxLeverage).toBe(10);
      expect(result.minMargin).toBe(100);
    });
  });

  describe('信号验证 (validateSignal)', () => {
    test('应该验证有效的多头信号', () => {
      const signal = {
        symbol: 'BTCUSDT',
        entryPrice: 50000,
        stopLoss: 49000,
        takeProfit: 53000,
        signalType: 'LONG'
      };

      const result = ICTExecution.validateSignal(signal);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.actualRR).toBe('3.00');
    });

    test('应该验证有效的空头信号', () => {
      const signal = {
        symbol: 'BTCUSDT',
        entryPrice: 50000,
        stopLoss: 51000,
        takeProfit: 47000,
        signalType: 'SHORT'
      };

      const result = ICTExecution.validateSignal(signal);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.actualRR).toBe('3.00');
    });

    test('应该拒绝无效的多头信号', () => {
      const signal = {
        symbol: 'BTCUSDT',
        entryPrice: 50000,
        stopLoss: 51000, // 止损高于入场价
        takeProfit: 53000,
        signalType: 'LONG'
      };

      const result = ICTExecution.validateSignal(signal);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('多头交易止损价格应低于入场价格');
    });

    test('应该拒绝无效的空头信号', () => {
      const signal = {
        symbol: 'BTCUSDT',
        entryPrice: 50000,
        stopLoss: 49000, // 止损低于入场价
        takeProfit: 47000,
        signalType: 'SHORT'
      };

      const result = ICTExecution.validateSignal(signal);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('空头交易止损价格应高于入场价格');
    });

    test('应该拒绝风险回报比过低的信号', () => {
      const signal = {
        symbol: 'BTCUSDT',
        entryPrice: 50000,
        stopLoss: 49000,
        takeProfit: 50100, // 很小的止盈
        signalType: 'LONG'
      };

      const result = ICTExecution.validateSignal(signal);

      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('风险回报比过低'))).toBe(true);
    });

    test('应该拒绝缺少必要字段的信号', () => {
      const signal = {
        symbol: 'BTCUSDT',
        entryPrice: 0,
        stopLoss: 0,
        takeProfit: 0,
        signalType: 'LONG'
      };

      const result = ICTExecution.validateSignal(signal);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('无效入场价格');
    });
  });

  describe('执行信号格式化 (formatExecution)', () => {
    test('应该正确格式化多头执行信号', () => {
      const result = ICTExecution.formatExecution('LONG', 'OB_ENGULFING');

      expect(result).toBe('做多_OB_ENGULFING');
    });

    test('应该正确格式化空头执行信号', () => {
      const result = ICTExecution.formatExecution('SHORT', 'FVG_SWEEP');

      expect(result).toBe('做空_FVG_SWEEP');
    });

    test('应该处理无信号情况', () => {
      const result = ICTExecution.formatExecution('NONE', 'NONE');

      expect(result).toBe('NONE');
    });
  });

  describe('模拟交易记录创建 (createSimulationRecord)', () => {
    test('应该正确创建模拟交易记录', () => {
      const signal = {
        symbol: 'BTCUSDT',
        entryPrice: 50000,
        stopLoss: 49000,
        takeProfit: 53000,
        signalType: 'LONG',
        executionMode: 'OB_ENGULFING'
      };
      const options = {
        triggerReason: 'ICT_SIGNAL',
        maxLossAmount: 100
      };

      const result = ICTExecution.createSimulationRecord(signal, options);

      expect(result.symbol).toBe('BTCUSDT');
      expect(result.entry_price).toBe(50000);
      expect(result.stop_loss_price).toBe(49000);
      expect(result.take_profit_price).toBe(53000);
      expect(result.signal_type).toBe('LONG');
      expect(result.execution_mode).toBe('OB_ENGULFING');
      expect(result.status).toBe('ACTIVE');
      expect(result.trigger_reason).toBe('ICT_SIGNAL');
      expect(result.max_leverage).toBeGreaterThan(0);
      expect(result.min_margin).toBeGreaterThan(0);
    });

    test('应该处理错误情况', () => {
      const signal = {
        symbol: 'BTCUSDT',
        entryPrice: 0,
        stopLoss: 0,
        takeProfit: 0,
        signalType: 'LONG',
        executionMode: 'OB_ENGULFING'
      };
      const options = {
        triggerReason: 'ICT_SIGNAL',
        maxLossAmount: 100
      };

      expect(() => {
        ICTExecution.createSimulationRecord(signal, options);
      }).toThrow();
    });
  });
});
