-- 真实策略实现数据库迁移脚本
-- 基于现有表结构，添加K线数据和技术指标存储

-- 1. K线数据表 - 存储从Binance获取的真实K线数据
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

-- 2. 技术指标表 - 存储计算出的技术指标
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

-- 3. V3策略分析结果表 - 存储V3策略的详细分析结果
CREATE TABLE IF NOT EXISTS v3_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    analysis_time INTEGER NOT NULL,
    -- 4H趋势分析
    trend4h TEXT, -- '多头趋势', '空头趋势', '震荡市'
    trend4h_score INTEGER,
    trend_strength TEXT, -- '强', '中', '弱'
    ma20_4h REAL,
    ma50_4h REAL,
    ma200_4h REAL,
    adx14_4h REAL,
    di_plus_4h REAL,
    di_minus_4h REAL,
    bb_width_4h REAL,
    bb_expanding BOOLEAN,
    -- 1H多因子分析
    score1h INTEGER,
    vwap_direction TEXT, -- '多头', '空头', '中性'
    breakout_confirmed BOOLEAN,
    volume_confirmed_15m BOOLEAN,
    volume_confirmed_1h BOOLEAN,
    oi_change_confirmed BOOLEAN,
    funding_rate_ok BOOLEAN,
    delta_confirmed BOOLEAN,
    vwap_1h REAL,
    volume_ratio_15m REAL,
    volume_ratio_1h REAL,
    oi_change_6h REAL,
    funding_rate REAL,
    delta_buy REAL,
    delta_sell REAL,
    -- 15m执行分析
    execution_mode TEXT, -- '回踩确认', '突破确认', 'NONE'
    entry_price REAL,
    stop_loss REAL,
    take_profit REAL,
    atr_value REAL,
    setup_candle_high REAL,
    setup_candle_low REAL,
    -- 最终信号
    final_signal TEXT, -- '做多', '做空', '观望'
    signal_strength TEXT, -- '强', '中', '弱'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, analysis_time)
);

-- 4. ICT策略分析结果表 - 存储ICT策略的详细分析结果
CREATE TABLE IF NOT EXISTS ict_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    analysis_time INTEGER NOT NULL,
    -- 1D趋势分析
    daily_trend TEXT, -- 'up', 'down', 'sideways'
    daily_trend_score INTEGER,
    daily_close_20_ago REAL,
    daily_close_current REAL,
    -- 4H结构分析
    ob_detected BOOLEAN,
    ob_low REAL,
    ob_high REAL,
    ob_age_days REAL,
    ob_height_atr_ratio REAL,
    fvg_detected BOOLEAN,
    fvg_low REAL,
    fvg_high REAL,
    fvg_age_days REAL,
    -- Sweep分析
    sweep_htf BOOLEAN,
    sweep_htf_speed REAL,
    sweep_ltf BOOLEAN,
    sweep_ltf_speed REAL,
    atr_4h REAL,
    atr_15m REAL,
    -- 15m入场确认
    engulfing_detected BOOLEAN,
    volume_confirm BOOLEAN,
    -- 最终信号
    signal_type TEXT, -- 'BOS_LONG', 'BOS_SHORT', 'CHoCH_LONG', 'CHoCH_SHORT', 'MIT_LONG', 'MIT_SHORT', 'WAIT'
    signal_strength TEXT, -- '强', '中', '弱'
    entry_price REAL,
    stop_loss REAL,
    take_profit REAL,
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

-- 7. 增强现有simulations表，添加策略分析关联
ALTER TABLE simulations ADD COLUMN v3_analysis_id INTEGER;
ALTER TABLE simulations ADD COLUMN ict_analysis_id INTEGER;

-- 8. 数据更新日志表
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
CREATE INDEX IF NOT EXISTS idx_liquidity_zones_symbol ON liquidity_zones(symbol, timeframe);
CREATE INDEX IF NOT EXISTS idx_simulations_v3_analysis ON simulations(v3_analysis_id);
CREATE INDEX IF NOT EXISTS idx_simulations_ict_analysis ON simulations(ict_analysis_id);

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

-- 插入初始配置数据
INSERT OR IGNORE INTO data_update_log (data_type, symbol, timeframe, update_time, records_updated, status) 
VALUES ('system', 'SYSTEM', 'SYSTEM', strftime('%s', 'now'), 0, 'INITIALIZED');
