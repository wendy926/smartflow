/**
 * 资金费率计算器单元测试
 */

const FundingRateCalculator = require('../../src/utils/funding-rate-calculator');

describe('FundingRateCalculator', () => {
  let calculator;

  beforeEach(() => {
    calculator = new FundingRateCalculator();
  });

  describe('calculatePnLWithCosts', () => {
    it('应该正确计算多头盈利（扣除成本）', () => {
      const params = {
        entryPrice: 1000,
        exitPrice: 1030,
        positionSize: 1000, // USDT
        feeRate: 0.0004,
        fundingRate: 0.0001,
        interestRate: 0.01,
        holdHours: 24,
        isLong: true
      };

      const result = calculator.calculatePnLWithCosts(params);

      // 原始盈亏：30 USDT
      expect(result.rawPnL).toBeCloseTo(30, 2);

      // 手续费成本：1000 * 0.0004 * 2 = 0.8 USDT
      expect(result.feeCost).toBeCloseTo(0.8, 2);

      // 资金费率成本：1000 * 0.0001 * 3 = 0.3 USDT（24小时 = 3个8小时周期）
      expect(result.fundingCost).toBeCloseTo(0.3, 2);

      // 利息成本：1000 * 0.01 / 365 / 24 * 24 ≈ 0.0274 USDT
      expect(result.interestCost).toBeCloseTo(0.0274, 4);

      // 实际盈亏：30 - 0.8 - 0.3 - 0.0274 ≈ 28.87 USDT
      expect(result.netPnL).toBeCloseTo(28.87, 2);

      // 成本占比：(0.8 + 0.3 + 0.0274) / 1000 ≈ 0.1127%
      expect(result.costPercentage).toBeCloseTo(0.1127, 4);
    });

    it('应该正确计算空头盈利（扣除成本）', () => {
      const params = {
        entryPrice: 1030,
        exitPrice: 1000,
        positionSize: 1000,
        feeRate: 0.0004,
        fundingRate: 0.0001,
        interestRate: 0.01,
        holdHours: 24,
        isLong: false
      };

      const result = calculator.calculatePnLWithCosts(params);

      // 原始盈亏：(1030 - 1000) * (1000 / 1030) ≈ 29.126 USDT
      expect(result.rawPnL).toBeCloseTo(29.126, 2);

      // 实际盈亏：29.126 - 0.8 - 0.3 - 0.0274 ≈ 28.00 USDT
      expect(result.netPnL).toBeCloseTo(28.00, 2);
    });

    it('应该正确计算亏损（增加成本）', () => {
      const params = {
        entryPrice: 1000,
        exitPrice: 970,
        positionSize: 1000,
        feeRate: 0.0004,
        fundingRate: 0.0001,
        interestRate: 0.01,
        holdHours: 24,
        isLong: true
      };

      const result = calculator.calculatePnLWithCosts(params);

      // 原始盈亏：-30 USDT
      expect(result.rawPnL).toBeCloseTo(-30, 2);

      // 实际盈亏：-30 - 0.8 - 0.3 - 0.0274 ≈ -31.13 USDT
      expect(result.netPnL).toBeCloseTo(-31.13, 2);
    });

    it('应该正确处理长时间持仓', () => {
      const params = {
        entryPrice: 1000,
        exitPrice: 1030,
        positionSize: 1000,
        feeRate: 0.0004,
        fundingRate: 0.0001,
        interestRate: 0.01,
        holdHours: 168, // 7天
        isLong: true
      };

      const result = calculator.calculatePnLWithCosts(params);

      // 资金费率成本：1000 * 0.0001 * 21 = 2.1 USDT（168小时 = 21个8小时周期）
      expect(result.fundingCost).toBeCloseTo(2.1, 2);

      // 利息成本：1000 * 0.01 / 365 / 24 * 168 ≈ 0.1918 USDT
      expect(result.interestCost).toBeCloseTo(0.1918, 4);

      // 实际盈亏：30 - 0.8 - 2.1 - 0.1918 ≈ 26.91 USDT
      expect(result.netPnL).toBeCloseTo(26.91, 2);
    });

    it('应该抛出错误当缺少必要参数', () => {
      expect(() => {
        calculator.calculatePnLWithCosts({
          entryPrice: 1000,
          exitPrice: 1030,
          // 缺少 positionSize 和 holdHours
          isLong: true
        });
      }).toThrow('缺少必要参数');
    });

    it('应该使用默认参数', () => {
      const params = {
        entryPrice: 1000,
        exitPrice: 1030,
        positionSize: 1000,
        holdHours: 24,
        isLong: true
      };

      const result = calculator.calculatePnLWithCosts(params);

      // 应该使用默认参数计算
      expect(result.feeCost).toBeCloseTo(0.8, 2);
      expect(result.fundingCost).toBeCloseTo(0.3, 2);
    });
  });

  describe('calculateUnrealizedPnL', () => {
    it('应该正确计算未实现盈亏', () => {
      const params = {
        entryPrice: 1000,
        currentPrice: 1020,
        positionSize: 1000,
        holdHours: 12,
        isLong: true
      };

      const result = calculator.calculateUnrealizedPnL(params);

      // 原始盈亏：20 USDT
      expect(result.rawPnL).toBeCloseTo(20, 2);

      // 资金费率成本：1000 * 0.0001 * 1 = 0.1 USDT（12小时 = 1个8小时周期）
      expect(result.fundingCost).toBeCloseTo(0.1, 2);

      // 实际盈亏：20 - 0.8 - 0.1 - 0.0137 ≈ 19.09 USDT
      expect(result.netPnL).toBeCloseTo(19.09, 2);
    });
  });

  describe('calculateCostsOnly', () => {
    it('应该正确计算持仓成本', () => {
      const params = {
        positionSize: 1000,
        holdHours: 24
      };

      const result = calculator.calculateCostsOnly(params);

      // 手续费成本：0.8 USDT
      expect(result.feeCost).toBeCloseTo(0.8, 2);

      // 资金费率成本：0.3 USDT
      expect(result.fundingCost).toBeCloseTo(0.3, 2);

      // 利息成本：≈ 0.0274 USDT
      expect(result.interestCost).toBeCloseTo(0.0274, 4);

      // 总成本：≈ 1.1274 USDT
      expect(result.totalCost).toBeCloseTo(1.1274, 4);

      // 成本占比：≈ 0.1127%
      expect(result.costPercentage).toBeCloseTo(0.1127, 4);
    });
  });

  describe('formatFundingRate', () => {
    it('应该正确格式化资金费率', () => {
      expect(calculator.formatFundingRate(0.0001)).toBe('0.0100%');
      expect(calculator.formatFundingRate(0.0005)).toBe('0.0500%');
      expect(calculator.formatFundingRate(null)).toBe('--');
    });
  });

  describe('formatInterestRate', () => {
    it('应该正确格式化利率', () => {
      expect(calculator.formatInterestRate(0.01)).toBe('1.00%');
      expect(calculator.formatInterestRate(0.05)).toBe('5.00%');
      expect(calculator.formatInterestRate(null)).toBe('--');
    });
  });

  describe('isFundingRateHigh', () => {
    it('应该正确判断资金费率是否偏高', () => {
      expect(calculator.isFundingRateHigh(0.0002)).toBe(true);
      expect(calculator.isFundingRateHigh(0.00005)).toBe(false);
      expect(calculator.isFundingRateHigh(-0.0002)).toBe(true);
    });
  });

  describe('getFundingRateAdvice', () => {
    it('应该返回正确的建议', () => {
      expect(calculator.getFundingRateAdvice(0.0006)).toContain('偏高');
      expect(calculator.getFundingRateAdvice(0.0002)).toContain('较高');
      expect(calculator.getFundingRateAdvice(0.00005)).toContain('正常');
    });
  });

  describe('自定义配置', () => {
    it('应该使用自定义配置', () => {
      const customCalculator = new FundingRateCalculator({
        defaultFundingRate: 0.0002,
        defaultInterestRate: 0.02,
        defaultFeeRate: 0.0005
      });

      const params = {
        entryPrice: 1000,
        exitPrice: 1030,
        positionSize: 1000,
        holdHours: 24,
        isLong: true
      };

      const result = customCalculator.calculatePnLWithCosts(params);

      // 手续费成本：1000 * 0.0005 * 2 = 1.0 USDT
      expect(result.feeCost).toBeCloseTo(1.0, 2);

      // 资金费率成本：1000 * 0.0002 * 3 = 0.6 USDT
      expect(result.fundingCost).toBeCloseTo(0.6, 2);
    });
  });
});

