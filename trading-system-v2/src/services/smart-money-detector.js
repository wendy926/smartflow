/**
 * 聪明钱检测服务
 * 基于smartmoney.md实现庄家动作信号检测
 * 复用现有Binance API和技术指标计算
 * 
 * @module smart-money-detector
 */

const { getBinanceAPI } = require('../api/binance-api-singleton');
const TechnicalIndicators = require('../utils/technical-indicators');
const logger = require('../utils/logger');

/**
 * 聪明钱检测器
 * 检测吸筹、拉升、派发、砸盘四种庄家动作
 */
class SmartMoneyDetector {
  constructor(database) {
    this.database = database;
    this.binanceAPI = getBinanceAPI();

    // 状态存储（内存，实时计算，不存数据库）
    this.state = new Map();

    // 默认参数（可从数据库加载）
    this.params = {
      klineInterval: '15m',
      klineLimit: 200,
      cvdWindowHours: 4,
      refreshIntervalSec: 900, // 15分钟
      obiTopN: 20,
      dynWindow: 12,
      thresholds: {
        obiZ: 1.0,
        cvdZ: 0.8,
        oiZ: 0.8,
        volZ: 0.8
      }
    };
  }

  /**
   * 初始化检测器
   */
  async initialize() {
    try {
      // 从数据库加载参数
      await this.loadParams();

      // 从数据库加载监控列表
      const watchList = await this.loadWatchList();

      logger.info(`聪明钱检测器初始化: ${watchList.length}个交易对`);

      return watchList;
    } catch (error) {
      logger.error(`聪明钱检测器初始化失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 从数据库加载参数
   * @private
   */
  async loadParams() {
    try {
      const query = `
        SELECT param_name, param_value, param_type
        FROM strategy_params
        WHERE category = 'smart_money' AND is_active = 1
      `;

      const rows = await this.database.query(query);

      rows.forEach(row => {
        const value = this._parseValue(row.param_value, row.param_type);
        const key = row.param_name.replace('sm_', '').replace(/_/g, '');

        // 映射参数名
        if (row.param_name.startsWith('sm_thresh_')) {
          const threshKey = row.param_name.replace('sm_thresh_', '').replace(/_z/, 'Z');
          this.params.thresholds[threshKey] = value;
        } else {
          // 驼峰命名映射
          const mappings = {
            'klineinterval': 'klineInterval',
            'klinelimit': 'klineLimit',
            'cvdwindowhours': 'cvdWindowHours',
            'refreshintervalsec': 'refreshIntervalSec',
            'obitopn': 'obiTopN',
            'dynwindow': 'dynWindow'
          };
          this.params[mappings[key] || key] = value;
        }
      });

      logger.debug(`聪明钱参数已加载: ${JSON.stringify(this.params)}`);
    } catch (error) {
      logger.warn(`加载聪明钱参数失败，使用默认值: ${error.message}`);
    }
  }

  /**
   * 从数据库加载监控列表
   */
  async loadWatchList() {
    try {
      const query = `
        SELECT symbol, notes
        FROM smart_money_watch_list
        WHERE is_active = 1
        ORDER BY is_default DESC, symbol ASC
      `;

      const rows = await this.database.query(query);

      return rows.map(row => row.symbol);
    } catch (error) {
      logger.error(`加载监控列表失败: ${error.message}`);
      // 返回默认列表
      return ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
    }
  }

  /**
   * 添加监控交易对
   * 
   * @param {string} symbol - 交易对符号
   * @param {string} addedBy - 添加者
   * @returns {Promise<boolean>} 是否成功
   */
  async addToWatchList(symbol, addedBy = 'user') {
    try {
      const query = `
        INSERT INTO smart_money_watch_list (symbol, is_active, is_default, added_by)
        VALUES (?, 1, 0, ?)
        ON DUPLICATE KEY UPDATE
          is_active = 1,
          updated_at = CURRENT_TIMESTAMP
      `;

      await this.database.query(query, [symbol.toUpperCase(), addedBy]);
      logger.info(`聪明钱监控已添加: ${symbol}`);

      return true;
    } catch (error) {
      logger.error(`添加监控失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 移除监控交易对（软删除）
   * 
   * @param {string} symbol - 交易对符号
   * @returns {Promise<boolean>} 是否成功
   */
  async removeFromWatchList(symbol) {
    try {
      const query = `
        UPDATE smart_money_watch_list
        SET is_active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE symbol = ?
      `;

      await this.database.query(query, [symbol.toUpperCase()]);
      logger.info(`聪明钱监控已移除: ${symbol}`);

      return true;
    } catch (error) {
      logger.error(`移除监控失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 检测单个交易对的聪明钱动作
   * 
   * @param {string} symbol - 交易对
   * @returns {Promise<Object>} 检测结果
   */
  async detectSmartMoney(symbol) {
    try {
      // 1. 获取所需数据（复用现有API）
      const [klines15m, klines1h, klines4h, depth, oi, funding] = await Promise.all([
        this.binanceAPI.getKlines(symbol, this.params.klineInterval, this.params.klineLimit),
        this.binanceAPI.getKlines(symbol, '1h', 100),
        this.binanceAPI.getKlines(symbol, '4h', 100),
        this.binanceAPI.getDepth(symbol, 50),
        this.binanceAPI.getOpenInterest(symbol).catch(() => null),
        this.binanceAPI.getFundingRate(symbol).catch(() => null)
      ]);

      // 2. 初始化状态（如果不存在）
      if (!this.state.has(symbol)) {
        this.state.set(symbol, {
          obiSeries: [],
          volSeries: [],
          oiSeries: [],
          cvdSeries: [],
          prevOI: null
        });
      }

      const state = this.state.get(symbol);

      // 3. 计算各项指标
      const obi = this._calculateOBI(depth, this.params.obiTopN);
      const cvd = this._calculateCVD(klines15m);
      const volume = parseFloat(klines15m[klines15m.length - 1][5]);
      const currentOI = oi ? parseFloat(oi.openInterest) : null;

      // 更新状态序列 - 传入klines15m用于CVD计算
      this._updateSeriesState(state, obi, volume, currentOI, cvd);

      // 4. 计算短期趋势
      const trend = this._computeShortTermTrend(klines15m, klines1h);

      // 5. 计算动态阈值
      const dynThresh = this._calculateDynamicThresholds(state);

      // 6. 检测庄家动作
      const action = this._detectAction(
        symbol,
        klines15m,
        state,
        dynThresh,
        trend,
        currentOI,
        state.prevOI,
        funding
      );

      // 更新prevOI
      if (currentOI !== null) {
        state.prevOI = currentOI;
      }

      return action;
    } catch (error) {
      logger.error(`聪明钱检测失败 [${symbol}]: ${error.message}`);
      return {
        symbol,
        action: 'ERROR',
        confidence: 0,
        reason: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * 批量检测多个交易对
   * 
   * @param {Array<string>} symbols - 交易对数组
   * @returns {Promise<Array>} 检测结果数组
   */
  async detectBatch(symbols = null) {
    try {
      // 如果未指定，从数据库加载
      if (!symbols) {
        symbols = await this.loadWatchList();
      }

      logger.info(`开始批量检测聪明钱: ${symbols.length}个交易对`);

      const results = [];

      // 顺序执行，避免API速率限制
      for (const symbol of symbols) {
        try {
          const result = await this.detectSmartMoney(symbol);
          results.push(result);

          // 间隔200ms避免速率限制
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          logger.error(`检测${symbol}失败: ${error.message}`);
          results.push({
            symbol,
            action: 'ERROR',
            confidence: 0,
            reason: error.message,
            timestamp: new Date()
          });
        }
      }

      logger.info(`批量检测完成: ${results.length}个结果`);
      return results;
    } catch (error) {
      logger.error(`批量检测失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 计算OBI（Order Book Imbalance）
   * @private
   */
  _calculateOBI(depth, topN = 20) {
    if (!depth || !depth.bids || !depth.asks) return 0;

    const bids = depth.bids.slice(0, topN)
      .reduce((sum, [price, qty]) => sum + parseFloat(qty), 0);

    const asks = depth.asks.slice(0, topN)
      .reduce((sum, [price, qty]) => sum + parseFloat(qty), 0);

    return bids - asks; // 正值表示买盘强，负值表示卖盘强
  }

  /**
   * 计算CVD（Cumulative Volume Delta）
   * 使用价格变化推断买卖方向
   * @private
   */
  _calculateCVD(klines) {
    if (!klines || klines.length < 2) return 0;

    let cvd = 0;

    // 取最近50根K线计算
    const recentKlines = klines.slice(-50);

    for (let i = 1; i < recentKlines.length; i++) {
      const curr = recentKlines[i];
      const prev = recentKlines[i - 1];

      const priceChange = parseFloat(curr[4]) - parseFloat(prev[4]); // 收盘价变化
      const volume = parseFloat(curr[5]);

      // 价格上涨 = 买入主导，价格下跌 = 卖出主导
      if (priceChange > 0) {
        cvd += volume;
      } else if (priceChange < 0) {
        cvd -= volume;
      }
    }

    return cvd;
  }

  /**
   * 计算短期趋势
   * @private
   */
  _computeShortTermTrend(klines15m, klines1h) {
    const closes15m = klines15m.map(k => parseFloat(k[4]));
    const closes1h = klines1h.map(k => parseFloat(k[4]));

    const ema15_20 = TechnicalIndicators.calculateEMA(closes15m, 20);
    const ema15_50 = TechnicalIndicators.calculateEMA(closes15m, 50);
    const ema1h_20 = TechnicalIndicators.calculateEMA(closes1h, 20);

    const ema15_20_last = ema15_20[ema15_20.length - 1];
    const ema15_50_last = ema15_50[ema15_50.length - 1];
    const ema1h_20_last = ema1h_20[ema1h_20.length - 1];
    const currentPrice = closes1h[closes1h.length - 1];

    const shortTrend = ema15_20_last > ema15_50_last ? 1 : (ema15_20_last < ema15_50_last ? -1 : 0);
    const medTrend = currentPrice > ema1h_20_last ? 1 : -1;

    return {
      shortTrend,
      medTrend,
      ema15_20: ema15_20_last,
      ema15_50: ema15_50_last,
      ema1h_20: ema1h_20_last,
      aligned: shortTrend === medTrend
    };
  }

  /**
   * 计算动态阈值
   * @private
   */
  _calculateDynamicThresholds(state) {
    const obiMean = this._sma(state.obiSeries);
    const obiStd = this._std(state.obiSeries);
    const volMean = this._sma(state.volSeries);
    const volStd = this._std(state.volSeries);
    const oiMean = this._sma(state.oiSeries);
    const oiStd = this._std(state.oiSeries);

    return {
      obiMean,
      obiStd,
      volMean,
      volStd,
      oiMean,
      oiStd
    };
  }

  /**
   * 检测庄家动作
   * @private
   */
  _detectAction(symbol, klines15m, state, dynThresh, trend, currentOI, prevOI, funding) {
    if (!klines15m || klines15m.length < 5) {
      return {
        symbol,
        action: 'UNKNOWN',
        confidence: 0,
        reason: '数据不足',
        timestamp: new Date()
      };
    }

    const last = klines15m[klines15m.length - 1];
    const prev = klines15m[klines15m.length - 2];

    const priceChange = parseFloat(last[4]) - parseFloat(prev[4]);
    const volume = parseFloat(last[5]);

    // 计算Z-scores
    const obiNow = state.obiSeries[state.obiSeries.length - 1] || 0;
    const obiZ = dynThresh.obiStd ? (obiNow - dynThresh.obiMean) / dynThresh.obiStd : 0;

    const cvdNow = state.cvdSeries[state.cvdSeries.length - 1] || 0;
    const cvdMean = this._sma(state.cvdSeries);
    const cvdStd = this._std(state.cvdSeries);
    const cvdZ = cvdStd ? (cvdNow - cvdMean) / cvdStd : 0;

    const oiChange = currentOI && prevOI ? currentOI - prevOI : 0;
    const oiZ = dynThresh.oiStd ? (oiChange - dynThresh.oiMean) / dynThresh.oiStd : 0;

    const volZ = dynThresh.volStd ? (volume - dynThresh.volMean) / dynThresh.volStd : 0;

    // 计算综合分数
    let score = 0;
    const reasons = [];

    // 趋势对齐
    if (trend.shortTrend === 1 && priceChange > 0) {
      score += 0.2;
      reasons.push('短期趋势看多');
    } else if (trend.shortTrend === -1 && priceChange < 0) {
      score += 0.2;
      reasons.push('短期趋势看空');
    } else {
      score -= 0.1;
      reasons.push('趋势不明');
    }

    // OBI信号
    if (obiZ > this.params.thresholds.obiZ) {
      score += 0.2;
      reasons.push(`OBI多头(${obiZ.toFixed(2)}σ)`);
    } else if (obiZ < -this.params.thresholds.obiZ) {
      score -= 0.2;
      reasons.push(`OBI空头(${obiZ.toFixed(2)}σ)`);
    }

    // CVD信号
    if (cvdZ > this.params.thresholds.cvdZ) {
      score += 0.25;
      reasons.push(`CVD买盘强(${cvdZ.toFixed(2)}σ)`);
    } else if (cvdZ < -this.params.thresholds.cvdZ) {
      score -= 0.25;
      reasons.push(`CVD卖盘强(${cvdZ.toFixed(2)}σ)`);
    }

    // OI变化信号
    if (oiZ > this.params.thresholds.oiZ) {
      score += 0.15;
      reasons.push(`OI增加(${oiZ.toFixed(2)}σ)`);
    } else if (oiZ < -this.params.thresholds.oiZ) {
      score -= 0.15;
      reasons.push(`OI减少(${oiZ.toFixed(2)}σ)`);
    }

    // 成交量异常
    if (volZ > this.params.thresholds.volZ) {
      score += 0.1;
      reasons.push(`成交量异常(${volZ.toFixed(2)}σ)`);
    }

    // 根据分数和市场状态判断动作
    const action = this._mapScoreToAction(score, priceChange, cvdZ, oiChange, obiZ);
    const confidence = Math.min(1, Math.max(0, Math.abs(score)));

    // 趋势不对齐时降低置信度
    const finalConfidence = trend.aligned ? confidence : confidence * 0.6;

    return {
      symbol,
      action,
      confidence: parseFloat(finalConfidence.toFixed(2)),
      reason: reasons.join(', '),
      indicators: {
        price: parseFloat(last[4]),
        priceChange: parseFloat(priceChange.toFixed(4)),
        obi: parseFloat(obiNow.toFixed(2)),
        obiZ: parseFloat(obiZ.toFixed(2)),
        cvd: parseFloat(cvdNow.toFixed(2)),
        cvdZ: parseFloat(cvdZ.toFixed(2)),
        oiChange: parseFloat(oiChange.toFixed(2)),
        oiZ: parseFloat(oiZ.toFixed(2)),
        volZ: parseFloat(volZ.toFixed(2)),
        fundingRate: funding ? parseFloat(funding) : null  // funding直接是数字
      },
      trend: {
        short: trend.shortTrend,
        med: trend.medTrend,
        aligned: trend.aligned
      },
      timestamp: new Date()
    };
  }

  /**
   * 将分数映射到动作（只返回4类庄家动作）
   * @private
   */
  _mapScoreToAction(score, priceChange, cvdZ, oiChange, obiZ) {
    // 买方主导（score > 0 或 cvdZ > 0 或 obiZ > 0）
    const isBullish = score > 0 || cvdZ > 0 || obiZ > 0;
    
    if (isBullish) {
      // 价格上涨明显 = 拉升
      if (priceChange > 0 && (cvdZ > 0.5 || obiZ > 0.5)) {
        return '拉升'; // MARKUP - 持续推高价格，成交量放大
      }
      // 价格不涨或小涨 + 持仓增加 = 吸筹
      else {
        return '吸筹'; // ACCUMULATE - 低价买入，价格不涨，OI增加
      }
    }
    // 卖方主导（score < 0 或 cvdZ < 0 或 obiZ < 0）
    else {
      // 价格下跌明显 = 砸盘
      if (priceChange < 0 && (cvdZ < -0.5 || obiZ < -0.5)) {
        return '砸盘'; // MARKDOWN - 打压价格，快速下跌
      }
      // 价格不跌或小跌 + 持仓增加 = 派发
      else {
        return '派发'; // DISTRIBUTION - 高位出货，价格滞涨，OI增加
      }
    }
  }

  /**
   * 更新状态序列
   * @private
   */
  _updateSeriesState(state, obi, volume, currentOI, cvd) {
    // 更新OBI序列
    state.obiSeries.push(obi);
    if (state.obiSeries.length > this.params.dynWindow) {
      state.obiSeries.shift();
    }

    // 更新成交量序列
    state.volSeries.push(volume);
    if (state.volSeries.length > this.params.dynWindow) {
      state.volSeries.shift();
    }

    // 更新OI序列
    if (currentOI !== null) {
      state.oiSeries.push(currentOI);
      if (state.oiSeries.length > this.params.dynWindow) {
        state.oiSeries.shift();
      }
    }

    // 更新CVD序列
    state.cvdSeries.push(cvd);
    if (state.cvdSeries.length > this.params.dynWindow) {
      state.cvdSeries.shift();
    }
  }

  /**
   * 计算简单移动平均
   * @private
   */
  _sma(arr) {
    if (!arr || arr.length === 0) return 0;
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
  }

  /**
   * 计算标准差
   * @private
   */
  _std(arr) {
    if (!arr || arr.length === 0) return 0;
    const mean = this._sma(arr);
    const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
    return Math.sqrt(variance);
  }

  /**
   * 解析参数值
   * @private
   */
  _parseValue(value, type) {
    switch (type) {
      case 'number':
        return parseFloat(value);
      case 'boolean':
        return value === 'true' || value === '1';
      default:
        return value;
    }
  }
}

module.exports = SmartMoneyDetector;


