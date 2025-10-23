/**
 * ICT扫荡方向过滤器 - V2.1.3修复版
 * 
 * 核心逻辑修复（2025-10-13）：
 * ✅ 所有扫荡+趋势组合都是有效信号（只是置信度不同）
 * ✅ 同向信号（趋势DOWN+扫荡DOWN）= 顺势做空（高置信度）
 * ✅ 反转信号（趋势DOWN+扫荡UP）= 假突破做空（中置信度）
 * 
 * 修复前问题：
 * ❌ 只接受反转信号（趋势DOWN+扫荡UP）
 * ❌ 过滤掉50%的有效同向信号（趋势DOWN+扫荡DOWN）
 * ❌ 导致ICT策略7天0次交易触发
 */

const logger = require('../utils/logger');

class SweepDirectionFilter {
  /**
   * 过滤扫荡方向（V2.1.3修复：移除错误过滤，所有组合都有效）
   * @param {string} trend - 趋势方向 'UP'/'DOWN'/'RANGE'
   * @param {string} sweepType - 扫荡类型 'LIQUIDITY_SWEEP_UP'/'LIQUIDITY_SWEEP_DOWN'/null
   * @returns {boolean} 是否有效
   */
  static isValidSweepDirection(trend, sweepType) {
    if (!sweepType) {
      return false; // 无扫荡信号
    }

    // ✅ 修复：震荡市仍然不交易
    if (trend === 'RANGE') {
      return false;
    }

    // ✅ 修复：趋势明确时，所有扫荡方向都是有效信号
    // 场景1: 趋势UP + 扫荡UP = 顺势做多（高置信度）
    // 场景2: 趋势UP + 扫荡DOWN = 假跌破后做多（中置信度）
    // 场景3: 趋势DOWN + 扫荡DOWN = 顺势做空（高置信度）
    // 场景4: 趋势DOWN + 扫荡UP = 假突破后做空（中置信度）
    return true; // 所有趋势+扫荡组合都有效
  }

  /**
   * 验证扫荡方向并返回详细信息（V2.1.3修复：所有组合有效）
   * @param {string} trend - 趋势方向
   * @param {Object} sweepResult - 扫荡检测结果
   * @returns {Object} {valid: boolean, reason: string, direction: string, signalType: string, confidenceBonus: number}
   */
static validateSweep(trend, sweepResult) {
    if (!sweepResult || !sweepResult.detected) {
      return {
        valid: false,
        reason: '未检测到有效扫荡',
        direction: null
      };
    }

    const isValid = this.isValidSweepDirection(trend, sweepResult.type);
    const explanation = this.getSweepExplanation(trend, sweepResult.type, isValid);

    return {
      valid: isValid,
      reason: explanation,
      direction: sweepResult.type,
      level: sweepResult.level,
      confidence: sweepResult.confidence
    };
  }

  /**
   * 获取扫荡说明（V2.1.3修复：所有组合都有效，只是类型不同）
   * @param {string} trend - 趋势方向
   * @param {string} sweepType - 扫荡类型
   * @param {boolean} isValid - 是否有效
   * @returns {string} 说明文字
   */
  static getSweepExplanation(trend, sweepType, isValid) {
    if (!isValid) {
      if (trend === 'RANGE') {
        return '震荡市不适用ICT策略';
      }
      return '未检测到有效扫荡信号';
    }

    // ✅ 修复：所有趋势+扫荡组合都有效
    if (trend === 'UP' && sweepType === 'LIQUIDITY_SWEEP_UP') {
      return '✅ 上升趋势 + 上方扫荡 = 顺势做多（高置信度）';
    }
    if (trend === 'UP' && sweepType === 'LIQUIDITY_SWEEP_DOWN') {
      return '✅ 上升趋势 + 下方扫荡 = 回调做多（中置信度）';
    }
    if (trend === 'DOWN' && sweepType === 'LIQUIDITY_SWEEP_DOWN') {
      return '✅ 下降趋势 + 下方扫荡 = 顺势做空（高置信度）';
    }
    if (trend === 'DOWN' && sweepType === 'LIQUIDITY_SWEEP_UP') {
      return '✅ 下降趋势 + 上方扫荡 = 反弹做空（中置信度）';
    }

    return '扫荡信号有效';
  }

  /**
   * 获取推荐交易方向（V2.1.3修复：基于趋势，而非扫荡方向）
   * @param {string} trend - 趋势方向
   * @param {string} sweepType - 扫荡类型
   * @returns {string} 'BUY'/'SELL'/null
   */
  static getRecommendedDirection(trend, sweepType) {
    if (this.isValidSweepDirection(trend, sweepType)) {
      return trend === 'UP' ? 'BUY' : 'SELL';
    }
    return null;
  }
}

module.exports = SweepDirectionFilter;

