/**
 * ICT 策略杠杆限制单元测试
 */

const ICTStrategy = require('../../src/strategies/ict-strategy');

describe('ICT Strategy Leverage Tests', () => {
  let ictStrategy;

  beforeEach(() => {
    ictStrategy = new ICTStrategy();
  });

  describe('杠杆计算', () => {
    it('应该正确计算杠杆，不超过24倍', () => {
      const equity = 10000;
      const riskPct = 0.01;
      const entryPrice = 1000;
      const stopLoss = 990; // 止损距离 1%

      const result = ictStrategy.calculatePositionSize(equity, riskPct, entryPrice, stopLoss);

      // 验证杠杆不超过24倍
      expect(result.leverage).toBeLessThanOrEqual(24);
      
      // 止损距离 = 10, 止损距离% = 1%
      // 计算杠杆 = floor(1 / (0.01 + 0.005)) = floor(1 / 0.015) = floor(66.67) = 66
      // 实际杠杆 = min(66, 24) = 24
      expect(result.leverage).toBe(24);
    });

    it('应该正确计算杠杆，止损距离2%时杠杆应为24倍', () => {
      const equity = 10000;
      const riskPct = 0.01;
      const entryPrice = 1000;
      const stopLoss = 980; // 止损距离 2%

      const result = ictStrategy.calculatePositionSize(equity, riskPct, entryPrice, stopLoss);

      // 止损距离 = 20, 止损距离% = 2%
      // 计算杠杆 = floor(1 / (0.02 + 0.005)) = floor(1 / 0.025) = floor(40) = 40
      // 实际杠杆 = min(40, 24) = 24
      expect(result.leverage).toBe(24);
    });

    it('应该正确计算杠杆，止损距离5%时杠杆应为20倍', () => {
      const equity = 10000;
      const riskPct = 0.01;
      const entryPrice = 1000;
      const stopLoss = 950; // 止损距离 5%

      const result = ictStrategy.calculatePositionSize(equity, riskPct, entryPrice, stopLoss);

      // 止损距离 = 50, 止损距离% = 5%
      // 计算杠杆 = floor(1 / (0.05 + 0.005)) = floor(1 / 0.055) = floor(18.18) = 18
      // 实际杠杆 = min(18, 24) = 18
      expect(result.leverage).toBe(18);
    });

    it('应该正确计算杠杆，止损距离很小（0.5%）时杠杆应为24倍', () => {
      const equity = 10000;
      const riskPct = 0.01;
      const entryPrice = 1000;
      const stopLoss = 995; // 止损距离 0.5%

      const result = ictStrategy.calculatePositionSize(equity, riskPct, entryPrice, stopLoss);

      // 止损距离 = 5, 止损距离% = 0.5%
      // 计算杠杆 = floor(1 / (0.005 + 0.005)) = floor(1 / 0.01) = floor(100) = 100
      // 实际杠杆 = min(100, 24) = 24
      expect(result.leverage).toBe(24);
    });

    it('应该正确计算杠杆，止损距离很大（10%）时杠杆应为10倍', () => {
      const equity = 10000;
      const riskPct = 0.01;
      const entryPrice = 1000;
      const stopLoss = 900; // 止损距离 10%

      const result = ictStrategy.calculatePositionSize(equity, riskPct, entryPrice, stopLoss);

      // 止损距离 = 100, 止损距离% = 10%
      // 计算杠杆 = floor(1 / (0.10 + 0.005)) = floor(1 / 0.105) = floor(9.52) = 9
      // 实际杠杆 = min(9, 24) = 9
      expect(result.leverage).toBe(9);
    });

    it('应该正确处理空头杠杆计算', () => {
      const equity = 10000;
      const riskPct = 0.01;
      const entryPrice = 1000;
      const stopLoss = 1010; // 空头止损距离 1%

      const result = ictStrategy.calculatePositionSize(equity, riskPct, entryPrice, stopLoss);

      // 止损距离 = 10, 止损距离% = 1%
      // 计算杠杆 = floor(1 / (0.01 + 0.005)) = floor(1 / 0.015) = floor(66.67) = 66
      // 实际杠杆 = min(66, 24) = 24
      expect(result.leverage).toBe(24);
    });

    it('应该确保杠杆永远不会超过24倍', () => {
      const equity = 10000;
      const riskPct = 0.01;
      const entryPrice = 1000;
      
      // 测试不同的止损距离
      const testCases = [
        { stopLoss: 999, expectedLeverage: 24 }, // 0.1%
        { stopLoss: 995, expectedLeverage: 24 }, // 0.5%
        { stopLoss: 990, expectedLeverage: 24 }, // 1%
        { stopLoss: 980, expectedLeverage: 24 }, // 2%
        { stopLoss: 950, expectedLeverage: 18 }, // 5%
        { stopLoss: 900, expectedLeverage: 9 }   // 10%
      ];

      testCases.forEach(({ stopLoss, expectedLeverage }) => {
        const result = ictStrategy.calculatePositionSize(equity, riskPct, entryPrice, stopLoss);
        expect(result.leverage).toBe(expectedLeverage);
        expect(result.leverage).toBeLessThanOrEqual(24);
      });
    });
  });

  describe('仓位计算', () => {
    it('应该正确计算仓位大小', () => {
      const equity = 10000;
      const riskPct = 0.01;
      const entryPrice = 1000;
      const stopLoss = 990; // 止损距离 1%

      const result = ictStrategy.calculatePositionSize(equity, riskPct, entryPrice, stopLoss);

      // 风险资金 = 10000 * 0.01 = 100
      // 止损距离 = 10
      // 单位数 = 100 / 10 = 10
      expect(result.units).toBeCloseTo(10, 2);
      expect(result.riskAmount).toBeCloseTo(100, 2);
      expect(result.stopDistance).toBeCloseTo(10, 2);
    });

    it('应该正确计算保证金', () => {
      const equity = 10000;
      const riskPct = 0.01;
      const entryPrice = 1000;
      const stopLoss = 990; // 止损距离 1%

      const result = ictStrategy.calculatePositionSize(equity, riskPct, entryPrice, stopLoss);

      // 名义价值 = 10 * 1000 = 10000
      // 杠杆 = 24
      // 保证金 = 10000 / 24 = 416.67
      expect(result.margin).toBeCloseTo(416.67, 2);
    });
  });
});

