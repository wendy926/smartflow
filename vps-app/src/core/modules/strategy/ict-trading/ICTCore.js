// ICTCore.js - ICT策略核心逻辑
// 实现高/中/低时间框架分析

const BinanceAPI = require('../../api/BinanceAPI');
const TechnicalIndicators = require('../../utils/TechnicalIndicators');

class ICTCore {
  constructor(database = null) {
    this.database = database;
  }

  /**
   * 高时间框架分析 (1D) - 判断市场整体趋势
   * @param {string} symbol - 交易对
   * @returns {Object} 1D趋势分析结果
   */
  async analyzeDailyTrend(symbol) {
    try {
      const data1D = await BinanceAPI.getKlines(symbol, '1d', 20);
      return this.detectTrend(data1D);
    } catch (error) {
      console.error(`1D趋势分析失败 [${symbol}]:`, error);
      return { trend: 'sideways', score: 0, error: error.message };
    }
  }

  /**
   * 中时间框架分析 (4H) - 识别并评分OB/FVG
   * @param {string} symbol - 交易对
   * @param {Object} dailyTrend - 1D趋势结果
   * @returns {Object} 4H分析结果
   */
  async analyzeMTF(symbol, dailyTrend) {
    try {
      const data4H = await BinanceAPI.getKlines(symbol, '4h', 250);
      const atr4h = this.calculateATR(data4H, 14);

      // OB检测
      const ob = this.detectOB(data4H, atr4h, 30);

      // FVG检测
      const fvg = this.detectFVG(data4H);

      // Sweep宏观速率确认
      const sweepHTF = this.detectSweepHTF(data4H, atr4h);

      return {
        obDetected: !!ob,
        fvgDetected: !!fvg,
        ob,
        fvg,
        sweepHTF,
        atr4h,
        data4H
      };
    } catch (error) {
      console.error(`4H分析失败 [${symbol}]:`, error);
      return {
        obDetected: false,
        fvgDetected: false,
        ob: null,
        fvg: null,
        sweepHTF: false,
        atr4h: 0,
        error: error.message
      };
    }
  }

  /**
   * 低时间框架分析 (15m) - 找精确入场点
   * @param {string} symbol - 交易对
   * @param {Object} mtfResult - 4H分析结果
   * @returns {Object} 15m分析结果
   */
  async analyzeLTF(symbol, mtfResult) {
    try {
      const data15M = await BinanceAPI.getKlines(symbol, '15m', 50);
      const atr15 = this.calculateATR(data15M, 14);

      // OB/FVG年龄检查 (≤2天)
      const ageCheck = this.checkOBAge(mtfResult.ob, mtfResult.fvg);
      if (!ageCheck.valid) {
        return {
          entrySignal: false,
          reason: `OB/FVG年龄超过2天: ${ageCheck.age}天`
        };
      }

      // 吞没形态检测
      const engulfing = this.detectEngulfing(data15M, atr15, mtfResult.ob ? 'up' : 'down');

      // Sweep微观速率确认
      const sweepLTF = this.detectSweepLTF(data15M, atr15);

      // 成交量确认
      const volumeConfirm = this.checkVolumeConfirmation(data15M);

      if (engulfing.detected && sweepLTF.detected && volumeConfirm) {
        return {
          entrySignal: true,
          entryPrice: data15M[data15M.length - 1].close,
          engulfing,
          sweepLTF,
          volumeConfirm,
          atr15,
          data15M
        };
      }

      return {
        entrySignal: false,
        reason: '15m入场条件不满足',
        details: {
          engulfing: engulfing.detected,
          sweepLTF: sweepLTF.detected,
          volumeConfirm
        }
      };
    } catch (error) {
      console.error(`15m分析失败 [${symbol}]:`, error);
      return {
        entrySignal: false,
        reason: `15m分析失败: ${error.message}`
      };
    }
  }

  /**
   * 趋势检测 - 基于过去N天收盘价
   * @param {Array} data - 1D K线数据
   * @param {number} lookback - 回看天数
   * @returns {Object} 趋势分析结果
   */
  detectTrend(data, lookback = 20) {
    try {
      const closes = data.map(d => parseFloat(d[4])); // 收盘价
      const last = closes.slice(-lookback);

      if (last.length < lookback) {
        return { trend: 'sideways', score: 0, error: '数据不足' };
      }

      const first = last[0];
      const lastPrice = last[last.length - 1];

      let trend = 'sideways';
      let score = 0;

      if (lastPrice > first * 1.02) { // 2%以上涨幅
        trend = 'up';
        score = 3;
      } else if (lastPrice < first * 0.98) { // 2%以上跌幅
        trend = 'down';
        score = 3;
      } else {
        // 计算趋势强度
        const upDays = last.filter((price, i) => i > 0 && price > last[i - 1]).length;
        const downDays = last.filter((price, i) => i > 0 && price < last[i - 1]).length;

        if (upDays > downDays * 1.5) {
          trend = 'up';
          score = 2;
        } else if (downDays > upDays * 1.5) {
          trend = 'down';
          score = 2;
        }
      }

      return { trend, score, first, last: lastPrice };
    } catch (error) {
      return { trend: 'sideways', score: 0, error: error.message };
    }
  }

  /**
   * OB检测 - 按照ICT文档实现
   * @param {Array} data4H - 4H K线数据
   * @param {number} atr4h - 4H ATR值
   * @param {number} maxAgeDays - 最大年龄(天)
   * @returns {Object|null} OB对象或null
   */
  detectOB(data4H, atr4h, maxAgeDays = 30) {
    try {
      if (data4H.length < 2) return null;

      const lastIndex = data4H.length - 2;
      const obBar = data4H[lastIndex];
      const ob = {
        low: parseFloat(obBar[3]), // 最低价
        high: parseFloat(obBar[2]), // 最高价
        time: new Date(obBar[0]).toISOString()
      };

      // 过滤小OB: OB高度 ≥ 0.25 × ATR(4H)
      const obHeight = ob.high - ob.low;
      if (obHeight < 0.25 * atr4h) {
        return null;
      }

      // 过滤过期OB: OB年龄 ≤ 30天
      const now = new Date();
      const obTime = new Date(obBar[0]);
      const ageDays = (now - obTime) / (1000 * 3600 * 24);
      if (ageDays > maxAgeDays) {
        return null;
      }

      return {
        ...ob,
        height: obHeight,
        ageDays: Math.round(ageDays * 100) / 100
      };
    } catch (error) {
      console.error('OB检测失败:', error);
      return null;
    }
  }

  /**
   * FVG检测 - 按照ICT文档实现
   * @param {Array} data4H - 4H K线数据
   * @returns {Object|null} FVG对象或null
   */
  detectFVG(data4H) {
    try {
      if (data4H.length < 3) return null;

      // 检查最近3根K线是否有FVG
      for (let i = data4H.length - 3; i < data4H.length - 1; i++) {
        if (i + 2 >= data4H.length) break;

        const prev = data4H[i];
        const curr = data4H[i + 1];
        const next = data4H[i + 2];

        if (!prev || !curr || !next) continue;

        const prevHigh = parseFloat(prev[2]);
        const currLow = parseFloat(curr[3]);
        const nextHigh = parseFloat(next[2]);

        // 上升FVG: 前一根高点 < 当前低点 < 下一根高点
        if (prevHigh < currLow && currLow < nextHigh) {
          return {
            low: prevHigh,
            high: currLow,
            time: new Date(curr[0]).toISOString(),
            type: 'bullish',
            height: currLow - prevHigh
          };
        }

        const prevLow = parseFloat(prev[3]);
        const currHigh = parseFloat(curr[2]);
        const nextLow = parseFloat(next[3]);

        // 下降FVG: 前一根低点 > 当前高点 > 下一根低点
        if (prevLow > currHigh && currHigh > nextLow) {
          return {
            low: currHigh,
            high: prevLow,
            time: new Date(curr[0]).toISOString(),
            type: 'bearish',
            height: prevLow - currHigh
          };
        }
      }

      return null;
    } catch (error) {
      console.error('FVG检测失败:', error);
      return null;
    }
  }

  /**
   * Sweep宏观速率检测 (4H) - 按照ICT文档实现
   * @param {Array} data4H - 4H K线数据
   * @param {number} atr4h - 4H ATR值
   * @returns {boolean} 是否有效sweep
   */
  detectSweepHTF(data4H, atr4h) {
    try {
      if (data4H.length < 20) return false;

      // 找前17根K线的最高点作为极值点（排除最后3根K线）
      const previous17 = data4H.slice(-20, -3);
      const extreme = Math.max(...previous17.map(b => parseFloat(b[2])));

      // 检查最近3根4H是否刺破并收回
      const last3 = data4H.slice(-3);
      let exceed = 0;
      let barsToReturn = 0;

      // 找到刺破extreme的K线
      for (let i = 0; i < last3.length; i++) {
        const high = parseFloat(last3[i][2]);
        if (high > extreme) {
          exceed = high - extreme;
          barsToReturn = i + 1;
          break;
        }
      }

      if (barsToReturn === 0) return false;

      // 检查是否在2根内收回
      for (let i = barsToReturn; i < last3.length; i++) {
        const close = parseFloat(last3[i][4]);
        if (close < extreme) {
          const sweepSpeed = exceed / barsToReturn;
          // 刺破幅度 ÷ bar数 ≥ 0.4 × ATR(4H) → 有效sweep
          return sweepSpeed >= 0.4 * atr4h && barsToReturn <= 2;
        }
      }

      return false;
    } catch (error) {
      console.error('4H Sweep检测失败:', error);
      return false;
    }
  }

  /**
   * Sweep微观速率检测 (15m)
   * @param {Array} data15M - 15m K线数据
   * @param {number} atr15 - 15m ATR值
   * @returns {Object} Sweep检测结果
   */
  detectSweepLTF(data15M, atr15) {
    try {
      if (data15M.length < 20) return { detected: false, speed: 0 };

      // 找前15根K线的最高点作为极值点（排除最后5根K线）
      const previous15 = data15M.slice(-20, -5);
      const extreme = Math.max(...previous15.map(b => parseFloat(b[2])));

      // 检查是否在≤3根15m内被刺破并收回
      const last5 = data15M.slice(-5);
      let barsToReturn = 0;
      let exceed = 0;

      for (let i = 0; i < last5.length; i++) {
        const high = parseFloat(last5[i][2]);
        if (high > extreme) {
          exceed = high - extreme;
          barsToReturn = i + 1;
          break;
        }
      }

      if (barsToReturn === 0) return { detected: false, speed: 0 };

      // 检查是否在3根内收回
      for (let i = barsToReturn; i < last5.length; i++) {
        const close = parseFloat(last5[i][4]);
        if (close < extreme) {
          const sweepSpeed = exceed / barsToReturn;
          // sweep幅度 ÷ bar数 ≥ 0.2 × ATR(15m)
          const isValid = sweepSpeed >= 0.2 * atr15 && barsToReturn <= 3;
          return {
            detected: isValid,
            speed: sweepSpeed,
            exceed,
            barsToReturn
          };
        }
      }

      return { detected: false, speed: 0 };
    } catch (error) {
      console.error('15m Sweep检测失败:', error);
      return { detected: false, speed: 0 };
    }
  }

  /**
   * 吞没形态检测 - 按照ICT文档实现
   * @param {Array} data15M - 15m K线数据
   * @param {number} atr15 - 15m ATR值
   * @param {string} trend - 趋势方向
   * @returns {Object} 吞没形态检测结果
   */
  detectEngulfing(data15M, atr15, trend = "up") {
    try {
      if (data15M.length < 2) return { detected: false, reason: '数据不足' };

      const prev = data15M[data15M.length - 2];
      const curr = data15M[data15M.length - 1];

      const prevOpen = parseFloat(prev[1]);
      const prevClose = parseFloat(prev[4]);
      const currOpen = parseFloat(curr[1]);
      const currClose = parseFloat(curr[4]);

      const prevBody = Math.abs(prevClose - prevOpen);
      const currBody = Math.abs(currClose - currOpen);

      // 当前K线实体必须 ≥ 0.6 × ATR(15m)
      if (currBody < 0.6 * atr15) {
        return { detected: false, reason: '实体太小' };
      }

      // 当前K线实体必须 ≥ 1.5 × 前一根实体
      if (currBody < 1.5 * prevBody) {
        return { detected: false, reason: '实体比例不足' };
      }

      let engulfing = false;
      if (trend === "up") {
        // 多头吞没：当前收盘 > 前一根开盘 && 当前开盘 < 前一根收盘
        engulfing = currClose > prevOpen && currOpen < prevClose;
      } else {
        // 空头吞没：当前收盘 < 前一根开盘 && 当前开盘 > 前一根收盘
        engulfing = currClose < prevOpen && currOpen > prevClose;
      }

      return {
        detected: engulfing,
        prevBody,
        currBody,
        bodyRatio: currBody / prevBody,
        trend
      };
    } catch (error) {
      console.error('吞没形态检测失败:', error);
      return { detected: false, reason: error.message };
    }
  }

  /**
   * OB/FVG年龄检查
   * @param {Object} ob - OB对象
   * @param {Object} fvg - FVG对象
   * @returns {Object} 年龄检查结果
   */
  checkOBAge(ob, fvg) {
    const now = new Date();
    let maxAge = 0;
    let source = 'none';

    if (ob && ob.time) {
      const obAge = (now - new Date(ob.time)) / (1000 * 3600 * 24);
      if (obAge > maxAge) {
        maxAge = obAge;
        source = 'ob';
      }
    }

    if (fvg && fvg.time) {
      const fvgAge = (now - new Date(fvg.time)) / (1000 * 3600 * 24);
      if (fvgAge > maxAge) {
        maxAge = fvgAge;
        source = 'fvg';
      }
    }

    return {
      valid: maxAge <= 2, // ≤2天
      age: Math.round(maxAge * 100) / 100,
      source
    };
  }

  /**
   * 成交量确认检查
   * @param {Array} data15M - 15m K线数据
   * @returns {boolean} 是否成交量确认
   */
  checkVolumeConfirmation(data15M) {
    try {
      if (data15M.length < 20) return false;

      const volumes = data15M.map(d => parseFloat(d[5]));
      const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
      const currentVolume = volumes[volumes.length - 1];

      // 当前成交量 ≥ 1.2 × 20期平均成交量
      return currentVolume >= 1.2 * avgVolume;
    } catch (error) {
      console.error('成交量确认检查失败:', error);
      return false;
    }
  }

  /**
   * 计算ATR (Average True Range)
   * @param {Array} data - K线数据
   * @param {number} period - 周期
   * @returns {number} ATR值
   */
  calculateATR(data, period = 14) {
    try {
      if (data.length < period + 1) return 0;

      const trueRanges = [];
      for (let i = 1; i < data.length; i++) {
        const high = parseFloat(data[i][2]);
        const low = parseFloat(data[i][3]);
        const prevClose = parseFloat(data[i - 1][4]);

        const tr = Math.max(
          high - low,
          Math.abs(high - prevClose),
          Math.abs(low - prevClose)
        );
        trueRanges.push(tr);
      }

      // 计算ATR
      const atrValues = [];
      for (let i = period - 1; i < trueRanges.length; i++) {
        const slice = trueRanges.slice(i - period + 1, i + 1);
        const atr = slice.reduce((a, b) => a + b, 0) / period;
        atrValues.push(atr);
      }

      return atrValues[atrValues.length - 1] || 0;
    } catch (error) {
      console.error('ATR计算失败:', error);
      return 0;
    }
  }
}

module.exports = ICTCore;
