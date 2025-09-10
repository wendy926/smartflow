#!/usr/bin/env node

// 内存优化版本的主服务器文件

const express = require('express');
const path = require('path');
const { DatabaseManager } = require('./modules/database/DatabaseManager');
const { MemoryOptimizedManager } = require('./modules/data/MemoryOptimizedManager');
const { MemoryMonitor } = require('./modules/monitoring/MemoryMonitor');
const { OptimizedDataMonitor } = require('./modules/monitoring/OptimizedDataMonitor');
const { SmartFlowStrategyV3 } = require('./modules/strategy/SmartFlowStrategyV3');
const { SimulationManager } = require('./modules/database/SimulationManager');
const { TelegramNotifier } = require('./modules/notifications/TelegramNotifier');

class MemoryOptimizedServer {
  constructor() {
    this.app = express();
    this.database = null;
    this.memoryManager = null;
    this.memoryMonitor = null;
    this.dataMonitor = null;
    this.strategy = null;
    this.simulationManager = null;
    this.notifier = null;
    
    // 内存优化配置
    this.memoryConfig = {
      maxMemoryUsage: 0.6, // 最大内存使用率60%
      warningThreshold: 0.5, // 警告阈值50%
      retentionMinutes: 15, // 数据保留15分钟
      cleanupInterval: 5 * 60 * 1000 // 5分钟清理一次
    };
    
    this.init();
  }

  async init() {
    try {
      console.log('🚀 启动内存优化版本服务器...');
      
      // 初始化数据库
      this.database = new DatabaseManager();
      await this.database.init();
      console.log('✅ 数据库初始化完成');

      // 初始化内存管理器
      this.memoryManager = new MemoryOptimizedManager(this.database);
      console.log('✅ 内存管理器初始化完成');

      // 初始化内存监控
      this.memoryMonitor = new MemoryMonitor({
        maxMemoryUsage: this.memoryConfig.maxMemoryUsage,
        warningThreshold: this.memoryConfig.warningThreshold
      });
      console.log('✅ 内存监控初始化完成');

      // 初始化数据监控（优化版本）
      this.dataMonitor = new OptimizedDataMonitor(this.database);
      console.log('✅ 数据监控初始化完成');

      // 初始化策略
      this.strategy = new SmartFlowStrategyV3();
      console.log('✅ 策略初始化完成');

      // 初始化模拟交易管理器
      this.simulationManager = new SimulationManager(this.database);
      console.log('✅ 模拟交易管理器初始化完成');

      // 初始化通知器
      this.notifier = new TelegramNotifier();
      console.log('✅ 通知器初始化完成');

      // 设置中间件
      this.setupMiddleware();
      
      // 设置路由
      this.setupRoutes();
      
      // 启动定期任务
      this.startPeriodicTasks();
      
      // 启动服务器
      const port = process.env.PORT || 8080;
      this.app.listen(port, () => {
        console.log(`🌐 服务器运行在端口 ${port}`);
        console.log(`📊 内存监控已启动，最大使用率: ${this.memoryConfig.maxMemoryUsage * 100}%`);
      });

    } catch (error) {
      console.error('❌ 服务器初始化失败:', error);
      process.exit(1);
    }
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'public')));
    
    // 内存使用中间件
    this.app.use((req, res, next) => {
      const memoryInfo = this.memoryMonitor.checkMemoryUsage();
      if (memoryInfo.status === 'CRITICAL') {
        return res.status(503).json({ error: '服务器内存不足，请稍后重试' });
      }
      next();
    });
  }

  setupRoutes() {
    // 健康检查
    this.app.get('/health', (req, res) => {
      const memoryInfo = this.memoryMonitor.checkMemoryUsage();
      const memoryStats = this.memoryManager.getMemoryStats();
      
      res.json({
        status: 'healthy',
        memory: memoryInfo,
        memoryStats: memoryStats,
        timestamp: new Date().toISOString()
      });
    });

    // 内存监控API
    this.app.get('/api/memory', (req, res) => {
      const report = this.memoryMonitor.getMemoryReport();
      res.json(report);
    });

    // 强制垃圾回收
    this.app.post('/api/memory/gc', (req, res) => {
      const success = this.memoryMonitor.forceGarbageCollection();
      res.json({ success, message: success ? '垃圾回收完成' : '垃圾回收不可用' });
    });

    // 清理内存缓存
    this.app.post('/api/memory/clear', (req, res) => {
      this.memoryManager.clearAllMemory();
      this.dataMonitor.clearAllMemory();
      res.json({ success: true, message: '内存缓存清理完成' });
    });

    // 获取内存使用统计
    this.app.get('/api/memory/stats', (req, res) => {
      const stats = this.memoryManager.getMemoryStats();
      const monitorStats = this.dataMonitor.getMemoryUsageStats();
      res.json({
        memoryManager: stats,
        dataMonitor: monitorStats,
        timestamp: new Date().toISOString()
      });
    });

    // 其他API路由...
    this.setupAPIRoutes();
  }

  setupAPIRoutes() {
    // 获取交易对列表
    this.app.get('/api/symbols', async (req, res) => {
      try {
        const symbols = await this.database.getCustomSymbols();
        res.json(symbols);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // 获取模拟交易历史
    this.app.get('/api/simulation-history', async (req, res) => {
      try {
        const history = await this.simulationManager.getSimulationHistory(50);
        res.json(history);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // 获取胜率统计
    this.app.get('/api/win-rate-stats', async (req, res) => {
      try {
        const stats = await this.simulationManager.getWinRateStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // 获取方向统计
    this.app.get('/api/direction-stats', async (req, res) => {
      try {
        const stats = await this.simulationManager.getDirectionStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // 获取交易对统计
    this.app.get('/api/symbol-stats', async (req, res) => {
      try {
        const stats = await this.simulationManager.getSymbolStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  startPeriodicTasks() {
    // 定期内存清理
    setInterval(() => {
      const memoryInfo = this.memoryMonitor.checkMemoryUsage();
      
      if (memoryInfo.status === 'HIGH' || memoryInfo.status === 'CRITICAL') {
        console.log('🧹 执行定期内存清理...');
        this.memoryManager.cleanExpiredData();
        this.dataMonitor.limitMemoryUsage();
        
        // 如果内存使用率仍然很高，强制垃圾回收
        if (memoryInfo.status === 'CRITICAL') {
          this.memoryMonitor.forceGarbageCollection();
        }
      }
    }, this.memoryConfig.cleanupInterval);

    // 定期内存监控报告
    setInterval(() => {
      const memoryInfo = this.memoryMonitor.checkMemoryUsage();
      const memoryStats = this.memoryManager.getMemoryStats();
      
      console.log(`📊 内存监控报告: ${memoryInfo.message}, 进程内存: ${memoryInfo.processMemory.rssMB.toFixed(1)}MB`);
      console.log(`📊 内存管理器统计: 聚合指标=${memoryStats.aggregatedMetrics}, 全局统计=${memoryStats.globalStats}, 活跃交易=${memoryStats.activeSimulations}`);
    }, 60 * 1000); // 每分钟报告一次
  }
}

// 启动服务器
if (require.main === module) {
  new MemoryOptimizedServer();
}

module.exports = { MemoryOptimizedServer };
