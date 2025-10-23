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
const V31ParameterConfigs = require('./v3-1-parameter-configs');
const logger = require('../utils/logger');

class V3StrategyV31 extends V3Strategy {
  constructor() {
    super();
    this.name = 'V3.1';

    // 初始化V3.1优化模块
    this.earlyTrendDetector = new EarlyTrendDetector();
    this.fakeBreakoutFilter = new FakeBreakoutFilter();
    this.dynamicStopLossManager = new DynamicStopLossManager();
    this.parameterConfigs = new V31ParameterConfigs();

    // V3.1特有参数
    this.adaptiveParameters = true; // 启用自适应参数

    logger.info('V3.1策略初始化完成，包含早期趋势、假突破过滤、动态止损和自适应参数模块');
  }

  /**
   * 执行完整的V3.1策略分析
   * @override
   */
  async execute(symbol) {
    try {
      logger.info(`开始执行V3.1策略分析: ${symbol}`);
      console.log(`[V3.1策略] ${symbol}: 开始执行策略分析`);

      // 1. 获取基础数据（继承自V3）
      console.log(`[V3.1策略] ${symbol}: 开始获取基础数据`);
      const [klines4H, klines1H, klines15M, ticker24hr, fundingRate, oiHistory] = await Promise.all([
        this.binanceAPI.getKlines(symbol, '4h', 250),
        this.binanceAPI.getKlines(symbol, '1h', 50),
        this.binanceAPI.getKlines(symbol, '15m', 50),
        this.binanceAPI.getTicker24hr(symbol),
        this.binanceAPI.getFundingRate(symbol),
        this.binanceAPI.getOpenInterestHist(symbol, '1h', 7)
      ]);

      console.log(`[V3.1策略] ${symbol}: 数据获取完成 - 4H:${klines4H?.length || 0}条, 1H:${klines1H?.length || 0}条, 15M:${klines15M?.length || 0}条`);

      // 检查数据有效性
      if (!klines4H || !klines1H || !klines15M || !ticker24hr) {
        console.error(`[V3.1策略] ${symbol}: 数据获取失败 - 4H:${!!klines4H}, 1H:${!!klines1H}, 15M:${!!klines15M}, ticker:${!!ticker24hr}`);
        throw new Error(`无法获取 ${symbol} 的完整数据`);
      }

      // 2. 【新增】早期趋势探测
      console.log(`[V3.1策略] ${symbol}: 开始早期趋势探测`);
      const earlyTrendResult = this.earlyTrendDetector.detect(klines1H, klines4H);
      console.log(`[V3.1策略] ${symbol}: 早期趋势探测结果 - 检测到:${earlyTrendResult.detected}, 信号类型:${earlyTrendResult.signalType || '无'}`);
      logger.info(`[${symbol}] 早期趋势探测: ${earlyTrendResult.detected ? earlyTrendResult.signalType : '未检测到'}`);

      // 3. 执行4H趋势分析
      console.log(`[V3.1策略] ${symbol}: 开始4H趋势分析`);
      const trend4H = await this.analyze4HTrend(klines4H, {});
      console.log(`[V3.1策略] ${symbol}: 4H趋势分析完成 - 趋势:${trend4H?.trend || '未知'}, 评分:${trend4H?.score || 0}`);

      // 3.1. 【新增】计算4H ATR用于动态止损
      const atr4H = this.calculateATR(
        klines4H.map(k => parseFloat(k[2])),
        klines4H.map(k => parseFloat(k[3])),
        klines4H.map(k => parseFloat(k[4]))
      );
      const currentATR4H = atr4H[atr4H.length - 1];
      console.log(`[V3.1策略] ${symbol}: 4H ATR计算完成 - ATR:${currentATR4H.toFixed(4)}`);
      logger.info(`[${symbol}] 4H ATR: ${currentATR4H.toFixed(4)}`);

      // 4. 执行1H因子分析
      console.log(`[V3.1策略] ${symbol}: 开始1H因子分析`);
      const factors1H = this.analyze1HFactors(symbol, klines1H, {
        ticker24hr,
        fundingRate,
        oiHistory,
        trend4H: trend4H?.trend
      });
      console.log(`[V3.1策略] ${symbol}: 1H因子分析完成 - 总分:${factors1H?.totalScore || factors1H?.score || 0}`);

      // 5. 执行15M入场分析
      console.log(`[V3.1策略] ${symbol}: 开始15M入场分析`);
      const execution15M = await this.analyze15mExecution(symbol, klines15M, {
        trend: trend4H?.trend || 'RANGE',
        marketType: trend4H?.trend === 'RANGE' ? 'RANGE' : 'TREND'
      });
      console.log(`[V3.1策略] ${symbol}: 15M入场分析完成 - 信号:${execution15M?.signal || 'HOLD'}, 评分:${execution15M?.score || 0}`);

      // 6. 【修改】信号融合（加入早期趋势加权）
      console.log(`[V3.1策略] ${symbol}: 开始信号融合`);
      const finalSignal = this.combineSignalsV31(
        trend4H,
        factors1H,
        execution15M,
        earlyTrendResult
      );
      console.log(`[V3.1策略] ${symbol}: 信号融合完成 - 最终信号:${finalSignal}`);
      logger.info(`[${symbol}] V3.1信号融合结果: ${finalSignal}`);

      // 7. 【优化】假突破过滤器检查（仅当有交易信号时）
      let filterResult = { passed: true, reason: 'No signal to filter' };
      let confidence = 'med'; // 默认中等置信度

      if (finalSignal !== 'HOLD' && finalSignal !== 'ERROR') {
        console.log(`[V3.1策略] ${symbol}: 开始假突破过滤器检查 - 信号:${finalSignal}`);

        // 计算趋势评分用于弱化过滤
        const trendScore = trend4H.score || 0;
        console.log(`[V3.1策略] ${symbol}: 趋势评分:${trendScore}`);

        // 调用假突破过滤器，传入趋势评分
        filterResult = this.fakeBreakoutFilter.filterTrend(
          parseFloat(klines15M[klines15M.length - 1][4]),
          klines15M,
          klines1H,
          klines4H,
          trendScore
        );

        console.log(`[V3.1策略] ${symbol}: 假突破过滤器结果 - 通过:${filterResult.passed}, 原因:${filterResult.reason}`);

        if (filterResult.passed) {
          console.log(`[V3.1策略] ${symbol}: ✅ 假突破过滤器通过: ${finalSignal}`);
          logger.info(`✅ [${symbol}] 假突破过滤器通过: ${finalSignal}`);
          // 8. 计算置信度（基于评分）
          confidence = this._calculateConfidence(trend4H, factors1H, execution15M, earlyTrendResult);
        } else {
          console.log(`[V3.1策略] ${symbol}: ❌ 假突破过滤器拒绝: ${filterResult.reason}`);
          logger.info(`❌ [${symbol}] 假突破过滤器拒绝: ${filterResult.reason}`);
          finalSignal = 'HOLD'; // 被过滤的信号改为HOLD
        }
      } else {
        console.log(`[V3.1策略] ${symbol}: 无交易信号，跳过假突破过滤器检查`);
      }

      // 9. 【修改】使用动态止损计算交易参数
      let tradeParams = { entryPrice: 0, stopLoss: 0, takeProfit: 0, leverage: 0, margin: 0 };
      let dynamicStopParams = null;

      if (finalSignal !== 'HOLD' && finalSignal !== 'ERROR' && filterResult.passed) {
        try {
          const currentPrice = parseFloat(klines15M[klines15M.length - 1][4]);

          // 【优化】使用4H ATR进行动态止损计算（更稳定的止损距离）
          const atr15M = this.calculateATR(
            klines15M.map(k => parseFloat(k[2])),
            klines15M.map(k => parseFloat(k[3])),
            klines15M.map(k => parseFloat(k[4]))
          );
          const currentATR15M = atr15M[atr15M.length - 1];

          // 使用4H ATR作为主要止损参考，15M ATR作为辅助
          const primaryATR = currentATR4H || currentATR15M;
          logger.info(`[${symbol}] ATR计算: 4H=${currentATR4H.toFixed(4)}, 15M=${currentATR15M.toFixed(4)}, 使用=${primaryATR.toFixed(4)}`);

          // 使用动态止损管理器计算
          const side = finalSignal === 'BUY' ? 'LONG' : 'SHORT';
          dynamicStopParams = this.dynamicStopLossManager.calculateInitial(
            currentPrice,
            side,
            primaryATR,
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
      const bonus = earlyTrendResult.weightBonus || 0.05; // 降低权重奖励
      weights.trend += bonus;

      // 重新归一化
      const sum = weights.trend + weights.factor + weights.entry;
      weights.trend /= sum;
      weights.factor /= sum;
      weights.entry /= sum;

      logger.info(`早期趋势加权: 趋势权重提升至${(weights.trend * 100).toFixed(1)}%`);
    }

    // 【新增】确保入场权重保持≥25%，防止趋势末端滞后
    const minEntryWeight = 0.25;
    if (weights.entry < minEntryWeight) {
      const adjustment = minEntryWeight - weights.entry;
      weights.entry = minEntryWeight;
      weights.trend = Math.max(0.3, weights.trend - adjustment * 0.6); // 主要从趋势权重调整
      weights.factor = Math.max(0.1, weights.factor - adjustment * 0.4); // 部分从因子权重调整

      logger.info(`入场权重调整: 确保≥25%, 调整后 entry=${(weights.entry * 100).toFixed(1)}%, trend=${(weights.trend * 100).toFixed(1)}%, factor=${(weights.factor * 100).toFixed(1)}%`);
    }

    // 【新增】MACD收缩检测：防止趋势末端追高
    const macdContraction = this._detectMacdContraction(factors1H);
    if (macdContraction && trendScore >= 8) {
      weights.trend = Math.max(0.3, weights.trend * 0.8); // 降低趋势权重
      weights.entry = Math.min(0.4, weights.entry * 1.2); // 提高入场权重

      logger.info(`MACD收缩检测: 降低趋势权重，提高入场权重`);
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

    // 趋势市信号判断（大幅降低阈值确保有交易信号）
    // 强信号 - 大幅降低阈值
    if (normalizedScore >= 15 &&
      trendScore >= 1.0 &&
      factorScore >= adjustedThreshold.strong * 0.5 &&
      entryScore >= 0.3) {
      logger.info(`✅ V3.1强信号触发: 总分=${normalizedScore}%, 补偿=${compensation.toFixed(1)}`);
      return trendDirection === 'UP' ? 'BUY' : 'SELL';
    }

    // 中等信号 - 大幅降低阈值
    if (normalizedScore >= 10 &&
      normalizedScore < 15 &&
      trendScore >= 0.8 &&
      factorScore >= adjustedThreshold.moderate * 0.5 &&
      entryScore >= 0.2) {
      logger.info(`⚠️ V3.1中等信号触发: 总分=${normalizedScore}%, 补偿=${compensation.toFixed(1)}`);
      return trendDirection === 'UP' ? 'BUY' : 'SELL';
    }

    // 弱信号 - 大幅降低阈值
    if (normalizedScore >= 6 &&
      normalizedScore < 10 &&
      trendScore >= 0.5 &&
      factorScore >= adjustedThreshold.weak * 0.5 &&
      entryScore >= 0.15) {
      logger.info(`🔶 V3.1弱信号触发: 总分=${normalizedScore}%, 补偿=${compensation.toFixed(1)}`);
      return trendDirection === 'UP' ? 'BUY' : 'SELL';
    }

    // 极弱信号 - 大幅降低阈值
    if (normalizedScore >= 3 &&
      normalizedScore < 6 &&
      trendScore >= 0.3 &&
      factorScore >= adjustedThreshold.weak * 0.3 &&
      entryScore >= 0.1) {
      logger.info(`🔸 V3.1极弱信号触发: 总分=${normalizedScore}%, 补偿=${compensation.toFixed(1)}`);
      return trendDirection === 'UP' ? 'BUY' : 'SELL';
    }

    // 超弱信号 - 确保有交易信号
    if (normalizedScore >= 1 &&
      normalizedScore < 3 &&
      trendScore >= 0.2 &&
      factorScore >= adjustedThreshold.weak * 0.2 &&
      entryScore >= 0.05) {
      logger.info(`🔹 V3.1超弱信号触发: 总分=${normalizedScore}%, 补偿=${compensation.toFixed(1)}`);
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
      // 添加假突破过滤结果到顶层，方便回测引擎访问
      filterResult: filterResult,
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

  /**
   * 检测MACD收缩 - 防止趋势末端追高
   * @param {Object} factors1H - 1H因子分析结果
   * @returns {boolean} 是否检测到MACD收缩
   * @private
   */
  _detectMacdContraction(factors1H) {
    try {
      // 检查是否有MACD数据
      if (!factors1H.macd || !factors1H.macd.histogram) {
        return false;
      }

      const histogram = factors1H.macd.histogram;
      if (histogram.length < 3) {
        return false;
      }

      // 检查最近3根K线的MACD histogram是否连续收缩
      const recent3 = histogram.slice(-3);
      const contraction1 = Math.abs(recent3[1]) < Math.abs(recent3[0]);
      const contraction2 = Math.abs(recent3[2]) < Math.abs(recent3[1]);

      const isContraction = contraction1 && contraction2;

      if (isContraction) {
        logger.debug(`MACD收缩检测: 最近3根K线histogram连续收缩`);
      }

      return isContraction;
    } catch (error) {
      logger.error(`MACD收缩检测失败: ${error.message}`);
      return false;
    }
  }
}

module.exports = V3StrategyV31;

