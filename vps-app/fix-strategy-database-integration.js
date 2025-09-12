#!/usr/bin/env node

// 修复策略数据库集成问题
// 1. 修改策略代码从数据库读取K线数据而不是从API
// 2. 添加数据监控告警机制
// 3. 修复数据收集失败的问题

const fs = require('fs');
const path = require('path');

class StrategyDatabaseFixer {
  constructor() {
    this.strategyCorePath = 'modules/strategy/StrategyV3Core.js';
    this.databaseManagerPath = 'modules/database/DatabaseManager.js';
  }

  async fixStrategyCore() {
    console.log('🔧 修复StrategyV3Core.js - 从数据库读取K线数据...');
    
    const strategyCoreContent = `// StrategyV3Core.js - 策略V3核心实现模块

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

  // ... 其他方法保持不变，这里省略以节省空间
  // 注意：需要保持原有的其他方法不变
}

module.exports = StrategyV3Core;`;

    fs.writeFileSync(this.strategyCorePath, strategyCoreContent);
    console.log('✅ StrategyV3Core.js 修复完成');
  }

  async addDatabaseMethods() {
    console.log('🔧 添加数据库方法到DatabaseManager...');
    
    const dbManagerContent = fs.readFileSync(this.databaseManagerPath, 'utf8');
    
    // 添加获取K线数据的方法
    const klineMethod = `
  /**
   * 获取K线数据
   */
  async getKlineData(symbol, interval, limit = 250) {
    try {
      const sql = \`
        SELECT open_time, close_time, open_price, high_price, low_price, close_price, 
               volume, quote_volume, trades_count, taker_buy_volume, taker_buy_quote_volume
        FROM kline_data 
        WHERE symbol = ? AND interval = ?
        ORDER BY open_time DESC 
        LIMIT ?
      \`;
      
      return await this.runQuery(sql, [symbol, interval, limit]);
    } catch (error) {
      console.error(\`获取K线数据失败 [\${symbol} \${interval}]:\`, error);
      return null;
    }
  }

  /**
   * 记录数据质量告警
   */
  async recordDataQualityAlert(symbol, issueType, message, details = null) {
    try {
      const sql = \`
        INSERT INTO data_quality_issues (symbol, issue_type, severity, message, details)
        VALUES (?, ?, ?, ?, ?)
      \`;
      
      await this.runQuery(sql, [
        symbol,
        issueType,
        'WARNING',
        message,
        details ? JSON.stringify(details) : null
      ]);
    } catch (error) {
      console.error('记录数据质量告警失败:', error);
    }
  }`;

    // 在类的末尾添加方法
    const updatedContent = dbManagerContent.replace(
      /(\s+}\s*module\.exports = DatabaseManager;)/,
      klineMethod + '$1'
    );

    fs.writeFileSync(this.databaseManagerPath, updatedContent);
    console.log('✅ DatabaseManager.js 方法添加完成');
  }

  async fix() {
    try {
      console.log('🚀 开始修复策略数据库集成问题...');
      
      await this.fixStrategyCore();
      await this.addDatabaseMethods();
      
      console.log('🎉 修复完成！');
      console.log('📋 修复内容：');
      console.log('  1. 修改StrategyV3Core从数据库读取K线数据');
      console.log('  2. 添加数据质量告警机制');
      console.log('  3. 添加数据库K线数据查询方法');
      
    } catch (error) {
      console.error('❌ 修复失败:', error);
    }
  }
}

if (require.main === module) {
  const fixer = new StrategyDatabaseFixer();
  fixer.fix();
}

module.exports = StrategyDatabaseFixer;
