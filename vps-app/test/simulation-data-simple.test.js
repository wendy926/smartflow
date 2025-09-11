/**
 * 模拟交易数据一致性简化测试
 */

const DatabaseManager = require('../modules/database/DatabaseManager');

describe('模拟交易数据一致性简化测试', () => {
  let dbManager;

  beforeAll(async () => {
    dbManager = new DatabaseManager();
    await dbManager.init();
  });

  afterAll(async () => {
    if (dbManager) {
      await dbManager.close();
    }
  });

  beforeEach(async () => {
    // 清理测试数据
    await dbManager.runQuery('DELETE FROM simulations');
  });

  test('数据库模拟交易记录应该正确存储', async () => {
    // 1. 初始状态检查
    const initialCount = await dbManager.runQuery('SELECT COUNT(*) as count FROM simulations');
    expect(initialCount[0].count).toBe(0);

    // 2. 插入模拟交易记录
    const testSimulation = {
      symbol: 'BTCUSDT',
      entry_price: 50000,
      stop_loss_price: 49000,
      take_profit_price: 52000,
      max_leverage: 10,
      min_margin: 100,
      trigger_reason: 'TEST',
      status: 'ACTIVE'
    };

    const result = await dbManager.runQuery(`
      INSERT INTO simulations (symbol, entry_price, stop_loss_price, take_profit_price, 
                              max_leverage, min_margin, trigger_reason, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      testSimulation.symbol,
      testSimulation.entry_price,
      testSimulation.stop_loss_price,
      testSimulation.take_profit_price,
      testSimulation.max_leverage,
      testSimulation.min_margin,
      testSimulation.trigger_reason,
      testSimulation.status,
      new Date().toISOString()
    ]);

    // 3. 验证记录插入成功
    const finalCount = await dbManager.runQuery('SELECT COUNT(*) as count FROM simulations');
    expect(finalCount[0].count).toBe(1);

    // 4. 验证记录内容
    const records = await dbManager.runQuery('SELECT * FROM simulations WHERE symbol = ?', ['BTCUSDT']);
    expect(records).toHaveLength(1);
    expect(records[0].symbol).toBe('BTCUSDT');
    expect(records[0].entry_price).toBe(50000);
    expect(records[0].status).toBe('ACTIVE');
  });

  test('模拟交易记录应该支持状态更新', async () => {
    // 1. 创建模拟交易记录
    await dbManager.runQuery(`
      INSERT INTO simulations (symbol, entry_price, stop_loss_price, take_profit_price, 
                              max_leverage, min_margin, trigger_reason, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, ['ETHUSDT', 3000, 2900, 3200, 10, 100, 'TEST', 'ACTIVE', new Date().toISOString()]);

    // 2. 更新状态为完成
    await dbManager.runQuery(`
      UPDATE simulations 
      SET status = ?, closed_at = ?, exit_price = ?, exit_reason = ?, is_win = ?, profit_loss = ?
      WHERE symbol = ?
    `, ['COMPLETED', new Date().toISOString(), 3200, 'TAKE_PROFIT', true, 200, 'ETHUSDT']);

    // 3. 验证状态更新
    const records = await dbManager.runQuery('SELECT * FROM simulations WHERE symbol = ?', ['ETHUSDT']);
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe('COMPLETED');
    expect(records[0].is_win).toBe(1); // SQLite中true存储为1
    expect(records[0].profit_loss).toBe(200);
  });

  test('应该支持多个交易对的独立记录', async () => {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'LINKUSDT'];
    
    // 为每个交易对创建模拟交易记录
    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i];
      await dbManager.runQuery(`
        INSERT INTO simulations (symbol, entry_price, stop_loss_price, take_profit_price, 
                                max_leverage, min_margin, trigger_reason, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [symbol, 1000 + i * 100, 900 + i * 100, 1100 + i * 100, 10, 100, 'TEST', 'ACTIVE', new Date().toISOString()]);
    }

    // 验证每个交易对都有独立记录
    for (const symbol of symbols) {
      const records = await dbManager.runQuery('SELECT * FROM simulations WHERE symbol = ?', [symbol]);
      expect(records).toHaveLength(1);
      expect(records[0].symbol).toBe(symbol);
    }

    // 验证总记录数
    const totalCount = await dbManager.runQuery('SELECT COUNT(*) as count FROM simulations');
    expect(totalCount[0].count).toBe(3);
  });

  test('应该支持按状态查询模拟交易记录', async () => {
    // 创建不同状态的模拟交易记录
    const simulations = [
      { symbol: 'BTCUSDT', status: 'ACTIVE' },
      { symbol: 'ETHUSDT', status: 'COMPLETED' },
      { symbol: 'LINKUSDT', status: 'ACTIVE' },
      { symbol: 'ADAUSDT', status: 'COMPLETED' }
    ];

    for (const sim of simulations) {
      await dbManager.runQuery(`
        INSERT INTO simulations (symbol, entry_price, stop_loss_price, take_profit_price, 
                                max_leverage, min_margin, trigger_reason, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [sim.symbol, 1000, 900, 1100, 10, 100, 'TEST', sim.status, new Date().toISOString()]);
    }

    // 查询活跃交易
    const activeRecords = await dbManager.runQuery('SELECT * FROM simulations WHERE status = ?', ['ACTIVE']);
    expect(activeRecords).toHaveLength(2);
    expect(activeRecords.map(r => r.symbol)).toContain('BTCUSDT');
    expect(activeRecords.map(r => r.symbol)).toContain('LINKUSDT');

    // 查询已完成交易
    const completedRecords = await dbManager.runQuery('SELECT * FROM simulations WHERE status = ?', ['COMPLETED']);
    expect(completedRecords).toHaveLength(2);
    expect(completedRecords.map(r => r.symbol)).toContain('ETHUSDT');
    expect(completedRecords.map(r => r.symbol)).toContain('ADAUSDT');
  });
});
