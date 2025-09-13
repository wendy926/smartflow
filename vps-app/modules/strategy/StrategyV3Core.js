// StrategyV3Core.js - 策略V3核心实现模块

const BinanceAPI = require('../api/BinanceAPI');
const FactorWeightManager = require('./FactorWeightManager');

class StrategyV3Core {
  constructor(database = null) {
    this.database = database;
    this.deltaData = new Map(); // 存储Delta数据
    this.dataMonitor = null; // 将在外部设置
    this.factorWeightManager = new FactorWeightManager(database);
    this.isDestroyed = false; // 标记是否已销毁
  }

  /**
   * 销毁实例，清理资源
   */
  destroy() {
    if (this.isDestroyed) return;

    this.isDestroyed = true;

    // 清理Delta数据
    if (this.deltaData) {
      this.deltaData.clear();
      this.deltaData = null;
    }

    // 清理因子权重管理器
    if (this.factorWeightManager) {
      this.factorWeightManager = null;
    }

    // 注意：不在这里关闭database，因为它可能被其他地方使用
    console.log('🔒 StrategyV3Core 实例已销毁');
  }

  /**
   * 从数据库获取K线数据
   */
  async getKlineDataFromDB(symbol, interval, limit = 250) {
    if (this.isDestroyed) {
      throw new Error('StrategyV3Core 实例已销毁');
    }

    if (!this.database) {
      throw new Error('数据库连接未初始化');
    }

    try {
      const sql = `
        SELECT open_time, close_time, open_price, high_price, low_price, close_price, 
               volume, quote_volume, trades_count, taker_buy_volume, taker_buy_quote_volume
        FROM kline_data 
        WHERE symbol = ? AND interval = ?
        ORDER BY open_time DESC 
        LIMIT ?
      `;

      const results = await this.database.runQuery(sql, [symbol, interval, limit]);

      // 添加调试日志
      console.log(`🔍 获取K线数据 [${symbol}][${interval}]: ${results ? results.length : 0} 条`);
      if (results && results.length > 0) {
        const latestTime = new Date(results[0].open_time);
        console.log(`📅 最新数据时间: ${latestTime.toISOString()}, 收盘价: ${results[0].close_price}`);
      }

      if (!results || results.length === 0) {
        return null;
      }

      // 转换为策略需要的格式
      return results.map(row => [
        row.open_time,           // 0: openTime
        row.open_price,          // 1: open
        row.high_price,          // 2: high
        row.low_price,           // 3: low
        row.close_price,         // 4: close
        row.volume,              // 5: volume
        row.close_time,          // 6: closeTime
        row.quote_volume,        // 7: quoteVolume
        row.trades_count,        // 8: tradesCount
        row.taker_buy_volume,    // 9: takerBuyVolume
        row.taker_buy_quote_volume, // 10: takerBuyQuoteVolume
        0                        // 11: ignore
      ]);
    } catch (error) {
      console.error(`从数据库获取K线数据失败 [${symbol} ${interval}]:`, error);
      return null;
    }
  }

  /**
   * 记录数据质量告警
   */
  async recordDataQualityAlert(symbol, issueType, message, details = null) {
    if (!this.database) return;

    try {
      const sql = `
        INSERT INTO data_quality_issues (symbol, issue_type, severity, message, details)
        VALUES (?, ?, ?, ?, ?)
      `;

      await this.database.runQuery(sql, [
        symbol,
        issueType,
        'WARNING',
        message,
        details ? JSON.stringify(details) : null
      ]);
    } catch (error) {
      console.error('记录数据质量告警失败:', error);
    }
  }

  /**
   * 计算移动平均线
   */
  calculateMA(candles, period = 20) {
    return candles.map((c, i) => {
      if (i < period - 1) return null;
      const sum = candles.slice(i - period + 1, i + 1).reduce((acc, x) => acc + x.close, 0);
      return sum / period;
    });
  }

  /**
   * 计算指数移动平均线
   */
  calculateEMA(candles, period = 20) {
    const multiplier = 2 / (period + 1);
    const ema = [];

    for (let i = 0; i < candles.length; i++) {
      if (i === 0) {
        ema[i] = candles[i].close;
      } else {
        ema[i] = (candles[i].close * multiplier) + (ema[i - 1] * (1 - multiplier));
      }
    }

    return ema;
  }

  /**
   * 计算ADX指标
   */
  calculateADX(candles, period = 14) {
    if (!candles || candles.length < period + 1) return null;

    const TR = [], DMplus = [], DMminus = [];
    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high, low = candles[i].low, closePrev = candles[i - 1].close;
      const highPrev = candles[i - 1].high, lowPrev = candles[i - 1].low;

      const tr = Math.max(high - low, Math.abs(high - closePrev), Math.abs(low - closePrev));
      TR.push(tr);

      const upMove = high - highPrev;
      const downMove = lowPrev - low;

      DMplus.push(upMove > downMove && upMove > 0 ? upMove : 0);
      DMminus.push(downMove > upMove && downMove > 0 ? downMove : 0);
    }

    function smooth(arr) {
      const smoothed = [];
      let sum = arr.slice(0, period).reduce((a, b) => a + b, 0);
      smoothed[period - 1] = sum;
      for (let i = period; i < arr.length; i++) {
        sum = smoothed[i - 1] - smoothed[i - 1] / period + arr[i];
        smoothed[i] = sum;
      }
      return smoothed;
    }

    const smTR = smooth(TR), smDMplus = smooth(DMplus), smDMminus = smooth(DMminus);
    const DIplus = smDMplus.map((v, i) => i >= period - 1 ? 100 * v / smTR[i] : null);
    const DIminus = smDMminus.map((v, i) => i >= period - 1 ? 100 * v / smTR[i] : null);
    const DX = DIplus.map((v, i) => i < period - 1 ? null : 100 * Math.abs(DIplus[i] - DIminus[i]) / (DIplus[i] + DIminus[i]));
    const ADX = [];
    let sumDX = DX.slice(period - 1, period - 1 + period).reduce((a, b) => a + b, 0);
    ADX[period * 2 - 2] = sumDX / period;
    for (let i = period * 2 - 1; i < DX.length; i++) {
      ADX[i] = (ADX[i - 1] * (period - 1) + DX[i]) / period;
    }
    const last = ADX.length - 1;
    return { ADX: ADX[last] || null, DIplus: DIplus[last] || null, DIminus: DIminus[last] || null };
  }

  /**
   * 计算布林带
   */
  calculateBollingerBands(candles, period = 20, k = 2) {
    const closes = candles.map(c => c.close);
    const ma = this.calculateMA(candles, period);
    const stdDev = [];

    for (let i = period - 1; i < candles.length; i++) {
      const slice = closes.slice(i - period + 1, i + 1);
      const mean = ma[i];
      const variance = slice.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / period;
      stdDev[i] = Math.sqrt(variance);
    }

    return ma.map((m, i) => ({
      middle: m,
      upper: m + (k * (stdDev[i] || 0)),
      lower: m - (k * (stdDev[i] || 0)),
      bandwidth: stdDev[i] ? (4 * stdDev[i] / m) : 0
    }));
  }

  /**
   * 检查布林带宽度是否扩张
   */
  isBBWExpanding(candles, period = 20, k = 2) {
    if (candles.length < period + 10) return false;

    const bb = this.calculateBollingerBands(candles, period, k);

    // 检查最近10根K线的带宽变化趋势
    const recentBB = bb.slice(-10);
    if (recentBB.length < 10) return false;

    // 计算带宽变化率
    const bandwidths = recentBB.map(b => b.bandwidth);
    const firstHalf = bandwidths.slice(0, 5);
    const secondHalf = bandwidths.slice(5);

    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    // 如果后半段平均带宽比前半段大5%以上，认为带宽扩张
    return avgSecond > avgFirst * 1.05;
  }

  /**
   * 4H趋势过滤 - 按照strategy-v3.md文档的10分打分机制
   */
  async analyze4HTrend(symbol) {
    try {
      // 从数据库获取4H K线数据
      const klines4h = await this.getKlineDataFromDB(symbol, '4h', 250);

      // 调整数据要求：至少50条K线数据，但推荐200条以上
      const minRequired = 50;
      const recommended = 200;

      if (!klines4h || klines4h.length < minRequired) {
        // 记录数据质量告警
        await this.recordDataQualityAlert(symbol, 'KLINE_DATA_INSUFFICIENT',
          `4H K线数据严重不足: ${klines4h ? klines4h.length : 0}条，需要至少${minRequired}条`);

        if (this.dataMonitor) {
          this.dataMonitor.recordIndicator(symbol, '4H趋势分析', {
            error: '数据严重不足',
            trend4h: '震荡市',
            marketType: '震荡市'
          }, Date.now());
        }
        return { trend4h: '震荡市', marketType: '震荡市', error: '数据严重不足' };
      }

      // 如果数据不足推荐数量，记录警告但继续分析
      if (klines4h.length < recommended) {
        await this.recordDataQualityAlert(symbol, 'KLINE_DATA_LIMITED',
          `4H K线数据有限: ${klines4h.length}条，推荐${recommended}条以上，分析结果可能不够准确`);
      }

      const candles = klines4h.map(k => ({
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));

      const closes = candles.map(c => c.close);
      const highs = candles.map(c => c.high);
      const lows = candles.map(c => c.low);

      // 计算MA指标 - 使用固定周期，确保计算准确性
      const ma20 = this.calculateMA(candles, 20);
      const ma50 = this.calculateMA(candles, 50);
      const ma200 = this.calculateMA(candles, 200);
      const lastClose = closes[closes.length - 1];

      // 计算ADX指标 - 使用固定周期
      const { ADX, DIplus, DIminus } = this.calculateADX(candles, 14);

      // 计算布林带宽度 - 使用固定周期
      const bb = this.calculateBollingerBands(candles, 20, 2);
      const bbw = bb[bb.length - 1]?.bandwidth || 0;

      // 按照文档的10分打分机制
      let totalScore = 0;
      let bullScore = 0;
      let bearScore = 0;
      let direction = null;
      let trend4h = '震荡市';
      let marketType = '震荡市';

      // 1. 趋势方向（必选）- 每个方向至少需要2分
      const currentMA20 = ma20[ma20.length - 1];
      const currentMA50 = ma50[ma50.length - 1];
      const currentMA200 = ma200[ma200.length - 1];

      // 多头方向得分
      if (lastClose > currentMA20) bullScore++;
      if (currentMA20 > currentMA50) bullScore++;
      if (currentMA50 > currentMA200) bullScore++;

      // 空头方向得分
      if (lastClose < currentMA20) bearScore++;
      if (currentMA20 < currentMA50) bearScore++;
      if (currentMA50 < currentMA200) bearScore++;

      // 检查每个方向是否至少2分
      if (bullScore >= 2) {
        direction = "BULL";
        totalScore += bullScore;
      } else if (bearScore >= 2) {
        direction = "BEAR";
        totalScore += bearScore;
      } else {
        // 每个方向都没有到2分，直接返回震荡市
        if (this.dataMonitor) {
          this.dataMonitor.recordIndicator(symbol, '4H趋势分析', {
            trend4h: '震荡市',
            marketType: '震荡市',
            score: 0,
            bullScore,
            bearScore,
            reason: '每个方向都没有到2分'
          }, Date.now());
        }
        return {
          trend4h: '震荡市',
          marketType: '震荡市',
          ma20: currentMA20,
          ma50: currentMA50,
          ma200: currentMA200,
          adx14: ADX,
          bbw: bbw,
          score: 0,
          bullScore,
          bearScore
        };
      }

      // 2. 趋势稳定性 - 1分（连续≥2根4H K线满足趋势方向）
      const last2 = closes.slice(-2);
      const last2MA20 = ma20.slice(-2);
      const last2MA50 = ma50.slice(-2);
      const last2MA200 = ma200.slice(-2);

      let trendStability = false;
      if (direction === "BULL") {
        trendStability = last2.every((c, i) =>
          c > last2MA20[i] &&
          last2MA20[i] > last2MA50[i] &&
          last2MA50[i] > last2MA200[i]
        );
      } else if (direction === "BEAR") {
        trendStability = last2.every((c, i) =>
          c < last2MA20[i] &&
          last2MA20[i] < last2MA50[i] &&
          last2MA50[i] < last2MA200[i]
        );
      }

      if (trendStability) {
        totalScore++;
      }

      // 3. 趋势强度 - 1分（ADX(14) > 20 且 DI方向正确）
      if (ADX > 20 &&
        ((direction === "BULL" && DIplus > DIminus) ||
          (direction === "BEAR" && DIminus > DIplus))) {
        totalScore++;
      }

      // 4. 布林带扩张 - 1分（最近10根K线，后5根BBW均值 > 前5根均值 × 1.05）
      const bbwExpanding = this.isBBWExpanding(candles, 20, 2);
      if (bbwExpanding) {
        totalScore++;
      }

      // 5. 动量确认 - 1分（当前K线收盘价离MA20距离 ≥ 0.5%）
      const momentumDistance = Math.abs((lastClose - currentMA20) / currentMA20);
      if (momentumDistance >= 0.005) {
        totalScore++;
      }

      // 最终判断：得分≥4分才保留趋势
      if (totalScore >= 4) {
        if (direction === "BULL") {
          trend4h = "多头趋势";
        } else {
          trend4h = "空头趋势";
        }
        marketType = "趋势市";
      } else {
        trend4h = "震荡市";
        marketType = "震荡市";
      }

      // 记录分析结果
      if (this.dataMonitor) {
        this.dataMonitor.recordIndicator(symbol, '4H趋势分析', {
          trend4h,
          marketType,
          score: totalScore,
          direction,
          bullScore,
          bearScore,
          ma20: currentMA20,
          ma50: currentMA50,
          ma200: currentMA200,
          adx14: ADX,
          bbw: bbw
        }, Date.now());
      }

      return {
        trend4h,
        marketType,
        ma20: currentMA20,
        ma50: currentMA50,
        ma200: currentMA200,
        adx14: ADX,
        bbw: bbw,
        score: totalScore,
        direction,
        bullScore,
        bearScore
      };
    } catch (error) {
      console.error(`4H趋势分析失败 [${symbol}]:`, error);

      // 记录错误告警
      await this.recordDataQualityAlert(symbol, 'TREND_ANALYSIS_ERROR',
        `4H趋势分析失败: ${error.message}`);

      return { trend4h: '震荡市', marketType: '震荡市', error: error.message };
    }
  }

  /**
   * 1H多因子打分 - 趋势市专用
   */
  async analyze1HScoring(symbol, trend4h, deltaManager = null) {
    try {
      console.log(`🔍 开始1H多因子打分 [${symbol}] 趋势: ${trend4h}`);

      // 从数据库获取1H K线数据
      const klines1h = await this.getKlineDataFromDB(symbol, '1h', 50);

      if (!klines1h || klines1h.length < 20) {
        await this.recordDataQualityAlert(symbol, 'KLINE_DATA_INSUFFICIENT',
          `1H K线数据不足: ${klines1h ? klines1h.length : 0}条，需要至少20条`);

        return { score: 0, error: '1H K线数据不足' };
      }

      const candles = klines1h.map(k => ({
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));

      // 获取当前价格
      let currentPrice = null;
      try {
        const ticker = await BinanceAPI.getTicker(symbol);
        console.log(`🔍 获取当前价格 [${symbol}]: ticker=`, JSON.stringify(ticker));
        currentPrice = parseFloat(ticker.price);
        console.log(`🔍 解析当前价格 [${symbol}]: currentPrice=${currentPrice}`);
      } catch (error) {
        console.warn(`获取 ${symbol} 当前价格失败:`, error.message);
        currentPrice = candles[candles.length - 1].close;
      }

      // 计算VWAP
      const vwap = this.calculateVWAP(candles);
      const lastVWAP = vwap[vwap.length - 1];

      // 获取Delta数据
      let delta = 0;
      if (deltaManager) {
        const deltaData = deltaManager.getDeltaData(symbol, '1h');
        if (deltaData) {
          delta = deltaData.delta || 0;
        }
      }

      // 获取OI数据
      let oiChange = 0;
      try {
        const oiHist = await BinanceAPI.getOpenInterestHist(symbol, '1h', 6);
        if (oiHist && oiHist.length >= 2) {
          const latest = oiHist[oiHist.length - 1];
          const earliest = oiHist[0];
          oiChange = (latest.sumOpenInterest - earliest.sumOpenInterest) / earliest.sumOpenInterest;
        }
      } catch (error) {
        console.warn(`获取 ${symbol} OI数据失败:`, error.message);
      }

      // 计算成交量因子
      const recentVolume = candles.slice(-1)[0].volume;
      const avgVolume = candles.slice(-20).reduce((sum, c) => sum + c.volume, 0) / Math.min(20, candles.length);
      const volumeRatio = recentVolume / avgVolume;

      // 获取资金费率
      let fundingRate = 0;
      try {
        const funding = await BinanceAPI.getFundingRate(symbol);
        if (funding && funding.length > 0) {
          fundingRate = parseFloat(funding[0].fundingRate);
        }
      } catch (error) {
        console.warn(`获取 ${symbol} 资金费率失败:`, error.message);
      }

      // 计算因子得分
      let score = 0;
      const factorScores = {};

      // 1. VWAP方向一致性（必须满足，不计分但计入总分）
      console.log(`🔍 VWAP方向一致性检查 [${symbol}]: currentPrice=${currentPrice}, lastVWAP=${lastVWAP}, trend4h=${trend4h}`);
      const vwapDirectionConsistent = this.checkVWAPDirectionConsistency(currentPrice, lastVWAP, trend4h);
      console.log(`🔍 VWAP方向一致性结果 [${symbol}]: ${vwapDirectionConsistent}`);
      if (vwapDirectionConsistent) {
        score += 1; // 计入总分
      }

      // 2. 突破确认
      const breakoutScore = this.calculateBreakoutScore(candles, trend4h);
      score += breakoutScore;
      factorScores.breakout = breakoutScore;

      // 3. 成交量确认
      const volumeScore = this.calculateVolumeScore(volumeRatio);
      score += volumeScore;
      factorScores.volume = volumeScore;

      // 4. OI变化确认
      const oiScore = this.calculateOIScore(oiChange);
      score += oiScore;
      factorScores.oi = oiScore;

      // 5. Delta不平衡
      const deltaScore = this.calculateDeltaScore(delta);
      score += deltaScore;
      factorScores.delta = deltaScore;

      // 6. 资金费率
      const fundingScore = this.calculateFundingScore(fundingRate);
      score += fundingScore;
      factorScores.funding = fundingScore;

      console.log(`📊 1H多因子打分结果 [${symbol}]: 总分=${score}, 因子得分=`, factorScores);

      // 记录分析结果
      if (this.dataMonitor) {
        this.dataMonitor.recordIndicator(symbol, '1H多因子打分', {
          score,
          factorScores,
          vwapDirectionConsistent,
          currentPrice,
          lastVWAP,
          delta,
          oiChange,
          volumeRatio,
          fundingRate
        }, Date.now());
      }

      // 判断是否允许入场：VWAP方向一致且得分≥3
      const allowEntry = vwapDirectionConsistent && score >= 3;

      console.log(`🔍 VWAP方向一致性检查 [${symbol}]: 当前价格=${currentPrice}, VWAP=${lastVWAP}, 趋势=${trend4h}, 方向一致=${vwapDirectionConsistent}, 得分=${score}, 允许入场=${allowEntry}`);

      return {
        score,
        factorScores,
        vwapDirectionConsistent,
        allowEntry,
        currentPrice,
        lastVWAP,
        delta,
        oiChange,
        volumeRatio,
        fundingRate
      };

    } catch (error) {
      console.error(`1H多因子打分失败 [${symbol}]:`, error);
      await this.recordDataQualityAlert(symbol, 'SCORING_ANALYSIS_ERROR',
        `1H多因子打分失败: ${error.message}`);

      return { score: 0, error: error.message };
    }
  }

  /**
   * 计算VWAP
   */
  calculateVWAP(candles) {
    const vwap = [];
    let cumulativeVolume = 0;
    let cumulativeVolumePrice = 0;

    for (let i = 0; i < candles.length; i++) {
      const typicalPrice = (candles[i].high + candles[i].low + candles[i].close) / 3;
      cumulativeVolume += candles[i].volume;
      cumulativeVolumePrice += typicalPrice * candles[i].volume;
      vwap[i] = cumulativeVolumePrice / cumulativeVolume;
    }

    return vwap;
  }

  /**
   * 检查VWAP方向一致性
   */
  checkVWAPDirectionConsistency(currentPrice, vwap, trend4h) {
    if (trend4h === '多头趋势') {
      return currentPrice > vwap;
    } else if (trend4h === '空头趋势') {
      return currentPrice < vwap;
    }
    return false;
  }

  /**
   * 计算突破确认得分
   */
  calculateBreakoutScore(candles, trend4h) {
    if (candles.length < 2) return 0;

    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];

    if (trend4h === '多头趋势') {
      return last.close > prev.high ? 1 : 0;
    } else if (trend4h === '空头趋势') {
      return last.close < prev.low ? 1 : 0;
    }

    return 0;
  }

  /**
   * 计算成交量得分
   */
  calculateVolumeScore(volumeRatio) {
    return volumeRatio >= 1.2 ? 1 : (volumeRatio >= 1.0 ? 0.5 : 0);
  }

  /**
   * 计算OI变化得分
   */
  calculateOIScore(oiChange) {
    return Math.abs(oiChange) >= 0.01 ? 1 : (Math.abs(oiChange) >= 0.005 ? 0.5 : 0);
  }

  /**
   * 计算Delta得分
   */
  calculateDeltaScore(delta) {
    return Math.abs(delta) >= 0.02 ? 1 : (Math.abs(delta) >= 0.01 ? 0.5 : 0);
  }

  /**
   * 计算资金费率得分
   */
  calculateFundingScore(fundingRate) {
    return Math.abs(fundingRate) <= 0.001 ? 1 : (Math.abs(fundingRate) <= 0.002 ? 0.5 : 0);
  }

  /**
   * 震荡市1H边界判断
   */
  async analyzeRangeBoundary(symbol, deltaManager = null) {
    try {
      console.log(`🔍 开始震荡市1H边界判断 [${symbol}]`);

      // 从数据库获取1H K线数据
      const klines1h = await this.getKlineDataFromDB(symbol, '1h', 50);

      if (!klines1h || klines1h.length < 20) {
        await this.recordDataQualityAlert(symbol, 'KLINE_DATA_INSUFFICIENT',
          `1H K线数据不足: ${klines1h ? klines1h.length : 0}条，需要至少20条`);

        return { error: '1H K线数据不足' };
      }

      const candles = klines1h.map(k => ({
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));

      // 计算布林带
      const bb = this.calculateBollingerBands(candles, 20, 2);
      const lastBB = bb[bb.length - 1];

      // 计算连续触碰因子
      const touchScore = this.calculateTouchScore(candles, lastBB);

      // 计算成交量因子
      const recentVolume = candles.slice(-1)[0].volume;
      const avgVolume = candles.slice(-20).reduce((sum, c) => sum + c.volume, 0) / Math.min(20, candles.length);
      const volumeRatio = recentVolume / avgVolume;
      const volumeScore = volumeRatio <= 1.7 ? 1 : (volumeRatio <= 2.0 ? 0.5 : 0);

      // 获取Delta数据
      let delta = 0;
      if (deltaManager) {
        const deltaData = deltaManager.getDeltaData(symbol, '1h');
        if (deltaData) {
          delta = deltaData.delta || 0;
        }
      }
      const deltaScore = Math.abs(delta) <= 0.02 ? 1 : (Math.abs(delta) <= 0.05 ? 0.5 : 0);

      // 获取OI数据
      let oiChange = 0;
      try {
        const oiHist = await BinanceAPI.getOpenInterestHist(symbol, '1h', 6);
        if (oiHist && oiHist.length >= 2) {
          const latest = oiHist[oiHist.length - 1];
          const earliest = oiHist[0];
          oiChange = (latest.sumOpenInterest - earliest.sumOpenInterest) / earliest.sumOpenInterest;
        }
      } catch (error) {
        console.warn(`获取 ${symbol} OI数据失败:`, error.message);
      }
      const oiScore = Math.abs(oiChange) <= 0.02 ? 1 : (Math.abs(oiChange) <= 0.05 ? 0.5 : 0);

      // 计算无突破因子
      const noBreakoutScore = this.calculateNoBreakoutScore(candles);

      // 计算VWAP因子
      const vwap = this.calculateVWAP(candles);
      const lastVWAP = vwap[vwap.length - 1];
      const currentPrice = candles[candles.length - 1].close;
      const vwapDistance = Math.abs(currentPrice - lastVWAP) / lastVWAP;
      const vwapScore = vwapDistance <= 0.01 ? 1 : (vwapDistance <= 0.02 ? 0.5 : 0);

      // 计算总分
      const totalScore = touchScore + volumeScore + deltaScore + oiScore + noBreakoutScore + vwapScore;

      // 判断边界有效性
      const lowerBoundaryValid = totalScore >= 3;
      const upperBoundaryValid = totalScore >= 3;

      console.log(`📊 震荡市1H边界判断结果 [${symbol}]: 总分=${totalScore}, 下边界=${lowerBoundaryValid}, 上边界=${upperBoundaryValid}`);

      // 记录分析结果
      if (this.dataMonitor) {
        this.dataMonitor.recordIndicator(symbol, '震荡市1H边界判断', {
          totalScore,
          lowerBoundaryValid,
          upperBoundaryValid,
          touchScore,
          volumeScore,
          deltaScore,
          oiScore,
          noBreakoutScore,
          vwapScore,
          currentPrice,
          lastVWAP,
          delta,
          oiChange,
          volumeRatio
        }, Date.now());
      }

      return {
        totalScore,
        lowerBoundaryValid,
        upperBoundaryValid,
        bb1h: lastBB,
        factorScores: {
          touch: touchScore,
          volume: volumeScore,
          delta: deltaScore,
          oi: oiScore,
          noBreakout: noBreakoutScore,
          vwap: vwapScore
        }
      };

    } catch (error) {
      console.error(`震荡市1H边界判断失败 [${symbol}]:`, error);
      await this.recordDataQualityAlert(symbol, 'RANGE_BOUNDARY_ANALYSIS_ERROR',
        `震荡市1H边界判断失败: ${error.message}`);

      return { error: error.message };
    }
  }

  /**
   * 计算触碰得分
   */
  calculateTouchScore(candles, bb) {
    if (candles.length < 6) return 0;

    const recent6 = candles.slice(-6);
    let touchCount = 0;

    for (const candle of recent6) {
      // 检查是否触碰上轨或下轨
      if (candle.high >= bb.upper * 0.99 || candle.low <= bb.lower * 1.01) {
        touchCount++;
      }
    }

    return touchCount >= 3 ? 1 : (touchCount >= 2 ? 0.5 : 0);
  }

  /**
   * 计算无突破得分
   */
  calculateNoBreakoutScore(candles) {
    if (candles.length < 20) return 0;

    const recent20 = candles.slice(-20);
    const highs = recent20.map(c => c.high);
    const lows = recent20.map(c => c.low);

    const maxHigh = Math.max(...highs);
    const minLow = Math.min(...lows);

    // 检查最近20根K线是否有新高或新低突破
    const last5 = candles.slice(-5);
    const hasNewHigh = last5.some(c => c.high > maxHigh);
    const hasNewLow = last5.some(c => c.low < minLow);

    return !hasNewHigh && !hasNewLow ? 1 : 0;
  }
}

module.exports = StrategyV3Core;