/**
 * A股V3策略
 * 复用现有V3策略的核心方法，只需适配数据源
 */

const TechnicalIndicators = require('../utils/technical-indicators');
const logger = require('../utils/logger');
const StrategyParameterLoader = require('../utils/strategy-param-loader');
const DatabaseConnection = require('../database/connection');

// 复用V3策略的核心方法
const V3StrategyCore = require('./v3-strategy');

class CNV3Strategy extends V3StrategyCore {
  constructor() {
    super();
    this.name = 'CN-V3';
    this.marketType = 'CN_STOCK';
    
    // 使用A股适配器
    this.adapter = null;  // 将在使用时注入
    
    // A股特定的参数调整
    this.timeframes = ['1d', '4h', '15m']; // A股用日线/小时线
    
    logger.info('[CN-V3策略] A股策略初始化完成');
  }

  /**
   * 初始化（使用V3核心逻辑）
   */
  async initializeParameters() {
    // 调用父类方法加载V3参数
    await super.initializeParameters();
    
    // A股特定参数调整（如果需要）
    this.params = await this.loadCNParameters();
  }

  /**
   * 加载A股特定参数
   */
  async loadCNParameters() {
    try {
      const dbConnection = DatabaseConnection.getInstance();
      const paramLoader = new StrategyParameterLoader(dbConnection);
      const cnParams = await paramLoader.loadParameters('CN_V3', 'BALANCED');
      return cnParams;
    } catch (error) {
      logger.warn('[CN-V3] 使用默认V3参数', error);
      return this.params;
    }
  }

  /**
   * 获取K线数据（适配A股数据源）
   */
  async getKlines(symbol, timeframe, limit) {
    // 使用注入的adapter获取数据
    if (!this.adapter) {
      throw new Error('Adapter not initialized');
    }
    
    return await this.adapter.getKlines(symbol, timeframe, limit);
  }

  /**
   * 执行策略（复用V3核心逻辑）
   */
  async execute(symbol, marketData) {
    // 调用父类的execute方法
    return await super.execute(symbol, marketData);
  }

  /**
   * A股特定的风险评估（如需要）
   */
  calculateCNRisk(price, atr, volatility) {
    // A股可能需要的额外风险评估
    // 例如：考虑涨跌停、流动性等
    return {
      riskScore: 0,
      riskLevel: 'NORMAL'
    };
  }
}

module.exports = CNV3Strategy;

