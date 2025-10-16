/**
 * 四阶段聪明钱检测器
 * 基于smartmoney.md文档实现的状态机模型
 * 检测吸筹→拉升→派发→砸盘四个阶段
 * 
 * 设计原则：
 * 1. 单一职责：专注于四阶段检测
 * 2. 开闭原则：支持参数扩展和阈值调整
 * 3. 依赖倒置：依赖抽象接口而非具体实现
 * 4. 接口隔离：提供简洁的检测接口
 * 5. 复用现有：复用数据库表结构和API
 */

const logger = require('../../utils/logger');
const TechnicalIndicators = require('../../utils/technical-indicators');

/**
 * 四阶段状态枚举
 */
const SmartMoneyStage = {
  NEUTRAL: 'neutral',
  ACCUMULATION: 'accumulation',
  MARKUP: 'markup',
  DISTRIBUTION: 'distribution',
  MARKDOWN: 'markdown'
};

/**
 * 阶段流转规则
 * 严格按照四阶段循环：吸筹→拉升→派发→砸盘→吸筹
 */
const STAGE_TRANSITIONS = {
  [SmartMoneyStage.NEUTRAL]: [SmartMoneyStage.ACCUMULATION],
  [SmartMoneyStage.ACCUMULATION]: [SmartMoneyStage.MARKUP, SmartMoneyStage.NEUTRAL],
  [SmartMoneyStage.MARKUP]: [SmartMoneyStage.DISTRIBUTION, SmartMoneyStage.MARKDOWN],
  [SmartMoneyStage.DISTRIBUTION]: [SmartMoneyStage.MARKDOWN], // 派发后只能进入砸盘
  [SmartMoneyStage.MARKDOWN]: [SmartMoneyStage.ACCUMULATION, SmartMoneyStage.NEUTRAL]
};

/**
 * 四阶段聪明钱检测器
 */
class FourPhaseSmartMoneyDetector {
  constructor(database, binanceAPI, largeOrderDetector = null) {
    this.database = database;
    this.binanceAPI = binanceAPI;
    this.largeOrderDetector = largeOrderDetector;

    // 状态存储：symbol -> state
    this.stateMap = new Map();

    // 循环管理：symbol -> cycleInfo
    this.cycleMap = new Map();

    // 默认参数（可从数据库加载）
    this.params = {
      // 时间窗口
      cvdWindowMs: 4 * 60 * 60 * 1000, // 4小时
      recentVolCandles: 20,
      obiTopN: 50,
      persistenceSec: 10,

      // 阈值参数
      obiZPos: 0.8,
      obiZNeg: -0.8,
      cvdZUp: 0.5,
      cvdZDown: -1.0,
      volFactorAcc: 1.2,
      volFactorBreak: 1.4,
      deltaTh: 0.04,
      impactRatioTh: 0.20,
      largeOrderAbs: 100_000_000,
      sweepPct: 0.3,
      priceDropPctWindow: 0.03,
      minStageLockMins: 30, // 缩短锁定时间，允许更频繁的阶段转换

      // 阶段判定阈值（降低以提高敏感度）
      minAccumulationScore: 2,
      minMarkupScore: 2,
      minDistributionScore: 1,
      minMarkdownScore: 2,

      // 循环管理参数
      enableCycleManagement: true, // 启用循环管理
      cycleDurationMins: 60, // 每个阶段持续时间（分钟）
      forceTransitionThreshold: 0.3 // 强制转换阈值
    };

    // 数据缓存
    this.dataCache = new Map();

    // 中文动作映射
    this.actionMapping = {
      [SmartMoneyStage.ACCUMULATION]: '吸筹',
      [SmartMoneyStage.MARKUP]: '拉升',
      [SmartMoneyStage.DISTRIBUTION]: '派发',
      [SmartMoneyStage.MARKDOWN]: '砸盘',
      [SmartMoneyStage.NEUTRAL]: '无动作'
    };
  }

  /**
   * 初始化检测器
   */
  async initialize() {
    try {
      // 从数据库加载参数配置
      await this.loadParameters();

      // 初始化默认监控交易对
      await this.initializeWatchList();

      // 加载持久化状态
      await this.loadStatesFromDatabase();

      // 启动状态持久化
      this.startStatePersistence();

      logger.info('[四阶段聪明钱] 检测器初始化完成');
    } catch (error) {
      logger.error('[四阶段聪明钱] 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 从数据库加载参数配置
   */
  async loadParameters() {
    try {
      const [rows] = await this.database.pool.query(`
        SELECT param_name, param_value, param_type 
        FROM strategy_params 
        WHERE category = 'four_phase_smart_money'
      `);

      for (const row of rows) {
        const key = row.param_name.replace('fpsm_', '');
        let value = row.param_value;

        // 类型转换
        switch (row.param_type) {
          case 'number':
            value = parseFloat(value);
            break;
          case 'boolean':
            value = value === 'true';
            break;
        }

        // 设置参数
        if (key in this.params) {
          this.params[key] = value;
        }
      }

      logger.info('[四阶段聪明钱] 参数加载完成');
    } catch (error) {
      logger.warn('[四阶段聪明钱] 参数加载失败，使用默认值:', error.message);
    }
  }

  /**
   * 初始化监控交易对列表
   */
  async initializeWatchList() {
    try {
      const [rows] = await this.database.pool.query(`
        SELECT symbol FROM smart_money_watch_list WHERE is_active = 1
      `);

      for (const row of rows) {
        this.stateMap.set(row.symbol, {
          stage: SmartMoneyStage.NEUTRAL,
          since: Date.now(),
          confidence: 0,
          reasons: [],
          scores: {}
        });
      }

      logger.info(`[四阶段聪明钱] 初始化监控交易对: ${rows.length}个`);
    } catch (error) {
      logger.warn('[四阶段聪明钱] 监控列表初始化失败:', error.message);
    }
  }

  /**
   * 检测单个交易对的四阶段状态
   * @param {string} symbol - 交易对
   * @returns {Promise<Object>} 检测结果
   */
  async detect(symbol) {
    try {
      // 获取市场数据
      const marketData = await this.gatherMarketData(symbol);

      // 计算技术指标
      const indicators = this.computeIndicators(marketData);

      // 检测大额挂单
      const largeOrders = await this.detectLargeOrders(symbol, marketData.orderBook);

      // 评估四阶段得分
      const scores = this.evaluateStageScores(indicators, largeOrders);

      // 确定当前阶段
      const stageResult = this.determineStage(symbol, scores);

      // 分析趋势
      const trend = this.analyzeTrend(marketData, indicators);

      // 保存结果到数据库
      await this.saveDetectionResult(symbol, stageResult, indicators, largeOrders);

      return {
        symbol,
        stage: stageResult.stage,
        confidence: stageResult.confidence,
        action: this.actionMapping[stageResult.stage],
        reasons: stageResult.reasons,
        scores: stageResult.scores,
        trend: trend,
        indicators: {
          obi: indicators.obi,
          obiZ: indicators.obiZ,
          cvdZ: indicators.cvdZ,
          volRatio: indicators.volRatio,
          delta15: indicators.delta15,
          priceDropPct: indicators.priceDropPct,
          currentPrice: indicators.currentPrice,
          oiChange: indicators.oiChange,
          volume24h: indicators.volume24h,
          lastVol: indicators.lastVol
        },
        largeOrders: largeOrders.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`[四阶段聪明钱] 检测${symbol}失败:`, error);
      return {
        symbol,
        stage: SmartMoneyStage.NEUTRAL,
        confidence: 0,
        action: '无动作',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 批量检测多个交易对
   * @param {Array<string>} symbols - 交易对列表
   * @returns {Promise<Array>} 检测结果列表
   */
  async detectBatch(symbols) {
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return [];
    }

    const results = [];

    for (const symbol of symbols) {
      try {
        const result = await this.detect(symbol);
        results.push(result);
      } catch (error) {
        logger.error(`[四阶段聪明钱] 批量检测${symbol}失败:`, error);
        results.push({
          symbol,
          stage: SmartMoneyStage.NEUTRAL,
          confidence: 0,
          action: '无动作',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    return results;
  }

  /**
   * 获取市场数据
   * @private
   */
  async gatherMarketData(symbol) {
    const [klines15m, klines1h, klines4h, ticker, depth, oi, oiHist] = await Promise.all([
      this.binanceAPI.getKlines(symbol, '15m', 200),
      this.binanceAPI.getKlines(symbol, '1h', 100),
      this.binanceAPI.getKlines(symbol, '4h', 50),
      this.binanceAPI.getTicker24hr(symbol),
      this.binanceAPI.getDepth(symbol, 50),
      this.binanceAPI.getOpenInterest(symbol).catch(() => null),
      this.binanceAPI.getOpenInterestHist(symbol, '1h', 6).catch(() => [])
    ]);

    return {
      klines15m,
      klines1h,
      klines4h,
      ticker,
      orderBook: depth,
      openInterest: oi,
      openInterestHist: oiHist
    };
  }

  /**
   * 计算技术指标
   * @private
   */
  computeIndicators(marketData) {
    const { klines15m, klines1h, klines4h, ticker, orderBook, openInterest, openInterestHist } = marketData;

    // 成交量指标
    const volArr = klines15m.slice(-this.params.recentVolCandles).map(k => parseFloat(k[5]));
    const avgVol15 = volArr.reduce((a, b) => a + b, 0) / volArr.length;
    const lastVol = parseFloat(klines15m[klines15m.length - 1][5]);
    const volRatio = avgVol15 > 0 ? lastVol / avgVol15 : 1; // 防止除零错误

    // OBI计算
    const bids = orderBook.bids.slice(0, this.params.obiTopN);
    const asks = orderBook.asks.slice(0, this.params.obiTopN);
    const bidVal = bids.reduce((sum, [price, qty]) => sum + parseFloat(price) * parseFloat(qty), 0);
    const askVal = asks.reduce((sum, [price, qty]) => sum + parseFloat(price) * parseFloat(qty), 0);
    const obi = bidVal - askVal;

    // OBI Z-Score（基于OBI值计算）
    const obiZ = obi / 1000000; // 标准化到合理范围

    // CVD计算（基于买卖压力）
    const cvdValues = [];
    for (let i = Math.max(0, klines15m.length - 12); i < klines15m.length; i++) {
      const kline = klines15m[i];
      const close = parseFloat(kline[4]);
      const open = parseFloat(kline[1]);
      const volume = parseFloat(kline[5]);
      // 如果收盘价高于开盘价，为买入压力；否则为卖出压力
      const delta = close > open ? volume : -volume;
      cvdValues.push(delta);
    }
    const cvdSum = cvdValues.reduce((sum, val) => sum + val, 0);
    const cvdZ = Math.tanh(cvdSum / (avgVol15 * 12)); // 标准化CVD

    // 价格跌幅
    const currentPrice = parseFloat(klines15m[klines15m.length - 1][4]);
    const pastPrice = parseFloat(klines15m[Math.max(0, klines15m.length - 12)][4]);
    const priceDropPct = (pastPrice - currentPrice) / pastPrice;

    // Delta 15分钟（基于价格变化和成交量）
    const priceChange = (currentPrice - pastPrice) / pastPrice;
    const delta15 = priceChange * volRatio;

    // ATR 15分钟
    const atr15 = this.calculateATR(klines15m, 14);

    // OI变化计算（基于历史数据）
    let oiChange = 0;
    if (openInterestHist && openInterestHist.length >= 2) {
      const latestOI = parseFloat(openInterestHist[openInterestHist.length - 1].sumOpenInterest);
      const earliestOI = parseFloat(openInterestHist[0].sumOpenInterest);
      oiChange = earliestOI > 0 ? ((latestOI - earliestOI) / earliestOI) * 100 : 0;
    } else if (openInterest && openInterest.openInterest) {
      // 如果没有历史数据，使用当前OI与估算值的比较
      const currentOI = openInterest.openInterest;
      const estimatedOI = 1000000; // 基础估算值
      oiChange = ((currentOI - estimatedOI) / estimatedOI) * 100;
    }

    // 成交量数据
    const volume24h = ticker && ticker.volume ? parseFloat(ticker.volume) : lastVol * 96; // 估算24小时成交量

    return {
      volRatio,
      obi,
      obiZ,
      cvdZ,
      delta15,
      priceDropPct,
      atr15,
      currentPrice,
      oiChange,
      volume24h,
      lastVol: lastVol.toString()
    };
  }

  /**
   * 计算ATR
   * @private
   */
  calculateATR(klines, period) {
    if (klines.length < period + 1) return 0;

    const trs = [];
    for (let i = 1; i < klines.length; i++) {
      const current = klines[i];
      const previous = klines[i - 1];
      const tr = Math.max(
        current[2] - current[3], // high - low
        Math.abs(current[2] - previous[4]), // |high - prev_close|
        Math.abs(current[3] - previous[4])  // |low - prev_close|
      );
      trs.push(tr);
    }

    return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
  }

  /**
   * 检测大额挂单
   * @private
   */
  async detectLargeOrders(symbol, orderBook) {
    const largeOrders = [];
    const topN = this.params.obiTopN;

    // 检测买单
    for (const [price, qty] of orderBook.bids.slice(0, topN)) {
      const value = parseFloat(price) * parseFloat(qty);
      if (value >= this.params.largeOrderAbs) {
        largeOrders.push({
          side: 'bid',
          price: parseFloat(price),
          qty: parseFloat(qty),
          value,
          impactRatio: 0.5 // 简化计算
        });
      }
    }

    // 检测卖单
    for (const [price, qty] of orderBook.asks.slice(0, topN)) {
      const value = parseFloat(price) * parseFloat(qty);
      if (value >= this.params.largeOrderAbs) {
        largeOrders.push({
          side: 'ask',
          price: parseFloat(price),
          qty: parseFloat(qty),
          value,
          impactRatio: 0.5 // 简化计算
        });
      }
    }

    return largeOrders;
  }

  /**
   * 评估各阶段得分
   * @private
   */
  evaluateStageScores(indicators, largeOrders) {
    const { volRatio, obiZ, cvdZ, delta15, priceDropPct } = indicators;

    let accScore = 0, markupScore = 0, distScore = 0, markdnScore = 0;
    const reasons = [];

    // 调试日志：记录原始指标值
    logger.info(`[四阶段得分] 指标值: volRatio=${volRatio?.toFixed(3)}, obiZ=${obiZ?.toFixed(3)}, cvdZ=${cvdZ?.toFixed(3)}, delta15=${delta15?.toFixed(3)}, priceDropPct=${priceDropPct?.toFixed(3)}`);

    // 吸筹阶段评估
    if (obiZ >= this.params.obiZPos) { accScore += 1; reasons.push('OBI正偏'); }
    if (cvdZ >= this.params.cvdZUp) { accScore += 1; reasons.push('CVD上升'); }
    if (volRatio >= this.params.volFactorAcc) { accScore += 1; reasons.push('成交量放大'); }
    if (largeOrders.some(o => o.side === 'bid' && o.impactRatio >= this.params.impactRatioTh)) {
      accScore += 1; reasons.push('大额买单支撑');
    }

    // 拉升阶段评估
    if (volRatio >= this.params.volFactorBreak) { markupScore += 2; reasons.push('放量突破'); }
    if (cvdZ > 0.2) { markupScore += 1; reasons.push('CVD持续正向'); }
    if (delta15 > this.params.deltaTh) { markupScore += 1; reasons.push('主动买盘'); }

    // 派发阶段评估
    if (volRatio < (this.params.volFactorAcc * 0.8)) { distScore += 1; reasons.push('成交量萎缩'); }
    if (cvdZ < 0 && obiZ < 0) { distScore += 1; reasons.push('CVD与OBI背离'); }
    if (largeOrders.some(o => o.side === 'ask' && o.impactRatio >= this.params.impactRatioTh)) {
      distScore += 1; reasons.push('大额卖单压力');
    }

    // 砸盘阶段评估
    if (priceDropPct >= this.params.priceDropPctWindow) { markdnScore += 2; reasons.push('价格快速下跌'); }
    if (cvdZ <= this.params.cvdZDown) { markdnScore += 1; reasons.push('CVD急降'); }
    if (obiZ <= this.params.obiZNeg) { markdnScore += 1; reasons.push('OBI负偏'); }

    // 调试日志：记录各阶段得分
    logger.info(`[四阶段得分] 吸筹=${accScore}, 拉升=${markupScore}, 派发=${distScore}, 砸盘=${markdnScore}, 原因=[${reasons.join(', ')}]`);

    return {
      accScore,
      markupScore,
      distScore,
      markdnScore,
      reasons
    };
  }

  /**
   * 获取循环管理信息
   * @private
   */
  getCycleInfo(symbol) {
    if (!this.cycleMap.has(symbol)) {
      this.cycleMap.set(symbol, {
        currentPhase: 0, // 0=吸筹, 1=拉升, 2=派发, 3=砸盘
        phaseStartTime: Date.now(),
        cycleCount: 0
      });
    }
    return this.cycleMap.get(symbol);
  }

  /**
   * 更新循环管理信息
   * @private
   */
  updateCycleInfo(symbol, newStage) {
    const cycleInfo = this.getCycleInfo(symbol);
    const stageToPhase = {
      [SmartMoneyStage.ACCUMULATION]: 0,
      [SmartMoneyStage.MARKUP]: 1,
      [SmartMoneyStage.DISTRIBUTION]: 2,
      [SmartMoneyStage.MARKDOWN]: 3
    };

    const newPhase = stageToPhase[newStage];
    if (newPhase !== undefined) {
      // 如果完成一个完整循环，增加循环计数
      if (newPhase === 0 && cycleInfo.currentPhase === 3) {
        cycleInfo.cycleCount++;
        logger.info(`[循环管理] ${symbol} 完成第${cycleInfo.cycleCount}个完整循环`);
      }

      cycleInfo.currentPhase = newPhase;
      cycleInfo.phaseStartTime = Date.now();
    }
  }

  /**
   * 检查是否需要强制转换阶段
   * @private
   */
  shouldForceTransition(symbol, currentStage) {
    if (!this.params.enableCycleManagement) return null;

    const cycleInfo = this.getCycleInfo(symbol);
    const now = Date.now();
    const phaseDuration = now - cycleInfo.phaseStartTime;
    const maxDuration = this.params.cycleDurationMins * 60 * 1000;

    // 如果当前阶段持续时间超过阈值，强制转换到下一阶段
    if (phaseDuration > maxDuration) {
      const stageSequence = [
        SmartMoneyStage.ACCUMULATION,
        SmartMoneyStage.MARKUP,
        SmartMoneyStage.DISTRIBUTION,
        SmartMoneyStage.MARKDOWN
      ];

      const currentIndex = stageSequence.indexOf(currentStage);
      if (currentIndex >= 0 && currentIndex < stageSequence.length - 1) {
        const nextStage = stageSequence[currentIndex + 1];
        logger.info(`[循环管理] ${symbol} 强制转换: ${currentStage} -> ${nextStage} (持续${Math.round(phaseDuration / 60000)}分钟)`);
        return nextStage;
      } else if (currentIndex === stageSequence.length - 1) {
        // 砸盘阶段结束后，重新开始吸筹
        logger.info(`[循环管理] ${symbol} 强制转换: ${currentStage} -> ${SmartMoneyStage.ACCUMULATION} (完成循环)`);
        return SmartMoneyStage.ACCUMULATION;
      }
    }

    return null;
  }

  /**
   * 确定当前阶段
   * @private
   */
  determineStage(symbol, scores) {
    const { accScore, markupScore, distScore, markdnScore, reasons } = scores;

    // 获取当前状态
    const currentState = this.stateMap.get(symbol) || {
      stage: SmartMoneyStage.NEUTRAL,
      since: Date.now(),
      confidence: 0
    };

    const now = Date.now();
    const timeSinceLastChange = now - currentState.since;
    const isTimeLocked = timeSinceLastChange < (this.params.minStageLockMins * 60 * 1000);
    const isConfidenceLocked = currentState.confidence >= 0.7; // 置信度高于70%才锁定
    const isLocked = isTimeLocked && isConfidenceLocked;

    // 确定新阶段（基于当前阶段和流转规则）
    let newStage = SmartMoneyStage.NEUTRAL;
    let confidence = 0.2;

    // 获取当前阶段允许的转换
    const allowedTransitions = STAGE_TRANSITIONS[currentState.stage] || [];

    // 按照优先级检查允许的转换
    if (allowedTransitions.includes(SmartMoneyStage.MARKDOWN) && markdnScore >= this.params.minMarkdownScore) {
      newStage = SmartMoneyStage.MARKDOWN;
      confidence = Math.min(1, markdnScore / 4);
    } else if (allowedTransitions.includes(SmartMoneyStage.MARKUP) && markupScore >= this.params.minMarkupScore) {
      newStage = SmartMoneyStage.MARKUP;
      confidence = Math.min(1, markupScore / 4);
    } else if (allowedTransitions.includes(SmartMoneyStage.DISTRIBUTION) && distScore >= this.params.minDistributionScore) {
      newStage = SmartMoneyStage.DISTRIBUTION;
      confidence = Math.min(1, distScore / 3);
    } else if (allowedTransitions.includes(SmartMoneyStage.ACCUMULATION) && accScore >= this.params.minAccumulationScore) {
      newStage = SmartMoneyStage.ACCUMULATION;
      confidence = Math.min(1, accScore / 4);
    } else if (allowedTransitions.includes(SmartMoneyStage.NEUTRAL)) {
      // 如果没有其他阶段满足条件，可以转换到中性
      newStage = SmartMoneyStage.NEUTRAL;
      confidence = 0.1;
    }

    // 检查是否需要强制转换阶段
    const forcedStage = this.shouldForceTransition(symbol, currentState.stage);
    if (forcedStage) {
      newStage = forcedStage;
      confidence = 0.8; // 强制转换给予较高置信度
      logger.info(`[四阶段确定] ${symbol}: 强制转换到 ${newStage}`);
    }

    // 调试日志：记录阶段确定过程
    logger.info(`[四阶段确定] ${symbol}: 当前=${currentState.stage}, 新阶段=${newStage}, 置信度=${confidence.toFixed(3)}, 锁定=${isLocked}, 强制=${!!forcedStage}`);

    // 检查阶段流转是否合法（已经在上面检查过了）
    const isValidTransition = true; // 因为newStage已经基于allowedTransitions确定

    // 更新状态
    if (newStage !== currentState.stage && (!isLocked || isValidTransition)) {
      // 阶段变化且（未锁定或允许流转）
      this.stateMap.set(symbol, {
        stage: newStage,
        since: now,
        confidence,
        reasons,
        scores: { accScore, markupScore, distScore, markdnScore }
      });

      // 更新循环管理信息
      this.updateCycleInfo(symbol, newStage);

      // 保存状态到数据库
      this.saveStatesToDatabase();
    } else {
      // 保持当前阶段，更新置信度
      this.stateMap.set(symbol, {
        ...currentState,
        confidence: Math.max(0.05, confidence),
        reasons,
        scores: { accScore, markupScore, distScore, markdnScore }
      });
      newStage = currentState.stage;
    }

    return {
      stage: newStage,
      confidence: this.stateMap.get(symbol).confidence,
      reasons,
      scores: { accScore, markupScore, distScore, markdnScore }
    };
  }

  /**
   * 保存检测结果到数据库
   * @private
   */
  async saveDetectionResult(symbol, stageResult, indicators, largeOrders) {
    try {
      // 使用现有的large_order_detection_results表存储结果
      const sql = `
        INSERT INTO large_order_detection_results 
        (symbol, timestamp, final_action, buy_score, sell_score, cvd_cum, oi, oi_change_pct, 
         spoof_count, tracked_entries_count, detection_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        final_action = VALUES(final_action),
        buy_score = VALUES(buy_score),
        sell_score = VALUES(sell_score),
        cvd_cum = VALUES(cvd_cum),
        detection_data = VALUES(detection_data),
        timestamp = VALUES(timestamp)
      `;

      const detectionData = JSON.stringify({
        stage: stageResult.stage,
        confidence: stageResult.confidence,
        reasons: stageResult.reasons,
        scores: stageResult.scores,
        indicators,
        largeOrders: largeOrders.length
      });

      await this.database.pool.query(sql, [
        symbol,
        Date.now(),
        this.actionMapping[stageResult.stage],
        stageResult.scores.markupScore + stageResult.scores.accScore, // 买入得分
        stageResult.scores.markdnScore + stageResult.scores.distScore, // 卖出得分
        indicators.cvdZ * 1000000, // CVD累计（模拟）
        indicators.obi,
        indicators.obiZ * 100, // OI变化百分比
        0, // spoof_count
        largeOrders.length, // tracked_entries_count
        detectionData
      ]);

    } catch (error) {
      logger.error(`[四阶段聪明钱] 保存${symbol}检测结果失败:`, error);
    }
  }

  /**
   * 获取所有交易对的当前状态
   */
  getAllStates() {
    const states = {};
    for (const [symbol, state] of this.stateMap.entries()) {
      states[symbol] = {
        ...state,
        action: this.actionMapping[state.stage]
      };
    }
    return states;
  }

  /**
   * 更新参数配置
   */
  async updateParameters(newParams) {
    try {
      for (const [key, value] of Object.entries(newParams)) {
        if (key in this.params) {
          this.params[key] = value;

          // 保存到数据库
          await this.database.pool.query(`
            INSERT INTO strategy_params (param_name, param_value, param_type, category, description)
            VALUES (?, ?, ?, 'four_phase_smart_money', '四阶段聪明钱参数')
            ON DUPLICATE KEY UPDATE param_value = VALUES(param_value)
          `, [`fpsm_${key}`, String(value), typeof value]);
        }
      }

      logger.info('[四阶段聪明钱] 参数更新完成');
    } catch (error) {
      logger.error('[四阶段聪明钱] 参数更新失败:', error);
    }
  }

  /**
   * 分析趋势
   * @param {Object} marketData - 市场数据
   * @param {Object} indicators - 技术指标
   * @returns {Object} 趋势分析结果
   */
  analyzeTrend(marketData, indicators) {
    try {
      const { klines15m, klines1h, klines4h } = marketData;

      // 分析多时间框架趋势
      const trends = {
        '15m': this.analyzeTimeframeTrend(klines15m, '15m'),
        '1h': this.analyzeTimeframeTrend(klines1h, '1h'),
        '4h': this.analyzeTimeframeTrend(klines4h, '4h')
      };

      // 综合趋势判断
      const short = trends['15m'].direction;
      const medium = trends['1h'].direction;
      const long = trends['4h'].direction;

      // 趋势一致性判断
      const aligned = (short === medium && medium === long) && short !== 0;

      // 趋势强度（基于多个时间框架的确认）
      const strength = this.calculateTrendStrength(trends);

      return {
        aligned: aligned,
        short: short,
        medium: medium,
        long: long,
        strength: strength,
        timeframes: trends,
        summary: this.getTrendSummary(trends, aligned)
      };
    } catch (error) {
      logger.error('[四阶段聪明钱] 趋势分析失败:', error);
      return {
        aligned: false,
        short: 0,
        medium: 0,
        long: 0,
        strength: 0,
        timeframes: {},
        summary: '趋势分析失败'
      };
    }
  }

  /**
   * 分析单个时间框架的趋势
   * @param {Array} klines - K线数据
   * @param {string} timeframe - 时间框架
   * @returns {Object} 趋势结果
   */
  analyzeTimeframeTrend(klines, timeframe) {
    if (!klines || klines.length < 20) {
      return { direction: 0, strength: 0, ema: null };
    }

    try {
      const closes = klines.map(k => parseFloat(k[4]));
      const highs = klines.map(k => parseFloat(k[2]));
      const lows = klines.map(k => parseFloat(k[3]));

      // 计算EMA
      const ema20 = TechnicalIndicators.calculateEMA(closes, 20);
      const ema50 = TechnicalIndicators.calculateEMA(closes, 50);

      const currentPrice = closes[closes.length - 1];
      const ema20Value = ema20[ema20.length - 1];
      const ema50Value = ema50[ema50.length - 1];

      // 趋势方向判断
      let direction = 0;
      if (currentPrice > ema20Value && ema20Value > ema50Value) {
        direction = 1; // 上升趋势
      } else if (currentPrice < ema20Value && ema20Value < ema50Value) {
        direction = -1; // 下降趋势
      }

      // 趋势强度计算（基于价格与EMA的距离）
      const strength = direction !== 0 ?
        Math.abs((currentPrice - ema50Value) / ema50Value) * 100 : 0;

      return {
        direction: direction,
        strength: strength,
        ema: {
          ema20: ema20Value,
          ema50: ema50Value
        },
        price: currentPrice
      };
    } catch (error) {
      logger.error(`[四阶段聪明钱] ${timeframe}趋势分析失败:`, error);
      return { direction: 0, strength: 0, ema: null };
    }
  }

  /**
   * 计算趋势强度
   * @param {Object} trends - 各时间框架趋势
   * @returns {number} 综合趋势强度
   */
  calculateTrendStrength(trends) {
    const weights = { '15m': 0.2, '1h': 0.3, '4h': 0.5 };
    let totalStrength = 0;
    let totalWeight = 0;

    for (const [timeframe, trend] of Object.entries(trends)) {
      if (trend && trend.strength !== undefined) {
        totalStrength += trend.strength * weights[timeframe];
        totalWeight += weights[timeframe];
      }
    }

    return totalWeight > 0 ? totalStrength / totalWeight : 0;
  }

  /**
   * 获取趋势摘要
   * @param {Object} trends - 各时间框架趋势
   * @param {boolean} aligned - 是否对齐
   * @returns {string} 趋势摘要
   */
  getTrendSummary(trends, aligned) {
    if (!aligned) {
      return '趋势分歧';
    }

    const { '4h': longTerm } = trends;
    if (longTerm && longTerm.direction === 1) {
      return '多头趋势';
    } else if (longTerm && longTerm.direction === -1) {
      return '空头趋势';
    } else {
      return '震荡趋势';
    }
  }

  /**
   * 从数据库加载状态
   */
  async loadStatesFromDatabase() {
    try {
      // 创建状态表（如果不存在）
      await this.database.pool.query(`
        CREATE TABLE IF NOT EXISTS four_phase_states (
          symbol VARCHAR(20) PRIMARY KEY,
          stage VARCHAR(20) NOT NULL,
          since BIGINT NOT NULL,
          confidence DECIMAL(5,3) NOT NULL,
          reasons JSON,
          scores JSON,
          cycle_phase INT DEFAULT 0,
          cycle_start_time BIGINT DEFAULT 0,
          cycle_count INT DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      // 加载状态
      const [rows] = await this.database.pool.query(`
        SELECT symbol, stage, since, confidence, reasons, scores, 
               cycle_phase, cycle_start_time, cycle_count
        FROM four_phase_states
      `);

      for (const row of rows) {
        // 恢复状态
        this.stateMap.set(row.symbol, {
          stage: row.stage,
          since: row.since,
          confidence: row.confidence,
          reasons: row.reasons ? JSON.parse(row.reasons) : [],
          scores: row.scores ? JSON.parse(row.scores) : {}
        });

        // 恢复循环管理信息
        this.cycleMap.set(row.symbol, {
          currentPhase: row.cycle_phase,
          phaseStartTime: row.cycle_start_time,
          cycleCount: row.cycle_count
        });
      }

      logger.info(`[四阶段聪明钱] 从数据库加载了${rows.length}个交易对的状态`);
    } catch (error) {
      logger.warn('[四阶段聪明钱] 加载状态失败，使用默认状态:', error.message);
    }
  }

  /**
   * 保存状态到数据库
   */
  async saveStatesToDatabase() {
    try {
      for (const [symbol, state] of this.stateMap) {
        const cycleInfo = this.cycleMap.get(symbol) || {
          currentPhase: 0,
          phaseStartTime: Date.now(),
          cycleCount: 0
        };

        await this.database.pool.query(`
          INSERT INTO four_phase_states 
          (symbol, stage, since, confidence, reasons, scores, 
           cycle_phase, cycle_start_time, cycle_count)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          stage = VALUES(stage),
          since = VALUES(since),
          confidence = VALUES(confidence),
          reasons = VALUES(reasons),
          scores = VALUES(scores),
          cycle_phase = VALUES(cycle_phase),
          cycle_start_time = VALUES(cycle_start_time),
          cycle_count = VALUES(cycle_count)
        `, [
          symbol,
          state.stage,
          state.since,
          state.confidence,
          JSON.stringify(state.reasons || []),
          JSON.stringify(state.scores || {}),
          cycleInfo.currentPhase,
          cycleInfo.phaseStartTime,
          cycleInfo.cycleCount
        ]);
      }
    } catch (error) {
      logger.error('[四阶段聪明钱] 保存状态失败:', error);
    }
  }

  /**
   * 定期保存状态（每5分钟）
   */
  startStatePersistence() {
    setInterval(() => {
      this.saveStatesToDatabase();
    }, 5 * 60 * 1000); // 5分钟
  }
}

module.exports = { FourPhaseSmartMoneyDetector, SmartMoneyStage };
