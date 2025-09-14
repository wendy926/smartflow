// tests/max-loss-integration.test.js
// 测试主页配置的单次交易最大损失是否在模拟交易中生效

const DatabaseManager = require('../modules/database/DatabaseManager');
const SmartFlowStrategyV3 = require('../modules/strategy/SmartFlowStrategyV3');
const StrategyV3Execution = require('../modules/strategy/StrategyV3Execution');
const path = require('path');
const fs = require('fs');

describe('最大损失金额集成测试', () => {
  let db;
  let testDbPath;

  beforeAll(async () => {
    // 创建测试数据库
    testDbPath = path.join(__dirname, 'test-max-loss-integration.db');
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

  describe('用户设置获取和保存', () => {
    test('应该能够保存和获取不同的最大损失金额', async () => {
      const testCases = [50, 100, 200, 500];

      for (const maxLoss of testCases) {
        // 保存设置
        await db.setUserSetting('maxLossAmount', maxLoss.toString());

        // 获取设置
        const savedValue = await db.getUserSetting('maxLossAmount', 100);
        expect(parseFloat(savedValue)).toBe(maxLoss);
      }
    });
  });

  describe('SmartFlowStrategyV3.calculateLeverageData', () => {
    test('应该使用用户设置的最大损失金额计算杠杆', async () => {
      const testCases = [
        { maxLoss: 50, expectedMargin: 63 },
        { maxLoss: 100, expectedMargin: 125 },
        { maxLoss: 200, expectedMargin: 250 }
      ];

      for (const testCase of testCases) {
        // 设置用户最大损失金额
        await db.setUserSetting('maxLossAmount', testCase.maxLoss.toString());

        const entryPrice = 50000;
        const stopLossPrice = 49000; // 2%止损
        const atr14 = 1000;
        const direction = 'LONG';

        const leverageData = await SmartFlowStrategyV3.calculateLeverageData(
          entryPrice,
          stopLossPrice,
          atr14,
          direction,
          db,
          testCase.maxLoss
        );

        expect(leverageData.maxLeverage).toBe(40); // 2%止损 + 0.5% = 2.5%, 1/0.025 = 40
        expect(leverageData.minMargin).toBe(testCase.expectedMargin);
        expect(leverageData.stopLossDistance).toBe(2.0);

        // 验证最大损失限制
        const actualMaxLoss = leverageData.minMargin * leverageData.maxLeverage * (leverageData.stopLossDistance / 100);
        expect(Math.abs(actualMaxLoss - testCase.maxLoss)).toBeLessThan(1);
      }
    });
  });

  describe('StrategyV3Execution.calculateLeverageData', () => {
    test('应该使用用户设置的最大损失金额计算杠杆', async () => {
      const execution = new StrategyV3Execution(db);

      // 设置最大损失为150 USDT
      await db.setUserSetting('maxLossAmount', '150');

      const leverageData = await execution.calculateLeverageData(
        60000, // 入场价
        58800, // 止损价 (2%止损)
        1200,  // 止盈价
        'LONG' // 方向
      );

      expect(leverageData.leverage).toBe(40);
      expect(leverageData.margin).toBe(188); // 150 / (40 * 0.02) = 187.5, 向上取整 = 188
      expect(leverageData.stopLossDistance).toBe(2.0);

      // 验证最大损失限制
      const actualMaxLoss = leverageData.margin * leverageData.leverage * (leverageData.stopLossDistance / 100);
      expect(Math.abs(actualMaxLoss - 150)).toBeLessThan(1);
    });
  });

  describe('server.js autoStartSimulation逻辑', () => {
    test('应该使用用户设置的最大损失金额重新计算杠杆', async () => {
      // 模拟信号数据
      const signalData = {
        symbol: 'BTCUSDT',
        execution: '做多_多头回踩突破',
        entrySignal: 55000,
        stopLoss: 53900, // 2%止损
        takeProfit: 56100,
        maxLeverage: 10, // 默认值，应该被重新计算
        minMargin: 100,  // 默认值，应该被重新计算
        stopLossDistance: 0,
        atrValue: 1100,
        atr14: 1100,
        marketType: '趋势市',
        executionMode: '多头回踩突破',
        setupCandleHigh: 55100,
        setupCandleLow: 54900
      };

      // 设置最大损失为75 USDT
      await db.setUserSetting('maxLossAmount', '75');

      // 模拟重新计算逻辑
      const isLong = signalData.execution.includes('做多_');
      const direction = isLong ? 'LONG' : 'SHORT';

      // 获取用户设置的最大损失金额
      const userMaxLossAmount = parseFloat(await db.getUserSetting('maxLossAmount', 100));

      const leverageData = await SmartFlowStrategyV3.calculateLeverageData(
        signalData.entrySignal,
        signalData.stopLoss,
        signalData.atr14,
        direction,
        db,
        userMaxLossAmount
      );

      expect(leverageData.maxLeverage).toBe(40);
      expect(leverageData.minMargin).toBe(94); // 75 / (40 * 0.02) = 93.75, 向上取整 = 94
      expect(leverageData.stopLossDistance).toBe(2.0);

      // 验证最大损失限制
      const actualMaxLoss = leverageData.minMargin * leverageData.maxLeverage * (leverageData.stopLossDistance / 100);
      expect(Math.abs(actualMaxLoss - 75)).toBeLessThan(1);
    });
  });

  describe('不同止损距离的杠杆计算', () => {
    test('应该根据止损距离正确计算杠杆和保证金', async () => {
      const maxLossAmount = 100;
      await db.setUserSetting('maxLossAmount', maxLossAmount.toString());

      const testCases = [
        { entryPrice: 50000, stopLossPrice: 49500, expectedLeverage: 66, description: '1%止损' },
        { entryPrice: 50000, stopLossPrice: 49000, expectedLeverage: 40, description: '2%止损' },
        { entryPrice: 50000, stopLossPrice: 48000, expectedLeverage: 22, description: '4%止损' }
      ];

      for (const testCase of testCases) {
        const leverageData = await SmartFlowStrategyV3.calculateLeverageData(
          testCase.entryPrice,
          testCase.stopLossPrice,
          1000, // ATR
          'LONG',
          db,
          maxLossAmount
        );

        expect(leverageData.maxLeverage).toBe(testCase.expectedLeverage);
        expect(leverageData.minMargin).toBeGreaterThan(0);
        expect(leverageData.stopLossDistance).toBeGreaterThan(0);

        // 验证最大损失限制
        const actualMaxLoss = leverageData.minMargin * leverageData.maxLeverage * (leverageData.stopLossDistance / 100);
        expect(Math.abs(actualMaxLoss - maxLossAmount)).toBeLessThan(1);
      }
    });
  });
});
