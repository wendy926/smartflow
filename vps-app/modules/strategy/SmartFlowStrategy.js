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
      const closes = klines.map(k => parseFloat(k.close));

      const ma20 = TechnicalIndicators.calculateSMA(closes, 20);
      const ma50 = TechnicalIndicators.calculateSMA(closes, 50);
      const ma200 = TechnicalIndicators.calculateSMA(closes, 200);

      const latestClose = closes[closes.length - 1];
      const latestMA20 = ma20[ma20.length - 1];
      const latestMA50 = ma50[ma50.length - 1];
      const latestMA200 = ma200[ma200.length - 1];

      let trend = 'RANGE';
      // 严格按照strategy.md: MA50 > MA200 且价格在MA50上/下
      if (latestMA50 > latestMA200 && latestClose > latestMA50) {
        trend = 'UPTREND';
      } else if (latestMA50 < latestMA200 && latestClose < latestMA50) {
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
      const klines = symbolData?.klines || await BinanceAPI.getKlines(symbol, '1h', 200);
      const ticker = symbolData?.ticker || await BinanceAPI.get24hrTicker(symbol);
      const funding = symbolData?.funding || await BinanceAPI.getFundingRate(symbol);
      const openInterestHist = symbolData?.openInterestHist || await BinanceAPI.getOpenInterestHist(symbol, '1h', 7);

      const closes = klines.map(k => parseFloat(k.close));
      const volumes = klines.map(k => parseFloat(k.volume));
      const highs = klines.map(k => parseFloat(k.high));
      const lows = klines.map(k => parseFloat(k.low));

      // 计算VWAP
      const vwap = TechnicalIndicators.calculateVWAP(klines);
      const lastVWAP = vwap[vwap.length - 1];
      const lastClose = closes[closes.length - 1];

      // 计算成交量倍数
      const volSMA = TechnicalIndicators.calculateSMA(volumes, 20);
      const avgVol = volSMA[volSMA.length - 1];
      const lastVol = volumes[volumes.length - 1];
      const volumeRatio = lastVol / avgVol;

      // 检查突破
      const recentHighs = highs.slice(-20);
      const recentLows = lows.slice(-20);
      const breakoutUp = lastClose > Math.max(...recentHighs);
      const breakoutDown = lastClose < Math.min(...recentLows);

      // 计算OI变化
      const oiChange = openInterestHist.length > 1 ?
        ((openInterestHist[openInterestHist.length - 1].sumOpenInterest - openInterestHist[0].sumOpenInterest) / openInterestHist[0].sumOpenInterest) * 100 : 0;

      // 严格按照strategy.md和auto-script.md的确认条件
      // 1. 价格与VWAP方向一致
      // 2. 突破近20根高/低点
      // 3. 放量 ≥ 1.5×(20MA)
      // 4. OI 6h变动 ≥ +2%(做多) 或 ≤ -2%(做空)
      // 5. 资金费率 |FR| ≤ 0.1%/8h
      const priceVsVwap = lastClose - lastVWAP;
      const volumeConfirmed = volumeRatio >= 1.5;
      const fundingConfirmed = Math.abs(funding.fundingRate) <= 0.001;
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
        fundingRate: funding.fundingRate,
        cvd: { isActive: false, direction: 'N/A' },
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
      const closes = klines.map(k => parseFloat(k.close));
      const highs = klines.map(k => parseFloat(k.high));
      const lows = klines.map(k => parseFloat(k.low));

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

      return {
        pullbackToEma20,
        pullbackToEma50,
        breakSetupHigh,
        breakSetupLow,
        setupHigh,
        setupLow,
        atr: lastATR,
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
        BinanceAPI.getOpenInterestHist(symbol, '1h', 7)
      ]);

      const symbolData = { klines, ticker, funding, openInterestHist };

      // 记录原始数据
      this.dataMonitor.recordRawData(symbol, '日线K线', await BinanceAPI.getKlines(symbol, '1d', 250), true);
      this.dataMonitor.recordRawData(symbol, '小时K线', klines, true);
      this.dataMonitor.recordRawData(symbol, '24小时行情', ticker, true);
      this.dataMonitor.recordRawData(symbol, '资金费率', funding, true);
      this.dataMonitor.recordRawData(symbol, '持仓量历史', openInterestHist, true);

      // 分析各个阶段
      const dailyTrend = await this.analyzeDailyTrend(symbol, symbolData);
      const hourlyConfirmation = await this.analyzeHourlyConfirmation(symbol, symbolData);
      const execution15m = await this.analyze15mExecution(symbol, symbolData);

      // 记录指标计算
      this.dataMonitor.recordIndicator(symbol, '日线MA指标', {
        ma20: dailyTrend.ma20,
        ma50: dailyTrend.ma50,
        ma200: dailyTrend.ma200
      }, Date.now() - startTime);

      this.dataMonitor.recordIndicator(symbol, '小时VWAP', {
        vwap: hourlyConfirmation.vwap,
        volumeRatio: hourlyConfirmation.volumeRatio
      }, Date.now() - startTime);

      // 严格按照strategy.md和auto-script.md的信号判断逻辑
      let signal = 'NO_SIGNAL';

      // 做多条件：趋势向上 + 价格在VWAP上 + 突破高点 + 放量 + OI增加 + 资金费率温和
      if (dailyTrend.trend === 'UPTREND' &&
        hourlyConfirmation.priceVsVwap > 0 &&
        hourlyConfirmation.breakoutUp &&
        hourlyConfirmation.volumeRatio >= 1.5 &&
        hourlyConfirmation.oiChange >= 2 &&
        Math.abs(hourlyConfirmation.fundingRate) <= 0.001) {
        signal = 'LONG';
      }
      // 做空条件：趋势向下 + 价格在VWAP下 + 突破低点 + 放量 + OI减少 + 资金费率温和
      else if (dailyTrend.trend === 'DOWNTREND' &&
        hourlyConfirmation.priceVsVwap < 0 &&
        hourlyConfirmation.breakoutDown &&
        hourlyConfirmation.volumeRatio >= 1.5 &&
        hourlyConfirmation.oiChange <= -2 &&
        Math.abs(hourlyConfirmation.fundingRate) <= 0.001) {
        signal = 'SHORT';
      }

      // 记录信号
      this.dataMonitor.recordSignal(symbol, '综合分析', {
        signal,
        trend: dailyTrend.trend,
        confirmed: hourlyConfirmation.confirmed,
        priceVsVwap: hourlyConfirmation.priceVsVwap,
        breakoutUp: hourlyConfirmation.breakoutUp,
        breakoutDown: hourlyConfirmation.breakoutDown,
        oiChange: hourlyConfirmation.oiChange,
        fundingRate: hourlyConfirmation.fundingRate
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

      console.log(`✅ ${symbol} 分析完成，耗时: ${duration}ms`);

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
