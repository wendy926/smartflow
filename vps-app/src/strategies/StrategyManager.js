/**
 * 策略管理器
 * 整合K线数据获取、技术指标计算、策略分析等功能
 */

const KlineDataFetcher = require('./KlineDataFetcher');
const TechnicalIndicators = require('./TechnicalIndicators');
const DatabaseManager = require('./DatabaseManager');
const V3Strategy = require('./V3Strategy');
const ICTStrategy = require('./ICTStrategy');

class StrategyManager {
  constructor(dbPath = './smartflow.db') {
    this.klineFetcher = new KlineDataFetcher();
    this.databaseManager = new DatabaseManager(dbPath);
    this.v3Strategy = new V3Strategy();
    this.ictStrategy = new ICTStrategy();

    // 默认分析的交易对
    this.symbols = [
      'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT',
      'XRPUSDT', 'DOGEUSDT', 'DOTUSDT', 'AVAXUSDT', 'LINKUSDT'
    ];

    // 时间框架配置
    this.timeframes = ['1d', '4h', '1h', '15m'];
  }

  /**
   * 初始化策略管理器
   */
  async init() {
    try {
      console.log('🔄 初始化策略管理器...');

      // 初始化数据库表
      await this.databaseManager.initTables();

      console.log('✅ 策略管理器初始化完成');
    } catch (error) {
      console.error('❌ 策略管理器初始化失败:', error.message);
      throw error;
    }
  }

  /**
   * 更新指定交易对的数据
   * @param {string} symbol - 交易对符号
   * @param {Array} timeframes - 时间框架数组
   */
  async updateSymbolData(symbol, timeframes = this.timeframes) {
    try {
      console.log(`🔄 更新 ${symbol} 数据...`);

      // 1. 获取K线数据
      const klineData = await this.klineFetcher.fetchMultipleTimeframes(symbol, timeframes, 500);

      // 2. 存储K线数据
      for (const timeframe of timeframes) {
        if (klineData[timeframe] && klineData[timeframe].length > 0) {
          const count = await this.databaseManager.insertKlineData(symbol, timeframe, klineData[timeframe]);
          await this.databaseManager.logDataUpdate('kline', symbol, timeframe, count, 'SUCCESS');
        }
      }

      // 3. 计算技术指标
      for (const timeframe of timeframes) {
        if (klineData[timeframe] && klineData[timeframe].length > 0) {
          await this.calculateAndStoreIndicators(symbol, timeframe, klineData[timeframe]);
        }
      }

      console.log(`✅ ${symbol} 数据更新完成`);

    } catch (error) {
      console.error(`❌ 更新 ${symbol} 数据失败:`, error.message);
      await this.databaseManager.logDataUpdate('kline', symbol, 'ALL', 0, 'FAILED', error.message);
    }
  }

  /**
   * 计算并存储技术指标
   * @param {string} symbol - 交易对符号
   * @param {string} timeframe - 时间框架
   * @param {Array} klines - K线数据
   */
  async calculateAndStoreIndicators(symbol, timeframe, klines) {
    try {
      if (klines.length < 200) {
        console.warn(`⚠️ ${symbol} ${timeframe} K线数据不足(${klines.length}/200)，跳过指标计算`);
        return;
      }

      const closes = klines.map(k => k.close);
      const highs = klines.map(k => k.high);
      const lows = klines.map(k => k.low);
      const volumes = klines.map(k => k.volume);

      let successCount = 0;

      // 从第200根K线开始计算指标（确保有足够历史数据）
      for (let i = 200; i < klines.length; i++) {
        const currentKline = klines[i];
        const openTime = currentKline.openTime;

        // 计算各种技术指标
        const indicators = {
          // MA指标
          ma20: TechnicalIndicators.calculateSMA(closes.slice(0, i + 1), 20).slice(-1)[0],
          ma50: TechnicalIndicators.calculateSMA(closes.slice(0, i + 1), 50).slice(-1)[0],
          ma200: TechnicalIndicators.calculateSMA(closes.slice(0, i + 1), 200).slice(-1)[0],

          // EMA指标
          ema20: TechnicalIndicators.calculateEMA(closes.slice(0, i + 1), 20).slice(-1)[0],
          ema50: TechnicalIndicators.calculateEMA(closes.slice(0, i + 1), 50).slice(-1)[0],

          // ATR指标
          atr14: TechnicalIndicators.calculateATR(
            highs.slice(0, i + 1),
            lows.slice(0, i + 1),
            closes.slice(0, i + 1),
            14
          ).slice(-1)[0],

          // ADX指标
          adx14: TechnicalIndicators.calculateADX(
            highs.slice(0, i + 1),
            lows.slice(0, i + 1),
            closes.slice(0, i + 1),
            14
          ).adx,
          diPlus: TechnicalIndicators.calculateADX(
            highs.slice(0, i + 1),
            lows.slice(0, i + 1),
            closes.slice(0, i + 1),
            14
          ).diPlus,
          diMinus: TechnicalIndicators.calculateADX(
            highs.slice(0, i + 1),
            lows.slice(0, i + 1),
            closes.slice(0, i + 1),
            14
          ).diMinus,

          // 布林带
          bbUpper: null,
          bbMiddle: null,
          bbLower: null,
          bbWidth: null,

          // VWAP
          vwap: TechnicalIndicators.calculateVWAP(klines.slice(Math.max(0, i - 19), i + 1)),

          // 成交量指标
          volumeMA20: TechnicalIndicators.calculateSMA(volumes.slice(0, i + 1), 20).slice(-1)[0],
          volumeRatio: volumes[i] / (TechnicalIndicators.calculateSMA(volumes.slice(0, i + 1), 20).slice(-1)[0] || 1),

          // 其他指标（暂时设为null，后续可以扩展）
          oiChange6h: null,
          fundingRate: null,
          deltaBuy: null,
          deltaSell: null,
          deltaRatio: null
        };

        // 计算布林带
        const bbBands = TechnicalIndicators.calculateBollingerBands(closes.slice(0, i + 1), 20, 2);
        if (bbBands.length > 0) {
          const bb = bbBands[bbBands.length - 1];
          indicators.bbUpper = bb.upper;
          indicators.bbMiddle = bb.middle;
          indicators.bbLower = bb.lower;
          indicators.bbWidth = bb.width;
        }

        // 存储技术指标
        await this.databaseManager.insertTechnicalIndicators(symbol, timeframe, openTime, indicators);
        successCount++;
      }

      await this.databaseManager.logDataUpdate('indicators', symbol, timeframe, successCount, 'SUCCESS');
      console.log(`✅ ${symbol} ${timeframe} 技术指标计算完成: ${successCount}条`);

    } catch (error) {
      console.error(`❌ 计算 ${symbol} ${timeframe} 技术指标失败:`, error.message);
      await this.databaseManager.logDataUpdate('indicators', symbol, timeframe, 0, 'FAILED', error.message);
    }
  }

  /**
   * 分析指定交易对的策略
   * @param {string} symbol - 交易对符号
   */
  async analyzeSymbol(symbol) {
    try {
      console.log(`🔄 开始分析 ${symbol} 策略...`);

      // 1. 获取K线数据
      const klineData = {};
      const indicatorsData = {};

      for (const timeframe of this.timeframes) {
        // 获取K线数据
        const klines = await this.databaseManager.getKlineData(symbol, timeframe, 500);
        klineData[timeframe] = klines.map(k => ({
          openTime: k.open_time,
          closeTime: k.close_time,
          open: k.open_price,
          high: k.high_price,
          low: k.low_price,
          close: k.close_price,
          volume: k.volume,
          quoteVolume: k.quote_volume,
          tradesCount: k.trades_count,
          takerBuyBaseVolume: k.taker_buy_base_volume,
          takerBuyQuoteVolume: k.taker_buy_quote_volume
        }));

        // 获取技术指标数据
        const indicators = await this.databaseManager.getTechnicalIndicators(symbol, timeframe, 100);
        indicatorsData[timeframe] = indicators.map(i => ({
          openTime: i.open_time,
          ma20: i.ma20,
          ma50: i.ma50,
          ma200: i.ma200,
          ema20: i.ema20,
          ema50: i.ema50,
          atr14: i.atr14,
          adx14: i.adx14,
          diPlus: i.di_plus,
          diMinus: i.di_minus,
          bbUpper: i.bb_upper,
          bbMiddle: i.bb_middle,
          bbLower: i.bb_lower,
          bbWidth: i.bb_width,
          vwap: i.vwap,
          volumeMA20: i.volume_ma20,
          volumeRatio: i.volume_ratio,
          oiChange6h: i.oi_change_6h,
          fundingRate: i.funding_rate,
          deltaBuy: i.delta_buy,
          deltaSell: i.delta_sell,
          deltaRatio: i.delta_ratio
        }));
      }

      // 2. V3策略分析
      const v3Result = this.v3Strategy.analyze(symbol, klineData, indicatorsData);
      if (v3Result && !v3Result.error) {
        await this.databaseManager.insertV3Analysis(v3Result);
        console.log(`✅ ${symbol} V3策略分析完成: ${v3Result.finalSignal}`);
      }

      // 3. ICT策略分析
      const ictResult = this.ictStrategy.analyze(symbol, klineData, indicatorsData);
      if (ictResult && !ictResult.error) {
        await this.databaseManager.insertICTAnalysis(ictResult);
        console.log(`✅ ${symbol} ICT策略分析完成: ${ictResult.signalType}`);
      }

      await this.databaseManager.logDataUpdate('analysis', symbol, 'ALL', 1, 'SUCCESS');
      console.log(`✅ ${symbol} 策略分析完成`);

    } catch (error) {
      console.error(`❌ 分析 ${symbol} 策略失败:`, error.message);
      await this.databaseManager.logDataUpdate('analysis', symbol, 'ALL', 0, 'FAILED', error.message);
    }
  }

  /**
   * 批量更新所有交易对数据
   */
  async updateAllSymbols() {
    console.log('🔄 开始批量更新所有交易对数据...');

    for (const symbol of this.symbols) {
      try {
        await this.updateSymbolData(symbol);

        // 添加延迟避免API限制
        await this.klineFetcher.delay(200);

      } catch (error) {
        console.error(`❌ 更新 ${symbol} 失败:`, error.message);
      }
    }

    console.log('✅ 批量更新完成');
  }

  /**
   * 批量分析所有交易对策略
   */
  async analyzeAllSymbols() {
    console.log('🔄 开始批量分析所有交易对策略...');

    for (const symbol of this.symbols) {
      try {
        await this.analyzeSymbol(symbol);

        // 添加延迟
        await this.klineFetcher.delay(100);

      } catch (error) {
        console.error(`❌ 分析 ${symbol} 失败:`, error.message);
      }
    }

    console.log('✅ 批量分析完成');
  }

  /**
   * 获取策略分析结果
   * @param {string} symbol - 交易对符号
   * @param {string} strategyType - 策略类型 'V3' | 'ICT'
   * @param {number} limit - 结果数量限制
   * @returns {Promise<Array>} 分析结果数组
   */
  async getStrategyResults(symbol, strategyType, limit = 10) {
    try {
      let tableName = '';
      if (strategyType === 'V3') {
        tableName = 'v3_analysis';
      } else if (strategyType === 'ICT') {
        tableName = 'ict_analysis';
      } else {
        throw new Error(`不支持的策略类型: ${strategyType}`);
      }

      const sql = `
        SELECT * FROM ${tableName} 
        WHERE symbol = ? 
        ORDER BY analysis_time DESC 
        LIMIT ?
      `;

      return new Promise((resolve, reject) => {
        this.databaseManager.db.all(sql, [symbol, limit], (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });

    } catch (error) {
      console.error(`❌ 获取策略结果失败:`, error.message);
      return [];
    }
  }

  /**
   * 关闭管理器
   */
  async close() {
    await this.databaseManager.close();
  }
}

module.exports = StrategyManager;
