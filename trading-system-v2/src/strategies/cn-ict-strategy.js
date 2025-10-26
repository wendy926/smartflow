/**
 * A股ICT策略
 * 复用现有ICT策略的核心方法，只需适配数据源
 */

const logger = require('../utils/logger');
const StrategyParameterLoader = require('../utils/strategy-param-loader');
const DatabaseConnection = require('../database/connection');

// 复用ICT策略的核心方法
const ICTStrategyCore = require('./ict-strategy');

class CNICTStrategy extends ICTStrategyCore {
  constructor() {
    super();
    this.name = 'CN-ICT';
    this.marketType = 'CN_STOCK';
    
    // 使用A股适配器
    this.adapter = null;  // 将在使用时注入
    
    // A股特定的参数调整
    this.timeframes = ['1d', '4h', '15m']; // A股用日线/小时线
    
    logger.info('[CN-ICT策略] A股策略初始化完成');
  }

  /**
   * 初始化（使用ICT核心逻辑）
   */
  async initializeParameters() {
    // 调用父类方法加载ICT参数
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
      const cnParams = await paramLoader.loadParameters('CN_ICT', 'BALANCED');
      return cnParams;
    } catch (error) {
      logger.warn('[CN-ICT] 使用默认ICT参数', error);
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
   * 执行策略（复用ICT核心逻辑）
   */
  async execute(symbol, marketData) {
    // 调用父类的execute方法
    return await super.execute(symbol, marketData);
  }

  /**
   * A股特定的订单块检测（如需要）
   */
  detectCNOrderBlocks(klines, timeframe) {
    // A股可能需要的订单块调整
    return super.detectOrderBlocks(klines, timeframe);
  }
}

module.exports = CNICTStrategy;

