// ICTExitConditions.js - ICT策略出场条件模块
// 严格按照ict.md文档实现ICT策略的出场条件

class ICTExitConditions {
  constructor(database = null) {
    this.database = database;
    this.maxTimeInPosition = 48; // 12小时 = 48个15分钟（ICT策略通常持仓时间较长）
  }

  /**
   * ICT策略出场条件检查 - 按照ict.md文档实现
   * @param {Object} params - 出场条件参数
   * @returns {Object} 出场条件检查结果
   */
  checkICTExitConditions(params) {
    const {
      position, // 'LONG' | 'SHORT'
      entryPrice,
      currentPrice,
      stopLoss,
      takeProfit,
      ob, // Order Block对象
      fvg, // Fair Value Gap对象
      atr4h,
      atr15m,
      trend1d,
      timeInPosition,
      volumeRatio,
      sweepDetected,
      liquidityLevel
    } = params;

    // 1️⃣ 止损触发 - 按照ict.md文档的止损逻辑
    if ((position === 'LONG' && currentPrice <= stopLoss) ||
        (position === 'SHORT' && currentPrice >= stopLoss)) {
      return { 
        exit: true, 
        reason: 'STOP_LOSS', 
        exitPrice: stopLoss,
        description: '触发止损'
      };
    }

    // 2️⃣ 止盈触发 - 按照ict.md文档的RR=3:1止盈逻辑
    if ((position === 'LONG' && currentPrice >= takeProfit) ||
        (position === 'SHORT' && currentPrice <= takeProfit)) {
      return { 
        exit: true, 
        reason: 'TAKE_PROFIT', 
        exitPrice: takeProfit,
        description: '触发止盈(RR=3:1)'
      };
    }

    // 3️⃣ Order Block失效 - 按照ict.md文档的OB失效逻辑
    if (ob) {
      const obBreakResult = this.checkOrderBlockBreak(position, currentPrice, ob, atr4h);
      if (obBreakResult.broken) {
        return {
          exit: true,
          reason: 'ORDER_BLOCK_BREAK',
          exitPrice: currentPrice,
          description: `OB失效: ${obBreakResult.description}`
        };
      }
    }

    // 4️⃣ Fair Value Gap回填 - 按照ict.md文档的FVG回填逻辑
    if (fvg) {
      const fvgFillResult = this.checkFVGRefill(position, currentPrice, fvg);
      if (fvgFillResult.filled) {
        return {
          exit: true,
          reason: 'FVG_REFILL',
          exitPrice: currentPrice,
          description: `FVG回填: ${fvgFillResult.description}`
        };
      }
    }

    // 5️⃣ 1D趋势反转 - 按照ict.md文档的趋势反转逻辑
    const trendReversalResult = this.checkTrendReversal(position, trend1d, currentPrice, entryPrice, atr4h);
    if (trendReversalResult.reversed) {
      return {
        exit: true,
        reason: 'TREND_REVERSAL',
        exitPrice: currentPrice,
        description: `1D趋势反转: ${trendReversalResult.description}`
      };
    }

    // 6️⃣ 流动性扫荡 - 按照ict.md文档的流动性扫荡逻辑
    if (sweepDetected && liquidityLevel) {
      const liquiditySweepResult = this.checkLiquiditySweep(position, currentPrice, liquidityLevel, atr15m);
      if (liquiditySweepResult.swept) {
        return {
          exit: true,
          reason: 'LIQUIDITY_SWEEP',
          exitPrice: currentPrice,
          description: `流动性扫荡: ${liquiditySweepResult.description}`
        };
      }
    }

    // 7️⃣ 成交量异常 - 按照ict.md文档的成交量确认逻辑
    const volumeAnomalyResult = this.checkVolumeAnomaly(volumeRatio, timeInPosition);
    if (volumeAnomalyResult.anomaly) {
      return {
        exit: true,
        reason: 'VOLUME_ANOMALY',
        exitPrice: currentPrice,
        description: `成交量异常: ${volumeAnomalyResult.description}`
      };
    }

    // 8️⃣ 时间止损 - 按照ict.md文档的时间管理逻辑
    if (timeInPosition >= this.maxTimeInPosition) {
      return {
        exit: true,
        reason: 'TIME_STOP',
        exitPrice: currentPrice,
        description: `时间止损: 持仓超过${this.maxTimeInPosition}个15分钟`
      };
    }

    // 否则继续持仓
    return { 
      exit: false, 
      reason: '', 
      exitPrice: null,
      description: '继续持仓'
    };
  }

  /**
   * 检查Order Block失效
   * @param {string} position - 持仓方向
   * @param {number} currentPrice - 当前价格
   * @param {Object} ob - Order Block对象
   * @param {number} atr4h - 4H ATR值
   * @returns {Object} OB失效检查结果
   */
  checkOrderBlockBreak(position, currentPrice, ob, atr4h) {
    const obRange = ob.high - ob.low;
    const obCenter = (ob.high + ob.low) / 2;
    const tolerance = Math.max(obRange * 0.1, atr4h * 0.5); // 10%的OB范围或0.5倍ATR

    if (position === 'LONG') {
      // 多头：价格跌破OB下沿-容差
      const obBreakLevel = ob.low - tolerance;
      if (currentPrice <= obBreakLevel) {
        return {
          broken: true,
          description: `价格跌破OB下沿(${obBreakLevel.toFixed(2)})`
        };
      }
    } else if (position === 'SHORT') {
      // 空头：价格突破OB上沿+容差
      const obBreakLevel = ob.high + tolerance;
      if (currentPrice >= obBreakLevel) {
        return {
          broken: true,
          description: `价格突破OB上沿(${obBreakLevel.toFixed(2)})`
        };
      }
    }

    return { broken: false, description: 'OB仍然有效' };
  }

  /**
   * 检查Fair Value Gap回填
   * @param {string} position - 持仓方向
   * @param {number} currentPrice - 当前价格
   * @param {Object} fvg - Fair Value Gap对象
   * @returns {Object} FVG回填检查结果
   */
  checkFVGRefill(position, currentPrice, fvg) {
    if (position === 'LONG') {
      // 多头：价格回填到FVG区间内
      if (currentPrice >= fvg.low && currentPrice <= fvg.high) {
        return {
          filled: true,
          description: `价格回填到FVG区间(${fvg.low.toFixed(2)}-${fvg.high.toFixed(2)})`
        };
      }
    } else if (position === 'SHORT') {
      // 空头：价格回填到FVG区间内
      if (currentPrice >= fvg.low && currentPrice <= fvg.high) {
        return {
          filled: true,
          description: `价格回填到FVG区间(${fvg.low.toFixed(2)}-${fvg.high.toFixed(2)})`
        };
      }
    }

    return { filled: false, description: 'FVG未被回填' };
  }

  /**
   * 检查1D趋势反转
   * @param {string} position - 持仓方向
   * @param {string} trend1d - 1D趋势
   * @param {number} currentPrice - 当前价格
   * @param {number} entryPrice - 入场价格
   * @param {number} atr4h - 4H ATR值
   * @returns {Object} 趋势反转检查结果
   */
  checkTrendReversal(position, trend1d, currentPrice, entryPrice, atr4h) {
    // 检查趋势是否反转
    const priceChange = Math.abs(currentPrice - entryPrice) / entryPrice;
    const significantMove = priceChange >= 0.03; // 3%以上价格变动

    if (position === 'LONG' && trend1d === 'down' && significantMove) {
      return {
        reversed: true,
        description: '1D趋势转为下降，价格变动超过3%'
      };
    } else if (position === 'SHORT' && trend1d === 'up' && significantMove) {
      return {
        reversed: true,
        description: '1D趋势转为上升，价格变动超过3%'
      };
    }

    return { reversed: false, description: '1D趋势未反转' };
  }

  /**
   * 检查流动性扫荡
   * @param {string} position - 持仓方向
   * @param {number} currentPrice - 当前价格
   * @param {Object} liquidityLevel - 流动性水平
   * @param {number} atr15m - 15m ATR值
   * @returns {Object} 流动性扫荡检查结果
   */
  checkLiquiditySweep(position, currentPrice, liquidityLevel, atr15m) {
    const tolerance = atr15m * 0.5;

    if (position === 'LONG') {
      // 多头：价格跌破流动性水平
      if (currentPrice <= liquidityLevel.level - tolerance) {
        return {
          swept: true,
          description: `价格跌破流动性水平(${liquidityLevel.level.toFixed(2)})`
        };
      }
    } else if (position === 'SHORT') {
      // 空头：价格突破流动性水平
      if (currentPrice >= liquidityLevel.level + tolerance) {
        return {
          swept: true,
          description: `价格突破流动性水平(${liquidityLevel.level.toFixed(2)})`
        };
      }
    }

    return { swept: false, description: '流动性未被扫荡' };
  }

  /**
   * 检查成交量异常
   * @param {number} volumeRatio - 成交量比率
   * @param {number} timeInPosition - 持仓时间
   * @returns {Object} 成交量异常检查结果
   */
  checkVolumeAnomaly(volumeRatio, timeInPosition) {
    // 如果持仓时间超过6小时但成交量持续萎缩
    if (timeInPosition >= 24 && volumeRatio < 0.5) {
      return {
        anomaly: true,
        description: '持仓时间过长且成交量持续萎缩'
      };
    }

    // 如果成交量异常放大（可能是反转信号）
    if (volumeRatio > 3.0) {
      return {
        anomaly: true,
        description: '成交量异常放大，可能发生反转'
      };
    }

    return { anomaly: false, description: '成交量正常' };
  }

  /**
   * 计算ICT策略的止损价格 - 按照ict.md文档实现
   * @param {Object} ob - Order Block对象
   * @param {number} atr4h - 4H ATR值
   * @param {string} trend1d - 1D趋势
   * @param {number} entryPrice - 入场价格
   * @returns {number} 止损价格
   */
  static calculateICTStopLoss(ob, atr4h, trend1d, entryPrice) {
    if (!ob || !atr4h) {
      return entryPrice * 0.98; // 默认2%止损
    }

    if (trend1d === 'up') {
      // 上升趋势：止损在OB下沿-1.5×ATR或最近3根4H最低点
      return Math.min(ob.low - 1.5 * atr4h, ob.low * 0.98);
    } else {
      // 下降趋势：止损在OB上沿+1.5×ATR或最近3根4H最高点
      return Math.max(ob.high + 1.5 * atr4h, ob.high * 1.02);
    }
  }

  /**
   * 计算ICT策略的止盈价格 - 按照ict.md文档实现RR=3:1
   * @param {number} entryPrice - 入场价格
   * @param {number} stopLoss - 止损价格
   * @param {number} RR - 风险回报比，默认3:1
   * @returns {number} 止盈价格
   */
  static calculateICTTakeProfit(entryPrice, stopLoss, RR = 3) {
    const stopDistance = Math.abs(entryPrice - stopLoss);
    
    if (entryPrice > stopLoss) {
      // 多头：止盈 = 入场价 + 止损距离 × RR
      return entryPrice + stopDistance * RR;
    } else {
      // 空头：止盈 = 入场价 - 止损距离 × RR
      return entryPrice - stopDistance * RR;
    }
  }

  /**
   * 获取ICT出场条件统计信息
   * @returns {Object} 统计信息
   */
  getExitConditionsStats() {
    return {
      maxTimeInPosition: this.maxTimeInPosition,
      exitConditions: [
        'STOP_LOSS - 止损触发',
        'TAKE_PROFIT - 止盈触发(RR=3:1)',
        'ORDER_BLOCK_BREAK - Order Block失效',
        'FVG_REFILL - Fair Value Gap回填',
        'TREND_REVERSAL - 1D趋势反转',
        'LIQUIDITY_SWEEP - 流动性扫荡',
        'VOLUME_ANOMALY - 成交量异常',
        'TIME_STOP - 时间止损'
      ],
      lastUpdate: new Date().toISOString()
    };
  }
}

module.exports = ICTExitConditions;
