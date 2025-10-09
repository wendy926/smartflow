/**
 * AI分析定时任务调度器
 * 负责定时触发宏观风险分析和交易对趋势分析
 */

const cron = require('node-cron');
const logger = require('../../utils/logger');
const UnifiedAIClient = require('./unified-ai-client');
const MacroRiskAnalyzer = require('./macro-risk-analyzer');
const SymbolTrendAnalyzer = require('./symbol-trend-analyzer');
const AIAlertService = require('./ai-alert-service');

/**
 * AI分析调度器类
 */
class AIAnalysisScheduler {
  constructor(aiOperations, binanceAPI, telegramService) {
    this.aiOps = aiOperations;
    this.binanceAPI = binanceAPI;
    this.telegram = telegramService;

    // 初始化组件
    this.aiClient = new UnifiedAIClient();
    this.macroAnalyzer = null;
    this.symbolAnalyzer = null;
    this.alertService = null;

    // 定时任务
    this.macroTask = null;
    this.symbolTask = null;

    // 状态
    this.isInitialized = false;
    this.isRunning = false;
  }

  /**
   * 初始化调度器
   * @returns {Promise<boolean>}
   */
  async initialize() {
    try {
      logger.info('初始化AI分析调度器...');

      // 加载配置
      const config = await this.aiOps.getConfig();

      // 检查AI是否启用
      if (config.ai_analysis_enabled !== 'true') {
        logger.warn('AI分析未启用，调度器不会启动');
        return false;
      }

      // 初始化AI客户端
      const initialized = await this.aiClient.initialize(config);
      if (!initialized) {
        logger.error('AI客户端初始化失败');
        return false;
      }

      // 初始化分析器
      this.macroAnalyzer = new MacroRiskAnalyzer(this.aiClient, this.aiOps);
      this.symbolAnalyzer = new SymbolTrendAnalyzer(this.aiClient, this.aiOps);
      this.alertService = new AIAlertService(this.aiOps, this.telegram);

      this.isInitialized = true;
      logger.info('AI分析调度器初始化成功');
      return true;

    } catch (error) {
      logger.error('AI分析调度器初始化失败:', error);
      return false;
    }
  }

  /**
   * 启动调度器
   * @returns {Promise<boolean>}
   */
  async start() {
    try {
      if (!this.isInitialized) {
        const initialized = await this.initialize();
        if (!initialized) {
          return false;
        }
      }

      if (this.isRunning) {
        logger.warn('AI分析调度器已经在运行');
        return true;
      }

      const config = await this.aiOps.getConfig();

      // 启动宏观风险分析任务（每2小时）
      const macroInterval = parseInt(config.macro_update_interval) || 7200;
      this.startMacroAnalysisTask(macroInterval);

      // 启动交易对分析任务（每5分钟）
      const symbolInterval = parseInt(config.symbol_update_interval) || 300;
      this.startSymbolAnalysisTask(symbolInterval);

      this.isRunning = true;
      logger.info('AI分析调度器已启动');

      // 立即执行一次
      setTimeout(() => {
        this.runMacroAnalysis();
      }, 5000);

      return true;

    } catch (error) {
      logger.error('启动AI分析调度器失败:', error);
      return false;
    }
  }

  /**
   * 启动宏观风险分析任务
   * @param {number} intervalSeconds - 间隔秒数
   */
  startMacroAnalysisTask(intervalSeconds) {
    // 计算cron表达式（每N秒转换为分钟）
    const intervalMinutes = Math.max(1, Math.floor(intervalSeconds / 60));
    const cronExpression = intervalMinutes >= 60
      ? `0 */${Math.floor(intervalMinutes / 60)} * * *` // 小时级
      : `*/${intervalMinutes} * * * *`; // 分钟级

    logger.info(`宏观风险分析任务设置 - 间隔: ${intervalSeconds}秒, Cron: ${cronExpression}`);

    this.macroTask = cron.schedule(cronExpression, async () => {
      await this.runMacroAnalysis();
    });
  }

  /**
   * 启动交易对分析任务
   * @param {number} intervalSeconds - 间隔秒数
   */
  startSymbolAnalysisTask(intervalSeconds) {
    const intervalMinutes = Math.max(1, Math.floor(intervalSeconds / 60));
    const cronExpression = `*/${intervalMinutes} * * * *`;

    logger.info(`交易对分析任务设置 - 间隔: ${intervalSeconds}秒, Cron: ${cronExpression}`);

    this.symbolTask = cron.schedule(cronExpression, async () => {
      await this.runSymbolAnalysis();
    });
  }

  /**
   * 执行宏观风险分析
   * @returns {Promise<void>}
   */
  async runMacroAnalysis() {
    try {
      logger.info('执行宏观风险分析任务...');

      // 分析BTC和ETH
      const symbols = ['BTCUSDT', 'ETHUSDT'];
      const results = [];

      for (const symbol of symbols) {
        // 获取市场数据
        const marketData = await this.getMarketData(symbol);

        // 执行分析
        const result = await this.macroAnalyzer.analyzeSymbolRisk(symbol, marketData);
        results.push(result);

        // 短暂延迟，避免API限流
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // 检查并触发告警
      await this.alertService.checkMultipleAlerts(results);

      logger.info(`宏观风险分析任务完成 - 成功: ${results.filter(r => r.success).length}, 失败: ${results.filter(r => !r.success).length}`);

    } catch (error) {
      logger.error('宏观风险分析任务失败:', error);
    }
  }

  /**
   * 执行交易对分析
   * @returns {Promise<void>}
   */
  async runSymbolAnalysis() {
    try {
      logger.info('执行交易对分析任务...');

      // 获取活跃交易对
      const symbols = await this.getActiveSymbols();

      if (symbols.length === 0) {
        logger.warn('没有活跃的交易对需要分析');
        return;
      }

      // 限制分析数量（避免过多API调用）
      const maxSymbols = 5;
      const symbolsToAnalyze = symbols.slice(0, maxSymbols);

      logger.info(`将分析 ${symbolsToAnalyze.length} 个交易对: ${symbolsToAnalyze.join(', ')}`);

      // 获取策略数据
      const strategyDataMap = await this.getStrategyData(symbolsToAnalyze);

      // 批量分析
      const results = await this.symbolAnalyzer.analyzeSymbols(symbolsToAnalyze, strategyDataMap);

      logger.info(`交易对分析任务完成 - 成功: ${results.filter(r => r.success).length}, 失败: ${results.filter(r => !r.success).length}`);

    } catch (error) {
      logger.error('交易对分析任务失败:', error);
    }
  }

  /**
   * 获取市场数据（实时从Binance API获取）
   * @param {string} symbol - 交易对符号
   * @returns {Promise<Object>}
   */
  async getMarketData(symbol) {
    try {
      logger.debug(`[AI] 获取 ${symbol} 实时市场数据`);

      // 从Binance API获取实时数据
      const binanceAPI = this.binanceAPI;

      // 获取24小时价格统计
      const ticker = await binanceAPI.getTicker24hr(symbol);

      // 获取资金费率
      const fundingRateData = await binanceAPI.getFundingRate(symbol);
      const fundingRate = parseFloat(fundingRateData.lastFundingRate || 0);

      const marketData = {
        currentPrice: parseFloat(ticker.lastPrice || 0),
        priceChange24h: parseFloat(ticker.priceChangePercent || 0),
        volume24h: parseFloat(ticker.quoteVolume || 0),
        fundingRate: parseFloat(fundingRate || 0),
        high24h: parseFloat(ticker.highPrice || 0),
        low24h: parseFloat(ticker.lowPrice || 0)
      };

      logger.info(`[AI] ${symbol} 实时数据 - 价格: $${marketData.currentPrice}, 24H变化: ${marketData.priceChange24h}%`);

      return marketData;

    } catch (error) {
      logger.error(`获取 ${symbol} 实时市场数据失败:`, error);

      // 降级：从数据库获取
      try {
        logger.warn(`[AI] 降级使用数据库数据`);
        const [rows] = await this.aiOps.pool.query(
          'SELECT last_price, price_change_24h, volume_24h, funding_rate FROM symbols WHERE symbol = ?',
          [symbol]
        );

        if (rows.length > 0) {
          const data = rows[0];
          return {
            currentPrice: parseFloat(data.last_price),
            priceChange24h: parseFloat(data.price_change_24h),
            volume24h: parseFloat(data.volume_24h),
            fundingRate: parseFloat(data.funding_rate)
          };
        }
      } catch (dbError) {
        logger.error('从数据库获取数据也失败:', dbError);
      }

      return {};
    }
  }

  /**
   * 获取活跃交易对
   * @returns {Promise<Array<string>>}
   */
  async getActiveSymbols() {
    try {
      const [rows] = await this.aiOps.pool.query(
        'SELECT symbol FROM symbols WHERE status = ? ORDER BY volume_24h DESC LIMIT 10',
        ['ACTIVE']
      );

      return rows.map(row => row.symbol);

    } catch (error) {
      logger.error('获取活跃交易对失败:', error);
      return [];
    }
  }

  /**
   * 获取策略数据（只读，不修改策略判断）
   * @param {Array<string>} symbols - 交易对数组
   * @returns {Promise<Object>}
   */
  async getStrategyData(symbols) {
    try {
      logger.debug('[AI只读] 读取策略数据用于AI分析（不修改策略判断）');
      const dataMap = {};

      for (const symbol of symbols) {
        // 只读查询：获取最新策略判断快照
        const [rows] = await this.aiOps.pool.query(
          `SELECT sj.*, s.last_price 
          FROM strategy_judgments sj
          INNER JOIN symbols s ON sj.symbol_id = s.id
          WHERE s.symbol = ?
          ORDER BY sj.created_at DESC
          LIMIT 1`,
          [symbol]
        );

        if (rows.length > 0) {
          const row = rows[0];
          const indicators = row.indicators_data ? JSON.parse(row.indicators_data) : {};

          // 获取实时价格（而不是数据库旧价格）
          let currentPrice = parseFloat(row.last_price);
          try {
            const ticker = await this.binanceAPI.getTicker24hr(symbol);
            currentPrice = parseFloat(ticker.lastPrice || 0);
            logger.info(`[AI只读] ${symbol} 实时价格: $${currentPrice}`);
          } catch (priceError) {
            logger.warn(`[AI只读] ${symbol} 获取实时价格失败，使用数据库价格: $${currentPrice}`);
          }

          dataMap[symbol] = {
            currentPrice: currentPrice,
            trend4h: row.trend_direction,
            trend1h: row.trend_direction,
            signal15m: row.entry_signal,
            score: {
              trend4h: Math.round(parseFloat(row.confidence_score) / 10),
              factors1h: Math.round(parseFloat(row.confidence_score) / 15),
              entry15m: Math.round(parseFloat(row.confidence_score) / 30)
            },
            indicators
          };
        } else {
          dataMap[symbol] = {};
        }
      }

      return dataMap;

    } catch (error) {
      logger.error('[AI只读] 读取策略数据失败（不影响策略执行）:', error);
      // 返回空对象，AI自行处理
      // 策略执行不受影响
      return {};
    }
  }

  /**
   * 停止调度器
   */
  stop() {
    try {
      if (this.macroTask) {
        this.macroTask.stop();
        logger.info('宏观风险分析任务已停止');
      }

      if (this.symbolTask) {
        this.symbolTask.stop();
        logger.info('交易对分析任务已停止');
      }

      this.isRunning = false;
      logger.info('AI分析调度器已停止');

    } catch (error) {
      logger.error('停止AI分析调度器失败:', error);
    }
  }

  /**
   * 获取调度器状态
   * @returns {Object}
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      running: this.isRunning,
      aiStats: this.aiClient ? this.aiClient.getUsageStats() : null
    };
  }

  /**
   * 手动触发宏观分析
   * @param {string} symbol - 交易对符号（可选）
   * @returns {Promise<Object>}
   */
  async triggerMacroAnalysis(symbol = null) {
    try {
      if (symbol) {
        const marketData = await this.getMarketData(symbol);
        const result = await this.macroAnalyzer.analyzeSymbolRisk(symbol, marketData);
        await this.alertService.checkAndTriggerAlert(result);
        return result;
      } else {
        await this.runMacroAnalysis();
        return { success: true, message: 'BTC和ETH宏观分析已触发' };
      }
    } catch (error) {
      logger.error('手动触发宏观分析失败:', error);
      throw error;
    }
  }

  /**
   * 手动触发交易对分析
   * @param {string} symbol - 交易对符号
   * @returns {Promise<Object>}
   */
  async triggerSymbolAnalysis(symbol) {
    try {
      const strategyData = await this.getStrategyData([symbol]);
      const result = await this.symbolAnalyzer.analyzeSymbol(symbol, strategyData[symbol] || {});
      return result;
    } catch (error) {
      logger.error(`手动触发 ${symbol} 分析失败:`, error);
      throw error;
    }
  }
}

module.exports = AIAnalysisScheduler;

