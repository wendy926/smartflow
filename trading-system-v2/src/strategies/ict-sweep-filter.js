/**
 * ICT扫荡方向过滤器
 * 根据ict-plus.md优化：扫荡信号方向化
 * 
 * 核心逻辑：
 * - 上升趋势只接受下方扫荡（buy-side liquidity grab） - 这是买入机会
 * - 下降趋势只接受上方扫荡（sell-side liquidity grab） - 这是卖出机会
 * - 震荡市不交易
 * 
 * 解决问题：消除方向错配导致的逆势入场和诱多/诱空陷阱
 */

const logger = require('../utils/logger');

class SweepDirectionFilter {
  /**
   * 过滤扫荡方向
   * @param {string} trend - 趋势方向 'UP'/'DOWN'/'RANGE'
   * @param {string} sweepType - 扫荡类型 'LIQUIDITY_SWEEP_UP'/'LIQUIDITY_SWEEP_DOWN'/null
   * @returns {boolean} 是否有效
   */
  static isValidSweepDirection(trend, sweepType) {
    if (!sweepType) {
      return false; // 无扫荡信号
    }

    if (trend === 'UP') {
      // 上升趋势只接受下方扫荡（buy-side）
      // 下方扫荡 = 价格向下刺破低点后快速收回 = 机构吸筹信号
      return sweepType === 'LIQUIDITY_SWEEP_DOWN';
    } else if (trend === 'DOWN') {
      // 下降趋势只接受上方扫荡（sell-side）
      // 上方扫荡 = 价格向上刺破高点后快速回落 = 机构出货信号
      return sweepType === 'LIQUIDITY_SWEEP_UP';
    }

    // 震荡市不交易
    return false;
  }

  /**
   * 验证扫荡方向并返回详细信息
   * @param {string} trend - 趋势方向
   * @param {Object} sweepResult - 扫荡检测结果
   * @returns {Object} {valid: boolean, reason: string, direction: string}
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
   * 获取扫荡说明（用于日志和调试）
   * @param {string} trend - 趋势方向
   * @param {string} sweepType - 扫荡类型
   * @param {boolean} isValid - 是否有效
   * @returns {string} 说明文字
   */
  static getSweepExplanation(trend, sweepType, isValid) {
    if (!isValid) {
      if (trend === 'UP' && sweepType === 'LIQUIDITY_SWEEP_UP') {
        return '⚠️ 上升趋势中的上方扫荡可能是诱多陷阱，拒绝信号';
      }
      if (trend === 'DOWN' && sweepType === 'LIQUIDITY_SWEEP_DOWN') {
        return '⚠️ 下降趋势中的下方扫荡可能是诱空陷阱，拒绝信号';
      }
      if (trend === 'RANGE') {
        return '震荡市不适用ICT策略';
      }
      return '扫荡方向与趋势不匹配';
    }

    if (trend === 'UP' && sweepType === 'LIQUIDITY_SWEEP_DOWN') {
      return '✅ 上升趋势 + 下方扫荡 = 买入机会（机构吸筹）';
    }
    if (trend === 'DOWN' && sweepType === 'LIQUIDITY_SWEEP_UP') {
      return '✅ 下降趋势 + 上方扫荡 = 卖出机会（机构出货）';
    }

    return '扫荡方向与趋势一致';
  }

  /**
   * 获取推荐交易方向
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

