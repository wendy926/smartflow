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
   * 完整的V3策略分析 - 主入口（支持数据刷新频率管理）
   * @param {string} symbol - 交易对
   * @param {Object} options - 可选参数
   * @returns {Object} 完整的策略分析结果
   */
  static async analyzeSymbol(symbol, options = {}) {
    try {
      console.log(`🔍 开始V3策略分析 [${symbol}]`);

      // 1. 检查数据刷新频率（如果传入了dataRefreshManager）
      if (options.dataRefreshManager) {
        const shouldRefresh4H = await options.dataRefreshManager.shouldRefresh(symbol, '4h_trend');
        const shouldRefresh1H = await options.dataRefreshManager.shouldRefresh(symbol, '1h_scoring');
        const shouldRefresh15M = await options.dataRefreshManager.shouldRefresh(symbol, '15m_entry');

        console.log(`📊 数据刷新状态 [${symbol}]: 4H=${shouldRefresh4H}, 1H=${shouldRefresh1H}, 15M=${shouldRefresh15M}`);
      }

      // 2. 4H趋势过滤
      const trend4hResult = await this.core.analyze4HTrend(symbol);
      if (trend4hResult.error) {
        return this.createErrorResult(symbol, '4H趋势分析失败', trend4hResult.error);
      }

      const { trend4h, marketType } = trend4hResult;

      // 3. 根据市场类型进行不同分析
      let analysisResult;
      if (marketType === '趋势市') {
        analysisResult = await this.analyzeTrendMarket(symbol, trend4hResult);
      } else if (marketType === '震荡市') {
        analysisResult = await this.analyzeRangeMarket(symbol, trend4hResult);
      } else {
        analysisResult = this.createNoSignalResult(symbol, '市场类型未确定');
      }

      // 4. 获取当前价格
      let currentPrice = null;
      try {
        const ticker = await BinanceAPI.getTicker(symbol);
        currentPrice = parseFloat(ticker.lastPrice);
      } catch (error) {
        console.warn(`获取 ${symbol} 当前价格失败:`, error.message);
      }

      // 5. 合并结果
      const finalResult = {
        ...trend4hResult,
        ...analysisResult,
        symbol,
        currentPrice,
        timestamp: new Date().toISOString(),
        strategyVersion: 'V3',
        dataRefreshInfo: {
          last4hUpdate: new Date().toISOString(),
          last1hUpdate: new Date().toISOString(),
          last15mUpdate: new Date().toISOString(),
          lastDeltaUpdate: new Date().toISOString()
        }
      };

      // 6. 更新数据刷新时间（如果传入了dataRefreshManager）
      if (options.dataRefreshManager) {
        await options.dataRefreshManager.updateRefreshTime(symbol, '4h_trend');
        await options.dataRefreshManager.updateRefreshTime(symbol, '1h_scoring');
        await options.dataRefreshManager.updateRefreshTime(symbol, '15m_entry');
        await options.dataRefreshManager.updateRefreshTime(symbol, 'delta');
      }

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
        // 即使不允许入场，也要返回实际的得分，而不是0
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
          signal: 'NONE',
          execution: null,
          executionMode: 'NONE',
          entrySignal: null,
          stopLoss: null,
          takeProfit: null,
          reason: `1H打分不足: ${scoringResult.score}/3`
        };
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

      // 4. 计算杠杆和保证金数据
      const direction = executionResult.signal === 'BUY' ? 'LONG' : 'SHORT';
      let leverageData;
      try {
        leverageData = executionResult.signal !== 'NONE' ?
          await this.calculateLeverageData(executionResult.entry, executionResult.stopLoss, executionResult.atr14, direction) :
          { maxLeverage: null, minMargin: null, stopLossDistance: null, atrValue: executionResult.atr14 };
      } catch (error) {
        console.error(`杠杆数据计算失败 [${symbol}]:`, error);
        // 使用默认值作为备选
        leverageData = {
          maxLeverage: 10,
          minMargin: 100,
          stopLossDistance: 0,
          atrValue: executionResult.atr14 || 0
        };
      }


      // 5. 合并结果
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
        executionMode: executionResult.mode || 'NONE',
        entrySignal: executionResult.entry,
        stopLoss: executionResult.stopLoss,
        takeProfit: executionResult.takeProfit,
        setupCandleHigh: executionResult.setupCandleHigh,
        setupCandleLow: executionResult.setupCandleLow,
        atr14: executionResult.atr14,
        maxLeverage: leverageData.maxLeverage,
        minMargin: leverageData.minMargin,
        stopLossDistance: leverageData.stopLossDistance,
        atrValue: leverageData.atrValue,
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

      // 4. 计算杠杆和保证金数据
      const direction = executionResult.signal === 'BUY' ? 'LONG' : 'SHORT';
      let leverageData;
      try {
        leverageData = executionResult.signal !== 'NONE' ?
          await this.calculateLeverageData(executionResult.entry, executionResult.stopLoss, executionResult.atr14, direction) :
          { maxLeverage: null, minMargin: null, stopLossDistance: null, atrValue: executionResult.atr14 };
      } catch (error) {
        console.error(`杠杆数据计算失败 [${symbol}]:`, error);
        // 使用默认值作为备选
        leverageData = {
          maxLeverage: 10,
          minMargin: 100,
          stopLossDistance: 0,
          atrValue: executionResult.atr14 || 0
        };
      }


      // 5. 合并结果
      return {
        marketType: '震荡市',
        // 震荡市不需要1H多因子打分，但为了前端兼容性添加默认值
        score1h: 0,
        vwapDirectionConsistent: false,
        factors: {},
        vwap: rangeResult.vwap,
        vol15mRatio: 0,
        vol1hRatio: 0,
        oiChange6h: 0,
        fundingRate: 0,
        deltaImbalance: 0,
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
        executionMode: executionResult.mode || 'NONE',
        entrySignal: executionResult.entry,
        stopLoss: executionResult.stopLoss,
        takeProfit: executionResult.takeProfit,
        setupCandleHigh: executionResult.setupCandleHigh,
        setupCandleLow: executionResult.setupCandleLow,
        maxLeverage: leverageData.maxLeverage,
        minMargin: leverageData.minMargin,
        stopLossDistance: leverageData.stopLossDistance,
        atrValue: leverageData.atrValue,
        atr14: executionResult.atr14,
        reason: executionResult.reason
      };

    } catch (error) {
      console.error(`震荡市分析失败 [${symbol}]:`, error);
      return this.createNoSignalResult(symbol, '震荡市分析异常: ' + error.message);
    }
  }

  /**
   * 计算杠杆和保证金数据
   * 参考strategy-v2.md文档：
   * - 止损距离X%：多头：(entrySignal - stopLoss) / entrySignal，空头：(stopLoss - entrySignal) / entrySignal
   * - 最大杠杆数Y：1/(X%+0.5%) 数值向下取整
   * - 保证金Z：M/(Y*X%) 数值向上取整（M为最大损失金额）
   */
  static async calculateLeverageData(entryPrice, stopLossPrice, atr14, direction = 'SHORT') {
    try {
      // 获取全局最大损失设置
      const DatabaseManager = require('../database/DatabaseManager');
      const dbManager = new DatabaseManager();
      await dbManager.init();

      const globalMaxLoss = await dbManager.getUserSetting('maxLossAmount', 100);
      const maxLossAmount = parseFloat(globalMaxLoss);

      let maxLeverage = 0;
      let minMargin = 0;
      let stopLossDistance = 0;

      // 如果ATR值为null，使用默认值（入场价的1%）
      const effectiveATR = atr14 && atr14 > 0 ? atr14 : entryPrice * 0.01;


      if (entryPrice && stopLossPrice && entryPrice > 0) {
        // 根据方向计算止损距离百分比
        if (direction === 'LONG') {
          // 多头：止损价低于入场价
          stopLossDistance = (entryPrice - stopLossPrice) / entryPrice;
        } else {
          // 空头：止损价高于入场价
          stopLossDistance = (stopLossPrice - entryPrice) / entryPrice;
        }

        // 确保止损距离为正数
        stopLossDistance = Math.abs(stopLossDistance);

        // 最大杠杆数：1/(止损距离% + 0.5%) 数值向下取整
        if (stopLossDistance > 0) {
          maxLeverage = Math.floor(1 / (stopLossDistance + 0.005));
        }

        // 最小保证金：最大损失金额/(杠杆数 × 止损距离%) 数值向上取整
        if (maxLeverage > 0 && stopLossDistance > 0) {
          minMargin = Math.ceil(maxLossAmount / (maxLeverage * stopLossDistance));
        }
      }

      await dbManager.close();

      return {
        maxLeverage: Math.max(1, maxLeverage),
        minMargin: minMargin, // 按照文档计算的最小保证金，数值向上取整
        stopLossDistance: stopLossDistance * 100, // 转换为百分比
        atrValue: effectiveATR
      };
    } catch (error) {
      console.error('计算杠杆数据失败:', error);
      console.error('参数详情:', { entryPrice, stopLossPrice, atr14, direction });

      // 记录ATR计算失败的数据验证告警
      if (this.dataMonitor) {
        this.dataMonitor.recordDataValidationError(
          'ATR_CALCULATION_FAILED',
          `ATR计算失败: ${error.message}`,
          { entryPrice, stopLossPrice, atr14, direction, error: error.message }
        );
      }

      return {
        maxLeverage: 10,
        minMargin: 100,
        stopLossDistance: 0,
        atrValue: effectiveATR
      };
    }
  }

  /**
   * 格式化执行信号
   */
  static formatExecution(executionResult) {
    if (executionResult.signal === 'NONE' || !executionResult.signal) return null;

    const direction = executionResult.signal === 'BUY' || executionResult.signal === 'LONG' ? '做多' : '做空';
    const mode = executionResult.mode || 'NONE';
    return `${direction}_${mode}`;
  }

  /**
   * 创建无信号结果
   */
  static createNoSignalResult(symbol, reason) {
    return {
      symbol,  // 添加symbol字段
      trend4h: '震荡市',  // 添加默认4H趋势
      marketType: '震荡市',  // 添加默认市场类型
      signal: 'NONE',
      execution: null,
      executionMode: 'NONE',
      entrySignal: null,
      stopLoss: null,
      takeProfit: null,
      maxLeverage: 0,
      minMargin: 0,
      stopLossDistance: 0,
      atrValue: null,
      atr14: null,
      currentPrice: null,  // 添加当前价格字段
      reason,
      score1h: 0,
      vwapDirectionConsistent: false,
      rangeLowerBoundaryValid: false,
      rangeUpperBoundaryValid: false,
      factors: {}  // 添加factors字段
    };
  }

  /**
   * 创建错误结果
   */
  static createErrorResult(symbol, type, message) {
    return {
      symbol,
      trend4h: '震荡市',  // 添加默认4H趋势
      marketType: '震荡市',  // 添加默认市场类型
      signal: 'NONE',
      execution: null,
      executionMode: 'NONE',
      entrySignal: null,
      stopLoss: null,
      takeProfit: null,
      currentPrice: null,  // 添加当前价格字段
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
