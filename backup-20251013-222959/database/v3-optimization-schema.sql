-- V3策略第二次优化数据库表结构
-- 添加V3策略优化相关字段

-- 1. 为strategy_judgments表添加V3优化字段
ALTER TABLE strategy_judgments 
ADD COLUMN trend_confidence DECIMAL(5,4) DEFAULT 0.0000 COMMENT '趋势置信度(0-1)',
ADD COLUMN macd_aligned TINYINT(1) DEFAULT 0 COMMENT 'MACD与趋势同向',
ADD COLUMN decorrelated_score DECIMAL(5,4) DEFAULT 0.0000 COMMENT '去相关因子得分',
ADD COLUMN trend_persistence TINYINT(1) DEFAULT 0 COMMENT '趋势连续性验证',
ADD COLUMN confirmation_delay TINYINT(1) DEFAULT 0 COMMENT '确认延迟机制',
ADD COLUMN adaptive_stop_atr DECIMAL(10,6) DEFAULT 2.000000 COMMENT '自适应止损ATR倍数',
ADD COLUMN cost_aware_filter TINYINT(1) DEFAULT 0 COMMENT '成本感知过滤',
ADD COLUMN position_confidence DECIMAL(5,4) DEFAULT 0.0000 COMMENT '仓位置信度',
ADD COLUMN volatility_contraction TINYINT(1) DEFAULT 0 COMMENT '波动率收缩检测',
ADD COLUMN rolling_win_rate DECIMAL(5,4) DEFAULT 0.5000 COMMENT '滚动胜率',
ADD COLUMN telemetry_data JSON DEFAULT NULL COMMENT '遥测数据';

-- 2. 创建V3策略配置表
CREATE TABLE IF NOT EXISTS v3_strategy_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_name VARCHAR(50) NOT NULL UNIQUE,
    adx_threshold DECIMAL(5,2) DEFAULT 30.00,
    atr_multiplier_base DECIMAL(5,3) DEFAULT 2.000,
    confirmation_bars INT DEFAULT 2,
    max_leverage INT DEFAULT 20,
    min_leverage INT DEFAULT 1,
    risk_per_trade DECIMAL(10,2) DEFAULT 100.00,
    correlation_matrix JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. 创建V3策略遥测表
CREATE TABLE IF NOT EXISTS v3_telemetry (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    symbol_id INT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    trend_score DECIMAL(5,2) DEFAULT 0.00,
    factor_score DECIMAL(5,2) DEFAULT 0.00,
    execution_score DECIMAL(5,2) DEFAULT 0.00,
    total_score DECIMAL(5,2) DEFAULT 0.00,
    trend_confidence DECIMAL(5,4) DEFAULT 0.0000,
    decorrelated_factors JSON DEFAULT NULL,
    signal_result ENUM('BUY','SELL','HOLD') DEFAULT 'HOLD',
    position_size DECIMAL(15,2) DEFAULT 0.00,
    stop_loss DECIMAL(15,6) DEFAULT 0.000000,
    take_profit DECIMAL(15,6) DEFAULT 0.000000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_symbol_timestamp (symbol_id, timestamp),
    INDEX idx_signal_result (signal_result),
    FOREIGN KEY (symbol_id) REFERENCES symbols(id)
);

-- 4. 创建V3策略胜率历史表
CREATE TABLE IF NOT EXISTS v3_win_rate_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    symbol_id INT NOT NULL,
    timeframe ENUM('1H','4H','1D') NOT NULL,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    total_signals INT DEFAULT 0,
    winning_signals INT DEFAULT 0,
    win_rate DECIMAL(5,4) DEFAULT 0.0000,
    avg_return DECIMAL(8,6) DEFAULT 0.000000,
    max_drawdown DECIMAL(8,6) DEFAULT 0.000000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_symbol_timeframe (symbol_id, timeframe),
    INDEX idx_period (period_start, period_end),
    FOREIGN KEY (symbol_id) REFERENCES symbols(id)
);

-- 5. 插入默认配置
INSERT INTO v3_strategy_config (config_name, adx_threshold, atr_multiplier_base, confirmation_bars, max_leverage, min_leverage, risk_per_trade, correlation_matrix) VALUES
('default', 30.00, 2.000, 2, 20, 1, 100.00, '[[1,0.7,0.6],[0.7,1,0.65],[0.6,0.65,1]]'),
('conservative', 35.00, 2.500, 3, 15, 1, 50.00, '[[1,0.7,0.6],[0.7,1,0.65],[0.6,0.65,1]]'),
('aggressive', 25.00, 1.500, 1, 25, 2, 200.00, '[[1,0.7,0.6],[0.7,1,0.65],[0.6,0.65,1]]');

-- 6. 创建索引优化查询性能
CREATE INDEX idx_v3_trend_confidence ON strategy_judgments(trend_confidence);
CREATE INDEX idx_v3_decorrelated_score ON strategy_judgments(decorrelated_score);
CREATE INDEX idx_v3_position_confidence ON strategy_judgments(position_confidence);
CREATE INDEX idx_v3_rolling_win_rate ON strategy_judgments(rolling_win_rate);

-- 7. 创建V3策略性能分析视图
CREATE VIEW v3_strategy_performance AS
SELECT 
    s.symbol,
    sj.strategy_name,
    sj.timeframe,
    COUNT(*) as total_signals,
    SUM(CASE WHEN sj.entry_signal IN ('BUY', 'SELL') THEN 1 ELSE 0 END) as active_signals,
    AVG(sj.trend_confidence) as avg_trend_confidence,
    AVG(sj.decorrelated_score) as avg_decorrelated_score,
    AVG(sj.position_confidence) as avg_position_confidence,
    AVG(sj.rolling_win_rate) as avg_win_rate,
    MAX(sj.created_at) as last_signal_time
FROM strategy_judgments sj
JOIN symbols s ON sj.symbol_id = s.id
WHERE sj.strategy_name = 'V3'
GROUP BY s.symbol, sj.timeframe
ORDER BY avg_win_rate DESC;
