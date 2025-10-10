-- V3.1策略优化数据库表结构
-- 基于strategy-v3.1.md的三个高优先级优化：
-- 1. 趋势确认提前化（earlyTrendDetect）
-- 2. 假突破过滤器（fakeBreakoutFilter）  
-- 3. 动态止损策略（dynamicStopLoss）

USE trading_system;

-- 1. 为simulation_trades表添加V3.1优化字段
ALTER TABLE simulation_trades 
-- 早期趋势探测相关字段
ADD COLUMN early_trend_detected TINYINT(1) DEFAULT 0 COMMENT '是否检测到早期趋势',
ADD COLUMN early_trend_signal VARCHAR(20) DEFAULT NULL COMMENT '早期趋势信号类型(EARLY_LONG/EARLY_SHORT)',
ADD COLUMN macd_histogram_1h DECIMAL(10,6) DEFAULT NULL COMMENT '1H MACD柱状图值',
ADD COLUMN delta_1h DECIMAL(10,6) DEFAULT NULL COMMENT '1H Delta值',
ADD COLUMN vwap_direction_1h TINYINT(1) DEFAULT NULL COMMENT '1H VWAP方向(1=上/0=中/-1=下)',
ADD COLUMN adx_1h DECIMAL(10,4) DEFAULT NULL COMMENT '1H ADX值',

-- 假突破过滤器相关字段
ADD COLUMN fake_breakout_filter_passed TINYINT(1) DEFAULT 0 COMMENT '假突破过滤器是否通过',
ADD COLUMN volume_confirmed TINYINT(1) DEFAULT 0 COMMENT '成交量是否确认(>=1.2倍均量)',
ADD COLUMN delta_aligned TINYINT(1) DEFAULT 0 COMMENT 'Delta是否同向',
ADD COLUMN breakout_confirmed TINYINT(1) DEFAULT 0 COMMENT '突破是否确认(1根K线)',
ADD COLUMN range_boundary_ok TINYINT(1) DEFAULT 0 COMMENT '是否不在区间边界',
ADD COLUMN filter_rejection_reason VARCHAR(100) DEFAULT NULL COMMENT '过滤器拒绝原因',

-- 动态止损相关字段
ADD COLUMN confidence_level VARCHAR(10) DEFAULT 'med' COMMENT '置信度等级(high/med/low)',
ADD COLUMN initial_atr_multiplier DECIMAL(5,2) DEFAULT 2.0 COMMENT '初始止损ATR倍数',
ADD COLUMN current_atr_multiplier DECIMAL(5,2) DEFAULT 2.0 COMMENT '当前止损ATR倍数',
ADD COLUMN stop_loss_type VARCHAR(20) DEFAULT 'initial' COMMENT '止损类型(initial/dynamic/breakeven/trailing)',
ADD COLUMN time_stop_minutes INT DEFAULT 60 COMMENT '时间止损分钟数',
ADD COLUMN profit_trigger_atr DECIMAL(5,2) DEFAULT 1.0 COMMENT '启用追踪止盈的盈利触发(ATR倍数)',
ADD COLUMN trail_step_atr DECIMAL(5,2) DEFAULT 0.5 COMMENT '追踪止损步长(ATR倍数)',
ADD COLUMN tp_factor DECIMAL(5,2) DEFAULT 1.3 COMMENT '止盈因子',
ADD COLUMN stop_loss_adjusted_at TIMESTAMP NULL DEFAULT NULL COMMENT '止损最后调整时间',
ADD COLUMN trailing_activated TINYINT(1) DEFAULT 0 COMMENT '追踪止盈是否已激活',

-- 索引优化
ADD INDEX idx_early_trend (early_trend_detected),
ADD INDEX idx_fake_breakout_filter (fake_breakout_filter_passed),
ADD INDEX idx_confidence_level (confidence_level),
ADD INDEX idx_stop_loss_type (stop_loss_type);

-- 2. 创建V3.1策略信号日志表（记录每次信号生成的详细过程）
CREATE TABLE IF NOT EXISTS v3_1_signal_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    symbol_id INT NOT NULL COMMENT '交易对ID',
    signal_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '信号生成时间',
    
    -- 早期趋势探测结果
    early_trend_detected TINYINT(1) DEFAULT 0 COMMENT '是否检测到早期趋势',
    early_trend_type VARCHAR(20) DEFAULT NULL COMMENT '早期趋势类型',
    macd_hist_1h DECIMAL(10,6) DEFAULT NULL COMMENT '1H MACD histogram',
    macd_hist_prev_1h DECIMAL(10,6) DEFAULT NULL COMMENT '前一根1H MACD histogram',
    delta_1h DECIMAL(10,6) DEFAULT NULL COMMENT '1H Delta',
    vwap_price_relation VARCHAR(10) DEFAULT NULL COMMENT '价格与VWAP关系(above/below)',
    adx_1h DECIMAL(10,4) DEFAULT NULL COMMENT '1H ADX',
    adx_4h DECIMAL(10,4) DEFAULT NULL COMMENT '4H ADX',
    early_trend_reason TEXT DEFAULT NULL COMMENT '早期趋势判断理由',
    
    -- 假突破过滤器结果
    fake_breakout_filter_result VARCHAR(10) DEFAULT 'pending' COMMENT '过滤器结果(pass/fail/pending)',
    volume_ratio DECIMAL(10,4) DEFAULT NULL COMMENT '成交量比率(当前/均值)',
    volume_passed TINYINT(1) DEFAULT 0 COMMENT '成交量检查是否通过',
    delta_15m DECIMAL(10,6) DEFAULT NULL COMMENT '15M Delta',
    delta_same_direction TINYINT(1) DEFAULT 0 COMMENT 'Delta是否同向',
    confirm_bars INT DEFAULT 1 COMMENT '确认K线数',
    reclaim_pct DECIMAL(10,6) DEFAULT NULL COMMENT '回撤百分比',
    at_range_edge TINYINT(1) DEFAULT 0 COMMENT '是否在区间边界',
    filter_details JSON DEFAULT NULL COMMENT '过滤器详细数据',
    
    -- 市场状态
    market_regime VARCHAR(20) DEFAULT 'UNKNOWN' COMMENT '市场状态(TREND/RANGE/TRANSITION)',
    trend_direction VARCHAR(10) DEFAULT NULL COMMENT '趋势方向(UP/DOWN/RANGE)',
    
    -- 评分信息
    trend_score_4h DECIMAL(5,2) DEFAULT 0 COMMENT '4H趋势得分',
    factor_score_1h DECIMAL(5,2) DEFAULT 0 COMMENT '1H因子得分',
    entry_score_15m DECIMAL(5,2) DEFAULT 0 COMMENT '15M入场得分',
    total_score DECIMAL(5,2) DEFAULT 0 COMMENT '总分',
    confidence VARCHAR(10) DEFAULT 'reject' COMMENT '置信度(high/med/low/reject)',
    
    -- 动态止损参数
    atr_15m DECIMAL(10,6) DEFAULT NULL COMMENT '15M ATR',
    initial_sl_multiplier DECIMAL(5,2) DEFAULT 2.0 COMMENT '初始止损ATR倍数',
    dynamic_sl_multiplier DECIMAL(5,2) DEFAULT 2.8 COMMENT '动态止损ATR倍数',
    time_stop_minutes INT DEFAULT 60 COMMENT '时间止损(分钟)',
    profit_trigger DECIMAL(5,2) DEFAULT 1.0 COMMENT '盈利触发点(ATR倍数)',
    trail_step DECIMAL(5,2) DEFAULT 0.5 COMMENT '追踪步长(ATR倍数)',
    tp_factor DECIMAL(5,2) DEFAULT 1.3 COMMENT '止盈因子',
    
    -- 最终信号
    final_signal VARCHAR(10) DEFAULT 'HOLD' COMMENT '最终信号(BUY/SELL/HOLD)',
    executed TINYINT(1) DEFAULT 0 COMMENT '是否执行',
    rejection_reason TEXT DEFAULT NULL COMMENT '拒绝原因',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    INDEX idx_symbol_time (symbol_id, signal_time),
    INDEX idx_early_trend (early_trend_detected),
    INDEX idx_filter_result (fake_breakout_filter_result),
    INDEX idx_confidence (confidence),
    INDEX idx_final_signal (final_signal),
    INDEX idx_executed (executed),
    FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='V3.1策略信号详细日志表';

-- 3. 创建V3.1策略配置表（存储策略参数）
CREATE TABLE IF NOT EXISTS v3_1_strategy_params (
    id INT AUTO_INCREMENT PRIMARY KEY,
    param_name VARCHAR(50) NOT NULL UNIQUE COMMENT '参数名称',
    param_value VARCHAR(100) NOT NULL COMMENT '参数值',
    param_type VARCHAR(20) DEFAULT 'number' COMMENT '参数类型(number/boolean/string)',
    category VARCHAR(50) NOT NULL COMMENT '参数分类(early_trend/fake_breakout/dynamic_stop)',
    description TEXT DEFAULT NULL COMMENT '参数描述',
    is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_category (category),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='V3.1策略参数配置表';

-- 4. 插入默认参数配置
INSERT INTO v3_1_strategy_params (param_name, param_value, param_type, category, description) VALUES
-- 早期趋势探测参数
('early_macd_hist_threshold', '0.5', 'number', 'early_trend', '1H MACD histogram阈值'),
('early_macd_consecutive_bars', '2', 'number', 'early_trend', 'MACD连续确认K线数'),
('early_delta_threshold', '0.05', 'number', 'early_trend', '1H Delta阈值'),
('early_adx_min', '20', 'number', 'early_trend', '1H ADX最小值'),
('early_adx_4h_max', '40', 'number', 'early_trend', '4H ADX最大值(反向检查)'),
('early_trend_weight_bonus', '0.1', 'number', 'early_trend', '早期趋势权重加成'),

-- 假突破过滤器参数
('fb_volume_factor', '1.2', 'number', 'fake_breakout', '成交量因子(当前/平均)'),
('fb_delta_threshold', '0.04', 'number', 'fake_breakout', 'Delta阈值'),
('fb_confirm_bars', '1', 'number', 'fake_breakout', '突破确认K线数'),
('fb_reclaim_pct', '0.003', 'number', 'fake_breakout', '回撤百分比(0.3%)'),
('fb_range_lookback_4h', '10', 'number', 'fake_breakout', '4H区间回溯K线数'),

-- 动态止损参数
('ds_k_entry_high', '1.5', 'number', 'dynamic_stop', '高置信度初始止损ATR倍数'),
('ds_k_entry_med', '2.0', 'number', 'dynamic_stop', '中置信度初始止损ATR倍数'),
('ds_k_entry_low', '2.6', 'number', 'dynamic_stop', '低置信度初始止损ATR倍数'),
('ds_k_hold', '2.8', 'number', 'dynamic_stop', '趋势确认后止损扩大ATR倍数'),
('ds_time_stop_minutes', '60', 'number', 'dynamic_stop', '时间止损(分钟)'),
('ds_profit_trigger', '1.0', 'number', 'dynamic_stop', '启用追踪止盈的盈利触发(ATR倍数)'),
('ds_trail_step', '0.5', 'number', 'dynamic_stop', '追踪止损步长(ATR倍数)'),
('ds_tp_factor', '1.3', 'number', 'dynamic_stop', '止盈因子'),

-- 置信度分层参数
('confidence_high_threshold', '80', 'number', 'confidence', '高置信度阈值'),
('confidence_med_threshold', '60', 'number', 'confidence', '中置信度阈值'),
('confidence_low_threshold', '45', 'number', 'confidence', '低置信度阈值'),

-- 仓位管理参数
('base_risk_pct', '0.005', 'number', 'position_sizing', '基础风险百分比(0.5%)'),
('size_high_multiplier', '1.0', 'number', 'position_sizing', '高置信度仓位倍数'),
('size_med_multiplier', '0.6', 'number', 'position_sizing', '中置信度仓位倍数'),
('size_low_multiplier', '0.3', 'number', 'position_sizing', '低置信度仓位倍数')
ON DUPLICATE KEY UPDATE
    param_value = VALUES(param_value),
    updated_at = CURRENT_TIMESTAMP;

-- 5. 创建V3.1性能统计视图
CREATE OR REPLACE VIEW v3_1_performance_summary AS
SELECT 
    s.symbol,
    COUNT(t.id) as total_trades,
    SUM(CASE WHEN t.early_trend_detected = 1 THEN 1 ELSE 0 END) as early_trend_trades,
    SUM(CASE WHEN t.fake_breakout_filter_passed = 1 THEN 1 ELSE 0 END) as filter_passed_trades,
    SUM(CASE WHEN t.status = 'CLOSED' THEN 1 ELSE 0 END) as closed_trades,
    SUM(CASE WHEN t.pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
    ROUND(SUM(CASE WHEN t.pnl > 0 THEN 1 ELSE 0 END) * 100.0 / NULLIF(SUM(CASE WHEN t.status = 'CLOSED' THEN 1 ELSE 0 END), 0), 2) as win_rate,
    AVG(CASE WHEN t.early_trend_detected = 1 THEN t.pnl ELSE NULL END) as avg_pnl_with_early_trend,
    AVG(CASE WHEN t.fake_breakout_filter_passed = 1 THEN t.pnl ELSE NULL END) as avg_pnl_with_filter,
    AVG(t.confidence_level) as avg_confidence,
    SUM(t.pnl) as total_pnl,
    MAX(t.created_at) as last_trade_time
FROM symbols s
LEFT JOIN simulation_trades t ON s.id = t.symbol_id AND t.strategy_name = 'V3'
WHERE t.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY s.symbol
ORDER BY win_rate DESC;

-- 6. 创建存储过程：获取V3.1策略参数
DELIMITER //
CREATE PROCEDURE GetV31StrategyParams(IN p_category VARCHAR(50))
BEGIN
    IF p_category IS NULL OR p_category = '' THEN
        SELECT param_name, param_value, param_type, category, description
        FROM v3_1_strategy_params
        WHERE is_active = 1;
    ELSE
        SELECT param_name, param_value, param_type, category, description
        FROM v3_1_strategy_params
        WHERE category = p_category AND is_active = 1;
    END IF;
END //
DELIMITER ;

-- 7. 创建存储过程：更新动态止损
DELIMITER //
CREATE PROCEDURE UpdateDynamicStopLoss(
    IN p_trade_id BIGINT,
    IN p_new_stop_loss DECIMAL(20,8),
    IN p_new_atr_multiplier DECIMAL(5,2),
    IN p_stop_loss_type VARCHAR(20),
    IN p_trailing_activated TINYINT(1)
)
BEGIN
    UPDATE simulation_trades
    SET 
        stop_loss = p_new_stop_loss,
        current_atr_multiplier = p_new_atr_multiplier,
        stop_loss_type = p_stop_loss_type,
        trailing_activated = p_trailing_activated,
        stop_loss_adjusted_at = CURRENT_TIMESTAMP
    WHERE id = p_trade_id;
END //
DELIMITER ;

-- 8. 为信号日志表创建分区（按月）
ALTER TABLE v3_1_signal_logs 
PARTITION BY RANGE (UNIX_TIMESTAMP(created_at)) (
    PARTITION p202410 VALUES LESS THAN (UNIX_TIMESTAMP('2024-11-01')),
    PARTITION p202411 VALUES LESS THAN (UNIX_TIMESTAMP('2024-12-01')),
    PARTITION p202412 VALUES LESS THAN (UNIX_TIMESTAMP('2025-01-01')),
    PARTITION p202501 VALUES LESS THAN (UNIX_TIMESTAMP('2025-02-01')),
    PARTITION p202502 VALUES LESS THAN (UNIX_TIMESTAMP('2025-03-01')),
    PARTITION p202503 VALUES LESS THAN (UNIX_TIMESTAMP('2025-04-01')),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);

-- 显示执行结果
SELECT 'V3.1 optimization schema created successfully!' as status;
SELECT COUNT(*) as params_count FROM v3_1_strategy_params;

