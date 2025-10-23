/**
 * 持仓时长管理器单元测试
 */

const PositionDurationManager = require('../../src/utils/position-duration-manager');

describe('PositionDurationManager', () => {
  describe('getPositionConfig', () => {
    it('应该为主流币返回正确的趋势市配置', () => {
      const config = PositionDurationManager.getPositionConfig('BTCUSDT', 'TREND');

      expect(config.maxDurationHours).toBe(168); // 7天
      expect(config.timeStopMinutes).toBe(60);
      expect(config.profitTarget).toBe(4.5);
      expect(config.stopLoss).toBe(1.5);
    });

    it('应该为主流币返回正确的震荡市配置', () => {
      const config = PositionDurationManager.getPositionConfig('BTCUSDT', 'RANGE');

      expect(config.maxDurationHours).toBe(12); // 12小时
      expect(config.timeStopMinutes).toBe(30);
      expect(config.profitTarget).toBe(4.5);
      expect(config.stopLoss).toBe(1.5);
    });

    it('应该为高市值强趋势币返回正确的趋势市配置', () => {
      const config = PositionDurationManager.getPositionConfig('SOLUSDT', 'TREND');

      expect(config.maxDurationHours).toBe(72); // 3天
      expect(config.timeStopMinutes).toBe(120);
      expect(config.profitTarget).toBe(6.0);
      expect(config.stopLoss).toBe(2.0);
    });

    it('应该为高市值强趋势币返回正确的震荡市配置', () => {
      const config = PositionDurationManager.getPositionConfig('SOLUSDT', 'RANGE');

      expect(config.maxDurationHours).toBe(4); // 4小时
      expect(config.timeStopMinutes).toBe(45);
      expect(config.profitTarget).toBe(6.0);
      expect(config.stopLoss).toBe(2.0);
    });

    it('应该为热点币返回正确的趋势市配置', () => {
      const config = PositionDurationManager.getPositionConfig('PEPEUSDT', 'TREND');

      expect(config.maxDurationHours).toBe(24); // 24小时
      expect(config.timeStopMinutes).toBe(180);
      expect(config.profitTarget).toBe(7.5);
      expect(config.stopLoss).toBe(2.5);
    });

    it('应该为热点币返回正确的震荡市配置', () => {
      const config = PositionDurationManager.getPositionConfig('PEPEUSDT', 'RANGE');

      expect(config.maxDurationHours).toBe(3); // 3小时
      expect(config.timeStopMinutes).toBe(60);
      expect(config.profitTarget).toBe(7.5);
      expect(config.stopLoss).toBe(2.5);
    });

    it('应该为小币返回正确的配置', () => {
      const config = PositionDurationManager.getPositionConfig('ONDOUSDT', 'RANGE');

      expect(config.maxDurationHours).toBe(2); // 2小时
      expect(config.timeStopMinutes).toBe(30);
      expect(config.profitTarget).toBe(4.5);
      expect(config.stopLoss).toBe(1.5);
    });
  });

  describe('calculateDurationBasedStopLoss', () => {
    it('应该为主流币趋势市计算正确的止损止盈', () => {
      const result = PositionDurationManager.calculateDurationBasedStopLoss(
        'BTCUSDT',
        'BUY',
        1000,
        10, // ATR = 10
        'TREND',
        'med'
      );

      // 主流币趋势市：stopLoss = 1.5 * ATR * 1.2 (med) = 18
      expect(result.stopLoss).toBeCloseTo(982, 2); // 1000 - 18
      expect(result.takeProfit).toBeCloseTo(1054, 2); // 1000 + 54
      expect(result.maxDurationHours).toBe(168);
      expect(result.timeStopMinutes).toBe(60);
    });

    it('应该为主流币震荡市计算正确的止损止盈', () => {
      const result = PositionDurationManager.calculateDurationBasedStopLoss(
        'BTCUSDT',
        'BUY',
        1000,
        10,
        'RANGE',
        'med'
      );

      // 主流币震荡市：stopLoss = 1.5 * ATR * 1.2 (med) = 18
      expect(result.stopLoss).toBeCloseTo(982, 2);
      expect(result.takeProfit).toBeCloseTo(1054, 2);
      expect(result.maxDurationHours).toBe(12); // 12小时
      expect(result.timeStopMinutes).toBe(30);
    });

    it('应该为高市值强趋势币趋势市计算正确的止损止盈', () => {
      const result = PositionDurationManager.calculateDurationBasedStopLoss(
        'SOLUSDT',
        'BUY',
        1000,
        10,
        'TREND',
        'med'
      );

      // 高市值强趋势币趋势市：stopLoss = 2.0 * ATR * 1.2 (med) = 24
      expect(result.stopLoss).toBeCloseTo(976, 2); // 1000 - 24
      expect(result.takeProfit).toBeCloseTo(1072, 2); // 1000 + 72
      expect(result.maxDurationHours).toBe(72); // 3天
      expect(result.timeStopMinutes).toBe(120);
    });

    it('应该为高市值强趋势币震荡市计算正确的止损止盈', () => {
      const result = PositionDurationManager.calculateDurationBasedStopLoss(
        'SOLUSDT',
        'BUY',
        1000,
        10,
        'RANGE',
        'med'
      );

      expect(result.maxDurationHours).toBe(4); // 4小时
      expect(result.timeStopMinutes).toBe(45);
    });

    it('应该为热点币趋势市计算正确的止损止盈', () => {
      const result = PositionDurationManager.calculateDurationBasedStopLoss(
        'PEPEUSDT',
        'BUY',
        1000,
        10,
        'TREND',
        'med'
      );

      // 热点币趋势市：stopLoss = 2.5 * ATR * 1.2 (med) = 30
      expect(result.stopLoss).toBeCloseTo(970, 2); // 1000 - 30
      expect(result.takeProfit).toBeCloseTo(1090, 2); // 1000 + 90
      expect(result.maxDurationHours).toBe(24); // 24小时
      expect(result.timeStopMinutes).toBe(180);
    });

    it('应该为热点币震荡市计算正确的止损止盈', () => {
      const result = PositionDurationManager.calculateDurationBasedStopLoss(
        'PEPEUSDT',
        'BUY',
        1000,
        10,
        'RANGE',
        'med'
      );

      expect(result.maxDurationHours).toBe(3); // 3小时
      expect(result.timeStopMinutes).toBe(60);
    });

    it('应该正确处理空头交易', () => {
      const result = PositionDurationManager.calculateDurationBasedStopLoss(
        'BTCUSDT',
        'SELL',
        1000,
        10,
        'TREND',
        'med'
      );

      // 空头：stopLoss = 1000 + 18 = 1018
      expect(result.stopLoss).toBeCloseTo(1018, 2);
      expect(result.takeProfit).toBeCloseTo(946, 2); // 1000 - 54
    });

    it('应该根据置信度调整止损止盈', () => {
      const highConfig = PositionDurationManager.calculateDurationBasedStopLoss(
        'BTCUSDT',
        'BUY',
        1000,
        10,
        'TREND',
        'high'
      );

      const medConfig = PositionDurationManager.calculateDurationBasedStopLoss(
        'BTCUSDT',
        'BUY',
        1000,
        10,
        'TREND',
        'med'
      );

      const lowConfig = PositionDurationManager.calculateDurationBasedStopLoss(
        'BTCUSDT',
        'BUY',
        1000,
        10,
        'TREND',
        'low'
      );

      // high: 1.0x, med: 1.2x, low: 1.5x
      // high stopLoss = 1000 - (1.5 * 10 * 1.0) = 985
      // med stopLoss = 1000 - (1.5 * 10 * 1.2) = 982
      // low stopLoss = 1000 - (1.5 * 10 * 1.5) = 977.5

      expect(highConfig.stopLoss).toBeCloseTo(985, 2);
      expect(medConfig.stopLoss).toBeCloseTo(982, 2);
      expect(lowConfig.stopLoss).toBeCloseTo(977.5, 2);
    });
  });

  describe('checkTimeStopLoss', () => {
    it('应该正确检查时间止损', () => {
      const entryTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2小时前
      const entryPrice = 1000;

      const result = PositionDurationManager.checkTimeStopLoss(
        {
          symbol: 'BTCUSDT',
          entryTime: entryTime,
          entryPrice: entryPrice,
          side: 'LONG',
          marketType: 'RANGE'
        },
        1000 // 当前价格
      );

      // 主流币震荡市：最大持仓12小时，时间止损30分钟
      // 持仓2小时，未盈利，应该触发时间止损
      expect(result.triggered).toBe(true);
      expect(result.reason).toContain('时间止损');
    });

    it('应该正确检查最大持仓时长', () => {
      const entryTime = new Date(Date.now() - 13 * 60 * 60 * 1000); // 13小时前
      const entryPrice = 1000;

      const result = PositionDurationManager.checkTimeStopLoss(
        {
          symbol: 'BTCUSDT',
          entryTime: entryTime,
          entryPrice: entryPrice,
          side: 'LONG',
          marketType: 'RANGE'
        },
        1000 // 当前价格
      );

      // 主流币震荡市：最大持仓12小时
      // 持仓13小时，超过最大持仓时长，应该触发时间止损
      expect(result.triggered).toBe(true);
      expect(result.reason).toContain('时间止损');
    });

    it('应该正确处理盈利情况', () => {
      const entryTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2小时前
      const entryPrice = 1000;

      const result = PositionDurationManager.checkTimeStopLoss(
        {
          symbol: 'BTCUSDT',
          entryTime: entryTime,
          entryPrice: entryPrice,
          side: 'LONG',
          marketType: 'RANGE'
        },
        1010 // 当前价格（盈利）
      );

      // 持仓2小时，盈利1%，不应该触发时间止损
      expect(result.triggered).toBe(false);
    });
  });
});

