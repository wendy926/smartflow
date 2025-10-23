/**
 * OrderClassifier - 大额挂单分类器
 * 根据挂单特征分类为 DEFENSIVE_BUY/SELL、SWEEP_BUY/SELL、SPOOF 等
 * 
 * @module OrderClassifier
 */

const logger = require('../../utils/logger');

/**
 * 挂单分类类型
 * @enum {string}
 */
const Classification = {
  DEFENSIVE_BUY: 'DEFENSIVE_BUY',       // 防守性买单（吸筹/支撑）
  DEFENSIVE_SELL: 'DEFENSIVE_SELL',     // 防守性卖单（派发/压制）
  SWEEP_BUY: 'SWEEP_BUY',               // 扫单买入（拉升）
  SWEEP_SELL: 'SWEEP_SELL',             // 扫单卖出（砸盘）
  SPOOF: 'SPOOF',                       // 诱导挂单
  MANIPULATION: 'MANIPULATION',         // 操纵
  UNKNOWN: 'UNKNOWN'                    // 未知
};

class OrderClassifier {
  /**
   * @param {Object} config - 配置参数
   * @param {number} config.impactRatioThreshold - 影响力阈值
   * @param {number} config.spoofWindowMs - Spoof判定时间窗口
   */
  constructor(config) {
    this.config = config;
    logger.info('[OrderClassifier] 初始化完成', config);
  }

  /**
   * 分类单个挂单
   * @param {Object} entry - 追踪条目
   * @returns {string} 分类结果
   */
  classify(entry) {
    try {
      // 1. 已标记为 Spoof
      if (entry.isSpoof) {
        return Classification.SPOOF;
      }

      // 2. 被消耗（SWEEP）
      if (entry.wasConsumed && entry.filledVolumeObserved > entry.qty * 0.3) {
        return entry.side === 'bid' 
          ? Classification.SWEEP_SELL  // bid被吃 = 主动卖出砸盘
          : Classification.SWEEP_BUY;  // ask被吃 = 主动买入拉升
      }

      // 3. 持续存在（DEFENSIVE）
      if (entry.isPersistent && !entry.wasConsumed) {
        return entry.side === 'bid'
          ? Classification.DEFENSIVE_BUY   // 持续bid = 防守/吸筹
          : Classification.DEFENSIVE_SELL; // 持续ask = 防守/派发
      }

      // 4. 高影响力但未持续
      if (entry.impactRatio >= this.config.impactRatioThreshold) {
        if (entry.canceledAt && !entry.isPersistent) {
          return Classification.SPOOF; // 高影响力但快速撤销
        }
        return Classification.MANIPULATION; // 高影响力但行为复杂
      }

      return Classification.UNKNOWN;
    } catch (error) {
      logger.error('[OrderClassifier] 分类失败', { entry, error: error.message });
      return Classification.UNKNOWN;
    }
  }

  /**
   * 批量分类并更新
   * @param {Array} entries - 追踪条目数组
   * @returns {Array} 更新后的条目数组
   */
  classifyBatch(entries) {
    return entries.map(entry => {
      entry.classification = this.classify(entry);
      return entry;
    });
  }

  /**
   * 计算分类统计
   * @param {Array} entries - 追踪条目数组
   * @returns {Object} 分类统计
   */
  getClassificationStats(entries) {
    const stats = {
      DEFENSIVE_BUY: 0,
      DEFENSIVE_SELL: 0,
      SWEEP_BUY: 0,
      SWEEP_SELL: 0,
      SPOOF: 0,
      MANIPULATION: 0,
      UNKNOWN: 0
    };

    entries.forEach(entry => {
      const classification = entry.classification || Classification.UNKNOWN;
      if (stats[classification] !== undefined) {
        stats[classification]++;
      }
    });

    return stats;
  }
}

module.exports = { OrderClassifier, Classification };

