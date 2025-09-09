// modules/strategy/SmartFlowStrategyV3.js
// SmartFlow 交易策略V3核心模块 - 基于strategy-v3.md实现

const BinanceAPI = require('../api/BinanceAPI');
const StrategyV3Core = require('./StrategyV3Core');
const StrategyV3Execution = require('./StrategyV3Execution');
const { DataMonitor } = require('../monitoring/DataMonitor');

class SmartFlowStrategyV3 {
  static dataMonitor = new DataMonitor();
  static dataManager = null; // 将在初始化时设置
  static deltaManager = null; // 将在初始化时设置
  static core = new StrategyV3Core();
  static execution = new StrategyV3Execution();

  /**
   * 完整的V3策略分析 - 主入口
   * @param {string} symbol - 交易对
   * @param {Object} options - 可选参数
   * @returns {Object} 完整的策略分析结果
   */
  static async analyzeSymbol(symbol, options = {}) {
    try {
      console.log(`🔍 开始V3策略分析 [${symbol}]`);

      // 1. 4H趋势过滤
      const trend4hResult = await this.core.analyze4HTrend(symbol);
      if (trend4hResult.error) {
        return this.createErrorResult(symbol, '4H趋势分析失败', trend4hResult.error);
      }

      const { trend4h, marketType } = trend4hResult;

      // 2. 根据市场类型进行不同分析
      let analysisResult;
      if (marketType === '趋势市') {
        analysisResult = await this.analyzeTrendMarket(symbol, trend4hResult);
      } else if (marketType === '震荡市') {
        analysisResult = await this.analyzeRangeMarket(symbol, trend4hResult);
      } else {
        analysisResult = this.createNoSignalResult(symbol, '市场类型未确定');
      }

      // 3. 合并结果
      const finalResult = {
        ...trend4hResult,
        ...analysisResult,
        symbol,
        timestamp: new Date().toISOString(),
        strategyVersion: 'V3'
      };

      console.log(`✅ V3策略分析完成 [${symbol}]: ${marketType} - ${analysisResult.signal || 'NONE'}`);
      return finalResult;

    } catch (error) {
      console.error(`❌ V3策略分析失败 [${symbol}]:`, error);
      return this.createErrorResult(symbol, '策略分析异常', error.message);
    }
  }

  /**
   * 趋势市分析
   */
  static async analyzeTrendMarket(symbol, trend4hResult) {
    try {
      // 1. 1H多因子打分
      const scoringResult = await this.core.analyze1HScoring(symbol, trend4hResult.trend4h);
      if (scoringResult.error) {
        return this.createNoSignalResult(symbol, '1H打分分析失败: ' + scoringResult.error);
      }

      // 2. 检查是否允许入场
      if (!scoringResult.allowEntry) {
        return this.createNoSignalResult(symbol, `1H打分不足: ${scoringResult.score}/3`);
      }

      // 3. 15分钟入场执行
      const [klines15m, klines1h] = await Promise.all([
        BinanceAPI.getKlines(symbol, '15m', 50),
        BinanceAPI.getKlines(symbol, '1h', 50)
      ]);

      const candles15m = klines15m.map(k => ({
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));

      const candles1h = klines1h.map(k => ({
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));

      const executionResult = this.execution.analyzeTrendExecution(
        symbol,
        trend4hResult.trend4h,
        scoringResult.score,
        scoringResult.vwapDirectionConsistent,
        candles15m,
        candles1h
      );

      // 4. 合并结果
      return {
        marketType: '趋势市',
        score1h: scoringResult.score,
        vwapDirectionConsistent: scoringResult.vwapDirectionConsistent,
        factors: scoringResult.factors,
        vwap: scoringResult.vwap,
        vol15mRatio: scoringResult.vol15mRatio,
        vol1hRatio: scoringResult.vol1hRatio,
        oiChange6h: scoringResult.oiChange6h,
        fundingRate: scoringResult.fundingRate,
        deltaImbalance: scoringResult.deltaImbalance,
        signal: executionResult.signal,
        execution: executionResult.signal === 'NONE' ? null : this.formatExecution(executionResult),
        executionMode: executionResult.mode,
        entrySignal: executionResult.entry,
        stopLoss: executionResult.stopLoss,
        takeProfit: executionResult.takeProfit,
        setupCandleHigh: executionResult.setupCandleHigh,
        setupCandleLow: executionResult.setupCandleLow,
        atr14: executionResult.atr14,
        reason: executionResult.reason
      };

    } catch (error) {
      console.error(`趋势市分析失败 [${symbol}]:`, error);
      return this.createNoSignalResult(symbol, '趋势市分析异常: ' + error.message);
    }
  }

  /**
   * 震荡市分析
   */
  static async analyzeRangeMarket(symbol, trend4hResult) {
    try {
      // 1. 1H边界判断
      const rangeResult = await this.core.analyzeRangeBoundary(symbol);
      if (rangeResult.error) {
        return this.createNoSignalResult(symbol, '1H边界分析失败: ' + rangeResult.error);
      }

      // 2. 检查边界有效性
      if (!rangeResult.lowerBoundaryValid && !rangeResult.upperBoundaryValid) {
        return this.createNoSignalResult(symbol, '1H边界无效');
      }

      // 3. 15分钟入场执行
      const [klines15m, klines1h] = await Promise.all([
        BinanceAPI.getKlines(symbol, '15m', 50),
        BinanceAPI.getKlines(symbol, '1h', 50)
      ]);

      const candles15m = klines15m.map(k => ({
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));

      const candles1h = klines1h.map(k => ({
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));

      const executionResult = this.execution.analyzeRangeExecution(
        symbol,
        rangeResult,
        candles15m,
        candles1h
      );

      // 4. 合并结果
      return {
        marketType: '震荡市',
        rangeLowerBoundaryValid: rangeResult.lowerBoundaryValid,
        rangeUpperBoundaryValid: rangeResult.upperBoundaryValid,
        bbUpper: rangeResult.bbUpper,
        bbMiddle: rangeResult.bbMiddle,
        bbLower: rangeResult.bbLower,
        bbBandwidth: rangeResult.bbBandwidth,
        rangeVwap: rangeResult.vwap,
        rangeDelta: rangeResult.delta,
        touchesLower: rangeResult.touchesLower,
        touchesUpper: rangeResult.touchesUpper,
        volFactor: rangeResult.volFactor,
        lastBreakout: rangeResult.lastBreakout,
        signal: executionResult.signal,
        execution: executionResult.signal === 'NONE' ? null : this.formatExecution(executionResult),
        executionMode: executionResult.mode,
        entrySignal: executionResult.entry,
        stopLoss: executionResult.stopLoss,
        takeProfit: executionResult.takeProfit,
        setupCandleHigh: executionResult.setupCandleHigh,
        setupCandleLow: executionResult.setupCandleLow,
        reason: executionResult.reason
      };

    } catch (error) {
      console.error(`震荡市分析失败 [${symbol}]:`, error);
      return this.createNoSignalResult(symbol, '震荡市分析异常: ' + error.message);
    }
  }

  /**
   * 格式化执行信号
   */
  static formatExecution(executionResult) {
    if (executionResult.signal === 'NONE') return null;

    const direction = executionResult.signal === 'BUY' ? '做多' : '做空';
    return `${direction}_${executionResult.mode}`;
  }

  /**
   * 创建无信号结果
   */
  static createNoSignalResult(symbol, reason) {
    return {
      signal: 'NONE',
      execution: null,
      executionMode: 'NONE',
      entrySignal: null,
      stopLoss: null,
      takeProfit: null,
      reason,
      score1h: 0,
      vwapDirectionConsistent: false,
      rangeLowerBoundaryValid: false,
      rangeUpperBoundaryValid: false
    };
  }

  /**
   * 创建错误结果
   */
  static createErrorResult(symbol, type, message) {
    return {
      symbol,
      signal: 'NONE',
      execution: null,
      executionMode: 'NONE',
      entrySignal: null,
      stopLoss: null,
      takeProfit: null,
      reason: `${type}: ${message}`,
      error: true,
      errorType: type,
      errorMessage: message,
      score1h: 0,
      vwapDirectionConsistent: false,
      rangeLowerBoundaryValid: false,
      rangeUpperBoundaryValid: false
    };
  }

  /**
   * 批量分析多个交易对
   */
  static async analyzeMultipleSymbols(symbols, options = {}) {
    const results = [];
    const batchSize = options.batchSize || 5; // 控制并发数量

    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const batchPromises = batch.map(symbol => this.analyzeSymbol(symbol, options));

      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        console.error(`批量分析失败 [${batch.join(',')}]:`, error);
        // 为失败的批次创建错误结果
        const errorResults = batch.map(symbol =>
          this.createErrorResult(symbol, '批量分析失败', error.message)
        );
        results.push(...errorResults);
      }
    }

    return results;
  }

  /**
   * 更新Delta数据
   */
  static updateDeltaData(symbol, deltaBuy, deltaSell) {
    this.core.updateDeltaData(symbol, deltaBuy, deltaSell);
  }

  /**
   * 获取Delta数据
   */
  static getDeltaData(symbol) {
    return this.core.getDeltaData(symbol);
  }

  /**
   * 设置数据管理器
   */
  static setDataManager(dataManager) {
    this.dataManager = dataManager;
  }

  /**
   * 设置Delta管理器
   */
  static setDeltaManager(deltaManager) {
    this.deltaManager = deltaManager;
  }
}

module.exports = SmartFlowStrategyV3;
