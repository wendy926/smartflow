// StrategyV3Engine.js - V3策略引擎
// 严格按照strategy-v3.md文档实现的完整V3策略

const BinanceAPI = require('../../api/BinanceAPI');
const TechnicalIndicators = require('../../utils/TechnicalIndicators');
const V3TrendFilter = require('./V3TrendFilter');
const V3HourlyScoring = require('./V3HourlyScoring');
const V3ExecutionAnalyzer = require('./V3ExecutionAnalyzer');
const V3RangeMarketAnalyzer = require('./V3RangeMarketAnalyzer');

/**
 * V3策略引擎 - 严格按照strategy-v3.md文档实现
 * 
 * 实现流程:
 * 1. 4H趋势过滤: 10分打分机制，≥4分保留趋势
 * 2. 1H多因子打分: 6分制，VWAP必须一致，≥3分入场
 * 3. 15m执行: 模式A回踩确认，模式B突破确认
 * 4. 震荡市: 1H边界确认 + 15m假突破入场
 * 5. 出场条件: 6种出场原因
 */
class StrategyV3Engine {
  constructor(database, cacheManager) {
    this.database = database;
    this.cacheManager = cacheManager;
    
    // 核心分析组件
    this.trendFilter = new V3TrendFilter(database, cacheManager);
    this.hourlyScoring = new V3HourlyScoring(database, cacheManager);
    this.executionAnalyzer = new V3ExecutionAnalyzer(database, cacheManager);
    this.rangeAnalyzer = new V3RangeMarketAnalyzer(database, cacheManager);
    
    // 性能监控
    this.analysisMetrics = new Map();
    
    // 配置参数 (按strategy-v3.md文档)
    this.config = {
      // 4H趋势过滤配置
      trend4h: {
        minDirectionScore: 2,         // 每个方向至少2分
        totalScoreThreshold: 4,       // 总分≥4分保留趋势
        adxThreshold: 20,             // ADX阈值
        bbwExpansionRatio: 1.05,      // 布林带扩张比例
        momentumThreshold: 0.005      // 动量确认阈值0.5%
      },
      
      // 1H多因子打分配置
      hourly: {
        scoreThreshold: 3,            // ≥3分入场
        vwapRequired: true,           // VWAP方向必须一致
        volumeRatio15m: 1.5,          // 15m成交量≥1.5×20期均量
        volumeRatio1h: 1.2,           // 1h成交量≥1.2×20期均量
        oiChangeThresholdLong: 0.02,  // 多头OI变化≥+2%
        oiChangeThresholdShort: -0.03, // 空头OI变化≤-3%
        fundingRateMax: 0.0005,       // 资金费率范围±0.05%
        deltaRatioLong: 1.2,          // 多头Delta比率≥1.2
        deltaRatioShort: 0.8          // 空头Delta比率≤0.8
      },
      
      // 15m执行配置
      execution: {
        riskRewardRatio: 2,           // 固定2R风险回报比
        atrMultiplier: 1.2,           // ATR止损倍数
        maxTimeInPositionTrend: 12,   // 趋势市最大持仓12小时
        maxTimeInPositionRange: 3     // 震荡市最大持仓3小时
      },
      
      // 震荡市配置
      range: {
        boundaryScoreThreshold: 3,    // 边界确认阈值
        bbWidthThreshold: 0.05,       // 布林带宽收窄阈值5%
        fakeBreakoutRatio: 0.015,     // 假突破比例1.5%
        touchCountThreshold: 2        // 边界触碰次数阈值
      }
    };
  }

  /**
   * 完整的V3策略分析 - 主入口
   * @param {string} symbol - 交易对
   * @param {Object} options - 分析选项
   * @returns {Object} V3策略分析结果
   */
  async analyzeSymbol(symbol, options = {}) {
    const startTime = Date.now();
    
    try {
      console.log(`📊 开始V3策略引擎分析 [${symbol}]`);

      // 获取交易对分类信息
      const symbolCategory = await this.getSymbolCategory(symbol);

      // 第一步: 4H趋势过滤 - 严格按照strategy-v3.md文档10分打分机制
      const trend4hResult = await this.trendFilter.analyze4HTrend(symbol);
      
      console.log(`📈 4H趋势过滤完成 [${symbol}]: ${trend4hResult.trend4h} (得分: ${trend4hResult.totalScore}/10)`);

      // 根据4H趋势结果选择分析路径
      let finalResult;

      if (trend4hResult.trend4h === '多头趋势' || trend4hResult.trend4h === '空头趋势') {
        // 趋势市路径
        finalResult = await this.analyzeTrendMarket(symbol, trend4hResult, symbolCategory);
      } else {
        // 震荡市路径
        finalResult = await this.analyzeRangeMarket(symbol, trend4hResult, symbolCategory);
      }

      // 添加通用数据
      finalResult.symbol = symbol;
      finalResult.strategyType = 'V3';
      finalResult.strategyVersion = 'v3.0-strict';
      finalResult.symbolCategory = symbolCategory;
      finalResult.analysisTime = Date.now() - startTime;
      finalResult.timestamp = new Date().toISOString();
      finalResult.engineSource = 'real';

      // 存储分析结果
      await this.storeAnalysisResult(finalResult);

      console.log(`✅ V3策略分析完成 [${symbol}]: ${finalResult.execution || 'NONE'} (耗时: ${finalResult.analysisTime}ms)`);

      return finalResult;

    } catch (error) {
      console.error(`❌ V3策略分析失败 [${symbol}]:`, error);
      
      return this.createErrorResult(symbol, error.message, {
        analysisTime: Date.now() - startTime,
        error: error.stack
      });
    }
  }

  /**
   * 趋势市分析路径 - 严格按照strategy-v3.md文档
   */
  async analyzeTrendMarket(symbol, trend4hResult, symbolCategory) {
    try {
      console.log(`🎯 进入趋势市分析路径 [${symbol}]: ${trend4hResult.trend4h}`);

      // 第二步: 1H多因子打分 - 严格按照strategy-v3.md文档6分制
      const hourlyResult = await this.hourlyScoring.analyze1HScoring(symbol, trend4hResult, symbolCategory);
      
      console.log(`⚡ 1H多因子打分完成 [${symbol}]: ${hourlyResult.signal} (得分: ${hourlyResult.score}/6)`);

      // 检查1H多因子得分是否≥3分
      if (hourlyResult.score < this.config.hourly.scoreThreshold) {
        return this.createNoSignalResult(symbol, `1H多因子得分不足: ${hourlyResult.score} < ${this.config.hourly.scoreThreshold}`, {
          trend4h: trend4hResult,
          hourlyScoring: hourlyResult,
          marketType: '趋势市'
        });
      }

      // 第三步: 15m执行分析 - 模式A和模式B
      const executionResult = await this.executionAnalyzer.analyzeTrendExecution(symbol, hourlyResult, symbolCategory);
      
      console.log(`🚀 15m执行分析完成 [${symbol}]: ${executionResult.executionMode || 'NONE'}`);

      // 如果没有有效的执行信号
      if (!executionResult.hasValidExecution) {
        return this.createNoSignalResult(symbol, '15m执行条件不满足', {
          trend4h: trend4hResult,
          hourlyScoring: hourlyResult,
          execution15m: executionResult,
          marketType: '趋势市'
        });
      }

      // 第四步: 风险管理计算
      const riskManagement = await this.calculateTrendRiskManagement(executionResult, symbolCategory);

      // 生成最终趋势市信号
      return this.generateTrendMarketSignal({
        symbol,
        trend4h: trend4hResult,
        hourlyScoring: hourlyResult,
        execution15m: executionResult,
        riskManagement,
        symbolCategory
      });

    } catch (error) {
      console.error(`趋势市分析失败 [${symbol}]:`, error);
      throw error;
    }
  }

  /**
   * 震荡市分析路径 - 严格按照strategy-v3.md文档
   */
  async analyzeRangeMarket(symbol, trend4hResult, symbolCategory) {
    try {
      console.log(`📊 进入震荡市分析路径 [${symbol}]`);

      // 第二步: 1H边界确认 - 多因子边界有效性判断
      const boundaryResult = await this.rangeAnalyzer.analyze1HBoundary(symbol, symbolCategory);
      
      console.log(`🔄 1H边界分析完成 [${symbol}]: 上轨=${boundaryResult.upperValid}, 下轨=${boundaryResult.lowerValid}`);

      // 检查边界是否有效
      if (!boundaryResult.upperValid && !boundaryResult.lowerValid) {
        return this.createNoSignalResult(symbol, '1H边界无效', {
          trend4h: trend4hResult,
          boundaryAnalysis: boundaryResult,
          marketType: '震荡市'
        });
      }

      // 第三步: 15m假突破入场分析
      const fakeBreakoutResult = await this.rangeAnalyzer.analyze15mFakeBreakout(symbol, boundaryResult, symbolCategory);
      
      console.log(`⚡ 15m假突破分析完成 [${symbol}]: ${fakeBreakoutResult.fakeBreakoutDetected ? fakeBreakoutResult.direction : 'NONE'}`);

      // 如果没有检测到假突破
      if (!fakeBreakoutResult.fakeBreakoutDetected) {
        return this.createNoSignalResult(symbol, '15m假突破条件不满足', {
          trend4h: trend4hResult,
          boundaryAnalysis: boundaryResult,
          fakeBreakout: fakeBreakoutResult,
          marketType: '震荡市'
        });
      }

      // 第四步: 震荡市风险管理计算
      const riskManagement = await this.calculateRangeRiskManagement(fakeBreakoutResult, boundaryResult, symbolCategory);

      // 生成最终震荡市信号
      return this.generateRangeMarketSignal({
        symbol,
        trend4h: trend4hResult,
        boundaryAnalysis: boundaryResult,
        fakeBreakout: fakeBreakoutResult,
        riskManagement,
        symbolCategory
      });

    } catch (error) {
      console.error(`震荡市分析失败 [${symbol}]:`, error);
      throw error;
    }
  }

  /**
   * 趋势市风险管理计算
   */
  async calculateTrendRiskManagement(executionResult, symbolCategory) {
    const entry = executionResult.entryPrice;
    const setupCandle = executionResult.setupCandle;
    const direction = executionResult.direction;

    // 止损计算 - 按strategy-v3.md文档: setup candle另一端 或 1.2×ATR(14)，取更远者
    let stopLoss;
    if (direction === 'LONG') {
      const setupStopLoss = setupCandle.low;
      const atrStopLoss = entry - this.config.execution.atrMultiplier * executionResult.atr14;
      stopLoss = Math.min(setupStopLoss, atrStopLoss); // 取更远的(更小的)
    } else {
      const setupStopLoss = setupCandle.high;
      const atrStopLoss = entry + this.config.execution.atrMultiplier * executionResult.atr14;
      stopLoss = Math.max(setupStopLoss, atrStopLoss); // 取更远的(更大的)
    }

    // 止盈计算 - 固定2R
    const stopDistance = Math.abs(entry - stopLoss);
    const takeProfit = direction === 'LONG' ? 
      entry + this.config.execution.riskRewardRatio * stopDistance :
      entry - this.config.execution.riskRewardRatio * stopDistance;

    // 杠杆和保证金计算
    const stopDistancePercent = (stopDistance / entry) * 100;
    const maxLeverage = Math.floor(1 / (stopDistancePercent / 100 + 0.005)); // +0.5%安全边际
    const finalLeverage = Math.max(1, Math.min(maxLeverage, 125));

    return {
      entry,
      stopLoss,
      takeProfit,
      stopDistance,
      stopDistancePercent,
      riskRewardRatio: this.config.execution.riskRewardRatio,
      maxLeverage: finalLeverage,
      calculationMethod: 'v3_trend',
      marketType: '趋势市',
      maxHoldingTime: this.config.execution.maxTimeInPositionTrend
    };
  }

  /**
   * 震荡市风险管理计算
   */
  async calculateRangeRiskManagement(fakeBreakoutResult, boundaryResult, symbolCategory) {
    const entry = fakeBreakoutResult.entryPrice;
    const direction = fakeBreakoutResult.direction;

    // 震荡市止损 - 按strategy-v3.md文档: 区间边界失效
    let stopLoss;
    if (direction === 'LONG') {
      stopLoss = boundaryResult.lowerBoundary - fakeBreakoutResult.atr14;
    } else {
      stopLoss = boundaryResult.upperBoundary + fakeBreakoutResult.atr14;
    }

    // 震荡市止盈 - 固定1:2 RR
    const stopDistance = Math.abs(entry - stopLoss);
    const takeProfit = direction === 'LONG' ? 
      entry + 2 * stopDistance :
      entry - 2 * stopDistance;

    // 杠杆计算
    const stopDistancePercent = (stopDistance / entry) * 100;
    const maxLeverage = Math.floor(1 / (stopDistancePercent / 100 + 0.005));
    const finalLeverage = Math.max(1, Math.min(maxLeverage, 125));

    return {
      entry,
      stopLoss,
      takeProfit,
      stopDistance,
      stopDistancePercent,
      riskRewardRatio: 2, // 震荡市固定1:2
      maxLeverage: finalLeverage,
      calculationMethod: 'v3_range',
      marketType: '震荡市',
      maxHoldingTime: this.config.execution.maxTimeInPositionRange
    };
  }

  /**
   * 生成趋势市信号
   */
  generateTrendMarketSignal(analysisData) {
    const { symbol, trend4h, hourlyScoring, execution15m, riskManagement, symbolCategory } = analysisData;

    return {
      symbol,
      
      // 策略标识
      strategyType: 'V3',
      marketType: '趋势市',
      
      // 4H趋势数据
      trend4h: trend4h.trend4h,
      trendStrength: this.getTrendStrength(trend4h.totalScore),
      score: trend4h.totalScore,
      
      // 1H多因子数据
      signal: hourlyScoring.signal,
      hourlyJudgment: this.getHourlyJudgment(hourlyScoring),
      score1h: hourlyScoring.score,
      
      // 15m执行数据
      execution: execution15m.executionSignal,
      executionMode: execution15m.executionMode,
      fifteenMinJudgment: this.getFifteenMinJudgment(execution15m),
      
      // 价格和风险管理
      currentPrice: execution15m.currentPrice,
      entrySignal: riskManagement.entry,
      stopLoss: riskManagement.stopLoss,
      takeProfit: riskManagement.takeProfit,
      
      // 分类信息
      category: symbolCategory.category,
      
      // 数据质量
      dataCollectionRate: 100, // 真实引擎默认100%
      dataValid: true,
      
      // 完整分析数据
      fullAnalysisData: JSON.stringify({
        trend4h,
        hourlyScoring,
        execution15m,
        riskManagement
      }),
      
      timestamp: new Date().toISOString(),
      engineSource: 'real'
    };
  }

  /**
   * 生成震荡市信号
   */
  generateRangeMarketSignal(analysisData) {
    const { symbol, trend4h, boundaryAnalysis, fakeBreakout, riskManagement, symbolCategory } = analysisData;

    return {
      symbol,
      
      // 策略标识
      strategyType: 'V3',
      marketType: '震荡市',
      
      // 4H趋势数据
      trend4h: '震荡市',
      trendStrength: '无',
      score: trend4h.totalScore,
      
      // 1H边界数据
      signal: fakeBreakout.direction === 'LONG' ? '做多' : '做空',
      hourlyJudgment: this.getBoundaryJudgment(boundaryAnalysis),
      score1h: boundaryAnalysis.boundaryScore,
      
      // 15m假突破数据
      execution: `假突破_${fakeBreakout.direction}`,
      executionMode: fakeBreakout.mode,
      fifteenMinJudgment: this.getFakeBreakoutJudgment(fakeBreakout),
      
      // 价格和风险管理
      currentPrice: fakeBreakout.currentPrice,
      entrySignal: riskManagement.entry,
      stopLoss: riskManagement.stopLoss,
      takeProfit: riskManagement.takeProfit,
      
      // 分类信息
      category: symbolCategory.category,
      
      // 数据质量
      dataCollectionRate: 100,
      dataValid: true,
      
      // 完整分析数据
      fullAnalysisData: JSON.stringify({
        trend4h,
        boundaryAnalysis,
        fakeBreakout,
        riskManagement
      }),
      
      timestamp: new Date().toISOString(),
      engineSource: 'real'
    };
  }

  /**
   * 获取交易对分类信息
   */
  async getSymbolCategory(symbol) {
    try {
      const result = await this.database.runQuery(
        'SELECT * FROM symbol_categories WHERE symbol = ?',
        [symbol]
      );

      if (result && result.length > 0) {
        return result[0];
      }

      // 默认分类
      return {
        symbol,
        category: 'midcap',
        v3_vwap_weight: 0.35,
        v3_breakout_weight: 0.25,
        v3_volume_weight: 0.25,
        v3_oi_weight: 0.20,
        v3_delta_weight: 0.20,
        v3_funding_weight: 0.10
      };

    } catch (error) {
      console.warn(`获取交易对分类失败 [${symbol}]:`, error);
      return {
        symbol,
        category: 'midcap',
        v3_vwap_weight: 0.35,
        v3_breakout_weight: 0.25,
        v3_volume_weight: 0.25,
        v3_oi_weight: 0.20,
        v3_delta_weight: 0.20,
        v3_funding_weight: 0.10
      };
    }
  }

  /**
   * 获取趋势强度描述
   */
  getTrendStrength(score) {
    if (score >= 7) return '强';
    if (score >= 5) return '中';
    if (score >= 4) return '弱';
    return '无';
  }

  /**
   * 获取1H判断描述
   */
  getHourlyJudgment(hourlyResult) {
    if (hourlyResult.score >= 5) {
      return `${hourlyResult.signal}强势`;
    } else if (hourlyResult.score >= 4) {
      return `${hourlyResult.signal}延续`;
    } else if (hourlyResult.score >= 3) {
      return `${hourlyResult.signal}确认`;
    } else {
      return '观望等待';
    }
  }

  /**
   * 获取15m判断描述
   */
  getFifteenMinJudgment(executionResult) {
    if (executionResult.modeA && executionResult.modeB) {
      return '双模式确认';
    } else if (executionResult.modeA) {
      return '回踩确认';
    } else if (executionResult.modeB) {
      return '突破确认';
    } else {
      return '等待入场';
    }
  }

  /**
   * 获取边界判断描述
   */
  getBoundaryJudgment(boundaryResult) {
    if (boundaryResult.upperValid && boundaryResult.lowerValid) {
      return '双边界有效';
    } else if (boundaryResult.upperValid) {
      return '上轨有效';
    } else if (boundaryResult.lowerValid) {
      return '下轨有效';
    } else {
      return '边界无效';
    }
  }

  /**
   * 获取假突破判断描述
   */
  getFakeBreakoutJudgment(fakeBreakoutResult) {
    return `假突破_${fakeBreakoutResult.direction}_${fakeBreakoutResult.confidence > 0.8 ? '强' : '弱'}`;
  }

  /**
   * 创建无信号结果
   */
  createNoSignalResult(symbol, reason, analysisData = {}) {
    return {
      symbol,
      strategyType: 'V3',
      
      // 信号数据
      trend4h: analysisData.trend4h?.trend4h || '震荡市',
      signal: '观望',
      execution: 'NONE',
      
      // 判断描述
      hourlyJudgment: '数据分析中',
      fifteenMinJudgment: '等待信号',
      
      // 价格数据
      currentPrice: 0,
      entrySignal: 0,
      stopLoss: 0,
      takeProfit: 0,
      
      // 质量数据
      dataCollectionRate: 100,
      dataValid: true,
      
      // 原因和详细数据
      reason,
      ...analysisData,
      
      timestamp: new Date().toISOString(),
      engineSource: 'real'
    };
  }

  /**
   * 创建错误结果
   */
  createErrorResult(symbol, errorMessage, analysisData = {}) {
    return {
      symbol,
      strategyType: 'V3',
      error: errorMessage,
      dataValid: false,
      
      // 默认安全数据
      trend4h: '震荡市',
      signal: '观望',
      execution: 'NONE',
      currentPrice: 0,
      entrySignal: 0,
      stopLoss: 0,
      takeProfit: 0,
      dataCollectionRate: 0,
      
      ...analysisData,
      
      timestamp: new Date().toISOString(),
      engineSource: 'real'
    };
  }

  /**
   * 存储分析结果
   */
  async storeAnalysisResult(result) {
    try {
      await this.database.run(`
        INSERT OR REPLACE INTO unified_strategy_results 
        (symbol, strategy_type, final_signal, signal_strength, execution_mode, confidence_score,
         current_price, entry_price, stop_loss_price, take_profit_price, max_leverage, min_margin,
         risk_reward_ratio, data_collection_rate, analysis_duration_ms, full_analysis_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        result.symbol,
        'V3',
        result.execution || result.signal,
        result.trendStrength || '无',
        result.executionMode || result.execution,
        result.confidence || 0,
        result.currentPrice,
        result.entrySignal,
        result.stopLoss,
        result.takeProfit,
        result.maxLeverage || 10,
        result.minMargin || 100,
        result.riskRewardRatio || 2,
        result.dataCollectionRate,
        result.analysisTime,
        result.fullAnalysisData
      ]);
    } catch (error) {
      console.error('存储V3分析结果失败:', error);
    }
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    // 检查必要组件
    if (!this.database) throw new Error('数据库连接不可用');
    if (!this.cacheManager) throw new Error('缓存管理器不可用');
    
    // 检查各个分析组件
    await this.trendFilter.healthCheck();
    await this.hourlyScoring.healthCheck();
    await this.executionAnalyzer.healthCheck();
    await this.rangeAnalyzer.healthCheck();
    
    // 测试数据库连接
    await this.database.runQuery('SELECT 1');
    
    // 测试API连接
    await BinanceAPI.ping();
    
    return { status: 'healthy', timestamp: new Date().toISOString() };
  }

  /**
   * 获取引擎统计信息
   */
  getEngineStats() {
    return {
      config: this.config,
      analysisMetrics: Object.fromEntries(this.analysisMetrics),
      lastUpdate: new Date().toISOString()
    };
  }
}

module.exports = StrategyV3Engine;
