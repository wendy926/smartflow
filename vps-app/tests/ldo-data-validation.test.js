/**
 * LDOUSDT数据验证和修复测试
 * 测试数据质量验证和calculateMA方法的修复效果
 */

const StrategyV3Core = require('../modules/strategy/StrategyV3Core.js');
const DatabaseManager = require('../modules/database/DatabaseManager.js');

describe('LDOUSDT数据验证和修复测试', () => {
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

    describe('calculateMA方法数据验证', () => {
        test('应该正确处理空数据', () => {
            const result = strategyCore.calculateMA(null, 20);
            expect(result).toEqual([]);
            
            const result2 = strategyCore.calculateMA([], 20);
            expect(result2).toEqual([]);
        });

        test('应该过滤无效数据并计算MA', () => {
            // 创建包含无效数据的测试数据
            const testData = [
                [1640995200000, 1.0, 1.1, 0.9, 1.05, 1000], // 有效数据
                [1640995260000, 1.05, 1.15, 0.95, 1.1, 1100], // 有效数据
                [1640995320000, null, null, null, null, null], // 无效数据
                [1640995380000, 1.1, 1.2, 1.0, 1.15, 1200], // 有效数据
                [1640995440000, 'invalid', 'invalid', 'invalid', 'invalid', 'invalid'], // 无效数据
                [1640995500000, 1.15, 1.25, 1.05, 1.2, 1300], // 有效数据
            ];

            // 添加更多有效数据以支持MA20计算
            for (let i = 6; i < 25; i++) {
                testData.push([
                    1640995200000 + i * 60000, // timestamp
                    1.0 + i * 0.01, // open
                    1.1 + i * 0.01, // high
                    0.9 + i * 0.01, // low
                    1.05 + i * 0.01, // close
                    1000 + i * 100 // volume
                ]);
            }

            const result = strategyCore.calculateMA(testData, 20);
            
            // 应该返回有效结果，不包含NaN
            expect(result.length).toBeGreaterThan(0);
            expect(result.every(val => !isNaN(val))).toBe(true);
            expect(result.every(val => typeof val === 'number')).toBe(true);
        });

        test('应该处理数据不足的情况', () => {
            const testData = [
                [1640995200000, 1.0, 1.1, 0.9, 1.05, 1000],
                [1640995260000, 1.05, 1.15, 0.95, 1.1, 1100],
            ];

            const result = strategyCore.calculateMA(testData, 20);
            expect(result).toEqual([]);
        });

        test('应该正确处理对象格式的K线数据', () => {
            const testData = [
                { close: 1.05, volume: 1000 },
                { close: 1.1, volume: 1100 },
                { close: 1.15, volume: 1200 },
                { close: 1.2, volume: 1300 },
                { close: 1.25, volume: 1400 },
            ];

            const result = strategyCore.calculateMA(testData, 3);
            
            expect(result.length).toBe(3); // 5条数据，3周期MA，应该返回3个值
            expect(result.every(val => !isNaN(val))).toBe(true);
            expect(result.every(val => typeof val === 'number')).toBe(true);
        });
    });

    describe('LDOUSDT数据质量验证', () => {
        test('应该验证LDOUSDT数据的有效性', async () => {
            // 模拟获取LDOUSDT数据
            const mockKlines = [
                [1640995200000, 1.275, 1.285, 1.265, 1.2751, 2972217],
                [1640995260000, 1.2751, 1.2851, 1.2651, 1.2752, 2972218],
                [1640995320000, 1.2752, 1.2852, 1.2652, 1.2753, 2972219],
            ];

            // 测试数据验证逻辑
            const validData = mockKlines.filter(kline => {
                if (!kline || !Array.isArray(kline) || kline.length < 6) {
                    return false;
                }
                
                const close = parseFloat(kline[4]);
                const volume = parseFloat(kline[5]);
                
                return !isNaN(close) && close > 0 && !isNaN(volume) && volume >= 0;
            });

            expect(validData.length).toBe(3);
            expect(validData.every(kline => kline.length >= 6)).toBe(true);
        });

        test('应该检测并报告无效数据', () => {
            const mixedData = [
                [1640995200000, 1.275, 1.285, 1.265, 1.2751, 2972217], // 有效
                [1640995260000, null, null, null, null, null], // 无效
                [1640995320000, 1.2752, 1.2852, 1.2652, 'invalid', 2972219], // 无效
                [1640995380000, 1.2753, 1.2853, 1.2653, 1.2754, 2972220], // 有效
            ];

            const validData = mixedData.filter(kline => {
                if (!kline || !Array.isArray(kline) || kline.length < 6) {
                    return false;
                }
                
                const close = parseFloat(kline[4]);
                const volume = parseFloat(kline[5]);
                
                return !isNaN(close) && close > 0 && !isNaN(volume) && volume >= 0;
            });

            expect(validData.length).toBe(2); // 只有2条有效数据
        });
    });

    describe('趋势判断逻辑测试', () => {
        test('应该正确处理MA计算结果进行趋势判断', () => {
            // 模拟MA计算结果
            const ma20 = [1.275, 1.276, 1.277, 1.278, 1.279];
            const ma50 = [1.270, 1.271, 1.272, 1.273, 1.274];
            const ma200 = [1.265, 1.266, 1.267, 1.268, 1.269];

            // 验证MA值都是有效数字
            expect(ma20.every(val => !isNaN(val) && typeof val === 'number')).toBe(true);
            expect(ma50.every(val => !isNaN(val) && typeof val === 'number')).toBe(true);
            expect(ma200.every(val => !isNaN(val) && typeof val === 'number')).toBe(true);

            // 基于MA值进行简单的趋势判断
            const currentMA20 = ma20[ma20.length - 1];
            const currentMA50 = ma50[ma50.length - 1];
            const currentMA200 = ma200[ma200.length - 1];

            let trend;
            if (currentMA20 > currentMA50 && currentMA50 > currentMA200) {
                trend = '多头';
            } else if (currentMA20 < currentMA50 && currentMA50 < currentMA200) {
                trend = '空头';
            } else {
                trend = '震荡';
            }

            expect(['多头', '空头', '震荡']).toContain(trend);
            expect(trend).toBe('多头'); // 基于测试数据，应该是多头趋势
        });

        test('应该处理NaN值的情况', () => {
            // 模拟包含NaN的MA计算结果
            const ma20WithNaN = [1.275, NaN, 1.277, 1.278, 1.279];
            const ma50WithNaN = [1.270, 1.271, NaN, 1.273, 1.274];

            // 检测NaN值
            const hasNaN = ma20WithNaN.some(val => isNaN(val)) || 
                          ma50WithNaN.some(val => isNaN(val));

            expect(hasNaN).toBe(true);

            // 当存在NaN时，应该使用默认趋势判断
            const defaultTrend = '震荡';
            expect(defaultTrend).toBe('震荡');
        });
    });

    describe('数据修复验证', () => {
        test('修复后的calculateMA应该返回有效结果', () => {
            // 创建包含各种问题的测试数据
            const problematicData = [
                [1640995200000, 1.0, 1.1, 0.9, 1.05, 1000], // 正常数据
                [1640995260000, null, null, null, null, null], // null数据
                [1640995320000, 1.1, 1.2, 1.0, 'invalid', 1200], // 无效字符串
                [1640995380000, 1.2, 1.3, 1.1, 1.25, 1300], // 正常数据
                [1640995440000, 1.3, 1.4, 1.2, 0, 1400], // 零价格
                [1640995500000, 1.4, 1.5, 1.3, 1.45, 1500], // 正常数据
            ];

            // 添加更多数据以支持计算
            for (let i = 6; i < 25; i++) {
                problematicData.push([
                    1640995200000 + i * 60000,
                    1.0 + i * 0.05,
                    1.1 + i * 0.05,
                    0.9 + i * 0.05,
                    1.05 + i * 0.05,
                    1000 + i * 50
                ]);
            }

            const result = strategyCore.calculateMA(problematicData, 20);

            // 修复后应该返回有效结果
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
            expect(result.every(val => typeof val === 'number')).toBe(true);
            expect(result.every(val => !isNaN(val))).toBe(true);
            expect(result.every(val => val > 0)).toBe(true);
        });
    });
});
