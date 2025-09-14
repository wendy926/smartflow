/**
 * 模拟交易数据一致性测试
 * 确保监控数据与数据库数据保持一致
 */

const DatabaseManager = require('../modules/database/DatabaseManager');
const { DataMonitor } = require('../modules/monitoring/DataMonitor');

describe('模拟交易数据一致性测试', () => {
  let dbManager;
  let dataMonitor;

  beforeAll(async () => {
    dbManager = new DatabaseManager();
    await dbManager.init();

    dataMonitor = new DataMonitor();
  });

  afterAll(async () => {
    if (dbManager) {
      await dbManager.close();
    }
    if (dataMonitor) {
      dataMonitor.stopMemoryCleanup();
    }
  });

  beforeEach(async () => {
    // 清理测试数据
    await dbManager.runQuery('DELETE FROM simulations');
    dataMonitor.reset();
  });

  test('监控数据应该与数据库数据保持一致', async () => {
    // 1. 初始状态检查
    const initialSimulations = await dbManager.runQuery('SELECT COUNT(*) as count FROM simulations');
    const initialMonitoring = dataMonitor.getMonitoringDashboard();

    expect(initialSimulations[0].count).toBe(0);
    expect(initialMonitoring.summary.completionRates.simulationTrading).toBe(0);

    // 2. 模拟创建模拟交易记录
    const testSimulation = {
      symbol: 'BTCUSDT',
      entry_price: 50000,
      stop_loss_price: 49000,
      take_profit_price: 52000,
      max_leverage: 10,
      min_margin: 100,
      trigger_reason: 'TEST',
      status: 'ACTIVE',
      created_at: new Date().toISOString()
    };

    // 插入模拟交易记录
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
      testSimulation.created_at
    ]);

    // 记录模拟交易到监控系统
    dataMonitor.recordSimulation(testSimulation.symbol, 'START', testSimulation, true);

    // 3. 验证数据一致性
    const dbSimulations = await dbManager.runQuery('SELECT COUNT(*) as count FROM simulations');
    const monitoringData = dataMonitor.getMonitoringDashboard();

    expect(dbSimulations[0].count).toBe(1);
    expect(monitoringData.summary.completionRates.simulationTrading).toBe(0); // 还没有完成
    expect(monitoringData.detailedStats.find(s => s.symbol === 'BTCUSDT').simulationCompletion.triggers).toBe(1);
    expect(monitoringData.detailedStats.find(s => s.symbol === 'BTCUSDT').simulationCompletion.completions).toBe(0);
  });

  test('模拟交易完成时应该正确更新统计', async () => {
    // 1. 创建模拟交易记录
    const testSimulation = {
      symbol: 'ETHUSDT',
      entry_price: 3000,
      stop_loss_price: 2900,
      take_profit_price: 3200,
      max_leverage: 10,
      min_margin: 100,
      trigger_reason: 'TEST',
      status: 'ACTIVE',
      created_at: new Date().toISOString()
    };

    await dbManager.runQuery(`
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
      testSimulation.created_at
    ]);

    // 2. 记录模拟交易开始
    dataMonitor.recordSimulation(testSimulation.symbol, 'START', testSimulation, true);

    // 3. 记录模拟交易完成
    dataMonitor.recordSimulation(testSimulation.symbol, 'COMPLETED', {
      simulationId: 1,
      exitReason: 'TAKE_PROFIT',
      isWin: true,
      profitLoss: 200
    }, true);

    // 4. 验证统计正确性
    const monitoringData = dataMonitor.getMonitoringDashboard();
    const ethStats = monitoringData.detailedStats.find(s => s.symbol === 'ETHUSDT');

    expect(ethStats.simulationCompletion.triggers).toBe(1);
    expect(ethStats.simulationCompletion.completions).toBe(1);
    expect(ethStats.simulationCompletion.rate).toBe(100);
  });

  test('recordAnalysisLog不应该影响模拟交易统计', async () => {
    // 1. 记录分析日志（包含simulationTrading phase）
    const analysisResult = {
      success: true,
      phases: {
        dataCollection: { success: true },
        signalAnalysis: { success: true },
        simulationTrading: { success: true } // 这个不应该影响统计
      }
    };

    dataMonitor.recordAnalysisLog('TESTUSDT', 'strategy_analysis', analysisResult);

    // 2. 验证模拟交易统计没有被错误增加
    const monitoringData = dataMonitor.getMonitoringDashboard();
    const testStats = monitoringData.detailedStats.find(s => s.symbol === 'TESTUSDT');

    expect(testStats.simulationCompletion.triggers).toBe(0);
    expect(testStats.simulationCompletion.completions).toBe(0);
    expect(testStats.simulationCompletion.rate).toBe(0);
  });

  test('多个交易对的统计应该独立计算', async () => {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'LINKUSDT'];

    // 为每个交易对创建模拟交易
    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i];

      // 创建数据库记录
      await dbManager.runQuery(`
        INSERT INTO simulations (symbol, entry_price, stop_loss_price, take_profit_price, 
                                max_leverage, min_margin, trigger_reason, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [symbol, 1000 + i * 100, 900 + i * 100, 1100 + i * 100, 10, 100, 'TEST', 'ACTIVE', new Date().toISOString()]);

      // 记录到监控系统
      dataMonitor.recordSimulation(symbol, 'START', { symbol }, true);
    }

    // 验证每个交易对的统计独立
    const monitoringData = dataMonitor.getMonitoringDashboard();

    symbols.forEach(symbol => {
      const stats = monitoringData.detailedStats.find(s => s.symbol === symbol);
      expect(stats.simulationCompletion.triggers).toBe(1);
      expect(stats.simulationCompletion.completions).toBe(0);
    });

    // 验证总体统计
    expect(monitoringData.summary.completionRates.simulationTrading).toBe(0);
  });

  test('数据库和监控数据应该同步更新', async () => {
    // 1. 创建模拟交易
    const simulation = {
      symbol: 'ADAUSDT',
      entry_price: 0.5,
      stop_loss_price: 0.45,
      take_profit_price: 0.6,
      max_leverage: 10,
      min_margin: 100,
      trigger_reason: 'TEST',
      status: 'ACTIVE',
      created_at: new Date().toISOString()
    };

    await dbManager.runQuery(`
      INSERT INTO simulations (symbol, entry_price, stop_loss_price, take_profit_price, 
                              max_leverage, min_margin, trigger_reason, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      simulation.symbol,
      simulation.entry_price,
      simulation.stop_loss_price,
      simulation.take_profit_price,
      simulation.max_leverage,
      simulation.min_margin,
      simulation.trigger_reason,
      simulation.status,
      simulation.created_at
    ]);

    dataMonitor.recordSimulation(simulation.symbol, 'START', simulation, true);

    // 2. 验证同步性
    const dbCount = await dbManager.runQuery('SELECT COUNT(*) as count FROM simulations');
    const monitoringData = dataMonitor.getMonitoringDashboard();

    expect(dbCount[0].count).toBe(1);
    expect(monitoringData.detailedStats.find(s => s.symbol === 'ADAUSDT').simulationCompletion.triggers).toBe(1);

    // 3. 完成模拟交易
    dataMonitor.recordSimulation(simulation.symbol, 'COMPLETED', {
      simulationId: 1,
      exitReason: 'STOP_LOSS',
      isWin: false,
      profitLoss: -50
    }, true);

    // 4. 验证完成统计
    const updatedMonitoring = dataMonitor.getMonitoringDashboard();
    const adaStats = updatedMonitoring.detailedStats.find(s => s.symbol === 'ADAUSDT');

    expect(adaStats.simulationCompletion.triggers).toBe(1);
    expect(adaStats.simulationCompletion.completions).toBe(1);
    expect(adaStats.simulationCompletion.rate).toBe(100);
  });
});
