/**
 * 策略引擎核心模块
 * 负责策略注册、参数管理和策略执行
 */

const logger = require('../utils/logger');

class StrategyEngine {
  constructor() {
    this.strategies = new Map();
    this.parameterManager = new ParameterManager();
    this.signalProcessor = new SignalProcessor();
  }

  /**
   * 注册策略
   * @param {string} name - 策略名称
   * @param {Class} strategyClass - 策略类
   */
  registerStrategy(name, strategyClass) {
    this.strategies.set(name, strategyClass);
    logger.info(`[策略引擎] 注册策略: ${name}`);
  }

  /**
   * 执行策略（参数驱动）
   * @param {string} strategyName - 策略名称
   * @param {string} mode - 模式 (AGGRESSIVE/BALANCED/CONSERVATIVE)
   * @param {Object} marketData - 市场数据
   * @param {Object} parameters - 策略参数
   * @returns {Object} 策略执行结果
   */
  async executeStrategy(strategyName, mode, marketData, parameters = {}) {
    try {
      const StrategyClass = this.strategies.get(strategyName);
      if (!StrategyClass) {
        throw new Error(`策略未注册: ${strategyName}`);
      }

      // 创建策略实例
      const strategy = new StrategyClass();

      // 应用参数
      strategy.applyParameters(parameters);
      strategy.setMode(mode);

      // 执行策略
      const result = await strategy.execute(marketData);

      // 后处理信号
      const processedResult = this.signalProcessor.process(result, mode);

      logger.info(`[策略引擎] ${strategyName}-${mode}: 执行完成, 信号=${processedResult.signal}, 置信度=${processedResult.confidence}`);

      return processedResult;
    } catch (error) {
      logger.error(`[策略引擎] ${strategyName}-${mode}: 执行失败`, error);
      return {
        signal: 'HOLD',
        confidence: 'low',
        error: error.message
      };
    }
  }

  /**
   * 获取策略参数
   * @param {string} strategyName - 策略名称
   * @param {string} mode - 模式
   * @returns {Object} 策略参数
   */
  getStrategyParameters(strategyName, mode) {
    return this.parameterManager.getParameters(strategyName, mode);
  }

  /**
   * 设置策略参数
   * @param {string} strategyName - 策略名称
   * @param {string} mode - 模式
   * @param {Object} parameters - 参数
   */
  setStrategyParameters(strategyName, mode, parameters) {
    this.parameterManager.setParameters(strategyName, mode, parameters);
  }
}

/**
 * 参数管理器
 */
class ParameterManager {
  constructor() {
    this.parameterSets = new Map();
    this.initializeDefaultParameters();
  }

  /**
   * 初始化默认参数
   */
  initializeDefaultParameters() {
    // V3策略参数
    this.parameterSets.set('V3-AGGRESSIVE', {
      // 趋势判断参数
      trend4HStrongThreshold: 0.4,
      trend4HModerateThreshold: 0.2,
      trend4HWeakThreshold: 0.1,

      // 入场信号参数
      entry15MStrongThreshold: 0.3,
      entry15MModerateThreshold: 0.15,
      entry15MWeakThreshold: 0.08,

      // 止损止盈参数
      stopLossATRMultiplier: 0.3,
      takeProfitRatio: 3.0,

      // 假突破过滤参数
      fakeBreakoutFilter: {
        volFactor: 0.1,
        deltaThreshold: 0.0002,
        reclaimPct: 0.0005
      }
    });

    this.parameterSets.set('V3-BALANCED', {
      // 趋势判断参数
      trend4HStrongThreshold: 0.6,
      trend4HModerateThreshold: 0.4,
      trend4HWeakThreshold: 0.2,

      // 入场信号参数
      entry15MStrongThreshold: 0.5,
      entry15MModerateThreshold: 0.3,
      entry15MWeakThreshold: 0.15,

      // 止损止盈参数
      stopLossATRMultiplier: 0.5,
      takeProfitRatio: 3.0,

      // 假突破过滤参数
      fakeBreakoutFilter: {
        volFactor: 0.2,
        deltaThreshold: 0.0005,
        reclaimPct: 0.001
      }
    });

    this.parameterSets.set('V3-CONSERVATIVE', {
      // 趋势判断参数
      trend4HStrongThreshold: 0.8,
      trend4HModerateThreshold: 0.6,
      trend4HWeakThreshold: 0.4,

      // 入场信号参数
      entry15MStrongThreshold: 0.7,
      entry15MModerateThreshold: 0.5,
      entry15MWeakThreshold: 0.3,

      // 止损止盈参数
      stopLossATRMultiplier: 0.7,
      takeProfitRatio: 3.0,

      // 假突破过滤参数
      fakeBreakoutFilter: {
        volFactor: 0.3,
        deltaThreshold: 0.001,
        reclaimPct: 0.002
      }
    });

    // ICT策略参数
    this.parameterSets.set('ICT-AGGRESSIVE', {
      // 趋势判断参数
      trend4HStrongThreshold: 0.4,
      trend4HModerateThreshold: 0.2,
      trend4HWeakThreshold: 0.1,

      // 入场信号参数
      entry15MStrongThreshold: 0.3,
      entry15MModerateThreshold: 0.15,
      entry15MWeakThreshold: 0.08,

      // 止损止盈参数
      stopLossATRMultiplier: 0.3,
      takeProfitRatio: 3.0,

      // ICT特有参数
      liquiditySweepThreshold: 0.001,
      orderBlockStrength: 0.4,
      fairValueGapThreshold: 0.0005,
      marketStructureBreakThreshold: 0.003
    });

    this.parameterSets.set('ICT-BALANCED', {
      // 趋势判断参数
      trend4HStrongThreshold: 0.6,
      trend4HModerateThreshold: 0.4,
      trend4HWeakThreshold: 0.2,

      // 入场信号参数
      entry15MStrongThreshold: 0.5,
      entry15MModerateThreshold: 0.3,
      entry15MWeakThreshold: 0.15,

      // 止损止盈参数
      stopLossATRMultiplier: 0.5,
      takeProfitRatio: 3.0,

      // ICT特有参数
      liquiditySweepThreshold: 0.002,
      orderBlockStrength: 0.6,
      fairValueGapThreshold: 0.001,
      marketStructureBreakThreshold: 0.005
    });

    this.parameterSets.set('ICT-CONSERVATIVE', {
      // 趋势判断参数
      trend4HStrongThreshold: 0.8,
      trend4HModerateThreshold: 0.6,
      trend4HWeakThreshold: 0.4,

      // 入场信号参数
      entry15MStrongThreshold: 0.7,
      entry15MModerateThreshold: 0.5,
      entry15MWeakThreshold: 0.3,

      // 止损止盈参数
      stopLossATRMultiplier: 0.7,
      takeProfitRatio: 3.0,

      // ICT特有参数
      liquiditySweepThreshold: 0.003,
      orderBlockStrength: 0.8,
      fairValueGapThreshold: 0.002,
      marketStructureBreakThreshold: 0.008
    });
  }

  /**
   * 获取参数
   * @param {string} strategyName - 策略名称
   * @param {string} mode - 模式
   * @returns {Object} 参数
   */
  getParameters(strategyName, mode) {
    const key = `${strategyName}-${mode}`;
    return this.parameterSets.get(key) || {};
  }

  /**
   * 设置参数
   * @param {string} strategyName - 策略名称
   * @param {string} mode - 模式
   * @param {Object} parameters - 参数
   */
  setParameters(strategyName, mode, parameters) {
    const key = `${strategyName}-${mode}`;
    this.parameterSets.set(key, { ...this.parameterSets.get(key), ...parameters });
    logger.info(`[参数管理器] 设置参数: ${key}`, parameters);
  }

  /**
   * 验证参数
   * @param {Object} parameters - 参数
   * @returns {boolean} 是否有效
   */
  validateParameters(parameters) {
    const requiredFields = ['trend4HStrongThreshold', 'entry15MStrongThreshold', 'stopLossATRMultiplier', 'takeProfitRatio'];
    return requiredFields.every(field => parameters.hasOwnProperty(field));
  }
}

/**
 * 信号处理器
 */
class SignalProcessor {
  constructor() {
    this.filters = [];
    this.validators = [];
  }

  /**
   * 处理信号
   * @param {Object} signal - 原始信号
   * @param {string} mode - 模式
   * @returns {Object} 处理后的信号
   */
  process(signal, mode) {
    // 应用过滤器
    let processedSignal = signal;
    for (const filter of this.filters) {
      processedSignal = filter.apply(processedSignal, mode);
    }

    // 验证信号
    for (const validator of this.validators) {
      if (!validator.validate(processedSignal, mode)) {
        return {
          signal: 'HOLD',
          confidence: 'low',
          reason: '信号验证失败'
        };
      }
    }

    return processedSignal;
  }

  /**
   * 添加过滤器
   * @param {Object} filter - 过滤器
   */
  addFilter(filter) {
    this.filters.push(filter);
  }

  /**
   * 添加验证器
   * @param {Object} validator - 验证器
   */
  addValidator(validator) {
    this.validators.push(validator);
  }
}

module.exports = { StrategyEngine, ParameterManager, SignalProcessor };
