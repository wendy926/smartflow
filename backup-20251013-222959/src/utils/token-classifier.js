/**
 * 代币分类工具
 * 根据strategy-v3.md定义，将交易对分类为：主流币、高市值强趋势币、热点币、小币
 */

const logger = require('./logger');

/**
 * 代币分类定义
 */
const TOKEN_CATEGORIES = {
  // 主流币（高流动性）
  MAINSTREAM: {
    name: '主流币',
    symbols: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'],
    marketCapMin: 50000000000, // 500亿美元以上
    description: '高流动性主流币'
  },

  // 高市值强趋势币
  HIGH_CAP_TREND: {
    name: '高市值强趋势币',
    symbols: ['SOLUSDT', 'ADAUSDT', 'XRPUSDT', 'DOGEUSDT', 'DOTUSDT',
      'LTCUSDT', 'TRXUSDT', 'BCHUSDT', 'ETCUSDT'],
    marketCapMin: 1000000000, // 10亿美元以上
    marketCapMax: 50000000000, // 500亿美元以下
    description: '高市值强趋势币'
  },

  // 热点币（Trending）
  HOT: {
    name: '热点币',
    symbols: ['PEPEUSDT', 'APTUSDT', 'PENDLEUSDT', 'LINKUSDT', 'MKRUSDT', 'SUIUSDT'],
    marketCapMin: 100000000, // 1亿美元以上
    marketCapMax: 5000000000, // 50亿美元以下
    description: '热点/中等市值币'
  },

  // 小市值低流动币
  SMALL_CAP: {
    name: '小币',
    symbols: ['ONDOUSDT', 'LDOUSDT', 'MPLUSDT'],
    marketCapMax: 100000000, // 1亿美元以下
    description: '小市值低流动币'
  }
};

/**
 * 1H多因子权重配置（趋势市）
 */
const TREND_1H_WEIGHTS = {
  MAINSTREAM: {
    breakout: 0.30,      // 突破确认 30%
    volume: 0.20,        // 成交量确认 20%
    oiChange: 0.25,      // OI变化 25%
    delta: 0.15,         // Delta不平衡 15%
    fundingRate: 0.10    // 资金费率 10%
  },
  HIGH_CAP_TREND: {
    breakout: 0.25,
    volume: 0.25,
    oiChange: 0.20,
    delta: 0.20,
    fundingRate: 0.10
  },
  HOT: {
    breakout: 0.15,
    volume: 0.30,
    oiChange: 0.15,
    delta: 0.30,
    fundingRate: 0.10
  },
  SMALL_CAP: {
    breakout: 0.15,
    volume: 0.35,
    oiChange: 0.15,
    delta: 0.25,
    fundingRate: 0.10
  }
};

/**
 * 1H多因子权重配置（震荡市）
 */
const RANGE_1H_WEIGHTS = {
  MAINSTREAM: {
    vwap: 0.20,          // VWAP因子 20%
    touch: 0.30,         // 触碰因子 30%
    volume: 0.20,        // 成交量因子 20%
    delta: 0.15,         // Delta因子 15%
    oi: 0.10,            // OI因子 10%
    noBreakout: 0.05     // 无突破因子 5%
  },
  HIGH_CAP_TREND: {
    vwap: 0.20,
    touch: 0.30,
    volume: 0.25,
    delta: 0.15,
    oi: 0.10,
    noBreakout: 0.00     // 不使用
  },
  HOT: {
    vwap: 0.10,
    touch: 0.25,
    volume: 0.30,
    delta: 0.25,
    oi: 0.10,
    noBreakout: 0.00
  },
  SMALL_CAP: {
    vwap: 0.10,
    touch: 0.25,
    volume: 0.30,
    delta: 0.25,
    oi: 0.10,
    noBreakout: 0.00
  }
};

/**
 * 15M入场权重配置（趋势市）
 */
const TREND_15M_WEIGHTS = {
  MAINSTREAM: {
    vwap: 0.40,          // VWAP方向 40%
    delta: 0.20,         // Delta 20%
    oi: 0.20,            // OI变化 20%
    volume: 0.20         // Volume 20%
  },
  HIGH_CAP_TREND: {
    vwap: 0.35,
    delta: 0.25,
    oi: 0.20,
    volume: 0.20
  },
  HOT: {
    vwap: 0.30,
    delta: 0.25,
    oi: 0.20,
    volume: 0.25
  },
  SMALL_CAP: {
    vwap: 0.25,
    delta: 0.25,
    oi: 0.15,
    volume: 0.35
  }
};

/**
 * 15M入场权重配置（震荡市）
 */
const RANGE_15M_WEIGHTS = {
  MAINSTREAM: {
    vwap: 0.30,          // VWAP 30%
    delta: 0.30,         // Delta 30%
    oi: 0.20,            // OI 20%
    volume: 0.20         // Volume 20%
  },
  HIGH_CAP_TREND: {
    vwap: 0.20,
    delta: 0.30,
    oi: 0.30,
    volume: 0.20
  },
  HOT: {
    vwap: 0.20,
    delta: 0.20,
    oi: 0.20,
    volume: 0.40
  },
  SMALL_CAP: {
    vwap: 0.10,
    delta: 0.20,
    oi: 0.20,
    volume: 0.50
  }
};

class TokenClassifier {
  /**
   * 分类交易对
   * @param {string} symbol - 交易对符号
   * @returns {string} 分类名称
   */
  static classify(symbol) {
    // 检查主流币
    if (TOKEN_CATEGORIES.MAINSTREAM.symbols.includes(symbol)) {
      return 'MAINSTREAM';
    }

    // 检查高市值强趋势币
    if (TOKEN_CATEGORIES.HIGH_CAP_TREND.symbols.includes(symbol)) {
      return 'HIGH_CAP_TREND';
    }

    // 检查热点币
    if (TOKEN_CATEGORIES.HOT.symbols.includes(symbol)) {
      return 'HOT';
    }

    // 检查小币
    if (TOKEN_CATEGORIES.SMALL_CAP.symbols.includes(symbol)) {
      return 'SMALL_CAP';
    }

    // 默认归类为热点币
    logger.warn(`代币 ${symbol} 未在分类列表中，默认归类为热点币`);
    return 'HOT';
  }

  /**
   * 获取趋势市1H权重
   * @param {string} symbol - 交易对符号
   * @returns {Object} 权重配置
   */
  static getTrend1HWeights(symbol) {
    const category = this.classify(symbol);
    return TREND_1H_WEIGHTS[category] || TREND_1H_WEIGHTS.HOT;
  }

  /**
   * 获取震荡市1H权重
   * @param {string} symbol - 交易对符号
   * @returns {Object} 权重配置
   */
  static getRange1HWeights(symbol) {
    const category = this.classify(symbol);
    return RANGE_1H_WEIGHTS[category] || RANGE_1H_WEIGHTS.HOT;
  }

  /**
   * 获取趋势市15M权重
   * @param {string} symbol - 交易对符号
   * @returns {Object} 权重配置
   */
  static getTrend15MWeights(symbol) {
    const category = this.classify(symbol);
    return TREND_15M_WEIGHTS[category] || TREND_15M_WEIGHTS.HOT;
  }

  /**
   * 获取震荡市15M权重
   * @param {string} symbol - 交易对符号
   * @returns {Object} 权重配置
   */
  static getRange15MWeights(symbol) {
    const category = this.classify(symbol);
    return RANGE_15M_WEIGHTS[category] || RANGE_15M_WEIGHTS.HOT;
  }

  /**
   * 获取分类描述
   * @param {string} symbol - 交易对符号
   * @returns {Object} 分类信息
   */
  static getCategoryInfo(symbol) {
    const category = this.classify(symbol);
    return {
      category,
      name: TOKEN_CATEGORIES[category]?.name || '未知',
      description: TOKEN_CATEGORIES[category]?.description || '未分类'
    };
  }

  /**
   * 计算加权得分（趋势市1H）
   * @param {string} symbol - 交易对符号
   * @param {Object} factors - 因子得分 {breakout: 0/1, volume: 0/1, oiChange: 0/1, delta: 0/1, fundingRate: 0/1}
   * @returns {number} 加权总分（0-1之间）
   */
  static calculateTrend1HScore(symbol, factors) {
    const weights = this.getTrend1HWeights(symbol);

    let score = 0;
    score += (factors.breakout || 0) * weights.breakout;
    score += (factors.volume || 0) * weights.volume;
    score += (factors.oiChange || 0) * weights.oiChange;
    score += (factors.delta || 0) * weights.delta;
    score += (factors.fundingRate || 0) * weights.fundingRate;

    return score;
  }

  /**
   * 计算加权得分（震荡市1H）
   * @param {string} symbol - 交易对符号
   * @param {Object} factors - 因子得分
   * @returns {number} 加权总分（0-1之间）
   */
  static calculateRange1HScore(symbol, factors) {
    const weights = this.getRange1HWeights(symbol);

    let score = 0;
    score += (factors.vwap || 0) * weights.vwap;
    score += (factors.touch || 0) * weights.touch;
    score += (factors.volume || 0) * weights.volume;
    score += (factors.delta || 0) * weights.delta;
    score += (factors.oi || 0) * weights.oi;
    score += (factors.noBreakout || 0) * (weights.noBreakout || 0);

    return score;
  }

  /**
   * 计算加权得分（15M入场）
   * @param {string} symbol - 交易对符号
   * @param {string} marketType - 市场类型 'TREND' 或 'RANGE'
   * @param {Object} factors - 因子得分 {vwap: 0/1, delta: 0/1, oi: 0/1, volume: 0/1}
   * @returns {number} 加权总分（0-1之间）
   */
  static calculate15MScore(symbol, marketType, factors) {
    const weights = marketType === 'TREND'
      ? this.getTrend15MWeights(symbol)
      : this.getRange15MWeights(symbol);

    let score = 0;
    score += (factors.vwap || 0) * weights.vwap;
    score += (factors.delta || 0) * weights.delta;
    score += (factors.oi || 0) * weights.oi;
    score += (factors.volume || 0) * weights.volume;

    return score;
  }

  /**
   * 获取所有权重配置（用于调试）
   * @param {string} symbol - 交易对符号
   * @returns {Object} 完整权重配置
   */
  static getAllWeights(symbol) {
    const category = this.classify(symbol);
    return {
      symbol,
      category,
      categoryInfo: this.getCategoryInfo(symbol),
      weights: {
        trend1H: TREND_1H_WEIGHTS[category],
        range1H: RANGE_1H_WEIGHTS[category],
        trend15M: TREND_15M_WEIGHTS[category],
        range15M: RANGE_15M_WEIGHTS[category]
      }
    };
  }
}

module.exports = TokenClassifier;

