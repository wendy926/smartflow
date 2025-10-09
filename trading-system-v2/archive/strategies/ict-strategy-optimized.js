/**
 * ICT策略第二次优化实现
 * 基于ict-plus.md中的第二次优化需求
 * 
 * 主要优化点：
 * 1. analyzeEngulfing返回强度0..1浮点值
 * 2. detectHarmonicPattern返回{type, score(0..1), rmse}
 * 3. generateSignal使用门槛+容忍/分级逻辑
 * 4. waitForConfirmation等待1-3根15M收盘确认
 * 5. calcStopMultiplier自适应止损倍数
 * 6. positionSizing基于totalScore和historicalWinRate
 * 7. 增强的订单块检测(被扫后回归验证)
 * 8. telemetry.log记录每次信号的因子数据
 */

const TechnicalIndicators = require('../utils/technical-indicators');
const BinanceAPI = require('../api/binance-api');
const HarmonicPatterns = require('./harmonic-patterns');
const logger = require('../utils/logger');
const config = require('../config');
const fs = require('fs');
const path = require('path');

class ICTStrategyOptimized {
  constructor() {
    this.name = 'ICT_OPTIMIZED';
    this.timeframes = ['1D', '4H', '15M'];
    this.binanceAPI = new BinanceAPI();
    this.telemetryFile = path.join(__dirname, '../../logs/ict_telemetry.log');
    this.config = this.loadConfig();

    // 确保日志目录存在
    const logDir = path.dirname(this.telemetryFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  /**
   * 加载配置参数
   */
  loadConfig() {
    return {
      minEngulfStrength: 0.6,
      minHarmonicScore: 0.6,
      confirmationBars: 2,
      minStopMultiplier: 1.5,
      maxStopMultiplier: 2.5,
      baseRiskPercent: 0.001,
      maxRiskPercent: 0.005,
      orderBlockMaxAge: 12,
      sweepLookbackBars: 8,
      harmonicLookbackBars: 120,
      volumeExpansionMultiplier: 1.5,
      trendChangeThreshold: 0.02
    };
  }

  /**
   * 工具函数
   */
  last(arr, n = 1) { return arr[arr.length - n]; }
  sma(arr) { if (!arr.length) return 0; return arr.reduce((a, b) => a + b, 0) / arr.length; }
  clamp(v, a = 0, b = 1) { return Math.max(a, Math.min(b, v)); }
  sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  nowStr() { return new Date().toISOString(); }

  /**
   * 获取K线数据
   */
  async fetchKlines(symbol, interval, limit = 500) {
    try {
      const klines = await this.binanceAPI.getKlines(symbol, interval, limit);
      return klines.map(k => ({
        t: k[0],
        o: +k[1],
        h: +k[2],
        l: +k[3],
        c: +k[4],
        v: +k[5]
      }));
    } catch (error) {
      logger.error(`获取K线数据失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 计算ATR
   */
  computeATRFromKlines(klines, period = 14) {
    if (klines.length < period + 1) return null;
    const highs = klines.map(k => k.h);
    const lows = klines.map(k => k.l);
    const closes = klines.map(k => k.c);
    const atr = TechnicalIndicators.calculateATR(highs, lows, closes, period);
    return atr[atr.length - 1] || null;
  }

  /**
   * 1. 优化后的吞没形态检测 - 返回强度0..1浮点值
   * 基于文档要求：analyzeEngulfing返回强度0..1（浮点）
   */
  analyzeEngulfing(kl15m) {
    if (kl15m.length < 2) return { type: 'NONE', strength: 0 };

    // 支持数组格式（Binance API返回的格式）
    const a = Array.isArray(kl15m[kl15m.length - 2]) ? {
      o: parseFloat(kl15m[kl15m.length - 2][1]),
      h: parseFloat(kl15m[kl15m.length - 2][2]),
      l: parseFloat(kl15m[kl15m.length - 2][3]),
      c: parseFloat(kl15m[kl15m.length - 2][4])
    } : kl15m[kl15m.length - 2];

    const b = Array.isArray(kl15m[kl15m.length - 1]) ? {
      o: parseFloat(kl15m[kl15m.length - 1][1]),
      h: parseFloat(kl15m[kl15m.length - 1][2]),
      l: parseFloat(kl15m[kl15m.length - 1][3]),
      c: parseFloat(kl15m[kl15m.length - 1][4])
    } : kl15m[kl15m.length - 1];

    const bodyA = Math.abs(a.c - a.o);
    const bodyB = Math.abs(b.c - b.o);
    const totalA = a.h - a.l;
    const totalB = b.h - b.l;

    // 看涨吞没：前一根为阴线，当前为阳线且完全吞没
    if (b.c > b.o && a.c < a.o && b.c > a.o && b.o < a.c) {
      // 强度计算：基于主体比例和总K线大小
      const ratio = bodyB / Math.max(1e-8, bodyA);
      const sizeFactor = bodyB / Math.max(1e-8, totalB);
      // 归一化：比例裁剪到[1,5]，映射到[0.4,1]
      const rNorm = this.clamp((ratio - 1) / 4, 0, 1);
      const sNorm = this.clamp(sizeFactor, 0, 1);
      const strength = this.clamp(0.4 * rNorm + 0.6 * sNorm, 0, 1);
      return { type: 'BULL', strength };
    }

    // 看跌吞没：前一根为阳线，当前为阴线且完全吞没
    if (b.c < b.o && a.c > a.o && b.c < a.o && b.o > a.c) {
      const ratio = bodyB / Math.max(1e-8, bodyA);
      const sizeFactor = bodyB / Math.max(1e-8, totalB);
      const rNorm = this.clamp((ratio - 1) / 4, 0, 1);
      const sNorm = this.clamp(sizeFactor, 0, 1);
      const strength = this.clamp(0.4 * rNorm + 0.6 * sNorm, 0, 1);
      return { type: 'BEAR', strength };
    }

    return { type: 'NONE', strength: 0 };
  }

  /**
   * 2. 优化后的谐波形态检测 - 返回{type, score(0..1), rmse}
   * 基于文档要求：detectHarmonicPattern返回{type, score(0..1), rmse}
   */
  detectHarmonicPattern(kl15m) {
    const pivots = this.extractSwingPoints(kl15m, this.config.harmonicLookbackBars);
    if (pivots.length < 5) return { type: 'NONE', score: 0, rmse: null };

    const last5 = pivots.slice(-5);
    const pts = last5.map(p => p.price);
    const [X, A, B, C, D] = pts;

    const segXA = Math.abs(A - X) || 1e-8;
    const segAB = Math.abs(B - A) || 1e-8;
    const segBC = Math.abs(C - B) || 1e-8;
    const segCD = Math.abs(D - C) || 1e-8;

    // 实际比例（相对于XA距离归一化）
    const AB_r = segAB / segXA;
    const BC_r = segBC / segXA;
    const CD_r = segCD / segXA;

    // 理想比例集合（基于文档中的范围中点）
    const patterns = {
      CYPHER: { name: 'CYPHER', ideal: [0.5, 1.25, 0.83] }, // AB~0.35-0.65->0.5, BC~1.05-1.50->1.25, CD~0.75-0.95->0.83
      BAT: { name: 'BAT', ideal: [0.45, 0.65, 0.875] },     // 中点
      SHARK: { name: 'SHARK', ideal: [1.35, 1.35, 0.95] }
    };

    const results = [];
    for (const k in patterns) {
      const ideal = patterns[k].ideal;
      // 计算实际[AB_r, BC_r, CD_r]与理想的归一化RMSE
      const errs = [
        (AB_r - ideal[0]) / (ideal[0] || 1),
        (BC_r - ideal[1]) / (ideal[1] || 1),
        (CD_r - ideal[2]) / (ideal[2] || 1)
      ];
      const mse = (errs[0] * errs[0] + errs[1] * errs[1] + errs[2] * errs[2]) / 3;
      const rmse = Math.sqrt(mse);
      // 将rmse映射到得分：较小的rmse->较高的得分
      // 使用exp衰减：-rmse*2产生平滑映射
      const score = this.clamp(Math.exp(-rmse * 2), 0, 1);
      results.push({ pattern: k, rmse, score });
    }

    // 选择最佳匹配
    results.sort((a, b) => b.score - a.score);
    const best = results[0];
    if (best.score < 0.15) return { type: 'NONE', score: 0, rmse: best.rmse };

    return {
      type: patterns[best.pattern].name,
      score: best.score,
      rmse: best.rmse,
      points: { X, A, B, C, D }
    };
  }

  /**
   * 提取摆动点
   */
  extractSwingPoints(klines, lookback = 60) {
    const data = klines.slice(-lookback);

    // 支持数组格式（Binance API返回的格式）
    const highs = data.map(k => Array.isArray(k) ? parseFloat(k[2]) : k.h);
    const lows = data.map(k => Array.isArray(k) ? parseFloat(k[3]) : k.l);

    // 简单的摆动点检测：局部最大/最小值，窗口为3
    const pivots = [];
    for (let i = 2; i < data.length - 2; i++) {
      const win = data.slice(i - 2, i + 3);
      const center = data[i];
      const centerHigh = Array.isArray(center) ? parseFloat(center[2]) : center.h;
      const centerLow = Array.isArray(center) ? parseFloat(center[3]) : center.l;

      if (centerHigh === Math.max(...win.map(x => Array.isArray(x) ? parseFloat(x[2]) : x.h))) {
        pivots.push({ idx: i, type: 'H', price: centerHigh, time: Array.isArray(center) ? center[0] : center.t });
      } else if (centerLow === Math.min(...win.map(x => Array.isArray(x) ? parseFloat(x[3]) : x.l))) {
        pivots.push({ idx: i, type: 'L', price: centerLow, time: Array.isArray(center) ? center[0] : center.t });
      }
    }
    return pivots;
  }

  /**
   * 3. 增强的扫荡检测（15M wicks + 快速回归）
   */
  detectSweep(kl15m, orderBlock) {
    // 查看最近N根K线
    const recent = kl15m.slice(-this.config.sweepLookbackBars);
    for (let i = recent.length - 1; i >= 0; i--) {
      const bar = recent[i];

      // 支持数组格式
      const barHigh = Array.isArray(bar) ? parseFloat(bar[2]) : bar.h;
      const barLow = Array.isArray(bar) ? parseFloat(bar[3]) : bar.l;
      const barClose = Array.isArray(bar) ? parseFloat(bar[4]) : bar.c;

      // buy-side sweep: 下影线低于块底部但收盘高于它
      if (barLow < orderBlock.bottom && barClose > orderBlock.bottom) {
        return { swept: true, direction: 'below', extreme: barLow, confidence: 0.8 };
      }
      // sell-side sweep: 上影线高于块顶部但收盘低于它
      if (barHigh > orderBlock.top && barClose < orderBlock.top) {
        return { swept: true, direction: 'above', extreme: barHigh, confidence: 0.8 };
      }
    }
    return { swept: false, direction: null, extreme: null, confidence: 0 };
  }

  /**
   * 4. 增强的订单块检测 - 包含被扫后回归验证
   */
  analyzeOrderBlocks(kl4h) {
    const recent = kl4h.slice(-24);
    const blocks = [];

    for (let i = 0; i < recent.length - 2; i++) {
      const window = recent.slice(i, i + 3);
      // 支持数组格式
      const top = Math.max(...window.map(k => Array.isArray(k) ? parseFloat(k[2]) : k.h));
      const bot = Math.min(...window.map(k => Array.isArray(k) ? parseFloat(k[3]) : k.l));
      const range = top - bot;
      const avgPrice = this.sma(window.map(k => Array.isArray(k) ? parseFloat(k[4]) : k.c));

      if (range / avgPrice < 0.05) { // 进一步放宽到5%
        blocks.push({ top, bottom: bot, center: (top + bot) / 2, createdIdx: i });
      }
    }

    if (!blocks.length) return { valid: false, block: null, score: 0 };

    const block = blocks[blocks.length - 1];
    const ageBars = recent.length - 1 - block.createdIdx;
    if (ageBars > this.config.orderBlockMaxAge) return { valid: false, block, score: 0 };

    // 检查是否被扫荡并重新进入
    let sweptIdx = -1;
    const last12 = kl4h.slice(-12);
    for (let i = 0; i < last12.length; i++) {
      const k = last12[i];
      const kLow = Array.isArray(k) ? parseFloat(k[3]) : k.l;
      const kHigh = Array.isArray(k) ? parseFloat(k[2]) : k.h;
      const kClose = Array.isArray(k) ? parseFloat(k[4]) : k.c;

      if (kLow < block.bottom && kClose > block.bottom) sweptIdx = i;
      if (kHigh > block.top && kClose < block.top) sweptIdx = i;
    }

    let reentryConfirmed = false;
    if (sweptIdx >= 0) {
      const post = last12.slice(sweptIdx + 1, sweptIdx + 4);
      if (post.length) {
        const ok = post.some(b => {
          const bClose = Array.isArray(b) ? parseFloat(b[4]) : b.c;
          return bClose >= block.bottom && bClose <= block.top;
        });
        reentryConfirmed = ok;
      }
    } else {
      const latest = this.last(kl4h);
      const latestClose = Array.isArray(latest) ? parseFloat(latest[4]) : latest.c;
      reentryConfirmed = (latestClose >= block.bottom && latestClose <= block.top);
    }

    const score = reentryConfirmed ? 20 : 8;
    return { valid: reentryConfirmed, block, score, sweptIdx };
  }

  /**
   * 5. 成交量放大检测
   */
  analyzeVolumeExpansion(kl15m) {
    const vols = kl15m.map(k => Array.isArray(k) ? parseFloat(k[5]) : k.v);
    if (vols.length < 10) return { score: 0 };
    const avg = this.sma(vols.slice(-10));
    const lastVol = Array.isArray(this.last(kl15m)) ? parseFloat(this.last(kl15m)[5]) : this.last(kl15m).v;
    return { score: lastVol > avg * this.config.volumeExpansionMultiplier ? 1 : 0 };
  }

  /**
   * 6. 自适应止损倍数计算
   */
  calcStopMultiplier(confidence, opts = {}) {
    const { minMult = this.config.minStopMultiplier, maxMult = this.config.maxStopMultiplier } = opts;
    return maxMult - (maxMult - minMult) * confidence;
  }

  /**
   * 7. 仓位管理
   */
  positionSizing(totalScore, historicalWinRate = 0.5, accountUSD = 10000) {
    const scoreFactor = totalScore / 100;
    const riskPct = this.config.baseRiskPercent +
      (this.config.maxRiskPercent - this.config.baseRiskPercent) *
      (0.5 * scoreFactor + 0.5 * historicalWinRate);
    const posUSD = accountUSD * riskPct;
    return Math.max(1, posUSD);
  }

  /**
   * 8. 等待确认
   */
  async waitForConfirmation(symbol, confirmationBars, kl15m_current, block, opts = {}) {
    const { needDirection = 'below' } = opts;
    let k15 = kl15m_current.slice();

    for (let i = 0; i < confirmationBars; i++) {
      const lastCandle = this.last(k15);
      const lastTime = Array.isArray(lastCandle) ? lastCandle[0] : lastCandle.t;
      const nextCloseTs = lastTime + 15 * 60 * 1000;
      const waitMs = Math.max(0, nextCloseTs - Date.now() + 1000);

      if (waitMs > 0) await this.sleep(Math.min(waitMs, 60 * 1000));

      const fresh = await this.fetchKlines(symbol, '15m', 10);
      const existingT = new Set(k15.map(x => Array.isArray(x) ? x[0] : x.t));
      const newOnes = fresh.filter(x => {
        const xTime = Array.isArray(x) ? x[0] : x.t;
        return !existingT.has(xTime);
      });

      if (newOnes.length) {
        k15 = k15.concat(newOnes);
      }

      const lastC = this.last(k15);
      const lastCClose = Array.isArray(lastC) ? parseFloat(lastC[4]) : lastC.c;
      const lastCVol = Array.isArray(lastC) ? parseFloat(lastC[5]) : lastC.v;
      const recentVolAvg = this.sma(k15.slice(-6).map(x => Array.isArray(x) ? parseFloat(x[5]) : x.v));
      const volOk = lastCVol >= recentVolAvg * 0.5;

      if (needDirection === 'below') {
        if (lastCClose > block.bottom && volOk) return { confirmed: true, barsWaited: i + 1 };
      } else if (needDirection === 'above') {
        if (lastCClose < block.top && volOk) return { confirmed: true, barsWaited: i + 1 };
      } else {
        if (volOk) return { confirmed: true, barsWaited: i + 1 };
      }
    }

    return { confirmed: false, barsWaited: confirmationBars };
  }

  /**
   * 9. 遥测日志记录
   */
  telemetryLog(obj) {
    const line = JSON.stringify(obj) + '\n';
    fs.appendFileSync(this.telemetryFile, line);
  }

  /**
   * 辅助方法
   */
  last(arr, n = 1) {
    return arr[arr.length - n];
  }

  sma(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  clamp(v, a = 0, b = 1) {
    return Math.max(a, Math.min(b, v));
  }

  sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  nowStr() {
    return new Date().toISOString();
  }

  async fetchKlines(symbol, interval, limit) {
    return await this.binanceAPI.getKlines(symbol, interval, limit);
  }

  /**
   * 10. 主信号生成函数 - 门槛+容忍逻辑
   */
  async generateSignalWithConfirmation(symbol, opts = {}) {
    const {
      confirmationBars = this.config.confirmationBars,
      minEngulfStrength = this.config.minEngulfStrength,
      minHarmonicScore = this.config.minHarmonicScore,
      accountUSD = 10000,
      historicalWinRate = 0.5
    } = opts;

    try {
      // 获取K线数据
      const [kl1d, kl4h, kl15m] = await Promise.all([
        this.fetchKlines(symbol, '1d', 60),
        this.fetchKlines(symbol, '4h', 60),
        this.fetchKlines(symbol, '15m', 200)
      ]);

      // 日线趋势分析
      const lastPrice1D = Array.isArray(this.last(kl1d)) ? parseFloat(this.last(kl1d)[4]) : this.last(kl1d).c;
      const price20BarsAgo = Array.isArray(kl1d[kl1d.length - 20]) ? parseFloat(kl1d[kl1d.length - 20][4]) : kl1d[kl1d.length - 20].c;
      const trendChange = (lastPrice1D - price20BarsAgo) / price20BarsAgo;
      const trend = trendChange > this.config.trendChangeThreshold ? 'UP' :
        trendChange < -this.config.trendChangeThreshold ? 'DOWN' : 'RANGE';
      const trendScore = (trend === 'RANGE') ? 0 : 25;

      // 订单块检测
      const orderBlockRes = this.analyzeOrderBlocks(kl4h);
      if (!orderBlockRes.block) {
        return { symbol, signal: 'HOLD', reason: 'no_order_block' };
      }

      // 扫荡检测
      const sweepRes = this.detectSweep(kl15m, {
        low: orderBlockRes.block.bottom,
        high: orderBlockRes.block.top
      });
      if (!sweepRes.swept) {
        return { symbol, signal: 'HOLD', reason: 'no_sweep' };
      }

      // 吞没形态检测
      const engulf = this.analyzeEngulfing(kl15m);

      // 谐波形态检测
      const harmonic = this.detectHarmonicPattern(kl15m);

      // 门槛+容忍逻辑
      const gatePass = (trend !== 'RANGE') && orderBlockRes.valid && sweepRes.swept;
      const secondaryPass = (engulf.strength >= minEngulfStrength) || (harmonic.score >= minHarmonicScore);

      const reasons = [];
      reasons.push(`trend=${trend} change=${(trendChange * 100).toFixed(2)}%`);
      reasons.push(`orderBlock.valid=${orderBlockRes.valid}`);
      reasons.push(`sweep.dir=${sweepRes.direction} conf=${sweepRes.confidence}`);
      reasons.push(`engulf=${engulf.type} strength=${engulf.strength.toFixed(2)}`);
      reasons.push(`harmonic=${harmonic.type} score=${harmonic.score.toFixed(3)} rmse=${harmonic.rmse?.toFixed(4)}`);

      if (!gatePass) {
        return { symbol, signal: 'HOLD', reason: 'gate_failed', reasons };
      }

      if (!secondaryPass) {
        return { symbol, signal: 'WATCH', reason: 'secondary_failed', reasons, data: { engulf, harmonic } };
      }

      // 等待确认
      const confirmResult = await this.waitForConfirmation(
        symbol, confirmationBars, kl15m, orderBlockRes.block,
        { needDirection: sweepRes.direction }
      );

      if (!confirmResult.confirmed) {
        return { symbol, signal: 'WATCH', reason: 'not_confirmed', reasons, confirmResult };
      }

      // 计算总分和置信度
      const w = { trend: 0.25, orderBlock: 0.2, engulf: 0.15, htfSweep: 0.15, volume: 0.05, harmonic: 0.2 };
      const volScore = this.analyzeVolumeExpansion(kl15m).score / 5;
      const totalScore = Math.round((w.trend * (trendScore / 25) + w.orderBlock * (orderBlockRes.score / 20) +
        w.engulf * engulf.strength + w.htfSweep * sweepRes.confidence + w.volume * volScore + w.harmonic * harmonic.score) * 100);

      const confidence = this.clamp(harmonic.score * 0.6 + engulf.strength * 0.4, 0, 1);

      // 计算止损和仓位
      const atr15 = this.computeATRFromKlines(kl15m, 14) || 0;
      const stopMult = this.calcStopMultiplier(confidence);
      const stopDistance = atr15 * stopMult;
      const positionUSD = this.positionSizing(totalScore, historicalWinRate, accountUSD);

      // 确定信号方向
      const lastPrice = Array.isArray(this.last(kl15m)) ? parseFloat(this.last(kl15m)[4]) : this.last(kl15m).c;
      const signalDir = (sweepRes.direction === 'below' && trend === 'UP') ? 'BUY' :
        (sweepRes.direction === 'above' && trend === 'DOWN') ? 'SELL' :
          (engulf.type === 'BULL' ? 'BUY' : engulf.type === 'BEAR' ? 'SELL' : 'BUY');

      // 遥测记录
      this.telemetryLog({
        ts: this.nowStr(),
        symbol,
        totalScore,
        confidence,
        trend,
        orderBlock: orderBlockRes.block,
        sweepRes,
        engulf,
        harmonic,
        atr15,
        stopMult,
        positionUSD,
        signalDir,
        gatePass,
        secondaryPass,
        confirmResult
      });

      return {
        symbol,
        signal: signalDir,
        totalScore,
        confidence,
        entryPrice: lastPrice,
        stopLoss: signalDir === 'BUY' ? lastPrice - stopDistance : lastPrice + stopDistance,
        takeProfit: signalDir === 'BUY' ? lastPrice + stopDistance * 2 : lastPrice - stopDistance * 2,
        positionUSD,
        reasons,
        harmonic,
        engulf,
        sweepRes,
        orderBlock: orderBlockRes.block
      };

    } catch (error) {
      logger.error(`ICT策略信号生成失败: ${error.message}`);
      return { symbol, signal: 'HOLD', reason: 'error', error: error.message };
    }
  }

  /**
   * 执行策略分析
   */
  async execute(symbol) {
    try {
      const result = await this.generateSignalWithConfirmation(symbol, {
        confirmationBars: this.config.confirmationBars,
        minEngulfStrength: this.config.minEngulfStrength,
        minHarmonicScore: this.config.minHarmonicScore,
        historicalWinRate: 0.52,
        accountUSD: 20000
      });

      logger.info(`ICT优化策略分析完成 - ${symbol}: ${result.signal}`);
      return result;
    } catch (error) {
      logger.error(`ICT优化策略执行失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 15M入场有效性判断 - 实现门槛+容忍逻辑
   * 基于文档要求：OrderBlock && Sweep && (Engulfing >= 0.6 || Harmonic >= 0.6)
   */
  async check15MEntryValidity(symbol, opts = {}) {
    const {
      minEngulfStrength = this.config.minEngulfStrength,
      minHarmonicScore = this.config.minHarmonicScore
    } = opts;

    try {
      // 获取K线数据
      const [kl1d, kl4h, kl15m] = await Promise.all([
        this.fetchKlines(symbol, '1d', 60),
        this.fetchKlines(symbol, '4h', 60),
        this.fetchKlines(symbol, '15m', 200)
      ]);

      // 1. 日线趋势检查（门槛1）
      const lastPrice1D = Array.isArray(this.last(kl1d)) ? parseFloat(this.last(kl1d)[4]) : this.last(kl1d).c;
      const price20BarsAgo = Array.isArray(kl1d[kl1d.length - 20]) ? parseFloat(kl1d[kl1d.length - 20][4]) : kl1d[kl1d.length - 20].c;
      const trendChange = (lastPrice1D - price20BarsAgo) / price20BarsAgo;
      const trend = trendChange > this.config.trendChangeThreshold ? 'UP' :
        trendChange < -this.config.trendChangeThreshold ? 'DOWN' : 'RANGE';

      if (trend === 'RANGE') {
        return { valid: false, reason: 'trend_range', details: { trend, trendChange: trendChange * 100 } };
      }

      // 2. 订单块检查（门槛2）
      const orderBlockRes = this.analyzeOrderBlocks(kl4h);
      if (!orderBlockRes || !orderBlockRes.block || !orderBlockRes.valid) {
        return { valid: false, reason: 'no_valid_order_block', details: { orderBlockRes: orderBlockRes || 'undefined' } };
      }

      // 3. 扫荡检测（门槛3）
      const sweepRes = this.detectSweep(kl15m, {
        low: orderBlockRes.block.bottom,
        high: orderBlockRes.block.top
      });
      if (!sweepRes || !sweepRes.swept) {
        return { valid: false, reason: 'no_sweep', details: { sweepRes: sweepRes || 'undefined' } };
      }

      // 4. 吞没形态检测（容忍条件1）
      const engulf = this.analyzeEngulfing(kl15m);
      if (!engulf) {
        return { valid: false, reason: 'engulf_analysis_failed', details: { engulf: 'undefined' } };
      }

      // 5. 谐波形态检测（容忍条件2）
      const harmonic = this.detectHarmonicPattern(kl15m);
      if (!harmonic) {
        return { valid: false, reason: 'harmonic_analysis_failed', details: { harmonic: 'undefined' } };
      }

      // 6. 门槛+容忍逻辑：OrderBlock && Sweep && (Engulfing >= 0.6 || Harmonic >= 0.6)
      const gatePass = (trend !== 'RANGE') && orderBlockRes.valid && sweepRes.swept;
      const secondaryPass = (engulf.strength >= minEngulfStrength) || (harmonic.score >= minHarmonicScore);
      const valid = gatePass && secondaryPass;

      // 7. 构建详细信息
      const details = {
        trend,
        trendChange: trendChange * 100,
        orderBlock: {
          valid: orderBlockRes.valid,
          score: orderBlockRes.score,
          block: orderBlockRes.block
        },
        sweep: {
          swept: sweepRes.swept,
          direction: sweepRes.direction,
          confidence: sweepRes.confidence
        },
        engulfing: {
          type: engulf.type,
          strength: engulf.strength,
          meetsThreshold: engulf.strength >= minEngulfStrength
        },
        harmonic: {
          type: harmonic.type,
          score: harmonic.score,
          rmse: harmonic.rmse,
          meetsThreshold: harmonic.score >= minHarmonicScore
        },
        gatePass,
        secondaryPass,
        valid
      };

      return { valid, reason: valid ? 'valid' : 'invalid', details };
    } catch (error) {
      logger.error(`ICT 15M入场有效性检查错误 ${symbol}:`, error);
      return { valid: false, reason: 'error', error: error.message };
    }
  }
}

module.exports = ICTStrategyOptimized;
