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

      const ma20 = TechnicalIndicators.calculateSMA(closes, 20);
      const ma50 = TechnicalIndicators.calculateSMA(closes, 50);
      const ma200 = TechnicalIndicators.calculateSMA(closes, 200);

      const latestClose = closes[closes.length - 1];
      const latestMA20 = ma20[ma20.length - 1];
      const latestMA50 = ma50[ma50.length - 1];
      const latestMA200 = ma200[ma200.length - 1];

      let trend = 'RANGE';
      // 严格按照strategy.md: MA20 > MA50 > MA200 且收盘 > MA20 (多头)
      // MA20 < MA50 < MA200 且收盘 < MA20 (空头)
      if (latestMA20 > latestMA50 && latestMA50 > latestMA200 && latestClose > latestMA20) {
        trend = 'UPTREND';
      } else if (latestMA20 < latestMA50 && latestMA50 < latestMA200 && latestClose < latestMA20) {
        trend = 'DOWNTREND';
      }

      return {
        trend,
        ma20: latestMA20,
        ma50: latestMA50,
        ma200: latestMA200,
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

      // 严格数据验证 - 确保数据质量，提供友好错误提示
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
      console.log(`📈 [${symbol}] 开始计算VWAP...`);
      const vwap = TechnicalIndicators.calculateVWAP(klinesObjects);
      const lastVWAP = vwap[vwap.length - 1];
      const lastClose = closes[closes.length - 1];
      console.log(`📈 [${symbol}] VWAP计算完成:`, {
        vwapLength: vwap.length,
        lastVWAP: lastVWAP,
        lastClose: lastClose
      });

      // 计算成交量倍数
      const volSMA = TechnicalIndicators.calculateSMA(volumes, 20);
      const avgVol = volSMA[volSMA.length - 1];
      const lastVol = volumes[volumes.length - 1];
      const volumeRatio = avgVol > 0 ? lastVol / avgVol : 0;

      // 调试信息
      console.log(`🔍 ${symbol} 小时确认数据调试:`);
      console.log(`  - K线数量: ${klines.length}`);
      console.log(`  - 最后收盘价: ${lastClose}`);
      console.log(`  - VWAP数组长度: ${vwap.length}`);
      console.log(`  - VWAP: ${lastVWAP}`);
      console.log(`  - 最后成交量: ${lastVol}`);
      console.log(`  - 20期平均成交量: ${avgVol}`);
      console.log(`  - 成交量倍数: ${volumeRatio}`);
      console.log(`  - 前3根K线数据:`, klines.slice(-3).map(k => ({
        high: k.high,
        low: k.low,
        close: k.close,
        volume: k.volume
      })));

      // 检查突破
      const recentHighs = highs.slice(-20);
      const recentLows = lows.slice(-20);
      const breakoutUp = lastClose > Math.max(...recentHighs);
      const breakoutDown = lastClose < Math.min(...recentLows);

      // 计算OI变化
      const oiChange = openInterestHist.length > 1 ?
        ((openInterestHist[openInterestHist.length - 1].sumOpenInterest - openInterestHist[0].sumOpenInterest) / openInterestHist[0].sumOpenInterest) * 100 : 0;

      // 调试OI和资金费率
      console.log(`  - OI历史数据数量: ${openInterestHist.length}`);
      console.log(`  - 最新OI: ${openInterestHist[openInterestHist.length - 1]?.sumOpenInterest}`);
      console.log(`  - 最早OI: ${openInterestHist[0]?.sumOpenInterest}`);
      console.log(`  - OI变化: ${oiChange}%`);
      console.log(`  - 资金费率: ${parseFloat(funding[0].fundingRate)}`);

      // 计算CVD (Cumulative Volume Delta)
      console.log(`📊 [${symbol}] 开始计算CVD...`);
      const cvd = this.calculateCVD(klinesObjects);
      const lastCVD = cvd[cvd.length - 1];
      const cvdDirection = lastCVD > 0 ? 'BULLISH' : lastCVD < 0 ? 'BEARISH' : 'NEUTRAL';
      console.log(`📊 [${symbol}] CVD计算完成:`, {
        cvdLength: cvd.length,
        lastCVD: lastCVD,
        cvdDirection: cvdDirection,
        firstCVD: cvd[0],
        last3CVD: cvd.slice(-3)
      });

      // 严格按照strategy.md和auto-script.md的确认条件
      // 1. 价格与VWAP方向一致
      // 2. 突破近20根高/低点
      // 3. 放量 ≥ 1.5×(20MA)
      // 4. OI 6h变动 ≥ +2%(做多) 或 ≤ -2%(做空)
      // 5. 资金费率 |FR| ≤ 0.1%/8h
      const priceVsVwap = lastClose - lastVWAP;
      const volumeConfirmed = volumeRatio >= 1.5;
      const fundingConfirmed = Math.abs(parseFloat(funding[0].fundingRate)) <= 0.001;
      const oiConfirmed = oiChange >= 2 || oiChange <= -2; // 根据方向判断
      const breakoutConfirmed = breakoutUp || breakoutDown;

      const confirmed = volumeConfirmed && fundingConfirmed && oiConfirmed && breakoutConfirmed;

      return {
        confirmed,
        priceVsVwap,
        vwap: lastVWAP,
        volumeRatio,
        breakoutUp,
        breakoutDown,
        oiChange,
        fundingRate: parseFloat(funding[0].fundingRate),
        cvd: lastCVD, // 直接返回数值
        cvdDirection: cvdDirection,
        dataValid: true
      };
    } catch (error) {
      console.error(`小时确认分析失败 ${symbol}:`, error);
      return {
        confirmed: false,
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

      // 计算EMA
      const ema20 = TechnicalIndicators.calculateEMA(closes, 20);
      const ema50 = TechnicalIndicators.calculateEMA(closes, 50);

      const lastClose = closes[closes.length - 1];
      const lastEMA20 = ema20[ema20.length - 1];
      const lastEMA50 = ema50[ema50.length - 1];

      // 检查回踩
      const pullbackToEma20 = Math.abs(lastClose - lastEMA20) / lastEMA20 < 0.02; // 2%以内
      const pullbackToEma50 = Math.abs(lastClose - lastEMA50) / lastEMA50 < 0.02;

      // 识别setup candle
      const setupCandle = klines[klines.length - 2]; // 前一根K线
      const setupHigh = parseFloat(setupCandle.high);
      const setupLow = parseFloat(setupCandle.low);

      // 检查突破
      const breakSetupHigh = lastClose > setupHigh;
      const breakSetupLow = lastClose < setupLow;

      // 计算ATR
      const atr = TechnicalIndicators.calculateATR(klines, 14);
      const lastATR = atr[atr.length - 1];

      // 计算止盈止损价格
      let stopLoss = null;
      let targetPrice = null;
      let riskRewardRatio = 0;
      let maxLeverage = 0;
      let minMargin = 0;
      let manualConfirmation = false;

      // 只有在有信号时才计算止盈止损
      if (breakSetupHigh || breakSetupLow) {
        const latestClose = lastClose;
        
        if (breakSetupHigh) {
          // 做多信号
          stopLoss = Math.min(setupLow, latestClose - 1.2 * lastATR);
          targetPrice = latestClose + 2 * (latestClose - stopLoss);
          riskRewardRatio = (targetPrice - latestClose) / (latestClose - stopLoss);
        } else if (breakSetupLow) {
          // 做空信号
          stopLoss = Math.max(setupHigh, latestClose + 1.2 * lastATR);
          targetPrice = latestClose - 2 * (stopLoss - latestClose);
          riskRewardRatio = (latestClose - targetPrice) / (stopLoss - latestClose);
        }

        // 计算杠杆和保证金（基于风险控制）
        const riskPercentage = 0.02; // 2%风险
        const stopDistance = Math.abs(latestClose - stopLoss) / latestClose;
        maxLeverage = Math.min(20, Math.floor(riskPercentage / stopDistance)); // 最大20倍杠杆
        minMargin = (latestClose * 0.1) / maxLeverage; // 假设10%仓位，最小保证金

        // 人工确认条件
        manualConfirmation = riskRewardRatio >= 2 && stopDistance >= 0.01; // 至少1%止损距离
      }

      return {
        pullbackToEma20,
        pullbackToEma50,
        breakSetupHigh,
        breakSetupLow,
        setupHigh,
        setupLow,
        atr: lastATR,
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
        pullbackToEma20: false,
        pullbackToEma50: false,
        breakSetupHigh: false,
        breakSetupLow: false,
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

    console.log(`🔍 CVD计算开始，K线数量: ${klines.length}`);

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

      // 调试前3根和后3根K线
      if (i < 3 || i >= klines.length - 3) {
        console.log(`  K线${i}: close=${close}, high=${high}, low=${low}, volume=${volume}, pricePosition=${pricePosition.toFixed(3)}, delta=${delta.toFixed(2)}, cumulative=${cumulativeDelta.toFixed(2)}`);
      }
    }

    console.log(`🔍 CVD计算完成，最终累积值: ${cumulativeDelta.toFixed(2)}`);
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
          cvd: 0,
          cvdDirection: 'NEUTRAL',
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

      // 严格按照strategy.md和auto-script.md的信号判断逻辑
      let signal = 'NO_SIGNAL';

      // 做多条件：趋势向上 + 价格在VWAP上 + 突破高点 + 放量 + OI增加 + 资金费率温和
      if (dailyTrend.trend === 'UPTREND' &&
        (hourlyConfirmation.priceVsVwap || 0) > 0 &&
        (hourlyConfirmation.breakoutUp || false) &&
        (hourlyConfirmation.volumeRatio || 0) >= 1.5 &&
        (hourlyConfirmation.oiChange || 0) >= 2 &&
        Math.abs(hourlyConfirmation.fundingRate || 0) <= 0.001) {
        signal = 'LONG';
      }
      // 做空条件：趋势向下 + 价格在VWAP下 + 突破低点 + 放量 + OI减少 + 资金费率温和
      else if (dailyTrend.trend === 'DOWNTREND' &&
        (hourlyConfirmation.priceVsVwap || 0) < 0 &&
        (hourlyConfirmation.breakoutDown || false) &&
        (hourlyConfirmation.volumeRatio || 0) >= 1.5 &&
        (hourlyConfirmation.oiChange || 0) <= -2 &&
        Math.abs(hourlyConfirmation.fundingRate || 0) <= 0.001) {
        signal = 'SHORT';
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

      // 严格按照strategy.md和auto-script.md的入场执行逻辑
      let execution = 'NO_EXECUTION';

      // 做多执行：等待回踩EMA20/50或前高支撑缩量企稳 + 突破setup candle高点
      if (signal === 'LONG' &&
        (execution15m.pullbackToEma20 || execution15m.pullbackToEma50) &&
        execution15m.breakSetupHigh) {
        execution = 'LONG_EXECUTE';
      }
      // 做空执行：等待回踩EMA20/50或前低支撑缩量企稳 + 突破setup candle低点
      else if (signal === 'SHORT' &&
        (execution15m.pullbackToEma20 || execution15m.pullbackToEma50) &&
        execution15m.breakSetupLow) {
        execution = 'SHORT_EXECUTE';
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

        // 止盈：≥2R目标
        const risk = Math.abs(entryPrice - stopLoss);
        const takeProfit = execution === 'LONG_EXECUTE' ?
          entryPrice + risk * 2 :
          entryPrice - risk * 2;

        const simulationData = {
          signal: execution,
          entryPrice,
          stopLoss,
          takeProfit,
          riskReward: 2.0,
          atr: atr,
          setupHigh: execution15m.setupHigh,
          setupLow: execution15m.setupLow,
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
        execution,
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
