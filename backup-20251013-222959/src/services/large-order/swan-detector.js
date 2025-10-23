/**
 * SwanDetector - 黑天鹅检测器
 * 
 * 功能：
 * - 计算24h成交额相对阈值（order/vol24h >= 3%）
 * - 计算OI相对阈值（order/oi >= 5%）
 * - 检测快速消费（被吃>30% + 价格波动>=3% in 5分钟）
 * - 检测OI突降（>5%）
 * - 黑天鹅分级（CRITICAL/HIGH/WATCH/NONE）
 * 
 * 基于swan.md文档要求
 * @module SwanDetector
 */

const logger = require('../../utils/logger');

/**
 * 黑天鹅告警级别
 */
const SwanLevel = {
  CRITICAL: 'CRITICAL',  // 临界：立即触发全自动保护
  HIGH: 'HIGH',          // 高危：发送紧急通知，自动减仓
  WATCH: 'WATCH',        // 观察：密切监控
  NONE: 'NONE'           // 无告警
};

class SwanDetector {
  constructor(config) {
    this.config = {
      // swan.md推荐阈值
      vol24hRatioThreshold: config?.SWAN_VOL24H_RATIO_THRESHOLD || 0.03,  // 3%
      oiRatioThreshold: config?.SWAN_OI_RATIO_THRESHOLD || 0.05,          // 5%
      sweepPctThreshold: config?.SWAN_SWEEP_PCT_THRESHOLD || 0.30,        // 30%
      priceDropThreshold: config?.SWAN_PRICE_DROP_THRESHOLD || 0.03,      // 3%
      criticalPriceDropThreshold: config?.SWAN_CRITICAL_PRICE_DROP || 0.05, // 5%
      oiCollapseThreshold: config?.SWAN_OI_COLLAPSE_THRESHOLD || 0.05,    // 5%
      windowMs: config?.SWAN_WINDOW_MS || 300000,                         // 5分钟
      impactRatioThreshold: config?.SWAN_IMPACT_RATIO_THRESHOLD || 0.20   // 20%
    };

    logger.info('[SwanDetector] 初始化黑天鹅检测器', this.config);
  }

  /**
   * 检查24h成交额相对阈值
   * @param {number} orderValue - 挂单价值（USDT）
   * @param {number} volume24h - 24h成交额（USDT）
   * @returns {Object} { passed, ratio }
   */
  checkVolume24hRatio(orderValue, volume24h) {
    if (!volume24h || volume24h <= 0) {
      return { passed: false, ratio: 0, reason: '24h成交额无效' };
    }

    const ratio = orderValue / volume24h;
    const passed = ratio >= this.config.vol24hRatioThreshold;

    return {
      passed,
      ratio: parseFloat(ratio.toFixed(6)),
      reason: passed 
        ? `order/vol24h=${(ratio*100).toFixed(2)}% >= ${(this.config.vol24hRatioThreshold*100).toFixed(0)}%`
        : `order/vol24h=${(ratio*100).toFixed(2)}% < ${(this.config.vol24hRatioThreshold*100).toFixed(0)}%`
    };
  }

  /**
   * 检查OI相对阈值
   * @param {number} orderValue - 挂单价值（USDT）
   * @param {number} oi - 持仓量（USDT名义价值）
   * @returns {Object} { passed, ratio }
   */
  checkOIRatio(orderValue, oi) {
    if (!oi || oi <= 0) {
      return { passed: false, ratio: 0, reason: 'OI无效' };
    }

    const ratio = orderValue / oi;
    const passed = ratio >= this.config.oiRatioThreshold;

    return {
      passed,
      ratio: parseFloat(ratio.toFixed(6)),
      reason: passed 
        ? `order/OI=${(ratio*100).toFixed(2)}% >= ${(this.config.oiRatioThreshold*100).toFixed(0)}%`
        : `order/OI=${(ratio*100).toFixed(2)}% < ${(this.config.oiRatioThreshold*100).toFixed(0)}%`
    };
  }

  /**
   * 检测快速消费（5分钟窗口）
   * @param {number} sweepPct - 被消费百分比
   * @param {number} priceDrop - 价格跌幅（正值表示下跌）
   * @returns {Object} { detected, severity }
   */
  detectRapidSweep(sweepPct, priceDrop) {
    const sweepPassed = sweepPct >= this.config.sweepPctThreshold;
    const priceDropPassed = priceDrop >= this.config.priceDropThreshold;
    const criticalPriceDrop = priceDrop >= this.config.criticalPriceDropThreshold;

    const detected = sweepPassed && (priceDropPassed || criticalPriceDrop);
    
    let severity = 'NONE';
    if (sweepPassed && criticalPriceDrop) {
      severity = 'CRITICAL';  // 被吃>30% + 价格跌>5%
    } else if (sweepPassed && priceDropPassed) {
      severity = 'HIGH';       // 被吃>30% + 价格跌>3%
    } else if (sweepPassed || priceDropPassed) {
      severity = 'WATCH';      // 仅满足一项
    }

    return {
      detected,
      severity,
      sweepPct: parseFloat(sweepPct.toFixed(4)),
      priceDrop: parseFloat(priceDrop.toFixed(4)),
      reason: detected 
        ? `快速消费: sweep=${(sweepPct*100).toFixed(1)}%, price=${(priceDrop*100).toFixed(2)}%`
        : '未检测到快速消费'
    };
  }

  /**
   * 检测OI突降
   * @param {number} currentOI - 当前OI
   * @param {number} prevOI - 前一次OI
   * @returns {Object} { detected, dropPct }
   */
  detectOICollapse(currentOI, prevOI) {
    if (!currentOI || !prevOI || prevOI <= 0) {
      return { detected: false, dropPct: 0, reason: 'OI数据不完整' };
    }

    const dropPct = (prevOI - currentOI) / prevOI;
    const detected = dropPct >= this.config.oiCollapseThreshold;

    return {
      detected,
      dropPct: parseFloat(dropPct.toFixed(6)),
      reason: detected 
        ? `OI突降: -${(dropPct*100).toFixed(2)}% >= ${(this.config.oiCollapseThreshold*100).toFixed(0)}%`
        : `OI变化: ${(dropPct*100).toFixed(2)}%`
    };
  }

  /**
   * 黑天鹅分级（核心逻辑）
   * @param {Object} metrics - 检测指标
   * @returns {Object} { level, triggers, score }
   */
  classifySwanLevel(metrics) {
    const {
      orderValue,
      impactRatio,
      vol24hCheck,
      oiCheck,
      sweepCheck,
      oiCollapseCheck,
      maxOrderValue  // 最大单笔挂单价值
    } = metrics;

    // 触发条件记录
    const triggers = [];
    let score = 0;

    // 1. 绝对阈值（100M）
    const passesAbsolute = maxOrderValue >= 100_000_000;
    if (passesAbsolute) {
      triggers.push('绝对阈值(>=100M)');
      score += 3;
    }

    // 2. 相对阈值（至少一项）
    let passesRelative = false;
    if (impactRatio >= this.config.impactRatioThreshold) {
      triggers.push(`impactRatio(${(impactRatio*100).toFixed(1)}%)`);
      score += 2;
      passesRelative = true;
    }
    if (vol24hCheck.passed) {
      triggers.push(vol24hCheck.reason);
      score += 2;
      passesRelative = true;
    }
    if (oiCheck.passed) {
      triggers.push(oiCheck.reason);
      score += 2;
      passesRelative = true;
    }

    // 3. 快速消费
    if (sweepCheck.detected) {
      triggers.push(sweepCheck.reason);
      if (sweepCheck.severity === 'CRITICAL') {
        score += 5;
      } else if (sweepCheck.severity === 'HIGH') {
        score += 3;
      } else {
        score += 1;
      }
    }

    // 4. OI突降
    if (oiCollapseCheck.detected) {
      triggers.push(oiCollapseCheck.reason);
      score += 3;
    }

    // === 分级规则（按swan.md要求）===
    
    // CRITICAL: 100M + impactRatio>=20% + 被吃30%+ + 价格跌>=3%
    if (passesAbsolute && passesRelative && sweepCheck.detected && sweepCheck.severity === 'CRITICAL') {
      return {
        level: SwanLevel.CRITICAL,
        triggers,
        score,
        reason: '❗ CRITICAL: 大额挂单被快速消费且价格暴跌'
      };
    }

    // HIGH: 满足部分CRITICAL条件或有OI突降
    if ((passesAbsolute && passesRelative && (sweepCheck.detected || oiCollapseCheck.detected)) ||
        (passesRelative && sweepCheck.severity === 'HIGH') ||
        oiCollapseCheck.detected) {
      return {
        level: SwanLevel.HIGH,
        triggers,
        score,
        reason: '⚠️  HIGH: 检测到高危信号'
      };
    }

    // WATCH: 单项触发
    if (passesAbsolute || passesRelative || sweepCheck.severity === 'WATCH' || score > 0) {
      return {
        level: SwanLevel.WATCH,
        triggers,
        score,
        reason: '👁️  WATCH: 检测到观察信号'
      };
    }

    // NONE: 无告警
    return {
      level: SwanLevel.NONE,
      triggers: [],
      score: 0,
      reason: '正常'
    };
  }

  /**
   * 综合检测（主入口）
   * @param {Object} data - 检测数据
   * @returns {Object} Swan检测结果
   */
  detect(data) {
    const {
      trackedEntries,
      volume24h,
      oi,
      prevOI,
      priceHistory  // [{ts, price}]
    } = data;

    // 找出最大挂单
    let maxOrderValue = 0;
    let maxOrderEntry = null;
    for (const entry of trackedEntries) {
      if (entry.valueUSD > maxOrderValue) {
        maxOrderValue = entry.valueUSD;
        maxOrderEntry = entry;
      }
    }

    // 如果没有大额挂单，直接返回NONE
    if (maxOrderValue === 0 || !maxOrderEntry) {
      return {
        level: SwanLevel.NONE,
        metrics: null,
        triggers: [],
        score: 0
      };
    }

    // 计算相对阈值
    const vol24hCheck = this.checkVolume24hRatio(maxOrderValue, volume24h);
    const oiCheck = this.checkOIRatio(maxOrderValue, oi);

    // 计算价格跌幅（5分钟窗口）
    let priceDrop = 0;
    if (priceHistory && priceHistory.length >= 2) {
      const now = Date.now();
      const windowStart = now - this.config.windowMs;
      const recentPrices = priceHistory.filter(p => p.ts >= windowStart);
      
      if (recentPrices.length >= 2) {
        const priceOld = recentPrices[0].price;
        const priceNew = recentPrices[recentPrices.length - 1].price;
        priceDrop = (priceOld - priceNew) / priceOld;  // 正值表示下跌
      }
    }

    // 检测快速消费（使用entry的wasConsumed和filledVolumeObserved）
    const sweepPct = maxOrderEntry.wasConsumed 
      ? (maxOrderEntry.filledVolumeObserved || 0) / maxOrderEntry.qty
      : 0;
    const sweepCheck = this.detectRapidSweep(sweepPct, Math.max(0, priceDrop));

    // 检测OI突降
    const oiCollapseCheck = this.detectOICollapse(oi, prevOI);

    // 组装metrics
    const metrics = {
      orderValue: maxOrderValue,
      impactRatio: maxOrderEntry.impactRatio || 0,
      vol24hCheck,
      oiCheck,
      sweepCheck,
      oiCollapseCheck,
      maxOrderValue,
      priceDrop
    };

    // 分级
    const classification = this.classifySwanLevel(metrics);

    return {
      level: classification.level,
      metrics,
      triggers: classification.triggers,
      score: classification.score,
      reason: classification.reason,
      // 数据库字段
      swan_alert_level: classification.level,
      price_drop_pct: priceDrop * 100,
      volume_24h: volume24h,
      max_order_to_vol24h_ratio: vol24hCheck.ratio,
      max_order_to_oi_ratio: oiCheck.ratio,
      sweep_detected: sweepCheck.detected,
      sweep_pct: sweepPct * 100,
      alert_triggers: JSON.stringify(classification.triggers)
    };
  }
}

module.exports = { SwanDetector, SwanLevel };

