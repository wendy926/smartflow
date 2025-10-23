/**
 * 聪明钱信号整合器
 * 
 * 功能：
 * - 整合大额挂单信号（LargeOrderDetector）
 * - 整合技术指标（CVD, OBI, OI）
 * - 按smartmoney.md要求的加权公式计算综合信号
 * - 输出6种动作：ACCUMULATE/DISTRIBUTION/MARKUP/MARKDOWN/MANIPULATION/UNKNOWN
 * 
 * 公式：
 * smartScore = w_order * orderSignalScore + 
 *              w_cvd * cvdZ + 
 *              w_oi * oiZ + 
 *              w_delta * deltaZ
 * 
 * @module smart-money/signal-integrator
 */

const logger = require('../../utils/logger');

/**
 * 信号整合器
 * 整合多个数据源，输出综合的聪明钱动作判断
 */
class SignalIntegrator {
  constructor(params = {}) {
    // 默认权重配置（按文档建议）
    this.weights = {
      order: params.weight_order || 0.4,    // 大额挂单权重
      cvd: params.weight_cvd || 0.3,        // CVD权重
      oi: params.weight_oi || 0.2,          // OI权重
      delta: params.weight_delta || 0.1     // Delta权重
    };

    logger.info('[SignalIntegrator] 初始化信号整合器', { weights: this.weights });
  }

  /**
   * 整合所有信号，输出最终动作
   * @param {Object} largeOrderSignal - 大额挂单信号
   * @param {Object} indicators - 技术指标 {cvdZ, obiZ, oiZ, volZ, deltaZ}
   * @returns {Object} 整合结果
   */
  integrate(largeOrderSignal, indicators) {
    try {
      // 1. 提取大额挂单信号得分
      const orderScore = this._normalizeOrderScore(
        largeOrderSignal.buyScore,
        largeOrderSignal.sellScore
      );

      // 2. 提取指标Z-score
      const cvdZ = indicators.cvdZ || 0;
      const oiZ = indicators.oiZ || 0;
      const deltaZ = indicators.deltaZ || 0;

      // 3. 按权重计算综合得分
      const smartScore = 
        this.weights.order * orderScore +
        this.weights.cvd * cvdZ +
        this.weights.oi * oiZ +
        this.weights.delta * deltaZ;

      // 4. 优先使用大额挂单的动作判断（如果有明确信号）
      let finalAction = largeOrderSignal.finalAction;
      let confidence = this._calculateConfidence(smartScore, largeOrderSignal);

      // 5. 如果大额挂单判断为UNKNOWN，使用传统四象限模型
      if (finalAction === 'UNKNOWN') {
        finalAction = this._mapScoreToAction(
          smartScore,
          indicators.priceChange,
          cvdZ,
          indicators.oiChange,
          indicators.obiZ
        );
        confidence = this._calculateTraditionalConfidence(indicators);
      }

      return {
        action: finalAction,
        confidence: parseFloat(confidence.toFixed(2)),
        smartScore: parseFloat(smartScore.toFixed(2)),
        components: {
          orderScore: parseFloat(orderScore.toFixed(2)),
          cvdZ: parseFloat(cvdZ.toFixed(2)),
          oiZ: parseFloat(oiZ.toFixed(2)),
          deltaZ: parseFloat(deltaZ.toFixed(2))
        },
        weights: this.weights,
        largeOrderPresent: largeOrderSignal.trackedEntriesCount > 0,
        spoofDetected: largeOrderSignal.spoofCount > 0,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('[SignalIntegrator] 整合失败:', error);
      return {
        action: 'UNKNOWN',
        confidence: 0,
        error: error.message
      };
    }
  }

  /**
   * 标准化大额挂单得分（-1到+1）
   * @private
   */
  _normalizeOrderScore(buyScore, sellScore) {
    const total = buyScore + sellScore;
    if (total === 0) return 0;

    const diff = buyScore - sellScore;
    // 归一化到-1到+1
    return diff / (total + 1); // +1避免除零
  }

  /**
   * 计算置信度（综合版）
   * @private
   */
  _calculateConfidence(smartScore, largeOrderSignal) {
    let baseConfidence = Math.min(0.95, Math.max(0.30, Math.abs(smartScore) / 2));

    // 如果有大额挂单，提升置信度
    if (largeOrderSignal.trackedEntriesCount > 0) {
      baseConfidence *= 1.2;
    }

    // 如果有Spoof，降低置信度
    if (largeOrderSignal.spoofCount > 0) {
      baseConfidence *= 0.8;
    }

    // 如果买卖得分差距大，提升置信度
    const scoreDiff = Math.abs(largeOrderSignal.buyScore - largeOrderSignal.sellScore);
    if (scoreDiff > 5) {
      baseConfidence *= 1.1;
    }

    return Math.min(0.95, Math.max(0.30, baseConfidence));
  }

  /**
   * 使用传统四象限模型映射动作（当大额挂单无明确信号时）
   * @private
   */
  _mapScoreToAction(smartScore, priceChange, cvdZ, oiChange, obiZ) {
    const cvdRising = cvdZ > 0.5;
    const cvdFalling = cvdZ < -0.5;
    const oiRising = oiChange > 0;
    const oiFalling = oiChange < 0;

    // 简化判断：基于CVD和OI的组合
    if (cvdRising && oiRising) {
      // CVD上升 + OI上升
      return priceChange > 0 ? 'MARKUP' : 'ACCUMULATE';
    }

    if (cvdFalling && oiFalling) {
      // CVD下降 + OI下降
      return 'MARKDOWN';
    }

    if (cvdFalling && oiRising) {
      // CVD下降但OI上升（派发特征）
      return 'DISTRIBUTION';
    }

    return 'UNKNOWN';
  }

  /**
   * 计算传统模型置信度
   * @private
   */
  _calculateTraditionalConfidence(indicators) {
    const cvdStrength = Math.min(1, Math.abs(indicators.cvdZ || 0) / 2);
    const oiStrength = Math.min(1, Math.abs(indicators.oiChange || 0) / 10000);
    
    const confidence = cvdStrength * 0.6 + oiStrength * 0.4;
    return Math.min(0.95, Math.max(0.30, confidence));
  }

  /**
   * 更新权重配置
   * @param {Object} newWeights - 新权重
   */
  updateWeights(newWeights) {
    this.weights = { ...this.weights, ...newWeights };
    logger.info('[SignalIntegrator] 权重已更新:', this.weights);
  }

  /**
   * 获取当前权重
   * @returns {Object} 权重配置
   */
  getWeights() {
    return { ...this.weights };
  }
}

module.exports = SignalIntegrator;

