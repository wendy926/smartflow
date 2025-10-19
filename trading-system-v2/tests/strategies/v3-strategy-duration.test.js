/**
 * V3 策略持仓时长测试
 */

const V3Strategy = require('../../src/strategies/v3-strategy');
const PositionDurationManager = require('../../src/utils/position-duration-manager');

describe('V3 Strategy Duration Tests', () => {
  let v3Strategy;

  beforeEach(() => {
    v3Strategy = new V3Strategy();
  });

  describe('持仓时长配置', () => {
    it('应该为主流币返回正确的趋势市配置', async () => {
      const result = await v3Strategy.calculateTradeParameters(
        'BTCUSDT',
        'BUY',
        100000,
        1000,
        'TREND',
        'med'
      );

      expect(result.maxDurationHours).toBe(168); // 7天
      expect(result.timeStopMinutes).toBe(60);
      expect(result.marketType).toBe('TREND');
    });

    it('应该为主流币返回正确的震荡市配置', async () => {
      const result = await v3Strategy.calculateTradeParameters(
        'BTCUSDT',
        'BUY',
        100000,
        1000,
        'RANGE',
        'med'
      );

      expect(result.maxDurationHours).toBe(12); // 12小时
      expect(result.timeStopMinutes).toBe(30);
      expect(result.marketType).toBe('RANGE');
    });

    it('应该为高市值强趋势币返回正确的趋势市配置', async () => {
      const result = await v3Strategy.calculateTradeParameters(
        'SOLUSDT',
        'BUY',
        100,
        10,
        'TREND',
        'med'
      );

      expect(result.maxDurationHours).toBe(72); // 3天
      expect(result.timeStopMinutes).toBe(120);
      expect(result.marketType).toBe('TREND');
    });

    it('应该为高市值强趋势币返回正确的震荡市配置', async () => {
      const result = await v3Strategy.calculateTradeParameters(
        'SOLUSDT',
        'BUY',
        100,
        10,
        'RANGE',
        'med'
      );

      expect(result.maxDurationHours).toBe(4); // 4小时
      expect(result.timeStopMinutes).toBe(45);
      expect(result.marketType).toBe('RANGE');
    });

    it('应该为热点币返回正确的趋势市配置', async () => {
      const result = await v3Strategy.calculateTradeParameters(
        'PEPEUSDT',
        'BUY',
        0.001,
        0.0001,
        'TREND',
        'med'
      );

      expect(result.maxDurationHours).toBe(24); // 24小时
      expect(result.timeStopMinutes).toBe(180);
      expect(result.marketType).toBe('TREND');
    });

    it('应该为热点币返回正确的震荡市配置', async () => {
      const result = await v3Strategy.calculateTradeParameters(
        'PEPEUSDT',
        'BUY',
        0.001,
        0.0001,
        'RANGE',
        'med'
      );

      expect(result.maxDurationHours).toBe(3); // 3小时
      expect(result.timeStopMinutes).toBe(60);
      expect(result.marketType).toBe('RANGE');
    });
  });

  describe('杠杆计算', () => {
    it('应该确保杠杆不超过24倍', async () => {
      const result = await v3Strategy.calculateTradeParameters(
        'BTCUSDT',
        'BUY',
        100000,
        1000,
        'TREND',
        'med'
      );

      expect(result.leverage).toBeLessThanOrEqual(24);
    });

    it('应该为不同止损距离计算正确的杠杆', async () => {
      // 测试不同的止损距离
      const testCases = [
        { atr: 100, expectedMaxLeverage: 24 }, // 止损距离 1%
        { atr: 200, expectedMaxLeverage: 24 }, // 止损距离 2%
        { atr: 500, expectedMaxLeverage: 18 }, // 止损距离 5%
        { atr: 1000, expectedMaxLeverage: 9 }  // 止损距离 10%
      ];

      for (const testCase of testCases) {
        const result = await v3Strategy.calculateTradeParameters(
          'BTCUSDT',
          'BUY',
          10000,
          testCase.atr,
          'TREND',
          'med'
        );

        expect(result.leverage).toBeLessThanOrEqual(24);
      }
    });
  });

  describe('市场类型识别', () => {
    it('应该正确识别趋势市', async () => {
      const result = await v3Strategy.calculateTradeParameters(
        'BTCUSDT',
        'BUY',
        100000,
        1000,
        'TREND',
        'med'
      );

      expect(result.marketType).toBe('TREND');
    });

    it('应该正确识别震荡市', async () => {
      const result = await v3Strategy.calculateTradeParameters(
        'BTCUSDT',
        'BUY',
        100000,
        1000,
        'RANGE',
        'med'
      );

      expect(result.marketType).toBe('RANGE');
    });

    it('应该默认为震荡市', async () => {
      const result = await v3Strategy.calculateTradeParameters(
        'BTCUSDT',
        'BUY',
        100000,
        1000
        // 不指定 marketType
      );

      expect(result.marketType).toBe('RANGE');
    });
  });

  describe('持仓时长验证', () => {
    it('应该为主流币趋势市设置正确的最大持仓时长', async () => {
      const config = PositionDurationManager.getPositionConfig('BTCUSDT', 'TREND');
      expect(config.maxDurationHours).toBe(168); // 7天
    });

    it('应该为主流币震荡市设置正确的最大持仓时长', async () => {
      const config = PositionDurationManager.getPositionConfig('BTCUSDT', 'RANGE');
      expect(config.maxDurationHours).toBe(12); // 12小时
    });

    it('应该为高市值强趋势币趋势市设置正确的最大持仓时长', async () => {
      const config = PositionDurationManager.getPositionConfig('SOLUSDT', 'TREND');
      expect(config.maxDurationHours).toBe(72); // 3天
    });

    it('应该为高市值强趋势币震荡市设置正确的最大持仓时长', async () => {
      const config = PositionDurationManager.getPositionConfig('SOLUSDT', 'RANGE');
      expect(config.maxDurationHours).toBe(4); // 4小时
    });

    it('应该为热点币趋势市设置正确的最大持仓时长', async () => {
      const config = PositionDurationManager.getPositionConfig('PEPEUSDT', 'TREND');
      expect(config.maxDurationHours).toBe(24); // 24小时
    });

    it('应该为热点币震荡市设置正确的最大持仓时长', async () => {
      const config = PositionDurationManager.getPositionConfig('PEPEUSDT', 'RANGE');
      expect(config.maxDurationHours).toBe(3); // 3小时
    });
  });

  describe('时间止损验证', () => {
    it('应该为主流币趋势市设置正确的时间止损', async () => {
      const config = PositionDurationManager.getPositionConfig('BTCUSDT', 'TREND');
      expect(config.timeStopMinutes).toBe(60);
    });

    it('应该为主流币震荡市设置正确的时间止损', async () => {
      const config = PositionDurationManager.getPositionConfig('BTCUSDT', 'RANGE');
      expect(config.timeStopMinutes).toBe(30);
    });

    it('应该为高市值强趋势币趋势市设置正确的时间止损', async () => {
      const config = PositionDurationManager.getPositionConfig('SOLUSDT', 'TREND');
      expect(config.timeStopMinutes).toBe(120);
    });

    it('应该为高市值强趋势币震荡市设置正确的时间止损', async () => {
      const config = PositionDurationManager.getPositionConfig('SOLUSDT', 'RANGE');
      expect(config.timeStopMinutes).toBe(45);
    });

    it('应该为热点币趋势市设置正确的时间止损', async () => {
      const config = PositionDurationManager.getPositionConfig('PEPEUSDT', 'TREND');
      expect(config.timeStopMinutes).toBe(180);
    });

    it('应该为热点币震荡市设置正确的时间止损', async () => {
      const config = PositionDurationManager.getPositionConfig('PEPEUSDT', 'RANGE');
      expect(config.timeStopMinutes).toBe(60);
    });
  });
});

