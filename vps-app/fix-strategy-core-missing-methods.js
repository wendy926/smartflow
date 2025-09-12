#!/usr/bin/env node

// 修复StrategyV3Core缺失的analyze1HScoring方法
// 添加完整的1H多因子打分逻辑

const fs = require('fs');
const path = require('path');

class StrategyCoreMethodFixer {
  constructor() {
    this.corePath = 'modules/strategy/StrategyV3Core.js';
  }

  async fix() {
    console.log('🔧 修复StrategyV3Core缺失的analyze1HScoring方法...');
    
    const coreContent = `// StrategyV3Core.js - 策略V3核心实现模块

const BinanceAPI = require('../api/BinanceAPI');
const FactorWeightManager = require('./FactorWeightManager');

class StrategyV3Core {
  constructor(database = null) {
    this.database = database;
    this.deltaData = new Map(); // 存储Delta数据
    this.dataMonitor = null; // 将在外部设置
    this.factorWeightManager = new FactorWeightManager(database);
  }

  /**
   * 从数据库获取K线数据
   */
  async getKlineDataFromDB(symbol, interval, limit = 250) {
    if (!this.database) {
      throw new Error('数据库连接未初始化');
    }

    try {
      const sql = \`
        SELECT open_time, close_time, open_price, high_price, low_price, close_price, 
               volume, quote_volume, trades_count, taker_buy_volume, taker_buy_quote_volume
        FROM kline_data 
        WHERE symbol = ? AND interval = ?
        ORDER BY open_time DESC 
        LIMIT ?
      \`;
      
      const results = await this.database.runQuery(sql, [symbol, interval, limit]);
      
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
      console.error(\`从数据库获取K线数据失败 [\${symbol} \${interval}]:\`, error);
      return null;
    }
  }

  /**
   * 记录数据质量告警
   */
  async recordDataQualityAlert(symbol, issueType, message, details = null) {
    if (!this.database) return;

    try {
      const sql = \`
        INSERT INTO data_quality_issues (symbol, issue_type, severity, message, details)
        VALUES (?, ?, ?, ?, ?)
      \`;
      
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
   * 4H趋势过滤 - 按照strategy-v3.md文档的5分打分机制
   */
  async analyze4HTrend(symbol) {
    try {
      // 从数据库获取4H K线数据
      const klines4h = await this.getKlineDataFromDB(symbol, '4h', 250);
      
      if (!klines4h || klines4h.length < 200) {
        // 记录数据质量告警
        await this.recordDataQualityAlert(symbol, 'KLINE_DATA_INSUFFICIENT', 
          \`4H K线数据不足: \${klines4h ? klines4h.length : 0}条，需要至少200条\`);
        
        if (this.dataMonitor) {
          this.dataMonitor.recordIndicator(symbol, '4H趋势分析', {
            error: '数据不足',
            trend4h: '震荡市',
            marketType: '震荡市'
          }, Date.now());
        }
        return { trend4h: '震荡市', marketType: '震荡市', error: '数据不足' };
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

      // 计算MA指标
      const ma20 = this.calculateMA(candles, 20);
      const ma50 = this.calculateMA(candles, 50);
      const ma200 = this.calculateMA(candles, 200);
      const lastClose = closes[closes.length - 1];

      // 计算ADX指标
      const { ADX, DIplus, DIminus } = this.calculateADX(candles, 14);

      // 计算布林带宽度
      const bb = this.calculateBollingerBands(candles, 20, 2);
      const bbw = bb[bb.length - 1]?.bandwidth || 0;

      // 按照文档的5分打分机制
      let score = 0;
      let direction = null;
      let trend4h = '震荡市';
      let marketType = '震荡市';

      // 1. 趋势方向（必选）- 1分
      if (lastClose > ma20[ma20.length - 1] &&
        ma20[ma20.length - 1] > ma50[ma50.length - 1] &&
        ma50[ma50.length - 1] > ma200[ma200.length - 1]) {
        direction = "BULL";
        score++;
      } else if (lastClose < ma20[ma20.length - 1] &&
        ma20[ma20.length - 1] < ma50[ma50.length - 1] &&
        ma50[ma50.length - 1] < ma200[ma200.length - 1]) {
        direction = "BEAR";
        score++;
      } else {
        // 趋势方向不成立，直接返回震荡市
        if (this.dataMonitor) {
          this.dataMonitor.recordIndicator(symbol, '4H趋势分析', {
            trend4h: '震荡市',
            marketType: '震荡市',
            score: 0,
            reason: '趋势方向不成立'
          }, Date.now());
        }
        return {
          trend4h: '震荡市',
          marketType: '震荡市',
          ma20: ma20[ma20.length - 1],
          ma50: ma50[ma50.length - 1],
          ma200: ma200[ma200.length - 1],
          adx14: ADX,
          bbw: bbw,
          score: 0
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
        score++;
      }

      // 3. 趋势强度 - 1分（ADX(14) > 20 且 DI方向正确）
      if (ADX > 20 &&
        ((direction === "BULL" && DIplus > DIminus) ||
          (direction === "BEAR" && DIminus > DIplus))) {
        score++;
      }

      // 4. 布林带扩张 - 1分（最近10根K线，后5根BBW均值 > 前5根均值 × 1.05）
      const bbwExpanding = this.isBBWExpanding(candles, 20, 2);
      if (bbwExpanding) {
        score++;
      }

      // 5. 动量确认 - 1分（当前K线收盘价离MA20距离 ≥ 0.5%）
      const momentumDistance = Math.abs((lastClose - ma20[ma20.length - 1]) / ma20[ma20.length - 1]);
      if (momentumDistance >= 0.005) {
        score++;
      }

      // 最终判断：得分≥3分才保留趋势
      if (score >= 3) {
        if (direction === "BULL") {
          trend4h = "多头趋势";
        } else {
          trend4h = "空头趋势";
        }
      } else {
        trend4h = "震荡市";
      }

      // 记录分析结果
      if (this.dataMonitor) {
        this.dataMonitor.recordIndicator(symbol, '4H趋势分析', {
          trend4h,
          marketType: trend4h === '震荡市' ? '震荡市' : '趋势市',
          score,
          direction,
          ma20: ma20[ma20.length - 1],
          ma50: ma50[ma50.length - 1],
          ma200: ma200[ma200.length - 1],
          adx14: ADX,
          bbw: bbw
        }, Date.now());
      }

      return {
        trend4h,
        marketType: trend4h === '震荡市' ? '震荡市' : '趋势市',
        ma20: ma20[ma20.length - 1],
        ma50: ma50[ma50.length - 1],
        ma200: ma200[ma200.length - 1],
        adx14: ADX,
        bbw: bbw,
        score,
        direction
      };
    } catch (error) {
      console.error(\`4H趋势分析失败 [\${symbol}]:\`, error);
      
      // 记录错误告警
      await this.recordDataQualityAlert(symbol, 'TREND_ANALYSIS_ERROR', 
        \`4H趋势分析失败: \${error.message}\`);
      
      return { trend4h: '震荡市', marketType: '震荡市', error: error.message };
    }
  }

  /**
   * 1H多因子打分 - 趋势市专用
   */
  async analyze1HScoring(symbol, trend4h, deltaManager = null) {
    try {
      console.log(\`🔍 开始1H多因子打分 [\${symbol}] 趋势: \${trend4h}\`);

      // 从数据库获取1H K线数据
      const klines1h = await this.getKlineDataFromDB(symbol, '1h', 50);
      
      if (!klines1h || klines1h.length < 20) {
        await this.recordDataQualityAlert(symbol, 'KLINE_DATA_INSUFFICIENT', 
          \`1H K线数据不足: \${klines1h ? klines1h.length : 0}条，需要至少20条\`);
        
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
        currentPrice = parseFloat(ticker.lastPrice);
      } catch (error) {
        console.warn(\`获取 \${symbol} 当前价格失败:\`, error.message);
        currentPrice = candles[candles.length - 1].close;
      }

      // 计算VWAP
      const vwap = this.calculateVWAP(candles);
      const lastVWAP = vwap[vwap.length - 1];

      // 获取Delta数据
      let delta = 0;
      if (deltaManager) {
        const deltaData = deltaManager.getDelta(symbol);
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
        console.warn(\`获取 \${symbol} OI数据失败:\`, error.message);
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
        console.warn(\`获取 \${symbol} 资金费率失败:\`, error.message);
      }

      // 计算因子得分
      let score = 0;
      const factorScores = {};

      // 1. VWAP方向一致性（必须满足，不计分但计入总分）
      const vwapDirectionConsistent = this.checkVWAPDirectionConsistency(currentPrice, lastVWAP, trend4h);
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

      console.log(\`📊 1H多因子打分结果 [\${symbol}]: 总分=\${score}, 因子得分=\`, factorScores);

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

      return {
        score,
        factorScores,
        vwapDirectionConsistent,
        currentPrice,
        lastVWAP,
        delta,
        oiChange,
        volumeRatio,
        fundingRate
      };

    } catch (error) {
      console.error(\`1H多因子打分失败 [\${symbol}]:\`, error);
      await this.recordDataQualityAlert(symbol, 'SCORING_ANALYSIS_ERROR', 
        \`1H多因子打分失败: \${error.message}\`);
      
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
}

module.exports = StrategyV3Core;`;

    fs.writeFileSync(this.corePath, coreContent);
    console.log('✅ StrategyV3Core.js 修复完成');
  }
}

if (require.main === module) {
  const fixer = new StrategyCoreMethodFixer();
  fixer.fix();
}

module.exports = StrategyCoreMethodFixer;
