/**
 * V3.1策略优化 - 早期趋势探测模块
 * 实现基于strategy-v3.1.md的earlyTrendDetect功能
 * 
 * @module v3-1-early-trend
 */

const TechnicalIndicators = require('../utils/technical-indicators');
const logger = require('../utils/logger');

/**
 * 早期趋势探测器
 * 使用1H MACD histogram、Delta、VWAP等指标提前捕捉趋势起点
 */
class EarlyTrendDetector {
  constructor(params = {}) {
    // 默认参数（可通过数据库配置覆盖）
    this.params = {
      macdHistThreshold: params.macdHistThreshold || 0.5,
      macdConsecutiveBars: params.macdConsecutiveBars || 2,
      deltaThreshold: params.deltaThreshold || 0.05,
      adxMin: params.adxMin || 20,
      adx4HMax: params.adx4HMax || 40,
      weightBonus: params.weightBonus || 0.1
    };
  }

  /**
   * 检测早期趋势
   * @param {Array} klines1H - 1H K线数据
   * @param {Array} klines4H - 4H K线数据
   * @returns {Object} 早期趋势检测结果
   */
  detect(klines1H, klines4H) {
    try {
      if (!klines1H || klines1H.length < 50) {
        return this._buildResult(false, null, 'Insufficient 1H data');
      }

      if (!klines4H || klines4H.length < 200) {
        return this._buildResult(false, null, 'Insufficient 4H data');
      }

      const closes1H = klines1H.map(k => parseFloat(k[4]));
      const volumes1H = klines1H.map(k => parseFloat(k[5]));
      const currentPrice = closes1H[closes1H.length - 1];

      // 1. 计算1H MACD histogram
      const macd1H = TechnicalIndicators.calculateMACDHistogram(closes1H, 12, 26, 9);
      const macdHist = macd1H.histogram;
      const macdTrending = macd1H.trending;

      // 2. 计算前一根K线的MACD histogram（用于连续确认）
      const closes1HPrev = closes1H.slice(0, -1);
      const macd1HPrev = TechnicalIndicators.calculateMACDHistogram(closes1HPrev, 12, 26, 9);
      const macdHistPrev = macd1HPrev.histogram;

      // 3. 计算1H Delta
      const delta1H = this._calculateDelta(closes1H, volumes1H);

      // 4. 计算1H VWAP
      const vwap1H = TechnicalIndicators.calculateVWAP(klines1H);

      // 5. 计算1H ADX
      const highs1H = klines1H.map(k => parseFloat(k[2]));
      const lows1H = klines1H.map(k => parseFloat(k[3]));
      const adx1H = TechnicalIndicators.calculateADX(highs1H, lows1H, closes1H, 14);

      // 6. 计算4H ADX（用于反向检查）
      const highs4H = klines4H.map(k => parseFloat(k[2]));
      const lows4H = klines4H.map(k => parseFloat(k[3]));
      const closes4H = klines4H.map(k => parseFloat(k[4]));
      const adx4H = TechnicalIndicators.calculateADX(highs4H, lows4H, closes4H, 14);

      // 7. 判断VWAP方向
      const vwapDirection = currentPrice > vwap1H ? 1 : (currentPrice < vwap1H ? -1 : 0);

      // 8. 多头早期趋势检测
      const longConditions = this._checkLongConditions(
        macdHist, macdHistPrev, delta1H, vwapDirection, 
        adx1H.adx, adx4H.adx
      );

      // 9. 空头早期趋势检测
      const shortConditions = this._checkShortConditions(
        macdHist, macdHistPrev, delta1H, vwapDirection, 
        adx1H.adx, adx4H.adx
      );

      // 10. 构建结果
      if (longConditions.detected) {
        logger.info(`✅ 检测到早期多头趋势: MACD=${macdHist.toFixed(4)}, Delta=${delta1H.toFixed(4)}, ADX1H=${adx1H.adx.toFixed(2)}`);
        return this._buildResult(true, 'EARLY_LONG', longConditions.reason, {
          macdHist,
          macdHistPrev,
          delta1H,
          vwap1H,
          vwapDirection,
          adx1H: adx1H.adx,
          adx4H: adx4H.adx,
          currentPrice
        });
      } else if (shortConditions.detected) {
        logger.info(`✅ 检测到早期空头趋势: MACD=${macdHist.toFixed(4)}, Delta=${delta1H.toFixed(4)}, ADX1H=${adx1H.adx.toFixed(2)}`);
        return this._buildResult(true, 'EARLY_SHORT', shortConditions.reason, {
          macdHist,
          macdHistPrev,
          delta1H,
          vwap1H,
          vwapDirection,
          adx1H: adx1H.adx,
          adx4H: adx4H.adx,
          currentPrice
        });
      } else {
        logger.debug(`未检测到早期趋势: MACD=${macdHist.toFixed(4)}, Delta=${delta1H.toFixed(4)}`);
        return this._buildResult(false, null, 'No early trend pattern detected', {
          macdHist,
          macdHistPrev,
          delta1H,
          vwap1H,
          vwapDirection,
          adx1H: adx1H.adx,
          adx4H: adx4H.adx,
          currentPrice
        });
      }
    } catch (error) {
      logger.error(`早期趋势探测失败: ${error.message}`);
      return this._buildResult(false, null, `Error: ${error.message}`);
    }
  }

  /**
   * 检查多头早期趋势条件
   * @private
   */
  _checkLongConditions(macdHist, macdHistPrev, delta1H, vwapDirection, adx1H, adx4H) {
    const reasons = [];
    let passCount = 0;

    // 条件1: MACD histogram >= threshold 且连续2根
    if (macdHist >= this.params.macdHistThreshold && 
        macdHistPrev >= this.params.macdHistThreshold) {
      passCount++;
      reasons.push(`MACD连续看多(${macdHist.toFixed(4)}/${macdHistPrev.toFixed(4)})`);
    }

    // 条件2: Delta >= threshold
    if (delta1H >= this.params.deltaThreshold) {
      passCount++;
      reasons.push(`Delta买盘强势(${delta1H.toFixed(4)})`);
    }

    // 条件3: 价格 > VWAP
    if (vwapDirection === 1 && macdHist > 0) {
      passCount++;
      reasons.push('价格在VWAP上方且MACD看多');
    }

    // 条件4: 1H ADX >= 弱趋势门槛
    if (adx1H >= this.params.adxMin) {
      passCount++;
      reasons.push(`1H ADX趋势形成(${adx1H.toFixed(2)})`);
    }

    // 条件5: 4H ADX不强烈反向（< 40 或同向）
    const adx4HCheck = adx4H < this.params.adx4HMax;
    if (adx4HCheck) {
      passCount++;
      reasons.push(`4H ADX无反向压制(${adx4H.toFixed(2)})`);
    }

    // 至少满足4个条件才算检测到早期趋势
    const detected = passCount >= 4;
    
    return {
      detected,
      reason: detected ? reasons.join(', ') : `条件不足(${passCount}/5)`,
      passCount
    };
  }

  /**
   * 检查空头早期趋势条件
   * @private
   */
  _checkShortConditions(macdHist, macdHistPrev, delta1H, vwapDirection, adx1H, adx4H) {
    const reasons = [];
    let passCount = 0;

    // 条件1: MACD histogram <= -threshold 且连续2根
    if (macdHist <= -this.params.macdHistThreshold && 
        macdHistPrev <= -this.params.macdHistThreshold) {
      passCount++;
      reasons.push(`MACD连续看空(${macdHist.toFixed(4)}/${macdHistPrev.toFixed(4)})`);
    }

    // 条件2: Delta <= -threshold
    if (delta1H <= -this.params.deltaThreshold) {
      passCount++;
      reasons.push(`Delta卖盘强势(${delta1H.toFixed(4)})`);
    }

    // 条件3: 价格 < VWAP
    if (vwapDirection === -1 && macdHist < 0) {
      passCount++;
      reasons.push('价格在VWAP下方且MACD看空');
    }

    // 条件4: 1H ADX >= 弱趋势门槛
    if (adx1H >= this.params.adxMin) {
      passCount++;
      reasons.push(`1H ADX趋势形成(${adx1H.toFixed(2)})`);
    }

    // 条件5: 4H ADX不强烈反向
    const adx4HCheck = adx4H < this.params.adx4HMax;
    if (adx4HCheck) {
      passCount++;
      reasons.push(`4H ADX无反向压制(${adx4H.toFixed(2)})`);
    }

    // 至少满足4个条件才算检测到早期趋势
    const detected = passCount >= 4;
    
    return {
      detected,
      reason: detected ? reasons.join(', ') : `条件不足(${passCount}/5)`,
      passCount
    };
  }

  /**
   * 计算Delta（简化版）
   * @private
   */
  _calculateDelta(prices, volumes) {
    if (prices.length < 2) return 0;

    let buyVolume = 0;
    let sellVolume = 0;

    // 取最近20根K线计算Delta
    const startIdx = Math.max(0, prices.length - 20);
    
    for (let i = startIdx + 1; i < prices.length; i++) {
      const priceChange = prices[i] - prices[i - 1];
      const volume = volumes[i];

      if (priceChange > 0) {
        buyVolume += volume;
      } else if (priceChange < 0) {
        sellVolume += volume;
      }
    }

    const totalVolume = buyVolume + sellVolume;
    return totalVolume > 0 ? (buyVolume - sellVolume) / totalVolume : 0;
  }

  /**
   * 构建结果对象
   * @private
   */
  _buildResult(detected, signalType, reason, indicators = {}) {
    return {
      detected,
      signalType,
      reason,
      weightBonus: detected ? this.params.weightBonus : 0,
      indicators: {
        macdHist: indicators.macdHist || null,
        macdHistPrev: indicators.macdHistPrev || null,
        delta1H: indicators.delta1H || null,
        vwap1H: indicators.vwap1H || null,
        vwapDirection: indicators.vwapDirection || 0,
        adx1H: indicators.adx1H || null,
        adx4H: indicators.adx4H || null,
        currentPrice: indicators.currentPrice || null
      },
      timestamp: new Date()
    };
  }

  /**
   * 更新参数配置
   * @param {Object} newParams - 新参数
   */
  updateParams(newParams) {
    this.params = { ...this.params, ...newParams };
    logger.info(`早期趋势探测器参数已更新: ${JSON.stringify(this.params)}`);
  }

  /**
   * 获取当前参数配置
   * @returns {Object} 当前参数
   */
  getParams() {
    return { ...this.params };
  }
}

module.exports = EarlyTrendDetector;

