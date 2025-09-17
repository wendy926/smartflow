const express = require('express');
const path = require('path');
const DatabaseManager = require('./src/core/modules/database/DatabaseManager');

class QuickSmartFlowServer {
  constructor() {
    this.app = express();
    this.port = 8080;
    this.db = null;
  }

  async initialize() {
    try {
      console.log('🚀 快速启动 SmartFlow 服务器...');

      // 基本中间件
      this.app.use(express.json());
      this.app.use(express.static(path.join(__dirname, 'src/web/public')));

      // 初始化数据库（简化版）
      this.db = new DatabaseManager();
      await this.db.init();
      console.log('✅ 数据库初始化完成');

      // 基本路由
      this.setupBasicRoutes();

      // 启动服务器
      this.app.listen(this.port, () => {
        console.log(`🌐 服务器运行在 http://localhost:${this.port}`);
        console.log('✅ 快速启动完成');
      });

    } catch (error) {
      console.error('❌ 快速启动失败:', error);
      throw error;
    }
  }

  setupBasicRoutes() {
    // 主页路由
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'src/web/public/index.html'));
    });

    // 健康检查
    this.app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // 基本API接口
    this.setupBasicAPI();
  }

  setupBasicAPI() {
    // 获取信号数据
    this.app.get('/api/signals', async (req, res) => {
      try {
        const signals = await this.db.getSignals();
        res.json(signals || []);
      } catch (error) {
        res.json([]);
      }
    });

    // 获取胜率统计
    this.app.get('/api/win-rate-stats', async (req, res) => {
      try {
        const stats = await this.db.getWinRateStats();
        res.json(stats || { win_rate: 0, total_trades: 0 });
      } catch (error) {
        res.json({ win_rate: 0, total_trades: 0 });
      }
    });

    // 获取交易对
    this.app.get('/api/symbols', async (req, res) => {
      try {
        const symbols = await this.db.getSymbols();
        res.json(symbols || []);
      } catch (error) {
        res.json([
          { symbol: 'BTCUSDT', category: 'mainstream' },
          { symbol: 'ETHUSDT', category: 'mainstream' }
        ]);
      }
    });

    // 获取模拟交易历史
    this.app.get('/api/simulation-history', async (req, res) => {
      try {
        const history = await this.db.getSimulationHistory();
        res.json(history || []);
      } catch (error) {
        res.json([]);
      }
    });

    // 获取方向统计
    this.app.get('/api/direction-stats', async (req, res) => {
      try {
        const stats = await this.db.getDirectionStats();
        res.json(stats || { long: { total_trades: 0 }, short: { total_trades: 0 } });
      } catch (error) {
        res.json({
          long: { total_trades: 0, win_rate: 0, net_profit: 0 },
          short: { total_trades: 0, win_rate: 0, net_profit: 0 }
        });
      }
    });

    // 获取交易对统计
    this.app.get('/api/symbol-stats', async (req, res) => {
      try {
        const stats = await this.db.getSymbolStats();
        res.json(stats || []);
      } catch (error) {
        res.json([]);
      }
    });

    // 其他API请求的通用处理
    this.app.get('/api/*', (req, res) => {
      console.log('API请求:', req.path);
      res.json({
        message: '快速启动模式 - 基本功能可用',
        path: req.path,
        timestamp: new Date().toISOString()
      });
    });
  }
}

// 启动服务器
const server = new QuickSmartFlowServer();
server.initialize().catch(error => {
  console.error('服务器启动失败:', error);
  process.exit(1);
});
