/**
 * 美股V3策略 - 复用加密货币V3策略逻辑
 * 独立模块，不影响加密货币策略
 */

const TechnicalIndicators = require('../utils/technical-indicators');
const logger = require('../utils/logger');
const DatabaseConnection = require('../database/database-connection');

/**
 * 美股V3策略参数加载器
 */
class USStrategyParameterLoader {
  constructor(dbConnection) {
    this.dbConnection = dbConnection;
  }

  async loadParameters(strategyName, mode) {
    try {
      const sql = `
        SELECT param_name, param_value, param_type
        FROM us_stock_strategy_params
        WHERE strategy_name = ? AND strategy_mode = ?
      `;

      const params = await this.dbConnection.query(sql, [strategyName, mode]);
      
      const result = {};
      for (const param of params) {
        const value = this.convertValue(param.param_value, param.param_type);
        result[param.param_name] = value;
      }

      return result;
    } catch (error) {
      logger.error(`[USStrategyParameterLoader] 参数加载失败:`, error);
      return this.getDefaultParameters(strategyName);
    }
  }

  convertValue(value, type) {
    if (type === 'number') {
      return parseFloat(value);
    } else if (type === 'boolean') {
      return value === 'true' || value === '1';
    }
    return value;
  }

  getDefaultParameters(strategyName) {
    // 返回默认参数
    if (strategyName === 'V3_US') {
      return {
        emaFast: 10,
        emaSlow: 20,
        rsiPeriod: 14,
        rsiOverbought: 70,
        rsiOversold: 30,
        stopLoss: 0.02,
        takeProfit: 0.04
      };
    }
    return {};
  }
}

/**
 * 美股V3策略类
 */
class USV3Strategy {
  constructor() {
    this.name = 'V3_US';
    this.timeframes = ['4h', '1h', '15m'];
    this.paramLoader = null;
    this.params = {};
    
    this.initializeParameters();
  }

  /**
   * 初始化参数
   */
  async initializeParameters() {
    try {
      const dbConnection = DatabaseConnection.getInstance();
      this.paramLoader = new USStrategyParameterLoader(dbConnection);
      this.params = await this.paramLoader.loadParameters('V3_US', 'BALANCED');
      
      logger.info('[USV3Strategy] 参数加载完成', {
        params: this.params
      });
    } catch (error) {
      logger.error('[USV3Strategy] 参数加载失败，使用默认值', error);
      this.params = this.paramLoader.getDefaultParameters('V3_US');
    }
  }

  /**
   * 执行策略分析
   */
  async execute(klines4H, klines1H, klines15m) {
    try {
      if (!klines4H || !klines1H || !klines15m || 
          klines4H.length === 0 || klines1H.length === 0 || klines15m.length === 0) {
        return null;
      }

      // 1. 4H级别判断大趋势
      const trend4H = this.analyzeTrend(klines4H);
      
      // 2. 1H级别确认中期动量
      const momentum1H = this.analyzeMomentum(klines1H);
      
      // 3. 15m级别精确入场
      const entry15m = this.identifyEntry(klines15m, trend4H, momentum1H);

      // 4. 综合评分
      const signal = this.combineSignals(trend4H, momentum1H, entry15m);

      return {
        action: signal >= 6 ? 'BUY' : signal >= 3 ? 'HOLD' : 'SELL',
        confidence: signal,
        entryPrice: entry15m.price,
        stopLoss: entry15m.stopLoss,
        takeProfit: entry15m.takeProfit,
        strategy: 'V3_US'
      };

    } catch (error) {
      logger.error('[USV3Strategy] 策略执行失败:', error);
      return null;
    }
  }

  /**
   * 分析4H趋势
   */
  analyzeTrend(klines) {
    const emaFast = this.params.emaFast || 10;
    const emaSlow = this.params.emaSlow || 20;

    const closePrices = klines.map(k => k.close);
    const ema10 = TechnicalIndicators.EMA(closePrices, emaFast);
    const ema20 = TechnicalIndicators.EMA(closePrices, emaSlow);

    const currentEMA10 = ema10[ema10.length - 1];
    const currentEMA20 = ema20[ema20.length - 1];
    const prevEMA10 = ema10[ema10.length - 2];
    const prevEMA20 = ema20[ema20.length - 2];

    let trendScore = 0;

    // EMA交叉判断
    if (currentEMA10 > currentEMA20 && currentEMA10 > prevEMA10) {
      trendScore += 5; // 上升趋势
    } else if (currentEMA10 < currentEMA20 && currentEMA10 < prevEMA10) {
      trendScore += 2; // 下降趋势
    }

    return {
      score: trendScore,
      direction: currentEMA10 > currentEMA20 ? 'BULLISH' : 'BEARISH',
      ema10: currentEMA10,
      ema20: currentEMA20
    };
  }

  /**
   * 分析1H动量
   */
  analyzeMomentum(klines) {
    const rsiPeriod = this.params.rsiPeriod || 14;
    const closePrices = klines.map(k => k.close);
    const rsi = TechnicalIndicators.RSI(closePrices, rsiPeriod);

    const currentRSI = rsi[rsi.length - 1];

    let momentumScore = 0;

    if (currentRSI > 50 && currentRSI < 70) {
      momentumScore += 3; // 健康动量
    } else if (currentRSI >= 70) {
      momentumScore += 1; // 超买
    }

    return {
      score: momentumScore,
      rsi: currentRSI
    };
  }

  /**
   * 识别15m入场点
   */
  identifyEntry(klines, trend4H, momentum1H) {
    const latestKline = klines[klines.length - 1];
    const currentPrice = latestKline.close;

    // 计算ATR用于止损
    const highs = klines.map(k => k.high);
    const lows = klines.map(k => k.low);
    const closes = klines.map(k => k.close);
    const atr = TechnicalIndicators.ATR(highs, lows, closes, 14);
    const currentATR = atr[atr.length - 1] || 0;

    const stopLossPercent = this.params.stopLoss || 0.02;
    const takeProfitPercent = this.params.takeProfit || 0.04;

    const stopLoss = currentPrice * (1 - stopLossPercent);
    const takeProfit = currentPrice * (1 + takeProfitPercent);

    return {
      price: currentPrice,
      stopLoss,
      takeProfit,
      atr: currentATR
    };
  }

  /**
   * 合并信号
   */
  combineSignals(trend4H, momentum1H, entry15m) {
    let signal = 0;

    // 4H趋势权重
    signal += trend4H.score * 0.4;

    // 1H动量权重
    signal += momentum1H.score * 0.35;

    // 15m入场权重
    signal += 3 * 0.25;

    return signal;
  }
}

module.exports = USV3Strategy;

