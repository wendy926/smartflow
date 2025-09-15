// ICTDatabaseManager.js - ICT策略数据库管理
// 复用现有监控系统，管理ICT策略数据

class ICTDatabaseManager {
  constructor(database = null) {
    this.database = database;
  }

  /**
   * 初始化ICT数据库表
   */
  async initICTTables() {
    try {
      const tables = [
        // ICT策略分析表
        `CREATE TABLE IF NOT EXISTS ict_strategy_analysis (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          symbol TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          
          -- 高时间框架 (1D)
          daily_trend TEXT,                    -- 上升/下降/震荡
          daily_trend_score INTEGER,           -- 1D趋势得分 (0-3)
          
          -- 中时间框架 (4H)
          mtf_ob_detected BOOLEAN DEFAULT FALSE, -- 4H OB检测
          mtf_fvg_detected BOOLEAN DEFAULT FALSE, -- 4H FVG检测
          ob_height REAL,                      -- OB高度
          ob_age_days REAL,                    -- OB年龄(天)
          ob_high REAL,                        -- OB上沿
          ob_low REAL,                         -- OB下沿
          ob_time DATETIME,                    -- OB时间
          fvg_high REAL,                       -- FVG上沿
          fvg_low REAL,                        -- FVG下沿
          fvg_time DATETIME,                   -- FVG时间
          fvg_type TEXT,                       -- FVG类型 (bullish/bearish)
          sweep_htf_detected BOOLEAN DEFAULT FALSE, -- 4H Sweep检测
          sweep_htf_speed REAL,                -- 4H Sweep速率
          
          -- 低时间框架 (15m)
          ltf_ob_age_hours REAL,               -- 15m OB年龄(小时)
          engulfing_detected BOOLEAN DEFAULT FALSE, -- 吞没形态
          engulfing_body_ratio REAL,           -- 吞没实体比例
          sweep_ltf_detected BOOLEAN DEFAULT FALSE, -- 15m Sweep检测
          sweep_ltf_speed REAL,                -- 15m Sweep速率
          volume_confirmation BOOLEAN DEFAULT FALSE, -- 成交量确认
          
          -- 风险管理
          entry_price REAL,                    -- 入场价格
          stop_loss REAL,                      -- 止损价格
          take_profit REAL,                    -- 止盈价格
          risk_reward_ratio REAL,              -- 风险回报比
          position_size REAL,                  -- 仓位大小
          max_leverage INTEGER,                -- 最大杠杆
          min_margin REAL,                     -- 最小保证金
          stop_distance_percent REAL,          -- 止损距离百分比
          
          -- 技术指标
          atr_4h REAL,                         -- 4H ATR
          atr_15m REAL,                        -- 15m ATR
          current_price REAL,                  -- 当前价格
          
          -- 信号状态
          signal_type TEXT,                    -- 信号类型 (LONG/SHORT/NONE)
          signal_strength TEXT,                -- 信号强度 (STRONG/MODERATE/WEAK)
          execution_mode TEXT,                 -- 执行模式
          
          -- 数据质量
          data_collection_rate REAL,           -- 数据采集率
          data_valid BOOLEAN DEFAULT TRUE,     -- 数据有效性
          error_message TEXT,                  -- 错误信息
          
          -- 完整分析数据
          full_analysis_data TEXT,             -- JSON格式完整数据
          strategy_version TEXT DEFAULT 'ICT', -- 策略版本
          
          -- 索引
          UNIQUE(symbol, timestamp)
        )`,

        // ICT模拟交易表
        `CREATE TABLE IF NOT EXISTS ict_simulations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          symbol TEXT NOT NULL,
          entry_price REAL NOT NULL,
          stop_loss_price REAL NOT NULL,
          take_profit_price REAL NOT NULL,
          max_leverage INTEGER NOT NULL,
          min_margin REAL NOT NULL,
          position_size REAL NOT NULL,
          risk_reward_ratio REAL NOT NULL,
          trigger_reason TEXT NOT NULL,
          signal_type TEXT NOT NULL,           -- LONG/SHORT
          execution_mode TEXT NOT NULL,        -- ICT执行模式
          status TEXT DEFAULT 'ACTIVE',        -- ACTIVE/CLOSED
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          closed_at DATETIME,
          exit_price REAL,
          exit_reason TEXT,
          is_win BOOLEAN,
          profit_loss REAL,
          atr_4h REAL,
          atr_15m REAL,
          ob_high REAL,
          ob_low REAL,
          fvg_high REAL,
          fvg_low REAL,
          sweep_htf_detected BOOLEAN,
          sweep_ltf_detected BOOLEAN,
          engulfing_detected BOOLEAN,
          volume_confirmation BOOLEAN,
          time_in_position INTEGER DEFAULT 0,  -- 持仓时间(小时)
          max_time_in_position INTEGER DEFAULT 48, -- 最大持仓时间(小时)
          cache_version INTEGER DEFAULT 1
        )`,

        // ICT数据刷新状态表
        `CREATE TABLE IF NOT EXISTS ict_data_refresh_status (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          symbol TEXT NOT NULL,
          data_type TEXT NOT NULL,             -- daily_trend/mtf_analysis/ltf_analysis
          last_refresh DATETIME,
          next_refresh DATETIME,
          should_refresh BOOLEAN DEFAULT TRUE,
          refresh_interval INTEGER,            -- 刷新间隔(分钟)
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(symbol, data_type)
        )`
      ];

      for (const table of tables) {
        await this.database.run(table);
      }

      // 创建索引
      await this.createICTIndexes();

      console.log('✅ ICT数据库表初始化完成');
    } catch (error) {
      console.error('❌ ICT数据库表初始化失败:', error);
      throw error;
    }
  }

  /**
   * 创建ICT相关索引
   */
  async createICTIndexes() {
    try {
      const indexes = [
        // ICT策略分析表索引
        'CREATE INDEX IF NOT EXISTS idx_ict_strategy_symbol ON ict_strategy_analysis(symbol)',
        'CREATE INDEX IF NOT EXISTS idx_ict_strategy_timestamp ON ict_strategy_analysis(timestamp)',
        'CREATE INDEX IF NOT EXISTS idx_ict_strategy_signal ON ict_strategy_analysis(signal_type)',
        'CREATE INDEX IF NOT EXISTS idx_ict_strategy_symbol_time ON ict_strategy_analysis(symbol, timestamp)',

        // ICT模拟交易表索引
        'CREATE INDEX IF NOT EXISTS idx_ict_simulations_symbol ON ict_simulations(symbol)',
        'CREATE INDEX IF NOT EXISTS idx_ict_simulations_status ON ict_simulations(status)',
        'CREATE INDEX IF NOT EXISTS idx_ict_simulations_created ON ict_simulations(created_at)',
        'CREATE INDEX IF NOT EXISTS idx_ict_simulations_symbol_status ON ict_simulations(symbol, status)',

        // ICT数据刷新状态表索引
        'CREATE INDEX IF NOT EXISTS idx_ict_refresh_symbol ON ict_data_refresh_status(symbol)',
        'CREATE INDEX IF NOT EXISTS idx_ict_refresh_type ON ict_data_refresh_status(data_type)'
      ];

      for (const index of indexes) {
        await this.database.run(index);
      }

      console.log('✅ ICT数据库索引创建完成');
    } catch (error) {
      console.error('❌ ICT数据库索引创建失败:', error);
      throw error;
    }
  }

  /**
   * 记录ICT策略分析结果
   * @param {Object} analysis - 分析结果
   */
  async recordICTAnalysis(analysis) {
    try {
      const {
        symbol,
        dailyTrend,
        dailyTrendScore,
        mtfResult,
        ltfResult,
        riskManagement,
        signalType,
        signalStrength,
        executionMode,
        dataCollectionRate,
        timestamp,
        strategyVersion,
        dataValid,
        errorMessage
      } = analysis;

      const query = `
        INSERT OR REPLACE INTO ict_strategy_analysis (
          symbol, timestamp, daily_trend, daily_trend_score,
          mtf_ob_detected, mtf_fvg_detected, ob_height, ob_age_days,
          ob_high, ob_low, ob_time, fvg_high, fvg_low, fvg_time, fvg_type,
          sweep_htf_detected, sweep_htf_speed,
          ltf_ob_age_hours, engulfing_detected, engulfing_body_ratio,
          sweep_ltf_detected, sweep_ltf_speed, volume_confirmation,
          entry_price, stop_loss, take_profit, risk_reward_ratio,
          position_size, max_leverage, min_margin, stop_distance_percent,
          atr_4h, atr_15m, current_price,
          signal_type, signal_strength, execution_mode,
          data_collection_rate, data_valid, error_message,
          full_analysis_data, strategy_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        symbol, timestamp, dailyTrend, dailyTrendScore || 0,
        mtfResult?.obDetected || false, mtfResult?.fvgDetected || false,
        mtfResult?.ob?.height || 0, mtfResult?.ob?.ageDays || 0,
        mtfResult?.ob?.high || 0, mtfResult?.ob?.low || 0, mtfResult?.ob?.time || null,
        mtfResult?.fvg?.high || 0, mtfResult?.fvg?.low || 0, mtfResult?.fvg?.time || null, mtfResult?.fvg?.type || null,
        mtfResult?.sweepHTF || false, mtfResult?.sweepHTF?.speed || 0,
        ltfResult?.obAgeHours || 0, ltfResult?.engulfing?.detected || false, ltfResult?.engulfing?.bodyRatio || 0,
        ltfResult?.sweepLTF?.detected || false, ltfResult?.sweepLTF?.speed || 0, ltfResult?.volumeConfirm || false,
        riskManagement?.entry || 0, riskManagement?.stopLoss || 0, riskManagement?.takeProfit || 0, riskManagement?.riskRewardRatio || 0,
        riskManagement?.units || 0, riskManagement?.leverage || 0, riskManagement?.margin || 0, riskManagement?.stopDistancePercent || 0,
        mtfResult?.atr4h || 0, ltfResult?.atr15 || 0, riskManagement?.entry || 0,
        signalType, signalStrength, executionMode,
        dataCollectionRate || 100, dataValid !== false, errorMessage || null,
        JSON.stringify(analysis), strategyVersion || 'ICT'
      ];

      await this.database.run(query, values);
      console.log(`📊 ICT分析结果已记录 [${symbol}]: ${signalType}`);
    } catch (error) {
      console.error(`❌ ICT分析结果记录失败 [${symbol}]:`, error);
      throw error;
    }
  }

  /**
   * 获取最新ICT分析结果
   * @param {string} symbol - 交易对
   * @returns {Object|null} 最新分析结果
   */
  async getLatestICTAnalysis(symbol) {
    try {
      const query = `
        SELECT * FROM ict_strategy_analysis 
        WHERE symbol = ? 
        ORDER BY timestamp DESC 
        LIMIT 1
      `;

      const result = await this.database.get(query, [symbol]);
      return result;
    } catch (error) {
      console.error(`❌ 获取ICT分析结果失败 [${symbol}]:`, error);
      return null;
    }
  }

  /**
   * 创建ICT模拟交易记录
   * @param {Object} simulationData - 模拟交易数据
   * @returns {Object} 创建的模拟交易记录
   */
  async createICTSimulation(simulationData) {
    try {
      const query = `
        INSERT INTO ict_simulations (
          symbol, entry_price, stop_loss_price, take_profit_price,
          max_leverage, min_margin, position_size, risk_reward_ratio,
          trigger_reason, signal_type, execution_mode, status,
          atr_4h, atr_15m, ob_high, ob_low, fvg_high, fvg_low,
          sweep_htf_detected, sweep_ltf_detected, engulfing_detected, volume_confirmation
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        simulationData.symbol,
        simulationData.entry_price,
        simulationData.stop_loss_price,
        simulationData.take_profit_price,
        simulationData.max_leverage,
        simulationData.min_margin,
        simulationData.position_size,
        simulationData.risk_reward_ratio,
        simulationData.trigger_reason,
        simulationData.signal_type,
        simulationData.execution_mode,
        simulationData.status || 'ACTIVE',
        simulationData.atr_4h || 0,
        simulationData.atr_15m || 0,
        simulationData.ob_high || 0,
        simulationData.ob_low || 0,
        simulationData.fvg_high || 0,
        simulationData.fvg_low || 0,
        simulationData.sweep_htf_detected || false,
        simulationData.sweep_ltf_detected || false,
        simulationData.engulfing_detected || false,
        simulationData.volume_confirmation || false
      ];

      const result = await this.database.run(query, values);
      console.log(`🚀 ICT模拟交易已创建 [${simulationData.symbol}]: ID=${result.lastID}`);

      return {
        id: result.lastID,
        ...simulationData
      };
    } catch (error) {
      console.error(`❌ ICT模拟交易创建失败 [${simulationData.symbol}]:`, error);
      throw error;
    }
  }

  /**
   * 获取ICT模拟交易历史
   * @param {number} limit - 限制数量
   * @returns {Array} 模拟交易历史
   */
  async getICTSimulationHistory(limit = 50) {
    try {
      const query = `
        SELECT * FROM ict_simulations 
        ORDER BY created_at DESC 
        LIMIT ?
      `;

      const results = await this.database.all(query, [limit]);
      return results;
    } catch (error) {
      console.error('❌ 获取ICT模拟交易历史失败:', error);
      return [];
    }
  }

  /**
   * 更新ICT模拟交易状态
   * @param {number} id - 模拟交易ID
   * @param {Object} updateData - 更新数据
   */
  async updateICTSimulation(id, updateData) {
    try {
      const fields = [];
      const values = [];

      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
          fields.push(`${key} = ?`);
          values.push(updateData[key]);
        }
      });

      if (fields.length === 0) return;

      values.push(id);
      const query = `UPDATE ict_simulations SET ${fields.join(', ')} WHERE id = ?`;

      await this.database.run(query, values);
      console.log(`📝 ICT模拟交易已更新 [ID=${id}]`);
    } catch (error) {
      console.error(`❌ ICT模拟交易更新失败 [ID=${id}]:`, error);
      throw error;
    }
  }

  /**
   * 获取ICT数据刷新状态
   * @param {string} symbol - 交易对
   * @returns {Object} 刷新状态
   */
  async getICTRefreshStatus(symbol) {
    try {
      const query = `
        SELECT * FROM ict_data_refresh_status 
        WHERE symbol = ?
      `;

      const results = await this.database.all(query, [symbol]);

      const status = {
        daily_trend: { shouldRefresh: true, lastRefresh: null, nextRefresh: null },
        mtf_analysis: { shouldRefresh: true, lastRefresh: null, nextRefresh: null },
        ltf_analysis: { shouldRefresh: true, lastRefresh: null, nextRefresh: null }
      };

      results.forEach(row => {
        status[row.data_type] = {
          shouldRefresh: row.should_refresh,
          lastRefresh: row.last_refresh,
          nextRefresh: row.next_refresh
        };
      });

      return status;
    } catch (error) {
      console.error(`❌ 获取ICT刷新状态失败 [${symbol}]:`, error);
      return {
        daily_trend: { shouldRefresh: true, lastRefresh: null, nextRefresh: null },
        mtf_analysis: { shouldRefresh: true, lastRefresh: null, nextRefresh: null },
        ltf_analysis: { shouldRefresh: true, lastRefresh: null, nextRefresh: null }
      };
    }
  }

  /**
   * 更新ICT数据刷新状态
   * @param {string} symbol - 交易对
   * @param {string} dataType - 数据类型
   * @param {Object} status - 状态数据
   */
  async updateICTRefreshStatus(symbol, dataType, status) {
    try {
      const query = `
        INSERT OR REPLACE INTO ict_data_refresh_status 
        (symbol, data_type, last_refresh, next_refresh, should_refresh, refresh_interval)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      const values = [
        symbol,
        dataType,
        status.lastRefresh,
        status.nextRefresh,
        status.shouldRefresh,
        status.refreshInterval || 60
      ];

      await this.database.run(query, values);
    } catch (error) {
      console.error(`❌ 更新ICT刷新状态失败 [${symbol}][${dataType}]:`, error);
    }
  }
}

module.exports = ICTDatabaseManager;
