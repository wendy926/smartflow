/**
 * LargeOrderDetector - 大额挂单检测器（主服务）
 * 整合 OrderTracker、OrderClassifier、SignalAggregator
 * 实现完整的大额挂单监控逻辑
 * 
 * @module LargeOrderDetector
 */

const logger = require('../../utils/logger');
const OrderTracker = require('./tracker');
const { OrderClassifier } = require('./classifier');
const { SignalAggregator } = require('./aggregator');
const WebSocketManager = require('./websocket-manager');
const { SwanDetector } = require('./swan-detector');
const { TrapDetector } = require('../smart-money/trap-detector');

class LargeOrderDetector {
  /**
   * @param {Object} binanceAPI - Binance API 实例
   * @param {Object} database - 数据库实例
   */
  constructor(binanceAPI, database) {
    this.binanceAPI = binanceAPI;
    this.database = database;
    
    // 加载配置
    this.config = {
      largeUSDThreshold: 100000000,    // 100M USD
      pollIntervalMs: 15000,            // 15秒（仅用于CVD/OI更新）
      depthLimit: 1000,
      topN: 50,
      persistSnapshots: 3,
      spoofWindowMs: 3000,              // 3秒
      impactRatioThreshold: 0.25,
      cvdWindowMs: 14400000,            // 4小时
      priceTolerance: 0.0005,           // 0.05%
      maxTrackedEntries: 100
    };
    
    // 初始化子模块
    this.tracker = new OrderTracker(this.config);
    this.classifier = new OrderClassifier(this.config);
    this.aggregator = new SignalAggregator(this.config);
    this.wsManager = new WebSocketManager(); // 新增WebSocket管理器
    this.swanDetector = null; // 黑天鹅检测器（延迟初始化）
    this.trapDetector = new TrapDetector(); // 诱多诱空检测器
    
    // 状态存储（按symbol）
    this.state = new Map(); // symbol -> { cvdSeries, cvdCum, prevOI, oi, priceHistory: [] }
    
    // CVD/OI更新定时器（低频）
    this.updateIntervals = new Map(); // symbol -> intervalId
    
    logger.info('[LargeOrderDetector] 初始化完成（WebSocket模式）');
  }

  /**
   * 从数据库加载配置
   */
  async loadConfig() {
    try {
      const sql = 'SELECT config_key, config_value, config_type FROM large_order_config';
      const rows = await this.database.query(sql);
      
      rows.forEach(row => {
        const key = row.config_key;
        let value = row.config_value;
        
        if (row.config_type === 'NUMBER') {
          value = parseFloat(value);
        } else if (row.config_type === 'BOOLEAN') {
          value = value === 'true' || value === '1';
        }
        
        // 映射到配置对象
        const configMap = {
          'LARGE_USD_THRESHOLD': 'largeUSDThreshold',
          'POLL_INTERVAL_MS': 'pollIntervalMs',
          'DEPTH_LIMIT': 'depthLimit',
          'TOPN': 'topN',
          'PERSIST_SNAPSHOTS': 'persistSnapshots',
          'SPOOF_WINDOW_MS': 'spoofWindowMs',
          'IMPACT_RATIO_THRESHOLD': 'impactRatioThreshold',
          'CVD_WINDOW_MS': 'cvdWindowMs',
          'PRICE_TOLERANCE': 'priceTolerance',
          'MAX_TRACKED_ENTRIES': 'maxTrackedEntries'
        };
        
        if (configMap[key]) {
          this.config[configMap[key]] = value;
        }
      });
      
      // 更新子模块配置
      this.tracker.config = this.config;
      this.classifier.config = this.config;
      this.aggregator.config = this.config;
      
      logger.info('[LargeOrderDetector] 配置加载完成', this.config);
    } catch (error) {
      logger.error('[LargeOrderDetector] 配置加载失败', { error: error.message });
    }
  }

  /**
   * 启动监控
   * @param {Array<string>} symbols - 交易对列表
   */
  async start(symbols) {
    await this.loadConfig();
    
    for (const symbol of symbols) {
      this.startMonitoring(symbol);
    }
    
    logger.info('[LargeOrderDetector] 监控已启动', { symbols });
  }

  /**
   * 启动单个交易对的监控（WebSocket模式）
   * @param {string} symbol - 交易对
   */
  startMonitoring(symbol) {
    if (this.updateIntervals.has(symbol)) {
      logger.warn('[LargeOrderDetector] 监控已存在', { symbol });
      return;
    }
    
    // 初始化状态
    if (!this.state.has(symbol)) {
      this.state.set(symbol, {
        cvdSeries: [],
        cvdCum: 0,
        prevOI: null,
        oi: null,
        priceHistory: []  // 价格历史（5分钟窗口）
      });
    }
    
    // 订阅depth WebSocket
    this.wsManager.subscribe(symbol, (sym, orderbook, timestamp) => {
      this._handleDepthUpdate(sym, orderbook, timestamp).catch(err => {
        logger.error('[LargeOrderDetector] 处理depth更新失败', { symbol: sym, error: err.message });
      });
    });
    
    // 启动CVD/OI更新定时器（低频，15秒）
    const cvdOIIntervalId = setInterval(() => {
      this._updateCVDAndOI(symbol, Date.now()).catch(err => {
        logger.error('[LargeOrderDetector] 更新CVD/OI失败', { symbol, error: err.message });
      });
    }, this.config.pollIntervalMs);
    
    // 立即执行一次CVD/OI更新
    this._updateCVDAndOI(symbol, Date.now()).catch(err => {
      logger.error('[LargeOrderDetector] 首次CVD/OI更新失败', { symbol, error: err.message });
    });
    
    // ✅ 新增：检测并保存到数据库的定时器（1小时）
    const detectIntervalId = setInterval(async () => {
      try {
        logger.info(`[LargeOrderDetector] 定时检测并保存 ${symbol}`);
        const result = await this.detect(symbol);
        logger.info(`[LargeOrderDetector] 检测结果已保存到数据库`, { 
          symbol, 
          finalAction: result.finalAction,
          trackedEntries: result.trackedEntriesCount,
          buyScore: result.buyScore?.toFixed(1),
          sellScore: result.sellScore?.toFixed(1)
        });
      } catch (error) {
        logger.error(`[LargeOrderDetector] 定时检测失败`, { symbol, error: error.message });
      }
    }, 3600000);  // 1小时 = 3600000ms
    
    // ✅ 启动10秒后立即执行一次（快速填充数据）
    setTimeout(async () => {
      try {
        logger.info(`[LargeOrderDetector] 首次检测并保存 ${symbol}`);
        const result = await this.detect(symbol);
        logger.info(`[LargeOrderDetector] 首次检测完成`, {
          symbol,
          trackedEntries: result.trackedEntriesCount
        });
      } catch (err) {
        logger.error(`[LargeOrderDetector] 首次检测失败`, { symbol, error: err.message });
      }
    }, 10000);  // 10秒后执行
    
    // 保存所有定时器ID
    this.updateIntervals.set(symbol, { 
      cvdOI: cvdOIIntervalId, 
      detect: detectIntervalId 
    });
    
    logger.info('[LargeOrderDetector] 监控启动完成', { 
      symbol, 
      cvdOIInterval: '15秒', 
      detectInterval: '1小时',
      firstDetect: '10秒后'
    });
  }

  /**
   * 停止监控
   * @param {string} symbol - 交易对（可选，不传则停止所有）
   */
  stopMonitoring(symbol) {
    if (symbol) {
      // 取消WebSocket订阅
      this.wsManager.unsubscribe(symbol);
      
      // 停止所有定时器
      const intervals = this.updateIntervals.get(symbol);
      if (intervals) {
        if (intervals.cvdOI) clearInterval(intervals.cvdOI);     // 清除CVD/OI定时器
        if (intervals.detect) clearInterval(intervals.detect);   // 清除检测定时器
        this.updateIntervals.delete(symbol);
      }
      
      logger.info('[LargeOrderDetector] 已停止监控（WebSocket+定时检测）', { symbol });
    } else {
      // 停止所有监控
      this.wsManager.unsubscribeAll();
      
      this.updateIntervals.forEach((intervals, sym) => {
        if (intervals.cvdOI) clearInterval(intervals.cvdOI);
        if (intervals.detect) clearInterval(intervals.detect);
        logger.info('[LargeOrderDetector] 已停止监控（WebSocket+定时检测）', { symbol: sym });
      });
      this.updateIntervals.clear();
    }
  }

  /**
   * 处理depth更新（WebSocket回调）
   * @private
   */
  async _handleDepthUpdate(symbol, orderbook, timestamp) {
    try {
      // 1. 获取当前价格（使用mid price）
      const bestBid = parseFloat(orderbook.bids[0]?.[0] || 0);
      const bestAsk = parseFloat(orderbook.asks[0]?.[0] || 0);
      const currentPrice = (bestBid + bestAsk) / 2;
      
      if (!currentPrice || currentPrice === 0) {
        logger.warn('[LargeOrderDetector] 无效的价格数据', { symbol });
        return;
      }

      // 更新价格历史（5分钟窗口Swan检测用）
      const state = this.state.get(symbol);
      if (state) {
        state.priceHistory.push({ ts: timestamp, price: currentPrice });
        // 保留5分钟窗口数据
        const windowMs = this.config.SWAN_WINDOW_MS || 300000;
        const cutoff = timestamp - windowMs;
        state.priceHistory = state.priceHistory.filter(p => p.ts >= cutoff);
      }
      
      // 2. 转换为统一格式
      const depthSnapshot = [
        ...orderbook.bids.map(([price, qty]) => ({ side: 'bid', price: parseFloat(price), qty: parseFloat(qty) })),
        ...orderbook.asks.map(([price, qty]) => ({ side: 'ask', price: parseFloat(price), qty: parseFloat(qty) }))
      ];
      
      // 3. 更新追踪器
      const updateResult = this.tracker.update(symbol, depthSnapshot, currentPrice, timestamp);
      
      // 4. 计算影响力比率
      this._calculateImpactRatios(symbol, orderbook);
      
      // 5. 分类挂单
      const trackedEntries = this.tracker.getTrackedEntries(symbol);
      this.classifier.classifyBatch(trackedEntries);
      
      // 6. 如果有新发现或状态变化，记录日志
      if (updateResult.newEntries.length > 0 || updateResult.canceledEntries.length > 0) {
        logger.info('[LargeOrderDetector] 挂单状态变化', {
          symbol,
          new: updateResult.newEntries.length,
          canceled: updateResult.canceledEntries.length,
          total: updateResult.totalTracked
        });
      }
      
    } catch (error) {
      logger.error('[LargeOrderDetector] 处理depth更新失败', { symbol, error: error.message });
    }
  }

  /**
   * 计算影响力比率
   * @private
   */
  _calculateImpactRatios(symbol, depth) {
    const trackedEntries = this.tracker.getTrackedEntries(symbol);
    
    for (const entry of trackedEntries) {
      const topNDepth = entry.side === 'bid' ? depth.bids : depth.asks;
      const topNValue = topNDepth
        .slice(0, this.config.topN)
        .reduce((sum, [price, qty]) => sum + parseFloat(price) * parseFloat(qty), 0);
      
      entry.impactRatio = topNValue > 0 ? entry.valueUSD / topNValue : 0;
    }
  }

  /**
   * 更新 CVD 和 OI
   * @private
   */
  async _updateCVDAndOI(symbol, timestamp) {
    const state = this.state.get(symbol);
    
    try {
      // 获取最近1小时的K线计算CVD增量
      const klines = await this.binanceAPI.getKlines(symbol, '15m', 4);
      if (klines && klines.length > 0) {
        const lastKline = klines[klines.length - 1];
        const volume = parseFloat(lastKline[5]);
        const close = parseFloat(lastKline[4]);
        const open = parseFloat(lastKline[1]);
        
        // 简化CVD计算：close > open 为正，否则为负
        const delta = close > open ? volume : -volume;
        
        state.cvdSeries.push({ ts: timestamp, delta });
        state.cvdCum += delta;
        
        // 清理超出窗口的数据
        const windowStart = timestamp - this.config.cvdWindowMs;
        state.cvdSeries = state.cvdSeries.filter(item => item.ts >= windowStart);
        
        // 重新计算累积值
        state.cvdCum = state.cvdSeries.reduce((sum, item) => sum + item.delta, 0);
      }
      
      // 获取持仓量
      const oiData = await this.binanceAPI.getOpenInterest(symbol);
      if (oiData && oiData.openInterest) {
        state.prevOI = state.oi;
        state.oi = oiData.openInterest;
      }
      
    } catch (error) {
      logger.error('[LargeOrderDetector] 更新CVD/OI失败', { symbol, error: error.message });
    }
  }

  /**
   * 保存检测结果到数据库
   * @private
   */
  async _saveDetectionResult(symbol, timestamp, aggregateResult, trackedEntries, swanResult = null, trapResult = null) {
    try {
      const sql = `
        INSERT INTO large_order_detection_results 
        (symbol, timestamp, final_action, buy_score, sell_score, cvd_cum, oi, oi_change_pct, spoof_count, tracked_entries_count, detection_data,
         swan_alert_level, price_drop_pct, volume_24h, max_order_to_vol24h_ratio, max_order_to_oi_ratio, 
         sweep_detected, sweep_pct, alert_triggers,
         trap_detected, trap_type, trap_confidence, trap_indicators, persistent_orders_count, flash_orders_count, cancel_ratio)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const detectionData = JSON.stringify({
        trackedEntries: trackedEntries.map(e => ({
          side: e.side,
          price: e.price,
          qty: e.qty,
          valueUSD: e.valueUSD,
          classification: e.classification,
          impactRatio: e.impactRatio,
          isPersistent: e.isPersistent,
          isSpoof: e.isSpoof
        }))
      });
      
      await this.database.query(sql, [
        symbol,
        timestamp,
        aggregateResult.finalAction,
        aggregateResult.buyScore,
        aggregateResult.sellScore,
        aggregateResult.cvdCum,
        aggregateResult.oi,
        aggregateResult.oiChangePct,
        aggregateResult.spoofCount,
        aggregateResult.trackedEntriesCount,
        detectionData,
        // Swan扩展字段
        swanResult?.swan_alert_level || 'NONE',
        swanResult?.price_drop_pct || null,
        swanResult?.volume_24h || null,
        swanResult?.max_order_to_vol24h_ratio || null,
        swanResult?.max_order_to_oi_ratio || null,
        swanResult?.sweep_detected || false,
        swanResult?.sweep_pct || null,
        swanResult?.alert_triggers || null,
        // Trap字段
        trapResult?.trap_detected || false,
        trapResult?.trap_type || 'NONE',
        trapResult?.trap_confidence || null,
        trapResult?.trap_indicators || null,
        trapResult?.persistent_orders_count || 0,
        trapResult?.flash_orders_count || 0,
        trapResult?.cancel_ratio || null
      ]);
      
    } catch (error) {
      logger.error('[LargeOrderDetector] 保存数据库失败', { symbol, error: error.message });
    }
  }

  /**
   * 获取检测结果（供API调用）
   * @param {string} symbol - 交易对
   * @returns {Object} 检测结果
   */
  async detect(symbol) {
    try {
      const trackedEntries = this.tracker.getTrackedEntries(symbol);
      const state = this.state.get(symbol) || { cvdCum: 0, oi: null, prevOI: null };
      
      // 确保分类
      this.classifier.classifyBatch(trackedEntries);
      
      // 聚合信号
      const aggregateResult = this.aggregator.aggregate(
        trackedEntries,
        state.cvdCum,
        state.oi,
        state.prevOI
      );

      // Swan黑天鹅检测（新增）
      let swanResult = null;
      if (this.swanDetector && trackedEntries.length > 0) {
        try {
          // 获取24h成交额
          const ticker24hr = await this.binanceAPI.getTicker24hr(symbol);
          const volume24h = ticker24hr ? parseFloat(ticker24hr.quoteVolume) : null;

          swanResult = this.swanDetector.detect({
            trackedEntries,
            volume24h,
            oi: state.oi,
            prevOI: state.prevOI,
            priceHistory: state.priceHistory || []
          });

          // 如果有高危告警，立即记录
          if (swanResult.level === 'CRITICAL' || swanResult.level === 'HIGH') {
            logger.warn(`[SwanDetector] ${swanResult.level}告警`, {
              symbol,
              level: swanResult.level,
              triggers: swanResult.triggers,
              score: swanResult.score
            });
          }
        } catch (error) {
          logger.error('[SwanDetector] 检测失败', { symbol, error: error.message });
        }
      }

      // 诱多诱空检测（新增）
      let trapResult = null;
      if (this.trapDetector && trackedEntries.length > 0) {
        try {
          trapResult = this.trapDetector.detect({
            trackedEntries,
            cvdChange: state.cvdCum,
            oiChange: state.oi && state.prevOI ? state.oi - state.prevOI : 0,
            priceChange: state.priceHistory && state.priceHistory.length >= 2
              ? state.priceHistory[state.priceHistory.length - 1].price - state.priceHistory[0].price
              : 0,
            priceHistory: state.priceHistory || [],
            cvdSeries: state.cvdSeries || [],
            oiSeries: state.oiSeries || []
          });

          // 如果检测到陷阱，记录警告
          if (trapResult.detected) {
            logger.warn(`[TrapDetector] 检测到${trapResult.type}`, {
              symbol,
              type: trapResult.type,
              confidence: trapResult.confidence,
              flashCount: trapResult.indicators.flashCount
            });
          }
        } catch (error) {
          logger.error('[TrapDetector] 检测失败', { symbol, error: error.message });
        }
      }
      
      // 保存到数据库（包含Swan和Trap结果）
      await this._saveDetectionResult(symbol, Date.now(), aggregateResult, trackedEntries, swanResult, trapResult);
      
      return {
        symbol,
        timestamp: Date.now(),
        ...aggregateResult,
        swan: swanResult ? {
          level: swanResult.level,
          triggers: swanResult.triggers,
          score: swanResult.score
        } : null,
        trap: trapResult ? {
          detected: trapResult.detected,
          type: trapResult.type,
          confidence: trapResult.confidence,
          flashCount: trapResult.indicators.flashCount,
          cancelRatio: trapResult.indicators.cancelRatio
        } : null,
        trackedEntries: trackedEntries.map(e => ({
          side: e.side,
          price: e.price,
          qty: e.qty,
          valueUSD: e.valueUSD,
          impactRatio: e.impactRatio,
          classification: e.classification,
          isPersistent: e.isPersistent,
          isSpoof: e.isSpoof,
          wasConsumed: e.wasConsumed,
          createdAt: e.createdAt,
          lastSeenAt: e.lastSeenAt
        }))
      };
    } catch (error) {
      logger.error('[LargeOrderDetector] 检测失败', { symbol, error: error.message });
      throw error;
    }
  }

  /**
   * 获取监控状态
   */
  getMonitoringStatus() {
    const status = {};
    const wsStats = this.wsManager.getStats();
    
    for (const [symbol, state] of this.state.entries()) {
      const trackerStats = this.tracker.getStats(symbol);
      const wsStatus = this.wsManager.getStatus(symbol);
      
      status[symbol] = {
        isMonitoring: this.updateIntervals.has(symbol),
        wsStatus,
        cvdCum: state.cvdCum,
        oi: state.oi,
        trackerStats
      };
    }
    
    status._websocketStats = wsStats;
    return status;
  }
}

module.exports = LargeOrderDetector;

