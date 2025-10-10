/**
 * V3.1策略 - 整合版本
 * 基于原V3策略，集成了三个优化模块：
 * 1. 早期趋势探测（earlyTrendDetect）
 * 2. 假突破过滤器（fakeBreakoutFilter）
 * 3. 动态止损策略（dynamicStopLoss）
 * 
 * 数据库表:
 * - strategy_execution_logs (原v3_1_signal_logs)
 * - strategy_params (原v3_1_strategy_params)
 */

const V3Strategy = require('./v3-strategy');
const EarlyTrendDetector = require('./v3-1-early-trend');
const FakeBreakoutFilter = require('./v3-1-fake-breakout-filter');
const DynamicStopLossManager = require('./v3-1-dynamic-stop-loss');
const logger = require('../utils/logger');

class V3StrategyV31 extends V3Strategy {
  constructor() {
    super();
    this.name = 'V3.1';

    // 初始化V3.1优化模块
    this.earlyTrendDetector = new EarlyTrendDetector();
    this.fakeBreakoutFilter = new FakeBreakoutFilter();
    this.dynamicStopLossManager = new DynamicStopLossManager();

    logger.info('V3.1策略初始化完成，包含早期趋势、假突破过滤和动态止损模块');
  }

  /**
   * 执行完整的V3.1策略分析
   * @override
   */
  async execute(symbol) {
    try {
      logger.info(`开始执行V3.1策略分析: ${symbol}`);

      // 1. 获取基础数据（继承自V3）
      const [klines4H, klines1H, klines15M, ticker24hr, fundingRate, oiHistory] = await Promise.all([
        this.binanceAPI.getKlines(symbol, '4h', 250),
        this.binanceAPI.getKlines(symbol, '1h', 50),
        this.binanceAPI.getKlines(symbol, '15m', 50),
        this.binanceAPI.getTicker24hr(symbol),
        this.binanceAPI.getFundingRate(symbol),
        this.binanceAPI.getOpenInterestHist(symbol, '1h', 7)
      ]);

      // 检查数据有效性
      if (!klines4H || !klines1H || !klines15M || !ticker24hr) {
        throw new Error(`无法获取 ${symbol} 的完整数据`);
      }

      // 2. 【新增】早期趋势探测
      const earlyTrendResult = this.earlyTrendDetector.detect(klines1H, klines4H);
      logger.info(`[${symbol}] 早期趋势探测: ${earlyTrendResult.detected ? earlyTrendResult.signalType : '未检测到'}`);

      // 3. 执行4H趋势分析
      const trend4H = await this.analyze4HTrend(klines4H, {});

      // 4. 执行1H因子分析
      const factors1H = this.analyze1HFactors(symbol, klines1H, {
        ticker24hr,
        fundingRate,
        oiHistory,
        trend4H: trend4H?.trend
      });

      // 5. 执行15M入场分析
      const execution15M = await this.analyze15mExecution(symbol, klines15M, {
        trend: trend4H?.trend || 'RANGE',
        marketType: trend4H?.trend === 'RANGE' ? 'RANGE' : 'TREND'
      });

      // 6. 【修改】信号融合（加入早期趋势加权）
      const finalSignal = this.combineSignalsV31(
        trend4H,
        factors1H,
        execution15M,
        earlyTrendResult
      );

      logger.info(`[${symbol}] V3.1信号融合结果: ${finalSignal}`);

      // 7. 【新增】假突破过滤器检查（仅当有交易信号时）
      let filterResult = { passed: true, reason: 'No filter needed' };
      let confidence = 'med'; // 默认中等置信度

      if (finalSignal !== 'HOLD' && finalSignal !== 'ERROR') {
        const currentPrice = parseFloat(klines15M[klines15M.length - 1][4]);

        if (trend4H?.trend === 'RANGE') {
          // 震荡市使用震荡市过滤器
          filterResult = this.fakeBreakoutFilter.filterRange(
            finalSignal === 'BUY' ? 'LONG' : 'SHORT',
            klines15M,
            klines1H
          );
        } else {
          // 趋势市使用趋势市过滤器
          filterResult = this.fakeBreakoutFilter.filterTrend(
            currentPrice,
            klines15M,
            klines1H,
            klines4H
          );
        }

        // 根据过滤结果调整信号
        if (!filterResult.passed) {
          logger.info(`❌ [${symbol}] 假突破过滤器拒绝信号: ${filterResult.reason}`);
          // 信号被拒绝，改为HOLD
          return this._buildExecuteResult(
            symbol,
            'HOLD',
            trend4H,
            factors1H,
            execution15M,
            null,
            earlyTrendResult,
            filterResult
          );
        }

        logger.info(`✅ [${symbol}] 假突破过滤器通过`);

        // 8. 计算置信度（基于评分）
        confidence = this._calculateConfidence(trend4H, factors1H, execution15M, earlyTrendResult);
      }

      // 9. 【修改】使用动态止损计算交易参数
      let tradeParams = { entryPrice: 0, stopLoss: 0, takeProfit: 0, leverage: 0, margin: 0 };
      let dynamicStopParams = null;

      if (finalSignal !== 'HOLD' && finalSignal !== 'ERROR' && filterResult.passed) {
        try {
          const currentPrice = parseFloat(klines15M[klines15M.length - 1][4]);
          const atr = this.calculateATR(
            klines15M.map(k => parseFloat(k[2])),
            klines15M.map(k => parseFloat(k[3])),
            klines15M.map(k => parseFloat(k[4]))
          );
          const currentATR = atr[atr.length - 1];

          // 使用动态止损管理器计算
          const side = finalSignal === 'BUY' ? 'LONG' : 'SHORT';
          dynamicStopParams = this.dynamicStopLossManager.calculateInitial(
            currentPrice,
            side,
            currentATR,
            confidence
          );

          // 使用动态止损参数
          tradeParams = {
            entryPrice: currentPrice,
            stopLoss: dynamicStopParams.initialSL,
            takeProfit: dynamicStopParams.tp,
            leverage: this._calculateLeverage(currentPrice, dynamicStopParams.initialSL),
            margin: this._calculateMargin(currentPrice, dynamicStopParams.initialSL),
            confidence,
            atrMultiplier: dynamicStopParams.kEntry,
            timeStopMinutes: dynamicStopParams.timeStopMinutes
          };

          logger.info(`[${symbol}] V3.1交易参数: 入场=${currentPrice.toFixed(4)}, 止损=${dynamicStopParams.initialSL.toFixed(4)}, 止盈=${dynamicStopParams.tp.toFixed(4)}, 置信度=${confidence}`);
        } catch (error) {
          logger.error(`V3.1交易参数计算失败: ${error.message}`);
        }
      }

      // 10. 构建结果
      return this._buildExecuteResult(
        symbol,
        finalSignal,
        trend4H,
        factors1H,
        execution15M,
        tradeParams,
        earlyTrendResult,
        filterResult,
        dynamicStopParams
      );
    } catch (error) {
      logger.error(`V3.1策略执行失败: ${error.message}`);
      return {
        success: false,
        symbol,
        strategy: 'V3.1',
        signal: 'ERROR',
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * V3.1信号融合（加入早期趋势权重加成）
   * @param {Object} trend4H - 4H趋势分析
   * @param {Object} factors1H - 1H因子分析
   * @param {Object} execution15M - 15M入场分析
   * @param {Object} earlyTrendResult - 早期趋势探测结果
   * @returns {string} 最终信号
   */
  combineSignalsV31(trend4H, factors1H, execution15M, earlyTrendResult) {
    const trendDirection = trend4H.trendDirection || trend4H.trend;
    const trendScore = trend4H.score || 0;
    const factorScore = factors1H.totalScore || factors1H.score || 0;
    const entryScore = execution15M.score || 0;
    const structureScore = execution15M.structureScore || 0;

    // 计算动态权重
    let weights = this.calculateDynamicWeights(trendScore, factorScore, entryScore);

    // 【新增】如果检测到早期趋势，增加趋势权重
    if (earlyTrendResult.detected) {
      const bonus = earlyTrendResult.weightBonus || 0.1;
      weights.trend += bonus;

      // 重新归一化
      const sum = weights.trend + weights.factor + weights.entry;
      weights.trend /= sum;
      weights.factor /= sum;
      weights.entry /= sum;

      logger.info(`早期趋势加权: 趋势权重提升至${(weights.trend * 100).toFixed(1)}%`);
    }

    // 计算总分
    const totalScore = (
      (trendScore / 10) * weights.trend +
      (factorScore / 6) * weights.factor +
      (entryScore / 5) * weights.entry
    );

    const normalizedScore = Math.round(totalScore * 100);

    // 计算补偿值（早期趋势检测到时增加补偿）
    let compensation = this.calculateCompensation(normalizedScore, trendScore, factorScore, entryScore, structureScore);
    if (earlyTrendResult.detected) {
      compensation += 0.5; // 额外补偿
    }

    logger.info(`V3.1信号融合: 4H=${trendScore}/10, 1H=${factorScore}/6, 15M=${entryScore}/5, 早期趋势=${earlyTrendResult.detected}, 总分=${normalizedScore}%, 补偿=${compensation.toFixed(1)}`);

    // 获取调整后的因子门槛
    const adjustedThreshold = this.getAdjustedFactorThreshold(normalizedScore, trendScore, compensation);

    // 震荡市逻辑
    if (trendDirection === 'RANGE') {
      if (execution15M.signal && (execution15M.signal === 'BUY' || execution15M.signal === 'SELL')) {
        const reason = execution15M.reason || '';
        if (reason.includes('Range fake breakout') || reason.includes('震荡市')) {
          logger.info(`✅ V3.1震荡市假突破信号: ${execution15M.signal}`);
          return execution15M.signal;
        }
      }
      return 'HOLD';
    }

    // 趋势市信号判断（使用原V3逻辑，但门槛已被早期趋势调整）
    // 强信号
    if (normalizedScore >= 70 &&
      trendScore >= 6 &&
      factorScore >= adjustedThreshold.strong &&
      entryScore >= 1) {
      logger.info(`✅ V3.1强信号触发: 总分=${normalizedScore}%, 补偿=${compensation.toFixed(1)}`);
      return trendDirection === 'UP' ? 'BUY' : 'SELL';
    }

    // 中等信号
    if (normalizedScore >= 45 &&
      normalizedScore < 70 &&
      trendScore >= 5 &&
      factorScore >= adjustedThreshold.moderate &&
      entryScore >= 1) {
      logger.info(`⚠️ V3.1中等信号触发: 总分=${normalizedScore}%, 补偿=${compensation.toFixed(1)}`);
      return trendDirection === 'UP' ? 'BUY' : 'SELL';
    }

    // 弱信号
    if (normalizedScore >= 35 &&
      normalizedScore < 45 &&
      trendScore >= 4 &&
      factorScore >= adjustedThreshold.weak &&
      entryScore >= 1) {
      logger.info(`⚠️ V3.1弱信号触发: 总分=${normalizedScore}%, 补偿=${compensation.toFixed(1)}`);
      return trendDirection === 'UP' ? 'BUY' : 'SELL';
    }

    return 'HOLD';
  }

  /**
   * 计算置信度等级
   * @private
   */
  _calculateConfidence(trend4H, factors1H, execution15M, earlyTrendResult) {
    const trendScore = trend4H.score || 0;
    const factorScore = factors1H.totalScore || factors1H.score || 0;
    const entryScore = execution15M.score || 0;

    // 计算总分
    const totalScore = (trendScore / 10) * 0.5 + (factorScore / 6) * 0.35 + (entryScore / 5) * 0.15;
    const normalizedScore = Math.round(totalScore * 100);

    // 早期趋势加成
    let adjustedScore = normalizedScore;
    if (earlyTrendResult.detected) {
      adjustedScore += 5; // 加5分
    }

    // 按阈值分级
    if (adjustedScore >= 80) return 'high';
    if (adjustedScore >= 60) return 'med';
    if (adjustedScore >= 45) return 'low';
    return 'reject';
  }

  /**
   * 计算杠杆
   * @private
   */
  _calculateLeverage(entryPrice, stopLoss) {
    const stopLossDistance = Math.abs(entryPrice - stopLoss) / entryPrice;
    const calculatedLeverage = Math.floor(1 / (stopLossDistance + 0.005));
    return Math.min(calculatedLeverage, 24);
  }

  /**
   * 计算保证金
   * @private
   */
  _calculateMargin(entryPrice, stopLoss) {
    const maxLossAmount = 100;
    const leverage = this._calculateLeverage(entryPrice, stopLoss);
    const stopLossDistance = Math.abs(entryPrice - stopLoss) / entryPrice;
    return stopLossDistance > 0 ? Math.ceil(maxLossAmount / (leverage * stopLossDistance)) : 0;
  }

  /**
   * 构建执行结果
   * @private
   */
  _buildExecuteResult(symbol, signal, trend4H, factors1H, execution15M, tradeParams, earlyTrendResult, filterResult, dynamicStopParams = null) {
    return {
      success: true,
      symbol,
      strategy: 'V3.1',
      signal,
      timeframes: {
        '4H': trend4H,
        '1H': factors1H,
        '15M': execution15M
      },
      v31Modules: {
        earlyTrend: earlyTrendResult,
        fakeBreakoutFilter: filterResult,
        dynamicStop: dynamicStopParams
      },
      entryPrice: tradeParams?.entryPrice || 0,
      stopLoss: tradeParams?.stopLoss || 0,
      takeProfit: tradeParams?.takeProfit || 0,
      leverage: tradeParams?.leverage || 0,
      margin: tradeParams?.margin || 0,
      confidence: tradeParams?.confidence || 'med',
      atrMultiplier: tradeParams?.atrMultiplier || 2.0,
      timeStopMinutes: tradeParams?.timeStopMinutes || 60,
      timestamp: new Date()
    };
  }

  /**
   * 更新V3.1模块参数
   * @param {string} module - 模块名称 ('earlyTrend' / 'fakeBreakout' / 'dynamicStop')
   * @param {Object} params - 新参数
   */
  updateV31Params(module, params) {
    if (module === 'earlyTrend') {
      this.earlyTrendDetector.updateParams(params);
    } else if (module === 'fakeBreakout') {
      this.fakeBreakoutFilter.updateParams(params);
    } else if (module === 'dynamicStop') {
      this.dynamicStopLossManager.updateParams(params);
    } else {
      logger.warn(`未知的V3.1模块: ${module}`);
    }
  }

  /**
   * 获取V3.1模块参数
   * @param {string} module - 模块名称
   * @returns {Object} 模块参数
   */
  getV31Params(module) {
    if (module === 'earlyTrend') {
      return this.earlyTrendDetector.getParams();
    } else if (module === 'fakeBreakout') {
      return this.fakeBreakoutFilter.getParams();
    } else if (module === 'dynamicStop') {
      return this.dynamicStopLossManager.getParams();
    }
    return null;
  }
}

module.exports = V3StrategyV31;

