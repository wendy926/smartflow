/**
 * 数据库操作管理器
 * 负责K线数据和技术指标的存储和查询
 */

const sqlite3 = require('sqlite3').verbose();

class DatabaseManager {
  constructor(dbPath = './smartflow.db') {
    this.db = new sqlite3.Database(dbPath);
  }

  /**
   * 初始化数据库表结构
   */
  async initTables() {
    const createTablesSQL = `
      -- K线数据表
      CREATE TABLE IF NOT EXISTS kline_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        timeframe TEXT NOT NULL,
        open_time INTEGER NOT NULL,
        close_time INTEGER NOT NULL,
        open_price REAL NOT NULL,
        high_price REAL NOT NULL,
        low_price REAL NOT NULL,
        close_price REAL NOT NULL,
        volume REAL NOT NULL,
        quote_volume REAL,
        trades_count INTEGER,
        taker_buy_base_volume REAL,
        taker_buy_quote_volume REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(symbol, timeframe, open_time)
      );

      -- 技术指标表
      CREATE TABLE IF NOT EXISTS technical_indicators (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        timeframe TEXT NOT NULL,
        open_time INTEGER NOT NULL,
        ma20 REAL, ma50 REAL, ma200 REAL,
        ema20 REAL, ema50 REAL,
        atr14 REAL, atr20 REAL,
        adx14 REAL, di_plus REAL, di_minus REAL,
        bb_upper REAL, bb_middle REAL, bb_lower REAL, bb_width REAL,
        vwap REAL, volume_ma20 REAL, volume_ratio REAL,
        oi_change_6h REAL, funding_rate REAL,
        delta_buy REAL, delta_sell REAL, delta_ratio REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(symbol, timeframe, open_time)
      );

      -- V3策略分析结果表
      CREATE TABLE IF NOT EXISTS v3_analysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        analysis_time INTEGER NOT NULL,
        trend4h TEXT, trend4h_score INTEGER, trend_strength TEXT,
        ma20_4h REAL, ma50_4h REAL, ma200_4h REAL,
        adx14_4h REAL, di_plus_4h REAL, di_minus_4h REAL,
        bb_width_4h REAL, bb_expanding BOOLEAN,
        score1h INTEGER, vwap_direction TEXT, breakout_confirmed BOOLEAN,
        volume_confirmed_15m BOOLEAN, volume_confirmed_1h BOOLEAN,
        oi_change_confirmed BOOLEAN, funding_rate_ok BOOLEAN, delta_confirmed BOOLEAN,
        vwap_1h REAL, volume_ratio_15m REAL, volume_ratio_1h REAL,
        oi_change_6h REAL, funding_rate REAL, delta_buy REAL, delta_sell REAL,
        execution_mode TEXT, entry_price REAL, stop_loss REAL, take_profit REAL,
        atr_value REAL, setup_candle_high REAL, setup_candle_low REAL,
        final_signal TEXT, signal_strength TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(symbol, analysis_time)
      );

      -- ICT策略分析结果表
      CREATE TABLE IF NOT EXISTS ict_analysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        analysis_time INTEGER NOT NULL,
        daily_trend TEXT, daily_trend_score INTEGER,
        daily_close_20_ago REAL, daily_close_current REAL,
        ob_detected BOOLEAN, ob_low REAL, ob_high REAL, ob_age_days REAL, ob_height_atr_ratio REAL,
        fvg_detected BOOLEAN, fvg_low REAL, fvg_high REAL, fvg_age_days REAL,
        sweep_htf BOOLEAN, sweep_htf_speed REAL,
        sweep_ltf BOOLEAN, sweep_ltf_speed REAL,
        atr_4h REAL, atr_15m REAL,
        engulfing_detected BOOLEAN, volume_confirm BOOLEAN,
        signal_type TEXT, signal_strength TEXT,
        entry_price REAL, stop_loss REAL, take_profit REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(symbol, analysis_time)
      );

      -- 数据更新日志表
      CREATE TABLE IF NOT EXISTS data_update_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data_type TEXT NOT NULL,
        symbol TEXT, timeframe TEXT,
        update_time INTEGER NOT NULL,
        records_updated INTEGER,
        status TEXT,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;

    return new Promise((resolve, reject) => {
      this.db.exec(createTablesSQL, (err) => {
        if (err) {
          console.error('❌ 创建数据库表失败:', err.message);
          reject(err);
        } else {
          console.log('✅ 数据库表创建成功');
          resolve();
        }
      });
    });
  }

  /**
   * 批量插入K线数据
   * @param {string} symbol - 交易对符号
   * @param {string} timeframe - 时间框架
   * @param {Array} klines - K线数据数组
   */
  async insertKlineData(symbol, timeframe, klines) {
    if (!klines || klines.length === 0) {
      return;
    }

    const insertSQL = `
      INSERT OR REPLACE INTO kline_data 
      (symbol, timeframe, open_time, close_time, open_price, high_price, low_price, close_price, 
       volume, quote_volume, trades_count, taker_buy_base_volume, taker_buy_quote_volume)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');

        const stmt = this.db.prepare(insertSQL);
        let successCount = 0;

        klines.forEach(kline => {
          stmt.run([
            symbol,
            timeframe,
            kline.openTime,
            kline.closeTime,
            kline.open,
            kline.high,
            kline.low,
            kline.close,
            kline.volume,
            kline.quoteVolume,
            kline.tradesCount,
            kline.takerBuyBaseVolume,
            kline.takerBuyQuoteVolume
          ], (err) => {
            if (err) {
              console.error(`❌ 插入K线数据失败:`, err.message);
            } else {
              successCount++;
            }
          });
        });

        stmt.finalize((err) => {
          if (err) {
            console.error('❌ 准备语句结束失败:', err.message);
            this.db.run('ROLLBACK');
            reject(err);
          } else {
            this.db.run('COMMIT', (err) => {
              if (err) {
                console.error('❌ 提交事务失败:', err.message);
                reject(err);
              } else {
                console.log(`✅ 成功插入 ${successCount}/${klines.length} 条K线数据: ${symbol} ${timeframe}`);
                resolve(successCount);
              }
            });
          }
        });
      });
    });
  }

  /**
   * 插入技术指标数据
   * @param {string} symbol - 交易对符号
   * @param {string} timeframe - 时间框架
   * @param {number} openTime - 开盘时间
   * @param {Object} indicators - 技术指标数据
   */
  async insertTechnicalIndicators(symbol, timeframe, openTime, indicators) {
    const insertSQL = `
      INSERT OR REPLACE INTO technical_indicators 
      (symbol, timeframe, open_time, ma20, ma50, ma200, ema20, ema50, atr14, atr20,
       adx14, di_plus, di_minus, bb_upper, bb_middle, bb_lower, bb_width,
       vwap, volume_ma20, volume_ratio, oi_change_6h, funding_rate,
       delta_buy, delta_sell, delta_ratio)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(insertSQL, [
        symbol, timeframe, openTime,
        indicators.ma20, indicators.ma50, indicators.ma200,
        indicators.ema20, indicators.ema50,
        indicators.atr14, indicators.atr20,
        indicators.adx14, indicators.diPlus, indicators.diMinus,
        indicators.bbUpper, indicators.bbMiddle, indicators.bbLower, indicators.bbWidth,
        indicators.vwap, indicators.volumeMA20, indicators.volumeRatio,
        indicators.oiChange6h, indicators.fundingRate,
        indicators.deltaBuy, indicators.deltaSell, indicators.deltaRatio
      ], (err) => {
        if (err) {
          console.error(`❌ 插入技术指标失败:`, err.message);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 插入V3策略分析结果
   * @param {Object} analysis - V3分析结果
   */
  async insertV3Analysis(analysis) {
    const insertSQL = `
      INSERT OR REPLACE INTO v3_analysis 
      (symbol, analysis_time, trend4h, trend4h_score, trend_strength,
       ma20_4h, ma50_4h, ma200_4h, adx14_4h, di_plus_4h, di_minus_4h,
       bb_width_4h, bb_expanding, score1h, vwap_direction, breakout_confirmed,
       volume_confirmed_15m, volume_confirmed_1h, oi_change_confirmed,
       funding_rate_ok, delta_confirmed, vwap_1h, volume_ratio_15m, volume_ratio_1h,
       oi_change_6h, funding_rate, delta_buy, delta_sell, execution_mode,
       entry_price, stop_loss, take_profit, atr_value, setup_candle_high, setup_candle_low,
       final_signal, signal_strength)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(insertSQL, [
        analysis.symbol, analysis.analysisTime, analysis.trend4h, analysis.trend4hScore, analysis.trendStrength,
        analysis.ma20_4h, analysis.ma50_4h, analysis.ma200_4h, analysis.adx14_4h, analysis.diPlus_4h, analysis.diMinus_4h,
        analysis.bbWidth_4h, analysis.bbExpanding, analysis.score1h, analysis.vwapDirection, analysis.breakoutConfirmed,
        analysis.volumeConfirmed15m, analysis.volumeConfirmed1h, analysis.oiChangeConfirmed,
        analysis.fundingRateOk, analysis.deltaConfirmed, analysis.vwap_1h, analysis.volumeRatio15m, analysis.volumeRatio1h,
        analysis.oiChange6h, analysis.fundingRate, analysis.deltaBuy, analysis.deltaSell, analysis.executionMode,
        analysis.entryPrice, analysis.stopLoss, analysis.takeProfit, analysis.atrValue, analysis.setupCandleHigh, analysis.setupCandleLow,
        analysis.finalSignal, analysis.signalStrength
      ], (err) => {
        if (err) {
          console.error(`❌ 插入V3分析结果失败:`, err.message);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 插入ICT策略分析结果
   * @param {Object} analysis - ICT分析结果
   */
  async insertICTAnalysis(analysis) {
    const insertSQL = `
      INSERT OR REPLACE INTO ict_analysis 
      (symbol, analysis_time, daily_trend, daily_trend_score,
       daily_close_20_ago, daily_close_current, ob_detected, ob_low, ob_high, ob_age_days, ob_height_atr_ratio,
       fvg_detected, fvg_low, fvg_high, fvg_age_days, sweep_htf, sweep_htf_speed,
       sweep_ltf, sweep_ltf_speed, atr_4h, atr_15m, engulfing_detected, volume_confirm,
       signal_type, signal_strength, entry_price, stop_loss, take_profit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(insertSQL, [
        analysis.symbol, analysis.analysisTime, analysis.dailyTrend, analysis.dailyTrendScore,
        analysis.dailyClose20Ago, analysis.dailyCloseCurrent, analysis.obDetected, analysis.obLow, analysis.obHigh, analysis.obAgeDays, analysis.obHeightAtrRatio,
        analysis.fvgDetected, analysis.fvgLow, analysis.fvgHigh, analysis.fvgAgeDays, analysis.sweepHTF, analysis.sweepHTFSpeed,
        analysis.sweepLTF, analysis.sweepLTFSpeed, analysis.atr4h, analysis.atr15m, analysis.engulfingDetected, analysis.volumeConfirm,
        analysis.signalType, analysis.signalStrength, analysis.entryPrice, analysis.stopLoss, analysis.takeProfit
      ], (err) => {
        if (err) {
          console.error(`❌ 插入ICT分析结果失败:`, err.message);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 查询K线数据
   * @param {string} symbol - 交易对符号
   * @param {string} timeframe - 时间框架
   * @param {number} limit - 数据条数
   * @param {number} startTime - 开始时间戳（可选）
   * @returns {Promise<Array>} K线数据数组
   */
  async getKlineData(symbol, timeframe, limit = 500, startTime = null) {
    let sql = `
      SELECT * FROM kline_data 
      WHERE symbol = ? AND timeframe = ?
    `;
    const params = [symbol, timeframe];

    if (startTime) {
      sql += ' AND open_time >= ?';
      params.push(startTime);
    }

    sql += ' ORDER BY open_time DESC LIMIT ?';
    params.push(limit);

    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          console.error(`❌ 查询K线数据失败:`, err.message);
          reject(err);
        } else {
          resolve(rows.reverse()); // 按时间正序返回
        }
      });
    });
  }

  /**
   * 查询技术指标数据
   * @param {string} symbol - 交易对符号
   * @param {string} timeframe - 时间框架
   * @param {number} limit - 数据条数
   * @returns {Promise<Array>} 技术指标数据数组
   */
  async getTechnicalIndicators(symbol, timeframe, limit = 100) {
    const sql = `
      SELECT * FROM technical_indicators 
      WHERE symbol = ? AND timeframe = ?
      ORDER BY open_time DESC LIMIT ?
    `;

    return new Promise((resolve, reject) => {
      this.db.all(sql, [symbol, timeframe, limit], (err, rows) => {
        if (err) {
          console.error(`❌ 查询技术指标失败:`, err.message);
          reject(err);
        } else {
          resolve(rows.reverse()); // 按时间正序返回
        }
      });
    });
  }

  /**
   * 记录数据更新日志
   * @param {string} dataType - 数据类型
   * @param {string} symbol - 交易对符号
   * @param {string} timeframe - 时间框架
   * @param {number} recordsUpdated - 更新记录数
   * @param {string} status - 状态
   * @param {string} errorMessage - 错误信息（可选）
   */
  async logDataUpdate(dataType, symbol, timeframe, recordsUpdated, status, errorMessage = null) {
    const insertSQL = `
      INSERT INTO data_update_log 
      (data_type, symbol, timeframe, update_time, records_updated, status, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(insertSQL, [
        dataType, symbol, timeframe, Math.floor(Date.now() / 1000), recordsUpdated, status, errorMessage
      ], (err) => {
        if (err) {
          console.error(`❌ 记录数据更新日志失败:`, err.message);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 关闭数据库连接
   */
  close() {
    return new Promise((resolve) => {
      this.db.close((err) => {
        if (err) {
          console.error('❌ 关闭数据库连接失败:', err.message);
        } else {
          console.log('✅ 数据库连接已关闭');
        }
        resolve();
      });
    });
  }
}

module.exports = DatabaseManager;
