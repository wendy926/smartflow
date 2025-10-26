/**
 * AI服务接口定义
 * 定义所有AI服务必须实现的接口
 */

const logger = require('../../utils/logger');

// AI提供商枚举
const AIProvider = {
  CLAUDE: 'claude',
  DEEPSEEK: 'deepseek',
  OPENAI: 'openai',
  GEMINI: 'gemini'
};

// AI服务类型枚举
const AIServiceType = {
  MARKET_ANALYSIS: 'market_analysis',
  SIGNAL_GENERATION: 'signal_generation',
  RISK_ASSESSMENT: 'risk_assessment',
  PARAMETER_OPTIMIZATION: 'parameter_optimization',
  SENTIMENT_ANALYSIS: 'sentiment_analysis'
};

// 市场趋势枚举
const MarketTrend = {
  BULLISH: 'BULLISH',
  BEARISH: 'BEARISH',
  SIDEWAYS: 'SIDEWAYS'
};

// 交易信号枚举
const TradingSignal = {
  BUY: 'BUY',
  SELL: 'SELL',
  HOLD: 'HOLD'
};

// 风险等级枚举
const RiskLevel = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
};

/**
 * 市场分析结果模型
 */
class MarketAnalysis {
  constructor(data = {}) {
    this.trend = data.trend || MarketTrend.SIDEWAYS;
    this.strength = data.strength || 0; // 0-100
    this.confidence = data.confidence || 0; // 0-100
    this.factors = data.factors || [];
    this.recommendation = data.recommendation || '';
    this.timestamp = data.timestamp || new Date();
    this.marketType = data.marketType;
    this.symbol = data.symbol;
  }
}

/**
 * 分析因子模型
 */
class AnalysisFactor {
  constructor(name, value, weight, impact) {
    this.name = name;
    this.value = value;
    this.weight = weight; // 0-1
    this.impact = impact; // POSITIVE/NEGATIVE/NEUTRAL
    this.description = '';
  }
}

/**
 * 交易信号模型
 */
class TradingSignalResult {
  constructor(data = {}) {
    this.action = data.action || TradingSignal.HOLD;
    this.confidence = data.confidence || 0; // 0-100
    this.reasoning = data.reasoning || '';
    this.riskLevel = data.riskLevel || RiskLevel.MEDIUM;
    this.expectedReturn = data.expectedReturn || 0;
    this.stopLoss = data.stopLoss;
    this.takeProfit = data.takeProfit;
    this.positionSize = data.positionSize;
    this.timestamp = data.timestamp || new Date();
    this.strategy = data.strategy;
    this.marketType = data.marketType;
    this.symbol = data.symbol;
  }
}

/**
 * 风险评估结果模型
 */
class RiskAssessment {
  constructor(data = {}) {
    this.overallRisk = data.overallRisk || RiskLevel.MEDIUM;
    this.riskScore = data.riskScore || 50; // 0-100
    this.factors = data.factors || [];
    this.recommendations = data.recommendations || [];
    this.maxPositionSize = data.maxPositionSize || 0;
    this.stopLossLevel = data.stopLossLevel || 0;
    this.timestamp = data.timestamp || new Date();
    this.portfolio = data.portfolio;
  }
}

/**
 * 参数优化结果模型
 */
class OptimizedParameters {
  constructor(data = {}) {
    this.strategy = data.strategy;
    this.parameters = data.parameters || {};
    this.performance = data.performance || {};
    this.confidence = data.confidence || 0;
    this.backtestResults = data.backtestResults || {};
    this.timestamp = data.timestamp || new Date();
  }
}

/**
 * 情感分析结果模型
 */
class SentimentAnalysis {
  constructor(data = {}) {
    this.sentiment = data.sentiment || 'NEUTRAL'; // POSITIVE/NEGATIVE/NEUTRAL
    this.score = data.score || 0; // -1 to 1
    this.confidence = data.confidence || 0; // 0-100
    this.sources = data.sources || [];
    this.keywords = data.keywords || [];
    this.timestamp = data.timestamp || new Date();
    this.marketType = data.marketType;
    this.symbol = data.symbol;
  }
}

/**
 * AI服务接口
 * 所有AI服务必须实现此接口
 */
class IAIService {
  constructor() {
    if (this.constructor === IAIService) {
      throw new Error('IAIService is an abstract class and cannot be instantiated');
    }
  }

  /**
   * 获取AI服务信息
   */
  getServiceInfo() {
    throw new Error('getServiceInfo method must be implemented');
  }

  /**
   * 分析市场数据
   * @param {Array} marketData - 市场数据数组
   * @param {Object} context - 分析上下文
   * @returns {Promise<MarketAnalysis>} 市场分析结果
   */
  async analyzeMarket(marketData, context = {}) {
    throw new Error('analyzeMarket method must be implemented');
  }

  /**
   * 生成交易信号
   * @param {string} strategy - 策略名称
   * @param {Object} context - 信号生成上下文
   * @returns {Promise<TradingSignalResult>} 交易信号
   */
  async generateSignal(strategy, context) {
    throw new Error('generateSignal method must be implemented');
  }

  /**
   * 评估风险
   * @param {Object} portfolio - 投资组合
   * @param {Object} context - 风险评估上下文
   * @returns {Promise<RiskAssessment>} 风险评估结果
   */
  async assessRisk(portfolio, context = {}) {
    throw new Error('assessRisk method must be implemented');
  }

  /**
   * 优化参数
   * @param {string} strategy - 策略名称
   * @param {Array} history - 历史回测结果
   * @param {Object} context - 优化上下文
   * @returns {Promise<OptimizedParameters>} 优化后的参数
   */
  async optimizeParameters(strategy, history, context = {}) {
    throw new Error('optimizeParameters method must be implemented');
  }

  /**
   * 情感分析
   * @param {Array} textData - 文本数据
   * @param {Object} context - 分析上下文
   * @returns {Promise<SentimentAnalysis>} 情感分析结果
   */
  async analyzeSentiment(textData, context = {}) {
    throw new Error('analyzeSentiment method must be implemented');
  }

  /**
   * 检查服务健康状态
   * @returns {Promise<boolean>} 服务是否健康
   */
  async healthCheck() {
    throw new Error('healthCheck method must be implemented');
  }

  /**
   * 获取服务统计信息
   * @returns {Promise<Object>} 统计信息
   */
  async getStats() {
    throw new Error('getStats method must be implemented');
  }
}

/**
 * AI服务管理器
 * 管理多个AI服务实例
 */
class AIServiceManager {
  constructor() {
    this.services = new Map();
    this.defaultProvider = null;
    this.region = null;
  }

  /**
   * 注册AI服务
   * @param {string} name - 服务名称
   * @param {IAIService} service - AI服务实例
   */
  registerService(name, service) {
    this.services.set(name, service);
    logger.info(`[AIServiceManager] Registered AI service: ${name}`);
  }

  /**
   * 获取AI服务
   * @param {string} name - 服务名称
   * @returns {IAIService} AI服务实例
   */
  getService(name) {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`AI service not found: ${name}`);
    }
    return service;
  }

  /**
   * 设置默认提供商
   * @param {string} provider - 提供商名称
   */
  setDefaultProvider(provider) {
    this.defaultProvider = provider;
  }

  /**
   * 设置区域
   * @param {string} region - 区域名称
   */
  setRegion(region) {
    this.region = region;
  }

  /**
   * 获取默认服务
   * @returns {IAIService} 默认AI服务
   */
  getDefaultService() {
    if (!this.defaultProvider) {
      throw new Error('No default provider set');
    }
    return this.getService(this.defaultProvider);
  }

  /**
   * 分析市场（使用默认服务）
   * @param {Array} marketData - 市场数据
   * @param {Object} context - 分析上下文
   * @returns {Promise<MarketAnalysis>} 市场分析结果
   */
  async analyzeMarket(marketData, context = {}) {
    const service = this.getDefaultService();
    return await service.analyzeMarket(marketData, context);
  }

  /**
   * 生成交易信号（使用默认服务）
   * @param {string} strategy - 策略名称
   * @param {Object} context - 信号生成上下文
   * @returns {Promise<TradingSignalResult>} 交易信号
   */
  async generateSignal(strategy, context) {
    const service = this.getDefaultService();
    return await service.generateSignal(strategy, context);
  }

  /**
   * 评估风险（使用默认服务）
   * @param {Object} portfolio - 投资组合
   * @param {Object} context - 风险评估上下文
   * @returns {Promise<RiskAssessment>} 风险评估结果
   */
  async assessRisk(portfolio, context = {}) {
    const service = this.getDefaultService();
    return await service.assessRisk(portfolio, context);
  }

  /**
   * 优化参数（使用默认服务）
   * @param {string} strategy - 策略名称
   * @param {Array} history - 历史回测结果
   * @param {Object} context - 优化上下文
   * @returns {Promise<OptimizedParameters>} 优化后的参数
   */
  async optimizeParameters(strategy, history, context = {}) {
    const service = this.getDefaultService();
    return await service.optimizeParameters(strategy, history, context);
  }

  /**
   * 情感分析（使用默认服务）
   * @param {Array} textData - 文本数据
   * @param {Object} context - 分析上下文
   * @returns {Promise<SentimentAnalysis>} 情感分析结果
   */
  async analyzeSentiment(textData, context = {}) {
    const service = this.getDefaultService();
    return await service.analyzeSentiment(textData, context);
  }

  /**
   * 检查所有服务健康状态
   * @returns {Promise<Object>} 健康状态报告
   */
  async healthCheckAll() {
    const results = {};

    for (const [name, service] of this.services) {
      try {
        results[name] = {
          healthy: await service.healthCheck(),
          stats: await service.getStats()
        };
      } catch (error) {
        results[name] = {
          healthy: false,
          error: error.message
        };
      }
    }

    return results;
  }

  /**
   * 获取所有服务统计信息
   * @returns {Promise<Object>} 统计信息
   */
  async getAllStats() {
    const stats = {};

    for (const [name, service] of this.services) {
      try {
        stats[name] = await service.getStats();
      } catch (error) {
        stats[name] = { error: error.message };
      }
    }

    return stats;
  }
}

module.exports = {
  AIProvider,
  AIServiceType,
  MarketTrend,
  TradingSignal,
  RiskLevel,
  MarketAnalysis,
  AnalysisFactor,
  TradingSignalResult,
  RiskAssessment,
  OptimizedParameters,
  SentimentAnalysis,
  IAIService,
  AIServiceManager
};
