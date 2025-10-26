/**
 * BacktestManagerV3单元测试
 * 测试回测管理器功能
 */

const BacktestManagerV3 = require('../../src/services/backtest-manager-v3');
const logger = require('../../src/utils/logger');

describe('BacktestManagerV3', () => {
  let backtestManager;
  let mockDatabase;

  beforeEach(() => {
    // 创建Mock对象
    mockDatabase = {
      query: jest.fn(),
      connect: jest.fn(),
      pool: {
        query: jest.fn()
      }
    };

    // 创建BacktestManagerV3实例
    backtestManager = new BacktestManagerV3(mockDatabase);
  });

  test('应正确启动回测', async () => {
    const mockKlines = Array.from({ length: 100 }, (_, i) => [
      Date.now() - (100 - i) * 60000, // timestamp
      '100', // open
      '105', // high
      '95',  // low
      '100', // close
      '1000' // volume
    ]);

    mockDatabase.query.mockResolvedValue([mockKlines]);

    const result = await backtestManager.startBacktest({
      strategy: 'V3',
      symbol: 'BTCUSDT',
      timeframe: '15m',
      mode: 'BALANCED'
    });

    expect(result).toBeDefined();
  });

  test('应正确获取市场数据', async () => {
    const mockKlines = Array.from({ length: 100 }, (_, i) => [
      Date.now() - (100 - i) * 60000,
      '100', '105', '95', '100', '1000'
    ]);

    mockDatabase.query.mockResolvedValue([mockKlines]);

    const data = await backtestManager.fetchMarketData('BTCUSDT', '15m');

    expect(data).toBeDefined();
    expect(data.length).toBeGreaterThan(0);
  });

  test('应正确保存回测结果', async () => {
    const mockResult = {
      strategy: 'V3',
      symbol: 'BTCUSDT',
      totalTrades: 10,
      winRate: 0.7,
      totalPnL: 100
    };

    mockDatabase.query.mockResolvedValue([{ insertId: 1 }]);

    const result = await backtestManager.saveBacktestResult(mockResult);

    expect(result).toBeDefined();
    expect(mockDatabase.query).toHaveBeenCalled();
  });

  test('应正确处理无数据情况', async () => {
    mockDatabase.query.mockResolvedValue([[]]);

    await expect(
      backtestManager.fetchMarketData('BTCUSDT', '15m')
    ).rejects.toThrow();
  });

  test('应正确处理缓存', () => {
    const cacheKey = 'BTCUSDT_15m';
    const cachedData = [{ timestamp: Date.now(), close: 100 }];

    backtestManager.marketDataCache.set(cacheKey, cachedData);

    const cached = backtestManager.getCachedMarketData('BTCUSDT', '15m');

    expect(cached).toEqual(cachedData);
  });
});

