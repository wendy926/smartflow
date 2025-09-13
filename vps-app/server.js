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
const SmartFlowStrategyV3 = require('./modules/strategy/SmartFlowStrategyV3');
const StrategyV3Migration = require('./modules/database/StrategyV3Migration');
const { DataMonitor } = require('./modules/monitoring/DataMonitor');
const { dataLayerIntegration } = require('./modules/data/DataLayerIntegration');
const DeltaManager = require('./modules/data/DeltaManager');
const { MemoryMiddleware } = require('./modules/middleware/MemoryMiddleware');
const { DatabaseSchemaUpdater } = require('./modules/database/DatabaseSchemaUpdater');
const DataRefreshManager = require('./modules/data/DataRefreshManager');
const DatabaseOptimization = require('./modules/database/DatabaseOptimization');
const CacheManager = require('./modules/cache/CacheManager');
const CacheMiddleware = require('./modules/middleware/CacheMiddleware');
const PerformanceMonitor = require('./modules/monitoring/PerformanceMonitor');

class SmartFlowServer {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 8080;
    this.db = null;
    this.simulationManager = null;
    this.telegramNotifier = null;
    this.dataMonitor = null;
    this.deltaManager = null;
    this.analysisInterval = null;
    this.memoryMiddleware = new MemoryMiddleware({
      maxMemoryUsage: 0.95, // 95%最大使用率
      warningThreshold: 0.90 // 90%警告阈值
    });

    // 新增组件
    this.databaseOptimization = null;
    this.cacheManager = null;
    this.cacheMiddleware = null;
    this.performanceMonitor = new PerformanceMonitor();

    // 内存管理
    this.timers = new Set();
    this.connections = new Set();
    this.cleanupInterval = null;

    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());

    // 静态文件服务，禁用缓存
    this.app.use(express.static(path.join(__dirname, 'public'), {
      setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    }));

    // 添加内存监控中间件
    this.app.use(this.memoryMiddleware.middleware());

    // 添加性能监控中间件
    this.app.use((req, res, next) => {
      const startTime = Date.now();

      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        const success = res.statusCode >= 200 && res.statusCode < 400;
        this.performanceMonitor.recordRequest(success, responseTime);
      });

      next();
    });
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
    // 获取交易对列表（轻量级，不执行完整分析）
    this.app.get('/api/symbols', async (req, res) => {
      try {
        const symbols = await this.db.getCustomSymbols();
        res.json(symbols.map(symbol => ({ symbol })));
      } catch (error) {
        console.error('获取交易对列表失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 获取所有信号 - V3策略（添加缓存）
    this.app.get('/api/signals', this.cacheMiddleware ? this.cacheMiddleware.cacheGet('signals', 60) : (req, res, next) => next(), async (req, res) => {
      try {
        const symbols = await this.db.getCustomSymbols();
        const signals = [];

        // 获取用户设置的最大损失金额
        const maxLossAmount = await this.db.getUserSetting('maxLossAmount', 100);

        for (const symbol of symbols) {
          try {
            // 开始分析监控
            if (this.dataMonitor) {
              this.dataMonitor.startAnalysis(symbol);
            }

            // 使用V3策略进行分析
            const analysis = await SmartFlowStrategyV3.analyzeSymbol(symbol, {
        database: this.db,
        maxLossAmount: parseFloat(maxLossAmount),
        dataRefreshManager: this.dataRefreshManager
      });

            // 检查分析是否成功（数据是否充足）
            const isDataSufficient = !analysis.reason || !analysis.reason.includes('数据不足');
            const isAnalysisSuccessful = !!(analysis && (analysis.trend4h || analysis.signal || analysis.execution));

            // 存储到监控系统用于数据验证 - 根据实际结果记录分析日志
            if (this.dataMonitor) {
              this.dataMonitor.recordAnalysisLog(symbol, {
                success: isAnalysisSuccessful,
                symbol,
                strategyVersion: 'V3', // 明确设置策略版本
                phases: {
                  dataCollection: { success: isDataSufficient },
                  signalAnalysis: { success: isAnalysisSuccessful },
                  simulationTrading: { success: isAnalysisSuccessful }
                },
                trend: analysis.trend4h,
                signal: analysis.signal,
                execution: analysis.execution,
                executionMode: analysis.executionMode,
                hourlyScore: analysis.score1h,
                modeA: analysis.modeA,
                modeB: analysis.modeB
              });
            }

            // 获取数据采集成功率 - 使用Binance API成功率
            let dataCollectionRate = 0;
            try {
              const BinanceAPI = require('./modules/api/BinanceAPI');
              const realtimeStats = BinanceAPI.getRealTimeStats();
              dataCollectionRate = realtimeStats.global.successRate;
            } catch (error) {
              console.warn('获取Binance API成功率失败:', error.message);
              // 降级到监控数据
              if (this.dataMonitor && this.dataMonitor.completionRates) {
                dataCollectionRate = this.dataMonitor.completionRates.dataCollection;
              }
            }

            // 数据采集率现在基于实际的数据采集成功状态计算
            // 如果数据不足，dataCollection.success 已经是 false，数据采集率会自动为0

            // 存储策略分析结果到数据库
            try {
              await this.db.recordStrategyAnalysis(analysis);
            } catch (dbError) {
              console.error(`存储 ${symbol} 策略分析结果失败:`, dbError);
            }

            // 调试：打印V3策略返回的数据结构
            console.log(`🔍 V3策略返回数据 [${symbol}]:`, {
              score1h: analysis.score1h,
              vwapDirectionConsistent: analysis.vwapDirectionConsistent,
              factors: analysis.factors,
              marketType: analysis.marketType
            });


            // 获取交易对分类
            let category = 'smallcap'; // 默认分类
            try {
              const categoryResult = await this.db.getSymbolCategory(symbol);
              if (categoryResult && categoryResult.category) {
                category = categoryResult.category;
              }
            } catch (error) {
              console.warn(`获取 ${symbol} 分类失败:`, error.message);
            }

            signals.push({
              symbol,
              category, // 添加分类信息
              // V3策略分析结果结构
              trend4h: analysis.trend4h,
              marketType: analysis.marketType,
              trend: analysis.trend4h, // 保持向后兼容
              trendStrength: analysis.trendStrength || (analysis.trendConfirmed ? '强' : '弱'),
              signal: analysis.signal,
              signalStrength: analysis.signalStrength || (analysis.score1h >= 3 ? '强' : '弱'),
              hourlyScore: analysis.score1h,
              execution: analysis.execution,
              executionMode: analysis.executionMode,
              entrySignal: analysis.entrySignal,
              stopLoss: analysis.stopLoss,
              takeProfit: analysis.takeProfit,
              currentPrice: analysis.currentPrice,
              dataCollectionRate: Math.round(dataCollectionRate * 10) / 10, // 保留一位小数
              // V3新增字段
              score1h: analysis.score1h, // 添加score1h字段
              vwapDirectionConsistent: analysis.vwapDirectionConsistent,
              factors: analysis.factors,
              vwap: analysis.vwap,
              vol15mRatio: analysis.vol15mRatio,
              vol1hRatio: analysis.vol1hRatio,
              oiChange6h: analysis.oiChange6h,
              fundingRate: analysis.fundingRate,
              deltaImbalance: analysis.deltaImbalance,
              // 震荡市字段
              rangeLowerBoundaryValid: analysis.rangeLowerBoundaryValid,
              rangeUpperBoundaryValid: analysis.rangeUpperBoundaryValid,
              bbUpper: analysis.bbUpper,
              bbMiddle: analysis.bbMiddle,
              bbLower: analysis.bbLower,
              // 技术指标
              ma20: analysis.ma20,
              ma50: analysis.ma50,
              ma200: analysis.ma200,
              adx14: analysis.adx14,
              bbw: analysis.bbw,
              setupCandleHigh: analysis.setupCandleHigh,
              setupCandleLow: analysis.setupCandleLow,
              atr14: analysis.atr14,
              // 4H趋势打分字段
              score: analysis.score,
              direction: analysis.direction,
              bullScore: analysis.bullScore,
              bearScore: analysis.bearScore,
              reason: analysis.reason,
              strategyVersion: 'V3'
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
            const analysis = await SmartFlowStrategyV3.analyzeSymbol(symbol, {
        database: this.db,
        maxLossAmount: parseFloat(maxLossAmount),
        dataRefreshManager: this.dataRefreshManager
      });

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

        // 检查Binance合约可用性
        console.log(`🔍 检查交易对 ${symbol} 的Binance合约可用性...`);
        const isAvailable = await SymbolCategoryManager.contractChecker.isContractAvailable(symbol);

        if (!isAvailable) {
          return res.json({
            success: false,
            message: `交易对 ${symbol} 在Binance期货中不可用，请选择其他交易对`
          });
        }

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

    // 获取所有模拟交易历史（无限制）
    this.app.get('/api/simulation-history-all', async (req, res) => {
      try {
        const history = await this.simulationManager.getSimulationHistory(-1);
        res.json(history);
      } catch (error) {
        console.error('获取所有模拟交易历史失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 获取分页模拟交易历史
    this.app.get('/api/simulation-history-paginated', async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const result = await this.simulationManager.getSimulationHistoryPaginated(page, pageSize);
        res.json(result);
      } catch (error) {
        console.error('获取分页模拟交易历史失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 获取方向统计
    this.app.get('/api/direction-stats', async (req, res) => {
      try {
        const stats = await this.simulationManager.getDirectionStats();
        res.json(stats);
      } catch (error) {
        console.error('获取方向统计失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 获取交易对统计
    this.app.get('/api/symbol-stats', async (req, res) => {
      try {
        const stats = await this.simulationManager.getSymbolStats();
        res.json(stats);
      } catch (error) {
        console.error('获取交易对统计失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 获取出场原因统计
    this.app.get('/api/exit-reason-stats', async (req, res) => {
      try {
        const stats = await this.simulationManager.getExitReasonStats();
        res.json(stats);
      } catch (error) {
        console.error('获取出场原因统计失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 获取交易对模拟交易次数统计（每日和每周）
    this.app.get('/api/symbol-trade-counts', async (req, res) => {
      try {
        const counts = await this.simulationManager.getSymbolTradeCounts();
        res.json(counts);
      } catch (error) {
        console.error('获取交易对交易次数失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 启动模拟交易
    this.app.post('/api/simulation/start', async (req, res) => {
      try {
        const { symbol, entryPrice, stopLoss, takeProfit, maxLeverage, minMargin, executionMode, direction, stopLossDistance, atrValue, atr14 } = req.body;

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
          `SIGNAL_${executionMode}`,
          stopLossDistance || null,
          atrValue || null,
          atr14 || null
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

    // 手动更新胜率统计（调试用）
    this.app.post('/api/update-win-rate-stats', async (req, res) => {
      try {
        await this.simulationManager.updateWinRateStats();
        const stats = await this.simulationManager.getWinRateStats();
        res.json({ success: true, stats });
      } catch (error) {
        console.error('更新胜率统计失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 获取Delta数据
    this.app.get('/api/delta-data', async (req, res) => {
      try {
        const { symbol } = req.query;
        if (symbol) {
          const deltaData = this.deltaManager.getDeltaData(symbol);
          res.json({ [symbol]: deltaData });
        } else {
          const allDeltaData = Object.fromEntries(this.deltaManager.getAllDeltaData());
          res.json(allDeltaData);
        }
      } catch (error) {
        console.error('获取Delta数据失败:', error);
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

        // 获取分析数据用于出场判断
        let analysisData = null;
        try {
          const analysisLog = this.dataMonitor.getAnalysisLog(symbol);
          if (analysisLog) {
            analysisData = {
              trend4h: analysisLog.phases?.trend4h,
              hourlyConfirmation: analysisLog.phases?.hourlyConfirmation,
              indicators: analysisLog.indicators,
              rawData: analysisLog.rawData,
              deltaData: this.deltaManager ? this.deltaManager.getDeltaData(symbol) : null
            };
          }
        } catch (error) {
          console.warn(`获取 ${symbol} 分析数据失败:`, error.message);
        }

        const result = await this.simulationManager.updateSimulationStatus(symbol, currentPrice, this.dataMonitor, analysisData);
        res.json({ success: true, updatedCount: result.activeCount });
      } catch (error) {
        console.error('更新模拟交易状态失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 获取监控仪表板数据（已合并到下面的路由中）

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

    // 清空数据验证错误
    this.app.post('/api/clear-validation-errors', async (req, res) => {
      try {
        if (this.dataMonitor && this.dataMonitor.validationSystem) {
          // 清空V3策略验证结果
          this.dataMonitor.validationSystem.clearValidationResults();

          // 清空数据质量问题
          if (this.dataMonitor.database) {
            await this.dataMonitor.database.run('DELETE FROM data_quality_issues');
          }

          // 清空数据库中的告警历史
          await this.db.run('DELETE FROM alert_history');
          console.log('✅ 数据库告警历史已清空');

          console.log('✅ V3策略数据验证错误已清空');
          res.json({ success: true, message: 'V3策略数据验证错误已清空' });
        } else {
          res.status(500).json({ success: false, message: '监控系统未初始化' });
        }
      } catch (error) {
        console.error('清空数据验证错误失败:', error);
        res.status(500).json({ success: false, message: '清空失败: ' + error.message });
      }
    });

    // 获取数据层健康检查
    this.app.get('/api/data-layer-health', async (req, res) => {
      try {
        const health = await dataLayerIntegration.healthCheck();
        res.json(health);
      } catch (error) {
        console.error('数据层健康检查失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 获取数据层状态
    this.app.get('/api/data-layer-status', async (req, res) => {
      try {
        const status = dataLayerIntegration.getSystemStatus();
        res.json(status);
      } catch (error) {
        console.error('获取数据层状态失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 获取数据刷新状态
    this.app.get('/api/data-refresh-status', async (req, res) => {
      try {
        const stats = await this.dataRefreshManager.getRefreshStats();
        const staleData = await this.dataRefreshManager.getStaleData();

        res.json({
          success: true,
          refreshStats: stats,
          staleDataCount: staleData.length,
          staleData: staleData.slice(0, 10) // 只返回前10个
        });
      } catch (error) {
        console.error('获取数据刷新状态失败:', error);
        res.status(500).json({ error: '获取数据刷新状态失败' });
      }
    });

    // 强制刷新指定数据类型
    this.app.post('/api/force-refresh', async (req, res) => {
      try {
        const { symbol, dataType } = req.body;

        if (!symbol || !dataType) {
          return res.status(400).json({ error: '缺少必要参数' });
        }

        // 更新刷新时间
        await this.dataRefreshManager.updateRefreshTime(symbol, dataType, 100);

        res.json({ success: true, message: `已强制刷新 ${symbol} 的 ${dataType} 数据` });
      } catch (error) {
        console.error('强制刷新失败:', error);
        res.status(500).json({ error: '强制刷新失败' });
      }
    });

    // 批量刷新所有过期数据
    this.app.post('/api/refresh-all-stale', async (req, res) => {
      try {
        const result = await this.dataRefreshManager.refreshAllStaleData();

        if (result.success) {
          res.json({
            success: true,
            message: `批量刷新完成: 成功 ${result.successCount} 个, 失败 ${result.failCount} 个`,
            total: result.total,
            successCount: result.successCount,
            failCount: result.failCount
          });
        } else {
          res.status(500).json({ error: result.error });
        }
      } catch (error) {
        console.error('批量刷新失败:', error);
        res.status(500).json({ error: '批量刷新失败' });
      }
    });


    
    // 获取监控中心数据 - 优化版本
    this.app.get('/api/monitoring-dashboard', async (req, res) => {
      try {
        const symbols = await this.db.getCustomSymbols();
        
        // 使用批量查询替代循环查询，大幅提升性能
        const [klineStats, analysisStats, alertStats] = await Promise.all([
          // 批量获取K线数据统计
          this.db.runQuery(`
            SELECT 
              symbol,
              interval,
              COUNT(*) as count
            FROM kline_data 
            WHERE symbol IN (${symbols.map(() => '?').join(',')})
            AND interval IN ('4h', '1h')
            GROUP BY symbol, interval
          `, symbols),
          
          // 批量获取策略分析统计
          this.db.runQuery(`
            SELECT 
              symbol,
              COUNT(*) as count
            FROM strategy_analysis 
            WHERE symbol IN (${symbols.map(() => '?').join(',')})
            GROUP BY symbol
          `, symbols),
          
          // 批量获取告警统计
          this.db.runQuery(`
            SELECT 
              symbol,
              COUNT(*) as count
            FROM alert_history 
            WHERE symbol IN (${symbols.map(() => '?').join(',')})
            GROUP BY symbol
          `, symbols)
        ]);

        // 构建统计映射表
        const klineMap = new Map();
        const analysisMap = new Map();
        const alertMap = new Map();

        // 处理K线数据统计
        klineStats.forEach(stat => {
          const key = `${stat.symbol}_${stat.interval}`;
          klineMap.set(key, stat.count);
        });

        // 处理策略分析统计
        analysisStats.forEach(stat => {
          analysisMap.set(stat.symbol, stat.count);
        });

        // 处理告警统计
        alertStats.forEach(stat => {
          alertMap.set(stat.symbol, stat.count);
        });

        // 生成详细统计
        const detailedStats = [];
        let dataCollectionSuccess = 0;
        let signalAnalysisSuccess = 0;
        let totalAlerts = 0;

        for (const symbol of symbols) {
          const kline4hCount = klineMap.get(`${symbol}_4h`) || 0;
          const kline1hCount = klineMap.get(`${symbol}_1h`) || 0;
          const analysisCount = analysisMap.get(symbol) || 0;
          const alertCount = alertMap.get(symbol) || 0;

          const hasData = kline4hCount > 0 && kline1hCount > 0;
          const hasAnalysis = analysisCount > 0;

          if (hasData) dataCollectionSuccess++;
          if (hasAnalysis) signalAnalysisSuccess++;
          totalAlerts += alertCount;

          detailedStats.push({
            symbol,
            dataCollectionRate: hasData ? 100 : 0,
            signalAnalysisRate: hasAnalysis ? 100 : 0,
            simulationCompletionRate: 0,
            simulationProgressRate: 0,
            refreshFrequency: '5分钟',
            overallStatus: hasData && hasAnalysis ? 'healthy' : (hasData ? 'warning' : 'error'),
            alertCount
          });
        }

        const dataCollectionRate = symbols.length > 0 ? (dataCollectionSuccess / symbols.length) * 100 : 0;
        const signalAnalysisRate = symbols.length > 0 ? (signalAnalysisSuccess / symbols.length) * 100 : 0;

        res.json({
          summary: {
            totalSymbols: symbols.length,
            healthySymbols: dataCollectionSuccess,
            warningSymbols: signalAnalysisSuccess - dataCollectionSuccess,
            errorSymbols: symbols.length - dataCollectionSuccess,
            totalAlerts: totalAlerts,
            completionRates: {
              dataCollection: dataCollectionRate,
              signalAnalysis: signalAnalysisRate,
              simulationTrading: 0
            }
          },
          detailedStats
        });
      } catch (error) {
        console.error('获取监控数据失败:', error);
        res.status(500).json({ error: error.message });
      }
    });（只保留最近3天数据）
    this.app.get('/api/alert-history', async (req, res) => {
      try {
        const { limit = 100, type } = req.query;

        // 清理3天前的告警数据
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
        await this.db.run(`
          DELETE FROM alert_history 
          WHERE timestamp < ?
        `, [threeDaysAgo]);

        const alerts = await this.db.getAlertHistory(parseInt(limit), type);
        res.json(alerts);
      } catch (error) {
        console.error('获取告警历史失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 获取数据验证详情
    this.app.get('/api/data-validation-details', async (req, res) => {
      try {
        const validationResults = this.dataMonitor.validationSystem.getAllValidationResults();
        res.json(validationResults);
      } catch (error) {
        console.error('获取数据验证详情失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 获取单个交易对的验证详情
    this.app.get('/api/data-validation/:symbol', async (req, res) => {
      try {
        const { symbol } = req.params;
        const analysisLog = this.dataMonitor.getAnalysisLog(symbol);
        const validationResult = await this.dataMonitor.validationSystem.validateSymbol(symbol, analysisLog);
        res.json(validationResult);
      } catch (error) {
        console.error('获取交易对验证详情失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 性能监控API
    this.app.get('/api/performance', async (req, res) => {
      try {
        const metrics = this.performanceMonitor.getMetrics();
        res.json(metrics);
      } catch (error) {
        console.error('获取性能指标失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 缓存统计API
    this.app.get('/api/cache/stats', async (req, res) => {
      try {
        const stats = this.cacheManager.getStats();
        res.json(stats);
      } catch (error) {
        console.error('获取缓存统计失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 清除缓存API
    this.app.post('/api/cache/clear', async (req, res) => {
      try {
        const { type, identifier } = req.body;
        if (type && identifier) {
          await this.cacheManager.del(type, identifier);
          res.json({ success: true, message: '缓存清除成功' });
        } else {
          await this.cacheManager.redis.flushAll();
          res.json({ success: true, message: '所有缓存清除成功' });
        }
      } catch (error) {
        console.error('清除缓存失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 数据库性能统计API
    this.app.get('/api/database/stats', async (req, res) => {
      try {
        const stats = await this.databaseOptimization.getPerformanceStats();
        res.json(stats);
      } catch (error) {
        console.error('获取数据库统计失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 实时Binance API数据采集率API
    this.app.get('/api/realtime-data-stats', (req, res) => {
      try {
        const BinanceAPI = require('./modules/api/BinanceAPI');
        const stats = BinanceAPI.getRealTimeStats();
        res.json(stats);
      } catch (error) {
        console.error('获取实时数据统计失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 重置实时数据统计API
    this.app.post('/api/realtime-data-stats/reset', (req, res) => {
      try {
        const BinanceAPI = require('./modules/api/BinanceAPI');
        BinanceAPI.resetRealTimeStats();
        res.json({ message: '实时数据统计已重置' });
      } catch (error) {
        console.error('重置实时数据统计失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 重置监控数据API
    this.app.post('/api/monitoring-dashboard/reset', (req, res) => {
      try {
        if (this.dataMonitor) {
          this.dataMonitor.reset();
          res.json({ message: '监控数据已重置' });
        } else {
          res.status(500).json({ error: 'DataMonitor未初始化' });
        }
      } catch (error) {
        console.error('重置监控数据失败:', error);
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
          trend: new Date(this.getNextTrendUpdateTime()).toISOString(),
          signal: new Date(this.getNextSignalUpdateTime()).toISOString(),
          execution: new Date(this.getNextExecutionUpdateTime()).toISOString()
        };
        res.json(updateTimes);
      } catch (error) {
        console.error('获取更新时间失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 获取主流币交易对
    this.app.get('/api/symbols/mainstream', async (req, res) => {
      try {
        const symbols = await SymbolCategoryManager.getMainstreamSymbols();
        res.json(symbols);
      } catch (error) {
        console.error('获取主流币失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 获取高市值强趋势币
    this.app.get('/api/symbols/highcap', async (req, res) => {
      try {
        const symbols = await SymbolCategoryManager.getHighCapSymbols();
        res.json(symbols);
      } catch (error) {
        console.error('获取高市值币失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 获取热点币
    this.app.get('/api/symbols/trending', async (req, res) => {
      try {
        const symbols = await SymbolCategoryManager.getTrendingSymbols();
        res.json(symbols);
      } catch (error) {
        console.error('获取热点币失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 获取小币
    this.app.get('/api/symbols/smallcap', async (req, res) => {
      try {
        const symbols = await SymbolCategoryManager.getSmallCapSymbols();
        res.json(symbols);
      } catch (error) {
        console.error('获取小币失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 检查Binance合约可用性
    this.app.get('/api/symbols/binance-contracts', async (req, res) => {
      try {
        const contracts = await SymbolCategoryManager.checkBinanceContracts();
        res.json(contracts);
      } catch (error) {
        console.error('获取Binance合约失败:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 获取多因子权重配置
    this.app.get('/api/factor-weights', async (req, res) => {
      try {
        const factorWeightManager = new FactorWeightManager(this.db);
        const weights = await factorWeightManager.getAllWeights();

        res.json({
          success: true,
          data: weights
        });
      } catch (error) {
        console.error('获取多因子权重配置失败:', error);
        res.status(500).json({
          success: false,
          error: '获取多因子权重配置失败'
        });
      }
    });

    // 获取特定交易对的分类和权重信息
    this.app.get('/api/symbol-info/:symbol', async (req, res) => {
      try {
        const { symbol } = req.params;
        const factorWeightManager = new FactorWeightManager(this.db);

        const category = await factorWeightManager.getSymbolCategory(symbol);
        const weights = await factorWeightManager.getAllWeights();

        // 过滤出该分类的权重配置
        const categoryWeights = weights.filter(w => w.category === category);

        res.json({
          success: true,
          data: {
            symbol,
            category,
            weights: categoryWeights
          }
        });
      } catch (error) {
        console.error('获取交易对信息失败:', error);
        res.status(500).json({
          success: false,
          error: '获取交易对信息失败'
        });
      }
    });

    // 更新多因子权重配置
    this.app.post('/api/factor-weights', async (req, res) => {
      try {
        const { category, analysisType, weights } = req.body;

        if (!category || !analysisType || !weights) {
          return res.status(400).json({
            success: false,
            error: '缺少必要参数'
          });
        }

        const factorWeightManager = new FactorWeightManager(this.db);
        const success = await factorWeightManager.updateWeights(category, analysisType, weights);

        if (success) {
          res.json({
            success: true,
            message: '权重配置更新成功'
          });
        } else {
          res.status(500).json({
            success: false,
            error: '权重配置更新失败'
          });
        }
      } catch (error) {
        console.error('更新多因子权重配置失败:', error);
        res.status(500).json({
          success: false,
          error: '更新多因子权重配置失败'
        });
      }
    });

    // 初始化默认权重配置
    this.app.post('/api/factor-weights/init', async (req, res) => {
      try {
        const factorWeightManager = new FactorWeightManager(this.db);
        await factorWeightManager.initializeDefaultWeights();

        res.json({
          success: true,
          message: '默认权重配置初始化成功'
        });
      } catch (error) {
        console.error('初始化默认权重配置失败:', error);
        res.status(500).json({
          success: false,
          error: '初始化默认权重配置失败'
        });
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

    // 内存监控API
    this.app.get('/api/memory', (req, res) => {
      try {
        const memoryStatus = this.memoryMiddleware.getMemoryStatus();
        res.json(memoryStatus);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // 强制垃圾回收API
    this.app.post('/api/memory/gc', (req, res) => {
      try {
        if (global.gc) {
          global.gc();
          res.json({ success: true, message: '垃圾回收完成' });
        } else {
          res.json({ success: false, message: '垃圾回收不可用，请使用 --expose-gc 参数启动' });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  /**
   * 初始化V3策略
   */
  async initializeV3Strategy() {
    try {
      // 执行数据库迁移
      const migration = new StrategyV3Migration(this.db);
      await migration.migrateToV3();

      // 设置V3策略的数据管理器
      SmartFlowStrategyV3.setDataManager(this.db);
      // 初始化V3策略模块
      SmartFlowStrategyV3.init(this.db);
      SmartFlowStrategyV3.setDeltaManager(this.deltaManager);

      console.log('✅ V3策略数据库迁移完成');
    } catch (error) {
      console.error('❌ V3策略初始化失败:', error);
      throw error;
    }
  }

  async initialize() {
    try {
      console.log('🚀 启动 SmartFlow 服务器...');

      // 初始化数据层架构
      await dataLayerIntegration.init();
      this.db = dataLayerIntegration.getDatabase();
      this.dataLayer = dataLayerIntegration.getDataLayer();
      console.log('✅ 数据层架构初始化完成');

      // 更新数据库表结构
      const schemaUpdater = new DatabaseSchemaUpdater(this.db);
      await schemaUpdater.updateSchema();
      console.log('✅ 数据库表结构更新完成');

      // 初始化模拟交易管理器
      this.simulationManager = new SimulationManager(this.db);
      this.simulationManager.startPriceMonitoring();
      console.log('✅ 模拟交易管理器启动');

      // 初始化Telegram通知
      this.telegramNotifier = new TelegramNotifier(this.db);
      console.log('✅ Telegram通知器初始化完成');

      // 初始化数据监控
      this.dataMonitor = new DataMonitor(this.db);
      // 将DataMonitor实例传递给SmartFlowStrategy
      SmartFlowStrategy.dataMonitor = this.dataMonitor;
      // 将数据库实例传递给DataMonitor
      this.dataMonitor.db = this.db;
      console.log('✅ 数据监控器初始化完成');

      // 初始化Delta数据管理器
      this.deltaManager = new DeltaManager();
      // 将DeltaManager实例传递给SmartFlowStrategy
      SmartFlowStrategy.deltaManager = this.deltaManager;
      // 将DeltaManager实例传递给SmartFlowStrategyV3
      SmartFlowStrategyV3.setDeltaManager(this.deltaManager);
      console.log('✅ Delta数据管理器初始化完成');

      // 初始化数据刷新管理器
      this.dataRefreshManager = new DataRefreshManager(this.db);
      console.log('✅ 数据刷新管理器初始化完成');

      // 初始化数据库优化（暂时跳过，避免启动失败）
      this.databaseOptimization = new DatabaseOptimization(this.db);
      try {
        await this.databaseOptimization.optimizeDatabase();
        console.log('✅ 数据库优化完成');
      } catch (error) {
        console.error('❌ 数据库优化失败，跳过:', error.message);
        // 数据库优化失败不应该阻止服务器启动
      }

      // 初始化缓存管理器
      this.cacheManager = new CacheManager({
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379,
          password: process.env.REDIS_PASSWORD || null,
          db: process.env.REDIS_DB || 0
        },
        enableRedis: process.env.ENABLE_REDIS !== 'false',
        enableMemory: true
      });
      await this.cacheManager.initialize();
      this.cacheMiddleware = CacheMiddleware.create(this.cacheManager);

      // 启动定期清理任务
      this.cacheManager.startPeriodicCleanup();

      console.log('✅ 缓存系统初始化完成');

      // 清理不一致的模拟交易记录
      try {
        const cleanedCount = await this.simulationManager.cleanupInconsistentSimulations();
        if (cleanedCount > 0) {
          console.log(`✅ 数据清理完成，修复了 ${cleanedCount} 条记录`);
        }
      } catch (error) {
        console.error('数据清理失败:', error);
      }

      // 初始化V3策略
      await this.initializeV3Strategy();
      console.log('✅ V3策略初始化完成');

      // 启动定期分析
      this.startPeriodicAnalysis();

      // 启动Delta数据实时收集
      const symbols = await this.db.getCustomSymbols();
      await this.deltaManager.start(symbols);
      console.log('✅ Delta数据实时收集已启动');

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
    // 清理现有定时器
    if (this.timers) {
      for (const timerId of this.timers) {
        clearInterval(timerId);
        clearTimeout(timerId);
      }
      this.timers.clear();
    }

    // 4H级别趋势：每1小时更新一次（按照strategy-v2.md要求）
    this.trendInterval = setInterval(async () => {
      try {
        const symbols = await this.db.getCustomSymbols();
        console.log(`📈 开始更新4H级别趋势数据 ${symbols.length} 个交易对...`);

        for (const symbol of symbols) {
          try {
            await this.updateTrendData(symbol);
          } catch (error) {
            console.error(`4H趋势更新 ${symbol} 失败:`, error);
          }
        }

        console.log('✅ 4H级别趋势数据更新完成');
      } catch (error) {
        console.error('4H级别趋势数据更新失败:', error);
      }
    }, 60 * 60 * 1000); // 1小时

    // 1H打分：每5分钟更新一次（按照strategy-v2.md要求）
    this.signalInterval = setInterval(async () => {
      try {
        const symbols = await this.db.getCustomSymbols();
        console.log(`📊 开始更新1H打分数据 ${symbols.length} 个交易对...`);

        for (const symbol of symbols) {
          try {
            await this.updateSignalData(symbol);
          } catch (error) {
            console.error(`1H打分更新 ${symbol} 失败:`, error);
          }
        }

        console.log('✅ 1H打分数据更新完成');
      } catch (error) {
        console.error('1H打分数据更新失败:', error);
      }
    }, 5 * 60 * 1000); // 5分钟

    // 15分钟入场判断：每2分钟更新一次（按照strategy-v2.md要求）
    this.executionInterval = setInterval(async () => {
      try {
        const symbols = await this.db.getCustomSymbols();
        console.log(`⚡ 开始更新15分钟入场判断数据 ${symbols.length} 个交易对...`);

        for (const symbol of symbols) {
          try {
            await this.updateExecutionData(symbol);
          } catch (error) {
            console.error(`15分钟入场判断更新 ${symbol} 失败:`, error);
          }
        }

        console.log('✅ 15分钟入场判断数据更新完成');
      } catch (error) {
        console.error('15分钟入场判断数据更新失败:', error);
      }
    }, 2 * 60 * 1000); // 2分钟

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

            // 获取分析数据用于出场判断
            let analysisData = null;
            try {
              const analysisLog = this.dataMonitor.getAnalysisLog(symbol);
              if (analysisLog) {
                analysisData = {
                  trend4h: analysisLog.phases?.trend4h,
                  hourlyConfirmation: analysisLog.phases?.hourlyConfirmation,
                  indicators: analysisLog.indicators,
                  rawData: analysisLog.rawData,
                  deltaData: this.deltaManager ? this.deltaManager.getDeltaData(symbol) : null
                };
              }
            } catch (error) {
              console.warn(`获取 ${symbol} 分析数据失败:`, error.message);
            }

            // 更新模拟交易状态
            const result = await this.simulationManager.updateSimulationStatus(symbol, currentPrice, this.dataMonitor, analysisData);
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

    // Delta数据重置：每10分钟重置一次，避免无限累积
    this.deltaResetInterval = setInterval(async () => {
      try {
        if (this.deltaManager) {
          this.deltaManager.resetAllDeltaData();
          console.log('🔄 Delta数据已重置');
        }
      } catch (error) {
        console.error('Delta数据重置失败:', error);
      }
    }, 10 * 60 * 1000); // 10分钟

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
          const analysis = await SmartFlowStrategyV3.analyzeSymbol(symbol, {
        database: this.db,
        maxLossAmount: parseFloat(maxLossAmount),
        dataRefreshManager: this.dataRefreshManager
      });

          // 存储策略分析结果到数据库
          try {
            await this.db.recordStrategyAnalysis(analysis);
          } catch (dbError) {
            console.error(`存储 ${symbol} 策略分析结果失败:`, dbError);
          }

          // 检查是否有入场执行信号，如果有则立即触发模拟交易
          if (analysis.execution && (analysis.execution.includes('做多_') || analysis.execution.includes('做空_'))) {
            console.log(`🚀 初始分析检测到入场执行信号: ${symbol} - ${analysis.execution} (已禁用自动触发)`);
            // await this.triggerSimulationWithRetry(symbol, analysis); // 已禁用自动触发
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
      const analysis = await SmartFlowStrategyV3.analyzeSymbol(symbol, {
        database: this.db,
        maxLossAmount: parseFloat(maxLossAmount),
        dataRefreshManager: this.dataRefreshManager
      });

      // 存储策略分析结果到数据库
      try {
        await this.db.recordStrategyAnalysis(analysis);
      } catch (dbError) {
        console.error(`存储 ${symbol} 策略分析结果失败:`, dbError);
      }

      console.log(`📈 趋势更新完成 [${symbol}]: ${analysis.trend}`);

      // 检查是否有入场执行信号，如果有则立即触发模拟交易
      if (analysis.execution && (analysis.execution.includes('做多_') || analysis.execution.includes('做空_'))) {
        console.log(`🚀 趋势更新检测到入场执行信号: ${symbol} - ${analysis.execution} (已禁用自动触发)`);
        // await this.triggerSimulationWithRetry(symbol, analysis); // 已禁用自动触发
      }
    } catch (error) {
      console.error(`趋势更新失败 [${symbol}]:`, error);
    }
  }

  // 更新信号数据（小时确认分析）- 使用完整分析流程
  async updateSignalData(symbol) {
    try {
      // 获取用户设置的最大损失金额
      const maxLossAmount = await this.db.getUserSetting('maxLossAmount', 100);
      const analysis = await SmartFlowStrategyV3.analyzeSymbol(symbol, {
        database: this.db,
        maxLossAmount: parseFloat(maxLossAmount),
        dataRefreshManager: this.dataRefreshManager
      });

      // 存储策略分析结果到数据库
      try {
        await this.db.recordStrategyAnalysis(analysis);
      } catch (dbError) {
        console.error(`存储 ${symbol} 策略分析结果失败:`, dbError);
      }

      console.log(`📊 信号更新完成 [${symbol}]: 得分=${analysis.hourlyScore}, 信号=${analysis.signal}`);

      // 检查是否有入场执行信号，如果有则立即触发模拟交易
      if (analysis.execution && (analysis.execution.includes('做多_') || analysis.execution.includes('做空_'))) {
        console.log(`🚀 信号更新检测到入场执行信号: ${symbol} - ${analysis.execution} (已禁用自动触发)`);
        // await this.triggerSimulationWithRetry(symbol, analysis); // 已禁用自动触发
      }
    } catch (error) {
      console.error(`信号更新失败 [${symbol}]:`, error);
    }
  }

  // 更新入场执行数据（15分钟执行分析）- 使用完整分析流程
  async updateExecutionData(symbol) {
    try {
      // 获取用户设置的最大损失金额
      const maxLossAmount = await this.db.getUserSetting('maxLossAmount', 100);
      const analysis = await SmartFlowStrategyV3.analyzeSymbol(symbol, {
        database: this.db,
        maxLossAmount: parseFloat(maxLossAmount),
        dataRefreshManager: this.dataRefreshManager
      });

      // 存储策略分析结果到数据库
      try {
        await this.db.recordStrategyAnalysis(analysis);
      } catch (dbError) {
        console.error(`存储 ${symbol} 策略分析结果失败:`, dbError);
      }

      console.log(`⚡ 执行更新完成 [${symbol}]: 执行=${analysis.execution}, 模式=${analysis.executionMode || 'NONE'}`);

      // 检查是否有入场执行信号，如果有则检查条件后触发模拟交易
      if (analysis.execution && analysis.execution.trim() !== '' && analysis.execution !== 'NONE' && (analysis.execution.includes('做多_') || analysis.execution.includes('做空_'))) {
        console.log(`🚀 检测到入场执行信号: ${symbol} - ${analysis.execution}`);

        // 检查是否满足触发条件：该交易对没有进行中的模拟交易
        const canTrigger = await this.checkSimulationTriggerConditions(symbol, analysis);
        if (canTrigger) {
          console.log(`✅ 满足触发条件，开始模拟交易: ${symbol}`);
          await this.triggerSimulationWithRetry(symbol, analysis);
        } else {
          console.log(`⏭️ 跳过模拟交易触发: ${symbol} - 不满足触发条件`);
        }
      }
    } catch (error) {
      console.error(`执行更新失败 [${symbol}]:`, error);
    }
  }

  // 检查模拟交易触发条件
  async checkSimulationTriggerConditions(symbol, analysis) {
    try {
      // 1. 检查是否有活跃的模拟交易
      const activeSimulations = await this.db.runQuery(`
        SELECT * FROM simulations 
        WHERE symbol = ? AND status = 'ACTIVE'
        ORDER BY created_at DESC
        LIMIT 1
      `, [symbol]);

      if (activeSimulations.length > 0) {
        console.log(`⏭️ 跳过 ${symbol}：存在活跃的模拟交易 (ID: ${activeSimulations[0].id})`);
        return false;
      }

      // 2. 检查最近10分钟内是否有任何模拟交易
      const recentSimulations = await this.db.runQuery(`
        SELECT * FROM simulations 
        WHERE symbol = ? AND created_at > datetime('now', '+8 hours', '-10 minutes')
        ORDER BY created_at DESC
        LIMIT 1
      `, [symbol]);

      if (recentSimulations.length > 0) {
        console.log(`⏭️ 跳过 ${symbol}：最近10分钟内已有模拟交易 (ID: ${recentSimulations[0].id})`);
        return false;
      }

      // 3. 检查最近10分钟内是否有相同方向的模拟交易
      const direction = analysis.execution.includes('做多_') ? 'LONG' : 'SHORT';
      const sameDirectionSimulations = await this.db.runQuery(`
        SELECT * FROM simulations 
        WHERE symbol = ? AND direction = ? AND created_at > datetime('now', '+8 hours', '-10 minutes')
        ORDER BY created_at DESC
        LIMIT 1
      `, [symbol, direction]);

      if (sameDirectionSimulations.length > 0) {
        console.log(`⏭️ 跳过 ${symbol}：最近10分钟内已有相同方向的模拟交易 (ID: ${sameDirectionSimulations[0].id})`);
        return false;
      }

      // 4. 检查信号质量（可选：确保信号不是NONE或无效信号）
      if (!analysis.execution || analysis.execution === 'NONE') {
        console.log(`⏭️ 跳过 ${symbol}：信号无效或为NONE`);
        return false;
      }

      // 5. 检查必要参数是否完整
      if (!analysis.entrySignal || !analysis.stopLoss || !analysis.takeProfit) {
        console.log(`⏭️ 跳过 ${symbol}：缺少必要的交易参数`);
        return false;
      }

      console.log(`✅ ${symbol} 满足所有触发条件`);
      return true;
    } catch (error) {
      console.error(`检查模拟交易触发条件失败 [${symbol}]:`, error);
      return false;
    }
  }

  // 带重试机制的模拟交易触发
  async triggerSimulationWithRetry(symbol, analysis, maxRetries = 1) {
    let retryCount = 0;
    let lastError = null;

    while (retryCount <= maxRetries) {
      try {
        console.log(`🔄 尝试触发模拟交易 [${symbol}] (第${retryCount + 1}次尝试)...`);

        // 条件检查已在 checkSimulationTriggerConditions 中完成

        // 触发模拟交易
        await this.autoStartSimulation({
          symbol,
          execution: analysis.execution,
          entrySignal: analysis.entrySignal,
          stopLoss: analysis.stopLoss,
          takeProfit: analysis.takeProfit,
          maxLeverage: analysis.maxLeverage,
          minMargin: analysis.minMargin,
          stopLossDistance: analysis.stopLossDistance,
          atrValue: analysis.atrValue,
          atr14: analysis.atr14
        });

        console.log(`✅ 模拟交易触发成功 [${symbol}] (第${retryCount + 1}次尝试)`);
        return; // 成功则退出重试循环

      } catch (error) {
        lastError = error;
        retryCount++;
        console.error(`❌ 模拟交易触发失败 [${symbol}] (第${retryCount}次尝试):`, error.message);

        if (retryCount <= maxRetries) {
          const delay = Math.pow(2, retryCount) * 1000; // 指数退避：2秒、4秒
          console.log(`⏳ 等待 ${delay}ms 后重试...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // 所有重试都失败了
    console.error(`💥 模拟交易触发最终失败 [${symbol}] (已重试${maxRetries}次):`, lastError.message);

    // 记录失败到数据监控
    if (this.dataMonitor) {
      this.dataMonitor.recordSimulation(symbol, 'START_FAILED', { error: lastError.message }, false, lastError);
    }
  }

  // 检查是否已存在相同的模拟交易（包括最近关闭的）
  async checkExistingSimulation(symbol, analysis) {
    try {
      // 检查活跃的模拟交易
      const activeSimulations = await this.db.runQuery(`
        SELECT * FROM simulations 
        WHERE symbol = ? AND status = 'ACTIVE'
        ORDER BY created_at DESC
        LIMIT 1
      `, [symbol]);

      // 如果有活跃交易，直接跳过
      if (activeSimulations.length > 0) {
        console.log(`⏭️ 跳过 ${symbol}：存在活跃的模拟交易`, {
          activeId: activeSimulations[0].id,
          activeCreatedAt: activeSimulations[0].created_at
        });
        return true;
      }

      // 检查最近10分钟内的模拟交易（包括已关闭的）
      const recentSimulations = await this.db.runQuery(`
        SELECT * FROM simulations 
        WHERE symbol = ? AND created_at > datetime('now', '-10 minutes')
        ORDER BY created_at DESC
        LIMIT 5
      `, [symbol]);

      if (recentSimulations.length === 0) {
        return false;
      }

      const isLong = analysis.execution.includes('做多_');
      let mode = 'NONE';
      if (analysis.execution.includes('多头回踩突破')) {
        mode = '多头回踩突破';
      } else if (analysis.execution.includes('空头反抽破位')) {
        mode = '空头反抽破位';
      } else if (analysis.execution.includes('区间多头')) {
        mode = '区间多头';
      } else if (analysis.execution.includes('区间空头')) {
        mode = '区间空头';
      } else if (analysis.execution.includes('假突破反手')) {
        mode = '假突破反手';
      }
      const expectedTriggerReason = `SIGNAL_${mode}`;

      // 检查最近交易中是否有相同触发原因和入场价格的
      for (const recentSim of recentSimulations) {
        const sameTriggerReason = recentSim.trigger_reason === expectedTriggerReason;
        const sameEntryPrice = Math.abs(parseFloat(recentSim.entry_price) - parseFloat(analysis.entrySignal)) < 0.0001;

        // 计算时间间隔（分钟）
        const recentTime = new Date(recentSim.created_at);
        const currentTime = new Date();
        const timeDiffMinutes = (currentTime - recentTime) / (1000 * 60);

        // 如果触发原因和入场价格都相同，直接跳过
        if (sameTriggerReason && sameEntryPrice) {
          console.log(`⏭️ 跳过 ${symbol}：10分钟内存在相同触发原因和入场价格的模拟交易`, {
            recentId: recentSim.id,
            recentTriggerReason: recentSim.trigger_reason,
            expectedTriggerReason,
            recentEntryPrice: recentSim.entry_price,
            currentEntryPrice: analysis.entrySignal,
            recentCreatedAt: recentSim.created_at,
            recentStatus: recentSim.status,
            timeDiffMinutes: timeDiffMinutes.toFixed(2)
          });
          return true;
        }

        // 如果时间间隔小于2分钟，跳过（无论触发原因和价格是否相同）
        if (timeDiffMinutes < 2) {
          console.log(`⏭️ 跳过 ${symbol}：距离上一个模拟交易时间过短（${timeDiffMinutes.toFixed(2)}分钟 < 2分钟）`, {
            recentId: recentSim.id,
            recentCreatedAt: recentSim.created_at,
            timeDiffMinutes: timeDiffMinutes.toFixed(2)
          });
          return true;
        }
      }

      console.log(`🔍 去重检查 ${symbol}：通过检查`, {
        recentCount: recentSimulations.length,
        expectedTriggerReason,
        currentEntryPrice: analysis.entrySignal
      });

      return false;
    } catch (error) {
      console.error(`检查现有模拟交易失败 [${symbol}]:`, error);
      return false; // 出错时允许创建新交易
    }
  }

  // 检查并触发模拟交易（在每次执行更新后调用）
  async checkAndTriggerSimulations() {
    try {
      console.log('🔍 开始检查模拟交易触发...');
      await this.checkAndAutoTriggerSimulation();
      console.log('✅ 模拟交易触发检查完成');
    } catch (error) {
      console.error('模拟交易触发检查失败:', error);
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

    // 内存清理：每30分钟清理一次
    this.memoryCleanupInterval = setInterval(async () => {
      try {
        console.log('🧹 开始内存清理...');
        this.dataMonitor.clearOldLogs();

        // 强制垃圾回收（如果可用）
        if (global.gc) {
          global.gc();
          console.log('🗑️ 执行垃圾回收');
        }
      } catch (error) {
        console.error('内存清理失败:', error);
      }
    }, 30 * 60 * 1000); // 30分钟
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

  // 获取所有信号数据
  async getAllSignals() {
    try {
      const symbols = await this.db.getCustomSymbols();
      const signals = [];

      // 获取用户设置的最大损失金额
      const maxLossAmount = await this.db.getUserSetting('maxLossAmount', 100);

      for (const symbol of symbols) {
        try {
          // 只更新信号和执行数据，不重新计算趋势数据
          const analysis = await SmartFlowStrategyV3.analyzeSymbol(symbol, {
        database: this.db,
        maxLossAmount: parseFloat(maxLossAmount),
        dataRefreshManager: this.dataRefreshManager
      });

          // 获取数据采集成功率 - 使用Binance API成功率
          let dataCollectionRate = 0;
          try {
            const BinanceAPI = require('./modules/api/BinanceAPI');
            const realtimeStats = BinanceAPI.getRealTimeStats();
            dataCollectionRate = realtimeStats.global.successRate;
          } catch (error) {
            console.warn('获取Binance API成功率失败:', error.message);
            // 降级到监控数据
            if (this.dataMonitor && this.dataMonitor.completionRates) {
              dataCollectionRate = this.dataMonitor.completionRates.dataCollection;
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
            // V3策略字段
            trend4h: analysis.trend4h,
            marketType: analysis.marketType,
            score1h: analysis.score1h,
            vwapDirectionConsistent: analysis.vwapDirectionConsistent,
            factors: analysis.factors,
            vwap: analysis.vwap,
            vol15mRatio: analysis.vol15mRatio,
            vol1hRatio: analysis.vol1hRatio,
            oiChange6h: analysis.oiChange6h,
            fundingRate: analysis.fundingRate,
            deltaImbalance: analysis.deltaImbalance,
            setupCandleHigh: analysis.setupCandleHigh,
            setupCandleLow: analysis.setupCandleLow,
            atr14: analysis.atr14,
            strategyVersion: analysis.strategyVersion,
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

      return signals;
    } catch (error) {
      console.error('获取信号失败:', error);
      return [];
    }
  }

  /**
   * 检查并自动触发模拟交易
   * 当检测到新的入场执行信号时，自动启动模拟交易
   * 每次入场执行信号都会触发模拟交易，不进行去重
   */
  async checkAndAutoTriggerSimulation() {
    try {
      console.log('🔍 自动触发模拟交易已禁用（由15分钟定时任务处理）...');
      // 此方法已被15分钟定时任务中的 updateExecutionData 替代
      // 15分钟定时任务会检查条件并触发模拟交易
      return;
    } catch (error) {
      console.error('自动触发模拟交易检查失败:', error);
    }
  }

  /**
   * 自动启动模拟交易
   */
  async autoStartSimulation(signalData) {
    try {
      const { symbol, execution, entrySignal, stopLoss, takeProfit, maxLeverage, minMargin, stopLossDistance, atrValue, atr14, marketType, executionMode, setupCandleHigh, setupCandleLow } = signalData;

      if (!symbol || !entrySignal || !stopLoss || !takeProfit) {
        console.log(`❌ 跳过 ${symbol}：缺少必要参数`);
        return;
      }

      // 检查是否有有效的执行信号
      if (!execution || execution.trim() === '' || execution === 'NONE' || execution === 'null' ||
        (!execution.includes('做多_') && !execution.includes('做空_')) ||
        execution.includes('SIGNAL_NONE')) {
        console.log(`❌ 跳过 ${symbol}：没有有效的执行信号 (execution: ${execution})`);
        return;
      }

      // 确定执行模式和方向
      const isLong = execution.includes('做多_');
      let mode = 'NONE';
      if (execution.includes('多头回踩突破')) {
        mode = '多头回踩突破';
      } else if (execution.includes('空头反抽破位')) {
        mode = '空头反抽破位';
      } else if (execution.includes('区间多头')) {
        mode = '区间多头';
      } else if (execution.includes('区间空头')) {
        mode = '区间空头';
      } else if (execution.includes('假突破反手')) {
        mode = '假突破反手';
      }
      const triggerReason = `SIGNAL_${mode}`;

      // 如果杠杆或保证金数据缺失，尝试重新计算
      let finalMaxLeverage = maxLeverage;
      let finalMinMargin = minMargin;
      let finalStopLossDistance = stopLossDistance;

      if (!maxLeverage || !minMargin || maxLeverage === 10 || minMargin === 100) {
        console.log(`🔧 [${symbol}] 检测到默认值，重新计算杠杆和保证金数据...`);
        try {
          const direction = isLong ? 'LONG' : 'SHORT';
          const leverageData = await SmartFlowStrategyV3.calculateLeverageData(
            entrySignal, 
            stopLoss, 
            atr14, 
            direction, 
            this.db,
            100 // 使用默认最大损失金额
          );

          if (!leverageData.error) {
            finalMaxLeverage = leverageData.maxLeverage;
            finalMinMargin = leverageData.minMargin;
            finalStopLossDistance = leverageData.stopLossDistance;
            console.log(`✅ [${symbol}] 重新计算成功: 杠杆=${finalMaxLeverage}x, 保证金=${finalMinMargin}`);
          } else {
            console.warn(`⚠️ [${symbol}] 重新计算失败，使用默认值: ${leverageData.error}`);
          }
        } catch (calcError) {
          console.error(`❌ [${symbol}] 重新计算异常:`, calcError.message);
          finalMaxLeverage = finalMaxLeverage || 10;
          finalMinMargin = finalMinMargin || 100;
        }
      }

      // 创建模拟交易
      const simulationId = await this.simulationManager.createSimulation(
        symbol,
        entrySignal,
        stopLoss,
        takeProfit,
        finalMaxLeverage,
        finalMinMargin,
        triggerReason,
        finalStopLossDistance,
        atrValue || null,
        atr14 || null,
        executionMode || mode,
        marketType || '震荡市',
        setupCandleHigh || null,
        setupCandleLow || null
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

  // 获取下次趋势更新时间（每1小时更新）
  getNextTrendUpdateTime() {
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    return nextHour.getTime();
  }

  // 获取下次信号更新时间（每5分钟更新）
  getNextSignalUpdateTime() {
    const now = new Date();
    const next5min = new Date(now);
    const currentMinute = next5min.getMinutes();
    const nextMinute = Math.ceil(currentMinute / 5) * 5;

    if (nextMinute >= 60) {
      next5min.setHours(next5min.getHours() + 1, 0, 0, 0);
    } else {
      next5min.setMinutes(nextMinute, 0, 0);
    }

    return next5min.getTime();
  }

  // 获取下次执行更新时间（每2分钟更新）
  getNextExecutionUpdateTime() {
    const now = new Date();
    const next2min = new Date(now);
    const currentMinute = next2min.getMinutes();
    const nextMinute = Math.ceil(currentMinute / 2) * 2;

    if (nextMinute >= 60) {
      next2min.setHours(next2min.getHours() + 1, 0, 0, 0);
    } else {
      next2min.setMinutes(nextMinute, 0, 0);
    }

    return next2min.getTime();
  }

  async shutdown() {
    console.log('🛑 正在关闭服务器...');

    // 清理所有定时器
    if (this.trendInterval) {
      clearInterval(this.trendInterval);
      this.trendInterval = null;
    }

    if (this.signalInterval) {
      clearInterval(this.signalInterval);
      this.signalInterval = null;
    }

    if (this.executionInterval) {
      clearInterval(this.executionInterval);
      this.executionInterval = null;
    }

    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }

    if (this.alertInterval) {
      clearInterval(this.alertInterval);
      this.alertInterval = null;
    }

    if (this.memoryCleanupInterval) {
      clearInterval(this.memoryCleanupInterval);
      this.memoryCleanupInterval = null;
    }

    if (this.deltaResetInterval) {
      clearInterval(this.deltaResetInterval);
      this.deltaResetInterval = null;
    }

    if (this.simulationManager) {
      // 停止价格监控
      if (this.simulationManager.priceCheckInterval) {
        clearInterval(this.simulationManager.priceCheckInterval);
        this.simulationManager.priceCheckInterval = null;
      }
    }

    // 优雅关闭数据层架构
    try {
      await dataLayerIntegration.gracefulShutdown();
    } catch (error) {
      console.error('数据层架构关闭失败:', error);
    }

    console.log('✅ 服务器已关闭');
    process.exit(0);
  }
}

// 创建并启动服务器
const server = new SmartFlowServer();

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('\n🛑 收到 SIGINT 信号，正在关闭服务器...');
  await server.shutdown();
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 收到 SIGTERM 信号，正在关闭服务器...');
  await server.shutdown();
});

// 处理未捕获的异常
process.on('uncaughtException', async (error) => {
  console.error('❌ 未捕获的异常:', error);
  await server.shutdown();
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('❌ 未处理的 Promise 拒绝:', reason);
  await server.shutdown();
});

// 添加交易对分类获取方法
const BinanceContractChecker = require('./modules/api/BinanceContractChecker');
const FactorWeightManager = require('./modules/strategy/FactorWeightManager');

class SymbolCategoryManager {
  static contractChecker = new BinanceContractChecker();

  // 获取fetch函数
  static async getFetch() {
    try {
      const { default: fetch } = await import('node-fetch');
      return fetch;
    } catch (error) {
      // 如果node-fetch不可用，使用全局fetch（Node.js 18+）
      return globalThis.fetch || fetch;
    }
  }

  // 获取主流币交易对（BTC, ETH）
  static async getMainstreamSymbols() {
    try {
      const fetch = await this.getFetch();
      const response = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1');
      const data = await response.json();

      const mainstreamSymbols = data
        .filter(coin => ['bitcoin', 'ethereum'].includes(coin.id))
        .map(coin => ({
          symbol: coin.symbol.toUpperCase() + 'USDT',
          name: coin.name,
          marketCap: coin.market_cap,
          price: coin.current_price,
          category: 'mainstream',
          suggestedFrequency: '趋势市：每周 1–3 笔；震荡市：每天 0–2 笔',
          suggestedHoldingPeriod: '趋势市：可持仓 1–7 天（跟随趋势）；震荡市：1–12 小时（避免费率吃掉利润）'
        }));

      return mainstreamSymbols;
    } catch (error) {
      console.error('获取主流币失败:', error);
      return [];
    }
  }

  // 获取高市值强趋势币（排名3-20）
  static async getHighCapSymbols() {
    try {
      const fetch = await this.getFetch();
      const response = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=30&page=1');
      const data = await response.json();

      const highCapSymbols = data
        .filter(coin => !['bitcoin', 'ethereum', 'tether', 'usd-coin', 'binancecoin'].includes(coin.id))
        .slice(0, 15) // 显示top15，排除BTC和ETH
        .map(coin => ({
          symbol: coin.symbol.toUpperCase() + 'USDT',
          name: coin.name,
          marketCap: coin.market_cap,
          price: coin.current_price,
          category: 'highcap',
          suggestedFrequency: '趋势市：每周 1–2 笔；震荡市：每天 1–3 笔',
          suggestedHoldingPeriod: '趋势市：0.5–3 天；震荡市：数小时内（避免高费率磨损）'
        }));

      // 检查Binance合约可用性
      console.log('🔍 检查高市值币的Binance合约可用性...');
      console.log('📊 高市值币列表:', highCapSymbols.map(s => s.symbol));
      const symbolsToCheck = highCapSymbols.map(item => item.symbol);
      console.log('🔍 要检查的符号:', symbolsToCheck);
      const availableContracts = await this.contractChecker.filterAvailableContracts(symbolsToCheck);
      console.log('✅ 可用合约:', availableContracts);

      const filteredSymbols = highCapSymbols.filter(item =>
        availableContracts.includes(item.symbol)
      );

      console.log(`✅ 高市值币: ${filteredSymbols.length}/${highCapSymbols.length} 个在Binance期货中可用`);

      return filteredSymbols;
    } catch (error) {
      console.error('获取高市值币失败:', error);
      return [];
    }
  }

  // 获取热点币（Trending）
  static async getTrendingSymbols() {
    try {
      const fetch = await this.getFetch();
      const response = await fetch('https://api.coingecko.com/api/v3/search/trending');
      const data = await response.json();

      const trendingSymbols = data.coins
        .slice(0, 5) // 只显示top5
        .map(coin => coin.item)
        .map(coin => ({
          symbol: coin.symbol.toUpperCase() + 'USDT',
          name: coin.name,
          marketCap: coin.market_cap_rank ? `#${coin.market_cap_rank}` : 'N/A',
          price: coin.price_btc ? `₿${coin.price_btc}` : 'N/A',
          category: 'trending',
          suggestedFrequency: '趋势市：每周 1–2 笔；震荡市：每天 2–4 笔（需严格风控）',
          suggestedHoldingPeriod: '趋势市：6–24 小时（高波动快速止盈止损）；震荡市：1–3 小时以内'
        }));

      // 检查Binance合约可用性
      console.log('🔍 检查热点币的Binance合约可用性...');
      const symbolsToCheck = trendingSymbols.map(item => item.symbol);
      const availableContracts = await this.contractChecker.filterAvailableContracts(symbolsToCheck);

      const filteredSymbols = trendingSymbols.filter(item =>
        availableContracts.includes(item.symbol)
      );

      console.log(`✅ 热点币: ${filteredSymbols.length}/${trendingSymbols.length} 个在Binance期货中可用`);

      return filteredSymbols;
    } catch (error) {
      console.error('获取热点币失败:', error);
      return [];
    }
  }

  // 获取小币（市值 < $50M）
  static async getSmallCapSymbols() {
    try {
      const fetch = await this.getFetch();
      const response = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1');
      const data = await response.json();

      const smallCapSymbols = data
        .filter(coin => coin.market_cap && coin.market_cap < 50000000) // < $50M
        .slice(0, 20) // 限制数量
        .map(coin => ({
          symbol: coin.symbol.toUpperCase() + 'USDT',
          name: coin.name,
          marketCap: coin.market_cap,
          price: coin.current_price,
          category: 'smallcap',
          suggestedFrequency: '不做趋势；震荡市：每天 1–2 笔（小仓位 ≤1% 风险）',
          suggestedHoldingPeriod: '仅震荡市：0.5–2 小时（避免爆仓风险）；不建议长时间持有'
        }));

      // 检查Binance合约可用性
      console.log('🔍 检查小币的Binance合约可用性...');
      const symbolsToCheck = smallCapSymbols.map(item => item.symbol);
      const availableContracts = await this.contractChecker.filterAvailableContracts(symbolsToCheck);

      const filteredSymbols = smallCapSymbols.filter(item =>
        availableContracts.includes(item.symbol)
      );

      console.log(`✅ 小币: ${filteredSymbols.length}/${smallCapSymbols.length} 个在Binance期货中可用`);

      return filteredSymbols;
    } catch (error) {
      console.error('获取小币失败:', error);
      return [];
    }
  }

  // 检查Binance合约可用性
  static async checkBinanceContracts() {
    try {
      const fetch = await this.getFetch();
      const response = await fetch('https://fapi.binance.com/fapi/v1/exchangeInfo');
      const data = await response.json();

      const contracts = data.symbols
        .filter(symbol => symbol.status === 'TRADING' && symbol.symbol.endsWith('USDT'))
        .map(symbol => ({
          symbol: symbol.symbol,
          baseAsset: symbol.baseAsset,
          quoteAsset: symbol.quoteAsset,
          status: symbol.status
        }));

      return contracts;
    } catch (error) {
      console.error('获取Binance合约失败:', error);
      return [];
    }
  }

  // ==================== 内存管理方法 ====================

  /**
   * 创建安全的定时器
   */
  createSafeInterval(callback, interval) {
    const timerId = setInterval(callback, interval);
    this.timers.add(timerId);
    return timerId;
  }

  createSafeTimeout(callback, delay) {
    const timerId = setTimeout(() => {
      this.timers.delete(timerId);
      callback();
    }, delay);
    this.timers.add(timerId);
    return timerId;
  }

  /**
   * 清理所有定时器
   */
  clearAllTimers() {
    console.log(`🧹 清理 ${this.timers.size} 个定时器`);
    for (const timerId of this.timers) {
      clearInterval(timerId);
      clearTimeout(timerId);
    }
    this.timers.clear();
  }

  /**
   * 创建安全的WebSocket连接
   */
  createSafeWebSocket(url, options = {}) {
    const WebSocket = require('ws');
    const ws = new WebSocket(url, options);
    this.connections.add(ws);

    ws.on('close', () => {
      this.connections.delete(ws);
    });

    return ws;
  }

  /**
   * 关闭所有连接
   */
  closeAllConnections() {
    console.log(`🔌 关闭 ${this.connections.size} 个WebSocket连接`);
    for (const ws of this.connections) {
      if (ws.readyState === 1) { // OPEN
        ws.close(1000, 'Server shutdown');
      }
    }
    this.connections.clear();
  }

  /**
   * 启动内存监控
   */
  startMemoryMonitoring() {
    this.cleanupInterval = setInterval(() => {
      this.performMemoryCleanup();
    }, 60000); // 每分钟检查一次

    // 监控内存使用
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const memMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const memTotal = Math.round(memUsage.heapTotal / 1024 / 1024);

      if (memMB > 200) { // 超过200MB时警告
        console.warn(`⚠️ 内存使用过高: ${memMB}MB / ${memTotal}MB`);
        this.performMemoryCleanup();
      }
    }, 30000); // 每30秒检查一次
  }

  /**
   * 执行内存清理
   */
  performMemoryCleanup() {
    console.log('🧹 执行内存清理...');

    // 强制垃圾回收
    if (global.gc) {
      global.gc();
    }

    // 清理定时器
    this.clearAllTimers();

    // 清理连接
    this.closeAllConnections();

    console.log('✅ 内存清理完成');
  }

  /**
   * 设置优雅关闭
   */
  setupGracefulShutdown() {
    const shutdown = () => {
      console.log('🛑 开始优雅关闭服务...');

      // 停止接受新连接
      if (this.server) {
        this.server.close(() => {
          console.log('✅ HTTP服务器已关闭');
        });
      }

      // 清理资源
      this.clearAllTimers();
      this.closeAllConnections();

      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }

      // 关闭数据库连接
      if (this.db && this.db.close) {
        this.db.close();
      }

      // 强制退出
      setTimeout(() => {
        console.log('🔚 强制退出进程');
        process.exit(0);
      }, 5000);
    };

    // 监听退出信号
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    process.on('SIGUSR2', shutdown); // PM2重启信号
  }
}

// 启动服务器
server.initialize();
