/**
 * V3.1-Plus 优化 - Pullback检测模块
 * 
 * 功能：
 * - 检测价格回撤到关键位
 * - 判断是否在EMA20上方持稳
 * - 识别支撑/阻力形成
 * 
 * 设计原则：
 * - 单一职责：仅负责Pullback检测
 * - 纯函数：无副作用，易测试
 * - 可配置：阈值参数化
 * 
 * @module v3-1-plus/pullback-detector
 */

const logger = require('../../utils/logger');

/**
 * Pullback检测器
 * 检测价格是否回撤到突破价或EMA20附近并持稳
 */
class PullbackDetector {
  constructor(params = {}) {
    this.params = {
      retracePct: params.retracePct || 0.015,           // 回撤百分比（1.5%）
      ema20Required: params.ema20Required !== false,     // 是否要求在EMA20上方
      minRetraceCandles: params.minRetraceCandles || 1,  // 最少回撤K线数
      holdCandles: params.holdCandles || 2               // 持稳K线数
    };

    logger.info('[PullbackDetector] 初始化Pullback检测器', this.params);
  }

  /**
   * 检测Pullback
   * @param {Array} klines15m - 15M K线数据
   * @param {number} breakoutPrice - 突破价格
   * @param {number} ema20 - EMA20值（可选）
   * @returns {Object} 检测结果
   */
  detect(klines15m, breakoutPrice, ema20 = null) {
    try {
      if (!klines15m || klines15m.length < 6) {
        return {
          detected: false,
          reason: 'insufficient_data',
          details: {}
        };
      }

      // 获取最近的K线
      const recentCandles = klines15m.slice(-6);
      const lastCandle = recentCandles[recentCandles.length - 1];
      const lastClose = parseFloat(lastCandle[4]);

      // 1. 检查是否回撤到突破价附近
      const retracedToBreakout = this.isRetracedToLevel(
        recentCandles,
        breakoutPrice,
        this.params.retracePct
      );

      // 2. 如果提供了EMA20，检查是否在EMA20上方
      let heldAboveEMA = null;
      if (ema20 !== null && this.params.ema20Required) {
        heldAboveEMA = this.isHeldAboveEMA(recentCandles, ema20);
      }

      // 3. 检查是否形成支撑/阻力
      const supportFormed = this.isSupportFormed(recentCandles);

      // 判断是否检测到Pullback
      let detected = retracedToBreakout.ok && supportFormed.ok;

      // 如果要求EMA20，则必须满足
      if (this.params.ema20Required && ema20 !== null) {
        detected = detected && heldAboveEMA.ok;
      }

      const result = {
        detected,
        reason: detected ? 'pullback_confirmed' : this._getRejectReason(retracedToBreakout, heldAboveEMA, supportFormed),
        details: {
          breakoutPrice,
          currentPrice: lastClose,
          retracedToBreakout,
          heldAboveEMA,
          supportFormed,
          ema20
        }
      };

      if (detected) {
        logger.info(`[PullbackDetector] ✅ Pullback检测成功: 价格=${lastClose}, 突破价=${breakoutPrice}, EMA20=${ema20}`);
      } else {
        logger.debug(`[PullbackDetector] Pullback未检测到: ${result.reason}`);
      }

      return result;
    } catch (error) {
      logger.error('[PullbackDetector] detect错误:', error);
      return {
        detected: false,
        reason: 'error',
        error: error.message
      };
    }
  }

  /**
   * 检查价格是否回撤到指定水平
   * @param {Array} candles - K线数据
   * @param {number} level - 水平价格
   * @param {number} tolerancePct - 容差百分比
   * @returns {Object} {ok: boolean, distance: number}
   */
  isRetracedToLevel(candles, level, tolerancePct) {
    try {
      const lastClose = parseFloat(candles[candles.length - 1][4]);
      const distance = Math.abs(lastClose - level) / level;
      const ok = distance <= tolerancePct;

      return {
        ok,
        distance: parseFloat(distance.toFixed(4)),
        distancePct: parseFloat((distance * 100).toFixed(2)),
        tolerance: tolerancePct,
        tolerancePct: parseFloat((tolerancePct * 100).toFixed(2))
      };
    } catch (error) {
      logger.error('[PullbackDetector] isRetracedToLevel错误:', error);
      return { ok: false, distance: 1, reason: 'error' };
    }
  }

  /**
   * 检查价格是否在EMA20上方持稳
   * @param {Array} candles - K线数据
   * @param {number} ema20 - EMA20值
   * @returns {Object} {ok: boolean, holdCount: number}
   */
  isHeldAboveEMA(candles, ema20) {
    try {
      if (!ema20 || ema20 <= 0) {
        return { ok: true, holdCount: 0, reason: 'ema20_not_provided' };
      }

      // 检查最近holdCandles根K线的收盘价
      const checkCandles = candles.slice(-this.params.holdCandles);
      let holdCount = 0;

      for (const candle of checkCandles) {
        const close = parseFloat(candle[4]);
        if (close >= ema20) {
          holdCount++;
        }
      }

      const ok = holdCount >= this.params.holdCandles;

      return {
        ok,
        holdCount,
        required: this.params.holdCandles,
        ema20,
        lastClose: parseFloat(checkCandles[checkCandles.length - 1][4])
      };
    } catch (error) {
      logger.error('[PullbackDetector] isHeldAboveEMA错误:', error);
      return { ok: false, holdCount: 0, reason: 'error' };
    }
  }

  /**
   * 检查是否形成支撑/阻力
   * @param {Array} candles - K线数据（至少3根）
   * @returns {Object} {ok: boolean, pattern: string}
   */
  isSupportFormed(candles) {
    try {
      if (candles.length < 3) {
        return { ok: false, pattern: null, reason: 'insufficient_candles' };
      }

      // 获取最近3根K线
      const [c1, c2, c3] = candles.slice(-3);
      const low1 = parseFloat(c1[3]);
      const low2 = parseFloat(c2[3]);
      const low3 = parseFloat(c3[3]);
      const close3 = parseFloat(c3[4]);

      // 模式1：形成低点后反弹（V形反转）
      const vPattern = low2 < low1 && close3 > low2;

      // 模式2：多次测试底部（W形底部）
      const wPattern = Math.abs(low1 - low2) / low1 < 0.005 && close3 > Math.max(low1, low2);

      // 模式3：逐步抬高低点（上升支撑）
      const risingSupport = low3 > low2 && low2 > low1;

      const ok = vPattern || wPattern || risingSupport;
      let pattern = null;

      if (vPattern) pattern = 'V-reversal';
      else if (wPattern) pattern = 'W-bottom';
      else if (risingSupport) pattern = 'rising-support';

      return {
        ok,
        pattern,
        lows: [low1, low2, low3],
        lastClose: close3
      };
    } catch (error) {
      logger.error('[PullbackDetector] isSupportFormed错误:', error);
      return { ok: false, pattern: null, reason: 'error' };
    }
  }

  /**
   * 获取拒绝原因
   * @private
   */
  _getRejectReason(retracedToBreakout, heldAboveEMA, supportFormed) {
    if (!retracedToBreakout.ok) {
      return `not_retraced(distance=${retracedToBreakout.distancePct}%)`;
    }
    if (heldAboveEMA && !heldAboveEMA.ok) {
      return `below_ema20(hold=${heldAboveEMA.holdCount}/${heldAboveEMA.required})`;
    }
    if (!supportFormed.ok) {
      return 'no_support_formed';
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
    logger.info('[PullbackDetector] 参数已更新:', this.params);
  }
}

module.exports = PullbackDetector;

