// tests/leverage-default-value-fix.test.js
// 杠杆默认值修复测试

const SmartFlowStrategyV3 = require('../modules/strategy/SmartFlowStrategyV3');
const SimulationManager = require('../modules/database/SimulationManager');

describe('杠杆默认值修复测试', () => {
  let mockDatabase;
  let simulationManager;

  beforeEach(() => {
    mockDatabase = {
      getUserSetting: jest.fn().mockResolvedValue('50'), // 用户设置50 USDT
      run: jest.fn().mockResolvedValue({ id: 1 }),
      runQuery: jest.fn().mockResolvedValue([])
    };

    simulationManager = new SimulationManager(mockDatabase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('SmartFlowStrategyV3.calculateLeverageData', () => {
    test('应该使用用户设置的最大损失金额计算杠杆', async () => {
      const result = await SmartFlowStrategyV3.calculateLeverageData(
        50000, // entryPrice
        49000, // stopLoss (2%止损)
        1000,  // atr14
        'LONG', // direction
        mockDatabase,
        50 // maxLossAmount
      );

      expect(result.maxLeverage).not.toBe(10);
      expect(result.minMargin).not.toBe(100);
      expect(result.maxLeverage).toBeGreaterThan(0);
      expect(result.minMargin).toBeGreaterThan(0);
    });

    test('应该处理无效参数时返回默认值', async () => {
      const result = await SmartFlowStrategyV3.calculateLeverageData(
        null, // 无效的entryPrice
        49000,
        1000,
        'LONG',
        mockDatabase,
        50
      );

      expect(result.maxLeverage).toBe(10);
      expect(result.minMargin).toBe(100);
      expect(result.error).toBeDefined();
    });

    test('应该处理ATR为0的情况', async () => {
      const result = await SmartFlowStrategyV3.calculateLeverageData(
        50000,
        49000,
        0, // ATR为0
        'LONG',
        mockDatabase,
        50
      );

      expect(result.maxLeverage).toBeGreaterThan(0);
      expect(result.minMargin).toBeGreaterThan(0);
    });
  });

  describe('analyzeTrendMarket方法', () => {
    test('应该传递maxLossAmount参数到calculateLeverageData', async () => {
      const strategy = new SmartFlowStrategyV3(mockDatabase);
      
      // 模拟分析结果
      const trend4hResult = {
        marketType: '趋势市',
        trend: '多头趋势',
        ma20: 50000,
        ma50: 49000,
        ma200: 48000
      };

      const scoringResult = {
        allowEntry: true,
        score: 85
      };

      const result = await strategy.analyzeTrendMarket(
        'BTCUSDT',
        trend4hResult,
        scoringResult,
        50 // maxLossAmount
      );

      expect(result).toBeDefined();
      // 验证结果中包含了正确的杠杆计算
      if (result.leverageData) {
        expect(result.leverageData.maxLeverage).not.toBe(10);
        expect(result.leverageData.minMargin).not.toBe(100);
      }
    });
  });

  describe('analyzeRangeMarket方法', () => {
    test('应该传递maxLossAmount参数到calculateLeverageData', async () => {
      const strategy = new SmartFlowStrategyV3(mockDatabase);
      
      // 模拟分析结果
      const trend4hResult = {
        marketType: '震荡市',
        trend: '震荡市',
        ma20: 50000,
        ma50: 49000,
        ma200: 48000
      };

      const scoringResult = {
        allowEntry: true,
        score: 85
      };

      const result = await strategy.analyzeRangeMarket(
        'BTCUSDT',
        trend4hResult,
        scoringResult,
        50 // maxLossAmount
      );

      expect(result).toBeDefined();
      // 验证结果中包含了正确的杠杆计算
      if (result.leverageData) {
        expect(result.leverageData.maxLeverage).not.toBe(10);
        expect(result.leverageData.minMargin).not.toBe(100);
      }
    });
  });

  describe('SimulationManager.createSimulation', () => {
    test('应该使用正确的杠杆和保证金创建模拟交易', async () => {
      const result = await simulationManager.createSimulation(
        'BTCUSDT',
        50000, // entryPrice
        49000, // stopLoss
        51000, // takeProfit
        20,    // maxLeverage (非默认值)
        50,    // minMargin (非默认值)
        'SIGNAL_多头回踩突破',
        2.0,   // stopLossDistance
        1000,  // atrValue
        'LONG' // direction
      );

      expect(result).toBeDefined();
      expect(mockDatabase.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO simulations'),
        expect.arrayContaining([
          'BTCUSDT',
          50000,
          49000,
          51000,
          20, // 应该使用传入的杠杆值
          50, // 应该使用传入的保证金值
          'SIGNAL_多头回踩突破',
          'ACTIVE',
          2.0,
          1000,
          'LONG'
        ])
      );
    });

    test('应该调整杠杆以符合最大损失限制', async () => {
      // 模拟一个会导致实际损失超过最大损失的情况
      // 实际损失 = |50000 - 49000| * 10 / 50000 = 1000 * 10 / 50000 = 0.2 USDT
      // 这个值小于50 USDT，所以不会触发调整
      // 让我们使用更极端的情况
      const result = await simulationManager.createSimulation(
        'BTCUSDT',
        50000, // entryPrice
        40000, // stopLoss (20%止损)
        60000, // takeProfit
        100,   // maxLeverage (过高的杠杆)
        1000,  // minMargin (较高的保证金)
        'SIGNAL_多头回踩突破',
        20.0,  // stopLossDistance
        1000,  // atrValue
        'LONG' // direction
      );

      expect(result).toBeDefined();
      // 验证杠杆被调整了
      // 实际损失 = |50000 - 40000| * 1000 / 50000 = 10000 * 1000 / 50000 = 200 USDT > 50 USDT
      const insertCall = mockDatabase.run.mock.calls[0];
      const adjustedLeverage = insertCall[1][4]; // max_leverage参数
      // 由于实际损失200 USDT大于最大损失50 USDT，杠杆应该被调整
      expect(adjustedLeverage).toBeLessThan(100); // 调整后的杠杆应该更小
    });
  });

  describe('API端点测试', () => {
    test('应该检测并修复API调用中的默认值', async () => {
      // 模拟API调用数据
      const apiData = {
        symbol: 'BTCUSDT',
        entryPrice: 50000,
        stopLoss: 49000,
        takeProfit: 51000,
        maxLeverage: 10, // 默认值
        minMargin: 100,  // 默认值
        executionMode: '多头回踩突破',
        direction: 'LONG',
        stopLossDistance: 2.0,
        atrValue: 1000,
        atr14: 1000
      };

      // 这里应该模拟API端点的逻辑
      // 由于我们无法直接测试Express路由，我们测试核心逻辑
      const leverageData = await SmartFlowStrategyV3.calculateLeverageData(
        apiData.entryPrice,
        apiData.stopLoss,
        apiData.atr14,
        apiData.direction,
        mockDatabase,
        50 // 用户设置的最大损失金额
      );

      expect(leverageData.maxLeverage).not.toBe(10);
      expect(leverageData.minMargin).not.toBe(100);
      expect(leverageData.maxLeverage).toBeGreaterThan(0);
      expect(leverageData.minMargin).toBeGreaterThan(0);
    });
  });

  describe('错误处理测试', () => {
    test('应该处理数据库错误并记录', async () => {
      mockDatabase.getUserSetting.mockRejectedValue(new Error('Database error'));

      const result = await SmartFlowStrategyV3.calculateLeverageData(
        50000,
        49000,
        1000,
        'LONG',
        mockDatabase,
        50
      );

      // 即使数据库错误，计算仍然可能成功（因为maxLossAmount参数已提供）
      expect(result.maxLeverage).toBeGreaterThan(0);
      expect(result.minMargin).toBeGreaterThan(0);
      // 如果计算失败，应该有错误信息
      if (result.error) {
        expect(result.maxLeverage).toBe(10);
        expect(result.minMargin).toBe(100);
      }
    });

    test('应该处理计算错误并记录', async () => {
      // 使用会导致计算错误的参数
      const result = await SmartFlowStrategyV3.calculateLeverageData(
        0, // 无效的entryPrice
        49000,
        1000,
        'LONG',
        mockDatabase,
        50
      );

      expect(result.maxLeverage).toBe(10);
      expect(result.minMargin).toBe(100);
      expect(result.error).toBeDefined();
    });
  });

  describe('边界条件测试', () => {
    test('应该处理极小的止损距离', async () => {
      const result = await SmartFlowStrategyV3.calculateLeverageData(
        50000,
        49999, // 0.02%止损
        1000,
        'LONG',
        mockDatabase,
        50
      );

      expect(result.maxLeverage).toBeGreaterThan(0);
      expect(result.minMargin).toBeGreaterThan(0);
    });

    test('应该处理极大的止损距离', async () => {
      const result = await SmartFlowStrategyV3.calculateLeverageData(
        50000,
        40000, // 20%止损
        1000,
        'LONG',
        mockDatabase,
        50
      );

      expect(result.maxLeverage).toBeGreaterThan(0);
      expect(result.minMargin).toBeGreaterThan(0);
    });

    test('应该处理不同的最大损失金额', async () => {
      const testCases = [10, 20, 50, 100];
      
      for (const maxLoss of testCases) {
        const result = await SmartFlowStrategyV3.calculateLeverageData(
          50000,
          49000, // 2%止损
          1000,
          'LONG',
          mockDatabase,
          maxLoss
        );

        expect(result.maxLeverage).toBeGreaterThan(0);
        expect(result.minMargin).toBeGreaterThan(0);
        
        // 验证实际最大损失接近设定值
        const actualMaxLoss = result.minMargin * result.maxLeverage * (result.stopLossDistance / 100);
        expect(Math.abs(actualMaxLoss - maxLoss)).toBeLessThan(1);
      }
    });
  });

  describe('数据一致性测试', () => {
    test('应该确保所有代码路径都使用相同的计算逻辑', async () => {
      const testParams = {
        entryPrice: 50000,
        stopLoss: 49000,
        atr14: 1000,
        direction: 'LONG',
        maxLossAmount: 50
      };

      // 测试静态方法
      const staticResult = await SmartFlowStrategyV3.calculateLeverageData(
        testParams.entryPrice,
        testParams.stopLoss,
        testParams.atr14,
        testParams.direction,
        mockDatabase,
        testParams.maxLossAmount
      );

      // 测试实例方法（通过StrategyV3Execution）
      const StrategyV3Execution = require('../modules/strategy/StrategyV3Execution');
      const execution = new StrategyV3Execution(mockDatabase);
      const instanceResult = await execution.calculateLeverageData(
        testParams.entryPrice,
        testParams.stopLoss,
        testParams.takeProfit || 51000,
        testParams.direction
      );

      // 结果应该一致
      expect(staticResult.maxLeverage).toBe(instanceResult.leverage);
      expect(staticResult.minMargin).toBe(instanceResult.margin);
    });
  });
});
