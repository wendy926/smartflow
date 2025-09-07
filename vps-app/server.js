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

        // 获取用户设置的最大损失金额
        const maxLossAmount = await this.db.getUserSetting('maxLossAmount', 100);

        for (const symbol of symbols) {
          try {
            // 只更新信号和执行数据，不重新计算趋势数据
            const analysis = await SmartFlowStrategy.analyzeAll(symbol, parseFloat(maxLossAmount));

            // 获取数据采集成功率
            let dataCollectionRate = 0;
            if (this.dataMonitor && this.dataMonitor.symbolStats) {
              const stats = this.dataMonitor.symbolStats.get(symbol);
              if (stats) {
                dataCollectionRate = stats.dataCollectionAttempts > 0 ?
                  (stats.dataCollectionSuccesses / stats.dataCollectionAttempts) * 100 : 0;
              }
            }

            // 存储策略分析结果到数据库
            try {
              await this.db.recordStrategyAnalysis(analysis);
            } catch (dbError) {
              console.error(`存储 ${symbol} 策略分析结果失败:`, dbError);
            }

            signals.push({
              symbol,
              // 使用新的策略分析结果结构
              trend: analysis.trend,
              trendStrength: analysis.trendStrength,
              signal: analysis.signal,
              signalStrength: analysis.signalStrength,
              hourlyScore: analysis.hourlyScore,
              execution: analysis.execution,
              executionMode: analysis.executionMode,
              modeA: analysis.modeA,
              modeB: analysis.modeB,
              entrySignal: analysis.entrySignal,
              stopLoss: analysis.stopLoss,
              takeProfit: analysis.takeProfit,
              currentPrice: analysis.currentPrice,
              dataCollectionRate: Math.round(dataCollectionRate),
              // 交易执行详情
              maxLeverage: analysis.maxLeverage,
              minMargin: analysis.minMargin,
              stopLossDistance: analysis.stopLossDistance,
              atrValue: analysis.atrValue,
              // 详细分析数据
              dailyTrend: analysis.dailyTrend,
              hourlyConfirmation: analysis.hourlyConfirmation,
              execution15m: analysis.execution15m
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

    // 刷新所有信号（不包含趋势数据）
    this.app.post('/api/refresh-all', async (req, res) => {
      try {
        const symbols = await this.db.getCustomSymbols();

        // 获取用户设置的最大损失金额
        const maxLossAmount = await this.db.getUserSetting('maxLossAmount', 100);

        for (const symbol of symbols) {
          try {
            // 只更新信号和执行数据，不更新趋势数据
            const analysis = await SmartFlowStrategy.analyzeAll(symbol, parseFloat(maxLossAmount));

            // 存储策略分析结果到数据库
            try {
              await this.db.recordStrategyAnalysis(analysis);
            } catch (dbError) {
              console.error(`存储 ${symbol} 策略分析结果失败:`, dbError);
            }
          } catch (error) {
            console.error(`刷新 ${symbol} 失败:`, error);
          }
        }

        // 检查并自动触发模拟交易
        await this.checkAndAutoTriggerSimulation();

        res.json({ success: true, message: '所有信号已刷新（趋势数据保持4小时更新周期）' });
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

    // 启动模拟交易
    this.app.post('/api/simulation/start', async (req, res) => {
      try {
        const { symbol, entryPrice, stopLoss, takeProfit, maxLeverage, minMargin, executionMode, direction, stopLossDistance, atrValue } = req.body;

        if (!symbol || !entryPrice || !stopLoss || !takeProfit) {
          return res.status(400).json({ error: '缺少必要参数' });
        }

        const simulation = await this.simulationManager.createSimulation(
          symbol,
          entryPrice,
          stopLoss,
          takeProfit,
          maxLeverage || 10,
          minMargin || 100,
          `SIGNAL_${executionMode}_${direction}`,
          stopLossDistance || null,
          atrValue || null
        );

        // 记录到数据监控
        if (this.dataMonitor) {
          this.dataMonitor.recordSimulation(symbol, 'START', simulation, true);
        }

        res.json({ success: true, simulation });
      } catch (error) {
        console.error('启动模拟交易失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 获取特定交易对的模拟交易历史
    this.app.get('/api/simulation/history/:symbol', async (req, res) => {
      try {
        const { symbol } = req.params;
        const history = await this.simulationManager.getSimulationHistory(50);
        const symbolHistory = history.filter(sim => sim.symbol === symbol);
        res.json(symbolHistory);
      } catch (error) {
        console.error('获取交易对模拟交易历史失败:', error);
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

    // 更新模拟交易状态
    this.app.post('/api/simulation/update-status', async (req, res) => {
      try {
        const { symbol, currentPrice } = req.body;
        if (!symbol || !currentPrice) {
          return res.status(400).json({ error: '缺少必要参数' });
        }

        const result = await this.simulationManager.updateSimulationStatus(symbol, currentPrice, this.dataMonitor);
        res.json({ success: true, updatedCount: result.activeCount });
      } catch (error) {
        console.error('更新模拟交易状态失败:', error);
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

    // 获取告警历史
    this.app.get('/api/alert-history', async (req, res) => {
      try {
        const { limit = 100, type } = req.query;
        const alerts = await this.db.getAlertHistory(parseInt(limit), type);
        res.json(alerts);
      } catch (error) {
        console.error('获取告警历史失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 解决告警
    this.app.post('/api/alert-resolve', async (req, res) => {
      try {
        const { alertId } = req.body;
        if (!alertId) {
          return res.status(400).json({ error: '缺少告警ID' });
        }
        await this.db.resolveAlert(alertId);
        res.json({ success: true });
      } catch (error) {
        console.error('解决告警失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 获取数据更新时间
    this.app.get('/api/update-times', async (req, res) => {
      try {
        const now = Date.now();
        const updateTimes = {
          trend: this.getNextTrendUpdateTime(),
          signal: this.getNextSignalUpdateTime(),
          execution: this.getNextExecutionUpdateTime()
        };
        res.json(updateTimes);
      } catch (error) {
        console.error('获取更新时间失败:', error);
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

    // 测试数据质量告警
    this.app.post('/api/test-data-quality-alert', async (req, res) => {
      try {
        const testMessage = `🚨 <b>SmartFlow 数据质量告警测试</b>\n\n📊 <b>系统概览：</b>\n• 总交易对: 3\n• 健康状态: 1\n• 警告状态: 2\n\n⚠️ <b>告警详情：</b>\n• 数据收集率: 85.5% ❌\n• 信号分析率: 92.3% ❌\n• 数据验证: ❌ 异常 (3个错误)\n• 数据质量: ❌ 异常 (2个问题)\n\n🔍 <b>数据验证错误：</b>\n• BTCUSDT: 日线K线数据无效\n• ETHUSDT: 小时K线数据无效\n• LINKUSDT: 24小时行情数据无效\n\n⚠️ <b>数据质量问题：</b>\n• BTCUSDT: 日线趋势分析失败 - 数据不足\n• ETHUSDT: 小时确认分析失败 - 资金费率数据无效\n\n🌐 <b>网页链接：</b>https://smart.aimaventop.com\n⏰ <b>告警时间：</b>${new Date().toLocaleString('zh-CN')}`;

        const result = await this.telegramNotifier.sendMessage(testMessage);
        res.json(result);
      } catch (error) {
        console.error('测试数据质量告警失败:', error);
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

    // 用户设置相关API
    this.app.get('/api/user-settings', async (req, res) => {
      try {
        const settings = await this.db.getAllUserSettings();
        res.json(settings);
      } catch (error) {
        console.error('获取用户设置失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/user-settings', async (req, res) => {
      try {
        const { key, value } = req.body;
        if (!key || value === undefined) {
          return res.status(400).json({ error: '缺少必要参数' });
        }

        const result = await this.db.setUserSetting(key, value);
        if (result.success) {
          res.json({ success: true, message: '设置保存成功' });
        } else {
          res.status(500).json({ error: result.error });
        }
      } catch (error) {
        console.error('保存用户设置失败:', error);
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

      // 同步模拟交易统计
      this.syncSimulationStats();

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
    // 趋势数据：每4小时更新一次（北京时间 00:00、04:00、08:00、12:00、16:00、20:00）
    this.trendInterval = setInterval(async () => {
      try {
        const symbols = await this.db.getCustomSymbols();
        console.log(`📈 开始更新趋势数据 ${symbols.length} 个交易对...`);

        for (const symbol of symbols) {
          try {
            await this.updateTrendData(symbol);
          } catch (error) {
            console.error(`趋势更新 ${symbol} 失败:`, error);
          }
        }

        console.log('✅ 趋势数据更新完成');
      } catch (error) {
        console.error('趋势数据更新失败:', error);
      }
    }, 4 * 60 * 60 * 1000); // 4小时

    // 信号数据：每1小时更新一次
    this.signalInterval = setInterval(async () => {
      try {
        const symbols = await this.db.getCustomSymbols();
        console.log(`📊 开始更新信号数据 ${symbols.length} 个交易对...`);

        for (const symbol of symbols) {
          try {
            await this.updateSignalData(symbol);
          } catch (error) {
            console.error(`信号更新 ${symbol} 失败:`, error);
          }
        }

        console.log('✅ 信号数据更新完成');
      } catch (error) {
        console.error('信号数据更新失败:', error);
      }
    }, 60 * 60 * 1000); // 1小时

    // 入场执行：每15分钟更新一次
    this.executionInterval = setInterval(async () => {
      try {
        const symbols = await this.db.getCustomSymbols();
        console.log(`⚡ 开始更新入场执行数据 ${symbols.length} 个交易对...`);

        for (const symbol of symbols) {
          try {
            await this.updateExecutionData(symbol);
          } catch (error) {
            console.error(`执行更新 ${symbol} 失败:`, error);
          }
        }

        console.log('✅ 入场执行数据更新完成');
      } catch (error) {
        console.error('入场执行数据更新失败:', error);
      }
    }, 15 * 60 * 1000); // 15分钟

    // 模拟交易状态监控：每5分钟检查一次
    this.simulationInterval = setInterval(async () => {
      try {
        const symbols = await this.db.getCustomSymbols();
        console.log(`🔍 开始监控模拟交易状态 ${symbols.length} 个交易对...`);

        for (const symbol of symbols) {
          try {
            // 获取当前价格
            const ticker = await BinanceAPI.getTicker(symbol);
            const currentPrice = parseFloat(ticker.lastPrice);

            // 更新模拟交易状态
            const result = await this.simulationManager.updateSimulationStatus(symbol, currentPrice, this.dataMonitor);
            if (result.activeCount > 0) {
              console.log(`📊 更新了 ${symbol} 的 ${result.activeCount} 个模拟交易状态`);
            }
            if (result.completedCount > 0) {
              console.log(`✅ 完成了 ${symbol} 的 ${result.completedCount} 个模拟交易`);
            }
          } catch (error) {
            console.error(`模拟交易监控 ${symbol} 失败:`, error);
          }
        }

        console.log('✅ 模拟交易状态监控完成');
      } catch (error) {
        console.error('模拟交易状态监控失败:', error);
      }
    }, 5 * 60 * 1000); // 5分钟

    // 立即执行一次完整分析
    this.performInitialAnalysis();
  }

  // 执行初始完整分析
  async performInitialAnalysis() {
    try {
      const symbols = await this.db.getCustomSymbols();
      console.log(`🚀 执行初始完整分析 ${symbols.length} 个交易对...`);

      // 获取用户设置的最大损失金额
      const maxLossAmount = await this.db.getUserSetting('maxLossAmount', 100);

      for (const symbol of symbols) {
        try {
          const analysis = await SmartFlowStrategy.analyzeAll(symbol, parseFloat(maxLossAmount));

          // 存储策略分析结果到数据库
          try {
            await this.db.recordStrategyAnalysis(analysis);
          } catch (dbError) {
            console.error(`存储 ${symbol} 策略分析结果失败:`, dbError);
          }
        } catch (error) {
          console.error(`初始分析 ${symbol} 失败:`, error);
        }
      }

      console.log('✅ 初始分析完成');
    } catch (error) {
      console.error('初始分析失败:', error);
    }
  }

  // 更新趋势数据（日线分析）- 使用完整分析流程
  async updateTrendData(symbol) {
    try {
      // 获取用户设置的最大损失金额
      const maxLossAmount = await this.db.getUserSetting('maxLossAmount', 100);
      const analysis = await SmartFlowStrategy.analyzeAll(symbol, parseFloat(maxLossAmount));

      // 存储策略分析结果到数据库
      try {
        await this.db.recordStrategyAnalysis(analysis);
      } catch (dbError) {
        console.error(`存储 ${symbol} 策略分析结果失败:`, dbError);
      }

      console.log(`📈 趋势更新完成 [${symbol}]: ${analysis.trend}`);
    } catch (error) {
      console.error(`趋势更新失败 [${symbol}]:`, error);
    }
  }

  // 更新信号数据（小时确认分析）- 使用完整分析流程
  async updateSignalData(symbol) {
    try {
      // 获取用户设置的最大损失金额
      const maxLossAmount = await this.db.getUserSetting('maxLossAmount', 100);
      const analysis = await SmartFlowStrategy.analyzeAll(symbol, parseFloat(maxLossAmount));

      // 存储策略分析结果到数据库
      try {
        await this.db.recordStrategyAnalysis(analysis);
      } catch (dbError) {
        console.error(`存储 ${symbol} 策略分析结果失败:`, dbError);
      }

      console.log(`📊 信号更新完成 [${symbol}]: 得分=${analysis.hourlyScore}, 信号=${analysis.signal}`);
    } catch (error) {
      console.error(`信号更新失败 [${symbol}]:`, error);
    }
  }

  // 更新入场执行数据（15分钟执行分析）- 使用完整分析流程
  async updateExecutionData(symbol) {
    try {
      // 获取用户设置的最大损失金额
      const maxLossAmount = await this.db.getUserSetting('maxLossAmount', 100);
      const analysis = await SmartFlowStrategy.analyzeAll(symbol, parseFloat(maxLossAmount));

      // 存储策略分析结果到数据库
      try {
        await this.db.recordStrategyAnalysis(analysis);
      } catch (dbError) {
        console.error(`存储 ${symbol} 策略分析结果失败:`, dbError);
      }

      console.log(`⚡ 执行更新完成 [${symbol}]: 执行=${analysis.execution}, 模式=${analysis.executionMode}`);
    } catch (error) {
      console.error(`执行更新失败 [${symbol}]:`, error);
    }
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

  async syncSimulationStats() {
    try {
      console.log('🔄 开始同步模拟交易统计...');
      await this.dataMonitor.syncSimulationStatsFromDB(this.db);
      console.log('✅ 模拟交易统计同步完成');
    } catch (error) {
      console.error('同步模拟交易统计失败:', error);
    }
  }

  /**
   * 检查并自动触发模拟交易
   * 当检测到新的入场执行信号时，自动启动模拟交易
   */
  async checkAndAutoTriggerSimulation() {
    try {
      console.log('🔍 开始检查自动触发模拟交易...');
      
      // 获取当前所有信号
      const signals = await this.getAllSignals();
      
      // 获取当前已触发的模拟交易记录
      const currentHistory = await this.simulationManager.getSimulationHistory();
      
      // 创建已触发信号的映射，基于交易对+执行信号类型
      const triggeredSignals = new Map();
      currentHistory.forEach(trade => {
        const key = `${trade.symbol}_${trade.trigger_reason}`;
        triggeredSignals.set(key, trade);
      });

      // 检查每个信号
      for (const signal of signals) {
        // 检查是否有入场执行信号
        if (signal.execution && (signal.execution.includes('做多_') || signal.execution.includes('做空_'))) {
          // 从execution中提取模式信息
          const isLong = signal.execution.includes('做多_');
          const mode = signal.execution.includes('模式A') ? '模式A' : '模式B';
          const direction = isLong ? 'LONG' : 'SHORT';
          
          // 创建与数据库中trigger_reason格式一致的键
          const signalKey = `${signal.symbol}_SIGNAL_${mode}_${direction}`;
          
          // 检查是否已经为这个特定的信号创建过模拟交易
          if (!triggeredSignals.has(signalKey)) {
            console.log(`🚀 检测到新的入场执行信号，自动启动模拟交易: ${signal.symbol} - ${signal.execution} (${signalKey})`);

            // 自动启动模拟交易
            await this.autoStartSimulation(signal);

            // 添加到已触发列表，避免重复触发相同的信号
            triggeredSignals.set(signalKey, { symbol: signal.symbol, execution: signal.execution });
          } else {
            console.log(`⏭️ 跳过已触发的信号: ${signal.symbol} - ${signal.execution} (${signalKey})`);
          }
        }
      }
      
      console.log('✅ 自动触发模拟交易检查完成');
    } catch (error) {
      console.error('自动触发模拟交易检查失败:', error);
    }
  }

  /**
   * 自动启动模拟交易
   */
  async autoStartSimulation(signalData) {
    try {
      const { symbol, execution, entrySignal, stopLoss, takeProfit, maxLeverage, minMargin, stopLossDistance, atrValue } = signalData;
      
      if (!symbol || !entrySignal || !stopLoss || !takeProfit) {
        console.log(`❌ 跳过 ${symbol}：缺少必要参数`);
        return;
      }

      // 确定执行模式和方向
      const isLong = execution.includes('做多_');
      const mode = execution.includes('模式A') ? '模式A' : '模式B';
      const direction = isLong ? 'LONG' : 'SHORT';
      const triggerReason = `SIGNAL_${mode}_${direction}`;

      // 创建模拟交易
      const simulationId = await this.simulationManager.createSimulation(
        symbol,
        entrySignal,
        stopLoss,
        takeProfit,
        maxLeverage || 10,
        minMargin || 100,
        triggerReason,
        stopLossDistance || null,
        atrValue || null
      );

      // 记录到数据监控
      if (this.dataMonitor) {
        this.dataMonitor.recordSimulation(symbol, 'START', { simulationId }, true);
      }

      console.log(`✅ 自动启动模拟交易成功: ${symbol} - ${execution} (ID: ${simulationId})`);
    } catch (error) {
      console.error(`自动启动模拟交易失败 ${signalData.symbol}:`, error);
    }
  }

  // 获取下次趋势更新时间（4小时周期）
  getNextTrendUpdateTime() {
    const now = new Date();
    const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // 转换为北京时间

    // 趋势更新时间为：00:00、04:00、08:00、12:00、16:00、20:00
    const updateHours = [0, 4, 8, 12, 16, 20];
    const currentHour = beijingTime.getHours();
    const currentMinute = beijingTime.getMinutes();

    // 找到下一个更新时间
    let nextHour = updateHours.find(hour => hour > currentHour || (hour === currentHour && currentMinute < 30));
    if (!nextHour) {
      // 如果今天没有更多更新时间，则明天00:00
      nextHour = 0;
      beijingTime.setDate(beijingTime.getDate() + 1);
    }

    beijingTime.setHours(nextHour, 0, 0, 0);
    return beijingTime.getTime() - (8 * 60 * 60 * 1000); // 转换回UTC时间
  }

  // 获取下次信号更新时间（1小时周期）
  getNextSignalUpdateTime() {
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    return nextHour.getTime();
  }

  // 获取下次执行更新时间（15分钟周期）
  getNextExecutionUpdateTime() {
    const now = new Date();
    const next15min = new Date(now);
    const currentMinute = next15min.getMinutes();
    const nextMinute = Math.ceil(currentMinute / 15) * 15;

    if (nextMinute >= 60) {
      next15min.setHours(next15min.getHours() + 1, 0, 0, 0);
    } else {
      next15min.setMinutes(nextMinute, 0, 0);
    }

    return next15min.getTime();
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
