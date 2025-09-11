/**
 * 胜率统计重置的单元测试
 */

const SimulationManager = require('../modules/database/SimulationManager');

// Mock DatabaseManager
jest.mock('../modules/database/DatabaseManager', () => {
  return jest.fn().mockImplementation(() => ({
    runQuery: jest.fn(),
    init: jest.fn().mockResolvedValue()
  }));
});

describe('胜率统计重置测试', () => {
  let simulationManager;
  let mockDb;

  beforeEach(() => {
    mockDb = {
      runQuery: jest.fn()
    };
    simulationManager = new SimulationManager(mockDb);
  });

  afterEach(() => {
    // 清理SimulationManager的定时器
    if (simulationManager && simulationManager.priceCheckInterval) {
      clearInterval(simulationManager.priceCheckInterval);
      simulationManager.priceCheckInterval = null;
    }
    simulationManager = null;
    mockDb = null;
  });

  test('getWinRateStats应该返回默认值当没有数据时', async () => {
    mockDb.runQuery.mockResolvedValue([]);

    const stats = await simulationManager.getWinRateStats();

    expect(stats).toEqual({
      total_trades: 0,
      winning_trades: 0,
      losing_trades: 0,
      win_rate: 0,
      total_profit: 0,
      total_loss: 0,
      net_profit: 0
    });
  });

  test('getWinRateStats应该返回数据库中的数据', async () => {
    const mockData = [{
      id: 1,
      total_trades: 10,
      winning_trades: 6,
      losing_trades: 4,
      win_rate: 60,
      total_profit: 100,
      total_loss: 50,
      net_profit: 50,
      last_updated: '2025-01-11 12:00:00'
    }];

    mockDb.runQuery.mockResolvedValue(mockData);

    const stats = await simulationManager.getWinRateStats();

    expect(stats).toEqual(mockData[0]);
  });

  test('清空win_rate_stats表应该删除所有记录', async () => {
    mockDb.runQuery.mockResolvedValue({ changes: 1 });

    const result = await mockDb.runQuery('DELETE FROM win_rate_stats');
    
    expect(mockDb.runQuery).toHaveBeenCalledWith('DELETE FROM win_rate_stats');
    expect(result.changes).toBe(1);
  });

  test('插入默认win_rate_stats记录应该成功', async () => {
    mockDb.runQuery.mockResolvedValue({ changes: 1 });

    const insertQuery = `
      INSERT INTO win_rate_stats (total_trades, winning_trades, losing_trades, win_rate, total_profit, total_loss, net_profit, last_updated)
      VALUES (0, 0, 0, 0, 0, 0, 0, datetime('now'))
    `;

    const result = await mockDb.runQuery(insertQuery);
    
    expect(mockDb.runQuery).toHaveBeenCalledWith(insertQuery);
    expect(result.changes).toBe(1);
  });
});
