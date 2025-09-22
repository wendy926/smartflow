-- SmartFlow策略数据库表设计
-- 严格按照strategy-v3.md和ict.md要求实现

-- 1. K线数据表
CREATE TABLE IF NOT EXISTS kline_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    timeframe TEXT NOT NULL, -- '1d', '4h', '1h', '15m'
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

-- 2. 技术指标表
CREATE TABLE IF NOT EXISTS technical_indicators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    open_time INTEGER NOT NULL,
    -- MA指标
    ma20 REAL,
    ma50 REAL,
    ma200 REAL,
    ema20 REAL,
    ema50 REAL,
    -- ATR指标
    atr14 REAL,
    atr20 REAL,
    -- ADX指标
    adx14 REAL,
    di_plus REAL,
    di_minus REAL,
    -- 布林带
    bb_upper REAL,
    bb_middle REAL,
    bb_lower REAL,
    bb_width REAL,
    -- VWAP
    vwap REAL,
    -- 成交量指标
    volume_ma20 REAL,
    volume_ratio REAL,
    -- OI变化
    oi_change_6h REAL,
    -- 资金费率
    funding_rate REAL,
    -- Delta指标
    delta_buy REAL,
    delta_sell REAL,
    delta_ratio REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, timeframe, open_time)
);

-- 3. V3策略分析结果表
CREATE TABLE IF NOT EXISTS v3_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    analysis_time INTEGER NOT NULL,
    -- 4H趋势分析
    trend4h TEXT, -- '多头趋势', '空头趋势', '震荡市'
    trend4h_score INTEGER,
    trend_strength TEXT, -- '强', '中', '弱'
    -- 1H多因子分析
    score1h INTEGER,
    vwap_direction TEXT, -- '多头', '空头', '中性'
    breakout_confirmed BOOLEAN,
    volume_confirmed_15m BOOLEAN,
    volume_confirmed_1h BOOLEAN,
    oi_change_confirmed BOOLEAN,
    funding_rate_ok BOOLEAN,
    delta_confirmed BOOLEAN,
    -- 15m执行分析
    execution_mode TEXT, -- '回踩确认', '突破确认', 'NONE'
    entry_price REAL,
    stop_loss REAL,
    take_profit REAL,
    atr_value REAL,
    -- 最终信号
    final_signal TEXT, -- '做多', '做空', '观望'
    signal_strength TEXT, -- '强', '中', '弱'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, analysis_time)
);

-- 4. ICT策略分析结果表
CREATE TABLE IF NOT EXISTS ict_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    analysis_time INTEGER NOT NULL,
    -- 1D趋势分析
    daily_trend TEXT, -- 'up', 'down', 'sideways'
    daily_trend_score INTEGER,
    -- 4H结构分析
    ob_detected BOOLEAN,
    ob_low REAL,
    ob_high REAL,
    ob_age_days REAL,
    fvg_detected BOOLEAN,
    fvg_low REAL,
    fvg_high REAL,
    fvg_age_days REAL,
    -- Sweep分析
    sweep_htf BOOLEAN,
    sweep_htf_speed REAL,
    sweep_ltf BOOLEAN,
    sweep_ltf_speed REAL,
    -- 15m入场确认
    engulfing_detected BOOLEAN,
    volume_confirm BOOLEAN,
    -- 最终信号
    signal_type TEXT, -- 'BOS_LONG', 'BOS_SHORT', 'CHoCH_LONG', 'CHoCH_SHORT', 'MIT_LONG', 'MIT_SHORT', 'WAIT'
    signal_strength TEXT, -- '强', '中', '弱'
    entry_price REAL,
    stop_loss REAL,
    take_profit REAL,
    atr_4h REAL,
    atr_15m REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, analysis_time)
);

-- 5. 订单块(OB)和失衡区(FVG)表
CREATE TABLE IF NOT EXISTS order_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    timeframe TEXT NOT NULL, -- '4h', '1h', '15m'
    block_type TEXT NOT NULL, -- 'OB', 'FVG'
    direction TEXT NOT NULL, -- 'LONG', 'SHORT'
    high_price REAL NOT NULL,
    low_price REAL NOT NULL,
    open_time INTEGER NOT NULL,
    close_time INTEGER,
    -- OB/FVG属性
    height_atr_ratio REAL, -- 高度/ATR比例
    age_days REAL,
    is_valid BOOLEAN DEFAULT TRUE,
    sweep_count INTEGER DEFAULT 0,
    last_sweep_time INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. 流动性区域表
CREATE TABLE IF NOT EXISTS liquidity_zones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    zone_type TEXT NOT NULL, -- 'EQH', 'EQL', 'BOS', 'CHoCH'
    price_level REAL NOT NULL,
    open_time INTEGER NOT NULL,
    is_swept BOOLEAN DEFAULT FALSE,
    sweep_time INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. 增强的模拟交易表
CREATE TABLE IF NOT EXISTS simulations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    strategy_type TEXT NOT NULL, -- 'V3', 'ICT'
    direction TEXT NOT NULL, -- 'LONG', 'SHORT'
    entry_price REAL NOT NULL,
    stop_loss_price REAL NOT NULL,
    take_profit_price REAL NOT NULL,
    -- 策略参数
    max_leverage INTEGER NOT NULL,
    min_margin REAL NOT NULL,
    stop_loss_distance REAL NOT NULL, -- 止损距离百分比
    atr_value REAL NOT NULL,
    -- 触发信息
    trigger_reason TEXT NOT NULL,
    execution_mode TEXT,
    -- 状态管理
    status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'CLOSED', 'CANCELLED'
    exit_price REAL,
    exit_reason TEXT,
    profit_loss REAL,
    is_win BOOLEAN,
    -- 时间管理
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME,
    -- 风险参数
    risk_amount REAL, -- 风险金额
    position_size REAL, -- 仓位大小
    leverage_used INTEGER, -- 实际使用杠杆
    margin_used REAL, -- 实际使用保证金
    -- 关联分析ID
    v3_analysis_id INTEGER,
    ict_analysis_id INTEGER,
    FOREIGN KEY (v3_analysis_id) REFERENCES v3_analysis(id),
    FOREIGN KEY (ict_analysis_id) REFERENCES ict_analysis(id)
);

-- 8. 市场数据更新日志表
CREATE TABLE IF NOT EXISTS data_update_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data_type TEXT NOT NULL, -- 'kline', 'indicators', 'analysis'
    symbol TEXT,
    timeframe TEXT,
    update_time INTEGER NOT NULL,
    records_updated INTEGER,
    status TEXT, -- 'SUCCESS', 'FAILED', 'PARTIAL'
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_kline_symbol_timeframe ON kline_data(symbol, timeframe);
CREATE INDEX IF NOT EXISTS idx_kline_open_time ON kline_data(open_time);
CREATE INDEX IF NOT EXISTS idx_indicators_symbol_timeframe ON technical_indicators(symbol, timeframe);
CREATE INDEX IF NOT EXISTS idx_v3_analysis_symbol ON v3_analysis(symbol);
CREATE INDEX IF NOT EXISTS idx_v3_analysis_time ON v3_analysis(analysis_time);
CREATE INDEX IF NOT EXISTS idx_ict_analysis_symbol ON ict_analysis(symbol);
CREATE INDEX IF NOT EXISTS idx_ict_analysis_time ON ict_analysis(analysis_time);
CREATE INDEX IF NOT EXISTS idx_order_blocks_symbol ON order_blocks(symbol, timeframe);
CREATE INDEX IF NOT EXISTS idx_simulations_symbol ON simulations(symbol);
CREATE INDEX IF NOT EXISTS idx_simulations_status ON simulations(status);
CREATE INDEX IF NOT EXISTS idx_simulations_created ON simulations(created_at);

-- 创建触发器更新时间戳
CREATE TRIGGER IF NOT EXISTS update_kline_data_timestamp 
    AFTER UPDATE ON kline_data
    BEGIN
        UPDATE kline_data SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_technical_indicators_timestamp 
    AFTER UPDATE ON technical_indicators
    BEGIN
        UPDATE technical_indicators SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_order_blocks_timestamp 
    AFTER UPDATE ON order_blocks
    BEGIN
        UPDATE order_blocks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
