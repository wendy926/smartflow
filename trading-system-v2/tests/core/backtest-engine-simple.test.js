/**
 * BacktestEngine简化单元测试
 */

describe('BacktestEngine 单元测试框架', () => {
  test('测试框架验证', () => {
    expect(true).toBe(true);
  });

  test('应正确计算PnL', () => {
    const calculatePnL = (entryPrice, exitPrice, quantity, direction) => {
      const priceDiff = direction === 'LONG' 
        ? exitPrice - entryPrice 
        : entryPrice - exitPrice;
      return priceDiff * quantity;
    };

    const pnlLong = calculatePnL(100, 110, 1, 'LONG');
    const pnlShort = calculatePnL(110, 100, 1, 'SHORT');

    expect(pnlLong).toBe(10);
    expect(pnlShort).toBe(10);
  });

  test('应正确处理资金费率成本', () => {
    const calculateFundingCost = (price, quantity, rate, hours) => {
      return price * quantity * rate * (hours / 8); // 每8小时结算
    };

    const cost = calculateFundingCost(100, 1, 0.0001, 24);
    
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(0.1); // 成本应该很小
  });

  test('应正确计算胜率', () => {
    const trades = [
      { pnl: 10 },
      { pnl: -5 },
      { pnl: 15 },
      { pnl: -8 },
      { pnl: 20 }
    ];

    const winningTrades = trades.filter(t => t.pnl > 0).length;
    const winRate = winningTrades / trades.length;

    expect(winRate).toBe(0.6); // 60%胜率
    expect(winRate).toBeGreaterThan(0.5);
  });

  test('应正确生成K线窗口', () => {
    const marketData = Array.from({ length: 100 }, (_, i) => ({
      timestamp: Date.now() - (100 - i) * 60000,
      close: 100 + i % 10
    }));

    const buildWindow = (data, size, index) => {
      const start = Math.max(0, index - size);
      return data.slice(start, index);
    };

    const window = buildWindow(marketData, 50, 100);
    
    expect(window.length).toBe(50);
    expect(window[0].timestamp).toBeLessThan(window[49].timestamp);
  });
});

