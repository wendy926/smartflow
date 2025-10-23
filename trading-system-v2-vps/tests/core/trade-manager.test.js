/**
 * 交易管理器单元测试
 */

const TradeManager = require('../../src/core/trade-manager');
const dbOps = require('../../src/database/operations');

// 模拟数据库操作
jest.mock('../../src/database/operations');
jest.mock('../../src/utils/logger');

describe('TradeManager', () => {
  let tradeManager;

  beforeEach(() => {
    // 清理模拟
    jest.clearAllMocks();

    // 创建新的交易管理器实例
    tradeManager = new TradeManager();

    // 模拟数据库操作
    dbOps.getTrades.mockResolvedValue([]);
    dbOps.getLatestClosedTrade.mockResolvedValue(null);
    dbOps.addTrade.mockResolvedValue({ success: true, id: 1 });
    dbOps.getTradeById.mockResolvedValue({
      id: 1,
      symbol: 'BTCUSDT',
      strategy_type: 'V3',
      direction: 'LONG',
      entry_price: 50000,
      position_size: 0.01,
      status: 'ACTIVE'
    });
    dbOps.updateTrade.mockResolvedValue({ success: true });
  });

  describe('createTrade', () => {
    it('应该成功创建新交易', async () => {
      const tradeData = {
        symbol: 'BTCUSDT',
        strategy_type: 'V3',
        direction: 'LONG',
        entry_price: 50000,
        stop_loss: 49000,
        take_profit: 52000,
        leverage: 10,
        position_size: 0.01,
        entry_reason: '测试交易'
      };

      const result = await tradeManager.createTrade(tradeData);

      expect(result.success).toBe(true);
      expect(result.data.id).toBe(1);
      expect(result.message).toBe('模拟交易创建成功');
      expect(dbOps.addTrade).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'BTCUSDT',
          strategy_type: 'V3',
          direction: 'LONG',
          entry_price: 50000,
          stop_loss: 49000,
          take_profit: 52000,
          leverage: 10,
          position_size: 0.01,
          entry_reason: '测试交易',
          status: 'ACTIVE'
        })
      );
    });

    it('应该拒绝创建重复的活跃交易', async () => {
      // 模拟已有活跃交易
      tradeManager.activeTrades.set('BTCUSDT_V3', {
        tradeId: 1,
        lastTradeTime: Date.now()
      });

      const tradeData = {
        symbol: 'BTCUSDT',
        strategy_type: 'V3',
        direction: 'LONG',
        entry_price: 50000,
        stop_loss: 49000,
        take_profit: 52000,
        leverage: 10,
        position_size: 0.01,
        entry_reason: '测试交易'
      };

      const result = await tradeManager.createTrade(tradeData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('该交易对和策略已有活跃交易');
      expect(result.data.activeTradeId).toBe(1);
    });

    it('应该拒绝在冷却期内创建交易', async () => {
      // 模拟最近关闭的交易
      const recentCloseTime = new Date(Date.now() - 2 * 60 * 1000); // 2分钟前
      dbOps.getLatestClosedTrade.mockResolvedValue({
        closed_at: recentCloseTime
      });

      const tradeData = {
        symbol: 'BTCUSDT',
        strategy_type: 'V3',
        direction: 'LONG',
        entry_price: 50000,
        stop_loss: 49000,
        take_profit: 52000,
        leverage: 10,
        position_size: 0.01,
        entry_reason: '测试交易'
      };

      const result = await tradeManager.createTrade(tradeData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('同一交易对和策略两次交易间隔不能少于5分钟');
    });

    it('应该正确处理数据库错误', async () => {
      dbOps.addTrade.mockResolvedValue({ success: false, error: '数据库错误' });

      const tradeData = {
        symbol: 'BTCUSDT',
        strategy_type: 'V3',
        direction: 'LONG',
        entry_price: 50000,
        stop_loss: 49000,
        take_profit: 52000,
        leverage: 10,
        position_size: 0.01,
        entry_reason: '测试交易'
      };

      const result = await tradeManager.createTrade(tradeData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('数据库插入失败');
    });
  });

  describe('closeTrade', () => {
    it('应该成功关闭交易', async () => {
      const closeData = {
        exit_price: 51000,
        exit_reason: 'MANUAL'
      };

      const result = await tradeManager.closeTrade(1, closeData);

      expect(result.success).toBe(true);
      expect(result.data.id).toBe(1);
      expect(result.message).toBe('模拟交易关闭成功');
      expect(dbOps.updateTrade).toHaveBeenCalledWith(1, {
        status: 'CLOSED',
        exit_price: 51000,
        exit_reason: 'MANUAL',
        pnl: 100, // (51000 - 50000) * 0.01
        pnl_percentage: 2, // (100 / (50000 * 0.01)) * 100
        closed_at: expect.any(Date)
      });
    });

    it('应该拒绝关闭不存在的交易', async () => {
      dbOps.getTradeById.mockResolvedValue(null);

      const closeData = {
        exit_price: 51000,
        exit_reason: 'MANUAL'
      };

      const result = await tradeManager.closeTrade(999, closeData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('交易记录不存在');
    });

    it('应该拒绝关闭非活跃交易', async () => {
      dbOps.getTradeById.mockResolvedValue({
        id: 1,
        symbol: 'BTCUSDT',
        strategy_type: 'V3',
        direction: 'LONG',
        entry_price: 50000,
        position_size: 0.01,
        status: 'CLOSED'
      });

      const closeData = {
        exit_price: 51000,
        exit_reason: 'MANUAL'
      };

      const result = await tradeManager.closeTrade(1, closeData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('该交易已非活跃状态，无法关闭');
    });

    it('应该正确计算空头交易的盈亏', async () => {
      dbOps.getTradeById.mockResolvedValue({
        id: 1,
        symbol: 'BTCUSDT',
        strategy_type: 'V3',
        direction: 'SHORT',
        entry_price: 50000,
        position_size: 0.01,
        status: 'ACTIVE'
      });

      const closeData = {
        exit_price: 49000,
        exit_reason: 'MANUAL'
      };

      const result = await tradeManager.closeTrade(1, closeData);

      expect(result.success).toBe(true);
      expect(dbOps.updateTrade).toHaveBeenCalledWith(1, {
        status: 'CLOSED',
        exit_price: 49000,
        exit_reason: 'MANUAL',
        pnl: 100, // (50000 - 49000) * 0.01
        pnl_percentage: 2, // (100 / (50000 * 0.01)) * 100
        closed_at: expect.any(Date)
      });
    });
  });

  describe('canCreateTrade', () => {
    it('应该允许创建新交易', async () => {
      const result = await tradeManager.canCreateTrade('BTCUSDT', 'V3');

      expect(result.canCreate).toBe(true);
      expect(result.reason).toBe('可以创建交易');
    });

    it('应该拒绝创建重复的活跃交易', async () => {
      tradeManager.activeTrades.set('BTCUSDT_V3', {
        tradeId: 1,
        lastTradeTime: Date.now()
      });

      const result = await tradeManager.canCreateTrade('BTCUSDT', 'V3');

      expect(result.canCreate).toBe(false);
      expect(result.reason).toBe('该交易对和策略已有活跃交易');
    });

    it('应该拒绝在冷却期内创建交易', async () => {
      const recentCloseTime = new Date(Date.now() - 2 * 60 * 1000);
      dbOps.getLatestClosedTrade.mockResolvedValue({
        closed_at: recentCloseTime
      });

      const result = await tradeManager.canCreateTrade('BTCUSDT', 'V3');

      expect(result.canCreate).toBe(false);
      expect(result.reason).toContain('冷却期内');
    });
  });

  describe('getCooldownStatus', () => {
    it('应该返回冷却状态信息', () => {
      const status = tradeManager.getCooldownStatus('BTCUSDT', 'V3');

      expect(status).toHaveProperty('canCreate');
      expect(status).toHaveProperty('remainingTime');
      expect(status).toHaveProperty('lastTradeTime');
    });
  });

  describe('getAllActiveTrades', () => {
    it('应该返回所有活跃交易', async () => {
      const mockTrades = [
        { id: 1, symbol: 'BTCUSDT', strategy_type: 'V3', status: 'ACTIVE' },
        { id: 2, symbol: 'ETHUSDT', strategy_type: 'ICT', status: 'ACTIVE' }
      ];
      dbOps.getTrades.mockResolvedValue(mockTrades);

      const result = await tradeManager.getAllActiveTrades();

      expect(result).toEqual(mockTrades);
      expect(dbOps.getTrades).toHaveBeenCalledWith(null, null, null, 'ACTIVE');
    });
  });

  describe('getActiveTrade', () => {
    it('应该返回指定交易对和策略的活跃交易', async () => {
      const mockTrade = { id: 1, symbol: 'BTCUSDT', strategy_type: 'V3', status: 'ACTIVE' };
      dbOps.getTrades.mockResolvedValue([mockTrade]);

      const result = await tradeManager.getActiveTrade('BTCUSDT', 'V3');

      expect(result).toEqual(mockTrade);
      expect(dbOps.getTrades).toHaveBeenCalledWith('V3', 'BTCUSDT', null, 'ACTIVE');
    });

    it('应该在没有活跃交易时返回null', async () => {
      dbOps.getTrades.mockResolvedValue([]);

      const result = await tradeManager.getActiveTrade('BTCUSDT', 'V3');

      expect(result).toBeNull();
    });
  });

  describe('getTradeStatistics', () => {
    it('应该返回交易统计信息', async () => {
      const mockStats = {
        totalTrades: 100,
        winningTrades: 60,
        losingTrades: 40,
        winRate: 60,
        totalPnL: 1000,
        averagePnL: 10,
        bestTrade: 100,
        worstTrade: -50,
        averagePnLPercentage: 2.5
      };
      dbOps.getTradeStatistics.mockResolvedValue(mockStats);

      const result = await tradeManager.getTradeStatistics('V3', 'BTCUSDT');

      expect(result).toEqual(mockStats);
      expect(dbOps.getTradeStatistics).toHaveBeenCalledWith('V3', 'BTCUSDT');
    });
  });

  describe('autoCloseTrades', () => {
    it('应该自动关闭达到止盈条件的交易', async () => {
      const mockTrades = [
        {
          id: 1,
          symbol: 'BTCUSDT',
          strategy_type: 'V3',
          direction: 'LONG',
          entry_price: 50000,
          take_profit: 51000,
          position_size: 0.01,
          status: 'ACTIVE'
        }
      ];
      dbOps.getTrades.mockResolvedValue(mockTrades);
      dbOps.updateTrade.mockResolvedValue({ success: true });

      const result = await tradeManager.autoCloseTrades('BTCUSDT', 51000);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(dbOps.updateTrade).toHaveBeenCalledWith(1, {
        status: 'CLOSED',
        exit_price: 51000,
        exit_reason: 'AUTO_TAKE_PROFIT',
        pnl: 100,
        pnl_percentage: 2,
        closed_at: expect.any(Date)
      });
    });

    it('应该自动关闭达到止损条件的交易', async () => {
      const mockTrades = [
        {
          id: 1,
          symbol: 'BTCUSDT',
          strategy_type: 'V3',
          direction: 'LONG',
          entry_price: 50000,
          stop_loss: 49000,
          position_size: 0.01,
          status: 'ACTIVE'
        }
      ];
      dbOps.getTrades.mockResolvedValue(mockTrades);
      dbOps.updateTrade.mockResolvedValue({ success: true });

      const result = await tradeManager.autoCloseTrades('BTCUSDT', 49000);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(dbOps.updateTrade).toHaveBeenCalledWith(1, {
        status: 'CLOSED',
        exit_price: 49000,
        exit_reason: 'AUTO_STOP_LOSS',
        pnl: -100,
        pnl_percentage: -2,
        closed_at: expect.any(Date)
      });
    });
  });
});
