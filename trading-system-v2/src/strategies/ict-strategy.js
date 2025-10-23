const TechnicalIndicators = require('../utils/technical-indicators');
const { getBinanceAPI } = require('../api/binance-api-singleton');
const SweepDirectionFilter = require('./ict-sweep-filter');
const HarmonicPatterns = require('./harmonic-patterns');
const logger = require('../utils/logger');
const config = require('../config');
const StrategyParameterLoader = require('../utils/strategy-param-loader');
const ADXCalculator = require('../utils/adx-calculator');
const DatabaseConnection = require('../database/connection');

/**
 * ICT策略实现
 * 基于订单块、流动性、吞没形态等ICT概念
 */
class ICTStrategy {
  constructor() {
    this.name = 'ICT';
    this.timeframes = ['1D', '4H', '15m'];
    this.binanceAPI = getBinanceAPI();  // 使用单例

    // 参数加载器
    this.paramLoader = null;
    this.params = {};

    // 异步初始化参数
    this.initializeParameters();
  }

  /**
   * 初始化策略参数（从数据库加载）
   */
  async initializeParameters() {
    try {
      // 获取数据库连接实例
      const dbConnection = typeof DatabaseConnection.getInstance === 'function'
        ? DatabaseConnection.getInstance()
        : DatabaseConnection;

      this.paramLoader = new StrategyParameterLoader(dbConnection);

      // 加载BALANCED模式参数
      this.params = await this.paramLoader.loadParameters('ICT', 'BALANCED');

      logger.info('[ICT策略] 参数加载完成', {
        paramGroups: Object.keys(this.params).length,
        adxEnabled: this.params.filters?.adxEnabled,
        stopLossATR: this.params.risk_management?.stopLossATRMultiplier
      });
    } catch (error) {
      logger.error('[ICT策略] 参数加载失败，使用默认值', error);
      this.params = this.getDefaultParameters();
    }
  }

  /**
   * 获取阈值参数（支持嵌套结构）
   * @param {string} category - 参数分类
   * @param {string} name - 参数名称
   * @param {*} defaultValue - 默认值
   * @returns {*} 参数值
   */
  getThreshold(category, name, defaultValue) {
    const paramCategory = category === 'trend' ? 'trend_thresholds' : 
                         category === 'entry' ? 'entry_thresholds' :
                         category === 'factor' ? 'factor_thresholds' :
                         category === 'filter' ? 'filters' : category;
    
    const value = this.params[paramCategory]?.[name] || defaultValue;
    
    if (name.includes('Threshold') || name.includes('Score')) {
      logger.info(`[ICT-getThreshold] category=${category}, name=${name}, paramCategory=${paramCategory}, dbValue=${this.params[paramCategory]?.[name]}, defaultValue=${defaultValue}, finalValue=${value}`);
    }
    
    return value;
  }

  /**
   * 获取权重参数
   * @param {string} name - 参数名称
   * @param {*} defaultValue - 默认值
   * @returns {*} 参数值
   */
  getWeight(name, defaultValue) {
    const value = this.params.weights?.[name] || defaultValue;
    return value;
  }

  /**
   * 获取默认参数（数据库加载失败时使用）
   */
  getDefaultParameters() {
    return {
      filters: {
        adxEnabled: true,
        adxMinThreshold: 20,
        adxPeriod: 14
      },
      atr_timeframes: {
        stopLossTimeframe: '4h',
        orderBlockHeightTimeframe: '4h',
        htfSweepTimeframe: '4h',
        ltfSweepTimeframe: '15m'
      },
      risk_management: {
        stopLossATRMultiplier: 1.5,  // 降低止损倍数
        takeProfitRatio: 5.0,         // 提升止盈倍数以实现3:1+盈亏比
        useStructuralStop: true
      },
      order_block: {
        maxAgeDays: 3,
        minHeightATR: 0.25,
        volumeThreshold: 0.8
      },
      sweep_thresholds: {
        htfMultiplier: 0.3,
        ltfMultiplier: 0.1,
        regressionRatio: 0.5
      },
      required_conditions: {
        optionalRequiredCount: 2
      },
      signal_thresholds: {
        minEngulfingStrength: 0.5,
        strongThreshold: 0.7,
        moderateThreshold: 0.5
      }
    };
  }

  /**
   * 分析日线趋势
   * @param {string} symbol - 交易对
   * @returns {Object} 趋势分析结果
   */
  analyzeDailyTrend(klines) {
    try {
      if (!klines || klines.length < 25) {
        return { trend: 'RANGE', confidence: 0, reason: 'Insufficient data' };
      }

      // 计算ATR
      const atr = this.calculateATR(klines, 14);
      const currentATR = atr[atr.length - 1];

      // 基于20日收盘价比较的趋势判断
      const prices = klines.map(k => parseFloat(k[4])); // 收盘价
      const recent20Prices = prices.slice(-20); // 最近20日收盘价

      if (recent20Prices.length < 20) {
        return { trend: 'RANGE', confidence: 0, reason: 'Insufficient 20-day data' };
      }

      const firstPrice = recent20Prices[0];
      const lastPrice = recent20Prices[recent20Prices.length - 1];
      const priceChange = ((lastPrice - firstPrice) / firstPrice) * 100;
      
      // 添加调试日志
      logger.info(`[ICT日线趋势] 20日价格变化: ${priceChange.toFixed(2)}%, 首价: ${firstPrice}, 末价: ${lastPrice}, 阈值: ±1%`);

      // 趋势判断逻辑：基于20日收盘价比较
      // 优化：进一步降低阈值从±2%到±1%，增加交易机会
      let trend = 'RANGE';
      let confidence = 0;

      if (priceChange > 1) { // 20日涨幅超过1%（从2%降低）
        trend = 'UP';
        confidence = Math.min(Math.abs(priceChange) / 10, 1);
      } else if (priceChange < -1) { // 20日跌幅超过1%（从-2%降低）
        trend = 'DOWN';
        confidence = Math.min(Math.abs(priceChange) / 10, 1);
      } else {
        // 震荡趋势
        trend = 'RANGE';
        confidence = 0.3; // 震荡市场基础置信度
      }

      // 添加趋势判断结果日志
      logger.info(`[ICT日线趋势] 趋势判断结果: ${trend}, 置信度: ${confidence.toFixed(3)}, 原因: ${priceChange.toFixed(2)}% ${priceChange > 1 ? '> 1%' : priceChange < -1 ? '< -1%' : '在±1%范围内'}`);
      
      return {
        trend,
        confidence,
        atr: currentATR,
        priceChange,
        closeChange: priceChange / 100, // 转换为小数形式
        lookback: 20, // 20日回看期
        reason: `20-day price change: ${priceChange.toFixed(2)}% (threshold: ±1%), ATR: ${currentATR.toFixed(4)}`
      };
    } catch (error) {
      logger.error(`ICT Daily trend analysis error for ${symbol}:`, error);
      return { trend: 'RANGE', confidence: 0, reason: 'Analysis error' };
    }
  }

  /**
   * 检测订单块（基于价格停留区域和成交量集中，符合ict.md要求）
   * 订单块是价格停留和成交量集中的区域，不依赖吞没形态
   * @param {Array} klines - K线数据
   * @param {number} atr4H - 4H ATR值
   * @param {number} maxAgeDays - 最大年龄（天）
   * @returns {Array} 订单块列表
   */
  detectOrderBlocks(klines, atr4H, maxAgeDays = 30) {
    const orderBlocks = [];

    if (klines.length < 20) return orderBlocks;

    const currentTime = Date.now();
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

    // 寻找价格停留区域作为订单块（3-5根K线窗口）
    for (let i = 3; i < klines.length - 2; i++) {
      const window = klines.slice(i - 3, i + 2); // 5根K线窗口

      // 计算窗口内的价格范围和成交量
      let windowHigh = 0;
      let windowLow = Infinity;
      let totalVolume = 0;
      let priceSum = 0;
      let timestamp = 0;

      window.forEach(kline => {
        const high = parseFloat(kline[2]);
        const low = parseFloat(kline[3]);
        const close = parseFloat(kline[4]);
        const volume = parseFloat(kline[5]);
        const time = parseFloat(kline[0]);

        windowHigh = Math.max(windowHigh, high);
        windowLow = Math.min(windowLow, low);
        totalVolume += volume;
        priceSum += close;
        timestamp = time; // 使用最新时间戳
      });

      const obHeight = windowHigh - windowLow;
      const avgPrice = priceSum / window.length;
      const avgVolume = totalVolume / window.length;

      // 检查年龄过滤
      if (timestamp < Date.now() - maxAgeMs) continue;

      // 订单块条件：
      // 1. 高度过滤：OB高度 >= 0.15 × ATR(4H)（放宽要求）
      // 2. 价格稳定性：窗口内价格范围相对较小
      // 3. 成交量集中：最后两根K线成交量大于平均值
      const heightValid = obHeight >= 0.15 * atr4H; // 从0.25放宽到0.15
      const priceStable = obHeight / avgPrice <= 0.03; // 从1%放宽到3%

      // 检查最后两根K线的成交量是否集中
      const lastTwoVolumes = window.slice(-2).map(k => parseFloat(k[5]));
      const volumeConcentrated = lastTwoVolumes.every(vol => vol >= avgVolume * 0.6); // 从80%放宽到60%

      if (heightValid && priceStable && volumeConcentrated) {
        // 确定订单块类型（基于价格位置）
        const currentPrice = parseFloat(klines[klines.length - 1][4]);
        const type = currentPrice > (windowHigh + windowLow) / 2 ? 'BULLISH' : 'BEARISH';

        orderBlocks.push({
          type: type,
          high: windowHigh,
          low: windowLow,
          timestamp: timestamp,
          height: obHeight,
          strength: obHeight / atr4H,
          age: (Date.now() - timestamp) / (24 * 60 * 60 * 1000),
          center: (windowHigh + windowLow) / 2,
          volume: totalVolume,
          avgVolume: avgVolume
        });

        logger.info(`检测到订单块: 类型=${type}, 高度=${obHeight.toFixed(2)}, 范围=[${windowLow.toFixed(2)}, ${windowHigh.toFixed(2)}], 强度=${(obHeight / atr4H).toFixed(2)}`);
      }
    }

    return orderBlocks;
  }

  /**
   * 检测HTF Sweep（高时间框架流动性扫荡）
   * 按照ICT文档：检测关键swing高/低是否在≤2根4H内被刺破并收回，刺破幅度÷bar数≥0.4×ATR(4H)
   * @param {number} extreme - 极值点
   * @param {Array} klines - K线数据
   * @param {number} atrValue - ATR值
   * @returns {Object} Sweep检测结果
   */
  detectSweepHTF(extreme, klines, atrValue) {
    if (!klines || klines.length < 3) {
      return { detected: false, type: null, level: 0, confidence: 0, speed: 0 };
    }

    const currentATR = atrValue || 0;
    const recentBars = klines.slice(-5); // 检查最近5根K线，更宽松的检测

    let detected = false;
    let type = null;
    let level = 0;
    let confidence = 0;
    let speed = 0;

    // 优化：更宽松的扫荡检测逻辑
    // 1. 检查是否有明显的价格波动（即使没有突破极值点）
    // 2. 检测价格快速移动并回撤的模式

    for (let i = 0; i < Math.min(4, recentBars.length - 1); i++) {
      const bar = recentBars[i];
      const nextBar = recentBars[i + 1];
      const high = parseFloat(bar[2]);
      const low = parseFloat(bar[3]);
      const close = parseFloat(bar[4]);
      const nextClose = parseFloat(nextBar[4]);

      // 检测上方流动性扫荡：价格快速上涨后回落
      if (high > extreme * 0.98) { // 放宽到98%的极值点
        const exceed = high - extreme;
        const barsToReturn = 1; // 简化：假设下一根K线收回

        // 计算扫荡速率
        const sweepSpeed = exceed / barsToReturn;

        // 降低阈值：sweep速率 ≥ 0.2 × ATR（从0.4降低到0.2）
        if (sweepSpeed >= 0.2 * currentATR) {
          detected = true;
          type = 'LIQUIDITY_SWEEP_UP';
          level = extreme;
          confidence = Math.min(sweepSpeed / (0.2 * currentATR), 1);
          speed = sweepSpeed;
          break;
        }
      }

      // 检测下方流动性扫荡：价格快速下跌后反弹
      if (low < extreme * 1.02) { // 放宽到102%的极值点
        const exceed = extreme - low;
        const barsToReturn = 1; // 简化：假设下一根K线收回

        // 计算扫荡速率
        const sweepSpeed = exceed / barsToReturn;

        // 降低阈值：sweep速率 ≥ 0.2 × ATR（从0.4降低到0.2）
        if (sweepSpeed >= 0.2 * currentATR) {
          detected = true;
          type = 'LIQUIDITY_SWEEP_DOWN';
          level = extreme;
          confidence = Math.min(sweepSpeed / (0.2 * currentATR), 1);
          speed = sweepSpeed;
          break;
        }
      }
    }

    // 调试信息
    if (detected) {
      logger.info(`ICT HTF Sweep检测成功 - 类型: ${type}, 速率: ${speed.toFixed(4)}, 置信度: ${confidence.toFixed(2)}`);
    } else {
      logger.info(`ICT HTF Sweep检测失败 - 极值点: ${extreme}, ATR: ${currentATR}, 阈值: ${0.2 * currentATR}`);
    }

    return { detected, type, level, confidence, speed };
  }

  /**
   * 检测吞没形态
   * @param {Array} klines - K线数据
   * @returns {Object} 吞没形态检测结果
   */
  detectEngulfingPattern(klines) {
    if (!klines || klines.length < 2) {
      return { detected: false, type: null, strength: 0 };
    }

    const current = klines[klines.length - 1];
    const previous = klines[klines.length - 2];

    // 使用数组格式（Binance API返回的格式）
    const currentOpen = parseFloat(current[1]);   // 开盘价
    const currentClose = parseFloat(current[4]);  // 收盘价
    const previousOpen = parseFloat(previous[1]); // 开盘价
    const previousClose = parseFloat(previous[4]); // 收盘价

    // 看涨吞没：前一根为阴线，当前为阳线且部分吞没（放宽条件）
    if (previousClose < previousOpen && currentClose > currentOpen) {
      // 计算吞没程度
      const engulfRatio = Math.min(currentClose / previousOpen, 1.0);
      // 改进强度计算：使用相对强度，避免高价币种产生极小数值
      const bodySize = Math.abs(currentClose - currentOpen);
      const previousBodySize = Math.abs(previousClose - previousOpen);
      const strength = previousBodySize > 0 ? Math.min(bodySize / previousBodySize, 2.0) : 1.0;

      // 如果吞没程度超过50%，认为有效
      if (engulfRatio >= 0.5) {
        return { detected: true, type: 'BULLISH_ENGULFING', strength };
      }
    }

    // 看跌吞没：前一根为阳线，当前为阴线且部分吞没（放宽条件）
    if (previousClose > previousOpen && currentClose < currentOpen) {
      // 计算吞没程度
      const engulfRatio = Math.min(previousOpen / currentClose, 1.0);
      // 改进强度计算：使用相对强度，避免高价币种产生极小数值
      const bodySize = Math.abs(currentClose - currentOpen);
      const previousBodySize = Math.abs(previousClose - previousOpen);
      const strength = previousBodySize > 0 ? Math.min(bodySize / previousBodySize, 2.0) : 1.0;

      // 如果吞没程度超过50%，认为有效
      if (engulfRatio >= 0.5) {
        return { detected: true, type: 'BEARISH_ENGULFING', strength };
      }
    }

    return { detected: false, type: null, strength: 0 };
  }

  /**
   * 检测LTF Sweep（低时间框架流动性扫荡）
   * 按照ICT文档：sweep发生在≤3根15m内收回，sweep幅度÷bar数≥0.2×ATR(15m)
   * @param {Array} klines - K线数据
   * @param {number} atr15 - 15分钟ATR值
   * @param {number} extreme - 极值点（高点或低点）
   * @returns {Object} LTF Sweep检测结果
   */
  detectSweepLTF(klines, atr15, extreme) {
    if (!klines || klines.length < 5) {
      return { detected: false, type: null, level: 0, confidence: 0, speed: 0 };
    }

    const currentATR = atr15 || 0;
    const recentBars = klines.slice(-5); // 最近5根K线，最多检查3根

    let detected = false;
    let type = null;
    let level = 0;
    let confidence = 0;
    let speed = 0;
    let maxSpeed = 0; // 记录最大扫荡速率（即使不满足阈值）

    // 检查最近3根K线是否有突破极值点的情况
    for (let i = 0; i < Math.min(3, recentBars.length); i++) {
      const bar = recentBars[i];
      const high = parseFloat(bar[2]);
      const low = parseFloat(bar[3]);

      // 检测上方流动性扫荡：最高价突破极值点
      if (high > extreme) {
        // 检查是否在后续K线中收回
        let barsToReturn = 0;
        for (let j = i + 1; j < recentBars.length; j++) {
          barsToReturn++;
          if (parseFloat(recentBars[j][4]) < extreme) {
            // 计算扫荡速率：刺破幅度 ÷ bar数
            const exceed = high - extreme;
            const sweepSpeed = exceed / barsToReturn;

            // 记录最大扫荡速率
            if (sweepSpeed > maxSpeed) {
              maxSpeed = sweepSpeed;
            }

            // 检查是否满足条件：sweep速率 ≥ 0.02 × ATR 且 bars数 ≤ 3（进一步降低阈值）
            if (sweepSpeed >= 0.02 * currentATR && barsToReturn <= 3) {
              detected = true;
              type = 'LTF_SWEEP_UP';
              level = extreme;
              confidence = Math.min(sweepSpeed / (0.02 * currentATR), 1);
              speed = sweepSpeed;
              break;
            }
          }
        }
        if (detected) break;
      }

      // 检测下方流动性扫荡：最低价跌破极值点
      if (low < extreme) {
        // 检查是否在后续K线中收回
        let barsToReturn = 0;
        for (let j = i + 1; j < recentBars.length; j++) {
          barsToReturn++;
          if (parseFloat(recentBars[j][4]) > extreme) {
            // 计算扫荡速率：刺破幅度 ÷ bar数
            const exceed = extreme - low;
            const sweepSpeed = exceed / barsToReturn;

            // 记录最大扫荡速率
            if (sweepSpeed > maxSpeed) {
              maxSpeed = sweepSpeed;
            }

            // 检查是否满足条件：sweep速率 ≥ 0.02 × ATR 且 bars数 ≤ 3（进一步降低阈值）
            if (sweepSpeed >= 0.02 * currentATR && barsToReturn <= 3) {
              detected = true;
              type = 'LTF_SWEEP_DOWN';
              level = extreme;
              confidence = Math.min(sweepSpeed / (0.02 * currentATR), 1);
              speed = sweepSpeed;
              break;
            }
          }
        }
        if (detected) break;
      }
    }

    // 如果没有检测到满足阈值的扫荡，但存在扫荡行为，返回最大扫荡速率
    if (!detected && maxSpeed > 0) {
      return {
        detected: false,
        type: null,
        level: extreme,
        confidence: Math.min(maxSpeed / (0.02 * currentATR), 1),
        speed: maxSpeed
      };
    }

    return { detected, type, level, confidence, speed };
  }

  /**
   * 检测成交量放大
   * 按照ICT文档：成交量放大作为可选加强过滤
   * @param {Array} klines - K线数据
   * @param {number} period - 计算平均成交量的周期
   * @returns {Object} 成交量放大检测结果
   */
  detectVolumeExpansion(klines, period = 20) {
    if (!klines || klines.length < period + 1) {
      return { detected: false, ratio: 0, currentVolume: 0, averageVolume: 0 };
    }

    const currentVolume = parseFloat(klines[klines.length - 1][5]); // 当前成交量
    const recentVolumes = klines.slice(-period - 1, -1).map(k => parseFloat(k[5])); // 排除当前K线的历史成交量
    const averageVolume = recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length;

    const volumeRatio = averageVolume > 0 ? currentVolume / averageVolume : 0;

    // 成交量放大条件：当前成交量 ≥ 1.5倍平均成交量
    const detected = volumeRatio >= 1.5;

    return {
      detected,
      ratio: volumeRatio,
      currentVolume,
      averageVolume
    };
  }

  /**
   * 检查OB/FVG年龄过滤
   * 按照ICT文档：OB/FVG年龄 ≤ 2天
   * @param {Object} orderBlock - 订单块对象
   * @returns {boolean} 是否满足年龄条件
   */
  checkOrderBlockAge(orderBlock) {
    if (!orderBlock || !orderBlock.timestamp) return false;

    const currentTime = Date.now();
    const obTime = orderBlock.timestamp;
    const ageDays = (currentTime - obTime) / (1000 * 60 * 60 * 24); // 转换为天

    return ageDays <= 5; // 年龄 ≤ 5天（从2天放宽到5天）
  }

  /**
   * 计算结构化止损价格（优化版）
   * 根据ict-plus.md：使用扫荡点位或结构低点/高点，不使用ATR扩大
   * 
   * @param {string} trend - 趋势方向
   * @param {Object} orderBlock - 订单块
   * @param {Array} klines4H - 4H K线数据
   * @param {Object} sweepResult - 扫荡检测结果
   * @returns {number} 止损价格
   */
  calculateStructuralStopLoss(trend, orderBlock, klines4H, sweepResult) {
    if (!klines4H || klines4H.length < 6) {
      return 0;
    }

    if (trend === 'UP') {
      // 优化：上升趋势使用扫荡低点或最近6根4H的最低点（从3根改为6根）
      const recent6Lows = klines4H.slice(-6).map(k => parseFloat(k[3])); // 最低价
      const structuralLow = Math.min(...recent6Lows);

      // 如果有扫荡低点，使用扫荡点位（更精确）
      const sweepLow = sweepResult?.level || null;

      const stopLoss = sweepLow ? Math.min(sweepLow, structuralLow) : structuralLow;

      logger.info(`${trend}趋势结构化止损: 扫荡低点=${sweepLow}, 结构低点=${structuralLow.toFixed(4)}, 止损=${stopLoss.toFixed(4)}`);

      return stopLoss;
    } else if (trend === 'DOWN') {
      // 优化：下降趋势使用扫荡高点或最近6根4H的最高点
      const recent6Highs = klines4H.slice(-6).map(k => parseFloat(k[2])); // 最高价
      const structuralHigh = Math.max(...recent6Highs);

      // 如果有扫荡高点，使用扫荡点位
      const sweepHigh = sweepResult?.level || null;

      const stopLoss = sweepHigh ? Math.max(sweepHigh, structuralHigh) : structuralHigh;

      logger.info(`${trend}趋势结构化止损: 扫荡高点=${sweepHigh}, 结构高点=${structuralHigh.toFixed(4)}, 止损=${stopLoss.toFixed(4)}`);

      return stopLoss;
    }

    return 0;
  }

  /**
   * 旧的止损计算方法（保留用于兼容）
   * @deprecated 使用calculateStructuralStopLoss代替
   */
  calculateStopLoss(trend, orderBlock, klines4H, atr4H) {
    logger.warn('使用了旧的calculateStopLoss方法，建议使用calculateStructuralStopLoss');
    return this.calculateStructuralStopLoss(trend, orderBlock, klines4H, null);
  }

  /**
   * 计算止盈价格
   * 按照ICT文档：RR = 3:1
   * @param {number} entryPrice - 入场价格
   * @param {number} stopLoss - 止损价格
   * @param {string} trend - 趋势方向
   * @returns {number} 止盈价格
   */
  calculateTakeProfit(entryPrice, stopLoss, trend) {
    if (!entryPrice || !stopLoss) return 0;

    const stopDistance = Math.abs(entryPrice - stopLoss);

    if (trend === 'UP') {
      // 上升趋势：入场价 + 3倍止损距离
      return entryPrice + (3 * stopDistance);
    } else if (trend === 'DOWN') {
      // 下降趋势：入场价 - 3倍止损距离
      return entryPrice - (3 * stopDistance);
    }

    return entryPrice;
  }

  /**
   * 计算仓位大小
   * 按照ICT文档：单位数 = 风险资金 ÷ 止损距离
   * @param {number} equity - 资金总额
   * @param {number} riskPct - 风险比例（如1%）
   * @param {number} entryPrice - 入场价格
   * @param {number} stopLoss - 止损价格
   * @returns {Object} 仓位计算结果
   */
  calculatePositionSize(equity, riskPct, entryPrice, stopLoss) {
    if (!equity || !riskPct || !entryPrice || !stopLoss) {
      return { units: 0, notional: 0, margin: 0 };
    }

    // 风险资金 = Equity × 风险比例
    const riskAmount = equity * riskPct;

    // 止损距离
    const stopDistance = Math.abs(entryPrice - stopLoss);

    // 单位数 = 风险资金 ÷ 止损距离
    const units = stopDistance > 0 ? riskAmount / stopDistance : 0;

    // 名义价值 = 单位数 × 入场价
    const notional = units * entryPrice;

    // 计算杠杆：基于风险比例和止损距离
    const stopLossDistancePct = stopDistance / entryPrice;
    const calculatedMaxLeverage = Math.floor(1 / (stopLossDistancePct + 0.005)); // 加0.5%缓冲
    const leverage = Math.min(calculatedMaxLeverage, 24); // 最大杠杆限制为24

    // 保证金 = 名义价值 ÷ 杠杆
    const margin = notional / leverage;

    return {
      units,
      notional,
      leverage,
      margin,
      riskAmount,
      stopDistance
    };
  }

  /**
   * 计算交易参数
   * 按照ICT文档要求计算止损、止盈和仓位
   * @param {string} symbol - 交易对
   * @param {string} trend - 趋势方向
   * @param {Object} signals - 信号对象
   * @param {Object} orderBlock - 订单块
   * @param {Array} klines4H - 4H K线数据
   * @param {number} atr4H - 4H ATR值
   * @returns {Object} 交易参数
   */
  async calculateTradeParameters(symbol, trend, signals, orderBlock, klines4H, atr4H) {
    try {
      // 获取当前价格
      const klines15m = await this.binanceAPI.getKlines(symbol, '15m', 50);
      if (!klines15m || klines15m.length < 20) {
        return { entry: 0, stopLoss: 0, takeProfit: 0, leverage: 1, risk: 0 };
      }

      const currentPrice = parseFloat(klines15m[klines15m.length - 1][4]); // 收盘价
      const equity = 10000; // 默认资金总额
      const riskPct = 0.01; // 1%风险

      // 计算入场价格（当前价格）
      const entry = currentPrice;

      // ✅ ICT优化V2.0：使用独立的仓位管理器
      const ICTPositionManager = require('../services/ict-position-manager');
      const PositionDurationManager = require('../utils/position-duration-manager');

      // 获取市场类型（ICT策略主要针对趋势市，但需要根据实际情况判断）
      const marketType = 'TREND'; // 可以根据 signals 或其他指标动态判断

      // ✅ 使用持仓时长管理器获取配置
      const durationConfig = PositionDurationManager.getPositionConfig(symbol, marketType);

      // ICT优化V2.0 配置（结合持仓时长管理器）
      const ictConfig = {
        maxHoldingHours: durationConfig.maxDurationHours, // 根据交易对类别动态调整
        timeStopMinutes: durationConfig.timeStopMinutes,  // 根据交易对类别动态调整
        timeExitPct: 0.5,           // 时间止损平仓50%
        riskPercent: 0.01           // 1%风险
      };

      logger.info(`${symbol} ICT持仓配置: ${durationConfig.category} ${marketType}市, 最大持仓=${ictConfig.maxHoldingHours}小时, 时间止损=${ictConfig.timeStopMinutes}分钟`);

      // 计算ICT结构止损
      const structuralStopLoss = this.calculateStructuralStopLoss(
        trend,
        orderBlock,
        klines4H,
        signals.sweepHTF
      );

      // ICT策略使用结构止损
      const stopLoss = structuralStopLoss;

      // ✅ 使用新的仓位管理器计算头寸
      const sizing = ICTPositionManager.calculatePositionSize({
        accountBalance: equity,
        riskPercent: riskPct,
        entryPrice: entry,
        stopPrice: stopLoss
      });

      // ✅ 构建交易计划（分层止盈）
      const plan = ICTPositionManager.buildTradePlan({
        direction: trend === 'UP' ? 'long' : 'short',
        entryPrice: entry,
        stopPrice: stopLoss,
        qty: sizing.qty,
        profitMultipliers: [2, 3] // TP1=2R, TP2=3R
      });

      // 计算杠杆和保证金
      const stopDistance = Math.abs(entry - stopLoss);
      const stopDistancePct = stopDistance / entry;
      const calculatedMaxLeverage = Math.floor(1 / (stopDistancePct + 0.005));

      // ✅ 确保杠杆不超过24倍
      const leverage = Math.min(calculatedMaxLeverage, 24);

      // 验证杠杆限制
      if (calculatedMaxLeverage > 24) {
        logger.warn(`${symbol} ICT策略: 计算杠杆=${calculatedMaxLeverage}倍, 超过24倍限制, 已限制为24倍`);
      }

      const margin = stopDistance > 0 ? Math.ceil(sizing.riskCash / (leverage * stopDistance / entry)) : 0;

      logger.info(`${symbol} ICT杠杆计算: 止损距离=${stopDistance.toFixed(4)} (${(stopDistancePct * 100).toFixed(2)}%), 计算杠杆=${calculatedMaxLeverage}倍, 实际杠杆=${leverage}倍`);

      const highThreshold = this.getThreshold('signal', 'highConfidenceThreshold', 60);
      const medThreshold = this.getThreshold('signal', 'medConfidenceThreshold', 40);
      const confidence = signals.score >= highThreshold ? 'high' : signals.score >= medThreshold ? 'med' : 'low';

      logger.info(`${symbol} ICT交易参数 (优化V2.0): 趋势=${trend}, 置信度=${confidence}, 最大持仓=${ictConfig.maxHoldingHours}小时, TP1=${plan.tps[0]}, TP2=${plan.tps[1]}, 保本=${plan.breakevenMove}`);

      return {
        entry: parseFloat(entry.toFixed(4)),
        stopLoss: parseFloat(stopLoss.toFixed(4)),
        takeProfit: parseFloat(plan.tps[1].toFixed(4)), // 保留原有字段用于兼容
        takeProfit1: parseFloat(plan.tps[0].toFixed(4)), // ✅ 新增：TP1
        takeProfit2: parseFloat(plan.tps[1].toFixed(4)), // ✅ 新增：TP2
        breakevenPrice: parseFloat(plan.breakevenMove.toFixed(4)), // ✅ 新增：保本点
        leverage: leverage,
        margin: parseFloat(margin.toFixed(2)),
        risk: riskPct,
        units: parseFloat(sizing.qty.toFixed(4)),
        notional: parseFloat((sizing.qty * entry).toFixed(2)),
        riskAmount: parseFloat(sizing.riskCash.toFixed(2)),
        riskCash: parseFloat(sizing.riskCash.toFixed(2)), // ✅ 新增：风险金额
        stopDistance: parseFloat(sizing.stopDistance.toFixed(4)), // ✅ 新增：止损距离
        timeStopMinutes: ictConfig.timeStopMinutes, // ✅ ICT优化V2.0：60分钟时间止损
        maxDurationHours: ictConfig.maxHoldingHours, // ✅ ICT优化V2.0：48小时最大持仓
        timeStopExitPct: ictConfig.timeExitPct, // ✅ ICT优化V2.0：时间止损平仓50%
        marketType: 'TREND', // ICT策略主要针对趋势市
        confidence: confidence,
        confidenceScore: signals.score / 100, // ✅ 新增：置信度分数
        positionManagementMode: 'LAYERED', // ✅ 新增：仓位管理模式
        remainingQuantity: parseFloat(sizing.qty.toFixed(4)), // ✅ 新增：剩余数量
        tp1Quantity: parseFloat((sizing.qty * 0.5).toFixed(4)), // ✅ 新增：TP1数量
        tp2Quantity: parseFloat((sizing.qty * 0.5).toFixed(4)) // ✅ 新增：TP2数量
      };
    } catch (error) {
      logger.error(`ICT Trade parameters calculation error for ${symbol}:`, error);
      return { entry: 0, stopLoss: 0, takeProfit: 0, leverage: 1, risk: 0 };
    }
  }

  /**
   * 执行ICT策略分析
   * @param {string} symbol - 交易对
   * @returns {Object} 策略分析结果
   */
  async execute(symbol) {
    // ==================== 变量声明（在方法开始定义所有变量，避免"is not defined"错误）====================
    let numericConfidence = 0;  // 默认置信度
    let score = 0;              // 默认总分

    try {
      // ==================== 参数加载确认 ====================
      if (!this.params || Object.keys(this.params).length === 0) {
        await this.initializeParameters();
      }

      logger.info(`Executing ICT strategy for ${symbol}`);

      // ==================== ADX过滤（震荡市过滤）====================
      if (this.params.filters?.adxEnabled) {
        // 获取15M K线用于ADX计算
        const klines15mForADX = await this.binanceAPI.getKlines(symbol, '15m', 50);

        if (klines15mForADX && klines15mForADX.length >= 15) {
          const adxPeriod = this.params.filters.adxPeriod || 14;
          const adxThreshold = this.params.filters.adxMinThreshold || 20;
          const adx = ADXCalculator.calculateADX(klines15mForADX, adxPeriod);

          logger.info(`[ICT-ADX] ${symbol} ADX=${adx?.toFixed(2) || 'N/A'}, 阈值=${adxThreshold}`);

          if (ADXCalculator.shouldFilter(adx, adxThreshold)) {
            logger.info(`[ICT-ADX过滤] ${symbol} 震荡市(ADX=${adx.toFixed(2)}), 跳过交易`);
            return {
              symbol,
              strategy: 'ICT',
              signal: 'HOLD',
              confidence: 'low',
              score: 0,
              trend: 'RANGING',
              reason: `ADX过滤：震荡市(ADX=${adx.toFixed(2)} < ${adxThreshold})`,
              metadata: {
                adx: adx,
                adxThreshold: adxThreshold,
                marketState: ADXCalculator.getMarketState(adx),
                filtered: true
              }
            };
          }
        }
      }
      // ===== ADX过滤结束 =====

      // 暂时禁用缓存以确保每个交易对都有独立数据
      // if (this.cache) {
      //   const cacheKey = `ict:${symbol}`;
      //   const cached = await this.cache.get(cacheKey);
      //   if (cached) {
      //     logger.info(`Using cached ICT strategy result for ${symbol}`);
      //     return JSON.parse(cached);
      //   }
      // }

      // 获取基础数据
      const [klines1D, klines4H, klines15m] = await Promise.all([
        this.binanceAPI.getKlines(symbol, '1d', 25),
        this.binanceAPI.getKlines(symbol, '4h', 50),
        this.binanceAPI.getKlines(symbol, '15m', 50)
      ]);

      // 检查数据有效性
      if (!klines1D || !klines4H || !klines15m) {
        throw new Error(`无法获取 ${symbol} 的完整数据`);
      }

      // 检查数据长度
      if (klines1D.length === 0 || klines4H.length === 0 || klines15m.length === 0) {
        logger.warn(`[ICT策略] ${symbol} 数据不足: 1D=${klines1D.length}, 4H=${klines4H.length}, 15M=${klines15m.length}`);
        // 返回HOLD信号
        return {
          symbol,
          strategy: 'ICT',
          signal: 'HOLD',
          confidence: 'low',
          score: 0,
          trend: 'NEUTRAL',
          reason: '数据不足'
        };
      }

      // 检查数据格式
      if (!klines4H[klines4H.length - 1] || !klines4H[klines4H.length - 1][4]) {
        logger.warn(`[ICT策略] ${symbol} 4H数据格式错误`);
        return {
          symbol,
          strategy: 'ICT',
          signal: 'HOLD',
          confidence: 'low',
          score: 0,
          trend: 'NEUTRAL',
          reason: '数据格式错误'
        };
      }

      // 1. 分析日线趋势
      const dailyTrend = this.analyzeDailyTrend(klines1D);

      // 2. 检测订单块
      const atr4H = this.calculateATR(klines4H, 14);
      const orderBlocks = this.detectOrderBlocks(klines4H, atr4H[atr4H.length - 1], 30);

      // 3. 检测HTF Sweep - 基于订单块进行扫荡检测
      let sweepHTF = { detected: false, type: null, level: 0, confidence: 0, speed: 0 };

      if (orderBlocks.length > 0) {
        // 使用最新的订单块进行扫荡检测
        const latestOrderBlock = orderBlocks[orderBlocks.length - 1];

        // 检测订单块上方扫荡
        const sweepHTFUp = this.detectSweepHTF(latestOrderBlock.high, klines4H, atr4H[atr4H.length - 1]);
        // 检测订单块下方扫荡
        const sweepHTFDown = this.detectSweepHTF(latestOrderBlock.low, klines4H, atr4H[atr4H.length - 1]);

        // 选择有效的扫荡
        sweepHTF = sweepHTFUp.detected ? sweepHTFUp : sweepHTFDown;

        logger.info(`ICT HTF Sweep调试 - 订单块: 高=${latestOrderBlock.high}, 低=${latestOrderBlock.low}, 扫荡检测: ${JSON.stringify(sweepHTF)}`);
      } else {
        // 没有订单块时，使用最近的关键swing点（作为备选方案）
        const recentKlines = klines4H.slice(-10);
        let recentHigh = 0;
        let recentLow = Infinity;
        recentKlines.forEach(kline => {
          const high = parseFloat(kline[2]);
          const low = parseFloat(kline[3]);
          if (high > recentHigh) recentHigh = high;
          if (low < recentLow) recentLow = low;
        });

        // 检测上方扫荡（突破最近高点）
        const sweepHTFUp = this.detectSweepHTF(recentHigh, klines4H, atr4H[atr4H.length - 1]);
        // 检测下方扫荡（跌破最近低点）
        const sweepHTFDown = this.detectSweepHTF(recentLow, klines4H, atr4H[atr4H.length - 1]);

        // 选择有效的扫荡
        sweepHTF = sweepHTFUp.detected ? sweepHTFUp : sweepHTFDown;

        logger.info(`ICT HTF Sweep调试 - 无订单块，使用最近极值: 高=${recentHigh}, 低=${recentLow}, 扫荡检测: ${JSON.stringify(sweepHTF)}`);
      }

      // 4. 扫荡方向验证（V2.1.3修复：所有组合都有效，只判断信号类型）
      let validSweepHTF = sweepHTF;
      let sweepSignalType = 'NONE';
      let sweepConfidenceBonus = 0;

      if (sweepHTF.detected && dailyTrend.trend !== 'RANGE') {
        const sweepDirection = sweepHTF.type === 'LIQUIDITY_SWEEP_UP' ? 'UP' : 'DOWN';
        const trendDirection = dailyTrend.trend;

        // ✅ 修复：所有扫荡方向都有效，只是信号类型不同
        const isSameDirection = (trendDirection === 'UP' && sweepDirection === 'UP') ||
          (trendDirection === 'DOWN' && sweepDirection === 'DOWN');

        if (isSameDirection) {
          sweepSignalType = 'TREND_CONTINUATION'; // 顺势信号
          sweepConfidenceBonus = 0.15; // 置信度+15%
          logger.info(`ICT 扫荡方向 - 趋势: ${trendDirection}, 扫荡: ${sweepDirection}, 顺势信号（高置信度+15%）`);
        } else {
          sweepSignalType = 'REVERSAL'; // 反转信号
          sweepConfidenceBonus = 0.10; // 置信度+10%
          logger.info(`ICT 扫荡方向 - 趋势: ${trendDirection}, 扫荡: ${sweepDirection}, 反转信号（中置信度+10%）`);
        }

        // ✅ 修复：不再过滤任何扫荡信号
        // validSweepHTF保持不变，所有扫荡都有效
      }

      // 调试信息
      logger.info(`ICT HTF Sweep调试 - 当前价: ${parseFloat(klines4H[klines4H.length - 1][4])}, 订单块数量: ${orderBlocks.length}, 扫荡检测结果: ${JSON.stringify(validSweepHTF)}`);

      // 4. 检测吞没形态和LTF Sweep
      const engulfing = this.detectEngulfingPattern(klines15m);
      const atr15m = this.calculateATR(klines15m, 14);

      // 确保ATR有有效值
      const currentATR = atr15m && atr15m.length > 0 ? atr15m[atr15m.length - 1] : 0;
      if (!currentATR || currentATR === null) {
        // 如果ATR计算失败，使用价格的一定百分比作为默认值
        const currentPrice = parseFloat(klines15m[klines15m.length - 1][4]);
        const fallbackATR = currentPrice * 0.01; // 使用当前价格的1%作为默认ATR
        logger.warn(`${symbol} ICT ATR计算失败，使用默认值: ${fallbackATR}`);
        atr15m[atr15m.length - 1] = fallbackATR;
      }

      // 调试信息
      logger.info(`${symbol} ICT 15M数据调试 - 吞没: ${engulfing.detected}, ATR: ${currentATR}, 成交量: ${klines15m[klines15m.length - 1] ? parseFloat(klines15m[klines15m.length - 1][5]) : 0}`);

      // 5. 检测成交量放大（可选加强过滤）
      const volumeExpansion = this.detectVolumeExpansion(klines15m);

      // 7. 检测谐波形态（按照ict-plus.md方案）
      const harmonicPattern = HarmonicPatterns.detectHarmonicPattern(klines15m);
      if (harmonicPattern.detected) {
        logger.info(`${symbol} 检测到谐波形态: ${harmonicPattern.type}, 置信度=${(harmonicPattern.confidence * 100).toFixed(1)}%, 得分=${harmonicPattern.score.toFixed(2)}`);
      } else {
        logger.info(`${symbol} 未检测到谐波形态，继续使用基础ICT逻辑`);
      }

      // 6. 检查订单块年龄过滤（≤2天）
      const validOrderBlocks = orderBlocks.filter(ob => this.checkOrderBlockAge(ob));
      const hasValidOrderBlock = validOrderBlocks.length > 0;

      // 检测LTF扫荡 - 基于4H订单块进行扫荡检测
      let sweepLTF = { detected: false, speed: 0, confidence: 0 };

      if (validOrderBlocks.length > 0) {
        // 使用最新的有效订单块进行扫荡检测
        const latestOrderBlock = validOrderBlocks[validOrderBlocks.length - 1];

        // 检测上方扫荡（突破订单块上沿）
        const sweepLTFUp = this.detectSweepLTF(klines15m, currentATR, latestOrderBlock.high);
        // 检测下方扫荡（跌破订单块下沿）
        const sweepLTFDown = this.detectSweepLTF(klines15m, currentATR, latestOrderBlock.low);

        // 选择有效的扫荡
        sweepLTF = sweepLTFUp.detected ? sweepLTFUp : sweepLTFDown;
      }

      // 7. 综合评分（按照ICT文档要求）
      let score = 0;
      let reasons = [];

      // 趋势评分（必须）
      if (dailyTrend.trend !== 'RANGE') {
        score += dailyTrend.confidence * 30;
        reasons.push(`Daily trend: ${dailyTrend.trend} (${(dailyTrend.confidence * 100).toFixed(1)}%)`);
      }

      // ============ 优化：改为门槛式结构确认逻辑 ============
      // 根据ict-plus.md，采用顺序化门槛式确认，而非线性加权评分

      // 门槛1: 日线趋势必须明确（必须条件）
      if (dailyTrend.trend === 'RANGE') {
        logger.info(`${symbol} ICT策略: 日线趋势为震荡，不交易`);

        // 即使趋势为震荡，也计算15M数据用于显示
        const engulfing = this.detectEngulfingPattern(klines15m);
        const atr15m = this.calculateATR(klines15m, 14);
        const currentATR = atr15m && atr15m.length > 0 ? atr15m[atr15m.length - 1] : 0;
        const volumeExpansion = this.detectVolumeExpansion(klines15m);
        const harmonicPattern = HarmonicPatterns.detectHarmonicPattern(klines15m);

        // 计算15M扫荡检测 - 基于4H订单块
        let sweepLTF = { detected: false, speed: 0, confidence: 0 };

        const atr4H = this.calculateATR(klines4H, 14);
        const orderBlocks = this.detectOrderBlocks(klines4H, atr4H[atr4H.length - 1], 30);
        const validOrderBlocks = orderBlocks.filter(ob => this.checkOrderBlockAge(ob));

        if (validOrderBlocks.length > 0) {
          const latestOrderBlock = validOrderBlocks[validOrderBlocks.length - 1];
          const sweepLTFUp = this.detectSweepLTF(klines15m, currentATR, latestOrderBlock.high);
          const sweepLTFDown = this.detectSweepLTF(klines15m, currentATR, latestOrderBlock.low);
          sweepLTF = sweepLTFUp.detected ? sweepLTFUp : sweepLTFDown;
        }

        // 计算RANGE趋势下的总分（用于显示，但不交易）
        const trendScore = 0; // RANGE趋势得分为0
        const orderBlockScore = validOrderBlocks.length > 0 ? 20 : 0;
        const engulfingScore = engulfing.detected ? 15 : 0;
        const sweepScore = sweepLTF.detected ? 15 : 0;
        const volumeScore = volumeExpansion.detected ? 5 : 0;
        const harmonicScorePoints = harmonicPattern.detected ? harmonicPattern.score * 20 : 0;

        const calculatedScore = Math.round(trendScore + orderBlockScore + engulfingScore + sweepScore + volumeScore + harmonicScorePoints);

        // 计算数值置信度（基于谐波形态和吞没形态强度）
        const harmonicScoreValue = harmonicPattern.detected ? harmonicPattern.score : 0;
        const engulfStrength = engulfing.detected ? (engulfing.strength || 0) : 0;
        numericConfidence = Math.min(harmonicScoreValue * 0.6 + engulfStrength * 0.4, 1);

        return {
          symbol,
          strategy: 'ICT',
          timeframe: '15m',
          signal: 'HOLD',
          score: calculatedScore,
          trend: 'RANGE',
          confidence: numericConfidence,
          reasons: ['日线趋势不明确（RANGE），不交易'],
          timeframes: {
            '1D': {
              trend: 'RANGE',
              closeChange: dailyTrend.closeChange || 0,
              lookback: dailyTrend.lookback || 20
            },
            '4H': {
              orderBlocks: [],
              atr: atr4H[atr4H.length - 1] || 0,
              sweepDetected: validSweepHTF.detected || false,
              sweepRate: validSweepHTF.speed || 0
            },
            '15M': {
              signal: 'HOLD',
              engulfing: engulfing.detected || false,
              engulfingType: engulfing.type || 'NONE',
              atr: currentATR || 0,
              sweepRate: sweepLTF.speed || 0,
              volume: klines15m[klines15m.length - 1] ? parseFloat(klines15m[klines15m.length - 1][5]) : 0,
              volumeExpansion: volumeExpansion.detected || false,
              volumeRatio: volumeExpansion.ratio || 0,
              harmonicPattern: {
                detected: harmonicPattern.detected || false,
                type: harmonicPattern.type || 'NONE',
                confidence: harmonicPattern.confidence || 0,
                score: harmonicPattern.score || 0,
                points: harmonicPattern.points || null
              }
            }
          },
          entryPrice: 0,
          stopLoss: 0,
          takeProfit: 0,
          leverage: 0,
          margin: 0,
          timestamp: new Date().toISOString()
        };
      }
      reasons.push(`✅ 门槛1通过: 日线趋势${dailyTrend.trend}`);

      // 门槛2: 必须有有效订单块（必须条件）
      if (!hasValidOrderBlock) {
        logger.info(`${symbol} ICT策略: 无有效订单块，不交易`);

        // 即使无有效订单块，也计算15M数据用于显示
        const engulfing = this.detectEngulfingPattern(klines15m);
        const atr15m = this.calculateATR(klines15m, 14);
        const currentATR = atr15m && atr15m.length > 0 ? atr15m[atr15m.length - 1] : 0;
        const volumeExpansion = this.detectVolumeExpansion(klines15m);
        const harmonicPattern = HarmonicPatterns.detectHarmonicPattern(klines15m);

        // 计算15M扫荡检测 - 基于4H订单块
        let sweepLTF = { detected: false, speed: 0, confidence: 0 };

        const atr4H = this.calculateATR(klines4H, 14);
        const orderBlocks = this.detectOrderBlocks(klines4H, atr4H[atr4H.length - 1], 30);
        const validOrderBlocks = orderBlocks.filter(ob => this.checkOrderBlockAge(ob));

        if (validOrderBlocks.length > 0) {
          const latestOrderBlock = validOrderBlocks[validOrderBlocks.length - 1];
          const sweepLTFUp = this.detectSweepLTF(klines15m, currentATR, latestOrderBlock.high);
          const sweepLTFDown = this.detectSweepLTF(klines15m, currentATR, latestOrderBlock.low);
          sweepLTF = sweepLTFUp.detected ? sweepLTFUp : sweepLTFDown;
        }

        // 计算无订单块情况下的总分（用于显示）
        const trendScore = dailyTrend.confidence * 25;
        const orderBlockScore = 0; // 无订单块
        const engulfingScore = engulfing.detected ? 15 : 0;
        const sweepScore = sweepLTF.detected ? 15 : 0;
        const volumeScore = volumeExpansion.detected ? 5 : 0;
        const harmonicScore = harmonicPattern.detected ? harmonicPattern.score * 20 : 0;

        const calculatedScore = Math.round(trendScore + orderBlockScore + engulfingScore + sweepScore + volumeScore + harmonicScore);

        // 计算数值置信度（基于谐波形态和吞没形态强度）
        const harmonicScoreValue = harmonicPattern.detected ? harmonicPattern.score : 0;
        const engulfStrength = engulfing.detected ? (engulfing.strength || 0) : 0;
        numericConfidence = Math.min(harmonicScoreValue * 0.6 + engulfStrength * 0.4, 1);

        return {
          symbol,
          strategy: 'ICT',
          timeframe: '15m',
          signal: 'HOLD',
          score: calculatedScore,
          trend: dailyTrend.trend,
          confidence: numericConfidence,
          reasons: ['无有效订单块（≤2天）'],
          timeframes: {
            '1D': {
              trend: dailyTrend.trend,
              closeChange: dailyTrend.closeChange || 0,
              lookback: dailyTrend.lookback || 20
            },
            '4H': {
              orderBlocks: [],
              atr: atr4H[atr4H.length - 1] || 0,
              sweepDetected: validSweepHTF.detected || false,
              sweepRate: validSweepHTF.speed || 0
            },
            '15M': {
              signal: 'HOLD',
              engulfing: engulfing.detected || false,
              engulfingType: engulfing.type || 'NONE',
              atr: currentATR || 0,
              sweepRate: sweepLTF.speed || 0,
              volume: klines15m[klines15m.length - 1] ? parseFloat(klines15m[klines15m.length - 1][5]) : 0,
              volumeExpansion: volumeExpansion.detected || false,
              volumeRatio: volumeExpansion.ratio || 0,
              harmonicPattern: {
                detected: harmonicPattern.detected || false,
                type: harmonicPattern.type || 'NONE',
                confidence: harmonicPattern.confidence || 0,
                score: harmonicPattern.score || 0,
                points: harmonicPattern.points || null
              }
            }
          },
          entryPrice: 0,
          stopLoss: 0,
          takeProfit: 0,
          leverage: 0,
          margin: 0,
          timestamp: new Date().toISOString()
        };
      }
      reasons.push(`✅ 门槛2通过: 有效订单块${validOrderBlocks.length}个`);

      // 记录4H数据（用于所有返回路径）
      const timeframes4H = {
        orderBlocks: validOrderBlocks.slice(-3),
        atr: atr4H[atr4H.length - 1] || 0,
        sweepDetected: validSweepHTF.detected || false,
        sweepRate: validSweepHTF.speed || 0
      };

      // 门槛3: HTF扫荡检测（V2.1.3修复：移除错误的方向过滤）
      const sweepValidation = SweepDirectionFilter.validateSweep(dailyTrend.trend, validSweepHTF);
      if (!sweepValidation.valid) {
        logger.info(`${symbol} ICT策略: ${sweepValidation.reason}（无扫荡信号）`);

        // 即使扫荡方向不匹配，也计算15M数据用于显示
        const engulfing = this.detectEngulfingPattern(klines15m);
        const atr15m = this.calculateATR(klines15m, 14);
        const currentATR = atr15m && atr15m.length > 0 ? atr15m[atr15m.length - 1] : 0;
        const volumeExpansion = this.detectVolumeExpansion(klines15m);
        const harmonicPattern = HarmonicPatterns.detectHarmonicPattern(klines15m);

        // 计算15M扫荡检测 - 基于4H订单块
        let sweepLTF = { detected: false, speed: 0, confidence: 0 };

        const atr4H = this.calculateATR(klines4H, 14);
        const orderBlocks = this.detectOrderBlocks(klines4H, atr4H[atr4H.length - 1], 30);
        const validOrderBlocks = orderBlocks.filter(ob => this.checkOrderBlockAge(ob));

        if (validOrderBlocks.length > 0) {
          const latestOrderBlock = validOrderBlocks[validOrderBlocks.length - 1];
          const sweepLTFUp = this.detectSweepLTF(klines15m, currentATR, latestOrderBlock.high);
          const sweepLTFDown = this.detectSweepLTF(klines15m, currentATR, latestOrderBlock.low);
          sweepLTF = sweepLTFUp.detected ? sweepLTFUp : sweepLTFDown;
        }

        // 计算数值置信度（基于谐波形态和吞没形态强度）
        const harmonicScoreValue = harmonicPattern.detected ? harmonicPattern.score : 0;
        const engulfStrength = engulfing.detected ? (engulfing.strength || 0) : 0;
        numericConfidence = Math.min(harmonicScoreValue * 0.6 + engulfStrength * 0.4, 1);

        // 计算基于组件的分数（替代硬编码30分）
        const trendScore = dailyTrend.confidence * 25;
        const orderBlockScore = hasValidOrderBlock ? 20 : 0;
        const engulfingScore = engulfing.detected ? 15 : 0;
        const sweepScore = (validSweepHTF.detected ? 10 : 0) + (sweepLTF.detected ? 5 : 0);
        const volumeScore = volumeExpansion.detected ? 5 : 0;
        const harmonicScore = harmonicPattern.detected ? harmonicPattern.score * 20 : 0;
        const calculatedScore = Math.round(trendScore + orderBlockScore + engulfingScore + sweepScore + volumeScore + harmonicScore);

        return {
          symbol,
          strategy: 'ICT',
          timeframe: '15m',
          signal: 'HOLD',
          score: calculatedScore,
          trend: dailyTrend.trend,
          confidence: numericConfidence,
          reasons: [sweepValidation.reason],
          signals: { sweepHTF, sweepDirection: sweepValidation.direction },
          timeframes: {
            '1D': {
              trend: dailyTrend.trend,
              closeChange: dailyTrend.closeChange || 0,
              lookback: dailyTrend.lookback || 20
            },
            '4H': timeframes4H,
            '15M': {
              signal: 'HOLD',
              engulfing: engulfing.detected || false,
              engulfingType: engulfing.type || 'NONE',
              atr: currentATR || 0,
              sweepRate: sweepLTF.speed || 0,
              volume: klines15m[klines15m.length - 1] ? parseFloat(klines15m[klines15m.length - 1][5]) : 0,
              volumeExpansion: volumeExpansion.detected || false,
              volumeRatio: volumeExpansion.ratio || 0,
              harmonicPattern: {
                detected: harmonicPattern.detected || false,
                type: harmonicPattern.type || 'NONE',
                confidence: harmonicPattern.confidence || 0,
                score: harmonicPattern.score || 0,
                points: harmonicPattern.points || null
              }
            }
          },
          entryPrice: 0,
          stopLoss: 0,
          takeProfit: 0,
          leverage: 0,
          margin: 0,
          timestamp: new Date().toISOString()
        };
      }
      reasons.push(`✅ 门槛3通过: ${sweepValidation.reason}`);

      // 确认条件: 吞没形态方向必须匹配（强确认）
      const engulfingValid = (dailyTrend.trend === 'UP' && engulfing.type === 'BULLISH_ENGULFING') ||
        (dailyTrend.trend === 'DOWN' && engulfing.type === 'BEARISH_ENGULFING');

      if (!engulfingValid) {
        logger.info(`${symbol} ICT策略: 吞没形态方向不匹配（${engulfing.type}）`);

        // 即使吞没形态方向不匹配，也计算15M数据用于显示
        const volumeExpansion = this.detectVolumeExpansion(klines15m);
        const harmonicPattern = HarmonicPatterns.detectHarmonicPattern(klines15m);

        // 计算15M扫荡检测 - 基于4H订单块
        let sweepLTF = { detected: false, speed: 0, confidence: 0 };

        const atr4H = this.calculateATR(klines4H, 14);
        const orderBlocks = this.detectOrderBlocks(klines4H, atr4H[atr4H.length - 1], 30);
        const validOrderBlocks = orderBlocks.filter(ob => this.checkOrderBlockAge(ob));

        if (validOrderBlocks.length > 0) {
          const latestOrderBlock = validOrderBlocks[validOrderBlocks.length - 1];
          const sweepLTFUp = this.detectSweepLTF(klines15m, currentATR, latestOrderBlock.high);
          const sweepLTFDown = this.detectSweepLTF(klines15m, currentATR, latestOrderBlock.low);
          sweepLTF = sweepLTFUp.detected ? sweepLTFUp : sweepLTFDown;
        }

        // 计算数值置信度（基于谐波形态和吞没形态强度）
        const harmonicScoreValue = harmonicPattern.detected ? harmonicPattern.score : 0;
        const engulfStrength = engulfing.detected ? (engulfing.strength || 0) : 0;
        numericConfidence = Math.min(harmonicScoreValue * 0.6 + engulfStrength * 0.4, 1);

        // 计算基于组件的分数（替代硬编码40分）
        const trendScore = dailyTrend.confidence * 25;
        const orderBlockScore = hasValidOrderBlock ? 20 : 0;
        const engulfingScore = engulfing.detected ? 15 : 0;
        const sweepScore = (validSweepHTF.detected ? 10 : 0) + (sweepLTF.detected ? 5 : 0);
        const volumeScore = volumeExpansion.detected ? 5 : 0;
        const harmonicScore = harmonicPattern.detected ? harmonicPattern.score * 20 : 0;
        const calculatedScore = Math.round(trendScore + orderBlockScore + engulfingScore + sweepScore + volumeScore + harmonicScore);

        return {
          symbol,
          strategy: 'ICT',
          timeframe: '15m',
          signal: 'WATCH',  // 观望，接近但未完全确认
          score: calculatedScore,
          trend: dailyTrend.trend,
          confidence: numericConfidence,
          reasons: [`吞没形态方向不匹配: 需要${dailyTrend.trend === 'UP' ? '看涨' : '看跌'}吞没`],
          signals: { engulfing, sweepHTF: sweepValidation },
          timeframes: {
            '1D': {
              trend: dailyTrend.trend,
              closeChange: dailyTrend.closeChange || 0,
              lookback: dailyTrend.lookback || 20
            },
            '4H': timeframes4H,
            '15M': {
              signal: 'WATCH',
              engulfing: engulfing.detected || false,
              engulfingType: engulfing.type || 'NONE',
              atr: currentATR || 0,
              sweepRate: sweepLTF.speed || 0,
              volume: klines15m[klines15m.length - 1] ? parseFloat(klines15m[klines15m.length - 1][5]) : 0,
              volumeExpansion: volumeExpansion.detected || false,
              volumeRatio: volumeExpansion.ratio || 0,
              harmonicPattern: {
                detected: harmonicPattern.detected || false,
                type: harmonicPattern.type || 'NONE',
                confidence: harmonicPattern.confidence || 0,
                score: harmonicPattern.score || 0,
                points: harmonicPattern.points || null
              }
            }
          },
          entryPrice: 0,
          stopLoss: 0,
          takeProfit: 0,
          leverage: 0,
          margin: 0,
          timestamp: new Date().toISOString()
        };
      }
      reasons.push(`✅ 确认通过: 吞没形态${engulfing.type} (强度${(engulfing.strength * 100).toFixed(1)}%)`);

      // ========== 15M入场有效性检查（容忍逻辑）==========
      // 要求：吞没形态强度>=30% 或 谐波形态分数>=30%（降低阈值）
      const minEngulfStrength = 0.3;  // 从60%降到30%
      const minHarmonicScore = 0.3;   // 从60%降到30%

      const engulfStrength = engulfing.strength || 0;
      const harmonicScore = harmonicPattern.detected ? harmonicPattern.score : 0;

      // 计算基础信号强度（趋势+订单块+扫荡+成交量）
      const trendScore = dailyTrend.confidence * 25;
      const orderBlockScore = hasValidOrderBlock ? 20 : 0;
      const sweepScore = (validSweepHTF.detected ? 10 : 0) + (sweepLTF.detected ? 5 : 0);
      const volumeScore = volumeExpansion.detected ? 5 : 0;
      const basicScore = trendScore + orderBlockScore + sweepScore + volumeScore;
      
      // 入场条件：吞没/谐波满足阈值 或 基础信号强度足够
      const entryValid = (engulfStrength >= minEngulfStrength) || 
                        (harmonicScore >= minHarmonicScore) ||
                        (basicScore >= 30); // 基础信号强度≥30分

      if (!entryValid) {
        logger.info(`${symbol} ICT策略: 15M入场有效性不足 - 吞没强度${(engulfStrength * 100).toFixed(1)}%（需≥30%），谐波分数${(harmonicScore * 100).toFixed(1)}%（需≥30%），基础信号${basicScore}分（需≥30分）`);

        // 计算分数用于显示（即使无效也显示分析结果）
        // trendScore, orderBlockScore等变量已在上面声明，直接使用
        const engulfingScore = engulfing.detected ? 15 : 0;
        const sweepScore = (validSweepHTF.detected ? 10 : 0) + (sweepLTF.detected ? 5 : 0);
        const volumeScore = volumeExpansion.detected ? 5 : 0;
        const harmonicScoreValue = harmonicPattern.detected ? harmonicPattern.score * 20 : 0;
        const calculatedScore = Math.round(trendScore + orderBlockScore + engulfingScore + sweepScore + volumeScore + harmonicScoreValue);

        numericConfidence = Math.min(harmonicScore * 0.6 + engulfStrength * 0.4, 1);

        return {
          symbol,
          strategy: 'ICT',
          timeframe: '15m',
          signal: 'WATCH',  // 15M入场无效，观望
          score: calculatedScore,
          trend: dailyTrend.trend,
          confidence: numericConfidence,
          reasons: [
            `❌ 15M入场无效: 吞没强度${(engulfStrength * 100).toFixed(1)}%（需≥30%），谐波分数${(harmonicScore * 100).toFixed(1)}%（需≥30%），基础信号${basicScore}分（需≥30分）`,
            `门槛已通过，但入场确认条件不足`
          ],
          signals: { engulfing, sweepHTF: sweepValidation },
          timeframes: {
            '1D': {
              trend: dailyTrend.trend,
              closeChange: dailyTrend.closeChange || 0,
              lookback: dailyTrend.lookback || 20
            },
            '4H': timeframes4H,
            '15M': {
              signal: 'WATCH',
              engulfing: engulfing.detected || false,
              engulfingType: engulfing.type || 'NONE',
              engulfingStrength: engulfStrength,
              atr: currentATR || 0,
              sweepRate: sweepLTF.speed || 0,
              volume: klines15m[klines15m.length - 1] ? parseFloat(klines15m[klines15m.length - 1][5]) : 0,
              volumeExpansion: volumeExpansion.detected || false,
              volumeRatio: volumeExpansion.ratio || 0,
              harmonicPattern: {
                detected: harmonicPattern.detected || false,
                type: harmonicPattern.type || 'NONE',
                confidence: harmonicPattern.confidence || 0,
                score: harmonicPattern.score || 0,
                points: harmonicPattern.points || null
              }
            }
          },
          entryPrice: 0,
          stopLoss: 0,
          takeProfit: 0,
          leverage: 0,
          margin: 0,
          timestamp: new Date().toISOString()
        };
      }

      logger.info(`${symbol} ✅ 15M入场有效: 吞没强度${(engulfStrength * 100).toFixed(1)}% 或 谐波分数${(harmonicScore * 100).toFixed(1)}% 满足要求（≥60%）`);

      // 可选加强: LTF扫荡和成交量放大
      if (sweepLTF.detected) {
        reasons.push(`+ LTF Sweep: ${sweepLTF.type} (${(sweepLTF.confidence * 100).toFixed(1)}%)`);
      }
      if (volumeExpansion.detected) {
        reasons.push(`+ 成交量放大: ${volumeExpansion.ratio.toFixed(2)}x`);
      }

      // 优化：谐波形态共振确认（可选加强）
      if (harmonicPattern.detected) {
        const harmonicDirection = HarmonicPatterns.getHarmonicDirection(harmonicPattern.type, harmonicPattern.points);
        const harmonicMatchTrend = (dailyTrend.trend === 'UP' && harmonicDirection === 'BUY') ||
          (dailyTrend.trend === 'DOWN' && harmonicDirection === 'SELL');

        if (harmonicMatchTrend) {
          reasons.push(`✨ 谐波共振: ${harmonicPattern.type}形态 (置信度${(harmonicPattern.confidence * 100).toFixed(1)}%)`);
          logger.info(`${symbol} 谐波共振确认: ${harmonicPattern.type}形态与${dailyTrend.trend}趋势一致`);
        } else {
          logger.info(`${symbol} 谐波形态方向不匹配趋势，不加强信号`);
        }
      }

      // 计算数值置信度（基于谐波形态和吞没形态强度）
      // engulfStrength 和 harmonicScore 已在line 1149-1150定义，直接使用
      numericConfidence = Math.min(harmonicScore * 0.6 + engulfStrength * 0.4, 1);

      // 生成信号（按照ict-plus.md综合评分系统）
      const signal = dailyTrend.trend === 'UP' ? 'BUY' : 'SELL';

      // 按照ict-plus.md的综合评分计算
      // 趋势(25%) + 订单块(20%) + 吞没(15%) + 扫荡(15%) + 成交量(5%) + 谐波(20%)
      // trendScore, orderBlockScore等变量已在上面声明，直接使用
      const engulfingScore = engulfing.detected ? 15 : 0;
      const harmonicScorePoints = harmonicPattern.detected ? harmonicPattern.score * 20 : 0; // 重命名避免冲突

      score = Math.round(trendScore + orderBlockScore + engulfingScore + sweepScore + volumeScore + harmonicScorePoints);

      // 谐波共振额外加分
      if (harmonicPattern.detected && harmonicPattern.score > 0.6) {
        score = Math.min(100, score + 10); // 谐波共振额外加10分
        reasons.push(`🎯 谐波共振加分: +10分`);
      }

      logger.info(`${symbol} ICT评分详情: 趋势=${trendScore.toFixed(1)}, 订单块=${orderBlockScore}, 吞没=${engulfingScore}, 扫荡=${sweepScore}, 成交量=${volumeScore}, 谐波=${harmonicScorePoints.toFixed(1)}, 总分=${score}`);

      // 门槛式结构确认 + 总分强信号要求
      // 强信号定义：从数据库获取阈值
      const strongSignalThreshold = this.getThreshold('signal', 'strongSignalThreshold', 60);
      const isStrongSignal = score >= strongSignalThreshold;

      if (!isStrongSignal) {
        logger.info(`${symbol} ICT策略: 门槛式确认通过，但总分不足（${score}/100，需要≥${strongSignalThreshold}），信号强度不够`);

        // 计算数值置信度（基于谐波形态和吞没形态强度）
        const harmonicScoreForConfidence = harmonicPattern.detected ? harmonicPattern.score : 0;
        const engulfStrength = engulfing.detected ? (engulfing.strength || 0) : 0;
        const numericConfidence = Math.min(harmonicScoreForConfidence * 0.6 + engulfStrength * 0.4, 1);

        // 计算15M扫荡检测 - 基于4H订单块
        let sweepLTF = { detected: false, speed: 0, confidence: 0 };

        const atr4H = this.calculateATR(klines4H, 14);
        const orderBlocks = this.detectOrderBlocks(klines4H, atr4H[atr4H.length - 1], 30);
        const validOrderBlocks = orderBlocks.filter(ob => this.checkOrderBlockAge(ob));

        if (validOrderBlocks.length > 0) {
          const latestOrderBlock = validOrderBlocks[validOrderBlocks.length - 1];
          const sweepLTFUp = this.detectSweepLTF(klines15m, currentATR, latestOrderBlock.high);
          const sweepLTFDown = this.detectSweepLTF(klines15m, currentATR, latestOrderBlock.low);
          sweepLTF = sweepLTFUp.detected ? sweepLTFUp : sweepLTFDown;
        }

        return {
          symbol,
          strategy: 'ICT',
          timeframe: '15m',
          signal: 'WATCH',  // 观望，门槛通过但总分不足
          score: score,
          trend: dailyTrend.trend,
          confidence: numericConfidence,
          reasons: [`门槛式确认通过，但总分${score}分不足（需要≥${strongSignalThreshold}分）`],
          signals: { engulfing, sweepHTF: sweepValidation },
          timeframes: {
            '1D': {
              trend: dailyTrend.trend,
              closeChange: dailyTrend.closeChange || 0,
              lookback: dailyTrend.lookback || 20
            },
            '4H': timeframes4H,
            '15M': {
              signal: 'WATCH',
              engulfing: engulfing.detected || false,
              engulfingType: engulfing.type || 'NONE',
              atr: currentATR || 0,
              sweepRate: sweepLTF.speed || 0,
              volume: klines15m[klines15m.length - 1] ? parseFloat(klines15m[klines15m.length - 1][5]) : 0,
              volumeExpansion: volumeExpansion.detected || false,
              volumeRatio: volumeExpansion.ratio || 0,
              harmonicPattern: {
                detected: harmonicPattern.detected || false,
                type: harmonicPattern.type || 'NONE',
                confidence: harmonicPattern.confidence || 0,
                score: harmonicPattern.score || 0,
                points: harmonicPattern.points || null
              }
            }
          },
          entryPrice: 0,
          stopLoss: 0,
          takeProfit: 0,
          leverage: 0,
          margin: 0,
          timestamp: new Date().toISOString()
        };
      }

      logger.info(`${symbol} ICT策略 触发交易信号: ${signal}, 置信度=${numericConfidence.toFixed(3)}, 门槛式确认通过 + 总分${score}≥${strongSignalThreshold}（强信号）`);
      logger.info(`${symbol} ICT理由: ${reasons.join(' | ')}`)

      // 8. 计算交易参数（只在信号为BUY或SELL时计算）
      let tradeParams = { entry: 0, stopLoss: 0, takeProfit: 0, leverage: 1, risk: 0 };
      if (signal === 'BUY' || signal === 'SELL') {
        try {
          // 检查是否已有交易
          const cacheKey = `ict_trade_${symbol}`;
          const existingTrade = this.cache ? await this.cache.get(cacheKey) : null;

          if (!existingTrade && hasValidOrderBlock) {
            // 使用最新的有效订单块
            const latestOrderBlock = validOrderBlocks[validOrderBlocks.length - 1];

            // 计算新的交易参数（使用文档要求的方法）
            tradeParams = await this.calculateTradeParameters(
              symbol,
              dailyTrend.trend,
              {
                engulfing,
                sweepHTF,
                sweepLTF,
                volumeExpansion
              },
              latestOrderBlock,
              klines4H,
              atr4H[atr4H.length - 1]
            );

            // 缓存交易参数（5分钟过期）
            if (this.cache && tradeParams.entry > 0) {
              await this.cache.set(cacheKey, JSON.stringify(tradeParams), 300);
            }
          } else if (existingTrade) {
            // 使用现有交易参数
            tradeParams = JSON.parse(existingTrade);
          }
        } catch (error) {
          logger.error(`ICT交易参数计算失败: ${error.message}`);
        }
      }

      // 计算置信度等级（MEDIUM或HIGH）
      const confidenceLevel = numericConfidence >= 0.7 ? 'HIGH' : 'MEDIUM';

      const result = {
        symbol,
        strategy: 'ICT',
        timeframe: '15m',
        signal,
        score: Math.min(score, 100),
        trend: dailyTrend.trend,
        confidence: numericConfidence,
        confidenceLevel, // 新增：置信度等级（MEDIUM或HIGH）
        reasons: reasons.join('; '),
        tradeParams,
        orderBlocks: validOrderBlocks.slice(-3), // 最近3个有效订单块
        signals: {
          engulfing,
          sweepHTF,
          sweepLTF,
          volumeExpansion,
          harmonicPattern // 新增：谐波形态
        },
        // 添加timeframes结构以匹配API期望格式
        timeframes: {
          '1D': {
            trend: dailyTrend.trend,
            closeChange: dailyTrend.closeChange || 0,
            lookback: dailyTrend.lookback || 20
          },
          '4H': {
            orderBlocks: validOrderBlocks.slice(-3),
            atr: atr4H[atr4H.length - 1] || 0,
            sweepDetected: sweepHTF.detected || false,
            sweepRate: sweepHTF.speed || 0
          },
          '15M': {
            signal: signal,
            engulfing: engulfing.detected || false,
            engulfingType: engulfing.type || 'NONE',
            atr: (atr15m && atr15m.length > 0) ? atr15m[atr15m.length - 1] : 0,
            sweepRate: sweepLTF.speed || 0,
            volume: klines15m[klines15m.length - 1] ? parseFloat(klines15m[klines15m.length - 1][5]) : 0,
            volumeExpansion: volumeExpansion.detected || false,
            volumeRatio: volumeExpansion.ratio || 0,
            harmonicPattern: {
              detected: harmonicPattern.detected || false,
              type: harmonicPattern.type || 'NONE',
              confidence: harmonicPattern.confidence || 0,
              score: harmonicPattern.score || 0,
              points: harmonicPattern.points || null
            }
          }
        },
        // 添加交易参数
        entryPrice: tradeParams.entry || 0,
        stopLoss: tradeParams.stopLoss || 0,
        takeProfit: tradeParams.takeProfit || 0,
        leverage: tradeParams.leverage || 0,
        margin: tradeParams.margin || 0,
        timestamp: new Date().toISOString()
      };

      // 暂时禁用缓存保存
      // if (this.cache) {
      //   const cacheKey = `ict:${symbol}`;
      //   await this.cache.set(cacheKey, JSON.stringify(result)); // 5分钟缓存
      // }

      return result;
    } catch (error) {
      logger.error(`ICT strategy execution error for ${symbol}:`, error);
      throw error;
    }
  }

  // 包装方法，委托给TechnicalIndicators
  calculateATR(klines, period) {
    const high = klines.map(k => parseFloat(k[2])); // 最高价
    const low = klines.map(k => parseFloat(k[3]));  // 最低价
    const close = klines.map(k => parseFloat(k[4])); // 收盘价
    return TechnicalIndicators.calculateATR(high, low, close, period);
  }
}

module.exports = ICTStrategy;
