/**
 * MA数据新鲜度修复逻辑单元测试
 * 测试StrategyV3Core中新增的数据新鲜度检查、实时数据获取和异步数据库更新功能
 */

const StrategyV3Core = require('../modules/strategy/StrategyV3Core');
const BinanceAPI = require('../modules/api/BinanceAPI');

// Mock BinanceAPI
jest.mock('../modules/api/BinanceAPI');

describe('MA数据新鲜度修复逻辑测试', () => {
    let strategyCore;
    let mockDatabase;

    beforeEach(() => {
        // 创建模拟数据库
        mockDatabase = {
            runQuery: jest.fn(),
            getCustomSymbols: jest.fn().mockResolvedValue(['BTCUSDT', 'ETHUSDT', 'AAVEUSDT'])
        };

        // 创建策略核心实例
        strategyCore = new StrategyV3Core();
        strategyCore.database = mockDatabase;
        
        // Mock getKlineDataFromDB方法
        strategyCore.getKlineDataFromDB = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
        if (strategyCore) {
            strategyCore.destroy();
        }
    });

    /**
     * 测试数据新鲜度检查功能
     */
    describe('数据新鲜度检查 (checkDataFreshness)', () => {
        test('应该正确识别新鲜的4H数据', () => {
            // 创建新鲜的数据（1小时前）
            const freshData = [
                [Date.now() - 60 * 60 * 1000, 50000, 51000, 49000, 50500, 1000] // 1小时前
            ];

            const isFresh = strategyCore.checkDataFreshness(freshData, '4h');

            expect(isFresh).toBe(true);
        });

        test('应该正确识别过期的4H数据', () => {
            // 创建过期的数据（10小时前，超过8小时阈值）
            const staleData = [
                [Date.now() - 10 * 60 * 60 * 1000, 50000, 51000, 49000, 50500, 1000] // 10小时前
            ];

            const isFresh = strategyCore.checkDataFreshness(staleData, '4h');

            expect(isFresh).toBe(false);
        });

        test('应该正确识别新鲜的1H数据', () => {
            // 创建新鲜的数据（1小时前）
            const freshData = [
                [Date.now() - 60 * 60 * 1000, 50000, 51000, 49000, 50500, 1000] // 1小时前
            ];

            const isFresh = strategyCore.checkDataFreshness(freshData, '1h');

            expect(isFresh).toBe(true);
        });

        test('应该正确识别过期的1H数据', () => {
            // 创建过期的数据（3小时前，超过2小时阈值）
            const staleData = [
                [Date.now() - 3 * 60 * 60 * 1000, 50000, 51000, 49000, 50500, 1000] // 3小时前
            ];

            const isFresh = strategyCore.checkDataFreshness(staleData, '1h');

            expect(isFresh).toBe(false);
        });

        test('应该正确识别新鲜的15m数据', () => {
            // 创建新鲜的数据（10分钟前）
            const freshData = [
                [Date.now() - 10 * 60 * 1000, 50000, 51000, 49000, 50500, 1000] // 10分钟前
            ];

            const isFresh = strategyCore.checkDataFreshness(freshData, '15m');

            expect(isFresh).toBe(true);
        });

        test('应该正确识别过期的15m数据', () => {
            // 创建过期的数据（45分钟前，超过30分钟阈值）
            const staleData = [
                [Date.now() - 45 * 60 * 1000, 50000, 51000, 49000, 50500, 1000] // 45分钟前
            ];

            const isFresh = strategyCore.checkDataFreshness(staleData, '15m');

            expect(isFresh).toBe(false);
        });

        test('应该处理空数据', () => {
            const isFresh = strategyCore.checkDataFreshness([], '4h');
            expect(isFresh).toBe(false);

            const isFreshNull = strategyCore.checkDataFreshness(null, '4h');
            expect(isFreshNull).toBe(false);
        });

        test('应该处理未知时间间隔', () => {
            const freshData = [
                [Date.now() - 60 * 60 * 1000, 50000, 51000, 49000, 50500, 1000]
            ];

            // 未知间隔应该使用4h的阈值
            const isFresh = strategyCore.checkDataFreshness(freshData, 'unknown');
            expect(isFresh).toBe(true);
        });
    });

    /**
     * 测试增强的K线数据获取功能
     */
    describe('增强K线数据获取 (getKlineData)', () => {
        test('应该使用新鲜数据库数据', async () => {
            const freshData = [
                [Date.now() - 60 * 60 * 1000, 50000, 51000, 49000, 50500, 1000]
            ];

            strategyCore.getKlineDataFromDB.mockResolvedValue(freshData);

            const result = await strategyCore.getKlineData('BTCUSDT', '4h', 250);

            expect(strategyCore.getKlineDataFromDB).toHaveBeenCalledWith('BTCUSDT', '4h', 250);
            expect(result).toEqual(freshData);
            expect(BinanceAPI.getKlines).not.toHaveBeenCalled();
        });

        test('应该在数据过期时获取实时数据', async () => {
            const staleData = [
                [Date.now() - 10 * 60 * 60 * 1000, 50000, 51000, 49000, 50500, 1000] // 10小时前
            ];
            const realtimeData = [
                [Date.now() - 30 * 60 * 1000, 52000, 53000, 51000, 52500, 1200] // 30分钟前
            ];

            strategyCore.getKlineDataFromDB.mockResolvedValue(staleData);
            BinanceAPI.getKlines.mockResolvedValue(realtimeData);
            mockDatabase.runQuery.mockResolvedValue();

            const result = await strategyCore.getKlineData('BTCUSDT', '4h', 250);

            expect(strategyCore.getKlineDataFromDB).toHaveBeenCalledWith('BTCUSDT', '4h', 250);
            expect(BinanceAPI.getKlines).toHaveBeenCalledWith('BTCUSDT', '4h', 250);
            expect(result).toEqual(realtimeData);
        });

        test('应该在API失败时回退到数据库数据', async () => {
            const staleData = [
                [Date.now() - 10 * 60 * 60 * 1000, 50000, 51000, 49000, 50500, 1000]
            ];

            strategyCore.getKlineDataFromDB.mockResolvedValue(staleData);
            BinanceAPI.getKlines.mockRejectedValue(new Error('API Error'));

            const result = await strategyCore.getKlineData('BTCUSDT', '4h', 250);

            expect(strategyCore.getKlineDataFromDB).toHaveBeenCalledWith('BTCUSDT', '4h', 250);
            expect(BinanceAPI.getKlines).toHaveBeenCalledWith('BTCUSDT', '4h', 250);
            expect(result).toEqual(staleData);
        });

        test('应该在无数据时返回null', async () => {
            strategyCore.getKlineDataFromDB.mockResolvedValue(null);
            BinanceAPI.getKlines.mockRejectedValue(new Error('API Error'));

            const result = await strategyCore.getKlineData('BTCUSDT', '4h', 250);

            expect(result).toBeNull();
        });

        test('应该处理API返回空数据的情况', async () => {
            const staleData = [
                [Date.now() - 10 * 60 * 60 * 1000, 50000, 51000, 49000, 50500, 1000]
            ];

            strategyCore.getKlineDataFromDB.mockResolvedValue(staleData);
            BinanceAPI.getKlines.mockResolvedValue([]);

            const result = await strategyCore.getKlineData('BTCUSDT', '4h', 250);

            expect(result).toEqual(staleData);
        });
    });

    /**
     * 测试异步数据库更新功能
     */
    describe('异步数据库更新 (updateDatabaseAsync)', () => {
        test('应该异步更新数据库', async () => {
            const klineData = [
                [1700000000000, 50000, 51000, 49000, 50500, 1000, 1700000000000 + 4 * 60 * 60 * 1000, 1000 * 50500, 100, 500, 500 * 50500, 0]
            ];

            mockDatabase.runQuery.mockResolvedValue();

            // 调用异步更新
            strategyCore.updateDatabaseAsync('BTCUSDT', '4h', klineData);

            // 等待异步操作完成
            await new Promise(resolve => setImmediate(resolve));

            expect(mockDatabase.runQuery).toHaveBeenCalledWith(
                expect.stringContaining('INSERT OR REPLACE INTO kline_data'),
                expect.arrayContaining([
                    'BTCUSDT',
                    '4h',
                    1700000000000,
                    1700000000000 + 4 * 60 * 60 * 1000,
                    50000,
                    51000,
                    49000,
                    50500,
                    1000,
                    1000 * 50500,
                    100,
                    500,
                    500 * 50500
                ])
            );
        });

        test('应该处理数据库更新错误', async () => {
            const klineData = [
                [1700000000000, 50000, 51000, 49000, 50500, 1000, 1700000000000 + 4 * 60 * 60 * 1000, 1000 * 50500, 100, 500, 500 * 50500, 0]
            ];

            mockDatabase.runQuery.mockRejectedValue(new Error('Database Error'));

            // 调用异步更新
            strategyCore.updateDatabaseAsync('BTCUSDT', '4h', klineData);

            // 等待异步操作完成
            await new Promise(resolve => setImmediate(resolve));

            // 应该调用过数据库更新方法
            expect(mockDatabase.runQuery).toHaveBeenCalled();
        });

        test('应该处理空数据', async () => {
            mockDatabase.runQuery.mockResolvedValue();

            // 调用异步更新
            strategyCore.updateDatabaseAsync('BTCUSDT', '4h', []);

            // 等待异步操作完成
            await new Promise(resolve => setImmediate(resolve));

            // 不应该调用数据库更新方法
            expect(mockDatabase.runQuery).not.toHaveBeenCalled();
        });
    });

    /**
     * 测试完整的数据获取流程
     */
    describe('完整数据获取流程集成测试', () => {
        test('应该优先使用新鲜数据库数据', async () => {
            const freshData = [
                [Date.now() - 60 * 60 * 1000, 50000, 51000, 49000, 50500, 1000]
            ];

            strategyCore.getKlineDataFromDB.mockResolvedValue(freshData);

            const result = await strategyCore.getKlineData('BTCUSDT', '4h', 250);

            expect(result).toEqual(freshData);
            expect(BinanceAPI.getKlines).not.toHaveBeenCalled();
        });

        test('应该在数据过期时获取并更新实时数据', async () => {
            const staleData = [
                [Date.now() - 10 * 60 * 60 * 1000, 50000, 51000, 49000, 50500, 1000]
            ];
            const realtimeData = [
                [Date.now() - 30 * 60 * 1000, 52000, 53000, 51000, 52500, 1200]
            ];

            strategyCore.getKlineDataFromDB.mockResolvedValue(staleData);
            BinanceAPI.getKlines.mockResolvedValue(realtimeData);
            mockDatabase.runQuery.mockResolvedValue();

            const result = await strategyCore.getKlineData('BTCUSDT', '4h', 250);

            expect(result).toEqual(realtimeData);
            expect(BinanceAPI.getKlines).toHaveBeenCalledWith('BTCUSDT', '4h', 250);

            // 等待异步更新完成
            await new Promise(resolve => setImmediate(resolve));
            expect(mockDatabase.runQuery).toHaveBeenCalled();
        });

        test('应该在API失败时使用过期数据并警告', async () => {
            const staleData = [
                [Date.now() - 10 * 60 * 60 * 1000, 50000, 51000, 49000, 50500, 1000]
            ];

            strategyCore.getKlineDataFromDB.mockResolvedValue(staleData);
            BinanceAPI.getKlines.mockRejectedValue(new Error('Network Error'));

            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            const result = await strategyCore.getKlineData('BTCUSDT', '4h', 250);

            expect(result).toEqual(staleData);
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('使用过期数据库数据')
            );

            consoleSpy.mockRestore();
        });
    });

    /**
     * 测试不同时间间隔的阈值
     */
    describe('时间间隔阈值测试', () => {
        const testCases = [
            { interval: '4h', threshold: 8 * 60 * 60 * 1000, description: '4H数据8小时阈值' },
            { interval: '1h', threshold: 2 * 60 * 60 * 1000, description: '1H数据2小时阈值' },
            { interval: '15m', threshold: 30 * 60 * 1000, description: '15m数据30分钟阈值' }
        ];

        testCases.forEach(({ interval, threshold, description }) => {
            test(`应该正确应用${description}`, () => {
                const now = Date.now();
                
                // 测试新鲜数据（刚好在阈值内）
                const freshData = [
                    [now - threshold + 1000, 50000, 51000, 49000, 50500, 1000]
                ];
                expect(strategyCore.checkDataFreshness(freshData, interval)).toBe(true);

                // 测试过期数据（刚好超过阈值）
                const staleData = [
                    [now - threshold - 1000, 50000, 51000, 49000, 50500, 1000]
                ];
                expect(strategyCore.checkDataFreshness(staleData, interval)).toBe(false);
            });
        });
    });

    /**
     * 测试错误处理
     */
    describe('错误处理测试', () => {
        test('应该处理数据库错误', async () => {
            strategyCore.getKlineDataFromDB.mockRejectedValue(new Error('Database Error'));

            const result = await strategyCore.getKlineData('BTCUSDT', '4h', 250);

            expect(result).toBeNull();
        });

        test('应该处理无效的时间戳', () => {
            const invalidData = [
                ['invalid', 50000, 51000, 49000, 50500, 1000]
            ];

            const isFresh = strategyCore.checkDataFreshness(invalidData, '4h');

            expect(isFresh).toBe(false);
        });

        test('应该处理未来时间戳', () => {
            const futureData = [
                [Date.now() + 60 * 60 * 1000, 50000, 51000, 49000, 50500, 1000] // 未来1小时
            ];

            const isFresh = strategyCore.checkDataFreshness(futureData, '4h');

            expect(isFresh).toBe(true); // 未来数据被认为是新鲜的
        });
    });

    /**
     * 测试性能
     */
    describe('性能测试', () => {
        test('应该快速处理大量数据', async () => {
            const largeData = [];
            for (let i = 0; i < 1000; i++) {
                largeData.push([
                    Date.now() - i * 60 * 60 * 1000,
                    50000 + i,
                    51000 + i,
                    49000 + i,
                    50500 + i,
                    1000 + i
                ]);
            }

            const startTime = Date.now();
            const isFresh = strategyCore.checkDataFreshness(largeData, '4h');
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(100); // 应该在100ms内完成
            expect(typeof isFresh).toBe('boolean');
        });

        test('应该高效处理并发请求', async () => {
            strategyCore.getKlineDataFromDB.mockResolvedValue([
                [Date.now() - 60 * 60 * 1000, 50000, 51000, 49000, 50500, 1000]
            ]);

            const startTime = Date.now();
            const promises = [];
            
            for (let i = 0; i < 10; i++) {
                promises.push(strategyCore.getKlineData(`SYMBOL${i}`, '4h', 250));
            }

            const results = await Promise.all(promises);
            const endTime = Date.now();

            expect(results).toHaveLength(10);
            expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成所有请求
        });
    });
});

module.exports = {
    describe,
    test,
    expect,
    beforeEach,
    afterEach,
    jest
};
