// StrategyEngineMigration.js - 真实策略引擎数据库迁移
// 严格按照ict.md和strategy-v3.md文档设计数据库表结构

class StrategyEngineMigration {
  constructor(database) {
    this.db = database;
  }

  /**
   * 执行完整的策略引擎数据库迁移
   */
  async migrate() {
    console.log('🚀 开始策略引擎数据库迁移...');
    
    try {
      // 1. 创建V3策略相关表
      await this.createV3StrategyTables();
      
      // 2. 创建ICT策略相关表
      await this.createICTStrategyTables();
      
      // 3. 创建统一策略分析表
      await this.createUnifiedStrategyTables();
      
      // 4. 创建交易对分类管理表
      await this.createSymbolCategoryTables();
      
      // 5. 创建实时数据缓存表
      await this.createRealTimeDataTables();
      
      // 6. 创建索引优化
      await this.createOptimizedIndexes();
      
      console.log('✅ 策略引擎数据库迁移完成');
      
    } catch (error) {
      console.error('❌ 策略引擎数据库迁移失败:', error);
      throw error;
    }
  }

  /**
   * 创建V3策略相关表 - 严格按照strategy-v3.md文档
   */
  async createV3StrategyTables() {
    console.log('📊 创建V3策略数据表...');

    // V3策略4H趋势过滤表
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS v3_trend_4h_analysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        -- 4H趋势过滤10分打分机制
        trend_direction TEXT,                 -- 趋势方向 (多头趋势/空头趋势/震荡市)
        total_score INTEGER DEFAULT 0,       -- 总分 (0-10分)
        
        -- 1. 趋势方向得分 (3分)
        bull_direction_score INTEGER DEFAULT 0,  -- 多头方向得分 (0-3)
        bear_direction_score INTEGER DEFAULT 0,  -- 空头方向得分 (0-3)
        close_vs_ma20 BOOLEAN,               -- 收盘价 vs MA20
        ma20_vs_ma50 BOOLEAN,                -- MA20 vs MA50
        ma50_vs_ma200 BOOLEAN,               -- MA50 vs MA200
        
        -- 2. 趋势稳定性 (1分)
        stability_score INTEGER DEFAULT 0,   -- 稳定性得分 (0-1)
        consecutive_candles INTEGER DEFAULT 0, -- 连续确认K线数
        
        -- 3. 趋势强度 (1分)
        strength_score INTEGER DEFAULT 0,    -- 强度得分 (0-1)
        adx_value REAL,                      -- ADX(14)值
        di_plus REAL,                        -- DI+值
        di_minus REAL,                       -- DI-值
        di_direction_correct BOOLEAN,        -- DI方向正确
        
        -- 4. 布林带扩张 (1分)
        expansion_score INTEGER DEFAULT 0,   -- 扩张得分 (0-1)
        bbw_current REAL,                    -- 当前布林带宽
        bbw_first_half_avg REAL,             -- 前5根BBW均值
        bbw_second_half_avg REAL,            -- 后5根BBW均值
        bbw_expanding BOOLEAN,               -- 是否扩张
        
        -- 5. 动量确认 (1分)
        momentum_score INTEGER DEFAULT 0,    -- 动量得分 (0-1)
        price_ma20_distance_pct REAL,        -- 价格离MA20距离百分比
        momentum_sufficient BOOLEAN,         -- 动量是否充足
        
        -- 技术指标原始数据
        ma20 REAL,
        ma50 REAL,
        ma200 REAL,
        current_price REAL,
        
        -- 数据质量
        data_quality_score REAL DEFAULT 100, -- 数据质量评分
        kline_count INTEGER,                 -- K线数据量
        calculation_time_ms INTEGER,         -- 计算耗时
        
        UNIQUE(symbol, timestamp)
      )
    `);

    // V3策略1H多因子打分表
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS v3_hourly_scoring (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        -- 1H多因子打分6分制
        total_score INTEGER DEFAULT 0,       -- 总分 (0-6分)
        signal_result TEXT,                  -- 信号结果 (做多/做空/观望)
        signal_strength TEXT,                -- 信号强度 (强/中/弱)
        
        -- 1. VWAP方向一致性 (必须满足)
        vwap_direction_valid BOOLEAN,        -- VWAP方向是否一致
        vwap_value REAL,                     -- VWAP值
        price_vs_vwap TEXT,                  -- 价格vs VWAP (above/below)
        
        -- 2. 突破确认 (±1分)
        breakout_score INTEGER DEFAULT 0,    -- 突破确认得分
        breakout_level REAL,                 -- 突破位价格
        is_breakout BOOLEAN,                 -- 是否突破
        
        -- 3. 成交量双确认 (±1分)
        volume_score INTEGER DEFAULT 0,      -- 成交量得分
        volume_15m REAL,                     -- 15m成交量
        volume_15m_avg REAL,                 -- 15m平均成交量
        volume_1h REAL,                      -- 1h成交量
        volume_1h_avg REAL,                  -- 1h平均成交量
        volume_15m_ratio REAL,               -- 15m成交量比率
        volume_1h_ratio REAL,                -- 1h成交量比率
        
        -- 4. OI变化 (±1分)
        oi_score INTEGER DEFAULT 0,          -- OI得分
        oi_change_6h_pct REAL,               -- 6h OI变化百分比
        oi_current REAL,                     -- 当前OI
        oi_6h_ago REAL,                      -- 6h前OI
        
        -- 5. 资金费率 (±1分)
        funding_score INTEGER DEFAULT 0,     -- 资金费率得分
        funding_rate REAL,                   -- 当前资金费率
        funding_rate_valid BOOLEAN,          -- 资金费率是否在合理范围
        
        -- 6. Delta确认 (±1分)
        delta_score INTEGER DEFAULT 0,       -- Delta得分
        delta_ratio REAL,                    -- Delta比率
        delta_buy_volume REAL,               -- 主动买盘量
        delta_sell_volume REAL,              -- 主动卖盘量
        delta_imbalance_valid BOOLEAN,       -- Delta不平衡是否有效
        
        -- 交易对分类权重应用
        symbol_category TEXT,                -- 交易对分类
        category_weight_applied BOOLEAN,     -- 是否应用分类权重
        weighted_score REAL,                 -- 加权后得分
        
        UNIQUE(symbol, timestamp)
      )
    `);

    // V3策略15m执行分析表
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS v3_execution_15m (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        -- 执行模式
        market_type TEXT,                    -- 市场类型 (趋势市/震荡市)
        execution_mode TEXT,                 -- 执行模式 (模式A/模式B/假突破)
        execution_signal TEXT,               -- 执行信号
        
        -- 趋势市执行 (模式A和模式B)
        setup_candle_high REAL,              -- setup candle高点
        setup_candle_low REAL,               -- setup candle低点
        setup_candle_close REAL,             -- setup candle收盘
        mode_a_valid BOOLEAN,                -- 模式A是否有效 (回踩确认)
        mode_b_valid BOOLEAN,                -- 模式B是否有效 (突破确认)
        pullback_to_vwap BOOLEAN,            -- 是否回踩到VWAP
        breakout_volume_confirm BOOLEAN,     -- 突破成交量确认
        
        -- 震荡市执行 (假突破)
        range_upper_boundary REAL,           -- 区间上轨
        range_lower_boundary REAL,           -- 区间下轨
        bb_width_15m REAL,                   -- 15m布林带宽
        bb_width_narrow BOOLEAN,             -- 布林带是否收窄
        fake_breakout_detected BOOLEAN,      -- 是否检测到假突破
        fake_breakout_direction TEXT,        -- 假突破方向
        
        -- 入场价格和风险管理
        entry_price REAL,                    -- 入场价格
        stop_loss_price REAL,                -- 止损价格
        take_profit_price REAL,              -- 止盈价格
        stop_loss_distance_pct REAL,         -- 止损距离百分比
        risk_reward_ratio REAL,              -- 风险回报比
        
        -- 杠杆和保证金计算
        max_leverage INTEGER,                -- 最大杠杆
        min_margin REAL,                     -- 最小保证金
        position_size REAL,                  -- 仓位大小
        
        -- 技术指标
        ema20_15m REAL,                      -- 15m EMA20
        ema50_15m REAL,                      -- 15m EMA50
        atr14_15m REAL,                      -- 15m ATR14
        
        UNIQUE(symbol, timestamp)
      )
    `);

    // V3策略震荡市边界确认表
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS v3_range_boundary_analysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        -- 1H布林带边界
        bb_upper REAL,                       -- 布林带上轨
        bb_lower REAL,                       -- 布林带下轨
        bb_middle REAL,                      -- 布林带中轨
        bb_width REAL,                       -- 布林带宽度
        
        -- 边界触碰统计
        upper_touches_6h INTEGER DEFAULT 0,  -- 6h内上轨触碰次数
        lower_touches_6h INTEGER DEFAULT 0,  -- 6h内下轨触碰次数
        boundary_valid BOOLEAN,              -- 边界是否有效
        
        -- 多因子边界确认
        vwap_factor_score REAL,              -- VWAP因子得分
        touch_factor_score REAL,             -- 触碰因子得分
        volume_factor_score REAL,            -- 成交量因子得分
        delta_factor_score REAL,             -- Delta因子得分
        oi_factor_score REAL,                -- OI因子得分
        no_breakout_factor_score REAL,       -- 无突破因子得分
        
        total_boundary_score REAL,           -- 边界确认总分
        boundary_score_threshold REAL,       -- 边界确认阈值
        
        -- 交易对分类权重
        symbol_category TEXT,                -- 交易对分类
        category_weights TEXT,               -- 分类权重JSON
        
        UNIQUE(symbol, timestamp)
      )
    `);
  }

  /**
   * 创建ICT策略相关表 - 严格按照ict.md文档
   */
  async createICTStrategyTables() {
    console.log('🎯 创建ICT策略数据表...');

    // ICT策略1D趋势分析表
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS ict_daily_trend_analysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        -- 1D趋势判断3分制
        trend_direction TEXT,                -- 趋势方向 (up/down/sideways)
        total_score INTEGER DEFAULT 0,      -- 总分 (0-3分)
        
        -- 1. 价格结构分析 (1分)
        structure_score INTEGER DEFAULT 0,   -- 结构得分
        higher_highs BOOLEAN,                -- 是否有更高高点
        higher_lows BOOLEAN,                 -- 是否有更高低点
        recent_highs TEXT,                   -- 最近高点JSON
        recent_lows TEXT,                    -- 最近低点JSON
        
        -- 2. 移动平均线确认 (1分)
        ma_score INTEGER DEFAULT 0,          -- MA得分
        price_above_ma20 BOOLEAN,            -- 价格是否在MA20之上
        ma20_above_ma50 BOOLEAN,             -- MA20是否在MA50之上
        ma20_value REAL,                     -- MA20值
        ma50_value REAL,                     -- MA50值
        
        -- 3. 成交量确认 (1分)
        volume_score INTEGER DEFAULT 0,      -- 成交量得分
        current_volume REAL,                 -- 当前成交量
        avg_volume_20 REAL,                  -- 20期平均成交量
        volume_ratio REAL,                   -- 成交量比率
        volume_above_threshold BOOLEAN,      -- 成交量是否超过阈值
        
        -- 原始数据
        current_price REAL,
        lookback_days INTEGER DEFAULT 20,
        confidence_level REAL,               -- 置信度 (0-1)
        
        UNIQUE(symbol, timestamp)
      )
    `);

    // ICT策略4H结构分析表 (OB/FVG/Sweep)
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS ict_4h_structure_analysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        -- Order Block检测
        ob_detected BOOLEAN DEFAULT FALSE,
        ob_count INTEGER DEFAULT 0,
        ob_data TEXT,                        -- OB数据JSON
        
        -- 最佳OB详细信息
        best_ob_high REAL,                   -- 最佳OB上沿
        best_ob_low REAL,                    -- 最佳OB下沿
        best_ob_height REAL,                 -- 最佳OB高度
        best_ob_age_days REAL,               -- 最佳OB年龄(天)
        best_ob_volume REAL,                 -- 最佳OB成交量
        best_ob_strength REAL,               -- 最佳OB强度
        best_ob_type TEXT,                   -- 最佳OB类型 (bullish/bearish)
        best_ob_timestamp DATETIME,          -- 最佳OB时间
        
        -- OB过滤条件验证
        ob_height_filter_passed BOOLEAN,     -- 高度过滤是否通过 (≥0.25×ATR)
        ob_age_filter_passed BOOLEAN,        -- 年龄过滤是否通过 (≤30天)
        ob_volume_filter_passed BOOLEAN,     -- 成交量过滤是否通过
        
        -- Fair Value Gap检测
        fvg_detected BOOLEAN DEFAULT FALSE,
        fvg_count INTEGER DEFAULT 0,
        fvg_data TEXT,                       -- FVG数据JSON
        
        -- 最佳FVG详细信息
        best_fvg_high REAL,                  -- 最佳FVG上沿
        best_fvg_low REAL,                   -- 最佳FVG下沿
        best_fvg_size REAL,                  -- 最佳FVG大小
        best_fvg_age_hours REAL,             -- 最佳FVG年龄(小时)
        best_fvg_type TEXT,                  -- 最佳FVG类型 (bullish/bearish)
        best_fvg_volume REAL,                -- 最佳FVG中间K线成交量
        best_fvg_timestamp DATETIME,         -- 最佳FVG时间
        
        -- 4H Sweep宏观速率检测 (按ict.md文档要求)
        sweep_htf_detected BOOLEAN DEFAULT FALSE,
        sweep_htf_speed REAL,                -- Sweep速率
        sweep_htf_exceed REAL,               -- 刺破幅度
        sweep_htf_bars_to_return INTEGER,    -- 收回用时(bar数)
        sweep_htf_threshold REAL,            -- Sweep阈值 (0.4×ATR)
        sweep_htf_valid BOOLEAN,             -- Sweep是否有效
        
        -- 技术指标
        atr_4h REAL,                         -- 4H ATR值
        extreme_high REAL,                   -- 极值高点
        extreme_low REAL,                    -- 极值低点
        
        UNIQUE(symbol, timestamp)
      )
    `);

    // ICT策略15m入场确认表
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS ict_15m_entry_analysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        -- 入场信号结果
        entry_signal_detected BOOLEAN DEFAULT FALSE,
        signal_type TEXT,                    -- 信号类型 (BOS_LONG/BOS_SHORT/CHoCH_LONG/CHoCH_SHORT/MIT_LONG/MIT_SHORT/WAIT)
        signal_strength TEXT,                -- 信号强度 (强/中/弱)
        confidence_level REAL,               -- 置信度 (0-1)
        
        -- OB/FVG年龄检查 (≤2天)
        ob_age_hours REAL,                   -- OB年龄(小时)
        fvg_age_hours REAL,                  -- FVG年龄(小时)
        age_filter_passed BOOLEAN,           -- 年龄过滤是否通过
        
        -- 吞没形态检测 (按ict.md文档要求)
        engulfing_detected BOOLEAN DEFAULT FALSE,
        engulfing_body_ratio REAL,           -- 吞没实体比例 (≥1.5倍)
        engulfing_direction_correct BOOLEAN, -- 吞没方向是否与趋势一致
        engulfing_prev_body REAL,            -- 前一根实体大小
        engulfing_curr_body REAL,            -- 当前根实体大小
        
        -- 15m Sweep微观速率检测 (按ict.md文档要求)
        sweep_ltf_detected BOOLEAN DEFAULT FALSE,
        sweep_ltf_speed REAL,                -- 15m Sweep速率
        sweep_ltf_exceed REAL,               -- 刺破幅度
        sweep_ltf_bars_to_return INTEGER,    -- 收回用时(bar数)
        sweep_ltf_threshold REAL,            -- Sweep阈值 (0.2×ATR)
        sweep_ltf_valid BOOLEAN,             -- Sweep是否有效
        
        -- 成交量确认
        volume_confirmation BOOLEAN,         -- 成交量确认
        current_volume REAL,                 -- 当前成交量
        avg_volume_15m REAL,                 -- 15m平均成交量
        volume_ratio REAL,                   -- 成交量比率
        
        -- 风险管理计算
        entry_price REAL,                    -- 入场价格
        stop_loss_price REAL,                -- 止损价格
        take_profit_price REAL,              -- 止盈价格
        risk_reward_ratio REAL DEFAULT 3,    -- 风险回报比
        stop_distance REAL,                  -- 止损距离
        
        -- 技术指标
        atr_15m REAL,                        -- 15m ATR值
        
        UNIQUE(symbol, timestamp)
      )
    `);
  }

  /**
   * 创建ICT策略相关表
   */
  async createICTStrategyTables() {
    // ICT策略风险管理表
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS ict_risk_management (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        -- 风险参数
        equity REAL DEFAULT 10000,           -- 资金总额
        risk_percentage REAL DEFAULT 0.01,   -- 风险比例 (1%)
        risk_amount REAL,                    -- 风险金额
        
        -- 止损计算 (按ict.md文档)
        stop_loss_method TEXT,               -- 止损方法 (OB_BOUNDARY/ATR_BASED/STRUCTURAL)
        ob_boundary_sl REAL,                 -- OB边界止损
        atr_based_sl REAL,                   -- ATR基础止损 (±1.5×ATR)
        structural_sl REAL,                  -- 结构性止损 (最近3根4H极值)
        final_stop_loss REAL,                -- 最终止损价格
        
        -- 止盈计算
        risk_reward_ratio REAL DEFAULT 3,    -- 风险回报比 (3:1)
        take_profit_price REAL,              -- 止盈价格
        
        -- 仓位计算
        position_units REAL,                 -- 仓位单位数
        notional_value REAL,                 -- 名义价值
        leverage_used INTEGER DEFAULT 5,     -- 使用杠杆
        margin_required REAL,                -- 所需保证金
        
        -- 计算验证
        calculation_valid BOOLEAN,           -- 计算是否有效
        validation_errors TEXT,              -- 验证错误信息
        
        UNIQUE(symbol, timestamp)
      )
    `);
  }

  /**
   * 创建统一策略分析表
   */
  async createUnifiedStrategyTables() {
    console.log('🔄 创建统一策略分析表...');

    // 策略分析结果统一表
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS unified_strategy_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        strategy_type TEXT NOT NULL,         -- V3/ICT
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        -- 分析结果
        final_signal TEXT,                   -- 最终信号
        signal_strength TEXT,                -- 信号强度
        execution_mode TEXT,                 -- 执行模式
        confidence_score REAL,               -- 置信度
        
        -- 价格信息
        current_price REAL,                  -- 当前价格
        entry_price REAL,                    -- 入场价格
        stop_loss_price REAL,                -- 止损价格
        take_profit_price REAL,              -- 止盈价格
        
        -- 风险管理
        max_leverage INTEGER,                -- 最大杠杆
        min_margin REAL,                     -- 最小保证金
        risk_reward_ratio REAL,              -- 风险回报比
        
        -- 数据质量
        data_collection_rate REAL,           -- 数据收集率
        analysis_duration_ms INTEGER,        -- 分析耗时
        data_freshness_score REAL,           -- 数据新鲜度
        
        -- 完整分析数据
        full_analysis_data TEXT,             -- 完整分析结果JSON
        
        UNIQUE(symbol, strategy_type, timestamp)
      )
    `);

    // 策略性能监控表
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS strategy_performance_monitoring (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        strategy_type TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        -- 性能指标
        analysis_success_rate REAL,          -- 分析成功率
        signal_generation_rate REAL,         -- 信号生成率
        data_quality_score REAL,             -- 数据质量得分
        
        -- 错误统计
        error_count_24h INTEGER DEFAULT 0,   -- 24h错误次数
        warning_count_24h INTEGER DEFAULT 0, -- 24h警告次数
        last_error_message TEXT,             -- 最后错误信息
        last_error_time DATETIME,            -- 最后错误时间
        
        -- 资源使用
        avg_cpu_usage REAL,                  -- 平均CPU使用率
        avg_memory_usage REAL,               -- 平均内存使用
        avg_analysis_time_ms INTEGER,        -- 平均分析时间
        
        UNIQUE(symbol, strategy_type, timestamp)
      )
    `);
  }

  /**
   * 创建交易对分类管理表
   */
  async createSymbolCategoryTables() {
    console.log('📋 创建交易对分类管理表...');

    // 交易对分类配置表
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS symbol_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,              -- largecap/midcap/smallcap/hotcoin
        
        -- 分类属性
        market_cap_rank INTEGER,             -- 市值排名
        avg_daily_volume REAL,               -- 平均日成交量
        volatility_score REAL,               -- 波动率评分
        liquidity_score REAL,                -- 流动性评分
        
        -- V3策略权重配置
        v3_vwap_weight REAL,                 -- VWAP权重
        v3_breakout_weight REAL,             -- 突破权重
        v3_volume_weight REAL,               -- 成交量权重
        v3_oi_weight REAL,                   -- OI权重
        v3_delta_weight REAL,                -- Delta权重
        v3_funding_weight REAL,              -- 资金费率权重
        
        -- ICT策略权重配置
        ict_structure_weight REAL,           -- 结构权重
        ict_volume_weight REAL,              -- 成交量权重
        ict_sweep_weight REAL,               -- Sweep权重
        ict_ob_weight REAL,                  -- OB权重
        ict_fvg_weight REAL,                 -- FVG权重
        
        -- 风险管理配置
        max_position_size REAL,              -- 最大仓位
        default_leverage INTEGER,            -- 默认杠杆
        max_holding_time_hours INTEGER,      -- 最大持仓时间
        
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 分类权重模板表
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS category_weight_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL UNIQUE,
        strategy_type TEXT NOT NULL,
        
        -- 权重配置JSON
        weight_config TEXT,                  -- 权重配置
        threshold_config TEXT,               -- 阈值配置
        
        -- 模板描述
        description TEXT,
        version TEXT DEFAULT '1.0',
        
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(category, strategy_type)
      )
    `);
  }

  /**
   * 创建实时数据缓存表
   */
  async createRealTimeDataTables() {
    console.log('⚡ 创建实时数据缓存表...');

    // K线数据缓存表 (优化查询性能)
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS kline_data_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        interval TEXT NOT NULL,              -- 4h/1h/15m/1d
        
        -- K线数据
        open_time BIGINT,                    -- 开盘时间戳
        open_price REAL,
        high_price REAL,
        low_price REAL,
        close_price REAL,
        volume REAL,
        
        -- 数据质量
        data_source TEXT,                    -- 数据来源 (binance_api/cache)
        data_freshness INTEGER,              -- 数据新鲜度(秒)
        is_complete BOOLEAN DEFAULT TRUE,    -- 数据是否完整
        
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(symbol, interval, open_time)
      )
    `);

    // 实时价格缓存表
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS realtime_price_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        
        -- 价格数据
        current_price REAL,                  -- 当前价格
        price_change_24h REAL,               -- 24h价格变化
        price_change_pct_24h REAL,           -- 24h价格变化百分比
        
        -- 成交量数据
        volume_24h REAL,                     -- 24h成交量
        quote_volume_24h REAL,               -- 24h成交额
        
        -- 技术指标缓存
        vwap_1h REAL,                        -- 1h VWAP
        vwap_4h REAL,                        -- 4h VWAP
        ema20_15m REAL,                      -- 15m EMA20
        ema50_15m REAL,                      -- 15m EMA50
        atr14_15m REAL,                      -- 15m ATR14
        atr14_4h REAL,                       -- 4h ATR14
        
        -- 数据时效性
        last_update DATETIME DEFAULT CURRENT_TIMESTAMP,
        ttl_seconds INTEGER DEFAULT 60,      -- 缓存TTL
        
        UNIQUE(symbol)
      )
    `);

    // Delta实时数据表
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS delta_realtime_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        timeframe TEXT NOT NULL,             -- 15m/1h
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        -- Delta数据
        delta_raw REAL,                      -- 原始Delta值
        delta_smoothed REAL,                 -- EMA平滑Delta值
        delta_buy_volume REAL,               -- 主动买盘量
        delta_sell_volume REAL,              -- 主动卖盘量
        delta_ratio REAL,                    -- Delta比率
        
        -- 成交量统计
        total_volume REAL,                   -- 总成交量
        trade_count INTEGER,                 -- 成交笔数
        avg_trade_size REAL,                 -- 平均成交量
        
        -- 数据质量
        data_completeness REAL,              -- 数据完整性
        websocket_status TEXT,               -- WebSocket状态
        
        UNIQUE(symbol, timeframe, timestamp)
      )
    `);
  }

  /**
   * 创建优化索引
   */
  async createOptimizedIndexes() {
    console.log('🔍 创建优化索引...');

    const indexes = [
      // V3策略索引
      'CREATE INDEX IF NOT EXISTS idx_v3_trend_symbol_time ON v3_trend_4h_analysis(symbol, timestamp DESC)',
      'CREATE INDEX IF NOT EXISTS idx_v3_hourly_symbol_time ON v3_hourly_scoring(symbol, timestamp DESC)',
      'CREATE INDEX IF NOT EXISTS idx_v3_execution_symbol_time ON v3_execution_15m(symbol, timestamp DESC)',
      
      // ICT策略索引
      'CREATE INDEX IF NOT EXISTS idx_ict_daily_symbol_time ON ict_daily_trend_analysis(symbol, timestamp DESC)',
      'CREATE INDEX IF NOT EXISTS idx_ict_4h_symbol_time ON ict_4h_structure_analysis(symbol, timestamp DESC)',
      'CREATE INDEX IF NOT EXISTS idx_ict_15m_symbol_time ON ict_15m_entry_analysis(symbol, timestamp DESC)',
      
      // 统一策略索引
      'CREATE INDEX IF NOT EXISTS idx_unified_results_symbol_strategy_time ON unified_strategy_results(symbol, strategy_type, timestamp DESC)',
      'CREATE INDEX IF NOT EXISTS idx_unified_results_signal ON unified_strategy_results(final_signal, timestamp DESC)',
      
      // 实时数据索引
      'CREATE INDEX IF NOT EXISTS idx_kline_cache_symbol_interval_time ON kline_data_cache(symbol, interval, open_time DESC)',
      'CREATE INDEX IF NOT EXISTS idx_realtime_price_symbol ON realtime_price_cache(symbol, last_update DESC)',
      'CREATE INDEX IF NOT EXISTS idx_delta_realtime_symbol_timeframe ON delta_realtime_data(symbol, timeframe, timestamp DESC)',
      
      // 分类管理索引
      'CREATE INDEX IF NOT EXISTS idx_symbol_categories_category ON symbol_categories(category)',
      'CREATE INDEX IF NOT EXISTS idx_symbol_categories_symbol ON symbol_categories(symbol)'
    ];

    for (const indexSQL of indexes) {
      try {
        await this.db.run(indexSQL);
      } catch (error) {
        console.warn('索引创建警告:', error.message);
      }
    }
  }

  /**
   * 初始化默认数据
   */
  async initializeDefaultData() {
    console.log('📝 初始化默认数据...');

    // 初始化交易对分类数据
    const symbolCategories = [
      // 主流币
      { symbol: 'BTCUSDT', category: 'largecap', rank: 1 },
      { symbol: 'ETHUSDT', category: 'largecap', rank: 2 },
      
      // 高市值币
      { symbol: 'BNBUSDT', category: 'midcap', rank: 4 },
      { symbol: 'SOLUSDT', category: 'midcap', rank: 5 },
      { symbol: 'XRPUSDT', category: 'midcap', rank: 6 },
      { symbol: 'ADAUSDT', category: 'midcap', rank: 8 },
      { symbol: 'DOTUSDT', category: 'midcap', rank: 10 },
      { symbol: 'LINKUSDT', category: 'midcap', rank: 12 },
      { symbol: 'LTCUSDT', category: 'midcap', rank: 14 },
      { symbol: 'BCHUSDT', category: 'midcap', rank: 16 },
      { symbol: 'UNIUSDT', category: 'midcap', rank: 18 },
      { symbol: 'POLUSDT', category: 'midcap', rank: 20 },
      { symbol: 'AVAXUSDT', category: 'midcap', rank: 11 },
      { symbol: 'ATOMUSDT', category: 'midcap', rank: 22 },
      
      // 小市值币
      { symbol: 'FILUSDT', category: 'smallcap', rank: 25 },
      { symbol: 'TRXUSDT', category: 'smallcap', rank: 30 },
      { symbol: 'ETCUSDT', category: 'smallcap', rank: 35 },
      { symbol: 'XLMUSDT', category: 'smallcap', rank: 40 },
      { symbol: 'VETUSDT', category: 'smallcap', rank: 45 },
      { symbol: 'ICPUSDT', category: 'smallcap', rank: 28 },
      { symbol: 'THETAUSDT', category: 'smallcap', rank: 50 },
      { symbol: 'FTMUSDT', category: 'smallcap', rank: 55 }
    ];

    for (const item of symbolCategories) {
      await this.db.run(`
        INSERT OR REPLACE INTO symbol_categories 
        (symbol, category, market_cap_rank, 
         v3_vwap_weight, v3_breakout_weight, v3_volume_weight, v3_oi_weight, v3_delta_weight, v3_funding_weight,
         ict_structure_weight, ict_volume_weight, ict_sweep_weight, ict_ob_weight, ict_fvg_weight,
         max_position_size, default_leverage, max_holding_time_hours) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        item.symbol, item.category, item.rank,
        // V3权重 (按strategy-v3.md文档)
        item.category === 'largecap' ? 0.40 : item.category === 'midcap' ? 0.35 : 0.25, // VWAP
        item.category === 'largecap' ? 0.30 : item.category === 'midcap' ? 0.25 : 0.15, // 突破
        item.category === 'largecap' ? 0.20 : item.category === 'midcap' ? 0.25 : 0.35, // 成交量
        item.category === 'largecap' ? 0.25 : item.category === 'midcap' ? 0.20 : 0.15, // OI
        item.category === 'largecap' ? 0.15 : item.category === 'midcap' ? 0.20 : 0.25, // Delta
        0.10, // 资金费率权重
        // ICT权重 (按ict.md文档)
        0.25, 0.20, 0.20, 0.25, 0.20, // 结构、成交量、Sweep、OB、FVG
        // 风险管理
        item.category === 'largecap' ? 1000 : item.category === 'midcap' ? 500 : 200, // 最大仓位
        item.category === 'largecap' ? 10 : item.category === 'midcap' ? 15 : 20, // 默认杠杆
        item.category === 'largecap' ? 12 : item.category === 'midcap' ? 8 : 4 // 最大持仓时间
      ]);
    }

    // 初始化分类权重模板
    const weightTemplates = [
      {
        category: 'largecap',
        strategy: 'V3',
        config: JSON.stringify({
          vwap: { weight: 0.40, required: true },
          breakout: { weight: 0.30, threshold: 0.005 },
          volume: { weight: 0.20, threshold: 1.5 },
          oi: { weight: 0.25, threshold: 0.02 },
          delta: { weight: 0.15, threshold: 1.2 },
          funding: { weight: 0.10, threshold: 0.0005 }
        })
      },
      {
        category: 'midcap',
        strategy: 'V3',
        config: JSON.stringify({
          vwap: { weight: 0.35, required: true },
          breakout: { weight: 0.25, threshold: 0.005 },
          volume: { weight: 0.25, threshold: 1.5 },
          oi: { weight: 0.20, threshold: 0.02 },
          delta: { weight: 0.20, threshold: 1.2 },
          funding: { weight: 0.10, threshold: 0.0005 }
        })
      },
      {
        category: 'smallcap',
        strategy: 'V3',
        config: JSON.stringify({
          vwap: { weight: 0.25, required: true },
          breakout: { weight: 0.15, threshold: 0.008 },
          volume: { weight: 0.35, threshold: 1.8 },
          oi: { weight: 0.15, threshold: 0.03 },
          delta: { weight: 0.25, threshold: 1.5 },
          funding: { weight: 0.10, threshold: 0.0008 }
        })
      }
    ];

    for (const template of weightTemplates) {
      await this.db.run(`
        INSERT OR REPLACE INTO category_weight_templates 
        (category, strategy_type, weight_config, threshold_config, description) 
        VALUES (?, ?, ?, ?, ?)
      `, [
        template.category,
        template.strategy,
        template.config,
        template.config, // 阈值配置与权重配置相同
        `${template.category}类别${template.strategy}策略权重模板`
      ]);
    }
  }

  /**
   * 验证迁移结果
   */
  async validateMigration() {
    console.log('✅ 验证数据库迁移结果...');

    const tables = [
      'v3_trend_4h_analysis',
      'v3_hourly_scoring', 
      'v3_execution_15m',
      'v3_range_boundary_analysis',
      'ict_daily_trend_analysis',
      'ict_4h_structure_analysis',
      'ict_15m_entry_analysis',
      'ict_risk_management',
      'unified_strategy_results',
      'strategy_performance_monitoring',
      'symbol_categories',
      'category_weight_templates',
      'kline_data_cache',
      'realtime_price_cache',
      'delta_realtime_data'
    ];

    const results = [];
    
    for (const table of tables) {
      try {
        const result = await this.db.get(`SELECT COUNT(*) as count FROM ${table}`);
        results.push({
          table,
          exists: true,
          rowCount: result.count
        });
      } catch (error) {
        results.push({
          table,
          exists: false,
          error: error.message
        });
      }
    }

    console.log('📊 数据库表验证结果:');
    results.forEach(result => {
      if (result.exists) {
        console.log(`  ✅ ${result.table}: ${result.rowCount} 行`);
      } else {
        console.log(`  ❌ ${result.table}: ${result.error}`);
      }
    });

    return results;
  }
}

module.exports = StrategyEngineMigration;
