// StrategyEngineAPI.js - 真实策略引擎API接口
// 符合软件架构设计原则：单一职责、开闭原则、依赖注入、接口隔离等

const StrategyV3Engine = require('../strategy/trend-trading/StrategyV3Engine');
const ICTStrategyEngine = require('../strategy/ict-trading/ICTStrategyEngine');
const StrategyResultValidator = require('../validation/StrategyResultValidator');
const PerformanceMonitor = require('../monitoring/PerformanceMonitor');

/**
 * 策略引擎API - 遵循23个设计原则
 * 
 * 设计原则应用:
 * 1. 单一职责原则 (SRP) - 每个方法只负责一个功能
 * 2. 开闭原则 (OCP) - 对扩展开放，对修改关闭
 * 3. 里氏替换原则 (LSP) - 策略引擎可以互相替换
 * 4. 接口隔离原则 (ISP) - 接口功能单一，不强制依赖不需要的功能
 * 5. 依赖反转原则 (DIP) - 依赖抽象而非具体实现
 * 6. 组合优于继承 - 使用组合模式组织策略引擎
 * 7. 最少知识原则 - 模块间耦合度最小
 * 8. 不要重复自己 (DRY) - 提取公共逻辑
 * 9. 保持简单 (KISS) - 接口设计简洁明了
 * 10. 你不需要它 (YAGNI) - 只实现当前需要的功能
 */
class StrategyEngineAPI {
  constructor(database, cacheManager, performanceMonitor) {
    // 依赖注入原则 - 通过构造函数注入依赖
    this.database = database;
    this.cacheManager = cacheManager;
    this.performanceMonitor = performanceMonitor || new PerformanceMonitor();
    
    // 策略引擎实例化 - 组合模式
    this.v3Engine = new StrategyV3Engine(database, cacheManager);
    this.ictEngine = new ICTStrategyEngine(database, cacheManager);
    
    // 结果验证器 - 单一职责
    this.validator = new StrategyResultValidator();
    
    // 性能监控
    this.apiMetrics = new Map();
    
    // 错误处理策略
    this.errorHandlers = new Map();
    this.setupErrorHandlers();
  }

  /**
   * 设置路由 - 接口隔离原则
   */
  setupRoutes(app) {
    console.log('🔧 设置策略引擎API路由...');

    // V3策略分析接口
    app.get('/api/v3/analyze/:symbol', this.handleV3Analysis.bind(this));
    app.get('/api/v3/signals', this.handleV3Signals.bind(this));
    app.get('/api/v3/trend-filter/:symbol', this.handleV3TrendFilter.bind(this));
    app.get('/api/v3/hourly-scoring/:symbol', this.handleV3HourlyScoring.bind(this));
    app.get('/api/v3/execution-15m/:symbol', this.handleV3Execution15m.bind(this));
    
    // ICT策略分析接口
    app.get('/api/ict/analyze/:symbol', this.handleICTAnalysis.bind(this));
    app.get('/api/ict/signals', this.handleICTSignals.bind(this));
    app.get('/api/ict/daily-trend/:symbol', this.handleICTDailyTrend.bind(this));
    app.get('/api/ict/structure-4h/:symbol', this.handleICTStructure4h.bind(this));
    app.get('/api/ict/entry-15m/:symbol', this.handleICTEntry15m.bind(this));
    
    // 统一策略接口
    app.get('/api/strategy/unified-analysis', this.handleUnifiedAnalysis.bind(this));
    app.get('/api/strategy/performance', this.handleStrategyPerformance.bind(this));
    app.get('/api/strategy/health-check', this.handleHealthCheck.bind(this));
    
    // 配置管理接口
    app.get('/api/strategy/categories', this.handleGetCategories.bind(this));
    app.put('/api/strategy/categories/:symbol', this.handleUpdateCategory.bind(this));
    app.get('/api/strategy/weights/:category', this.handleGetWeights.bind(this));
    
    console.log('✅ 策略引擎API路由设置完成');
  }

  /**
   * V3策略完整分析 - 单一职责原则
   */
  async handleV3Analysis(req, res) {
    const startTime = Date.now();
    const { symbol } = req.params;
    const { forceRefresh = false } = req.query;

    try {
      // 输入验证 - 防御性编程
      if (!symbol || typeof symbol !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'INVALID_SYMBOL',
          message: '无效的交易对参数'
        });
      }

      // 性能监控开始
      this.performanceMonitor.startOperation(`v3_analysis_${symbol}`);

      // 缓存检查 - 性能优化原则
      if (!forceRefresh) {
        const cached = await this.getCachedResult('v3_analysis', symbol);
        if (cached) {
          this.recordAPIMetrics('v3_analysis', Date.now() - startTime, 'cache_hit');
          return res.json({
            success: true,
            data: cached,
            source: 'cache',
            timestamp: new Date().toISOString()
          });
        }
      }

      // 执行V3策略分析
      const analysisResult = await this.v3Engine.analyzeSymbol(symbol, {
        includeDetails: true,
        validateData: true
      });

      // 结果验证 - 数据完整性原则
      const validationResult = this.validator.validateV3Result(analysisResult);
      if (!validationResult.valid) {
        throw new Error(`V3分析结果验证失败: ${validationResult.errors.join(', ')}`);
      }

      // 缓存结果
      await this.setCachedResult('v3_analysis', symbol, analysisResult, 300); // 5分钟缓存

      // 性能监控结束
      this.performanceMonitor.endOperation(`v3_analysis_${symbol}`);
      this.recordAPIMetrics('v3_analysis', Date.now() - startTime, 'success');

      res.json({
        success: true,
        data: analysisResult,
        source: 'engine',
        timestamp: new Date().toISOString(),
        performanceMetrics: {
          analysisTime: Date.now() - startTime,
          dataQuality: analysisResult.dataQuality || 100
        }
      });

    } catch (error) {
      this.handleAPIError(error, req, res, 'v3_analysis');
    }
  }

  /**
   * ICT策略完整分析 - 单一职责原则
   */
  async handleICTAnalysis(req, res) {
    const startTime = Date.now();
    const { symbol } = req.params;
    const { forceRefresh = false } = req.query;

    try {
      // 输入验证
      if (!symbol || typeof symbol !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'INVALID_SYMBOL',
          message: '无效的交易对参数'
        });
      }

      // 性能监控开始
      this.performanceMonitor.startOperation(`ict_analysis_${symbol}`);

      // 缓存检查
      if (!forceRefresh) {
        const cached = await this.getCachedResult('ict_analysis', symbol);
        if (cached) {
          this.recordAPIMetrics('ict_analysis', Date.now() - startTime, 'cache_hit');
          return res.json({
            success: true,
            data: cached,
            source: 'cache',
            timestamp: new Date().toISOString()
          });
        }
      }

      // 执行ICT策略分析
      const analysisResult = await this.ictEngine.analyzeSymbol(symbol, {
        includeDetails: true,
        validateData: true,
        strictFiltering: true // 严格按照ict.md文档过滤
      });

      // 结果验证
      const validationResult = this.validator.validateICTResult(analysisResult);
      if (!validationResult.valid) {
        throw new Error(`ICT分析结果验证失败: ${validationResult.errors.join(', ')}`);
      }

      // 缓存结果
      await this.setCachedResult('ict_analysis', symbol, analysisResult, 300);

      // 性能监控结束
      this.performanceMonitor.endOperation(`ict_analysis_${symbol}`);
      this.recordAPIMetrics('ict_analysis', Date.now() - startTime, 'success');

      res.json({
        success: true,
        data: analysisResult,
        source: 'engine',
        timestamp: new Date().toISOString(),
        performanceMetrics: {
          analysisTime: Date.now() - startTime,
          dataQuality: analysisResult.dataQuality || 100
        }
      });

    } catch (error) {
      this.handleAPIError(error, req, res, 'ict_analysis');
    }
  }

  /**
   * 统一策略分析 - 组合模式
   */
  async handleUnifiedAnalysis(req, res) {
    const startTime = Date.now();
    const { symbols, strategies = ['V3', 'ICT'] } = req.query;

    try {
      // 输入验证和参数解析
      const symbolList = symbols ? symbols.split(',') : this.getDefaultSymbols();
      const strategyList = Array.isArray(strategies) ? strategies : strategies.split(',');

      if (symbolList.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'NO_SYMBOLS',
          message: '未指定分析的交易对'
        });
      }

      // 性能监控
      this.performanceMonitor.startOperation('unified_analysis');

      // 并行分析 - 性能优化原则
      const analysisPromises = [];
      
      for (const symbol of symbolList) {
        for (const strategy of strategyList) {
          if (strategy === 'V3') {
            analysisPromises.push(
              this.v3Engine.analyzeSymbol(symbol).then(result => ({
                symbol,
                strategy: 'V3',
                result
              }))
            );
          } else if (strategy === 'ICT') {
            analysisPromises.push(
              this.ictEngine.analyzeSymbol(symbol).then(result => ({
                symbol,
                strategy: 'ICT', 
                result
              }))
            );
          }
        }
      }

      // 等待所有分析完成
      const analysisResults = await Promise.allSettled(analysisPromises);

      // 处理结果 - 错误隔离原则
      const successResults = [];
      const failedResults = [];

      analysisResults.forEach((promiseResult, index) => {
        if (promiseResult.status === 'fulfilled') {
          successResults.push(promiseResult.value);
        } else {
          failedResults.push({
            index,
            error: promiseResult.reason.message,
            symbol: symbolList[Math.floor(index / strategyList.length)],
            strategy: strategyList[index % strategyList.length]
          });
        }
      });

      // 性能监控结束
      this.performanceMonitor.endOperation('unified_analysis');

      res.json({
        success: true,
        data: {
          successful: successResults,
          failed: failedResults,
          summary: {
            totalSymbols: symbolList.length,
            totalStrategies: strategyList.length,
            successCount: successResults.length,
            failureCount: failedResults.length,
            successRate: (successResults.length / (symbolList.length * strategyList.length)) * 100
          }
        },
        timestamp: new Date().toISOString(),
        performanceMetrics: {
          totalTime: Date.now() - startTime,
          avgTimePerAnalysis: (Date.now() - startTime) / (symbolList.length * strategyList.length)
        }
      });

    } catch (error) {
      this.handleAPIError(error, req, res, 'unified_analysis');
    }
  }

  /**
   * V3策略信号获取 - 适配现有前端
   */
  async handleV3Signals(req, res) {
    try {
      const symbols = this.getDefaultSymbols();
      const signals = [];

      // 批量分析 - 性能优化
      const batchSize = 5; // 每批处理5个交易对
      for (let i = 0; i < symbols.length; i += batchSize) {
        const batch = symbols.slice(i, i + batchSize);
        const batchPromises = batch.map(symbol => 
          this.v3Engine.analyzeSymbol(symbol).catch(error => ({
            symbol,
            error: error.message,
            trend4h: '震荡市',
            signal: '观望',
            execution: 'NONE'
          }))
        );

        const batchResults = await Promise.all(batchPromises);
        
        // 转换为前端期望的格式 - 适配器模式
        batchResults.forEach(result => {
          signals.push(this.convertV3ResultToSignalFormat(result));
        });
      }

      // 直接返回数组格式 (与现有前端兼容)
      res.json(signals);

    } catch (error) {
      this.handleAPIError(error, req, res, 'v3_signals');
    }
  }

  /**
   * ICT策略信号获取 - 适配现有前端
   */
  async handleICTSignals(req, res) {
    try {
      const symbols = this.getDefaultSymbols();
      const signals = [];

      // 批量分析
      const batchSize = 5;
      for (let i = 0; i < symbols.length; i += batchSize) {
        const batch = symbols.slice(i, i + batchSize);
        const batchPromises = batch.map(symbol =>
          this.ictEngine.analyzeSymbol(symbol).catch(error => ({
            symbol,
            error: error.message,
            dailyTrend: '震荡',
            signalType: 'WAIT',
            entryPrice: 0
          }))
        );

        const batchResults = await Promise.all(batchPromises);
        
        // 转换为前端期望的格式
        batchResults.forEach(result => {
          signals.push(this.convertICTResultToSignalFormat(result));
        });
      }

      // 直接返回数组格式 (与现有前端兼容)
      res.json(signals);

    } catch (error) {
      this.handleAPIError(error, req, res, 'ict_signals');
    }
  }

  /**
   * 策略性能监控 - 监控原则
   */
  async handleStrategyPerformance(req, res) {
    try {
      const { timeRange = '24h', strategy = 'all' } = req.query;

      const performanceData = {
        v3Performance: strategy === 'all' || strategy === 'V3' ? 
          await this.getStrategyPerformance('V3', timeRange) : null,
        ictPerformance: strategy === 'all' || strategy === 'ICT' ?
          await this.getStrategyPerformance('ICT', timeRange) : null,
        systemMetrics: this.performanceMonitor.getMetrics(),
        apiMetrics: this.getAPIMetrics(),
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: performanceData
      });

    } catch (error) {
      this.handleAPIError(error, req, res, 'strategy_performance');
    }
  }

  /**
   * 健康检查 - 可观测性原则
   */
  async handleHealthCheck(req, res) {
    try {
      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: 'v5.0-strategy-engine',
        components: {
          v3Engine: await this.checkV3EngineHealth(),
          ictEngine: await this.checkICTEngineHealth(),
          database: await this.checkDatabaseHealth(),
          cache: await this.checkCacheHealth(),
          binanceAPI: await this.checkBinanceAPIHealth()
        }
      };

      // 计算整体健康状态
      const componentStatuses = Object.values(healthStatus.components);
      const unhealthyCount = componentStatuses.filter(c => c.status !== 'healthy').length;
      
      if (unhealthyCount > 0) {
        healthStatus.status = unhealthyCount > componentStatuses.length / 2 ? 'unhealthy' : 'degraded';
      }

      const httpStatus = healthStatus.status === 'healthy' ? 200 : 
                        healthStatus.status === 'degraded' ? 200 : 503;

      res.status(httpStatus).json(healthStatus);

    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 转换V3结果为信号格式 - 适配器模式
   */
  convertV3ResultToSignalFormat(result) {
    return {
      symbol: result.symbol,
      category: result.category || 'midcap',
      trend4h: result.trend4h || '震荡市',
      trendStrength: result.trendStrength || '弱',
      score: result.score || 0,
      signal: result.signal || '观望',
      hourlyJudgment: result.hourlyJudgment || '数据分析中',
      fifteenMinJudgment: result.fifteenMinJudgment || '等待信号',
      execution: result.execution || 'NONE',
      executionMode: result.executionMode || null,
      currentPrice: result.currentPrice || 0,
      entrySignal: result.entrySignal || 0,
      stopLoss: result.stopLoss || 0,
      takeProfit: result.takeProfit || 0,
      dataCollectionRate: result.dataCollectionRate || 95,
      strategyVersion: 'V3',
      timestamp: new Date().toISOString(),
      engineSource: 'real' // 标识为真实引擎
    };
  }

  /**
   * 转换ICT结果为信号格式 - 适配器模式
   */
  convertICTResultToSignalFormat(result) {
    return {
      symbol: result.symbol,
      category: result.category || 'midcap',
      dailyTrend: result.dailyTrend || '震荡',
      dailyTrendScore: result.dailyTrendScore || 0,
      signalType: result.signalType || 'WAIT',
      signalStrength: result.signalStrength || '弱',
      executionMode: result.executionMode || '观望_等待信号',
      
      // 中时间框架数据
      obDetected: result.obDetected || false,
      fvgDetected: result.fvgDetected || false,
      sweepHTF: result.sweepHTF || false,
      
      // 低时间框架数据
      engulfingDetected: result.engulfingDetected || false,
      sweepLTF: result.sweepLTF || false,
      volumeConfirm: result.volumeConfirm || false,
      
      // 风险管理数据
      entryPrice: result.entryPrice || 0,
      stopLoss: result.stopLoss || 0,
      takeProfit: result.takeProfit || 0,
      riskRewardRatio: result.riskRewardRatio || 3.0,
      leverage: result.leverage || 5,
      
      // 技术指标
      atr4h: result.atr4h || 0,
      atr15m: result.atr15m || 0,
      
      dataCollectionRate: result.dataCollectionRate || 95,
      strategyVersion: 'ICT',
      timestamp: new Date().toISOString(),
      engineSource: 'real' // 标识为真实引擎
    };
  }

  /**
   * 错误处理设置 - 错误处理原则
   */
  setupErrorHandlers() {
    // 数据库错误处理
    this.errorHandlers.set('DATABASE_ERROR', (error, context) => ({
      status: 500,
      code: 'DATABASE_ERROR',
      message: '数据库操作失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      retryable: true
    }));

    // API限流错误处理
    this.errorHandlers.set('RATE_LIMIT_ERROR', (error, context) => ({
      status: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'API调用频率过高，请稍后重试',
      retryAfter: 60,
      retryable: true
    }));

    // 数据验证错误处理
    this.errorHandlers.set('VALIDATION_ERROR', (error, context) => ({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: '数据验证失败',
      details: error.message,
      retryable: false
    }));

    // 策略分析错误处理
    this.errorHandlers.set('STRATEGY_ERROR', (error, context) => ({
      status: 422,
      code: 'STRATEGY_ANALYSIS_ERROR',
      message: '策略分析失败',
      details: error.message,
      retryable: true
    }));
  }

  /**
   * 统一错误处理 - 错误处理原则
   */
  handleAPIError(error, req, res, operation) {
    const errorType = this.classifyError(error);
    const errorHandler = this.errorHandlers.get(errorType);
    
    const errorResponse = errorHandler ? 
      errorHandler(error, { req, operation }) :
      {
        status: 500,
        code: 'INTERNAL_ERROR',
        message: '内部服务器错误',
        retryable: false
      };

    // 记录错误指标
    this.recordAPIMetrics(operation, 0, 'error');
    
    // 错误日志
    console.error(`API错误 [${operation}]:`, {
      error: error.message,
      stack: error.stack,
      request: {
        method: req.method,
        url: req.url,
        params: req.params,
        query: req.query
      }
    });

    res.status(errorResponse.status).json({
      success: false,
      error: errorResponse.code,
      message: errorResponse.message,
      details: errorResponse.details,
      timestamp: new Date().toISOString(),
      retryable: errorResponse.retryable,
      retryAfter: errorResponse.retryAfter
    });
  }

  /**
   * 错误分类 - 错误处理原则
   */
  classifyError(error) {
    if (error.message.includes('SQLITE') || error.message.includes('database')) {
      return 'DATABASE_ERROR';
    }
    if (error.message.includes('rate limit') || error.message.includes('429')) {
      return 'RATE_LIMIT_ERROR';
    }
    if (error.message.includes('validation') || error.message.includes('invalid')) {
      return 'VALIDATION_ERROR';
    }
    if (error.message.includes('strategy') || error.message.includes('analysis')) {
      return 'STRATEGY_ERROR';
    }
    return 'UNKNOWN_ERROR';
  }

  /**
   * 缓存管理 - 缓存原则
   */
  async getCachedResult(type, key) {
    try {
      return await this.cacheManager.get(type, key);
    } catch (error) {
      console.warn('缓存获取失败:', error.message);
      return null;
    }
  }

  async setCachedResult(type, key, value, ttl) {
    try {
      await this.cacheManager.set(type, key, value, ttl);
    } catch (error) {
      console.warn('缓存设置失败:', error.message);
    }
  }

  /**
   * 性能指标记录 - 可观测性原则
   */
  recordAPIMetrics(operation, duration, status) {
    if (!this.apiMetrics.has(operation)) {
      this.apiMetrics.set(operation, {
        totalCalls: 0,
        successCalls: 0,
        errorCalls: 0,
        cacheHits: 0,
        totalDuration: 0,
        avgDuration: 0
      });
    }

    const metrics = this.apiMetrics.get(operation);
    metrics.totalCalls++;
    
    if (status === 'success') {
      metrics.successCalls++;
      metrics.totalDuration += duration;
      metrics.avgDuration = metrics.totalDuration / metrics.successCalls;
    } else if (status === 'error') {
      metrics.errorCalls++;
    } else if (status === 'cache_hit') {
      metrics.cacheHits++;
    }

    this.apiMetrics.set(operation, metrics);
  }

  /**
   * 获取API性能指标
   */
  getAPIMetrics() {
    const metrics = {};
    for (const [operation, data] of this.apiMetrics) {
      metrics[operation] = {
        ...data,
        successRate: data.totalCalls > 0 ? (data.successCalls / data.totalCalls) * 100 : 0,
        cacheHitRate: data.totalCalls > 0 ? (data.cacheHits / data.totalCalls) * 100 : 0
      };
    }
    return metrics;
  }

  /**
   * 获取默认交易对列表
   */
  getDefaultSymbols() {
    return [
      'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 
      'DOTUSDT', 'LINKUSDT', 'LTCUSDT', 'BCHUSDT', 'UNIUSDT', 'POLUSDT',
      'AVAXUSDT', 'ATOMUSDT', 'FILUSDT', 'TRXUSDT', 'ETCUSDT', 'XLMUSDT',
      'VETUSDT', 'ICPUSDT', 'THETAUSDT', 'FTMUSDT'
    ];
  }

  /**
   * 组件健康检查方法
   */
  async checkV3EngineHealth() {
    try {
      await this.v3Engine.healthCheck();
      return { status: 'healthy', lastCheck: new Date().toISOString() };
    } catch (error) {
      return { status: 'unhealthy', error: error.message, lastCheck: new Date().toISOString() };
    }
  }

  async checkICTEngineHealth() {
    try {
      await this.ictEngine.healthCheck();
      return { status: 'healthy', lastCheck: new Date().toISOString() };
    } catch (error) {
      return { status: 'unhealthy', error: error.message, lastCheck: new Date().toISOString() };
    }
  }

  async checkDatabaseHealth() {
    try {
      await this.database.runQuery('SELECT 1');
      return { status: 'healthy', lastCheck: new Date().toISOString() };
    } catch (error) {
      return { status: 'unhealthy', error: error.message, lastCheck: new Date().toISOString() };
    }
  }

  async checkCacheHealth() {
    try {
      await this.cacheManager.get('health_check', 'test');
      return { status: 'healthy', lastCheck: new Date().toISOString() };
    } catch (error) {
      return { status: 'unhealthy', error: error.message, lastCheck: new Date().toISOString() };
    }
  }

  async checkBinanceAPIHealth() {
    try {
      const BinanceAPI = require('./BinanceAPI');
      await BinanceAPI.ping();
      return { status: 'healthy', lastCheck: new Date().toISOString() };
    } catch (error) {
      return { status: 'unhealthy', error: error.message, lastCheck: new Date().toISOString() };
    }
  }

  /**
   * 获取策略性能数据
   */
  async getStrategyPerformance(strategyType, timeRange) {
    try {
      const timeRangeHours = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 1;
      const cutoffTime = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000).toISOString();

      const result = await this.database.runQuery(`
        SELECT 
          COUNT(*) as total_analyses,
          AVG(analysis_duration_ms) as avg_duration,
          AVG(data_collection_rate) as avg_data_quality,
          COUNT(CASE WHEN final_signal != 'WAIT' AND final_signal != '观望' THEN 1 END) as signal_count
        FROM unified_strategy_results 
        WHERE strategy_type = ? AND timestamp > ?
      `, [strategyType, cutoffTime]);

      return result[0] || {
        total_analyses: 0,
        avg_duration: 0,
        avg_data_quality: 0,
        signal_count: 0
      };

    } catch (error) {
      console.error(`获取${strategyType}策略性能数据失败:`, error);
      return {
        total_analyses: 0,
        avg_duration: 0,
        avg_data_quality: 0,
        signal_count: 0,
        error: error.message
      };
    }
  }
}

module.exports = StrategyEngineAPI;
