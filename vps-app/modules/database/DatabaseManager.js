// modules/database/DatabaseManager.js
// 数据库管理模块

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseManager {
  constructor() {
    this.db = null;
    // 根据环境设置数据库路径
    if (process.env.NODE_ENV === 'production') {
      this.dbPath = '/home/admin/smartflow-vps-app/vps-app/smartflow.db';
    } else {
      this.dbPath = path.join(__dirname, '..', '..', 'smartflow.db');
    }
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('❌ 数据库连接失败:', err.message);
          reject(err);
        } else {
          console.log('✅ 数据库连接成功');
          this.initTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async initTables() {
    const tables = [
      // 策略分析记录表 - 存储完整的策略分析结果
      `CREATE TABLE IF NOT EXISTS strategy_analysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        category TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        -- 天级趋势数据
        trend TEXT,
        trend_strength TEXT,
        ma20 REAL,
        ma50 REAL,
        ma200 REAL,
        bbw_expanding BOOLEAN,
        -- 小时级趋势加强数据
        signal TEXT,
        signal_strength TEXT,
        hourly_score INTEGER,
        vwap REAL,
        oi_change REAL,
        funding_rate REAL,
        -- 15分钟入场执行数据
        execution TEXT,
        execution_mode TEXT,
        mode_a BOOLEAN,
        mode_b BOOLEAN,
        entry_signal REAL,
        stop_loss REAL,
        take_profit REAL,
        -- 基础信息
        current_price REAL,
        data_collection_rate REAL,
        -- 完整数据JSON
        full_analysis_data TEXT,
        -- 数据质量
        data_valid BOOLEAN DEFAULT TRUE,
        error_message TEXT
      )`,

      // 信号记录表 - 保持向后兼容
      `CREATE TABLE IF NOT EXISTS signal_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        signal_type TEXT NOT NULL,
        signal_data TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        result TEXT,
        notes TEXT
      )`,

      // 入场执行记录表 - 保持向后兼容
      `CREATE TABLE IF NOT EXISTS execution_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        execution_type TEXT NOT NULL,
        execution_data TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        result TEXT,
        notes TEXT
      )`,

      // 模拟交易表
      `CREATE TABLE IF NOT EXISTS simulations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        entry_price REAL NOT NULL,
        stop_loss_price REAL NOT NULL,
        take_profit_price REAL NOT NULL,
        max_leverage INTEGER NOT NULL,
        min_margin REAL NOT NULL,
        trigger_reason TEXT NOT NULL,
        status TEXT DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME,
        exit_price REAL,
        exit_reason TEXT,
        is_win BOOLEAN,
        profit_loss REAL
      )`,

      // 胜率统计表
      `CREATE TABLE IF NOT EXISTS win_rate_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        total_trades INTEGER DEFAULT 0,
        winning_trades INTEGER DEFAULT 0,
        losing_trades INTEGER DEFAULT 0,
        win_rate REAL DEFAULT 0,
        total_profit REAL DEFAULT 0,
        total_loss REAL DEFAULT 0,
        net_profit REAL DEFAULT 0,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // 交易对分类表
      `CREATE TABLE IF NOT EXISTS symbol_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        name TEXT,
        market_cap REAL,
        price REAL,
        suggested_frequency TEXT,
        suggested_holding_period TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // 多因子权重配置表
      `CREATE TABLE IF NOT EXISTS factor_weights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        analysis_type TEXT NOT NULL,
        vwap_weight REAL NOT NULL,
        delta_weight REAL NOT NULL,
        oi_weight REAL NOT NULL,
        volume_weight REAL NOT NULL,
        breakout_weight REAL,
        funding_weight REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(category, analysis_type)
      )`,

      // 告警历史记录表
      `CREATE TABLE IF NOT EXISTS alert_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        alert_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        message TEXT NOT NULL,
        details TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved BOOLEAN DEFAULT FALSE,
        resolved_at DATETIME
      )`,

      // 自定义交易对表
      `CREATE TABLE IF NOT EXISTS custom_symbols (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT UNIQUE NOT NULL,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // 用户设置表
      `CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setting_key TEXT UNIQUE NOT NULL,
        setting_value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const table of tables) {
      await this.runQuery(table);
    }

    await this.initWinRateStats();
    await this.initCustomSymbols();
  }

  async initWinRateStats() {
    const checkQuery = 'SELECT COUNT(*) as count FROM win_rate_stats';
    const result = await this.runQuery(checkQuery);

    if (result[0].count === 0) {
      await this.runQuery(`
        INSERT INTO win_rate_stats (total_trades, winning_trades, losing_trades, win_rate, total_profit, total_loss, net_profit)
        VALUES (0, 0, 0, 0, 0, 0, 0)
      `);
    }
  }

  async initCustomSymbols() {
    const defaultSymbols = ['BTCUSDT', 'ETHUSDT', 'LINKUSDT', 'LDOUSDT'];

    for (const symbol of defaultSymbols) {
      try {
        await this.runQuery('INSERT OR IGNORE INTO custom_symbols (symbol) VALUES (?)', [symbol]);
      } catch (err) {
        // 忽略重复插入错误
      }
    }
  }

  async runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  // 记录交易对分类
  async recordSymbolCategory(symbolData) {
    const sql = `
      INSERT OR REPLACE INTO symbol_categories 
      (symbol, category, name, market_cap, price, suggested_frequency, suggested_holding_period, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;
    
    const params = [
      symbolData.symbol,
      symbolData.category,
      symbolData.name,
      symbolData.marketCap,
      symbolData.price,
      symbolData.suggestedFrequency,
      symbolData.suggestedHoldingPeriod
    ];

    return await this.run(sql, params);
  }

  // 获取交易对分类
  async getSymbolCategory(symbol) {
    const sql = `SELECT * FROM symbol_categories WHERE symbol = ?`;
    const rows = await this.runQuery(sql, [symbol]);
    return rows.length > 0 ? rows[0] : null;
  }

  // 获取所有交易对分类
  async getAllSymbolCategories() {
    const sql = `SELECT * FROM symbol_categories ORDER BY category, symbol`;
    return await this.runQuery(sql);
  }

  // 记录多因子权重配置
  async recordFactorWeights(weightData) {
    const sql = `
      INSERT OR REPLACE INTO factor_weights 
      (category, analysis_type, vwap_weight, delta_weight, oi_weight, volume_weight, 
       breakout_weight, funding_weight, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;
    
    const params = [
      weightData.category,
      weightData.analysisType,
      weightData.vwapWeight,
      weightData.deltaWeight,
      weightData.oiWeight,
      weightData.volumeWeight,
      weightData.breakoutWeight,
      weightData.fundingWeight
    ];

    return await this.run(sql, params);
  }

  // 获取多因子权重配置
  async getFactorWeights(category, analysisType) {
    const sql = `SELECT * FROM factor_weights WHERE category = ? AND analysis_type = ?`;
    const rows = await this.runQuery(sql, [category, analysisType]);
    return rows.length > 0 ? rows[0] : null;
  }

  // 获取所有多因子权重配置
  async getAllFactorWeights() {
    const sql = `SELECT * FROM factor_weights ORDER BY category, analysis_type`;
    return await this.runQuery(sql);
  }

  // 记录策略分析结果 - 适配V3策略
  async recordStrategyAnalysis(analysisData) {
    // 检查是否是V3策略数据
    const isV3Strategy = analysisData.strategyVersion === 'V3';
    
    if (isV3Strategy) {
      // V3策略数据结构
      const sql = `
        INSERT INTO strategy_analysis (
          symbol, category, trend, trend_strength, ma20, ma50, ma200, bbw_expanding,
          signal, signal_strength, hourly_score, vwap, oi_change, funding_rate,
          execution, execution_mode, mode_a, mode_b, entry_signal, stop_loss, take_profit,
          current_price, data_collection_rate, full_analysis_data, data_valid, error_message,
          market_type, vwap_direction_consistent, factors, vol15m_ratio, vol1h_ratio,
          delta_imbalance, strategy_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        analysisData.symbol,
        analysisData.category,
        analysisData.trend4h || analysisData.trend, // V3使用trend4h
        analysisData.trendStrength,
        analysisData.ma20,
        analysisData.ma50,
        analysisData.ma200,
        analysisData.bbwExpanding,
        analysisData.signal,
        analysisData.signalStrength,
        analysisData.score1h || analysisData.hourlyScore, // V3使用score1h
        analysisData.vwap,
        analysisData.oiChange6h || analysisData.oiChange,
        analysisData.fundingRate,
        analysisData.execution,
        analysisData.executionMode,
        analysisData.modeA,
        analysisData.modeB,
        analysisData.entrySignal,
        analysisData.stopLoss,
        analysisData.takeProfit,
        analysisData.currentPrice,
        analysisData.dataCollectionRate,
        JSON.stringify(analysisData),
        analysisData.dataValid !== false,
        analysisData.error || null,
        analysisData.marketType,
        analysisData.vwapDirectionConsistent,
        JSON.stringify(analysisData.factors || {}),
        analysisData.vol15mRatio,
        analysisData.vol1hRatio,
        analysisData.deltaImbalance,
        analysisData.strategyVersion
      ];

      return await this.run(sql, params);
    } else {
      // V2策略数据结构（向后兼容）
      const sql = `
        INSERT INTO strategy_analysis (
          symbol, trend, trend_strength, ma20, ma50, ma200, bbw_expanding,
          signal, signal_strength, hourly_score, vwap, oi_change, funding_rate,
          execution, execution_mode, mode_a, mode_b, entry_signal, stop_loss, take_profit,
          current_price, data_collection_rate, full_analysis_data, data_valid, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        analysisData.symbol,
        analysisData.trend,
        analysisData.trendStrength,
        analysisData.dailyTrend?.ma20,
        analysisData.dailyTrend?.ma50,
        analysisData.dailyTrend?.ma200,
        analysisData.dailyTrend?.bbwExpanding,
        analysisData.signal,
        analysisData.signalStrength,
        analysisData.hourlyScore,
        analysisData.hourlyConfirmation?.vwap,
        analysisData.hourlyConfirmation?.oiChange,
        analysisData.hourlyConfirmation?.fundingRate,
        analysisData.execution,
        analysisData.executionMode,
        analysisData.modeA,
        analysisData.modeB,
        analysisData.entrySignal,
        analysisData.stopLoss,
        analysisData.takeProfit,
        analysisData.currentPrice,
        analysisData.dataCollectionRate,
        JSON.stringify(analysisData),
        analysisData.dataValid !== false,
        analysisData.error || null
      ];

      return await this.run(sql, params);
    }
  }

  // 记录信号 - 保持向后兼容
  async recordSignal(symbol, signalData) {
    const sql = `
      INSERT INTO signal_records (symbol, signal_type, signal_data, result, notes)
      VALUES (?, ?, ?, ?, ?)
    `;

    const params = [
      symbol,
      signalData.signal || 'UNKNOWN',
      JSON.stringify(signalData),
      signalData.result || 'PENDING',
      signalData.notes || ''
    ];

    return await this.run(sql, params);
  }

  // 记录入场执行
  async recordExecution(symbol, executionData) {
    const sql = `
      INSERT INTO execution_records (symbol, execution_type, execution_data, result, notes)
      VALUES (?, ?, ?, ?, ?)
    `;

    const params = [
      symbol,
      executionData.execution || 'UNKNOWN',
      JSON.stringify(executionData),
      executionData.result || 'PENDING',
      executionData.notes || ''
    ];

    return await this.run(sql, params);
  }

  // 标记结果
  async markResult(recordId, recordType, symbol, result, notes = '') {
    const table = recordType === 'signal' ? 'signal_records' : 'execution_records';
    const sql = `UPDATE ${table} SET result = ?, notes = ? WHERE id = ?`;

    return await this.run(sql, [result, notes, recordId]);
  }

  // 获取策略分析历史记录
  async getStrategyAnalysisHistory(symbol = null, limit = 100) {
    let sql = `
      SELECT * FROM strategy_analysis
      ${symbol ? 'WHERE symbol = ?' : ''}
      ORDER BY timestamp DESC
      LIMIT ?
    `;

    const params = symbol ? [symbol, limit] : [limit];
    return await this.runQuery(sql, params);
  }

  // 获取最新的策略分析结果
  async getLatestStrategyAnalysis(symbol) {
    const sql = `
      SELECT * FROM strategy_analysis
      WHERE symbol = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `;

    const results = await this.runQuery(sql, [symbol]);
    return results.length > 0 ? results[0] : null;
  }

  // 获取历史记录 - 保持向后兼容
  async getHistoryRecords(symbol = null, limit = 100) {
    let sql = `
      SELECT 'signal' as type, id, symbol, signal_type as data_type, signal_data as data, timestamp, result, notes
      FROM signal_records
      ${symbol ? 'WHERE symbol = ?' : ''}
      UNION ALL
      SELECT 'execution' as type, id, symbol, execution_type as data_type, execution_data as data, timestamp, result, notes
      FROM execution_records
      ${symbol ? 'WHERE symbol = ?' : ''}
      ORDER BY timestamp DESC
      LIMIT ?
    `;

    const params = symbol ? [symbol, symbol, limit] : [limit];
    return await this.runQuery(sql, params);
  }

  // 添加自定义交易对
  async addCustomSymbol(symbol) {
    try {
      await this.runQuery('INSERT INTO custom_symbols (symbol) VALUES (?)', [symbol]);
      return { success: true, message: `交易对 ${symbol} 添加成功` };
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return { success: false, message: `交易对 ${symbol} 已存在` };
      }
      return { success: false, message: `添加失败: ${err.message}` };
    }
  }

  // 删除自定义交易对
  async removeCustomSymbol(symbol) {
    try {
      const result = await this.run('DELETE FROM custom_symbols WHERE symbol = ?', [symbol]);
      if (result.changes > 0) {
        return { success: true, message: `交易对 ${symbol} 删除成功` };
      } else {
        return { success: false, message: `交易对 ${symbol} 不存在` };
      }
    } catch (err) {
      return { success: false, message: `删除失败: ${err.message}` };
    }
  }

  // 获取自定义交易对
  async getCustomSymbols() {
    const rows = await this.runQuery('SELECT symbol FROM custom_symbols ORDER BY added_at ASC');
    return rows.map(row => row.symbol);
  }

  // 获取数据统计
  async getDataStats() {
    const checkComplete = () => {
      return new Promise((resolve) => {
        this.db.get('SELECT COUNT(*) as count FROM strategy_analysis', (err, strategyRow) => {
          if (err) {
            resolve({
              totalStrategyAnalysis: 0,
              totalSignals: 0,
              totalExecutions: 0,
              totalSimulations: 0
            });
          } else {
            this.db.get('SELECT COUNT(*) as count FROM signal_records', (err, signalRow) => {
              if (err) {
                resolve({
                  totalStrategyAnalysis: strategyRow.count,
                  totalSignals: 0,
                  totalExecutions: 0,
                  totalSimulations: 0
                });
              } else {
                this.db.get('SELECT COUNT(*) as count FROM execution_records', (err, execRow) => {
                  if (err) {
                    resolve({
                      totalStrategyAnalysis: strategyRow.count,
                      totalSignals: signalRow.count,
                      totalExecutions: 0,
                      totalSimulations: 0
                    });
                  } else {
                    this.db.get('SELECT COUNT(*) as count FROM simulations', (err, simRow) => {
                      resolve({
                        totalStrategyAnalysis: strategyRow.count,
                        totalSignals: signalRow.count,
                        totalExecutions: execRow.count,
                        totalSimulations: simRow ? simRow.count : 0
                      });
                    });
                  }
                });
              }
            });
          }
        });
      });
    };

    return await checkComplete();
  }

  // 用户设置相关方法
  async setUserSetting(key, value) {
    try {
      await this.runQuery(
        'INSERT OR REPLACE INTO user_settings (setting_key, setting_value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
        [key, value]
      );
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async getUserSetting(key, defaultValue = null) {
    try {
      const rows = await this.runQuery('SELECT setting_value FROM user_settings WHERE setting_key = ?', [key]);
      return rows.length > 0 ? rows[0].setting_value : defaultValue;
    } catch (err) {
      return defaultValue;
    }
  }

  // 记录告警历史
  async recordAlert(symbol, alertType, severity, message, details = null) {
    try {
      await this.run(
        `INSERT INTO alert_history (symbol, alert_type, severity, message, details) 
         VALUES (?, ?, ?, ?, ?)`,
        [symbol, alertType, severity, message, details]
      );
      console.log(`📝 记录告警: ${symbol} - ${alertType} - ${severity}`);
    } catch (error) {
      console.error('记录告警失败:', error);
    }
  }

  // 获取告警历史
  async getAlertHistory(limit = 100, alertType = null) {
    try {
      let query = `
        SELECT * FROM alert_history 
        WHERE 1=1
      `;
      const params = [];

      if (alertType) {
        query += ' AND alert_type = ?';
        params.push(alertType);
      }

      query += ' ORDER BY timestamp DESC LIMIT ?';
      params.push(limit);

      return await this.runQuery(query, params);
    } catch (error) {
      console.error('获取告警历史失败:', error);
      return [];
    }
  }

  // 标记告警为已解决
  async resolveAlert(alertId) {
    try {
      await this.run(
        'UPDATE alert_history SET resolved = TRUE, resolved_at = CURRENT_TIMESTAMP WHERE id = ?',
        [alertId]
      );
      console.log(`✅ 告警已解决: ${alertId}`);
    } catch (error) {
      console.error('解决告警失败:', error);
    }
  }

  async getAllUserSettings() {
    try {
      const rows = await this.runQuery('SELECT setting_key, setting_value FROM user_settings');
      const settings = {};
      rows.forEach(row => {
        settings[row.setting_key] = row.setting_value;
      });
      return settings;
    } catch (err) {
      return {};
    }
  }

  async close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = DatabaseManager;
