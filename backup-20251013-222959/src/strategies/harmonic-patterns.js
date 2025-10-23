/**
 * 谐波形态检测器
 * 根据ict-plus.md：检测Cypher、Bat、Shark三种谐波形态
 * 
 * 谐波形态原理：
 * - 基于Fibonacci回撤和扩展比例
 * - 识别X、A、B、C、D五个关键点
 * - 每种形态有特定的比例要求
 * 
 * 用途：
 * - 精准化ICT策略的15M入场确认
 * - 提供谐波共振信号，提高入场精准度
 */

const logger = require('../utils/logger');

class HarmonicPatterns {
  /**
   * 计算Fibonacci回撤比例
   * @param {number} start - 起点价格
   * @param {number} end - 终点价格
   * @returns {number} 回撤比例（0-1之间）
   */
  static calculateFibRatio(start, end) {
    if (start === 0 || start === end) return 0;
    return Math.abs((end - start) / start);
  }

  /**
   * 检查比例是否在容差范围内
   * @param {number} ratio - 实际比例
   * @param {number} target - 目标比例
   * @param {number} tolerance - 容差（默认10%，放宽检测）
   * @returns {boolean} 是否匹配
   */
  static isRatioMatch(ratio, target, tolerance = 0.10) {
    return ratio >= target * (1 - tolerance) && ratio <= target * (1 + tolerance);
  }

  /**
   * 检测Cypher形态
   * 
   * 比例要求：
   * - AB: 38.2% - 61.8% of XA
   * - BC: 113% - 141.4% of AB
   * - CD: 78.6% - 88.6% of XC
   * 
   * @param {Object} points - {X, A, B, C, D} 五个关键点价格
   * @returns {Object} {detected, confidence}
   */
  static detectCypher(points) {
    const { X, A, B, C, D } = points;

    // 计算各段Fibonacci比例（修正计算逻辑）
    const XA = Math.abs(A - X);
    const AB = Math.abs(B - X);
    const BC = Math.abs(C - B);
    const XC = Math.abs(C - X);
    const CD = Math.abs(D - X);

    const AB_XA = XA === 0 ? 0 : AB / XA;
    const BC_AB = AB === 0 ? 0 : BC / AB;
    const CD_XC = XC === 0 ? 0 : CD / XC;

    // Cypher形态比例要求（放宽检测条件）
    const AB_valid = AB_XA >= 0.35 && AB_XA <= 0.65; // 放宽到35%-65%
    const BC_valid = BC_AB >= 1.05 && BC_AB <= 1.50; // 放宽到105%-150%
    const CD_valid = CD_XC >= 0.75 && CD_XC <= 0.95; // 放宽到75%-95%

    const detected = AB_valid && BC_valid && CD_valid;

    if (detected) {
      // 计算置信度（根据比例接近理想值的程度）
      const AB_conf = 1 - Math.abs(AB_XA - 0.5) / 0.5;
      const BC_conf = 1 - Math.abs(BC_AB - 1.272) / 1.272;
      const CD_conf = 1 - Math.abs(CD_XC - 0.836) / 0.836;
      const confidence = (AB_conf + BC_conf + CD_conf) / 3;

      logger.info(`检测到Cypher形态: AB=${AB_XA.toFixed(3)}, BC=${BC_AB.toFixed(3)}, CD=${CD_XC.toFixed(3)}, conf=${confidence.toFixed(2)}`);

      return { detected: true, confidence: Math.min(confidence, 0.9) };
    }

    return { detected: false, confidence: 0 };
  }

  /**
   * 检测Bat形态
   * 
   * 比例要求：
   * - AB: 38.2% - 50% of XA
   * - BC: 38.2% - 88.6% of AB
   * - CD: 88.6% of XC
   * 
   * @param {Object} points - {X, A, B, C, D}
   * @returns {Object} {detected, confidence}
   */
  static detectBat(points) {
    const { X, A, B, C, D } = points;

    // 计算各段Fibonacci比例（修正计算逻辑）
    const XA = Math.abs(A - X);
    const AB = Math.abs(B - X);
    const BC = Math.abs(C - B);
    const XC = Math.abs(C - X);
    const CD = Math.abs(D - X);

    const AB_XA = XA === 0 ? 0 : AB / XA;
    const BC_AB = AB === 0 ? 0 : BC / AB;
    const CD_XC = XC === 0 ? 0 : CD / XC;

    // Bat形态比例要求（放宽检测条件）
    const AB_valid = AB_XA >= 0.35 && AB_XA <= 0.55; // 放宽到35%-55%
    const BC_valid = BC_AB >= 0.35 && BC_AB <= 0.95; // 放宽到35%-95%
    const CD_valid = CD_XC >= 0.80 && CD_XC <= 0.95; // 放宽到80%-95%

    const detected = AB_valid && BC_valid && CD_valid;

    if (detected) {
      const AB_conf = 1 - Math.abs(AB_XA - 0.441) / 0.441;
      const BC_conf = 1 - Math.abs(BC_AB - 0.634) / 0.634;
      const CD_conf = 1 - Math.abs(CD_XC - 0.886) / 0.886;
      const confidence = (AB_conf + BC_conf + CD_conf) / 3;

      logger.info(`检测到Bat形态: AB=${AB_XA.toFixed(3)}, BC=${BC_AB.toFixed(3)}, CD=${CD_XC.toFixed(3)}, conf=${confidence.toFixed(2)}`);

      return { detected: true, confidence: Math.min(confidence, 0.8) };
    }

    return { detected: false, confidence: 0 };
  }

  /**
   * 检测Shark形态
   * 
   * 比例要求：
   * - AB: 113% - 161.8% of XA (扩展)
   * - BC: 113% - 161.8% of AB (扩展)
   * - CD: 88.6% - 100% of XC
   * 
   * @param {Object} points - {X, A, B, C, D}
   * @returns {Object} {detected, confidence}
   */
  static detectShark(points) {
    const { X, A, B, C, D } = points;

    // 计算各段Fibonacci比例（修正计算逻辑）
    const XA = Math.abs(A - X);
    const AB = Math.abs(B - X);
    const BC = Math.abs(C - B);
    const XC = Math.abs(C - X);
    const CD = Math.abs(D - X);

    const AB_XA = XA === 0 ? 0 : AB / XA;
    const BC_AB = AB === 0 ? 0 : BC / AB;
    const CD_XC = XC === 0 ? 0 : CD / XC;

    // Shark形态比例要求（注意是扩展而非回撤）
    // Shark形态比例要求（放宽检测条件）
    const AB_valid = AB_XA >= 1.05 && AB_XA <= 1.70; // 放宽到105%-170%
    const BC_valid = BC_AB >= 1.05 && BC_AB <= 1.70; // 放宽到105%-170%
    const CD_valid = CD_XC >= 0.80 && CD_XC <= 1.10; // 放宽到80%-110%

    const detected = AB_valid && BC_valid && CD_valid;

    if (detected) {
      const AB_conf = 1 - Math.abs(AB_XA - 1.374) / 1.374;
      const BC_conf = 1 - Math.abs(BC_AB - 1.374) / 1.374;
      const CD_conf = 1 - Math.abs(CD_XC - 0.943) / 0.943;
      const confidence = (AB_conf + BC_conf + CD_conf) / 3;

      logger.info(`检测到Shark形态: AB=${AB_XA.toFixed(3)}, BC=${BC_AB.toFixed(3)}, CD=${CD_XC.toFixed(3)}, conf=${confidence.toFixed(2)}`);

      return { detected: true, confidence: Math.min(confidence, 0.85) };
    }

    return { detected: false, confidence: 0 };
  }

  /**
   * 识别关键点（X, A, B, C, D）
   * 使用改进的Swing High/Low方法
   * 
   * @param {Array} klines - K线数据（至少50根）
   * @returns {Object} {X, A, B, C, D} 或 null
   */
  static identifyKeyPoints(klines) {
    if (!klines || klines.length < 50) {
      logger.warn('K线数据不足，无法识别谐波关键点');
      return null;
    }

    try {
      const len = klines.length;

      // 寻找最近的有效摆动高低点
      // 使用更合理的时间窗口来识别关键点

      // X点：寻找50根K线范围内的最低点
      let X = parseFloat(klines[len - 50][3]);
      let X_idx = len - 50;
      for (let i = len - 50; i < len - 40; i++) {
        const low = parseFloat(klines[i][3]);
        if (low < X) {
          X = low;
          X_idx = i;
        }
      }

      // A点：寻找40-30根K线范围内的最高点
      let A = parseFloat(klines[len - 40][2]);
      let A_idx = len - 40;
      for (let i = len - 40; i < len - 30; i++) {
        const high = parseFloat(klines[i][2]);
        if (high > A) {
          A = high;
          A_idx = i;
        }
      }

      // B点：寻找30-20根K线范围内的最低点
      let B = parseFloat(klines[len - 30][3]);
      let B_idx = len - 30;
      for (let i = len - 30; i < len - 20; i++) {
        const low = parseFloat(klines[i][3]);
        if (low < B) {
          B = low;
          B_idx = i;
        }
      }

      // C点：寻找20-10根K线范围内的最高点
      let C = parseFloat(klines[len - 20][2]);
      let C_idx = len - 20;
      for (let i = len - 20; i < len - 10; i++) {
        const high = parseFloat(klines[i][2]);
        if (high > C) {
          C = high;
          C_idx = i;
        }
      }

      // D点：寻找最近10根K线范围内的最低点
      let D = parseFloat(klines[len - 1][3]);
      let D_idx = len - 1;
      for (let i = len - 10; i < len; i++) {
        const low = parseFloat(klines[i][3]);
        if (low < D) {
          D = low;
          D_idx = i;
        }
      }

      // 验证关键点的有效性（确保X < A > B < C > D的基本结构）
      if (X >= A || A <= B || B >= C || C <= D) {
        logger.debug(`关键点结构无效: X=${X}, A=${A}, B=${B}, C=${C}, D=${D}`);
        // 如果结构无效，使用简化的固定位置方法
        X = parseFloat(klines[len - 50][3]);
        A = parseFloat(klines[len - 40][2]);
        B = parseFloat(klines[len - 30][3]);
        C = parseFloat(klines[len - 20][2]);
        D = parseFloat(klines[len - 1][3]);
      }

      return { X, A, B, C, D };
    } catch (error) {
      logger.error(`识别关键点失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 检测所有谐波形态（主方法）
   * @param {Array} klines - K线数据
   * @returns {Object} {type, confidence, score, details}
   */
  static detectHarmonicPattern(klines) {
    const points = this.identifyKeyPoints(klines);

    if (!points) {
      return {
        detected: false,
        type: 'NONE',
        confidence: 0,
        score: 0
      };
    }

    // 依次检测三种形态（优先级：Cypher > Bat > Shark）
    const cypher = this.detectCypher(points);
    if (cypher.detected) {
      return {
        detected: true,
        type: 'CYPHER',
        confidence: cypher.confidence,
        score: cypher.confidence * 0.9, // 最高得分0.9
        points
      };
    }

    const bat = this.detectBat(points);
    if (bat.detected) {
      return {
        detected: true,
        type: 'BAT',
        confidence: bat.confidence,
        score: bat.confidence * 0.8, // 最高得分0.8
        points
      };
    }

    const shark = this.detectShark(points);
    if (shark.detected) {
      return {
        detected: true,
        type: 'SHARK',
        confidence: shark.confidence,
        score: shark.confidence * 0.85, // 最高得分0.85
        points
      };
    }

    return {
      detected: false,
      type: 'NONE',
      confidence: 0,
      score: 0,
      points // 即使没有检测到形态，也返回关键点用于调试
    };
  }

  /**
   * 判断谐波形态的交易方向
   * @param {string} type - 形态类型
   * @param {Object} points - 关键点
   * @returns {string} 'BUY' 或 'SELL' 或 null
   */
  static getHarmonicDirection(type, points) {
    if (!points || type === 'NONE') return null;

    // 简化判断：基于D点相对于C点的位置
    // 如果D点在C点下方，通常是看涨形态（等待反弹）
    // 如果D点在C点上方，通常是看跌形态（等待回落）

    if (points.D < points.C) {
      return 'BUY'; // 看涨形态
    } else if (points.D > points.C) {
      return 'SELL'; // 看跌形态
    }

    return null;
  }
}

module.exports = HarmonicPatterns;

