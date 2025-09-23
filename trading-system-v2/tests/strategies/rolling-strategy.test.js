/**
 * 动态杠杆滚仓策略单测 - 测试驱动开发
 * 基于rolling-v1.md中的滚仓策略逻辑
 */

const RollingStrategy = require('../../src/strategies/rolling-strategy');
const { createMockSymbol } = require('../setup');

describe('动态杠杆滚仓策略', () => {
  let rollingStrategy;
  let mockDatabase;
  let mockCache;

  beforeEach(() => {
    // 模拟数据库
    mockDatabase = {
      query: jest.fn(),
      execute: jest.fn()
    };

    // 模拟缓存
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn()
    };

    rollingStrategy = new RollingStrategy({
      database: mockDatabase,
      cache: mockCache
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('滚仓计算逻辑', () => {
    test('应该正确计算初始开仓', async () => {
      // Arrange
      const params = {
        principal: 200,
        initialLeverage: 50,
        entryPrice: 50000
      };

      // Act
      const result = await rollingStrategy.execute('BTCUSDT', params);

      // Assert
      expect(result).toHaveProperty('strategy', 'ROLLING');
      expect(result).toHaveProperty('signal');
      expect(result).toHaveProperty('parameters');
    });

    test('应该正确计算滚仓触发条件', async () => {
      // Arrange
      const currentPrice = 52000;
      const entryPrice = 50000;
      const position = 10000;
      const triggerRatio = 1.0; // 浮盈达到本金触发滚仓

      // Act
      const result = await rollingStrategy.execute('BTCUSDT', {
        currentPrice,
        entryPrice,
        quantity: position,
        triggerRatio
      });

      // Assert
      expect(result).toHaveProperty('strategy', 'ROLLING');
      expect(result.triggered).toBe(true);
      expect(result.floatingProfit).toBe(400); // (52000-50000)/50000 * 10000
    });

    test('应该正确计算滚仓后新仓位', async () => {
      // Arrange
      const params = {
        floatingProfit: 400,
        currentLeverage: 50,
        leverageDecay: 0.5,
        profitLockRatio: 0.5,
        minLeverage: 5
      };

      // Act
      const result = await rollingStrategy.calculateRollingPosition(params);

      // Assert
      expect(result).toHaveProperty('newLeverage', 25); // 50 * 0.5
      expect(result).toHaveProperty('lockedProfit', 200); // 400 * 0.5
      expect(result).toHaveProperty('rollingAmount', 200); // 400 - 200
      expect(result).toHaveProperty('newPosition', 5000); // 200 * 25
    });

    test('应该正确计算多次滚仓', async () => {
      // Arrange
      const params = {
        principal: 200,
        initialLeverage: 50,
        entryPrice: 50000,
        currentPrice: 53000,
        triggerRatio: 1.0,
        leverageDecay: 0.5,
        profitLockRatio: 0.5,
        minLeverage: 5
      };

      // Act
      const result = await rollingStrategy.simulateRolling(params);

      // Assert
      expect(result).toHaveProperty('totalProfit');
      expect(result).toHaveProperty('lockedProfit');
      expect(result).toHaveProperty('rollingHistory');
      expect(result.rollingHistory).toBeInstanceOf(Array);
      expect(result.rollingHistory.length).toBeGreaterThan(0);
    });

    test('应该正确处理杠杆递减到最小值', async () => {
      // Arrange
      const params = {
        currentLeverage: 8,
        leverageDecay: 0.5,
        minLeverage: 5
      };

      // Act
      const result = await rollingStrategy.calculateNewLeverage(params);

      // Assert
      expect(result).toBe(5); // 8 * 0.5 = 4，但最小值为5
    });
  });

  describe('风险控制', () => {
    test('应该正确计算止损价格', async () => {
      // Arrange
      const entryPrice = 50000;
      const atr = 200;
      const riskPercentage = 0.02; // 2%风险

      // Act
      const result = await rollingStrategy.calculateStopLoss(entryPrice, atr, riskPercentage);

      // Assert
      expect(result).toBeLessThan(entryPrice);
      expect(result).toBeGreaterThan(0);
    });

    test('应该正确计算动态止损', async () => {
      // Arrange
      const currentPrice = 52000;
      const entryPrice = 50000;
      const atr = 200;
      const lockedProfit = 200;

      // Act
      const result = await rollingStrategy.calculateDynamicStopLoss(
        currentPrice, entryPrice, atr, lockedProfit
      );

      // Assert
      expect(result).toBeGreaterThan(entryPrice);
      expect(result).toBeLessThan(currentPrice);
    });

    test('应该正确计算风险回报比', async () => {
      // Arrange
      const entryPrice = 50000;
      const stopLoss = 49000;
      const takeProfit = 52000;

      // Act
      const result = await rollingStrategy.calculateRiskRewardRatio(entryPrice, stopLoss, takeProfit);

      // Assert
      expect(result).toBe(2); // (52000-50000)/(50000-49000) = 2
    });

    test('应该正确检查风险限制', async () => {
      // Arrange
      const params = {
        principal: 200,
        position: 10000,
        stopLoss: 49000,
        entryPrice: 50000,
        maxRiskPercentage: 0.1 // 10%最大风险
      };

      // Act
      const result = await rollingStrategy.checkRiskLimit(params);

      // Assert
      expect(result).toHaveProperty('isValid', true);
      expect(result).toHaveProperty('riskPercentage');
      expect(result.riskPercentage).toBeLessThanOrEqual(0.1);
    });
  });

  describe('仓位管理', () => {
    test('应该正确计算仓位大小', async () => {
      // Arrange
      const params = {
        availableBalance: 1000,
        leverage: 10,
        entryPrice: 50000
      };

      // Act
      const result = await rollingStrategy.calculatePositionSize(params);

      // Assert
      expect(result).toHaveProperty('position', 10000); // 1000 * 10
      expect(result).toHaveProperty('margin', 1000);
      expect(result).toHaveProperty('quantity', 0.2); // 10000 / 50000
    });

    test('应该正确计算保证金需求', async () => {
      // Arrange
      const params = {
        position: 10000,
        leverage: 10,
        maintenanceMarginRate: 0.01
      };

      // Act
      const result = await rollingStrategy.calculateMarginRequirement(params);

      // Assert
      expect(result).toHaveProperty('initialMargin', 1000); // 10000 / 10
      expect(result).toHaveProperty('maintenanceMargin', 100); // 10000 * 0.01
      expect(result).toHaveProperty('totalMargin', 1100);
    });

    test('应该正确计算可用余额', async () => {
      // Arrange
      const params = {
        totalBalance: 2000,
        usedMargin: 1000,
        floatingPnL: 200
      };

      // Act
      const result = await rollingStrategy.calculateAvailableBalance(params);

      // Assert
      expect(result).toBe(1200); // 2000 - 1000 + 200
    });
  });

  describe('滚仓策略执行', () => {
    test('应该正确执行完整滚仓策略', async () => {
      // Arrange
      const params = {
        principal: 200,
        initialLeverage: 50,
        entryPrice: 50000,
        targetPrice: 52000,
        triggerRatio: 1.0,
        leverageDecay: 0.5,
        profitLockRatio: 0.5,
        minLeverage: 5,
        maxRollingTimes: 5
      };

      // Act
      const result = await rollingStrategy.execute(params);

      // Assert
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('totalProfit');
      expect(result).toHaveProperty('lockedProfit');
      expect(result).toHaveProperty('finalLeverage');
      expect(result).toHaveProperty('rollingHistory');
      expect(result.rollingHistory).toBeInstanceOf(Array);
    });

    test('应该正确处理价格下跌情况', async () => {
      // Arrange
      const params = {
        principal: 200,
        initialLeverage: 50,
        entryPrice: 50000,
        currentPrice: 48000, // 价格下跌
        triggerRatio: 1.0,
        leverageDecay: 0.5,
        profitLockRatio: 0.5,
        minLeverage: 5
      };

      // Act
      const result = await rollingStrategy.execute(params);

      // Assert
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('totalProfit');
      expect(result.totalProfit).toBeLessThan(0); // 亏损
      expect(result).toHaveProperty('rollingHistory');
      expect(result.rollingHistory.length).toBe(0); // 没有滚仓
    });

    test('应该正确处理达到最大滚仓次数', async () => {
      // Arrange
      const params = {
        principal: 200,
        initialLeverage: 50,
        entryPrice: 50000,
        targetPrice: 60000, // 大幅上涨
        triggerRatio: 1.0,
        leverageDecay: 0.5,
        profitLockRatio: 0.5,
        minLeverage: 5,
        maxRollingTimes: 3
      };

      // Act
      const result = await rollingStrategy.execute(params);

      // Assert
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('rollingHistory');
      expect(result.rollingHistory.length).toBeLessThanOrEqual(3);
    });
  });

  describe('性能测试', () => {
    test('应该在合理时间内完成滚仓计算', async () => {
      // Arrange
      const params = {
        principal: 200,
        initialLeverage: 50,
        entryPrice: 50000,
        targetPrice: 52000,
        triggerRatio: 1.0,
        leverageDecay: 0.5,
        profitLockRatio: 0.5,
        minLeverage: 5
      };
      const startTime = Date.now();

      // Act
      await rollingStrategy.execute(params);
      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(1000); // 1秒内完成
    });

    test('应该能够处理大量滚仓计算', async () => {
      // Arrange
      const params = {
        principal: 200,
        initialLeverage: 50,
        entryPrice: 50000,
        targetPrice: 60000, // 大幅上涨，触发多次滚仓
        triggerRatio: 1.0,
        leverageDecay: 0.5,
        profitLockRatio: 0.5,
        minLeverage: 5,
        maxRollingTimes: 10
      };

      // Act
      const result = await rollingStrategy.execute(params);

      // Assert
      expect(result).toHaveProperty('success', true);
      expect(result.rollingHistory.length).toBeGreaterThan(0);
    });
  });

  describe('边界条件测试', () => {
    test('应该正确处理零本金情况', async () => {
      // Arrange
      const params = {
        principal: 0,
        initialLeverage: 50,
        entryPrice: 50000
      };

      // Act & Assert
      await expect(rollingStrategy.calculateInitialPosition(params))
        .rejects.toThrow('本金不能为零');
    });

    test('应该正确处理零杠杆情况', async () => {
      // Arrange
      const params = {
        principal: 200,
        initialLeverage: 0,
        entryPrice: 50000
      };

      // Act & Assert
      await expect(rollingStrategy.calculateInitialPosition(params))
        .rejects.toThrow('杠杆不能为零');
    });

    test('应该正确处理负价格情况', async () => {
      // Arrange
      const params = {
        principal: 200,
        initialLeverage: 50,
        entryPrice: -50000
      };

      // Act & Assert
      await expect(rollingStrategy.calculateInitialPosition(params))
        .rejects.toThrow('价格不能为负数');
    });

    test('应该正确处理无效参数组合', async () => {
      // Arrange
      const params = {
        principal: 200,
        initialLeverage: 50,
        entryPrice: 50000,
        leverageDecay: 1.5, // 大于1的递减系数
        minLeverage: 10
      };

      // Act & Assert
      await expect(rollingStrategy.calculateNewLeverage(params))
        .rejects.toThrow('杠杆递减系数必须在0和1之间');
    });
  });
});
