// ICTStrategy.js - ICT交易策略主入口
// 基于ict.md文档实现的三层时间框架分析策略

const BinanceAPI = require('../../api/BinanceAPI');
const ICTCore = require('./ICTCore');
const ICTExecution = require('./ICTExecution');
const { DataMonitor } = require('../../monitoring/DataMonitor');

class ICTStrategy {
  static dataMonitor = new DataMonitor();
  static dataManager = null; // 将在初始化时设置
  static deltaManager = null; // 将在初始化时设置

  constructor(database = null) {
    this.database = database;
    this.core = new ICTCore(database);
    this.execution = new ICTExecution(database);
  }

  /**
   * 初始化ICT策略
   */
  static async init(database, dataManager = null, deltaManager = null) {
    this.dataManager = dataManager;
    this.deltaManager = deltaManager;
    console.log('✅ ICT策略初始化完成');
  }

  /**
   * ICT策略主分析方法
   * @param {string} symbol - 交易对
   * @param {Object} options - 分析选项
   * @returns {Object} ICT策略分析结果
   */
  static async analyzeSymbol(symbol, options = {}) {
    try {
      console.log(`🔍 开始ICT策略分析 [${symbol}]`);

      // 1. 高时间框架分析 (1D)
      const ictCore = new ICTCore();
      const dailyTrend = await ictCore.analyzeDailyTrend(symbol);
      if (dailyTrend.trend === 'sideways') {
        return ICTStrategy.createNoSignalResult(symbol, '1D趋势为震荡，忽略信号');
      }

      console.log(`📊 1D趋势分析 [${symbol}]: ${dailyTrend.trend}`);

      // 2. 中时间框架分析 (4H)
      const mtfResult = await ictCore.analyzeMTF(symbol, dailyTrend);

      // 即使没有4H OB/FVG，也继续分析，但记录状态
      if (!mtfResult.obDetected && !mtfResult.fvgDetected) {
        console.log(`📈 4H分析 [${symbol}]: 未检测到OB/FVG，但继续分析趋势`);
        // 设置默认的mtfResult
        mtfResult.obDetected = false;
        mtfResult.fvgDetected = false;
        mtfResult.sweepHTF = false;
      } else {
        console.log(`📈 4H分析 [${symbol}]: OB=${mtfResult.obDetected}, FVG=${mtfResult.fvgDetected}`);
      }

      // 3. 低时间框架分析 (15m)
      const ltfResult = await ictCore.analyzeLTF(symbol, mtfResult);

      // 即使没有15m入场信号，也返回趋势信息
      if (!ltfResult.entrySignal) {
        console.log(`⚡ 15m分析 [${symbol}]: 未检测到入场信号，但保留趋势信息`);
        // 返回包含趋势信息的结果，而不是完全的空结果
        return {
          symbol,
          dailyTrend: dailyTrend.trend,
          dailyTrendScore: dailyTrend.score,
          mtfResult,
          ltfResult,
          riskManagement: null,
          signalType: 'NONE',
          signalStrength: 'NONE',
          executionMode: 'NONE',
          dataCollectionRate: 100,
          timestamp: new Date().toISOString(),
          strategyVersion: 'ICT',
          dataValid: true,
          errorMessage: '15m未检测到入场信号'
        };
      }

      console.log(`⚡ 15m分析 [${symbol}]: 入场信号=${ltfResult.entrySignal}`);

      // 4. 风险管理
      const riskManagement = ICTExecution.calculateRiskManagement(ltfResult, options);

      // 5. 信号强度判断
      const signalStrength = ICTStrategy.calculateSignalStrength(mtfResult, ltfResult);
      const signalType = ICTStrategy.determineSignalType(dailyTrend.trend, ltfResult);

      const result = {
        symbol,
        dailyTrend: dailyTrend.trend,
        dailyTrendScore: dailyTrend.score,
        mtfResult,
        ltfResult,
        riskManagement,
        signalType,
        signalStrength,
        executionMode: ICTStrategy.determineExecutionMode(mtfResult, ltfResult),
        dataCollectionRate: 100, // 暂时设为100%，后续集成真实数据采集率
        timestamp: new Date().toISOString(),
        strategyVersion: 'ICT',
        dataValid: true,
        errorMessage: null
      };

      console.log(`✅ ICT策略分析完成 [${symbol}]: ${signalType} - ${signalStrength}`);
      return result;

    } catch (error) {
      console.error(`❌ ICT策略分析失败 [${symbol}]:`, error);
      return ICTStrategy.createErrorResult(symbol, error.message);
    }
  }

  /**
   * 计算信号强度
   */
  static calculateSignalStrength(mtfResult, ltfResult) {
    let score = 0;

    // 4H层面得分
    if (mtfResult.obDetected) score += 2;
    if (mtfResult.fvgDetected) score += 1;
    if (mtfResult.sweepHTF) score += 2;

    // 15m层面得分
    if (ltfResult.engulfing?.detected) score += 2;
    if (ltfResult.sweepLTF?.detected) score += 2;
    if (ltfResult.volumeConfirm) score += 1;

    if (score >= 6) return 'STRONG';
    if (score >= 4) return 'MODERATE';
    return 'WEAK';
  }

  /**
   * 确定信号类型
   */
  static determineSignalType(dailyTrend, ltfResult) {
    if (dailyTrend === 'up' && ltfResult.entrySignal) return 'LONG';
    if (dailyTrend === 'down' && ltfResult.entrySignal) return 'SHORT';
    return 'NONE';
  }

  /**
   * 确定执行模式
   */
  static determineExecutionMode(mtfResult, ltfResult) {
    if (mtfResult.obDetected && ltfResult.engulfing?.detected) {
      return 'OB_ENGULFING';
    }
    if (mtfResult.fvgDetected && ltfResult.sweepLTF?.detected) {
      return 'FVG_SWEEP';
    }
    if (ltfResult.engulfing?.detected && ltfResult.sweepLTF?.detected) {
      return 'ENGULFING_SWEEP';
    }
    return 'NONE';
  }

  /**
   * 创建无信号结果
   */
  static createNoSignalResult(symbol, reason) {
    return {
      symbol,
      dailyTrend: null,
      dailyTrendScore: 0,
      mtfResult: null,
      ltfResult: null,
      riskManagement: null,
      signalType: 'NONE',
      signalStrength: 'NONE',
      executionMode: 'NONE',
      dataCollectionRate: 100,
      timestamp: new Date().toISOString(),
      strategyVersion: 'ICT',
      dataValid: true,
      errorMessage: reason
    };
  }

  /**
   * 创建错误结果
   */
  static createErrorResult(symbol, errorMessage) {
    return {
      symbol,
      dailyTrend: null,
      dailyTrendScore: 0,
      mtfResult: null,
      ltfResult: null,
      riskManagement: null,
      signalType: 'NONE',
      signalStrength: 'NONE',
      executionMode: 'NONE',
      dataCollectionRate: 0,
      timestamp: new Date().toISOString(),
      strategyVersion: 'ICT',
      dataValid: false,
      errorMessage
    };
  }

  /**
   * 格式化执行信号显示
   */
  static formatExecution(signalType, executionMode) {
    if (signalType === 'NONE' || executionMode === 'NONE') {
      return 'NONE';
    }

    const direction = signalType === 'LONG' ? '做多' : '做空';
    const mode = executionMode.replace('_', '_');

    return `${direction}_${mode}`;
  }

  /**
   * 计算杠杆数据
   */
  static calculateLeverageData(entryPrice, stopLossPrice, takeProfitPrice, direction = 'LONG', maxLossAmount = 100) {
    try {
      // 输入验证
      if (!entryPrice || entryPrice <= 0 || !stopLossPrice || stopLossPrice <= 0) {
        throw new Error('Invalid price parameters');
      }

      const stopLossDistance = direction === 'LONG'
        ? (entryPrice - stopLossPrice) / entryPrice
        : (stopLossPrice - entryPrice) / entryPrice;

      const maxLeverage = Math.floor(1 / (stopLossDistance + 0.005));
      const minMargin = Math.ceil(maxLossAmount / (maxLeverage * stopLossDistance));

      return {
        maxLeverage: Math.max(1, Math.min(maxLeverage, 125)),
        minMargin: Math.max(10, minMargin),
        stopLossDistance: stopLossDistance * 100,
        atrValue: Math.abs(entryPrice - stopLossPrice),
        atr14: Math.abs(entryPrice - stopLossPrice),
        direction
      };
    } catch (error) {
      console.error('杠杆计算失败:', error);
      return {
        maxLeverage: 10,
        minMargin: 100,
        stopLossDistance: 2.0,
        atrValue: 0,
        atr14: 0,
        direction
      };
    }
  }
}

module.exports = ICTStrategy;
