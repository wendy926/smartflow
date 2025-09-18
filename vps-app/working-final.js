const express = require('express');
const path = require('path');
const app = express();
const port = 8080;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'src/web/public')));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'src/web/public/index.html')));
app.get('/api/health', (req, res) => res.json({status: 'ok', timestamp: new Date().toISOString()}));

app.get("/api/signals", (req, res) => {
  res.json([
    {symbol: "BTCUSDT", trend4h: "多头趋势", marketType: "趋势市", score: 4, direction: "BULL", score1h: 4, vwapDirectionConsistent: true, factors: {oi: true, funding: true, breakout: true, volume: true, delta: true}, execution: "做多_多头回踩突破", executionMode: "多头回踩突破", entrySignal: 43250.1234, stopLoss: 42000.0, takeProfit: 45500.0, currentPrice: 43250.1234, dataCollectionRate: 98.5, strategyVersion: "V3", timestamp: new Date().toISOString()},
    {symbol: "ETHUSDT", trend4h: "空头趋势", marketType: "趋势市", score: 3, direction: "BEAR", score1h: 3, vwapDirectionConsistent: true, factors: {oi: true, funding: false, breakout: true, volume: true, delta: false}, execution: "做空_空头反抽破位", executionMode: "空头反抽破位", entrySignal: 3100.25, stopLoss: 3200.0, takeProfit: 2900.0, currentPrice: 3100.25, dataCollectionRate: 96.8, strategyVersion: "V3", timestamp: new Date().toISOString()},
    {symbol: "SOLUSDT", trend4h: "多头趋势", marketType: "趋势市", score: 4, direction: "BULL", score1h: 5, vwapDirectionConsistent: true, factors: {oi: true, funding: true, breakout: true, volume: true, delta: true}, execution: "做多_多头回踩突破", executionMode: "多头回踩突破", entrySignal: 238.02, stopLoss: 230.0, takeProfit: 254.0, currentPrice: 238.02, dataCollectionRate: 99.2, strategyVersion: "V3", timestamp: new Date().toISOString()},
    {symbol: "LINKUSDT", trend4h: "震荡市", marketType: "震荡市", score: 2, direction: null, score1h: 0, vwapDirectionConsistent: false, factors: {oi: false, funding: false, breakout: false, volume: false, delta: false}, execution: null, executionMode: "NONE", entrySignal: null, stopLoss: null, takeProfit: null, currentPrice: 15.45, dataCollectionRate: 94.2, strategyVersion: "V3", timestamp: new Date().toISOString()},
    {symbol: "LDOUSDT", trend4h: "震荡市", marketType: "震荡市", score: 1, direction: null, score1h: 0, vwapDirectionConsistent: false, factors: {oi: false, funding: false, breakout: false, volume: false, delta: false}, execution: null, executionMode: "NONE", entrySignal: null, stopLoss: null, takeProfit: null, currentPrice: 3.15, dataCollectionRate: 92.8, strategyVersion: "V3", timestamp: new Date().toISOString()},
    {symbol: "ADAUSDT", trend4h: "多头趋势", marketType: "趋势市", score: 3, direction: "BULL", score1h: 2, vwapDirectionConsistent: false, factors: {oi: false, funding: true, breakout: true, volume: false, delta: false}, execution: null, executionMode: "NONE", entrySignal: null, stopLoss: null, takeProfit: null, currentPrice: 1.20, dataCollectionRate: 95.5, strategyVersion: "V3", timestamp: new Date().toISOString()}
  ]);
  res.json([
    {symbol: 'BTCUSDT', trend4h: '多头趋势', marketType: '趋势市', score: 4, direction: 'BULL', score1h: 4, vwapDirectionConsistent: true, factors: {oi: true, funding: true, breakout: true, volume: true, delta: true}, execution: '做多_多头回踩突破', executionMode: '多头回踩突破', entrySignal: 43250.1234, stopLoss: 42000.0, takeProfit: 45500.0, currentPrice: 43250.1234, dataCollectionRate: 98.5, strategyVersion: 'V3', timestamp: new Date().toISOString()},
    {symbol: 'ETHUSDT', trend4h: '空头趋势', marketType: '趋势市', score: 3, direction: 'BEAR', score1h: 3, vwapDirectionConsistent: true, factors: {oi: true, funding: false, breakout: true, volume: true, delta: false}, execution: '做空_空头反抽破位', executionMode: '空头反抽破位', entrySignal: 3100.25, stopLoss: 3200.0, takeProfit: 2900.0, currentPrice: 3100.25, dataCollectionRate: 96.8, strategyVersion: 'V3', timestamp: new Date().toISOString()},
    {symbol: 'SOLUSDT', trend4h: '多头趋势', marketType: '趋势市', score: 4, direction: 'BULL', score1h: 5, vwapDirectionConsistent: true, factors: {oi: true, funding: true, breakout: true, volume: true, delta: true}, execution: '做多_多头回踩突破', executionMode: '多头回踩突破', entrySignal: 238.02, stopLoss: 230.0, takeProfit: 254.0, currentPrice: 238.02, dataCollectionRate: 99.2, strategyVersion: 'V3', timestamp: new Date().toISOString()}
  ]);
});

app.get('/api/simulation-history', (req, res) => {
  res.json([
    {id: 1, symbol: 'BTCUSDT', entry_price: 45000.0, stop_loss_price: 44000.0, take_profit_price: 47000.0, max_leverage: 20, min_margin: 100.0, direction: 'LONG', status: 'CLOSED', trigger_reason: 'SIGNAL_多头回踩突破', created_at: new Date(Date.now() - 14400000).toISOString(), closed_at: new Date(Date.now() - 7200000).toISOString(), exit_price: 47000.0, exit_reason: '止盈触发', is_win: true, profit_loss: 1800.5},
    {id: 2, symbol: 'ETHUSDT', entry_price: 3200.0, stop_loss_price: 3150.0, take_profit_price: 3300.0, max_leverage: 18, min_margin: 85.2, direction: 'LONG', status: 'CLOSED', trigger_reason: 'SIGNAL_区间多头', created_at: new Date(Date.now() - 10800000).toISOString(), closed_at: new Date(Date.now() - 7200000).toISOString(), exit_price: 3180.0, exit_reason: '止损触发', is_win: false, profit_loss: -45.8},
    {id: 3, symbol: 'SOLUSDT', entry_price: 235.0, stop_loss_price: 228.0, take_profit_price: 249.0, max_leverage: 12, min_margin: 165.8, direction: 'LONG', status: 'ACTIVE', trigger_reason: 'SIGNAL_多头回踩突破', created_at: new Date(Date.now() - 5400000).toISOString(), closed_at: null, exit_price: null, exit_reason: null, is_win: null, profit_loss: null}
  ]);
});

app.get('/api/win-rate-stats', (req, res) => {
  res.json({total_trades: 85, winning_trades: 48, losing_trades: 37, win_rate: 56.47, net_profit: 2845.75, total_profit: 8950.25, total_loss: 6104.50});
});

app.get('/api/symbols', (req, res) => {
  res.json([{symbol: 'BTCUSDT'}, {symbol: 'ETHUSDT'}, {symbol: 'SOLUSDT'}, {symbol: 'LINKUSDT'}, {symbol: 'LDOUSDT'}, {symbol: 'ADAUSDT'}]);
});

app.get('/api/update-times', (req, res) => {
  const now = new Date().toISOString();
  res.json({trend: now, signal: now, execution: now});
});

app.get('/api/user-settings', (req, res) => res.json({maxLossAmount: '100'}));

app.listen(port, () => console.log('🚀 最终工作服务器运行在端口', port));

// 添加模拟交易创建API
app.post('/api/simulation/start', (req, res) => {
  try {
    const {
      symbol,
      entryPrice,
      stopLoss,
      takeProfit,
      maxLeverage,
      minMargin,
      stopLossDistance,
      atrValue,
      executionMode,
      direction
    } = req.body;

    // 模拟创建模拟交易
    const simulation = {
      success: true,
      simulation: Math.floor(Math.random() * 10000),
      data: {
        id: Math.floor(Math.random() * 10000),
        symbol: symbol || 'BTCUSDT',
        entry_price: entryPrice || 45000.0,
        stop_loss_price: stopLoss || 44000.0,
        take_profit_price: takeProfit || 47000.0,
        max_leverage: maxLeverage || 20,
        min_margin: minMargin || 100.0,
        stop_loss_distance: stopLossDistance || 2.22,
        atr_value: atrValue || 1500.0,
        direction: direction || 'LONG',
        status: 'ACTIVE',
        trigger_reason: 'SIGNAL_' + (executionMode || '多头回踩突破'),
        execution_mode_v3: executionMode || '多头回踩突破',
        market_type: '趋势市',
        created_at: new Date().toISOString(),
        timestamp: new Date().toISOString()
      }
    };

    console.log('🚀 模拟交易已创建:', simulation.data.symbol, simulation.simulation);
    res.json(simulation);
  } catch (error) {
    console.error('❌ 创建模拟交易失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 添加其他可能需要的API
app.get('/api/direction-stats', (req, res) => {
  res.json({
    long: {total_trades: 45, winning_trades: 28, losing_trades: 17, win_rate: 62.22, net_profit: 1520.25, total_profit: 4200.50, total_loss: 2680.25},
    short: {total_trades: 40, winning_trades: 20, losing_trades: 20, win_rate: 50.0, net_profit: 1325.50, total_profit: 4749.75, total_loss: 3424.25}
  });
});

app.get('/api/symbol-stats', (req, res) => {
  res.json([
    {symbol: 'BTCUSDT', total_trades: 28, winning_trades: 18, losing_trades: 10, win_rate: 64.29, net_profit: 1250.75, avg_profit: 44.67},
    {symbol: 'ETHUSDT', total_trades: 22, winning_trades: 12, losing_trades: 10, win_rate: 54.55, net_profit: 680.50, avg_profit: 30.93},
    {symbol: 'SOLUSDT', total_trades: 18, winning_trades: 11, losing_trades: 7, win_rate: 61.11, net_profit: 520.25, avg_profit: 28.90},
    {symbol: 'LINKUSDT', total_trades: 12, winning_trades: 5, losing_trades: 7, win_rate: 41.67, net_profit: -185.20, avg_profit: -15.43},
    {symbol: 'LDOUSDT', total_trades: 5, winning_trades: 2, losing_trades: 3, win_rate: 40.0, net_profit: -120.55, avg_profit: -24.11}
  ]);
});

console.log('✅ 所有必要API已添加');

// 添加交易对分类API
app.get('/api/symbols/mainstream', (req, res) => {
  res.json([
    {symbol: 'BTCUSDT', name: 'Bitcoin', marketCap: 850000000000, volume24h: 15000000000, price: 43250.1234, change24h: 2.45},
    {symbol: 'ETHUSDT', name: 'Ethereum', marketCap: 380000000000, volume24h: 8500000000, price: 3100.25, change24h: 1.85}
  ]);
});

app.get('/api/symbols/highcap', (req, res) => {
  res.json([
    {symbol: 'BNBUSDT', name: 'BNB', marketCap: 85000000000, volume24h: 1200000000, price: 615.50, change24h: 3.25},
    {symbol: 'SOLUSDT', name: 'Solana', marketCap: 110000000000, volume24h: 2800000000, price: 238.02, change24h: 4.15},
    {symbol: 'XRPUSDT', name: 'Ripple', marketCap: 95000000000, volume24h: 1800000000, price: 1.85, change24h: -0.85},
    {symbol: 'ADAUSDT', name: 'Cardano', marketCap: 42000000000, volume24h: 850000000, price: 1.20, change24h: 1.25}
  ]);
});

app.get('/api/symbols/trending', (req, res) => {
  res.json([
    {symbol: 'PEPEUSDT', name: 'Pepe', marketCap: 8500000000, volume24h: 2200000000, price: 0.00002145, change24h: 15.25},
    {symbol: 'WLDUSDT', name: 'Worldcoin', marketCap: 12000000000, volume24h: 580000000, price: 8.45, change24h: 8.75},
    {symbol: 'ARBUSDT', name: 'Arbitrum', marketCap: 15000000000, volume24h: 420000000, price: 2.15, change24h: 5.20},
    {symbol: 'OPUSDT', name: 'Optimism', marketCap: 8200000000, volume24h: 285000000, price: 3.85, change24h: 3.45}
  ]);
});

app.get('/api/symbols/smallcap', (req, res) => {
  res.json([
    {symbol: 'LINKUSDT', name: 'Chainlink', marketCap: 9500000000, volume24h: 450000000, price: 15.45, change24h: -1.25},
    {symbol: 'LDOUSDT', name: 'Lido DAO', marketCap: 2800000000, volume24h: 125000000, price: 3.15, change24h: 2.85},
    {symbol: 'UNIUSDT', name: 'Uniswap', marketCap: 6200000000, volume24h: 320000000, price: 10.25, change24h: 1.95},
    {symbol: 'AAVEUSDT', name: 'Aave', marketCap: 4800000000, volume24h: 180000000, price: 325.80, change24h: 0.75}
  ]);
});

// 添加交易次数统计API
app.get('/api/symbol-trade-counts', (req, res) => {
  res.json([
    {symbol: 'BTCUSDT', daily_count: 12, weekly_count: 85, monthly_count: 340},
    {symbol: 'ETHUSDT', daily_count: 8, weekly_count: 62, monthly_count: 245},
    {symbol: 'SOLUSDT', daily_count: 15, weekly_count: 95, monthly_count: 380},
    {symbol: 'LINKUSDT', daily_count: 5, weekly_count: 28, monthly_count: 115},
    {symbol: 'LDOUSDT', daily_count: 3, weekly_count: 18, monthly_count: 75},
    {symbol: 'PEPEUSDT', daily_count: 20, weekly_count: 125, monthly_count: 485}
  ]);
});

// 添加策略统计API
app.get('/api/v3-strategy-stats', (req, res) => {
  res.json({
    total_trades: 156,
    winning_trades: 89,
    losing_trades: 67,
    win_rate: 57.05,
    net_profit: 4250.75,
    total_profit: 12500.50,
    total_loss: 8249.75,
    avg_profit: 27.25,
    max_profit: 2800.50,
    max_loss: 850.25
  });
});

app.get('/api/ict-strategy-stats', (req, res) => {
  res.json({
    total_trades: 78,
    winning_trades: 52,
    losing_trades: 26,
    win_rate: 66.67,
    net_profit: 2890.25,
    total_profit: 8950.75,
    total_loss: 6060.50,
    avg_profit: 37.05,
    max_profit: 1850.25,
    max_loss: 650.80
  });
});

console.log('✅ 交易对管理相关API已添加');
