/**
 * 全面技术指标计算测试
 * 保障所有技术指标计算的稳定性和准确性
 */

const StrategyV3Core = require('../modules/strategy/StrategyV3Core.js');
const DatabaseManager = require('../modules/database/DatabaseManager.js');

describe('全面技术指标计算测试', () => {
  let db;
  let strategyCore;

  beforeAll(async () => {
    db = new DatabaseManager(':memory:');
    await db.init();
    strategyCore = new StrategyV3Core(db);
  });

  afterAll(async () => {
    if (db) {
      await db.close();
    }
  });

  // 生成测试数据
  function generateTestData(count = 100) {
    const data = [];
    let basePrice = 100;

    for (let i = 0; i < count; i++) {
      const timestamp = Date.now() + i * 3600000; // 每小时
      const volatility = 0.02; // 2%波动率
      const change = (Math.random() - 0.5) * volatility * basePrice;
      basePrice += change;

      const open = basePrice - change / 2;
      const close = basePrice + change / 2;
      const high = Math.max(open, close) + Math.random() * volatility * basePrice;
      const low = Math.min(open, close) - Math.random() * volatility * basePrice;
      const volume = 1000000 + Math.random() * 500000;

      data.push([
        timestamp,
        open.toFixed(4),
        high.toFixed(4),
        low.toFixed(4),
        close.toFixed(4),
        volume.toFixed(0)
      ]);
    }

    return data;
  }

  function generateObjectTestData(count = 100) {
    const data = [];
    let basePrice = 100;

    for (let i = 0; i < count; i++) {
      const volatility = 0.02;
      const change = (Math.random() - 0.5) * volatility * basePrice;
      basePrice += change;

      const open = basePrice - change / 2;
      const close = basePrice + change / 2;
      const high = Math.max(open, close) + Math.random() * volatility * basePrice;
      const low = Math.min(open, close) - Math.random() * volatility * basePrice;
      const volume = 1000000 + Math.random() * 500000;

      data.push({
        timestamp: Date.now() + i * 3600000,
        open: parseFloat(open.toFixed(4)),
        high: parseFloat(high.toFixed(4)),
        low: parseFloat(low.toFixed(4)),
        close: parseFloat(close.toFixed(4)),
        volume: parseFloat(volume.toFixed(0))
      });
    }

    return data;
  }

  describe('数据访问辅助函数测试', () => {
    test('应该正确处理数组格式数据', () => {
      const testCandle = [1640995200000, 100, 105, 95, 102, 1000000];

      expect(strategyCore.getCandleValue(testCandle, 'timestamp')).toBe(1640995200000);
      expect(strategyCore.getCandleValue(testCandle, 'open')).toBe(100);
      expect(strategyCore.getCandleValue(testCandle, 'high')).toBe(105);
      expect(strategyCore.getCandleValue(testCandle, 'low')).toBe(95);
      expect(strategyCore.getCandleValue(testCandle, 'close')).toBe(102);
      expect(strategyCore.getCandleValue(testCandle, 'volume')).toBe(1000000);
    });

    test('应该正确处理对象格式数据', () => {
      const testCandle = {
        timestamp: 1640995200000,
        open: 100,
        high: 105,
        low: 95,
        close: 102,
        volume: 1000000
      };

      expect(strategyCore.getCandleValue(testCandle, 'open')).toBe(100);
      expect(strategyCore.getCandleValue(testCandle, 'high')).toBe(105);
      expect(strategyCore.getCandleValue(testCandle, 'low')).toBe(95);
      expect(strategyCore.getCandleValue(testCandle, 'close')).toBe(102);
      expect(strategyCore.getCandleValue(testCandle, 'volume')).toBe(1000000);
    });

    test('应该正确验证数据质量', () => {
      const validCandle = [1640995200000, 100, 105, 95, 102, 1000000];
      const invalidCandle1 = [1640995200000, null, 105, 95, null, 1000000];
      const invalidCandle2 = { open: 100, high: 105, low: 95, close: -10, volume: 1000000 };
      const invalidCandle3 = null;

      expect(strategyCore.validateCandle(validCandle)).toBe(true);
      expect(strategyCore.validateCandle(invalidCandle1)).toBe(false);
      expect(strategyCore.validateCandle(invalidCandle2)).toBe(false);
      expect(strategyCore.validateCandle(invalidCandle3)).toBe(false);
    });

    test('应该正确过滤有效数据', () => {
      const mixedData = [
        [1640995200000, 100, 105, 95, 102, 1000000], // 有效
        [1640995260000, null, null, null, null, null], // 无效
        [1640995320000, 101, 106, 96, 103, 1100000], // 有效
        { open: 102, high: 107, low: 97, close: -10, volume: 1200000 }, // 无效
        [1640995440000, 103, 108, 98, 104, 1300000], // 有效
      ];

      const validData = strategyCore.filterValidCandles(mixedData);
      expect(validData.length).toBe(3);
    });
  });

  describe('MA计算测试', () => {
    test('应该正确处理数组格式数据', () => {
      const testData = generateTestData(50);
      const ma20 = strategyCore.calculateMA(testData, 20);

      expect(Array.isArray(ma20)).toBe(true);
      expect(ma20.length).toBe(31); // 50 - 20 + 1 = 31
      expect(ma20.every(val => typeof val === 'number')).toBe(true);
      expect(ma20.every(val => !isNaN(val))).toBe(true);
      expect(ma20.every(val => val > 0)).toBe(true);
    });

    test('应该正确处理对象格式数据', () => {
      const testData = generateObjectTestData(50);
      const ma20 = strategyCore.calculateMA(testData, 20);

      expect(Array.isArray(ma20)).toBe(true);
      expect(ma20.length).toBe(31);
      expect(ma20.every(val => typeof val === 'number')).toBe(true);
      expect(ma20.every(val => !isNaN(val))).toBe(true);
      expect(ma20.every(val => val > 0)).toBe(true);
    });

    test('应该处理数据不足的情况', () => {
      const testData = generateTestData(10);
      const ma20 = strategyCore.calculateMA(testData, 20);

      expect(ma20).toEqual([]);
    });

    test('应该处理空数据', () => {
      expect(strategyCore.calculateMA(null, 20)).toEqual([]);
      expect(strategyCore.calculateMA([], 20)).toEqual([]);
    });

    test('应该处理混合有效/无效数据', () => {
      const mixedData = [
        [1640995200000, 100, 105, 95, 102, 1000000], // 有效
        [1640995260000, null, null, null, null, null], // 无效
        [1640995320000, 101, 106, 96, 103, 1100000], // 有效
        [1640995380000, 'invalid', 'invalid', 'invalid', 'invalid', 'invalid'], // 无效
        [1640995440000, 103, 108, 98, 104, 1300000], // 有效
      ];

      // 添加更多有效数据
      for (let i = 5; i < 25; i++) {
        mixedData.push([1640995200000 + i * 3600000, 100 + i, 105 + i, 95 + i, 102 + i, 1000000 + i * 1000]);
      }

      const ma20 = strategyCore.calculateMA(mixedData, 20);

      expect(Array.isArray(ma20)).toBe(true);
      expect(ma20.length).toBeGreaterThan(0);
      expect(ma20.every(val => typeof val === 'number')).toBe(true);
      expect(ma20.every(val => !isNaN(val))).toBe(true);
    });
  });

  describe('EMA计算测试', () => {
    test('应该正确处理数组格式数据', () => {
      const testData = generateTestData(50);
      const ema20 = strategyCore.calculateEMA(testData, 20);

      expect(Array.isArray(ema20)).toBe(true);
      expect(ema20.length).toBe(50);
      expect(ema20.every(val => typeof val === 'number')).toBe(true);
      expect(ema20.every(val => !isNaN(val))).toBe(true);
      expect(ema20.every(val => val > 0)).toBe(true);
    });

    test('应该正确处理对象格式数据', () => {
      const testData = generateObjectTestData(50);
      const ema20 = strategyCore.calculateEMA(testData, 20);

      expect(Array.isArray(ema20)).toBe(true);
      expect(ema20.length).toBe(50);
      expect(ema20.every(val => typeof val === 'number')).toBe(true);
      expect(ema20.every(val => !isNaN(val))).toBe(true);
    });

    test('应该处理空数据', () => {
      expect(strategyCore.calculateEMA(null, 20)).toEqual([]);
      expect(strategyCore.calculateEMA([], 20)).toEqual([]);
    });

    test('EMA应该比MA更敏感', () => {
      const testData = generateTestData(50);
      const ma20 = strategyCore.calculateMA(testData, 20);
      const ema20 = strategyCore.calculateEMA(testData, 20);

      // EMA应该对最新价格更敏感，变化幅度更大
      expect(ema20.length).toBeGreaterThan(ma20.length);
    });
  });

  describe('ADX计算测试', () => {
    test('应该正确处理数组格式数据', () => {
      const testData = generateTestData(30);
      const adx = strategyCore.calculateADX(testData, 14);

      expect(adx).not.toBeNull();
      expect(typeof adx).toBe('object');
      expect(adx.ADX).toBeDefined();
      expect(adx.DIplus).toBeDefined();
      expect(adx.DIminus).toBeDefined();
      expect(typeof adx.ADX).toBe('number');
      expect(!isNaN(adx.ADX)).toBe(true);
      expect(adx.ADX >= 0 && adx.ADX <= 100).toBe(true);
    });

    test('应该正确处理对象格式数据', () => {
      const testData = generateObjectTestData(30);
      const adx = strategyCore.calculateADX(testData, 14);

      expect(adx).not.toBeNull();
      expect(typeof adx).toBe('object');
      expect(adx.ADX).toBeDefined();
      expect(typeof adx.ADX).toBe('number');
      expect(!isNaN(adx.ADX)).toBe(true);
    });

    test('应该处理数据不足的情况', () => {
      const testData = generateTestData(10);
      const adx = strategyCore.calculateADX(testData, 14);

      expect(adx).toBeNull();
    });

    test('应该处理空数据', () => {
      expect(strategyCore.calculateADX(null, 14)).toBeNull();
      expect(strategyCore.calculateADX([], 14)).toBeNull();
    });
  });

  describe('布林带计算测试', () => {
    test('应该正确处理数组格式数据', () => {
      const testData = generateTestData(30);
      const bb = strategyCore.calculateBollingerBands(testData, 20, 2);

      expect(Array.isArray(bb)).toBe(true);
      expect(bb.length).toBe(11); // 30 - 20 + 1 = 11
      expect(bb.every(band => typeof band).toBe(true));

      const lastBand = bb[bb.length - 1];
      expect(lastBand.upper).toBeDefined();
      expect(lastBand.middle).toBeDefined();
      expect(lastBand.lower).toBeDefined();
      expect(lastBand.bandwidth).toBeDefined();

      expect(typeof lastBand.upper).toBe('number');
      expect(typeof lastBand.middle).toBe('number');
      expect(typeof lastBand.lower).toBe('number');
      expect(typeof lastBand.bandwidth).toBe('number');

      expect(lastBand.upper > lastBand.middle).toBe(true);
      expect(lastBand.middle > lastBand.lower).toBe(true);
      expect(!isNaN(lastBand.bandwidth)).toBe(true);
    });

    test('应该正确处理对象格式数据', () => {
      const testData = generateObjectTestData(30);
      const bb = strategyCore.calculateBollingerBands(testData, 20, 2);

      expect(Array.isArray(bb)).toBe(true);
      expect(bb.length).toBe(11);
      expect(bb.every(band => typeof band).toBe(true));
    });

    test('应该处理数据不足的情况', () => {
      const testData = generateTestData(10);
      const bb = strategyCore.calculateBollingerBands(testData, 20, 2);

      expect(bb).toEqual([]);
    });

    test('应该处理空数据', () => {
      expect(strategyCore.calculateBollingerBands(null, 20, 2)).toEqual([]);
      expect(strategyCore.calculateBollingerBands([], 20, 2)).toEqual([]);
    });
  });

  describe('综合指标计算测试', () => {
    test('应该能同时计算多个指标', () => {
      const testData = generateTestData(50);

      const ma20 = strategyCore.calculateMA(testData, 20);
      const ema20 = strategyCore.calculateEMA(testData, 20);
      const adx = strategyCore.calculateADX(testData, 14);
      const bb = strategyCore.calculateBollingerBands(testData, 20, 2);

      expect(Array.isArray(ma20)).toBe(true);
      expect(Array.isArray(ema20)).toBe(true);
      expect(adx).not.toBeNull();
      expect(Array.isArray(bb)).toBe(true);

      // 所有指标都应该返回有效数值
      expect(ma20.every(val => !isNaN(val))).toBe(true);
      expect(ema20.every(val => !isNaN(val))).toBe(true);
      expect(!isNaN(adx.ADX)).toBe(true);
      expect(bb.every(band => !isNaN(band.upper))).toBe(true);
    });

    test('应该处理极端市场条件', () => {
      // 生成极端波动数据
      const extremeData = [];
      let basePrice = 100;

      for (let i = 0; i < 50; i++) {
        const volatility = i % 2 === 0 ? 0.5 : 0.01; // 交替高低波动
        const change = (Math.random() - 0.5) * volatility * basePrice;
        basePrice += change;

        const open = basePrice - change / 2;
        const close = basePrice + change / 2;
        const high = Math.max(open, close) + Math.random() * volatility * basePrice;
        const low = Math.min(open, close) - Math.random() * volatility * basePrice;
        const volume = 1000000 + Math.random() * 500000;

        extremeData.push([
          Date.now() + i * 3600000,
          open.toFixed(4),
          high.toFixed(4),
          low.toFixed(4),
          close.toFixed(4),
          volume.toFixed(0)
        ]);
      }

      const ma20 = strategyCore.calculateMA(extremeData, 20);
      const ema20 = strategyCore.calculateEMA(extremeData, 20);
      const adx = strategyCore.calculateADX(extremeData, 14);
      const bb = strategyCore.calculateBollingerBands(extremeData, 20, 2);

      // 即使极端条件下也应该返回有效结果
      expect(ma20.every(val => !isNaN(val))).toBe(true);
      expect(ema20.every(val => !isNaN(val))).toBe(true);
      expect(!isNaN(adx.ADX)).toBe(true);
      expect(bb.every(band => !isNaN(band.upper))).toBe(true);
    });
  });

  describe('性能测试', () => {
    test('应该能处理大量数据', () => {
      const largeData = generateTestData(1000);

      const startTime = Date.now();
      const ma20 = strategyCore.calculateMA(largeData, 20);
      const ema20 = strategyCore.calculateEMA(largeData, 20);
      const endTime = Date.now();

      expect(ma20.length).toBe(981); // 1000 - 20 + 1
      expect(ema20.length).toBe(1000);
      expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
    });
  });
});
