// modules/strategy/SmartFlowStrategy.js
// SmartFlow 交易策略核心模块 - 基于strategy-v2.md实现

const BinanceAPI = require('../api/BinanceAPI');
const TechnicalIndicators = require('../utils/TechnicalIndicators');
const { DataMonitor } = require('../monitoring/DataMonitor');

class SmartFlowStrategy {
  static dataMonitor = new DataMonitor();
  static dataManager = null; // 将在初始化时设置

  /**
   * 天级趋势判断 - 基于布林带带宽(BBW)扩张
   * @param {string} symbol - 交易对
   * @param {Object} symbolData - 可选的数据对象
   * @returns {Object} 天级趋势分析结果
   */
  static async analyzeDailyTrend(symbol, symbolData = null) {
    try {
      const klines = symbolData?.klines || await BinanceAPI.getKlines(symbol, '1d', 250);

      // 将数组格式的K线数据转换为对象格式
      const klinesObjects = klines.map(k => ({
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));

      const closes = klinesObjects.map(k => k.close);

      // 计算移动平均线
      const ma20 = TechnicalIndicators.calculateSMA(closes, 20);
      const ma50 = TechnicalIndicators.calculateSMA(closes, 50);
      const ma200 = TechnicalIndicators.calculateSMA(closes, 200);

      // 计算布林带带宽扩张
      let bbwExpanding = false;
      let bbwError = null;
      try {
        bbwExpanding = TechnicalIndicators.isBBWExpanding(closes, 20, 2);
      } catch (error) {
        bbwError = error.message;
        this.dataMonitor.recordDataQualityIssue(symbol, '日线趋势分析', `BBW计算失败: ${error.message}`);
        console.error(`BBW计算失败 ${symbol}:`, error);
      }

      const latestClose = closes[closes.length - 1];
      const latestMA20 = ma20[ma20.length - 1];
      const latestMA50 = ma50[ma50.length - 1];
      const latestMA200 = ma200[ma200.length - 1];

      let trend = '震荡/无趋势';
      let trendStrength = 'WEAK';

      // 按照strategy-v2.md的天级趋势判断逻辑
      // 1. 趋势基础条件（必须满足）
      // 2. 趋势强度条件（BBW扩张）

      // 多头趋势基础条件：价格在MA200上方 + MA20 > MA50
      const uptrendBasic = latestClose > latestMA200 && latestMA20 > latestMA50;
      // 空头趋势基础条件：价格在MA200下方 + MA20 < MA50  
      const downtrendBasic = latestClose < latestMA200 && latestMA20 < latestMA50;

      // 趋势强度条件：BBW扩张
      const strengthCondition = !bbwError && bbwExpanding;

      if (uptrendBasic && strengthCondition) {
        trend = '多头趋势';
        trendStrength = 'STRONG';
      }
      else if (downtrendBasic && strengthCondition) {
        trend = '空头趋势';
        trendStrength = 'STRONG';
      }
      // 如果只有基础条件满足，但强度条件不满足，仍然认为是趋势但强度较弱
      else if (uptrendBasic) {
        trend = '多头趋势';
        trendStrength = 'WEAK';
      }
      else if (downtrendBasic) {
        trend = '空头趋势';
        trendStrength = 'WEAK';
      }

      // 记录指标计算错误
      if (bbwError) {
        this.dataMonitor.recordDataQualityIssue(symbol, '日线趋势分析', `BBW计算错误: ${bbwError}`);
      }

      return {
        trend,
        trendStrength,
        ma20: latestMA20,
        ma50: latestMA50,
        ma200: latestMA200,
        bbwExpanding,
        currentPrice: latestClose,
        dataValid: true
      };
    } catch (error) {
      console.error(`日线趋势分析失败 ${symbol}:`, error);
      return {
        trend: 'ERROR',
        dataValid: false,
        error: error.message
      };
    }
  }

  /**
   * 小时级趋势加强判断 - 多因子打分系统
   * 严格按照strategy-v2.md中的calculateTrendScore函数实现
   * @param {string} symbol - 交易对
   * @param {string} trend - 天级趋势结果
   * @param {Object} symbolData - 可选的数据对象
   * @returns {Object} 小时级趋势分析结果
   */
  static async analyzeHourlyConfirmation(symbol, trend, symbolData = null) {
    try {
      console.log(`🔍 [${symbol}] 开始获取小时级数据...`);
      const klines = symbolData?.klines || await BinanceAPI.getKlines(symbol, '1h', 50);
      const funding = symbolData?.funding || await BinanceAPI.getFundingRate(symbol);
      const openInterestHist = symbolData?.openInterestHist || await BinanceAPI.getOpenInterestHist(symbol, '1h', 6);

      // 将数组格式的K线数据转换为对象格式
      const klinesObjects = klines.map(k => ({
        time: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));

      let score = 0;
      const scoreDetails = {};

      // 1. VWAP方向 - 严格按照文档逻辑
      const vwap = TechnicalIndicators.calculateVWAP(klinesObjects);
      const lastClose = klinesObjects[klinesObjects.length - 1].close;
      if ((trend === "多头趋势" && lastClose > vwap) ||
        (trend === "空头趋势" && lastClose < vwap)) {
        score += 1;
        scoreDetails.vwapDirection = trend === "多头趋势" ? 'BULLISH' : 'BEARISH';
      } else {
        scoreDetails.vwapDirection = 'NEUTRAL';
      }

      // 2. 突破结构 - 严格按照文档逻辑
      const breakout = TechnicalIndicators.calculateBreakout(klinesObjects, 20);
      if ((trend === "多头趋势" && breakout.breakoutLong) ||
        (trend === "空头趋势" && breakout.breakoutShort)) {
        score += 1;
        scoreDetails.breakout = trend === "多头趋势" ? 'UP' : 'DOWN';
      } else {
        scoreDetails.breakout = 'NONE';
      }

      // 3. 成交量确认 - 严格按照文档逻辑
      if (TechnicalIndicators.isVolumeConfirmed(klinesObjects)) {
        score += 1;
        scoreDetails.volume = 'CONFIRMED';
      } else {
        scoreDetails.volume = 'WEAK';
      }

      // 4. OI确认 - 严格按照文档逻辑
      const oi = openInterestHist[openInterestHist.length - 1].sumOpenInterest;
      const oiChange = openInterestHist.length > 1 ?
        ((openInterestHist[openInterestHist.length - 1].sumOpenInterest - openInterestHist[0].sumOpenInterest) / openInterestHist[0].sumOpenInterest) * 100 : 0;

      if (trend === "多头趋势" && oiChange >= 2) {
        score += 1;
        scoreDetails.oi = 'INCREASING';
      } else if (trend === "空头趋势" && oiChange <= -2) {
        score += 1;
        scoreDetails.oi = 'DECREASING';
      } else {
        scoreDetails.oi = 'STABLE';
      }

      // 5. 资金费率 - 严格按照文档逻辑
      const fundingRate = parseFloat(funding[0].fundingRate);
      if (Math.abs(fundingRate) <= 0.0015) {
        score += 1;
        scoreDetails.funding = 'LOW';
      } else {
        scoreDetails.funding = 'HIGH';
      }

      // 6. Delta确认 - 严格按照文档逻辑
      if ((trend === "多头趋势" && TechnicalIndicators.isDeltaPositive(klinesObjects)) ||
        (trend === "空头趋势" && !TechnicalIndicators.isDeltaPositive(klinesObjects))) {
        score += 1;
        scoreDetails.delta = 'CONFIRMED';
      } else {
        scoreDetails.delta = 'WEAK';
      }

      // 最终判断 - 严格按照文档逻辑
      let action = "观望/不做";
      if (score >= 4) {
        action = trend === "多头趋势" ? "做多" : "做空";
      }

      // 判断信号强度
      let signalStrength = 'NONE';
      if (score >= 4) {
        signalStrength = 'STRONG';
      } else if (score >= 2) {
        signalStrength = 'MODERATE';
      }

      return {
        symbol,
        trend,
        score,
        action,
        signalStrength,
        scoreDetails,
        vwap: vwap,
        oiChange: oiChange,
        fundingRate: fundingRate,
        dataValid: true
      };
    } catch (error) {
      console.error(`小时确认分析失败 ${symbol}:`, error);
      return {
        symbol,
        trend,
        score: 0,
        action: "观望/不做",
        signalStrength: 'NONE',
        dataValid: false,
        error: error.message
      };
    }
  }

  /**
   * 15分钟级别入场判断 - 模式A和模式B
   * 严格按照strategy-v2.md中的calculateEntryAndRisk函数实现
   * @param {string} symbol - 交易对
   * @param {string} trend - 天级趋势结果
   * @param {number} score - 小时级得分
   * @param {Object} symbolData - 可选的数据对象
   * @returns {Object} 15分钟入场分析结果
   */
  static async analyze15mExecution(symbol, trend, score, symbolData = null, maxLossAmount = 100) {
    try {
      const klines = symbolData?.klines || await BinanceAPI.getKlines(symbol, '15m', 50);

      // 将数组格式的K线数据转换为对象格式
      const klinesObjects = klines.map(k => ({
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));

      const closes = klinesObjects.map(k => k.close);

      // 计算EMA
      const ema20 = TechnicalIndicators.calculateEMA(closes, 20);
      const ema50 = TechnicalIndicators.calculateEMA(closes, 50);

      // 计算ATR
      const atr = TechnicalIndicators.calculateATR(klinesObjects, 14);
      const lastATR = atr[atr.length - 1];

      // 严格按照文档中的calculateEntryAndRisk函数实现
      const last = klinesObjects[klinesObjects.length - 1];
      const prev = klinesObjects[klinesObjects.length - 2]; // setup candle
      const lastClose = last.close;
      const lastHigh = last.high;
      const lastLow = last.low;
      const setupHigh = prev.high;
      const setupLow = prev.low;

      let entrySignal = null;
      let stopLoss = null;
      let takeProfit = null;
      let mode = null;

      // 只在明确趋势且打分足够时考虑入场
      if (trend === "震荡/无趋势" || score < 2) {
        console.log(`⚠️ 不满足入场条件 [${symbol}]:`, { trend, score });
        return { entrySignal, stopLoss, takeProfit, mode, modeA: false, modeB: false, dataValid: true };
      }

      console.log(`🔍 开始计算入场信号 [${symbol}]:`, {
        trend,
        score,
        lastClose,
        lastHigh,
        lastLow,
        setupHigh,
        setupLow,
        supportLevel: Math.min(ema20[ema20.length - 1], ema50[ema50.length - 1]),
        resistanceLevel: Math.max(ema20[ema20.length - 1], ema50[ema50.length - 1])
      });

      // === 模式A：回踩确认 ===
      const supportLevel = Math.min(ema20[ema20.length - 1], ema50[ema50.length - 1]);
      const resistanceLevel = Math.max(ema20[ema20.length - 1], ema50[ema50.length - 1]);

      if (trend === "多头趋势" && lastClose <= supportLevel && lastClose > prev.low) {
        console.log(`🔍 模式A多头条件检查 [${symbol}]:`, {
          lastClose,
          supportLevel,
          prevLow: prev.low,
          lastHigh,
          setupHigh,
          condition1: lastClose <= supportLevel,
          condition2: lastClose > prev.low,
          condition3: lastHigh > setupHigh
        });
        // 回踩EMA确认
        if (lastHigh > setupHigh) {
          entrySignal = lastHigh;          // 入场价为突破setup高点
          stopLoss = Math.min(prev.low, lastClose - 1.2 * lastATR); // 取更远者
          takeProfit = entrySignal + 2 * (entrySignal - stopLoss); // 风报比2:1
          mode = "回踩确认A";
          console.log(`✅ 模式A多头触发 [${symbol}]:`, { entrySignal, stopLoss, takeProfit });
        }
      } else if (trend === "空头趋势" && lastClose >= resistanceLevel && lastClose < prev.high) {
        console.log(`🔍 模式A空头条件检查 [${symbol}]:`, {
          lastClose,
          resistanceLevel,
          prevHigh: prev.high,
          lastLow,
          setupLow,
          condition1: lastClose >= resistanceLevel,
          condition2: lastClose < prev.high,
          condition3: lastLow < setupLow
        });
        if (lastLow < setupLow) {
          entrySignal = lastLow;
          stopLoss = Math.max(prev.high, lastClose + 1.2 * lastATR);
          takeProfit = entrySignal - 2 * (stopLoss - entrySignal);
          mode = "回踩确认A";
          console.log(`✅ 模式A空头触发 [${symbol}]:`, { entrySignal, stopLoss, takeProfit });
        }
      }

      // === 模式B：动能突破 ===
      const avgVol = klinesObjects.slice(-21, -1).reduce((a, k) => a + k.volume, 0) / 20;
      const breakoutLong = lastHigh > setupHigh && last.volume >= 1.5 * avgVol;
      const breakoutShort = lastLow < setupLow && last.volume >= 1.5 * avgVol;

      if (!entrySignal) { // 如果模式A未触发
        if (trend === "多头趋势" && breakoutLong) {
          entrySignal = lastHigh;
          stopLoss = Math.min(prev.low, lastClose - 1.2 * lastATR);
          takeProfit = entrySignal + 2 * (entrySignal - stopLoss);
          mode = "动能突破B";
        } else if (trend === "空头趋势" && breakoutShort) {
          entrySignal = lastLow;
          stopLoss = Math.max(prev.high, lastClose + 1.2 * lastATR);
          takeProfit = entrySignal - 2 * (stopLoss - entrySignal);
          mode = "动能突破B";
        }
      }

      // 计算最大杠杆数和最小保证金（按照strategy-v2.md的逻辑）
      let maxLeverage = 0;
      let minMargin = 0;
      let stopLossDistance = 0;
      let atrValue = lastATR;

      if (entrySignal && stopLoss) {
        console.log(`🔍 开始计算 [${symbol}]:`, {
          entrySignal,
          stopLoss,
          trend,
          hasEntrySignal: !!entrySignal,
          hasStopLoss: !!stopLoss
        });
        
        // 计算止损距离X%
        if (trend === "多头趋势") {
          stopLossDistance = (entrySignal - stopLoss) / entrySignal;
        } else if (trend === "空头趋势") {
          stopLossDistance = (stopLoss - entrySignal) / entrySignal;
        }
        
        console.log(`🔍 止损距离计算 [${symbol}]:`, {
          trend,
          stopLossDistance,
          isPositive: stopLossDistance > 0
        });

        console.log(`📊 计算杠杆和保证金 [${symbol}]:`, {
          entrySignal,
          stopLoss,
          trend,
          stopLossDistance: (stopLossDistance * 100).toFixed(2) + '%',
          maxLossAmount
        });

        // 最大杠杆数Y：1/(X%+0.5%) 数值向下取整
        if (stopLossDistance > 0) {
          maxLeverage = Math.floor(1 / (stopLossDistance + 0.005));
        }

        // 保证金Z：M/(Y*X%) 数值向上取整（M为用户设置的最大损失金额）
        if (maxLeverage > 0 && stopLossDistance > 0) {
          minMargin = Math.ceil(maxLossAmount / (maxLeverage * stopLossDistance));
        }

        console.log(`📊 计算结果 [${symbol}]:`, {
          maxLeverage,
          minMargin,
          stopLossDistance: (stopLossDistance * 100).toFixed(2) + '%',
          atrValue
        });
      } else {
        console.log(`⚠️ 缺少必要数据 [${symbol}]:`, {
          entrySignal,
          stopLoss,
          hasEntrySignal: !!entrySignal,
          hasStopLoss: !!stopLoss
        });
      }

      return {
        entrySignal,
        stopLoss,
        takeProfit,
        mode,
        modeA: mode === '回踩确认A',
        modeB: mode === '动能突破B',
        maxLeverage,
        minMargin,
        stopLossDistance,
        atrValue,
        dataValid: true
      };
    } catch (error) {
      console.error(`15分钟执行分析失败 ${symbol}:`, error);
      return {
        entrySignal: null,
        stopLoss: null,
        takeProfit: null,
        mode: null,
        modeA: false,
        modeB: false,
        dataValid: false,
        error: error.message
      };
    }
  }

  /**
   * 综合分析 - 整合三个层级的分析结果
   * @param {string} symbol - 交易对
   * @returns {Object} 综合分析结果
   */
  static async analyzeAll(symbol, maxLossAmount = 100) {
    const startTime = Date.now();

    try {
      // 开始分析记录
      this.dataMonitor.startAnalysis(symbol);

      // 获取所有需要的数据
      const [klines, ticker, funding, openInterestHist, klines15m] = await Promise.all([
        BinanceAPI.getKlines(symbol, '1h', 50),
        BinanceAPI.get24hrTicker(symbol),
        BinanceAPI.getFundingRate(symbol),
        BinanceAPI.getOpenInterestHist(symbol, '1h', 6),
        BinanceAPI.getKlines(symbol, '15m', 50)
      ]);

      const symbolData = { klines, ticker, funding, openInterestHist, klines15m };

      // 记录原始数据
      const dailyKlines = await BinanceAPI.getKlines(symbol, '1d', 250);
      const dailyKlinesValid = dailyKlines && dailyKlines.length > 0;
      this.dataMonitor.recordRawData(symbol, '日线K线', dailyKlines, dailyKlinesValid);

      const klinesValid = klines && klines.length > 0;
      this.dataMonitor.recordRawData(symbol, '小时K线', klines, klinesValid);

      const tickerValid = ticker && ticker.lastPrice;
      this.dataMonitor.recordRawData(symbol, '24小时行情', ticker, tickerValid);

      const fundingValid = funding && Array.isArray(funding) && funding.length > 0 && funding[0].fundingRate;
      this.dataMonitor.recordRawData(symbol, '资金费率', funding, fundingValid);

      const oiValid = openInterestHist && openInterestHist.length > 0;
      this.dataMonitor.recordRawData(symbol, '持仓量历史', openInterestHist, oiValid);

      // 分析各个阶段 - 严格按照依赖关系
      let dailyTrend, hourlyConfirmation, execution15m;

      // 1. 先进行天级趋势判断
      try {
        dailyTrend = await this.analyzeDailyTrend(symbol, { klines: dailyKlines });
        console.log(`✅ 天级趋势分析完成 [${symbol}]:`, {
          trend: dailyTrend.trend,
          trendStrength: dailyTrend.trendStrength,
          dataValid: dailyTrend.dataValid
        });
      } catch (error) {
        console.error(`❌ 日线趋势分析失败 [${symbol}]:`, error.message);
        dailyTrend = { trend: 'UNKNOWN', trendStrength: 'WEAK', ma20: 0, ma50: 0, ma200: 0, dataValid: false };
      }

      // 2. 基于天级趋势结果进行小时级趋势加强判断
      try {
        console.log(`🔍 开始分析小时确认 [${symbol}]...`);
        hourlyConfirmation = await this.analyzeHourlyConfirmation(symbol, dailyTrend.trend, symbolData);
        console.log(`✅ 小时确认分析成功 [${symbol}]:`, {
          score: hourlyConfirmation.score,
          action: hourlyConfirmation.action,
          signalStrength: hourlyConfirmation.signalStrength,
          dataValid: hourlyConfirmation.dataValid
        });
      } catch (error) {
        console.error(`❌ 小时确认分析失败 [${symbol}]: ${error.message}`);
        this.dataMonitor.recordDataQualityIssue(symbol, '小时确认分析', error.message);
        hourlyConfirmation = {
          symbol,
          trend: dailyTrend.trend,
          score: 0,
          action: "观望/不做",
          signalStrength: 'NONE',
          dataValid: false
        };
      }

      // 3. 基于天级趋势和小时级得分进行15分钟入场判断
      try {
        console.log(`🔍 开始分析15分钟执行 [${symbol}]...`);
        execution15m = await this.analyze15mExecution(symbol, dailyTrend.trend, hourlyConfirmation.score, symbolData, maxLossAmount);
        console.log(`✅ 15分钟执行分析成功 [${symbol}]:`, {
          entrySignal: execution15m.entrySignal,
          mode: execution15m.mode,
          modeA: execution15m.modeA,
          modeB: execution15m.modeB,
          maxLeverage: execution15m.maxLeverage,
          minMargin: execution15m.minMargin,
          stopLossDistance: execution15m.stopLossDistance,
          atrValue: execution15m.atrValue,
          dataValid: execution15m.dataValid
        });
      } catch (error) {
        console.error(`❌ 15分钟执行分析失败 [${symbol}]:`, error.message);
        execution15m = {
          entrySignal: null,
          stopLoss: null,
          takeProfit: null,
          mode: null,
          modeA: false,
          modeB: false,
          dataValid: false
        };
      }

      // 记录指标计算
      this.dataMonitor.recordIndicator(symbol, '日线MA指标', {
        ma20: dailyTrend.ma20,
        ma50: dailyTrend.ma50,
        ma200: dailyTrend.ma200
      }, Date.now() - startTime);

      this.dataMonitor.recordIndicator(symbol, '小时VWAP', {
        vwap: hourlyConfirmation.vwap || 0,
        volumeConfirmed: hourlyConfirmation.volumeConfirmed || false
      }, Date.now() - startTime);

      // 按照strategy-v2.md的信号判断逻辑
      // 信号列 = 小时级趋势加强判断的结果
      let signal = 'NO_SIGNAL';
      let signalStrength = 'NONE';

      // 根据strategy-v2.md的逻辑：
      // - 得分 ≥ 2分 → 可以进入小周期观察入场机会，信号显示"观望/不做"
      // - 得分 ≥ 4分 → 优先级最高（强信号），信号显示"做多"/"做空"
      if (hourlyConfirmation.score >= 2) {
        if (hourlyConfirmation.score >= 4) {
          // 强信号：显示具体的做多/做空
          if (dailyTrend.trend === '多头趋势') {
            signal = '做多';
          } else if (dailyTrend.trend === '空头趋势') {
            signal = '做空';
          }
          signalStrength = 'STRONG';
        } else {
          // 中等信号：显示观望/不做
          signal = '观望/不做';
          signalStrength = 'MODERATE';
        }
      }

      // 按照strategy-v2.md的入场执行逻辑
      // 入场执行列 = 15分钟级别入场判断的结果
      let execution = 'NO_EXECUTION';
      let executionMode = 'NONE';

      // 入场执行列显示触发了模式A还是模式B
      // 只有当趋势明确且得分≥2时，才可能触发入场执行
      if (execution15m.entrySignal && hourlyConfirmation.score >= 2) {
        if (execution15m.modeA) {
          if (dailyTrend.trend === '多头趋势') {
            execution = '做多_模式A';
          } else if (dailyTrend.trend === '空头趋势') {
            execution = '做空_模式A';
          }
          executionMode = '模式A';
        } else if (execution15m.modeB) {
          if (dailyTrend.trend === '多头趋势') {
            execution = '做多_模式B';
          } else if (dailyTrend.trend === '空头趋势') {
            execution = '做空_模式B';
          }
          executionMode = '模式B';
        }
      }

      // 调试：显示execution15m对象内容
      console.log(`🔍 analyzeAll中execution15m对象 [${symbol}]:`, {
        entrySignal: execution15m?.entrySignal,
        stopLoss: execution15m?.stopLoss,
        takeProfit: execution15m?.takeProfit,
        maxLeverage: execution15m?.maxLeverage,
        minMargin: execution15m?.minMargin,
        stopLossDistance: execution15m?.stopLossDistance,
        atrValue: execution15m?.atrValue,
        modeA: execution15m?.modeA,
        modeB: execution15m?.modeB
      });

      // 记录信号
      this.dataMonitor.recordSignal(symbol, '综合分析', {
        signal,
        trend: dailyTrend.trend,
        confirmed: hourlyConfirmation.signalStrength !== 'NONE',
        score: hourlyConfirmation.score,
        modeA: execution15m.modeA,
        modeB: execution15m.modeB
      }, true);

      // 记录模拟交易
      if (execution.includes('EXECUTE')) {
        const entryPrice = execution15m.entrySignal;
        const stopLoss = execution15m.stopLoss;
        const takeProfit = execution15m.takeProfit;

        const simulationData = {
          signal: execution,
          entryPrice,
          stopLoss,
          takeProfit,
          executionMode: executionMode,
          timestamp: Date.now()
        };
        this.dataMonitor.recordSimulation(symbol, '交易信号', simulationData, true);
      }

      // 记录完整的分析日志
      this.dataMonitor.recordAnalysisLog(symbol, {
        trend: dailyTrend.trend,
        signal,
        execution: execution15m.entrySignal ? execution : 'NO_EXECUTION',
        executionMode: executionMode,
        hourlyScore: hourlyConfirmation.score,
        modeA: execution15m.modeA,
        modeB: execution15m.modeB,
        dailyTrend,
        hourlyConfirmation,
        execution15m
      });

      // 完成数据收集
      this.dataMonitor.completeDataCollection(symbol, true);

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`✅ ${symbol} 分析完成，耗时: ${duration}ms`);

      return {
        time: new Date().toISOString(),
        symbol,
        // 趋势列 - 天级趋势判断结果
        trend: dailyTrend.trend,
        trendStrength: dailyTrend.trendStrength,
        // 信号列 - 小时级趋势加强判断结果（多因子得分）
        signal,
        signalStrength,
        hourlyScore: hourlyConfirmation?.score || 0,
        // 入场执行列 - 15分钟级别入场判断结果
        execution,
        executionMode,
        modeA: execution15m?.modeA || false,
        modeB: execution15m?.modeB || false,
        entrySignal: execution15m?.entrySignal || null,
        stopLoss: execution15m?.stopLoss || null,
        takeProfit: execution15m?.takeProfit || null,
        maxLeverage: execution15m?.maxLeverage ?? null,
        minMargin: execution15m?.minMargin ?? null,
        stopLossDistance: execution15m?.stopLossDistance ?? null,
        atrValue: execution15m?.atrValue ?? null,
        // 其他信息
        currentPrice: parseFloat(ticker.lastPrice),
        dataCollectionRate: 100,
        // 详细分析数据
        dailyTrend,
        hourlyConfirmation,
        execution15m
      };

    } catch (error) {
      console.error(`分析 ${symbol} 失败:`, error);
      this.dataMonitor.completeDataCollection(symbol, false);
      throw error;
    }
  }
}

module.exports = { SmartFlowStrategy };
