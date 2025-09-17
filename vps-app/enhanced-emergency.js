const express = require('express');
const path = require('path');

const app = express();
const port = 8080;

// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname, 'src/web/public')));

// 基本路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/web/public/index.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/web/public/index.html'));
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 模拟基本API接口
app.get('/api/signals', (req, res) => {
  res.json([
    { symbol: 'BTCUSDT', signal: 'BUY', timestamp: new Date().toISOString() },
    { symbol: 'ETHUSDT', signal: 'HOLD', timestamp: new Date().toISOString() }
  ]);
});

app.get('/api/win-rate-stats', (req, res) => {
  res.json({
    win_rate: 65.5,
    total_trades: 150,
    winning_trades: 98,
    losing_trades: 52,
    net_profit: 1250.75
  });
});

app.get('/api/symbols', (req, res) => {
  res.json([
    { symbol: 'BTCUSDT', category: 'mainstream' },
    { symbol: 'ETHUSDT', category: 'mainstream' },
    { symbol: 'ADAUSDT', category: 'highcap' },
    { symbol: 'SOLUSDT', category: 'highcap' },
    { symbol: 'DOGEUSDT', category: 'trending' }
  ]);
});

app.get('/api/simulations', (req, res) => {
  res.json([
    {
      id: 1,
      symbol: 'BTCUSDT',
      strategy: 'V3',
      direction: 'LONG',
      entry_price: 44500,
      status: 'ACTIVE',
      created_at: new Date().toISOString()
    }
  ]);
});

app.get('/api/simulation-history', (req, res) => {
  res.json([
    {
      id: 1,
      symbol: 'BTCUSDT',
      strategy: 'V3',
      direction: 'LONG',
      entry_price: 44500,
      exit_price: 45000,
      profit_loss: 500,
      is_win: true,
      status: 'CLOSED',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      closed_at: new Date().toISOString()
    }
  ]);
});

app.get('/api/direction-stats', (req, res) => {
  res.json({
    long: { total_trades: 80, win_rate: 67.5, net_profit: 850.25 },
    short: { total_trades: 70, win_rate: 63.2, net_profit: 400.50 }
  });
});

app.get('/api/symbol-stats', (req, res) => {
  res.json([
    { symbol: 'BTCUSDT', total_trades: 25, win_rate: 72.0, net_profit: 350.75 },
    { symbol: 'ETHUSDT', total_trades: 20, win_rate: 65.0, net_profit: 280.50 }
  ]);
});

// 捕获所有其他API请求
app.get('/api/*', (req, res) => {
  console.log('API请求:', req.path);
  res.json({ 
    message: '应急模式 - API功能有限',
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log(`🌐 增强应急服务器运行在 http://localhost:${port}`);
  console.log('✅ 基本API接口已启用');
});
