const SafeDatabaseManager = require('../modules/database/SafeDatabaseManager');
const StrategyV3Core = require('../modules/strategy/StrategyV3Core');

/**
 * 4H趋势分析集成测试
 */
describe('4H Trend Analysis Integration Tests', () => {
    let safeDB;
    let strategyCore;

    beforeAll(async () => {
        safeDB = new SafeDatabaseManager();
        await safeDB.init();
    });

    afterAll(async () => {
        if (strategyCore) {
            await strategyCore.destroy();
        }
        await safeDB.close();
    });

    beforeEach(async () => {
        strategyCore = await safeDB.createStrategyInstance(StrategyV3Core);
    });

    afterEach(async () => {
        if (strategyCore) {
            await strategyCore.destroy();
            strategyCore = null;
        }
    });

    /**
     * 测试ETHUSDT趋势分析
     */
    test('should analyze ETHUSDT trend correctly', async () => {
        const result = await strategyCore.analyze4HTrend('ETHUSDT');

        // 验证返回结果结构
        expect(result).toHaveProperty('trend4h');
        expect(result).toHaveProperty('marketType');

        // 如果有错误，则跳过MA相关字段的检查
        if (!result.error) {
            expect(result).toHaveProperty('ma20');
            expect(result).toHaveProperty('ma50');
            expect(result).toHaveProperty('ma200');
            expect(result).toHaveProperty('bullScore');
            expect(result).toHaveProperty('bearScore');
            expect(result).toHaveProperty('score');
        }

        // 验证趋势类型
        expect(['多头趋势', '空头趋势', '震荡市']).toContain(result.trend4h);
        expect(['趋势市', '震荡市']).toContain(result.marketType);

        // 验证MA值合理性
        expect(result.ma20).toBeGreaterThan(0);
        expect(result.ma50).toBeGreaterThan(0);
        expect(result.ma200).toBeGreaterThan(0);

        // 验证得分逻辑
        expect(result.bullScore).toBeGreaterThanOrEqual(0);
        expect(result.bearScore).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeGreaterThanOrEqual(0);

        // 验证趋势判断逻辑一致性
        if (result.trend4h === '多头趋势') {
            expect(result.marketType).toBe('趋势市');
            expect(result.bullScore).toBeGreaterThanOrEqual(2);
        } else if (result.trend4h === '空头趋势') {
            expect(result.marketType).toBe('趋势市');
            expect(result.bearScore).toBeGreaterThanOrEqual(2);
        } else if (result.trend4h === '震荡市') {
            expect(result.marketType).toBe('震荡市');
        }
    });

    /**
     * 测试多个交易对的趋势分析
     */
    test('should analyze multiple symbols consistently', async () => {
        const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT'];
        const results = [];

        for (const symbol of symbols) {
            const result = await strategyCore.analyze4HTrend(symbol);
            results.push({ symbol, ...result });

            // 验证每个结果的基本结构
            expect(result).toHaveProperty('trend4h');
            expect(result).toHaveProperty('marketType');

            // 如果有错误，则跳过MA相关字段的检查
            if (!result.error) {
                expect(result).toHaveProperty('ma20');
                expect(result).toHaveProperty('ma50');
                expect(result).toHaveProperty('ma200');
            }
        }

        // 验证结果一致性
        results.forEach(({ symbol, trend4h, marketType, ma20, ma50, ma200 }) => {
            console.log(`${symbol}: ${trend4h} (${marketType}) - MA20:${ma20?.toFixed(2)}, MA50:${ma50?.toFixed(2)}, MA200:${ma200?.toFixed(2)}`);

            // 验证MA值在合理范围内
            if (ma20 && ma50 && ma200) {
                expect(ma20).toBeGreaterThan(0);
                expect(ma50).toBeGreaterThan(0);
                expect(ma200).toBeGreaterThan(0);

                // 验证MA值之间的逻辑关系
                const maSpread = Math.abs(ma20 - ma50) / Math.min(ma20, ma50);
                expect(maSpread).toBeLessThan(2); // MA20和MA50差异不应超过200%
            }
        });
    });

    /**
     * 测试数据不足的情况
     */
    test('should handle insufficient data gracefully', async () => {
        // 测试一个可能没有足够数据的交易对
        const result = await strategyCore.analyze4HTrend('NONEXISTENTUSDT');

        // 应该返回震荡市或错误信息
        expect(result.trend4h).toBe('震荡市');
        expect(result.marketType).toBe('震荡市');
        expect(result).toHaveProperty('error');
    });

    /**
     * 测试趋势判断的准确性
     */
    test('should provide accurate trend assessment', async () => {
        const result = await strategyCore.analyze4HTrend('ETHUSDT');

        if (result.trend4h === '多头趋势') {
            // 多头趋势的验证条件
            expect(result.bullScore).toBeGreaterThanOrEqual(2);
            expect(result.score).toBeGreaterThanOrEqual(4);

            // MA排列应该是多头排列（价格 > MA20 > MA50 > MA200）
            // 注意：这里我们验证逻辑一致性，不验证具体数值
            console.log(`ETHUSDT多头趋势验证: 多头得分${result.bullScore}, 空头得分${result.bearScore}, 总得分${result.score}`);

        } else if (result.trend4h === '空头趋势') {
            // 空头趋势的验证条件
            expect(result.bearScore).toBeGreaterThanOrEqual(2);
            expect(result.score).toBeGreaterThanOrEqual(4);

            console.log(`ETHUSDT空头趋势验证: 多头得分${result.bullScore}, 空头得分${result.bearScore}, 总得分${result.score}`);

        } else {
            // 震荡市的验证条件
            if (result.score !== undefined) {
                expect(result.score).toBeLessThan(4);
                console.log(`ETHUSDT震荡市验证: 多头得分${result.bullScore}, 空头得分${result.bearScore}, 总得分${result.score}`);
            } else {
                console.log(`ETHUSDT震荡市验证: 数据不足，无法计算得分`);
            }
        }
    });

    /**
     * 测试性能
     */
    test('should complete analysis within reasonable time', async () => {
        const startTime = Date.now();

        const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT'];

        for (const symbol of symbols) {
            await strategyCore.analyze4HTrend(symbol);
        }

        const endTime = Date.now();
        const duration = endTime - startTime;

        // 5个交易对的分析应该在5秒内完成
        expect(duration).toBeLessThan(5000);

        console.log(`分析${symbols.length}个交易对耗时: ${duration}ms`);
    });

    /**
     * 测试内存使用
     */
    test('should not leak memory during analysis', async () => {
        const initialMemory = process.memoryUsage();

        // 执行多次分析
        for (let i = 0; i < 10; i++) {
            await strategyCore.analyze4HTrend('ETHUSDT');
        }

        // 强制垃圾回收
        if (global.gc) {
            global.gc();
        }

        const finalMemory = process.memoryUsage();
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

        // 内存增长不应超过10MB
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);

        console.log(`内存使用情况: 初始${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB, 最终${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB, 增长${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });
});

/**
 * 数据一致性测试
 */
describe('Data Consistency Tests', () => {
    let safeDB;

    beforeAll(async () => {
        safeDB = new SafeDatabaseManager();
        await safeDB.init();
    });

    afterAll(async () => {
        await safeDB.close();
    });

    test('should produce consistent results across multiple runs', async () => {
        const results = [];

        for (let i = 0; i < 3; i++) {
            const strategyCore = await safeDB.createStrategyInstance(StrategyV3Core);
            const result = await strategyCore.analyze4HTrend('ETHUSDT');
            await strategyCore.destroy();
            results.push(result);
        }

        // 验证结果一致性
        for (let i = 1; i < results.length; i++) {
            expect(results[i].trend4h).toBe(results[0].trend4h);
            expect(results[i].marketType).toBe(results[0].marketType);
            expect(results[i].bullScore).toBe(results[0].bullScore);
            expect(results[i].bearScore).toBe(results[0].bearScore);
            expect(results[i].score).toBe(results[0].score);

            // MA值应该非常接近（允许小的浮点误差）
            if (results[i].ma20 !== undefined && results[0].ma20 !== undefined) {
                expect(results[i].ma20).toBeCloseTo(results[0].ma20, 2);
                expect(results[i].ma50).toBeCloseTo(results[0].ma50, 2);
                expect(results[i].ma200).toBeCloseTo(results[0].ma200, 2);
            }
        }
    });
});

module.exports = {
    describe,
    test,
    expect,
    beforeAll,
    afterAll,
    beforeEach,
    afterEach
};
