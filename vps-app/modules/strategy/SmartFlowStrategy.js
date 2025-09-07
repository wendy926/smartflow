// modules/strategy/SmartFlowStrategy.js
// SmartFlow 交易策略核心模块

const BinanceAPI = require('../api/BinanceAPI');
const TechnicalIndicators = require('../utils/TechnicalIndicators');
const { DataMonitor } = require('../monitoring/DataMonitor');

class SmartFlowStrategy {
  static dataMonitor = new DataMonitor();
  static dataManager = null; // 将在初始化时设置

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

      // 计算ADX
      let adx = [];
      let adxError = null;
      try {
        adx = TechnicalIndicators.calculateADX(klines, 14);
        if (!adx || adx.length === 0) {
          throw new Error('ADX计算结果为空');
        }
      } catch (error) {
        adxError = error.message;
        this.dataMonitor.recordDataQualityIssue(symbol, '日线趋势分析', `ADX计算失败: ${error.message}`);
        console.error(`ADX计算失败 ${symbol}:`, error);
      }
      
      // 计算布林带开口扩张
      let bollingerExpansion = false;
      let bollingerError = null;
      try {
        bollingerExpansion = TechnicalIndicators.calculateBollingerBandExpansion(closes, 20);
      } catch (error) {
        bollingerError = error.message;
        this.dataMonitor.recordDataQualityIssue(symbol, '日线趋势分析', `布林带开口扩张计算失败: ${error.message}`);
        console.error(`布林带开口扩张计算失败 ${symbol}:`, error);
      }

      const latestClose = closes[closes.length - 1];
      const latestMA20 = ma20[ma20.length - 1];
      const latestMA50 = ma50[ma50.length - 1];
      const latestMA200 = ma200[ma200.length - 1];
      const latestADX = adx.length > 0 ? adx[adx.length - 1] : 0;

      let trend = 'RANGE';
      let trendStrength = 'WEAK';

      // 检查指标计算是否成功
      const hasValidADX = !adxError && adx.length > 0;
      const hasValidBollinger = !bollingerError;

      // 按照strategy-v2.md的日线趋势过滤逻辑
      // 多头趋势：价格在MA200上方 + MA20 > MA50 + ADX > 20 + 布林带开口扩张
      if (latestClose > latestMA200 && 
          latestMA20 > latestMA50 && 
          hasValidADX && latestADX > 20 && 
          hasValidBollinger && bollingerExpansion) {
        trend = 'UPTREND';
        trendStrength = latestADX > 30 ? 'STRONG' : 'MODERATE';
      }
      // 空头趋势：价格在MA200下方 + MA20 < MA50 + ADX > 20 + 布林带开口扩张
      else if (latestClose < latestMA200 && 
               latestMA20 < latestMA50 && 
               hasValidADX && latestADX > 20 && 
               hasValidBollinger && bollingerExpansion) {
        trend = 'DOWNTREND';
        trendStrength = latestADX > 30 ? 'STRONG' : 'MODERATE';
      }

      // 记录指标计算错误
      if (adxError) {
        this.dataMonitor.recordDataQualityIssue(symbol, '日线趋势分析', `ADX计算错误: ${adxError}`);
      }
      if (bollingerError) {
        this.dataMonitor.recordDataQualityIssue(symbol, '日线趋势分析', `布林带开口扩张计算错误: ${bollingerError}`);
      }

      return {
        trend,
        trendStrength,
        ma20: latestMA20,
        ma50: latestMA50,
        ma200: latestMA200,
        adx: latestADX,
        bollingerExpansion,
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

  static async analyzeHourlyConfirmation(symbol, symbolData = null) {
    try {
      console.log(`🔍 [${symbol}] 开始获取数据...`);
      const klines = symbolData?.klines || await BinanceAPI.getKlines(symbol, '1h', 200);
      const ticker = symbolData?.ticker || await BinanceAPI.get24hrTicker(symbol);
      const funding = symbolData?.funding || await BinanceAPI.getFundingRate(symbol);
      const openInterestHist = symbolData?.openInterestHist || await BinanceAPI.getOpenInterestHist(symbol, '1h', 6);

      console.log(`📊 [${symbol}] 数据获取完成:`, {
        klinesLength: klines?.length || 0,
        tickerLastPrice: ticker?.lastPrice || 'N/A',
        fundingLength: funding?.length || 0,
        openInterestLength: openInterestHist?.length || 0
      });

      // 严格数据验证
      if (!klines || klines.length === 0) {
        throw new Error(`K线数据为空 - 请检查API连接或交易对是否有效`);
      }
      if (!ticker || !ticker.lastPrice) {
        throw new Error(`24小时行情数据无效 - 请检查API响应格式`);
      }
      if (!funding || !Array.isArray(funding) || funding.length === 0 || !funding[0].fundingRate) {
        throw new Error(`资金费率数据无效 - 请检查API响应格式或交易对是否支持`);
      }
      if (!openInterestHist || openInterestHist.length === 0) {
        throw new Error(`持仓量历史数据为空 - 请检查API响应或时间范围`);
      }

      // 将数组格式的K线数据转换为对象格式
      const klinesObjects = klines.map(k => ({
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));

      const closes = klinesObjects.map(k => k.close);
      const volumes = klinesObjects.map(k => k.volume);
      const highs = klinesObjects.map(k => k.high);
      const lows = klinesObjects.map(k => k.low);

      // 计算VWAP
      const vwap = TechnicalIndicators.calculateVWAP(klinesObjects);
      const lastVWAP = vwap[vwap.length - 1];
      const lastClose = closes[closes.length - 1];

      // 计算成交量倍数
      const volSMA = TechnicalIndicators.calculateSMA(volumes, 20);
      const avgVol = volSMA[volSMA.length - 1];
      const lastVol = volumes[volumes.length - 1];
      const volumeRatio = avgVol > 0 ? lastVol / avgVol : 0;

      // 检查突破
      const recentHighs = highs.slice(-20);
      const recentLows = lows.slice(-20);
      const breakoutUp = lastClose > Math.max(...recentHighs);
      const breakoutDown = lastClose < Math.min(...recentLows);

      // 计算OI变化
      const oiChange = openInterestHist.length > 1 ?
        ((openInterestHist[openInterestHist.length - 1].sumOpenInterest - openInterestHist[0].sumOpenInterest) / openInterestHist[0].sumOpenInterest) * 100 : 0;

      // 计算Delta和CVD
      let deltas = [];
      let cvd = [];
      let lastCVD = 0;
      let lastDelta = 0;
      let deltaConfirmed = false;
      let deltaError = null;
      
      try {
        deltas = TechnicalIndicators.calculateDelta(klinesObjects);
        cvd = TechnicalIndicators.calculateCVD(klinesObjects);
        
        if (deltas.length === 0 || cvd.length === 0) {
          throw new Error('Delta或CVD计算结果为空');
        }
        
        lastCVD = cvd[cvd.length - 1];
        lastDelta = deltas[deltas.length - 1];
        
        // 计算Delta确认：当前Delta是否显著放大
        const avgDelta = deltas.slice(-20).reduce((sum, d) => sum + Math.abs(d), 0) / 20;
        deltaConfirmed = Math.abs(lastDelta) > avgDelta * 2;
      } catch (error) {
        deltaError = error.message;
        this.dataMonitor.recordDataQualityIssue(symbol, '小时确认分析', `Delta/CVD计算失败: ${error.message}`);
        console.error(`Delta/CVD计算失败 ${symbol}:`, error);
      }

      // 按照strategy-v2.md的多因子打分体系
      let score = 0;
      const scoreDetails = {};

      // 1. VWAP方向一致：收盘价在VWAP上方/下方
      const priceVsVwap = lastClose - lastVWAP;
      if (priceVsVwap > 0) {
        scoreDetails.vwapDirection = 'BULLISH';
        score += 1;
      } else if (priceVsVwap < 0) {
        scoreDetails.vwapDirection = 'BEARISH';
        score += 1;
      } else {
        scoreDetails.vwapDirection = 'NEUTRAL';
      }

      // 2. 突破结构：收盘价突破最近20根K线的最高点/最低点
      if (breakoutUp) {
        scoreDetails.breakout = 'UP';
        score += 1;
      } else if (breakoutDown) {
        scoreDetails.breakout = 'DOWN';
        score += 1;
      } else {
        scoreDetails.breakout = 'NONE';
      }

      // 3. 成交量确认：当前K线成交量 ≥ 1.5 × 20期平均成交量
      if (volumeRatio >= 1.5) {
        scoreDetails.volume = 'CONFIRMED';
        score += 1;
      } else {
        scoreDetails.volume = 'WEAK';
      }

      // 4. OI确认：未平仓合约OI在6h内上涨≥+2%或下降≥-2%
      if (oiChange >= 2) {
        scoreDetails.oi = 'INCREASING';
        score += 1;
      } else if (oiChange <= -2) {
        scoreDetails.oi = 'DECREASING';
        score += 1;
      } else {
        scoreDetails.oi = 'STABLE';
      }

      // 5. 资金费率：资金费率 ≤ 0.15%/8h
      const fundingRate = parseFloat(funding[0].fundingRate);
      if (Math.abs(fundingRate) <= 0.0015) {
        scoreDetails.funding = 'LOW';
        score += 1;
      } else {
        scoreDetails.funding = 'HIGH';
      }

      // 6. Delta确认：买卖盘不平衡
      if (deltaError) {
        scoreDetails.delta = 'ERROR';
        this.dataMonitor.recordDataQualityIssue(symbol, '小时确认分析', `Delta确认计算错误: ${deltaError}`);
      } else if (deltaConfirmed) {
        scoreDetails.delta = 'CONFIRMED';
        score += 1;
      } else {
        scoreDetails.delta = 'WEAK';
      }

      // 判断信号强度
      let signalStrength = 'NONE';
      if (score >= 4) {
        signalStrength = 'STRONG'; // 优先级最高
      } else if (score >= 2) {
        signalStrength = 'MODERATE'; // 可以进入15m观察
      }

      return {
        score,
        signalStrength,
        scoreDetails,
        priceVsVwap,
        vwap: lastVWAP,
        volumeRatio,
        breakoutUp,
        breakoutDown,
        oiChange,
        fundingRate,
        delta: lastDelta,
        deltaConfirmed,
        cvd: {
          value: lastCVD,
          direction: lastCVD > 0 ? 'BULLISH' : lastCVD < 0 ? 'BEARISH' : 'NEUTRAL',
          isActive: Math.abs(lastCVD) > 0
        },
        dataValid: true
      };
    } catch (error) {
      console.error(`小时确认分析失败 ${symbol}:`, error);
      return {
        score: 0,
        signalStrength: 'NONE',
        dataValid: false,
        error: error.message
      };
    }
  }

  static async analyze15mExecution(symbol, symbolData = null) {
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
      const highs = klinesObjects.map(k => k.high);
      const lows = klinesObjects.map(k => k.low);
      const volumes = klinesObjects.map(k => k.volume);

      // 计算EMA
      const ema20 = TechnicalIndicators.calculateEMA(closes, 20);
      const ema50 = TechnicalIndicators.calculateEMA(closes, 50);

      const lastClose = closes[closes.length - 1];
      const lastEMA20 = ema20[ema20.length - 1];
      const lastEMA50 = ema50[ema50.length - 1];

      // 识别setup candle（前一根K线）
      const setupCandle = klines[klines.length - 2];
      const setupHigh = parseFloat(setupCandle.high);
      const setupLow = parseFloat(setupCandle.low);

      // 计算ATR
      const atr = TechnicalIndicators.calculateATR(klines, 14);
      const lastATR = atr[atr.length - 1];

      // 计算成交量放大
      const volSMA = TechnicalIndicators.calculateSMA(volumes, 20);
      const avgVol = volSMA[volSMA.length - 1];
      const lastVol = volumes[volumes.length - 1];
      const volumeExpansion = avgVol > 0 ? lastVol / avgVol : 0;

      // 按照strategy-v2.md的15分钟执行逻辑
      let executionMode = 'NONE';
      let executionSignal = 'NO_SIGNAL';
      let executionDetails = {};

      // 模式A：回踩确认模式（胜率高）
      const pullbackToEma20 = Math.abs(lastClose - lastEMA20) / lastEMA20 < 0.02; // 2%以内
      const pullbackToEma50 = Math.abs(lastClose - lastEMA50) / lastEMA50 < 0.02;
      const pullbackToSupport = pullbackToEma20 || pullbackToEma50;

      // 检查回踩时成交量是否缩小
      const recentVolumes = volumes.slice(-5); // 最近5根K线
      const avgRecentVol = recentVolumes.reduce((sum, v) => sum + v, 0) / recentVolumes.length;
      const volumeContraction = avgRecentVol < avgVol * 0.8; // 成交量缩小20%以上

      // 检查突破setup candle
      const breakSetupHigh = lastClose > setupHigh;
      const breakSetupLow = lastClose < setupLow;

      // 模式B：动能突破模式（机会多）
      const momentumBreakout = (breakSetupHigh || breakSetupLow) && volumeExpansion >= 1.5;

      // 判断执行模式
      if (pullbackToSupport && volumeContraction && (breakSetupHigh || breakSetupLow)) {
        executionMode = 'PULLBACK_CONFIRMATION';
        executionSignal = breakSetupHigh ? 'LONG_EXECUTE' : 'SHORT_EXECUTE';
        executionDetails = {
          pullbackToEma20,
          pullbackToEma50,
          volumeContraction,
          breakSetupHigh,
          breakSetupLow
        };
      } else if (momentumBreakout) {
        executionMode = 'MOMENTUM_BREAKOUT';
        executionSignal = breakSetupHigh ? 'LONG_EXECUTE' : 'SHORT_EXECUTE';
        executionDetails = {
          volumeExpansion,
          breakSetupHigh,
          breakSetupLow
        };
      }

      // 计算止盈止损价格
      let stopLoss = null;
      let targetPrice = null;
      let riskRewardRatio = 0;
      let maxLeverage = 0;
      let minMargin = 0;
      let manualConfirmation = false;

      if (executionSignal.includes('EXECUTE')) {
        if (executionSignal === 'LONG_EXECUTE') {
          // 做多信号：止损 = setup candle另一端 或 1.2×ATR，取更远
          const setupStop = setupLow;
          const atrStop = lastClose - 1.2 * lastATR;
          stopLoss = Math.min(setupStop, atrStop);

          // 止盈：第一目标1.5R平掉50%，剩余跟踪止损
          const risk = lastClose - stopLoss;
          targetPrice = lastClose + 1.5 * risk; // 第一目标
        } else if (executionSignal === 'SHORT_EXECUTE') {
          // 做空信号：止损 = setup candle另一端 或 1.2×ATR，取更远
          const setupStop = setupHigh;
          const atrStop = lastClose + 1.2 * lastATR;
          stopLoss = Math.max(setupStop, atrStop);

          // 止盈：第一目标1.5R平掉50%，剩余跟踪止损
          const risk = stopLoss - lastClose;
          targetPrice = lastClose - 1.5 * risk; // 第一目标
        }

        // 计算风险回报比
        if (stopLoss && targetPrice) {
          const risk = Math.abs(lastClose - stopLoss);
          const reward = Math.abs(targetPrice - lastClose);
          riskRewardRatio = reward / risk;
        }

        // 计算杠杆和保证金
        const riskPercentage = 0.02; // 2%风险
        const stopDistance = Math.abs(lastClose - stopLoss) / lastClose;
        maxLeverage = Math.min(20, Math.floor(riskPercentage / stopDistance));
        minMargin = (lastClose * 0.1) / maxLeverage;

        // 人工确认条件
        manualConfirmation = riskRewardRatio >= 1.5 && stopDistance >= 0.01;
      }

      return {
        executionMode,
        executionSignal,
        executionDetails,
        pullbackToEma20,
        pullbackToEma50,
        breakSetupHigh,
        breakSetupLow,
        setupHigh,
        setupLow,
        atr: lastATR,
        volumeExpansion,
        stopLoss,
        targetPrice,
        riskRewardRatio,
        maxLeverage,
        minMargin,
        manualConfirmation,
        dataValid: true
      };
    } catch (error) {
      console.error(`15分钟执行分析失败 ${symbol}:`, error);
      return {
        executionMode: 'NONE',
        executionSignal: 'NO_SIGNAL',
        dataValid: false,
        error: error.message
      };
    }
  }

  /**
   * 计算CVD (Cumulative Volume Delta)
   * 根据strategy.md和auto-script.md的要求：
   * - 基于主动买卖成交量差
   * - 如果无法获取实时数据，使用成交量+OI作为替代
   * @param {Array} klines - K线数据
   * @returns {Array} CVD数组
   */
  static calculateCVD(klines) {
    const cvd = [];
    let cumulativeDelta = 0;

    for (let i = 0; i < klines.length; i++) {
      const k = klines[i];
      const close = parseFloat(k.close);
      const open = parseFloat(k.open);
      const high = parseFloat(k.high);
      const low = parseFloat(k.low);
      const volume = parseFloat(k.volume);

      // 更精确的CVD计算：基于价格位置和成交量
      // 如果收盘价在K线中上部（>50%位置），认为是买入主导
      // 如果收盘价在K线中下部（<50%位置），认为是卖出主导
      const priceRange = high - low;
      const pricePosition = priceRange > 0 ? (close - low) / priceRange : 0.5;
      const delta = pricePosition > 0.5 ? volume : -volume;

      cumulativeDelta += delta;
      cvd.push(cumulativeDelta);
    }

    return cvd;
  }

  static async analyzeAll(symbol) {
    const startTime = Date.now();

    try {
      // 开始分析记录
      this.dataMonitor.startAnalysis(symbol);

      // 获取所有需要的数据
      const [klines, ticker, funding, openInterestHist] = await Promise.all([
        BinanceAPI.getKlines(symbol, '1h', 200),
        BinanceAPI.get24hrTicker(symbol),
        BinanceAPI.getFundingRate(symbol),
        BinanceAPI.getOpenInterestHist(symbol, '1h', 6)
      ]);

      const symbolData = { klines, ticker, funding, openInterestHist };

      // 记录原始数据 - 添加数据验证
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

      // 分析各个阶段 - 添加错误处理
      let dailyTrend, hourlyConfirmation, execution15m;

      try {
        dailyTrend = await this.analyzeDailyTrend(symbol, symbolData);
      } catch (error) {
        console.error(`日线趋势分析失败 [${symbol}]:`, error.message);
        dailyTrend = { trend: 'UNKNOWN', ma20: 0, ma50: 0, ma200: 0 };
      }

      try {
        console.log(`🔍 开始分析小时确认 [${symbol}]...`);
        hourlyConfirmation = await this.analyzeHourlyConfirmation(symbol, symbolData);
        console.log(`✅ 小时确认分析成功 [${symbol}]:`, {
          vwap: hourlyConfirmation.vwap,
          volumeRatio: hourlyConfirmation.volumeRatio,
          cvd: hourlyConfirmation.cvd,
          dataValid: hourlyConfirmation.dataValid
        });
      } catch (error) {
        console.error(`❌ 小时确认分析失败 [${symbol}]: ${error.message}`);
        console.error(`错误堆栈:`, error.stack);
        // 记录数据质量问题到监控系统
        this.dataMonitor.recordDataQualityIssue(symbol, '小时确认分析', error.message);
        hourlyConfirmation = {
          vwap: 0,
          volumeRatio: 0,
          oiChange: 0,
          fundingRate: 0,
          cvd: {
            value: 0,
            direction: 'NEUTRAL',
            isActive: false
          },
          priceVsVwap: 0,
          breakoutUp: false,
          breakoutDown: false,
          dataValid: false,
          error: error.message
        };
      }

      try {
        execution15m = await this.analyze15mExecution(symbol, symbolData);
      } catch (error) {
        console.error(`15分钟执行分析失败 [${symbol}]:`, error.message);
        execution15m = {
          signal: 'NO_SIGNAL',
          stopLoss: 0,
          targetPrice: 0,
          riskRewardRatio: 0,
          maxLeverage: 0,
          minMargin: 0,
          manualConfirmation: false
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
        volumeRatio: hourlyConfirmation.volumeRatio || 0
      }, Date.now() - startTime);

      this.dataMonitor.recordIndicator(symbol, '小时确认指标', {
        oiChange: hourlyConfirmation.oiChange || 0,
        fundingRate: hourlyConfirmation.fundingRate || 0,
        cvdValue: hourlyConfirmation.cvd?.value || 0,
        cvdDirection: hourlyConfirmation.cvd?.direction || 'N/A'
      }, Date.now() - startTime);

      // 按照strategy-v2.md的信号判断逻辑
      let signal = 'NO_SIGNAL';
      let signalStrength = 'NONE';

      // 只有当日线趋势明确且小时级得分≥2分时才产生信号
      if (dailyTrend.trend === 'UPTREND' && hourlyConfirmation.signalStrength !== 'NONE') {
        // 做多条件：日线上升趋势 + 小时级得分≥2分
        signal = 'LONG';
        signalStrength = hourlyConfirmation.signalStrength;
      } else if (dailyTrend.trend === 'DOWNTREND' && hourlyConfirmation.signalStrength !== 'NONE') {
        // 做空条件：日线下降趋势 + 小时级得分≥2分
        signal = 'SHORT';
        signalStrength = hourlyConfirmation.signalStrength;
      }

      // 记录信号
      this.dataMonitor.recordSignal(symbol, '综合分析', {
        signal,
        trend: dailyTrend.trend,
        confirmed: hourlyConfirmation.confirmed || false,
        priceVsVwap: hourlyConfirmation.priceVsVwap || 0,
        breakoutUp: hourlyConfirmation.breakoutUp || false,
        breakoutDown: hourlyConfirmation.breakoutDown || false,
        oiChange: hourlyConfirmation.oiChange || 0,
        fundingRate: hourlyConfirmation.fundingRate || 0
      }, true);

      // 按照strategy-v2.md的入场执行逻辑
      let execution = 'NO_EXECUTION';
      let executionMode = 'NONE';

      // 只有当日线趋势明确、小时级得分≥2分且15分钟有执行信号时才执行
      if (signal === 'LONG' && execution15m.executionSignal === 'LONG_EXECUTE') {
        execution = 'LONG_EXECUTE';
        executionMode = execution15m.executionMode;
      } else if (signal === 'SHORT' && execution15m.executionSignal === 'SHORT_EXECUTE') {
        execution = 'SHORT_EXECUTE';
        executionMode = execution15m.executionMode;
      }

      // 记录模拟交易 - 严格按照strategy.md的止损止盈规则
      if (execution.includes('EXECUTE')) {
        const entryPrice = parseFloat(ticker.lastPrice);
        const atr = execution15m.atr;

        // 止损：setup candle另一端 或 1.2×ATR(14)（取更远）
        let stopLoss;
        if (execution === 'LONG_EXECUTE') {
          const setupStop = execution15m.setupLow;
          const atrStop = entryPrice - 1.2 * atr;
          stopLoss = Math.min(setupStop, atrStop); // 取更远的（更小的值）
        } else {
          const setupStop = execution15m.setupHigh;
          const atrStop = entryPrice + 1.2 * atr;
          stopLoss = Math.max(setupStop, atrStop); // 取更远的（更大的值）
        }

        // 止盈：第一目标1.5R平掉50%，剩余跟踪止损
        const risk = Math.abs(entryPrice - stopLoss);
        const firstTarget = execution === 'LONG_EXECUTE' ?
          entryPrice + risk * 1.5 :
          entryPrice - risk * 1.5;
        
        // 第二目标：剩余仓位用追踪止损（跟随15m EMA20）
        const secondTarget = execution === 'LONG_EXECUTE' ?
          entryPrice + risk * 3 : // 3R作为最终目标
          entryPrice - risk * 3;

        const simulationData = {
          signal: execution,
          entryPrice,
          stopLoss,
          takeProfit: firstTarget, // 第一目标1.5R
          secondTarget: secondTarget, // 第二目标3R
          riskReward: 1.5, // 第一目标风险回报比
          secondRiskReward: 3.0, // 第二目标风险回报比
          atr: atr,
          setupHigh: execution15m.setupHigh,
          setupLow: execution15m.setupLow,
          executionMode: executionMode,
          timestamp: Date.now()
        };
        this.dataMonitor.recordSimulation(symbol, '交易信号', simulationData, true);
      }

      // 完成数据收集
      this.dataMonitor.completeDataCollection(symbol, true);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 调试信息
      console.log(`✅ ${symbol} 分析完成，耗时: ${duration}ms`);
      console.log(`📊 ${symbol} 数据概览:`);
      console.log(`  - VWAP: ${hourlyConfirmation.vwap || 0}`);
      console.log(`  - 成交量倍数: ${hourlyConfirmation.volumeRatio || 0}x`);
      console.log(`  - OI变化: ${hourlyConfirmation.oiChange || 0}%`);
      console.log(`  - 资金费率: ${hourlyConfirmation.fundingRate || 0}`);
      console.log(`  - CVD: ${hourlyConfirmation.cvd?.direction || 'N/A'} (${hourlyConfirmation.cvd?.value || 0})`);

      return {
        time: new Date().toISOString(),
        symbol,
        trend: dailyTrend.trend,
        signal,
        signalStrength,
        execution,
        executionMode,
        currentPrice: parseFloat(ticker.lastPrice),
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
