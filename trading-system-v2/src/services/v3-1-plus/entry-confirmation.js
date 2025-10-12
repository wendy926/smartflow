/**
 * V3.1-Plus 优化 - 入场确认管理模块
 * 
 * 功能：
 * - 多因子入场确认（成交量、Delta、早期趋势、SmartMoney）
 * - 突破确认等待（1根15M收盘）
 * - 确认项计数和阈值判断
 * 
 * 设计原则：
 * - 单一职责：仅负责入场确认逻辑
 * - 可配置：所有阈值参数化
 * - 透明：返回详细的确认结果
 * 
 * @module v3-1-plus/entry-confirmation
 */

const logger = require('../../utils/logger');

/**
 * 入场确认管理器
 * 提供多因子确认机制，提高入场信号质量
 */
class EntryConfirmationManager {
  constructor(params = {}) {
    this.params = {
      confirmationWait: params.confirmationWait || 1,      // 确认等待K线数
      volFactor: params.volFactor || 1.2,                   // 成交量倍数
      deltaThreshold: params.deltaThreshold || 0.04,        // Delta阈值
      confirmCountMin: params.confirmCountMin || 2,         // 最少确认项数
      smartMoneyWeight: params.smartMoneyWeight || 0.6,     // SmartMoney分数要求
      smartMoneyRequired: params.smartMoneyRequired || false // SmartMoney是否必需
    };

    logger.info('[EntryConfirmation] 初始化入场确认管理器', this.params);
  }

  /**
   * 检查是否有确认K线（突破后等待收盘）
   * @param {Array} klines15m - 15M K线数据
   * @returns {boolean} 是否有足够的确认K线
   */
  hasConfirmationCandle(klines15m) {
    // 确保至少有confirmationWait + 1根K线（突破K线 + 确认K线）
    return klines15m && klines15m.length >= this.params.confirmationWait + 1;
  }

  /**
   * 检查成交量是否确认
   * @param {Array} klines15m - 15M K线数据
   * @param {number} avgVolPeriod - 平均成交量周期（默认20）
   * @returns {Object} {ok: boolean, ratio: number, avgVol: number}
   */
  checkVolume(klines15m, avgVolPeriod = 20) {
    try {
      if (!klines15m || klines15m.length < avgVolPeriod + 1) {
        return { ok: false, ratio: 0, avgVol: 0, reason: 'insufficient_data' };
      }

      // 计算平均成交量（排除最后一根）
      const volSlice = klines15m.slice(-(avgVolPeriod + 1), -1);
      const avgVol = volSlice.reduce((sum, k) => sum + parseFloat(k[5]), 0) / volSlice.length;

      // 当前K线成交量
      const currentVol = parseFloat(klines15m[klines15m.length - 1][5]);

      // 计算比率
      const ratio = avgVol > 0 ? currentVol / avgVol : 0;

      // 判断是否通过
      const ok = ratio >= this.params.volFactor;

      return {
        ok,
        ratio: parseFloat(ratio.toFixed(2)),
        avgVol: parseFloat(avgVol.toFixed(2)),
        currentVol: parseFloat(currentVol.toFixed(2)),
        threshold: this.params.volFactor
      };
    } catch (error) {
      logger.error('[EntryConfirmation] checkVolume错误:', error);
      return { ok: false, ratio: 0, avgVol: 0, reason: 'error' };
    }
  }

  /**
   * 检查Delta是否同向且满足阈值
   * @param {Array} klines15m - 15M K线数据
   * @param {Array} klines1h - 1H K线数据
   * @returns {Object} {ok: boolean, delta15m: number, delta1h: number}
   */
  checkDelta(klines15m, klines1h) {
    try {
      if (!klines15m || !klines1h || klines15m.length < 3 || klines1h.length < 3) {
        return { ok: false, delta15m: 0, delta1h: 0, reason: 'insufficient_data' };
      }

      // 计算15M Delta（简化版：买卖量差/总量）
      const delta15m = this._calculateDelta(klines15m.slice(-3));
      const delta1h = this._calculateDelta(klines1h.slice(-3));

      // 检查同向
      const sameDirection = Math.sign(delta15m) === Math.sign(delta1h);

      // 检查阈值
      const meetsThreshold = Math.abs(delta15m) >= this.params.deltaThreshold;

      const ok = sameDirection && meetsThreshold;

      return {
        ok,
        delta15m: parseFloat(delta15m.toFixed(4)),
        delta1h: parseFloat(delta1h.toFixed(4)),
        sameDirection,
        meetsThreshold,
        threshold: this.params.deltaThreshold
      };
    } catch (error) {
      logger.error('[EntryConfirmation] checkDelta错误:', error);
      return { ok: false, delta15m: 0, delta1h: 0, reason: 'error' };
    }
  }

  /**
   * 简化的Delta计算（基于成交量权重）
   * @private
   * @param {Array} klines - K线数据
   * @returns {number} Delta值（-1到1之间）
   */
  _calculateDelta(klines) {
    if (!klines || klines.length === 0) return 0;

    let buyVolume = 0;
    let sellVolume = 0;

    for (const k of klines) {
      const close = parseFloat(k[4]);
      const open = parseFloat(k[1]);
      const volume = parseFloat(k[5]);

      // 简化假设：涨K线为买入，跌K线为卖出
      if (close > open) {
        buyVolume += volume;
      } else {
        sellVolume += volume;
      }
    }

    const totalVolume = buyVolume + sellVolume;
    if (totalVolume === 0) return 0;

    return (buyVolume - sellVolume) / totalVolume;
  }

  /**
   * 检查SmartMoney指标
   * @param {number} smartScore - SmartMoney分数（0-1）
   * @returns {Object} {ok: boolean, score: number}
   */
  checkSmartMoney(smartScore) {
    try {
      const score = typeof smartScore === 'number' ? smartScore : 0;
      const ok = score >= this.params.smartMoneyWeight;

      return {
        ok,
        score: parseFloat(score.toFixed(2)),
        threshold: this.params.smartMoneyWeight,
        required: this.params.smartMoneyRequired
      };
    } catch (error) {
      logger.error('[EntryConfirmation] checkSmartMoney错误:', error);
      return { ok: false, score: 0, reason: 'error' };
    }
  }

  /**
   * 综合检查所有确认项
   * @param {Array} klines15m - 15M K线数据
   * @param {Array} klines1h - 1H K线数据
   * @param {Object} data - 其他数据 {earlyTrend, smartScore, avgVolPeriod}
   * @returns {Object} 确认结果
   */
  checkConfirmations(klines15m, klines1h, data = {}) {
    try {
      const {
        earlyTrend = false,
        smartScore = 0,
        avgVolPeriod = 20
      } = data;

      // 1. 检查确认K线
      const hasConfirmation = this.hasConfirmationCandle(klines15m);

      // 2. 检查成交量
      const volCheck = this.checkVolume(klines15m, avgVolPeriod);

      // 3. 检查Delta
      const deltaCheck = this.checkDelta(klines15m, klines1h);

      // 4. 检查早期趋势
      const earlyOk = Boolean(earlyTrend);

      // 5. 检查SmartMoney
      const smartCheck = this.checkSmartMoney(smartScore);

      // 计算确认项数量
      const confirmCount = 
        (volCheck.ok ? 1 : 0) +
        (deltaCheck.ok ? 1 : 0) +
        (earlyOk ? 1 : 0) +
        (smartCheck.ok ? 1 : 0);

      // 判断是否满足最少确认项要求
      let allowed = hasConfirmation && confirmCount >= this.params.confirmCountMin;

      // 如果SmartMoney是必需的，单独检查
      if (this.params.smartMoneyRequired && !smartCheck.ok) {
        allowed = false;
      }

      const result = {
        allowed,
        hasConfirmation,
        confirmCount,
        requiredCount: this.params.confirmCountMin,
        details: {
          volume: volCheck,
          delta: deltaCheck,
          earlyTrend: { ok: earlyOk },
          smartMoney: smartCheck
        },
        reason: !allowed ? this._getRejectReason(hasConfirmation, confirmCount, smartCheck) : 'ok'
      };

      logger.debug(`[EntryConfirmation] 确认检查结果: ${confirmCount}/${this.params.confirmCountMin}项通过, allowed=${allowed}`);

      return result;
    } catch (error) {
      logger.error('[EntryConfirmation] checkConfirmations错误:', error);
      return {
        allowed: false,
        confirmCount: 0,
        reason: 'error',
        error: error.message
      };
    }
  }

  /**
   * 获取拒绝原因
   * @private
   */
  _getRejectReason(hasConfirmation, confirmCount, smartCheck) {
    if (!hasConfirmation) {
      return 'waiting_confirmation_candle';
    }
    if (this.params.smartMoneyRequired && !smartCheck.ok) {
      return 'smart_money_required_but_failed';
    }
    if (confirmCount < this.params.confirmCountMin) {
      return `insufficient_confirmations(${confirmCount}/${this.params.confirmCountMin})`;
    }
    return 'unknown';
  }

  /**
   * 更新参数
   * @param {Object} newParams - 新参数
   * @returns {void}
   */
  updateParams(newParams) {
    this.params = { ...this.params, ...newParams };
    logger.info('[EntryConfirmation] 参数已更新:', this.params);
  }

  /**
   * 获取当前参数
   * @returns {Object} 参数对象
   */
  getParams() {
    return { ...this.params };
  }
}

module.exports = EntryConfirmationManager;

