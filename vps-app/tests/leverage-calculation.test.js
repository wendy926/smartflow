// leverage-calculation.test.js
// 杠杆和保证金计算逻辑单元测试

const SmartFlowStrategyV3 = require('../modules/strategy/SmartFlowStrategyV3');
const StrategyV3Execution = require('../modules/strategy/StrategyV3Execution');

describe('杠杆和保证金计算逻辑测试', () => {
  let strategyV3Execution;

  beforeEach(() => {
    strategyV3Execution = new StrategyV3Execution(null); // 不传入数据库连接
  });

  describe('SmartFlowStrategyV3.calculateLeverageData', () => {
    test('应该正确计算多头交易的杠杆和保证金', async () => {
      const entryPrice = 4736.41;
      const stopLossPrice = 4709.01;
      const direction = 'LONG';
      const maxLossAmount = 100;

      const result = await SmartFlowStrategyV3.calculateLeverageData(
        entryPrice, 
        stopLossPrice, 
        null, 
        direction, 
        null, 
        maxLossAmount
      );

      // 验证计算结果
      expect(result.maxLeverage).toBeGreaterThan(0);
      expect(result.minMargin).toBeGreaterThan(0);
      expect(result.stopLossDistance).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();

      // 验证具体数值（基于我们的手动计算）
      const expectedStopLossDistance = Math.abs((entryPrice - stopLossPrice) / entryPrice) * 100;
      const expectedMaxLeverage = Math.floor(1 / (expectedStopLossDistance / 100 + 0.005));
      const expectedMinMargin = Math.ceil(maxLossAmount / (expectedMaxLeverage * expectedStopLossDistance / 100));

      expect(result.maxLeverage).toBe(expectedMaxLeverage);
      expect(result.minMargin).toBe(expectedMinMargin);
      expect(Math.abs(result.stopLossDistance - expectedStopLossDistance)).toBeLessThan(0.0001);
    });

    test('应该正确计算空头交易的杠杆和保证金', async () => {
      const entryPrice = 4709.01;
      const stopLossPrice = 4736.41;
      const direction = 'SHORT';
      const maxLossAmount = 100;

      const result = await SmartFlowStrategyV3.calculateLeverageData(
        entryPrice, 
        stopLossPrice, 
        null, 
        direction, 
        null, 
        maxLossAmount
      );

      // 验证计算结果
      expect(result.maxLeverage).toBeGreaterThan(0);
      expect(result.minMargin).toBeGreaterThan(0);
      expect(result.stopLossDistance).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();

      // 验证具体数值
      const expectedStopLossDistance = Math.abs((stopLossPrice - entryPrice) / entryPrice) * 100;
      const expectedMaxLeverage = Math.floor(1 / (expectedStopLossDistance / 100 + 0.005));
      const expectedMinMargin = Math.ceil(maxLossAmount / (expectedMaxLeverage * expectedStopLossDistance / 100));

      expect(result.maxLeverage).toBe(expectedMaxLeverage);
      expect(result.minMargin).toBe(expectedMinMargin);
    });

    test('应该处理无效的价格参数', async () => {
      const result = await SmartFlowStrategyV3.calculateLeverageData(
        null, 
        4709.01, 
        null, 
        'LONG', 
        null, 
        100
      );

      expect(result.error).toBeDefined();
      expect(result.maxLeverage).toBe(10);
      expect(result.minMargin).toBe(100);
    });

    test('应该处理不合理的止损距离', async () => {
      const result = await SmartFlowStrategyV3.calculateLeverageData(
        100, 
        1, // 止损距离过大（99%）
        null, 
        'LONG', 
        null, 
        100
      );

      expect(result.error).toBeDefined();
      expect(result.maxLeverage).toBe(10);
      expect(result.minMargin).toBe(100);
    });

    test('应该处理止损距离过小的情况', async () => {
      const result = await SmartFlowStrategyV3.calculateLeverageData(
        100, 
        99.999, // 止损距离过小（0.001%）
        null, 
        'LONG', 
        null, 
        100
      );

      expect(result.error).toBeDefined();
      expect(result.maxLeverage).toBe(10);
      expect(result.minMargin).toBe(100);
    });
  });

  describe('StrategyV3Execution.calculateLeverageData', () => {
    test('应该正确计算杠杆和保证金（无数据库连接）', async () => {
      const entryPrice = 4736.41;
      const stopLossPrice = 4709.01;
      const direction = 'LONG';

      const result = await strategyV3Execution.calculateLeverageData(
        entryPrice, 
        stopLossPrice, 
        null, 
        direction
      );

      // 验证计算结果
      expect(result.leverage).toBeGreaterThan(0);
      expect(result.margin).toBeGreaterThan(0);
      expect(result.stopLossDistance).toBeGreaterThan(0);
      expect(result.riskAmount).toBe(100); // 默认最大损失金额
      expect(result.error).toBeUndefined();
    });

    test('应该处理无效的价格参数', async () => {
      const result = await strategyV3Execution.calculateLeverageData(
        null, 
        4709.01, 
        null, 
        'LONG'
      );

      expect(result.error).toBeDefined();
      expect(result.leverage).toBe(10);
      expect(result.margin).toBe(100);
    });

    test('应该处理不合理的止损距离', async () => {
      const result = await strategyV3Execution.calculateLeverageData(
        100, 
        1, // 止损距离过大（99%）
        null, 
        'LONG'
      );

      expect(result.error).toBeDefined();
      expect(result.leverage).toBe(10);
      expect(result.margin).toBe(100);
    });
  });

  describe('计算一致性测试', () => {
    test('两个计算方法应该产生相同的结果', async () => {
      const entryPrice = 4736.41;
      const stopLossPrice = 4709.01;
      const direction = 'LONG';
      const maxLossAmount = 100;

      const result1 = await SmartFlowStrategyV3.calculateLeverageData(
        entryPrice, 
        stopLossPrice, 
        null, 
        direction, 
        null, 
        maxLossAmount
      );

      const result2 = await strategyV3Execution.calculateLeverageData(
        entryPrice, 
        stopLossPrice, 
        null, 
        direction
      );

      // 验证计算结果一致
      expect(result1.maxLeverage).toBe(result2.leverage);
      expect(result1.minMargin).toBe(result2.margin);
      expect(Math.abs(result1.stopLossDistance - result2.stopLossDistance)).toBeLessThan(0.0001);
    });
  });

  describe('边界情况测试', () => {
    test('应该处理价格为零的情况', async () => {
      const result = await SmartFlowStrategyV3.calculateLeverageData(
        0, 
        4709.01, 
        null, 
        'LONG', 
        null, 
        100
      );

      expect(result.error).toBeDefined();
      expect(result.maxLeverage).toBe(10);
      expect(result.minMargin).toBe(100);
    });

    test('应该处理价格为负数的情况', async () => {
      const result = await SmartFlowStrategyV3.calculateLeverageData(
        -100, 
        4709.01, 
        null, 
        'LONG', 
        null, 
        100
      );

      expect(result.error).toBeDefined();
      expect(result.maxLeverage).toBe(10);
      expect(result.minMargin).toBe(100);
    });

    test('应该处理止损价格等于入场价格的情况', async () => {
      const result = await SmartFlowStrategyV3.calculateLeverageData(
        100, 
        100, // 止损距离为0
        null, 
        'LONG', 
        null, 
        100
      );

      expect(result.error).toBeDefined();
      expect(result.maxLeverage).toBe(10);
      expect(result.minMargin).toBe(100);
    });
  });

  describe('实际交易对测试', () => {
    const testCases = [
      {
        name: 'ETHUSDT多头',
        entryPrice: 4736.41,
        stopLossPrice: 4709.01,
        direction: 'LONG',
        expectedLeverage: 92,
        expectedMargin: 188
      },
      {
        name: 'LINKUSDT多头',
        entryPrice: 25.254,
        stopLossPrice: 25.066,
        direction: 'LONG',
        expectedLeverage: 80,
        expectedMargin: 168
      },
      {
        name: 'PUMPUSDT多头',
        entryPrice: 0.0066,
        stopLossPrice: 0.0064,
        direction: 'LONG',
        expectedLeverage: 28,
        expectedMargin: 118
      }
    ];

    testCases.forEach(testCase => {
      test(`应该正确计算${testCase.name}的杠杆和保证金`, async () => {
        const result = await SmartFlowStrategyV3.calculateLeverageData(
          testCase.entryPrice, 
          testCase.stopLossPrice, 
          null, 
          testCase.direction, 
          null, 
          100
        );

        expect(result.error).toBeUndefined();
        expect(result.maxLeverage).toBe(testCase.expectedLeverage);
        expect(result.minMargin).toBe(testCase.expectedMargin);
      });
    });
  });
});
