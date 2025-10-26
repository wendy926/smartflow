/**
 * BacktestEngine单元测试
 * 测试回测引擎核心功能
 */

const BacktestEngine = require('../../src/core/backtest-engine');
const logger = require('../../src/utils/logger');

describe('BacktestEngine', () => {
  let backtestEngine;
  let mockDatabase;
  let mockBinanceAPI;

  beforeEach(() => {
    // 创建Mock对象
    mockDatabase = {
      query: jest.fn(),
      connect: jest.fn()
    };

    mockBinanceAPI = {
      getKlines: jest.fn()
    };

    // 创建BacktestEngine实例
    backtestEngine = new BacktestEngine(mockDatabase, mockBinanceAPI);
  });

  test('应正确构建K线窗口', () => {
    const marketData = Array.from({ length: 100 }, (_, i) => ({
      timestamp: Date.now() - (100 - i) * 60000,
      open: 100,
      high: 105,
      low: 95,
      close: 100 + i % 10,
      volume: 1000
    }));

    const window = backtestEngine.buildKlineWindow(marketData, 50);

    expect(window).toHaveLength(50);
    expect(window[0].timestamp).toBeLessThan(window[49].timestamp);
  });

  test('应正确执行回测', async () => {
    const mockKlines = Array.from({ length: 100 }, (_, i) => ({
      timestamp: Date.now() - (100 - i) * 60000,
      open: 100,
      high: 105,
      low: 95,
      close: 100 + i % 10,
      volume: 1000
    }));

    mockDatabase.query.mockResolvedValue([mockKlines]);

    // Mock策略
    const mockStrategy = {
      execute: jest.fn().mockResolvedValue({ signal: 'BUY' })
    };

    backtestEngine.strategyEngine = { executeStrategy: jest.fn() };
    backtestEngine.strategyEngine.executeStrategy.mockResolvedValue({ signal: 'BUY' });

    const result = await backtestEngine.runBacktest('BTCUSDT', '2024-01-01', '2024-01-02');

    expect(result).toBeDefined();
    expect(result.totalTrades).toBeGreaterThanOrEqual(0);
  });

  test('应正确计算PnL', () => {
    const trade = {
      entryPrice: 100,
      exitPrice: 110,
      quantity: 1,
      direction: 'LONG'
    };

    const pnl = backtestEngine.calculatePnL(trade);

    expect(pnl).toBe(10);
  });

  test('应正确计算做空PnL', () => {
    const trade = {
      entryPrice: 110,
      exitPrice: 100,
      quantity: 1,
      direction: 'SHORT'
    };

    const pnl = backtestEngine.calculatePnL(trade);

    expect(pnl).toBe(10);
  });

  test('应正确处理资金费率成本', () => {
    const trade = {
      entryPrice: 100,
      exitPrice: 110,
      quantity: 1,
      direction: 'LONG',
      fundingRate: 0.0001,
      holdHours: 24
    };

    const fundingCost = backtestEngine.calculateFundingRateCost(trade);

    expect(fundingCost).toBeGreaterThan(0);
    expect(fundingCost).toBeLessThan(trade.entryPrice * trade.quantity);
  });

  test('应正确生成回测报告', async () => {
    const mockTrades = [
      { pnl: 10, direction: 'LONG' },
      { pnl: -5, direction: 'SHORT' },
      { pnl: 15, direction: 'LONG' }
    ];

    const report = await backtestEngine.generateReport(mockTrades);

    expect(report.totalTrades).toBe(3);
    expect(report.totalPnL).toBe(20);
    expect(report.winRate).toBeGreaterThan(0);
  });

  test('应正确处理数据不足的情况', async () => {
    const mockKlines = [];

    mockDatabase.query.mockResolvedValue([mockKlines]);

    await expect(
      backtestEngine.runBacktest('BTCUSDT', '2024-01-01', '2024-01-02')
    ).rejects.toThrow();
  });
});

