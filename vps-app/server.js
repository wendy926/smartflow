// server-new.js - 模块化服务器主文件

const express = require('express');
const path = require('path');
const cors = require('cors');

// 导入模块
const DatabaseManager = require('./modules/database/DatabaseManager');
const SimulationManager = require('./modules/database/SimulationManager');
const BinanceAPI = require('./modules/api/BinanceAPI');
const TelegramNotifier = require('./modules/notifications/TelegramNotifier');
const { SmartFlowStrategy } = require('./modules/strategy/SmartFlowStrategy');
const { DataMonitor } = require('./modules/monitoring/DataMonitor');

class SmartFlowServer {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 8080;
    this.db = null;
    this.simulationManager = null;
    this.telegramNotifier = null;
    this.dataMonitor = null;
    this.analysisInterval = null;

    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'public')));
  }

  setupRoutes() {
    // 主页路由
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // API路由
    this.setupAPIRoutes();
  }

  setupAPIRoutes() {
    // 获取所有信号
    this.app.get('/api/signals', async (req, res) => {
      try {
        const symbols = await this.db.getCustomSymbols();
        const signals = [];

        for (const symbol of symbols) {
          try {
            const analysis = await SmartFlowStrategy.analyzeAll(symbol);
            
            // 获取数据采集成功率
            let dataCollectionRate = 0;
            if (this.dataMonitor && this.dataMonitor.symbolStats) {
              const stats = this.dataMonitor.symbolStats.get(symbol);
              if (stats) {
                dataCollectionRate = stats.dataCollectionAttempts > 0 ? 
                  (stats.dataCollectionSuccesses / stats.dataCollectionAttempts) * 100 : 0;
              }
            }
            
            signals.push({
              symbol,
              trend: analysis.trend,
              signal: analysis.signal,
              execution: analysis.execution,
              currentPrice: analysis.currentPrice,
              vwap: analysis.hourlyConfirmation?.vwap || 0,
              volumeRatio: analysis.hourlyConfirmation?.volumeRatio || 0,
              oiChange: analysis.hourlyConfirmation?.oiChange || 0,
              fundingRate: analysis.hourlyConfirmation?.fundingRate || 0,
              cvd: analysis.hourlyConfirmation?.cvd?.direction || 'N/A',
              cvdValue: analysis.hourlyConfirmation?.cvd?.value || 0,
              cvdActive: analysis.hourlyConfirmation?.cvd?.isActive || false,
              priceVsVwap: analysis.hourlyConfirmation?.priceVsVwap || 0,
              dataCollectionRate: dataCollectionRate,
              // 新增的交易执行信息
              stopLoss: analysis.execution15m?.stopLoss || null,
              targetPrice: analysis.execution15m?.targetPrice || null,
              riskRewardRatio: analysis.execution15m?.riskRewardRatio || 0,
              maxLeverage: analysis.execution15m?.maxLeverage || 0,
              minMargin: analysis.execution15m?.minMargin || 0,
              manualConfirmation: analysis.execution15m?.manualConfirmation || false,
              setupHigh: analysis.execution15m?.setupHigh || 0,
              setupLow: analysis.execution15m?.setupLow || 0,
              atr: analysis.execution15m?.atr || 0
            });
          } catch (error) {
            console.error(`分析 ${symbol} 失败:`, error);
          }
        }

        res.json(signals);
      } catch (error) {
        console.error('获取信号失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 刷新所有信号
    this.app.post('/api/refresh-all', async (req, res) => {
      try {
        const symbols = await this.db.getCustomSymbols();

        for (const symbol of symbols) {
          try {
            await SmartFlowStrategy.analyzeAll(symbol);
          } catch (error) {
            console.error(`刷新 ${symbol} 失败:`, error);
          }
        }

        res.json({ success: true, message: '所有信号已刷新' });
      } catch (error) {
        console.error('刷新所有信号失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 添加交易对
    this.app.post('/api/add-symbol', async (req, res) => {
      try {
        const { symbol } = req.body;
        const result = await this.db.addCustomSymbol(symbol);
        res.json(result);
      } catch (error) {
        console.error('添加交易对失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 删除交易对
    this.app.post('/api/remove-symbol', async (req, res) => {
      try {
        const { symbol } = req.body;
        const result = await this.db.removeCustomSymbol(symbol);
        res.json(result);
      } catch (error) {
        console.error('删除交易对失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 获取所有交易对
    this.app.get('/api/symbols', async (req, res) => {
      try {
        const symbols = await this.db.getCustomSymbols();
        res.json(symbols);
      } catch (error) {
        console.error('获取交易对列表失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 获取模拟交易历史
    this.app.get('/api/simulation-history', async (req, res) => {
      try {
        const history = await this.simulationManager.getSimulationHistory();
        res.json(history);
      } catch (error) {
        console.error('获取模拟交易历史失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 获取胜率统计
    this.app.get('/api/win-rate-stats', async (req, res) => {
      try {
        const stats = await this.simulationManager.getWinRateStats();
        res.json(stats);
      } catch (error) {
        console.error('获取胜率统计失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 获取监控仪表板数据
    this.app.get('/api/monitoring-dashboard', async (req, res) => {
      try {
        const data = await this.dataMonitor.getMonitoringDashboard();
        res.json(data);
      } catch (error) {
        console.error('获取监控数据失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 获取健康检查数据
    this.app.get('/api/health-check', async (req, res) => {
      try {
        const health = this.dataMonitor.checkHealthStatus();
        res.json(health);
      } catch (error) {
        console.error('健康检查失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 设置监控阈值
    this.app.post('/api/monitoring-thresholds', async (req, res) => {
      try {
        const { thresholds } = req.body;
        this.dataMonitor.setAlertThresholds(thresholds);
        res.json({ success: true, message: '阈值设置成功' });
      } catch (error) {
        console.error('设置监控阈值失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 测试Telegram通知
    this.app.post('/api/test-telegram', async (req, res) => {
      try {
        const result = await this.telegramNotifier.sendMessage('🧪 SmartFlow 测试消息');
        res.json(result);
      } catch (error) {
        console.error('测试Telegram通知失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 测试监控告警
    this.app.post('/api/test-monitoring-alert', async (req, res) => {
      try {
        const testMessage = `🧪 <b>SmartFlow 监控告警测试</b>\n\n📊 <b>测试项目：</b>监控系统告警功能\n⚠️ <b>告警类型：</b>测试告警\n🔍 <b>详细信息：</b>这是一个测试监控告警消息\n\n🌐 <b>网页链接：</b>https://smart.aimaventop.com`;

        const result = await this.telegramNotifier.sendMessage(testMessage);
        res.json(result);
      } catch (error) {
        console.error('测试监控告警失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 手动触发告警检查
    this.app.post('/api/trigger-alert-check', async (req, res) => {
      try {
        console.log('🔍 手动触发告警检查...');
        await this.dataMonitor.checkAndSendAlerts(this.telegramNotifier);
        res.json({ success: true, message: '告警检查完成' });
      } catch (error) {
        console.error('手动告警检查失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 获取Telegram配置状态
    this.app.get('/api/telegram-config', async (req, res) => {
      try {
        const configured = !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
        res.json({ configured });
      } catch (error) {
        console.error('获取Telegram配置失败:', error);
        res.status(500).json({ error: error.message });
      }
    });
  }

  async initialize() {
    try {
      console.log('🚀 启动 SmartFlow 服务器...');

      // 初始化数据库
      this.db = new DatabaseManager();
      await this.db.init();
      console.log('✅ 数据库初始化完成');

      // 初始化模拟交易管理器
      this.simulationManager = new SimulationManager(this.db);
      this.simulationManager.startPriceMonitoring();
      console.log('✅ 模拟交易管理器启动');

      // 初始化Telegram通知
      this.telegramNotifier = new TelegramNotifier();
      console.log('✅ Telegram通知器初始化完成');

      // 初始化数据监控
      this.dataMonitor = new DataMonitor();
      // 将DataMonitor实例传递给SmartFlowStrategy
      SmartFlowStrategy.dataMonitor = this.dataMonitor;
      // 将数据库实例传递给DataMonitor
      this.dataMonitor.db = this.db;
      console.log('✅ 数据监控器初始化完成');

      // 启动定期分析
      this.startPeriodicAnalysis();

      // 启动定期告警检查
      this.startPeriodicAlerts();

      // 启动服务器
      this.app.listen(this.port, () => {
        console.log(`🌐 服务器运行在 http://localhost:${this.port}`);
        console.log(`📊 访问 http://localhost:${this.port} 查看仪表板`);
      });

    } catch (error) {
      console.error('❌ 服务器启动失败:', error);
      process.exit(1);
    }
  }

  startPeriodicAnalysis() {
    // 每5分钟分析一次所有交易对
    this.analysisInterval = setInterval(async () => {
      try {
        const symbols = await this.db.getCustomSymbols();
        console.log(`🔄 开始分析 ${symbols.length} 个交易对...`);

        for (const symbol of symbols) {
          try {
            await SmartFlowStrategy.analyzeAll(symbol);
          } catch (error) {
            console.error(`分析 ${symbol} 失败:`, error);
          }
        }

        console.log('✅ 分析完成');
      } catch (error) {
        console.error('定期分析失败:', error);
      }
    }, 300000); // 5分钟
  }

  startPeriodicAlerts() {
    // 每10分钟检查一次告警
    this.alertInterval = setInterval(async () => {
      try {
        console.log('🔍 开始检查告警...');
        await this.dataMonitor.checkAndSendAlerts(this.telegramNotifier);
        console.log('✅ 告警检查完成');
      } catch (error) {
        console.error('告警检查失败:', error);
      }
    }, 600000); // 10分钟
  }

  async shutdown() {
    console.log('🛑 正在关闭服务器...');

    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }

    if (this.alertInterval) {
      clearInterval(this.alertInterval);
    }

    if (this.simulationManager) {
      // 停止价格监控
      if (this.simulationManager.priceCheckInterval) {
        clearInterval(this.simulationManager.priceCheckInterval);
      }
    }

    if (this.db) {
      await this.db.close();
    }

    console.log('✅ 服务器已关闭');
    process.exit(0);
  }
}

// 创建并启动服务器
const server = new SmartFlowServer();

// 优雅关闭
process.on('SIGINT', () => server.shutdown());
process.on('SIGTERM', () => server.shutdown());

// 启动服务器
server.initialize();
