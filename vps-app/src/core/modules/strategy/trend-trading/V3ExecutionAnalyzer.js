// V3ExecutionAnalyzer.js - V3策略15m执行分析器
// 严格按照strategy-v3.md文档实现模式A和模式B执行逻辑

const BinanceAPI = require('../../api/BinanceAPI');
const TechnicalIndicators = require('../../utils/TechnicalIndicators');

/**
 * V3策略15m执行分析器
 * 
 * 按照strategy-v3.md文档实现:
 * 趋势市执行:
 * - 模式A: 回踩确认 (保守模式)
 * - 模式B: 动能突破 (激进模式)
 * 
 * 震荡市执行:
 * - 假突破反手入场
 */
class V3ExecutionAnalyzer {
  constructor(database, cacheManager) {
    this.database = database;
    this.cacheManager = cacheManager;
    
    // 配置参数 (按strategy-v3.md文档)
    this.config = {
      // 趋势市执行配置
      trend: {
        pullbackVWAPTolerance: 0.002,    // 回踩VWAP容忍度0.2%
        breakoutVolumeRatio: 1.2,        // 突破成交量比例
        setupCandleVolumeRatio: 1.5,     // setup candle成交量比例
        atrMultiplier: 1.2,              // ATR止损倍数
        riskRewardRatio: 2               // 风险回报比
      },
      
      // 震荡市执行配置
      range: {
        fakeBreakoutRatio: 0.015,        // 假突破比例1.5%
        returnRatio: 0.01,               // 回撤比例1%
        bbWidthThreshold: 0.05,          // 布林带宽阈值5%
        riskRewardRatio: 2               // 震荡市风险回报比1:2
      }
    };
  }

  /**
   * 趋势市15m执行分析
   * @param {string} symbol - 交易对
   * @param {Object} hourlyResult - 1H多因子打分结果
   * @param {Object} symbolCategory - 交易对分类
   * @returns {Object} 执行分析结果
   */
  async analyzeTrendExecution(symbol, hourlyResult, symbolCategory) {
    try {
      console.log(`🚀 开始趋势市15m执行分析 [${symbol}]`);

      // 获取15m K线数据
      const klines15m = await BinanceAPI.getKlines(symbol, '15m', 50);
      
      if (!klines15m || klines15m.length < 30) {
        throw new Error('15m K线数据不足');
      }

      const candles15m = klines15m.map(k => ({
        timestamp: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));

      // 计算技术指标
      const technicalData = await this.calculateExecutionIndicators(candles15m);

      // 确定信号方向
      const direction = hourlyResult.signalType === 'long' ? 'LONG' : 'SHORT';

      // 分析模式A: 回踩确认
      const modeAResult = this.analyzeModeA(candles15m, technicalData, direction);

      // 分析模式B: 突破确认
      const modeBResult = this.analyzeModeB(candles15m, technicalData, direction);

      // 选择最佳执行模式
      const executionResult = this.selectBestExecutionMode(modeAResult, modeBResult, direction);

      // 计算风险管理参数
      if (executionResult.hasValidExecution) {
        executionResult.riskManagement = this.calculateExecutionRiskManagement(
          executionResult, technicalData, direction
        );
      }

      // 存储执行分析结果
      await this.storeExecutionAnalysis(symbol, executionResult);

      console.log(`⚡ 趋势市执行分析完成 [${symbol}]: ${executionResult.executionMode || 'NONE'}`);

      return executionResult;

    } catch (error) {
      console.error(`趋势市执行分析失败 [${symbol}]:`, error);
      throw error;
    }
  }

  /**
   * 计算执行分析所需的技术指标
   */
  async calculateExecutionIndicators(candles15m) {
    const closes = candles15m.map(c => c.close);
    const highs = candles15m.map(c => c.high);
    const lows = candles15m.map(c => c.low);
    const volumes = candles15m.map(c => c.volume);

    // EMA计算
    const ema20 = TechnicalIndicators.calculateEMA(closes, 20);
    const ema50 = TechnicalIndicators.calculateEMA(closes, 50);

    // ATR计算
    const atr14 = TechnicalIndicators.calculateATR(highs, lows, closes, 14);

    // VWAP计算
    const vwap = TechnicalIndicators.calculateVWAP(candles15m);

    // 平均成交量
    const avgVolume20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;

    return {
      ema20: ema20[ema20.length - 1],
      ema50: ema50[ema50.length - 1],
      atr14: atr14[atr14.length - 1],
      vwap: vwap[vwap.length - 1],
      avgVolume20,
      currentPrice: closes[closes.length - 1],
      currentVolume: volumes[volumes.length - 1],
      setupCandle: candles15m[candles15m.length - 2], // 前一根K线作为setup candle
      currentCandle: candles15m[candles15m.length - 1]
    };
  }

  /**
   * 模式A分析: 回踩确认 (保守模式)
   */
  analyzeModeA(candles15m, tech, direction) {
    let valid = false;
    let confidence = 0;
    const details = {};

    try {
      // 1. 检查价格是否回踩到VWAP附近
      const priceVWAPDistance = Math.abs(tech.currentPrice - tech.vwap) / tech.vwap;
      const nearVWAP = priceVWAPDistance <= this.config.trend.pullbackVWAPTolerance;
      details.nearVWAP = { distance: priceVWAPDistance, threshold: this.config.trend.pullbackVWAPTolerance, valid: nearVWAP };

      if (nearVWAP) confidence += 0.3;

      // 2. 检查EMA支撑/阻力确认
      let emaSupport = false;
      if (direction === 'LONG') {
        emaSupport = tech.currentPrice > tech.ema20 && tech.currentPrice > tech.ema50;
      } else {
        emaSupport = tech.currentPrice < tech.ema20 && tech.currentPrice < tech.ema50;
      }
      details.emaSupport = { valid: emaSupport, ema20: tech.ema20, ema50: tech.ema50 };

      if (emaSupport) confidence += 0.3;

      // 3. 检查成交量确认
      const volumeRatio = tech.currentVolume / tech.avgVolume20;
      const volumeConfirm = volumeRatio >= this.config.trend.breakoutVolumeRatio;
      details.volumeConfirm = { ratio: volumeRatio, threshold: this.config.trend.breakoutVolumeRatio, valid: volumeConfirm };

      if (volumeConfirm) confidence += 0.2;

      // 4. 检查价格位置合理性
      let pricePosition = false;
      if (direction === 'LONG') {
        pricePosition = tech.currentPrice > tech.setupCandle.low;
      } else {
        pricePosition = tech.currentPrice < tech.setupCandle.high;
      }
      details.pricePosition = { valid: pricePosition, setupCandle: tech.setupCandle };

      if (pricePosition) confidence += 0.2;

      // 模式A有效条件: 至少3个条件满足
      valid = confidence >= 0.6;

      return {
        mode: 'A',
        valid,
        confidence,
        details,
        description: valid ? `模式A回踩确认 (置信度: ${confidence.toFixed(2)})` : '模式A条件不满足'
      };

    } catch (error) {
      console.error('模式A分析失败:', error);
      return {
        mode: 'A',
        valid: false,
        confidence: 0,
        error: error.message
      };
    }
  }

  /**
   * 模式B分析: 突破确认 (激进模式)
   */
  analyzeModeB(candles15m, tech, direction) {
    let valid = false;
    let confidence = 0;
    const details = {};

    try {
      // 1. 检查setup candle突破
      let setupBreakout = false;
      if (direction === 'LONG') {
        setupBreakout = tech.currentPrice > tech.setupCandle.high;
      } else {
        setupBreakout = tech.currentPrice < tech.setupCandle.low;
      }
      details.setupBreakout = { valid: setupBreakout, setupCandle: tech.setupCandle };

      if (setupBreakout) confidence += 0.4;

      // 2. 检查放量突破
      const volumeRatio = tech.currentVolume / tech.avgVolume20;
      const volumeBreakout = volumeRatio >= this.config.trend.setupCandleVolumeRatio;
      details.volumeBreakout = { ratio: volumeRatio, threshold: this.config.trend.setupCandleVolumeRatio, valid: volumeBreakout };

      if (volumeBreakout) confidence += 0.3;

      // 3. 检查突破强度
      let breakoutStrength = false;
      const breakoutDistance = direction === 'LONG' ? 
        tech.currentPrice - tech.setupCandle.high :
        tech.setupCandle.low - tech.currentPrice;
      const breakoutRatio = breakoutDistance / tech.currentPrice;
      
      breakoutStrength = breakoutRatio > 0.001; // 至少0.1%的突破
      details.breakoutStrength = { distance: breakoutDistance, ratio: breakoutRatio, valid: breakoutStrength };

      if (breakoutStrength) confidence += 0.2;

      // 4. 检查突破后价格维持
      const priceHold = direction === 'LONG' ?
        tech.currentCandle.close > tech.setupCandle.high :
        tech.currentCandle.close < tech.setupCandle.low;
      details.priceHold = { valid: priceHold };

      if (priceHold) confidence += 0.1;

      // 模式B有效条件: 至少前3个条件满足
      valid = details.setupBreakout.valid && details.volumeBreakout.valid && details.breakoutStrength.valid;

      return {
        mode: 'B',
        valid,
        confidence,
        details,
        description: valid ? `模式B突破确认 (置信度: ${confidence.toFixed(2)})` : '模式B条件不满足'
      };

    } catch (error) {
      console.error('模式B分析失败:', error);
      return {
        mode: 'B',
        valid: false,
        confidence: 0,
        error: error.message
      };
    }
  }

  /**
   * 选择最佳执行模式
   */
  selectBestExecutionMode(modeAResult, modeBResult, direction) {
    let selectedMode = null;
    let hasValidExecution = false;
    let executionSignal = 'NONE';
    let executionMode = null;

    // 优先选择置信度更高的模式
    if (modeAResult.valid && modeBResult.valid) {
      selectedMode = modeAResult.confidence >= modeBResult.confidence ? modeAResult : modeBResult;
    } else if (modeAResult.valid) {
      selectedMode = modeAResult;
    } else if (modeBResult.valid) {
      selectedMode = modeBResult;
    }

    if (selectedMode) {
      hasValidExecution = true;
      executionSignal = direction === 'LONG' ? '做多' : '做空';
      executionMode = selectedMode.mode === 'A' ? 
        `${executionSignal}_回踩确认` : 
        `${executionSignal}_突破确认`;
    }

    return {
      hasValidExecution,
      executionSignal,
      executionMode,
      selectedMode,
      direction,
      
      // 模式分析结果
      modeA: modeAResult.valid,
      modeB: modeBResult.valid,
      modeADetails: modeAResult,
      modeBDetails: modeBResult,
      
      // 执行数据
      entryPrice: selectedMode?.details?.currentPrice || 0,
      setupCandle: selectedMode?.details?.setupCandle,
      currentPrice: selectedMode?.details?.currentPrice || 0,
      
      // 技术指标
      atr14: selectedMode?.details?.atr14 || 0,
      
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 计算执行风险管理参数
   */
  calculateExecutionRiskManagement(executionResult, technicalData, direction) {
    const entry = executionResult.entryPrice;
    const setupCandle = executionResult.setupCandle;
    const atr14 = technicalData.atr14;

    // 止损计算 - 按strategy-v3.md文档: setup candle另一端 或 1.2×ATR，取更远者
    let stopLoss;
    if (direction === 'LONG') {
      const setupStopLoss = setupCandle.low;
      const atrStopLoss = entry - this.config.trend.atrMultiplier * atr14;
      stopLoss = Math.min(setupStopLoss, atrStopLoss); // 取更远的(更小的)
    } else {
      const setupStopLoss = setupCandle.high;
      const atrStopLoss = entry + this.config.trend.atrMultiplier * atr14;
      stopLoss = Math.max(setupStopLoss, atrStopLoss); // 取更远的(更大的)
    }

    // 止盈计算 - 固定2R
    const stopDistance = Math.abs(entry - stopLoss);
    const takeProfit = direction === 'LONG' ? 
      entry + this.config.trend.riskRewardRatio * stopDistance :
      entry - this.config.trend.riskRewardRatio * stopDistance;

    // 杠杆计算
    const stopDistancePercent = (stopDistance / entry) * 100;
    const maxLeverage = Math.floor(1 / (stopDistancePercent / 100 + 0.005));
    const finalLeverage = Math.max(1, Math.min(maxLeverage, 125));

    return {
      entry,
      stopLoss,
      takeProfit,
      stopDistance,
      stopDistancePercent,
      riskRewardRatio: this.config.trend.riskRewardRatio,
      maxLeverage: finalLeverage,
      calculationMethod: 'v3_trend_execution',
      setupCandle,
      atr14
    };
  }

  /**
   * 存储执行分析结果
   */
  async storeExecutionAnalysis(symbol, result) {
    try {
      await this.database.run(`
        INSERT OR REPLACE INTO v3_execution_15m
        (symbol, market_type, execution_mode, execution_signal, setup_candle_high, setup_candle_low,
         mode_a_valid, mode_b_valid, entry_price, stop_loss_price, take_profit_price,
         risk_reward_ratio, atr14_15m)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        symbol,
        '趋势市',
        result.executionMode,
        result.executionSignal,
        result.setupCandle?.high || null,
        result.setupCandle?.low || null,
        result.modeA,
        result.modeB,
        result.entryPrice,
        result.riskManagement?.stopLoss || null,
        result.riskManagement?.takeProfit || null,
        result.riskManagement?.riskRewardRatio || 2,
        result.atr14
      ]);
    } catch (error) {
      console.error('存储执行分析结果失败:', error);
    }
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    if (!this.database) throw new Error('数据库连接不可用');
    if (!this.cacheManager) throw new Error('缓存管理器不可用');
    
    return { status: 'healthy', timestamp: new Date().toISOString() };
  }
}

module.exports = V3ExecutionAnalyzer;
