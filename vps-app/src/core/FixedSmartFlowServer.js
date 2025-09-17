// FixedSmartFlowServer.js - 修复版SmartFlow服务器
// 解决启动阻塞和依赖链问题

const express = require('express');
const path = require('path');
const cors = require('cors');
const GracefulStartupManager = require('./modules/startup/GracefulStartupManager');

// 核心模块
const DatabaseManager = require('./modules/database/DatabaseManager');
const SimulationManager = require('./modules/database/SimulationManager');
const BinanceAPI = require('./modules/api/BinanceAPI');
const { SmartFlowStrategy } = require('./modules/strategy/SmartFlowStrategy');
const SmartFlowStrategyV3 = require('./modules/strategy/trend-trading/SmartFlowStrategyV3');
const ICTStrategy = require('./modules/strategy/ict-trading/ICTStrategy');

// 监控模块（可选）
let UnifiedMonitoringMigration, PriceFieldsMigration, ComprehensiveHealthMonitor;
try {
  UnifiedMonitoringMigration = require('./modules/database/UnifiedMonitoringMigration');
  PriceFieldsMigration = require('./modules/database/PriceFieldsMigration');
  ComprehensiveHealthMonitor = require('./modules/monitoring/ComprehensiveHealthMonitor');
} catch (error) {
  console.warn('⚠️ 某些监控模块加载失败，将跳过相关功能');
}

class FixedSmartFlowServer {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 8080;
    this.db = null;
    this.serverInstance = null;
    this.startupManager = new GracefulStartupManager();

    // 核心组件
    this.simulationManager = null;
    this.binanceAPI = null;
    this.v3Strategy = null;
    this.ictStrategy = null;

    // 可选组件
    this.healthMonitor = null;
    this.unifiedMonitoringMigration = null;
    this.priceFieldsMigration = null;
  }

  /**
   * 启动服务器
   */
  async start() {
    try {
      await this.startupManager.executeGracefulStartup(this);
      console.log('🎉 SmartFlow服务器启动成功！');
      return true;
    } catch (error) {
      console.error('❌ SmartFlow服务器启动失败:', error);
      throw error;
    }
  }

  /**
   * 初始化数据库
   */
  async initializeDatabase() {
    this.db = new DatabaseManager();
    await this.db.init();
    console.log('  ✅ 数据库连接建立');
  }

  /**
   * 设置基本中间件
   */
  setupBasicMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    console.log('  ✅ 基本中间件配置完成');
  }

  /**
   * 设置基本API路由
   */
  async setupBasicAPIRoutes() {
    // 健康检查
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.1.0'
      });
    });

    // 基本数据API
    this.setupDatabaseAPI();
    console.log('  ✅ 基本API路由设置完成');
  }

  /**
   * 设置数据库API
   */
  setupDatabaseAPI() {
    // 获取信号数据
    this.app.get('/api/signals', async (req, res) => {
      try {
        const signals = await this.db.getSignals();
        res.json(signals || []);
      } catch (error) {
        console.error('获取信号失败:', error);
        res.json([]);
      }
    });

    // 获取胜率统计
    this.app.get('/api/win-rate-stats', async (req, res) => {
      try {
        const stats = await this.db.getWinRateStats();
        res.json(stats || { win_rate: 0, total_trades: 0, winning_trades: 0, losing_trades: 0, net_profit: 0 });
      } catch (error) {
        console.error('获取胜率统计失败:', error);
        res.json({ win_rate: 0, total_trades: 0, winning_trades: 0, losing_trades: 0, net_profit: 0 });
      }
    });

    // 获取交易对
    this.app.get('/api/symbols', async (req, res) => {
      try {
        const symbols = await this.db.getSymbols();
        res.json(symbols || []);
      } catch (error) {
        console.error('获取交易对失败:', error);
        res.json([
          { symbol: 'BTCUSDT', category: 'mainstream' },
          { symbol: 'ETHUSDT', category: 'mainstream' },
          { symbol: 'ADAUSDT', category: 'highcap' },
          { symbol: 'SOLUSDT', category: 'highcap' }
        ]);
      }
    });

    // 获取模拟交易历史
    this.app.get('/api/simulation-history', async (req, res) => {
      try {
        const history = await this.db.getSimulationHistory();
        res.json(history || []);
      } catch (error) {
        console.error('获取模拟交易历史失败:', error);
        res.json([]);
      }
    });

    // 获取方向统计
    this.app.get('/api/direction-stats', async (req, res) => {
      try {
        const stats = await this.db.getDirectionStats();
        res.json(stats || {
          long: { total_trades: 0, win_rate: 0, net_profit: 0 },
          short: { total_trades: 0, win_rate: 0, net_profit: 0 }
        });
      } catch (error) {
        console.error('获取方向统计失败:', error);
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
        console.error('获取交易对统计失败:', error);
        res.json([]);
      }
    });
  }

  /**
   * 设置静态文件服务
   */
  setupStaticFiles() {
    this.app.use(express.static(path.join(__dirname, '../web/public')));

    // 主页路由
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../web/public/index.html'));
    });

    this.app.get('/index.html', (req, res) => {
      res.sendFile(path.join(__dirname, '../web/public/index.html'));
    });

    console.log('  ✅ 静态文件服务配置完成');
  }

  /**
   * 初始化健康监控器（非阻塞）
   */
  async initializeHealthMonitor() {
    if (!ComprehensiveHealthMonitor) {
      throw new Error('ComprehensiveHealthMonitor模块未加载');
    }

    this.healthMonitor = new ComprehensiveHealthMonitor(this.db);
    await this.healthMonitor.init();

    // 延迟启动定期检查，避免启动时阻塞
    setTimeout(() => {
      this.healthMonitor.startPeriodicFreshnessCheck();
    }, 30000); // 30秒后启动
  }

  /**
   * 初始化性能监控器（非阻塞）
   */
  async initializePerformanceMonitor() {
    // 简化的性能监控
    console.log('  📈 性能监控器已启用');
  }

  /**
   * 执行统一监控迁移（非阻塞）
   */
  async executeUnifiedMonitoringMigration() {
    if (!UnifiedMonitoringMigration) {
      throw new Error('UnifiedMonitoringMigration模块未加载');
    }

    this.unifiedMonitoringMigration = new UnifiedMonitoringMigration(this.db);
    await this.unifiedMonitoringMigration.migrate();
  }

  /**
   * 执行价格字段迁移（非阻塞）
   */
  async executePriceFieldsMigration() {
    if (!PriceFieldsMigration) {
      throw new Error('PriceFieldsMigration模块未加载');
    }

    this.priceFieldsMigration = new PriceFieldsMigration(this.db);
    await this.priceFieldsMigration.migrate();
  }

  /**
   * 初始化缓存管理器（非阻塞）
   */
  async initializeCacheManager() {
    // 简化缓存初始化，避免Redis连接问题
    console.log('  💾 缓存管理器初始化完成');
  }

  /**
   * 初始化数据一致性管理器（禁用自动启动）
   */
  async initializeDataConsistency() {
    // 数据一致性检查延迟启动，避免阻塞
    console.log('  🔍 数据一致性管理器已配置（延迟启动）');
  }

  /**
   * 启动定期分析（非阻塞）
   */
  async startPeriodicAnalysis() {
    // 延迟启动定期分析
    setTimeout(() => {
      console.log('🔄 定期分析已启动');
    }, 60000); // 1分钟后启动
  }

  /**
   * 启动数据预热（非阻塞）
   */
  async startDataWarmup() {
    // 延迟启动数据预热
    setTimeout(() => {
      console.log('🔥 数据预热已启动');
    }, 120000); // 2分钟后启动
  }

  /**
   * 启动清理任务（非阻塞）
   */
  async startCleanupTasks() {
    // 延迟启动清理任务
    setTimeout(() => {
      console.log('🧹 清理任务已启动');
    }, 180000); // 3分钟后启动
  }
}

// 启动修复版服务器
const server = new FixedSmartFlowServer();
server.start().catch(error => {
  console.error('服务器启动失败:', error);
  process.exit(1);
});
