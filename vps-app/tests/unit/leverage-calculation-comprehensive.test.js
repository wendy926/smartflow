// tests/leverage-calculation-comprehensive.test.js
// 全面测试杠杆计算是否符合strategy-v3.md文档要求

const SmartFlowStrategyV3 = require('../modules/strategy/SmartFlowStrategyV3');
const StrategyV3Execution = require('../modules/strategy/StrategyV3Execution');
const DatabaseManager = require('../modules/database/DatabaseManager');
const path = require('path');
const fs = require('fs');

describe('杠杆计算全面测试', () => {
  let db;
  let testDbPath;

  beforeAll(async () => {
    // 创建测试数据库
    testDbPath = path.join(__dirname, 'test-leverage-comprehensive.db');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    db = new DatabaseManager(testDbPath);
    await db.init();
  });

  afterAll(async () => {
    // 清理测试数据库
    await db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('SmartFlowStrategyV3.calculateLeverageData', () => {
    test('应该按照strategy-v3.md文档正确计算杠杆和保证金', async () => {
      const testCases = [
        {
          description: '2%止损，100 USDT最大损失',
          entryPrice: 50000,
          stopLossPrice: 49000, // 2%止损
          maxLossAmount: 100,
          direction: 'LONG',
          expectedLeverage: 40, // 1/(0.02 + 0.005) = 40
          expectedMargin: 125,  // 100/(40 * 0.02) = 125
          expectedStopLossDistance: 2.0
        },
        {
          description: '1%止损，50 USDT最大损失',
          entryPrice: 50000,
          stopLossPrice: 49500, // 1%止损
          maxLossAmount: 50,
          direction: 'LONG',
          expectedLeverage: 66, // 1/(0.01 + 0.005) = 66.67 -> 66
          expectedMargin: 76,   // 50/(66 * 0.01) = 75.76 -> 76
          expectedStopLossDistance: 1.0
        },
        {
          description: '4%止损，200 USDT最大损失',
          entryPrice: 50000,
          stopLossPrice: 48000, // 4%止损
          maxLossAmount: 200,
          direction: 'LONG',
          expectedLeverage: 22, // 1/(0.04 + 0.005) = 22.22 -> 22
          expectedMargin: 228,  // 200/(22 * 0.04) = 227.27 -> 228
          expectedStopLossDistance: 4.0
        },
        {
          description: '空头2%止损，100 USDT最大损失',
          entryPrice: 50000,
          stopLossPrice: 51000, // 2%止损
          maxLossAmount: 100,
          direction: 'SHORT',
          expectedLeverage: 40, // 1/(0.02 + 0.005) = 40
          expectedMargin: 125,  // 100/(40 * 0.02) = 125
          expectedStopLossDistance: 2.0
        }
      ];

      for (const testCase of testCases) {
        const result = await SmartFlowStrategyV3.calculateLeverageData(
          testCase.entryPrice,
          testCase.stopLossPrice,
          1000, // ATR
          testCase.direction,
          db,
          testCase.maxLossAmount
        );

        expect(result.maxLeverage).toBe(testCase.expectedLeverage);
        expect(result.minMargin).toBe(testCase.expectedMargin);
        expect(result.stopLossDistance).toBe(testCase.expectedStopLossDistance);

        // 验证实际最大损失是否接近设定值
        const actualMaxLoss = result.minMargin * result.maxLeverage * (result.stopLossDistance / 100);
        expect(Math.abs(actualMaxLoss - testCase.maxLossAmount)).toBeLessThan(1);
      }
    });

    test('应该处理边界情况', async () => {
      // 测试最小止损距离
      const result1 = await SmartFlowStrategyV3.calculateLeverageData(
        50000, 49950, 1000, 'LONG', db, 100 // 0.1%止损
      );
      expect(result1.maxLeverage).toBeGreaterThan(0);
      expect(result1.minMargin).toBeGreaterThan(0);

      // 测试最大止损距离
      const result2 = await SmartFlowStrategyV3.calculateLeverageData(
        50000, 25000, 1000, 'LONG', db, 100 // 50%止损
      );
      expect(result2.maxLeverage).toBeGreaterThan(0);
      expect(result2.minMargin).toBeGreaterThan(0);
    });

    test('应该拒绝不合理的止损距离', async () => {
      // 测试过小的止损距离
      const result1 = await SmartFlowStrategyV3.calculateLeverageData(
        50000, 49999, 1000, 'LONG', db, 100 // 0.002%止损
      );
      expect(result1.error).toContain('止损距离不合理');

      // 测试过大的止损距离
      const result2 = await SmartFlowStrategyV3.calculateLeverageData(
        50000, 10000, 1000, 'LONG', db, 100 // 80%止损
      );
      expect(result2.error).toContain('止损距离不合理');
    });
  });

  describe('StrategyV3Execution.calculateLeverageData', () => {
    test('应该按照strategy-v3.md文档正确计算杠杆和保证金', async () => {
      const execution = new StrategyV3Execution(db);

      const testCases = [
        {
          description: '2%止损，100 USDT最大损失',
          entryPrice: 50000,
          stopLossPrice: 49000,
          takeProfitPrice: 51000,
          direction: 'LONG',
          maxLossAmount: 100,
          expectedLeverage: 40,
          expectedMargin: 125,
          expectedStopLossDistance: 2.0
        },
        {
          description: '空头1%止损，50 USDT最大损失',
          entryPrice: 50000,
          stopLossPrice: 50500,
          takeProfitPrice: 49500,
          direction: 'SHORT',
          maxLossAmount: 50,
          expectedLeverage: 66,
          expectedMargin: 76,
          expectedStopLossDistance: 1.0
        }
      ];

      for (const testCase of testCases) {
        // 设置用户最大损失金额
        await db.setUserSetting('maxLossAmount', testCase.maxLossAmount.toString());

        const result = await execution.calculateLeverageData(
          testCase.entryPrice,
          testCase.stopLossPrice,
          testCase.takeProfitPrice,
          testCase.direction
        );

        expect(result.leverage).toBe(testCase.expectedLeverage);
        expect(result.margin).toBe(testCase.expectedMargin);
        expect(result.stopLossDistance).toBe(testCase.expectedStopLossDistance);

        // 验证实际最大损失
        const actualMaxLoss = result.margin * result.leverage * (result.stopLossDistance / 100);
        expect(Math.abs(actualMaxLoss - testCase.maxLossAmount)).toBeLessThan(1);
      }
    });
  });

  describe('杠杆计算数学验证', () => {
    test('应该验证杠杆计算公式的正确性', () => {
      const testCases = [
        { stopLossPercent: 0.01, expectedLeverage: 66 }, // 1%
        { stopLossPercent: 0.02, expectedLeverage: 40 }, // 2%
        { stopLossPercent: 0.05, expectedLeverage: 18 }, // 5%
        { stopLossPercent: 0.10, expectedLeverage: 9 },  // 10%
      ];

      testCases.forEach(testCase => {
        const calculatedLeverage = Math.floor(1 / (testCase.stopLossPercent + 0.005));
        expect(calculatedLeverage).toBe(testCase.expectedLeverage);
      });
    });

    test('应该验证保证金计算公式的正确性', () => {
      const testCases = [
        { maxLoss: 100, leverage: 40, stopLossPercent: 0.02, expectedMargin: 125 },
        { maxLoss: 50, leverage: 66, stopLossPercent: 0.01, expectedMargin: 76 },
        { maxLoss: 200, leverage: 22, stopLossPercent: 0.04, expectedMargin: 228 },
      ];

      testCases.forEach(testCase => {
        const calculatedMargin = Math.ceil(testCase.maxLoss / (testCase.leverage * testCase.stopLossPercent));
        expect(calculatedMargin).toBe(testCase.expectedMargin);
      });
    });
  });

  describe('实际最大损失验证', () => {
    test('应该确保实际最大损失不超过设定值', async () => {
      const maxLossAmounts = [10, 25, 50, 100, 200, 500];
      const stopLossPercents = [0.01, 0.02, 0.05, 0.10];

      for (const maxLoss of maxLossAmounts) {
        for (const stopLossPercent of stopLossPercents) {
          const entryPrice = 50000;
          const stopLossPrice = entryPrice * (1 - stopLossPercent);

          const result = await SmartFlowStrategyV3.calculateLeverageData(
            entryPrice,
            stopLossPrice,
            1000,
            'LONG',
            db,
            maxLoss
          );

          const actualMaxLoss = result.minMargin * result.maxLeverage * (result.stopLossDistance / 100);

          // 实际最大损失应该接近但不大于设定值
          expect(actualMaxLoss).toBeLessThanOrEqual(maxLoss + 1); // 允许1 USDT的误差
          expect(actualMaxLoss).toBeGreaterThan(maxLoss * 0.95); // 至少达到设定值的95%
        }
      }
    });
  });

  describe('错误处理', () => {
    test('应该正确处理无效输入', async () => {
      // 无效价格
      const result1 = await SmartFlowStrategyV3.calculateLeverageData(
        0, 49000, 1000, 'LONG', db, 100
      );
      expect(result1.error).toContain('无效的价格参数');

      const result2 = await SmartFlowStrategyV3.calculateLeverageData(
        50000, 0, 1000, 'LONG', db, 100
      );
      expect(result2.error).toContain('无效的价格参数');

      // 负数价格
      const result3 = await SmartFlowStrategyV3.calculateLeverageData(
        -50000, 49000, 1000, 'LONG', db, 100
      );
      expect(result3.error).toContain('无效的价格参数');
    });

    test('应该正确处理计算失败的情况', async () => {
      // 止损距离为0的情况
      const result = await SmartFlowStrategyV3.calculateLeverageData(
        50000, 50000, 1000, 'LONG', db, 100
      );
      expect(result.error).toContain('止损距离不合理');
    });
  });
});
