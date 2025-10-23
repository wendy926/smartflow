/**
 * V3.1策略优化 - 假突破过滤器模块
 * 实现基于strategy-v3.1.md的fakeBreakoutFilter功能
 * 
 * @module v3-1-fake-breakout-filter
 */

const TechnicalIndicators = require('../utils/technical-indicators');
const logger = require('../utils/logger');

/**
 * 假突破过滤器
 * 通过成交量、Delta、价格回撤等多因子过滤假突破
 */
class FakeBreakoutFilter {
  constructor(params = {}) {
    // 默认参数（可通过数据库配置覆盖）
    this.params = {
      volFactor: params.volFactor || 1.2,        // 成交量因子
      deltaThreshold: params.deltaThreshold || 0.04, // Delta阈值
      confirmBars: params.confirmBars || 1,      // 确认K线数
      reclaimPct: params.reclaimPct || 0.003,   // 回撤百分比(0.3%)
      rangeLookback4H: params.rangeLookback4H || 10 // 4H区间回溯
    };
  }

  /**
   * 对趋势市场进行假突破过滤
   * @param {number} breakoutPrice - 突破价格
   * @param {Array} klines15m - 15M K线数据
   * @param {Array} klines1H - 1H K线数据
   * @param {Array} klines4H - 4H K线数据
   * @returns {Object} 过滤结果
   */
  filterTrend(breakoutPrice, klines15m, klines1H, klines4H) {
    try {
      if (!this._validateInput(klines15m, klines1H, klines4H)) {
        return this._buildResult(false, 'Insufficient data');
      }

      const last15m = klines15m[klines15m.length - 1];
      
      // 1. 成交量确认
      const volumeCheck = this._checkVolume(klines15m);
      
      // 2. Delta同向确认
      const deltaCheck = this._checkDelta(klines15m, klines1H);
      
      // 3. 突破确认（价格不回撤）
      const confirmCheck = this._checkConfirmation(
        breakoutPrice, 
        parseFloat(last15m[4]), 
        this.params.confirmBars
      );
      
      // 4. ATR确认（非异常波动）
      const atrCheck = this._checkATR(klines15m);
      
      // 5. 区间边界检查
      const boundaryCheck = this._checkRangeBoundary(klines4H, parseFloat(last15m[4]));

      // 综合判断：所有检查都通过才算通过
      const passed = volumeCheck.passed && 
                     deltaCheck.passed && 
                     confirmCheck.passed && 
                     atrCheck.passed && 
                     !boundaryCheck.atEdge;

      const details = {
        volumeCheck,
        deltaCheck,
        confirmCheck,
        atrCheck,
        boundaryCheck
      };

      if (passed) {
        logger.info(`✅ 假突破过滤器通过: 成交量=${volumeCheck.ratio.toFixed(2)}x, Delta同向=${deltaCheck.aligned}, 无回撤=${confirmCheck.passed}`);
      } else {
        const reasons = this._collectFailReasons(details);
        logger.info(`❌ 假突破过滤器拒绝: ${reasons.join(', ')}`);
      }

      return this._buildResult(passed, passed ? 'Pass all checks' : 'Failed checks', details);
    } catch (error) {
      logger.error(`假突破过滤失败: ${error.message}`);
      return this._buildResult(false, `Error: ${error.message}`);
    }
  }

  /**
   * 对震荡市场进行假突破过滤（反向交易）
   * @param {string} direction - 方向 'LONG' 或 'SHORT'
   * @param {Array} klines15m - 15M K线数据
   * @param {Array} klines1H - 1H K线数据
   * @returns {Object} 过滤结果
   */
  filterRange(direction, klines15m, klines1H) {
    try {
      if (!klines15m || klines15m.length < 20) {
        return this._buildResult(false, 'Insufficient 15M data');
      }

      if (!klines1H || klines1H.length < 20) {
        return this._buildResult(false, 'Insufficient 1H data');
      }

      const last15m = klines15m[klines15m.length - 1];
      const prev15m = klines15m[klines15m.length - 2];
      
      if (!prev15m) {
        return this._buildResult(false, 'No previous candle');
      }

      const lastClose = parseFloat(last15m[4]);
      const prevClose = parseFloat(prev15m[4]);
      const prevLow = parseFloat(prev15m[3]);
      const prevHigh = parseFloat(prev15m[2]);

      // 1. 检查快速反转
      let brokeOut = false;
      let reversed = false;

      if (direction === 'LONG') {
        // 多头假突破：前一根跌破低点，当前根快速反弹
        brokeOut = prevClose < prevLow;
        reversed = lastClose > prevClose;
      } else if (direction === 'SHORT') {
        // 空头假突破：前一根突破高点，当前根快速回落
        brokeOut = prevClose > prevHigh;
        reversed = lastClose < prevClose;
      }

      // 2. 成交量确认
      const volumeCheck = this._checkVolume(klines15m);

      // 3. Delta确认
      const delta15m = this._calculateDelta(
        klines15m.map(k => parseFloat(k[4])),
        klines15m.map(k => parseFloat(k[5]))
      );
      const deltaOK = Math.abs(delta15m) >= this.params.deltaThreshold;

      const passed = brokeOut && reversed && volumeCheck.passed && deltaOK;

      const details = {
        brokeOut,
        reversed,
        volumeRatio: volumeCheck.ratio,
        volumePassed: volumeCheck.passed,
        delta15m,
        deltaOK
      };

      if (passed) {
        logger.info(`✅ 震荡市假突破过滤通过: 突破=${brokeOut}, 反转=${reversed}, 成交量=${volumeCheck.ratio.toFixed(2)}x`);
      } else {
        logger.info(`❌ 震荡市假突破过滤拒绝: 突破=${brokeOut}, 反转=${reversed}`);
      }

      return this._buildResult(passed, passed ? 'Range fake breakout detected' : 'No fake breakout pattern', details);
    } catch (error) {
      logger.error(`震荡市假突破过滤失败: ${error.message}`);
      return this._buildResult(false, `Error: ${error.message}`);
    }
  }

  /**
   * 检查成交量确认
   * @private
   */
  _checkVolume(klines15m) {
    const volumes = klines15m.map(k => parseFloat(k[5]));
    const avgVolume = this._calculateAvgVolume(volumes, 20);
    const currentVolume = volumes[volumes.length - 1];
    const ratio = currentVolume / avgVolume;
    const passed = ratio >= this.params.volFactor;

    return { passed, ratio, avgVolume, currentVolume };
  }

  /**
   * 检查Delta同向确认
   * @private
   */
  _checkDelta(klines15m, klines1H) {
    const delta15m = this._calculateDelta(
      klines15m.map(k => parseFloat(k[4])),
      klines15m.map(k => parseFloat(k[5]))
    );

    const delta1H = this._calculateDelta(
      klines1H.map(k => parseFloat(k[4])),
      klines1H.map(k => parseFloat(k[5]))
    );

    // 同向：符号相同且15M Delta绝对值 >= 阈值
    const sameDirection = Math.sign(delta15m) === Math.sign(delta1H);
    const strongEnough = Math.abs(delta15m) >= this.params.deltaThreshold;
    const aligned = sameDirection && strongEnough;

    return {
      passed: aligned,
      aligned,
      sameDirection,
      strongEnough,
      delta15m,
      delta1H
    };
  }

  /**
   * 检查突破确认（无回撤）
   * @private
   */
  _checkConfirmation(breakoutPrice, currentClose, confirmBars) {
    // 检查收盘价是否回撤到突破价之下超过reclaimPct
    const reclaimDiff = Math.abs(currentClose - breakoutPrice) / breakoutPrice;
    const noReclaim = reclaimDiff >= this.params.reclaimPct;

    return {
      passed: noReclaim,
      reclaimDiff,
      threshold: this.params.reclaimPct,
      breakoutPrice,
      currentClose
    };
  }

  /**
   * 检查ATR（排除异常波动）
   * @private
   */
  _checkATR(klines15m) {
    try {
      const highs = klines15m.map(k => parseFloat(k[2]));
      const lows = klines15m.map(k => parseFloat(k[3]));
      const closes = klines15m.map(k => parseFloat(k[4]));

      const atr = TechnicalIndicators.calculateATR(highs, lows, closes, 14);
      const currentATR = atr[atr.length - 1];
      
      // 计算60根K线的ATR平均（约15小时）
      const atr60Slice = atr.slice(-Math.min(60, atr.length));
      const atr60Avg = atr60Slice.reduce((sum, val) => sum + val, 0) / atr60Slice.length;
      
      // 当前ATR不应超过60期均值的1.5倍（避免异常波动）
      const ratio = atr60Avg > 0 ? currentATR / atr60Avg : 1;
      const passed = ratio < 1.5;

      return {
        passed,
        ratio,
        currentATR,
        atr60Avg
      };
    } catch (error) {
      logger.warn(`ATR检查失败: ${error.message}`);
      return { passed: true, ratio: 1, currentATR: 0, atr60Avg: 0 };
    }
  }

  /**
   * 检查区间边界
   * @private
   */
  _checkRangeBoundary(klines4H, currentPrice) {
    try {
      if (!klines4H || klines4H.length < this.params.rangeLookback4H) {
        return { atEdge: false, reason: 'Insufficient data' };
      }

      const lookback = Math.min(this.params.rangeLookback4H, klines4H.length);
      const recentKlines = klines4H.slice(-lookback);
      
      const highs = recentKlines.map(k => parseFloat(k[2]));
      const lows = recentKlines.map(k => parseFloat(k[3]));
      
      const maxHigh = Math.max(...highs);
      const minLow = Math.min(...lows);
      
      // 判断是否在区间边界附近（3%范围内）
      const pctFromTop = Math.abs(maxHigh - currentPrice) / maxHigh;
      const pctFromBottom = Math.abs(currentPrice - minLow) / currentPrice;
      
      const atTopEdge = pctFromTop < 0.03;
      const atBottomEdge = pctFromBottom < 0.03;
      const atEdge = atTopEdge || atBottomEdge;

      return {
        atEdge,
        atTopEdge,
        atBottomEdge,
        pctFromTop,
        pctFromBottom,
        maxHigh,
        minLow,
        currentPrice
      };
    } catch (error) {
      logger.warn(`区间边界检查失败: ${error.message}`);
      return { atEdge: false, reason: `Error: ${error.message}` };
    }
  }

  /**
   * 计算平均成交量
   * @private
   */
  _calculateAvgVolume(volumes, period) {
    const n = Math.min(period, volumes.length);
    const slice = volumes.slice(-n);
    return slice.reduce((sum, vol) => sum + vol, 0) / n;
  }

  /**
   * 计算Delta
   * @private
   */
  _calculateDelta(prices, volumes) {
    if (prices.length < 2) return 0;

    let buyVolume = 0;
    let sellVolume = 0;

    // 取最近10根K线
    const startIdx = Math.max(0, prices.length - 10);
    
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
   * 验证输入数据
   * @private
   */
  _validateInput(klines15m, klines1H, klines4H) {
    if (!klines15m || klines15m.length < 20) {
      logger.warn('15M数据不足');
      return false;
    }
    if (!klines1H || klines1H.length < 20) {
      logger.warn('1H数据不足');
      return false;
    }
    if (!klines4H || klines4H.length < this.params.rangeLookback4H) {
      logger.warn('4H数据不足');
      return false;
    }
    return true;
  }

  /**
   * 收集失败原因
   * @private
   */
  _collectFailReasons(details) {
    const reasons = [];
    
    if (!details.volumeCheck.passed) {
      reasons.push(`成交量不足(${details.volumeCheck.ratio.toFixed(2)}x < ${this.params.volFactor}x)`);
    }
    if (!details.deltaCheck.passed) {
      reasons.push(`Delta不同向或不足(15M=${details.deltaCheck.delta15m.toFixed(3)}, 1H=${details.deltaCheck.delta1H.toFixed(3)})`);
    }
    if (!details.confirmCheck.passed) {
      reasons.push(`回撤过大(${(details.confirmCheck.reclaimDiff * 100).toFixed(2)}%)`);
    }
    if (!details.atrCheck.passed) {
      reasons.push(`ATR异常(${details.atrCheck.ratio.toFixed(2)}x)`);
    }
    if (details.boundaryCheck.atEdge) {
      const edgeType = details.boundaryCheck.atTopEdge ? '上轨' : '下轨';
      reasons.push(`在区间${edgeType}边界`);
    }
    
    return reasons;
  }

  /**
   * 构建结果对象
   * @private
   */
  _buildResult(passed, reason, details = {}) {
    return {
      passed,
      reason,
      details,
      timestamp: new Date()
    };
  }

  /**
   * 更新参数配置
   * @param {Object} newParams - 新参数
   */
  updateParams(newParams) {
    this.params = { ...this.params, ...newParams };
    logger.info(`假突破过滤器参数已更新: ${JSON.stringify(this.params)}`);
  }

  /**
   * 获取当前参数配置
   * @returns {Object} 当前参数
   */
  getParams() {
    return { ...this.params };
  }
}

module.exports = FakeBreakoutFilter;

