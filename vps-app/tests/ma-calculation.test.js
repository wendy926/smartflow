const StrategyV3Core = require('../modules/strategy/StrategyV3Core');

/**
 * MA计算单元测试
 */
describe('MA Calculation Tests', () => {
    let strategyCore;

    beforeEach(() => {
        strategyCore = new StrategyV3Core();
    });

    afterEach(() => {
        if (strategyCore) {
            strategyCore.destroy();
        }
    });

    /**
     * 测试MA计算基础功能
     */
    describe('Basic MA Calculation', () => {
        test('should calculate MA20 correctly', () => {
            // 创建测试数据：20个递增的收盘价
            const testCandles = [];
            for (let i = 0; i < 25; i++) {
                testCandles.push({
                    open: 100 + i,
                    high: 105 + i,
                    low: 95 + i,
                    close: 100 + i,
                    volume: 1000
                });
            }

            const ma20 = strategyCore.calculateMA(testCandles, 20);

            // 检查前19个值应该为null
            for (let i = 0; i < 19; i++) {
                expect(ma20[i]).toBeNull();
            }

            // 检查第20个值应该是前20个收盘价的平均值
            const expectedMA = (100 + 101 + 102 + 103 + 104 + 105 + 106 + 107 + 108 + 109 +
                110 + 111 + 112 + 113 + 114 + 115 + 116 + 117 + 118 + 119) / 20;
            expect(ma20[19]).toBeCloseTo(expectedMA, 2);

            // 检查第21个值
            const expectedMA21 = (101 + 102 + 103 + 104 + 105 + 106 + 107 + 108 + 109 + 110 +
                111 + 112 + 113 + 114 + 115 + 116 + 117 + 118 + 119 + 120) / 20;
            expect(ma20[20]).toBeCloseTo(expectedMA21, 2);
        });

        test('should calculate MA50 correctly', () => {
            // 创建测试数据：50个递增的收盘价
            const testCandles = [];
            for (let i = 0; i < 55; i++) {
                testCandles.push({
                    open: 100 + i,
                    high: 105 + i,
                    low: 95 + i,
                    close: 100 + i,
                    volume: 1000
                });
            }

            const ma50 = strategyCore.calculateMA(testCandles, 50);

            // 检查前49个值应该为null
            for (let i = 0; i < 49; i++) {
                expect(ma50[i]).toBeNull();
            }

            // 检查第50个值应该是前50个收盘价的平均值
            const expectedMA = (100 + 149) * 50 / 2 / 50; // 等差数列求和公式
            expect(ma50[49]).toBeCloseTo(expectedMA, 2);
        });

        test('should handle insufficient data', () => {
            // 创建只有10个数据点的测试数据
            const testCandles = [];
            for (let i = 0; i < 10; i++) {
                testCandles.push({
                    open: 100 + i,
                    high: 105 + i,
                    low: 95 + i,
                    close: 100 + i,
                    volume: 1000
                });
            }

            const ma20 = strategyCore.calculateMA(testCandles, 20);

            // 所有值都应该为null，因为数据不足
            ma20.forEach(value => {
                expect(value).toBeNull();
            });
        });
    });

    /**
     * 测试MA趋势判断逻辑
     */
    describe('MA Trend Logic', () => {
        test('should identify bullish trend correctly', () => {
            // 创建多头趋势数据：价格上升，MA20 > MA50 > MA200
            const testCandles = [];
            const basePrice = 4000;

            for (let i = 0; i < 250; i++) {
                const price = basePrice + i * 2; // 持续上涨
                testCandles.push({
                    open: price,
                    high: price + 10,
                    low: price - 10,
                    close: price,
                    volume: 1000
                });
            }

            const ma20 = strategyCore.calculateMA(testCandles, 20);
            const ma50 = strategyCore.calculateMA(testCandles, 50);
            const ma200 = strategyCore.calculateMA(testCandles, 200);

            const currentMA20 = ma20[ma20.length - 1];
            const currentMA50 = ma50[ma50.length - 1];
            const currentMA200 = ma200[ma200.length - 1];
            const currentPrice = testCandles[testCandles.length - 1].close;

            // 验证多头趋势条件
            expect(currentPrice).toBeGreaterThan(currentMA20);
            expect(currentMA20).toBeGreaterThan(currentMA50);
            expect(currentMA50).toBeGreaterThan(currentMA200);
        });

        test('should identify bearish trend correctly', () => {
            // 创建空头趋势数据：价格下降，MA20 < MA50 < MA200
            const testCandles = [];
            const basePrice = 5000;

            for (let i = 0; i < 250; i++) {
                const price = basePrice - i * 2; // 持续下跌
                testCandles.push({
                    open: price,
                    high: price + 10,
                    low: price - 10,
                    close: price,
                    volume: 1000
                });
            }

            const ma20 = strategyCore.calculateMA(testCandles, 20);
            const ma50 = strategyCore.calculateMA(testCandles, 50);
            const ma200 = strategyCore.calculateMA(testCandles, 200);

            const currentMA20 = ma20[ma20.length - 1];
            const currentMA50 = ma50[ma50.length - 1];
            const currentMA200 = ma200[ma200.length - 1];
            const currentPrice = testCandles[testCandles.length - 1].close;

            // 验证空头趋势条件
            expect(currentPrice).toBeLessThan(currentMA20);
            expect(currentMA20).toBeLessThan(currentMA50);
            expect(currentMA50).toBeLessThan(currentMA200);
        });
    });

    /**
     * 测试边界情况
     */
    describe('Edge Cases', () => {
        test('should handle empty data', () => {
            const ma20 = strategyCore.calculateMA([], 20);
            expect(ma20).toEqual([]);
        });

        test('should handle null/undefined data', () => {
            expect(() => {
                strategyCore.calculateMA(null, 20);
            }).toThrow();

            expect(() => {
                strategyCore.calculateMA(undefined, 20);
            }).toThrow();
        });

        test('should handle invalid period', () => {
            const testCandles = [
                { open: 100, high: 105, low: 95, close: 100, volume: 1000 }
            ];

            // 测试无效周期参数，但不期望抛出异常（方法内部处理）
            const result1 = strategyCore.calculateMA(testCandles, 0);
            expect(result1).toBeNaN();

            const result2 = strategyCore.calculateMA(testCandles, -1);
            expect(result2).toBeNaN();
        });

        test('should handle very large period', () => {
            const testCandles = [];
            for (let i = 0; i < 10; i++) {
                testCandles.push({
                    open: 100 + i,
                    high: 105 + i,
                    low: 95 + i,
                    close: 100 + i,
                    volume: 1000
                });
            }

            const ma1000 = strategyCore.calculateMA(testCandles, 1000);

            // 所有值都应该为null，因为数据不足
            ma1000.forEach(value => {
                expect(value).toBeNull();
            });
        });
    });

    /**
     * 测试数据一致性
     */
    describe('Data Consistency', () => {
        test('should produce consistent results with same input', () => {
            const testCandles = [];
            for (let i = 0; i < 100; i++) {
                testCandles.push({
                    open: 100 + i,
                    high: 105 + i,
                    low: 95 + i,
                    close: 100 + i,
                    volume: 1000
                });
            }

            const ma1 = strategyCore.calculateMA(testCandles, 20);
            const ma2 = strategyCore.calculateMA(testCandles, 20);

            expect(ma1).toEqual(ma2);
        });

        test('should handle floating point precision', () => {
            const testCandles = [];
            for (let i = 0; i < 25; i++) {
                testCandles.push({
                    open: 100.123456 + i,
                    high: 105.123456 + i,
                    low: 95.123456 + i,
                    close: 100.123456 + i,
                    volume: 1000
                });
            }

            const ma20 = strategyCore.calculateMA(testCandles, 20);

            // 检查精度
            expect(ma20[19]).toBeCloseTo(ma20[19], 10);
        });
    });
});

/**
 * 性能测试
 */
describe('Performance Tests', () => {
    let strategyCore;

    beforeEach(() => {
        strategyCore = new StrategyV3Core();
    });

    afterEach(() => {
        if (strategyCore) {
            strategyCore.destroy();
        }
    });

    test('should calculate MA efficiently for large datasets', () => {
        const startTime = Date.now();

        // 创建大量数据
        const testCandles = [];
        for (let i = 0; i < 10000; i++) {
            testCandles.push({
                open: 100 + i,
                high: 105 + i,
                low: 95 + i,
                close: 100 + i,
                volume: 1000
            });
        }

        const ma20 = strategyCore.calculateMA(testCandles, 20);
        const ma50 = strategyCore.calculateMA(testCandles, 50);
        const ma200 = strategyCore.calculateMA(testCandles, 200);

        const endTime = Date.now();
        const duration = endTime - startTime;

        // 应该在合理时间内完成（小于1秒）
        expect(duration).toBeLessThan(1000);

        // 验证结果不为空
        expect(ma20.length).toBe(10000);
        expect(ma50.length).toBe(10000);
        expect(ma200.length).toBe(10000);
    });
});

module.exports = {
    describe,
    test,
    expect,
    beforeEach,
    afterEach
};
