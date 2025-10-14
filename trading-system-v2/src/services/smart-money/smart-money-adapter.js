/**
 * 聪明钱检测适配器
 * 将四阶段检测器集成到现有聪明钱系统中
 * 保持向后兼容性，同时提供新的四阶段功能
 * 
 * 设计原则：
 * 1. 适配器模式：桥接新旧系统
 * 2. 单一职责：专注于系统集成
 * 3. 开闭原则：支持新功能扩展
 * 4. 接口隔离：提供统一的检测接口
 */

const { FourPhaseSmartMoneyDetector, SmartMoneyStage } = require('./four-phase-detector');
const logger = require('../../utils/logger');

/**
 * 聪明钱检测适配器
 */
class SmartMoneyAdapter {
  constructor(database, binanceAPI, largeOrderDetector = null) {
    this.database = database;
    this.binanceAPI = binanceAPI;
    this.largeOrderDetector = largeOrderDetector;

    // 四阶段检测器
    this.fourPhaseDetector = new FourPhaseSmartMoneyDetector(
      database,
      binanceAPI,
      largeOrderDetector
    );

    // 兼容性映射
    this.compatibilityMapping = {
      [SmartMoneyStage.ACCUMULATION]: 'ACCUMULATE',
      [SmartMoneyStage.MARKUP]: 'MARKUP',
      [SmartMoneyStage.DISTRIBUTION]: 'DISTRIBUTION',
      [SmartMoneyStage.MARKDOWN]: 'MARKDOWN',
      [SmartMoneyStage.NEUTRAL]: 'UNKNOWN'
    };

    // 中文动作映射
    this.actionMapping = {
      [SmartMoneyStage.ACCUMULATION]: '吸筹',
      [SmartMoneyStage.MARKUP]: '拉升',
      [SmartMoneyStage.DISTRIBUTION]: '派发',
      [SmartMoneyStage.MARKDOWN]: '砸盘',
      [SmartMoneyStage.NEUTRAL]: '无动作'
    };
  }

  /**
   * 初始化适配器
   */
  async initialize() {
    try {
      await this.fourPhaseDetector.initialize();
      logger.info('[聪明钱适配器] 初始化完成');
    } catch (error) {
      logger.error('[聪明钱适配器] 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 检测单个交易对的聪明钱信号（兼容原有接口）
   * @param {string} symbol - 交易对
   * @returns {Promise<Object>} 检测结果
   */
  async detectSmartMoney(symbol) {
    try {
      // 使用四阶段检测器
      const result = await this.fourPhaseDetector.detect(symbol);

      // 转换为兼容格式
      return {
        symbol: result.symbol,
        action: this.compatibilityMapping[result.stage],
        actionChinese: result.action,
        confidence: result.confidence,
        score: result.confidence * 100,
        isSmartMoney: result.confidence > 0.6,
        isTrap: false, // 四阶段检测器暂不检测陷阱
        reasons: result.reasons,
        indicators: {
          obi: result.indicators.obi,
          obiZ: result.indicators.obiZ,
          cvdZ: result.indicators.cvdZ,
          volRatio: result.indicators.volRatio,
          delta: result.indicators.delta15,
          priceDropPct: result.indicators.priceDropPct
        },
        stage: result.stage,
        stageInfo: {
          current: result.stage,
          confidence: result.confidence,
          scores: result.scores,
          largeOrdersCount: result.largeOrders
        },
        timestamp: result.timestamp
      };
    } catch (error) {
      logger.error(`[聪明钱适配器] 检测${symbol}失败:`, error);
      return {
        symbol,
        action: 'UNKNOWN',
        actionChinese: '无动作',
        confidence: 0,
        score: 0,
        isSmartMoney: false,
        isTrap: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 批量检测多个交易对（兼容原有接口）
   * @param {Array<string>} symbols - 交易对列表
   * @returns {Promise<Array>} 检测结果列表
   */
  async detectBatch(symbols) {
    try {
      const results = await this.fourPhaseDetector.detectBatch(symbols);

      // 转换为兼容格式
      return results.map(result => ({
        symbol: result.symbol,
        action: this.compatibilityMapping[result.stage],
        actionChinese: result.action,
        confidence: result.confidence,
        score: result.confidence * 100,
        isSmartMoney: result.confidence > 0.6,
        isTrap: false,
        reasons: result.reasons,
        indicators: {
          obi: result.indicators?.obi || 0,
          obiZ: result.indicators?.obiZ || 0,
          cvdZ: result.indicators?.cvdZ || 0,
          volRatio: result.indicators?.volRatio || 0,
          delta: result.indicators?.delta15 || 0,
          priceDropPct: result.indicators?.priceDropPct || 0
        },
        stage: result.stage,
        stageInfo: {
          current: result.stage,
          confidence: result.confidence,
          scores: result.scores || {},
          largeOrdersCount: result.largeOrders || 0
        },
        timestamp: result.timestamp
      }));
    } catch (error) {
      logger.error('[聪明钱适配器] 批量检测失败:', error);
      const symbolsToProcess = symbols || [];
      return symbolsToProcess.map(symbol => ({
        symbol,
        action: 'UNKNOWN',
        actionChinese: '无动作',
        confidence: 0,
        score: 0,
        isSmartMoney: false,
        isTrap: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }));
    }
  }

  /**
   * 获取四阶段详细信息（新接口）
   * @param {string} symbol - 交易对
   * @returns {Promise<Object>} 四阶段详细信息
   */
  async getFourPhaseDetails(symbol) {
    try {
      const result = await this.fourPhaseDetector.detect(symbol);

      return {
        symbol: result.symbol,
        stage: result.stage,
        action: result.action,
        confidence: result.confidence,
        reasons: result.reasons,
        scores: result.scores,
        indicators: result.indicators,
        largeOrdersCount: result.largeOrders,
        stageHistory: this.getStageHistory(symbol),
        timestamp: result.timestamp
      };
    } catch (error) {
      logger.error(`[聪明钱适配器] 获取${symbol}四阶段详情失败:`, error);
      return {
        symbol,
        stage: SmartMoneyStage.NEUTRAL,
        action: '无动作',
        confidence: 0,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 获取所有交易对的四阶段状态（新接口）
   * @returns {Object} 所有交易对的状态
   */
  getAllFourPhaseStates() {
    try {
      const states = this.fourPhaseDetector.getAllStates();
      const result = {};

      for (const [symbol, state] of Object.entries(states)) {
        result[symbol] = {
          stage: state.stage,
          action: state.action,
          confidence: state.confidence,
          since: state.since,
          duration: Date.now() - state.since,
          reasons: state.reasons,
          scores: state.scores
        };
      }

      return result;
    } catch (error) {
      logger.error('[聪明钱适配器] 获取所有四阶段状态失败:', error);
      return {};
    }
  }

  /**
   * 获取阶段历史（从数据库）
   * @private
   */
  getStageHistory(symbol) {
    // 这里可以从数据库查询历史阶段变化
    // 暂时返回空数组
    return [];
  }

  /**
   * 更新检测参数
   * @param {Object} params - 新参数
   */
  async updateParameters(params) {
    try {
      await this.fourPhaseDetector.updateParameters(params);
      logger.info('[聪明钱适配器] 参数更新完成');
    } catch (error) {
      logger.error('[聪明钱适配器] 参数更新失败:', error);
      throw error;
    }
  }

  /**
   * 获取当前参数配置
   * @returns {Object} 当前参数
   */
  getParameters() {
    return { ...this.fourPhaseDetector.params };
  }

  /**
   * 重置交易对状态
   * @param {string} symbol - 交易对
   */
  resetSymbolState(symbol) {
    this.fourPhaseDetector.stateMap.set(symbol, {
      stage: SmartMoneyStage.NEUTRAL,
      since: Date.now(),
      confidence: 0,
      reasons: [],
      scores: {}
    });
  }

  /**
   * 获取检测器统计信息
   * @returns {Object} 统计信息
   */
  getStatistics() {
    const states = this.fourPhaseDetector.getAllStates();
    const symbols = Object.keys(states);

    const stageCounts = {};
    for (const stage of Object.values(SmartMoneyStage)) {
      stageCounts[stage] = 0;
    }

    for (const state of Object.values(states)) {
      stageCounts[state.stage]++;
    }

    return {
      totalSymbols: symbols.length,
      stageCounts,
      averageConfidence: symbols.length > 0
        ? symbols.reduce((sum, symbol) => sum + states[symbol].confidence, 0) / symbols.length
        : 0
    };
  }

  /**
   * 加载监控交易对列表（兼容性方法）
   * @returns {Promise<Array>} 监控交易对列表
   */
  async loadWatchList() {
    try {
      // 从数据库获取监控列表
      const [rows] = await this.database.pool.query(`
        SELECT symbol FROM smart_money_watch_list WHERE is_active = 1
      `);

      return rows.map(row => row.symbol);
    } catch (error) {
      logger.error('[聪明钱适配器] 加载监控列表失败:', error);
      return [];
    }
  }

  /**
   * 批量检测（兼容性方法）
   * @param {Array<string>} symbols - 交易对列表
   * @returns {Promise<Array>} 检测结果
   */
  async detectBatchV2(symbols) {
    return this.detectBatch(symbols);
  }
}

module.exports = SmartMoneyAdapter;
