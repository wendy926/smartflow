-- 四阶段聪明钱检测数据库表结构
-- 基于smartmoney.md文档的四阶段状态机设计

USE trading_system;

-- 1. 四阶段聪明钱检测结果表
CREATE TABLE IF NOT EXISTS four_phase_smart_money_results (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL COMMENT '交易对符号',
    timestamp BIGINT NOT NULL COMMENT '检测时间戳(ms)',
    
    -- 四阶段状态信息
    current_stage ENUM('neutral', 'accumulation', 'markup', 'distribution', 'markdown') NOT NULL DEFAULT 'neutral' COMMENT '当前阶段',
    stage_confidence DECIMAL(5,4) NOT NULL DEFAULT 0.0000 COMMENT '阶段置信度(0-1)',
    stage_duration_ms BIGINT DEFAULT 0 COMMENT '当前阶段持续时间(ms)',
    
    -- 各阶段得分
    accumulation_score INT DEFAULT 0 COMMENT '吸筹阶段得分',
    markup_score INT DEFAULT 0 COMMENT '拉升阶段得分', 
    distribution_score INT DEFAULT 0 COMMENT '派发阶段得分',
    markdown_score INT DEFAULT 0 COMMENT '砸盘阶段得分',
    
    -- 触发原因
    trigger_reasons JSON DEFAULT NULL COMMENT '触发原因列表',
    
    -- 技术指标
    obi_value DECIMAL(20,8) DEFAULT 0 COMMENT 'OBI值',
    obi_zscore DECIMAL(8,4) DEFAULT 0 COMMENT 'OBI Z-Score',
    cvd_zscore DECIMAL(8,4) DEFAULT 0 COMMENT 'CVD Z-Score',
    volume_ratio DECIMAL(8,4) DEFAULT 0 COMMENT '成交量比率',
    delta_15m DECIMAL(8,4) DEFAULT 0 COMMENT '15分钟Delta',
    price_drop_pct DECIMAL(8,4) DEFAULT 0 COMMENT '价格跌幅百分比',
    atr_15m DECIMAL(20,8) DEFAULT 0 COMMENT '15分钟ATR',
    
    -- 大额挂单信息
    large_orders_count INT DEFAULT 0 COMMENT '大额挂单数量',
    large_buy_orders INT DEFAULT 0 COMMENT '大额买单数量',
    large_sell_orders INT DEFAULT 0 COMMENT '大额卖单数量',
    
    -- 原始数据
    raw_indicators JSON DEFAULT NULL COMMENT '原始指标数据',
    detection_data JSON DEFAULT NULL COMMENT '检测过程数据',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    INDEX idx_symbol_timestamp (symbol, timestamp),
    INDEX idx_current_stage (current_stage),
    INDEX idx_stage_confidence (stage_confidence),
    INDEX idx_created_at (created_at),
    UNIQUE KEY uk_symbol_timestamp (symbol, timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='四阶段聪明钱检测结果表';

-- 2. 四阶段状态变化历史表
CREATE TABLE IF NOT EXISTS four_phase_stage_transitions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL COMMENT '交易对符号',
    from_stage ENUM('neutral', 'accumulation', 'markup', 'distribution', 'markdown') DEFAULT NULL COMMENT '源阶段',
    to_stage ENUM('neutral', 'accumulation', 'markup', 'distribution', 'markdown') NOT NULL COMMENT '目标阶段',
    transition_time BIGINT NOT NULL COMMENT '状态转换时间戳(ms)',
    transition_duration_ms BIGINT DEFAULT 0 COMMENT '源阶段持续时间(ms)',
    transition_confidence DECIMAL(5,4) DEFAULT 0.0000 COMMENT '转换置信度',
    transition_reasons JSON DEFAULT NULL COMMENT '转换原因',
    
    -- 转换时的市场状态
    price_at_transition DECIMAL(20,8) DEFAULT 0 COMMENT '转换时价格',
    volume_at_transition DECIMAL(20,8) DEFAULT 0 COMMENT '转换时成交量',
    obi_at_transition DECIMAL(20,8) DEFAULT 0 COMMENT '转换时OBI',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
    
    INDEX idx_symbol_transition (symbol, transition_time),
    INDEX idx_from_to_stage (from_stage, to_stage),
    INDEX idx_transition_time (transition_time),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='四阶段状态转换历史表';

-- 3. 四阶段聪明钱参数配置表（复用strategy_params表）
INSERT INTO strategy_params (param_name, param_value, param_type, category, description) VALUES
-- 时间窗口参数
('fpsm_cvd_window_ms', '14400000', 'number', 'four_phase_smart_money', 'CVD窗口时间(毫秒，默认4小时)'),
('fpsm_recent_vol_candles', '20', 'number', 'four_phase_smart_money', '成交量计算K线数量'),
('fpsm_obi_top_n', '50', 'number', 'four_phase_smart_money', 'OBI计算深度档位数'),
('fpsm_persistence_sec', '10', 'number', 'four_phase_smart_money', '大单持续判定时间(秒)'),

-- 阈值参数
('fpsm_obi_z_pos', '0.8', 'number', 'four_phase_smart_money', 'OBI正向阈值'),
('fpsm_obi_z_neg', '-0.8', 'number', 'four_phase_smart_money', 'OBI负向阈值'),
('fpsm_cvd_z_up', '0.5', 'number', 'four_phase_smart_money', 'CVD上升阈值'),
('fpsm_cvd_z_down', '-1.0', 'number', 'four_phase_smart_money', 'CVD下降阈值'),
('fpsm_vol_factor_acc', '1.2', 'number', 'four_phase_smart_money', '吸筹阶段成交量倍数'),
('fpsm_vol_factor_break', '1.4', 'number', 'four_phase_smart_money', '突破阶段成交量倍数'),
('fpsm_delta_th', '0.04', 'number', 'four_phase_smart_money', 'Delta阈值'),
('fpsm_impact_ratio_th', '0.20', 'number', 'four_phase_smart_money', '影响力比率阈值'),
('fpsm_large_order_abs', '100000000', 'number', 'four_phase_smart_money', '大单绝对阈值(USD)'),
('fpsm_sweep_pct', '0.3', 'number', 'four_phase_smart_money', '扫荡百分比阈值'),
('fpsm_price_drop_pct_window', '0.03', 'number', 'four_phase_smart_money', '价格跌幅窗口阈值'),
('fpsm_min_stage_lock_mins', '180', 'number', 'four_phase_smart_money', '最小阶段锁定时间(分钟)'),

-- 阶段判定阈值
('fpsm_min_accumulation_score', '3', 'number', 'four_phase_smart_money', '吸筹阶段最小得分'),
('fpsm_min_markup_score', '3', 'number', 'four_phase_smart_money', '拉升阶段最小得分'),
('fpsm_min_distribution_score', '2', 'number', 'four_phase_smart_money', '派发阶段最小得分'),
('fpsm_min_markdown_score', '3', 'number', 'four_phase_smart_money', '砸盘阶段最小得分'),

-- 检测频率参数
('fpsm_detection_interval_sec', '900', 'number', 'four_phase_smart_money', '检测间隔(秒，默认15分钟)'),
('fpsm_data_retention_days', '30', 'number', 'four_phase_smart_money', '数据保留天数'),

-- 告警参数
('fpsm_alert_confidence_threshold', '0.8', 'number', 'four_phase_smart_money', '告警置信度阈值'),
('fpsm_alert_cooldown_minutes', '60', 'number', 'four_phase_smart_money', '告警冷却时间(分钟)')

ON DUPLICATE KEY UPDATE 
    param_value = VALUES(param_value),
    updated_at = CURRENT_TIMESTAMP;

-- 4. 四阶段聪明钱监控配置表
CREATE TABLE IF NOT EXISTS four_phase_monitor_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL COMMENT '交易对符号',
    is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用监控',
    alert_enabled TINYINT(1) DEFAULT 1 COMMENT '是否启用告警',
    confidence_threshold DECIMAL(5,4) DEFAULT 0.8000 COMMENT '告警置信度阈值',
    cooldown_minutes INT DEFAULT 60 COMMENT '告警冷却时间(分钟)',
    
    -- 阶段特定配置
    accumulation_alerts TINYINT(1) DEFAULT 1 COMMENT '吸筹阶段告警',
    markup_alerts TINYINT(1) DEFAULT 1 COMMENT '拉升阶段告警',
    distribution_alerts TINYINT(1) DEFAULT 1 COMMENT '派发阶段告警',
    markdown_alerts TINYINT(1) DEFAULT 1 COMMENT '砸盘阶段告警',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    UNIQUE KEY uk_symbol (symbol),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='四阶段聪明钱监控配置表';

-- 5. 插入默认监控配置
INSERT INTO four_phase_monitor_config (symbol, is_active, alert_enabled) VALUES
('BTCUSDT', 1, 1),
('ETHUSDT', 1, 1),
('SOLUSDT', 1, 1),
('XRPUSDT', 1, 1),
('ADAUSDT', 1, 1)
ON DUPLICATE KEY UPDATE 
    is_active = VALUES(is_active),
    alert_enabled = VALUES(alert_enabled),
    updated_at = CURRENT_TIMESTAMP;

-- 6. 创建数据清理存储过程
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS CleanFourPhaseData()
BEGIN
    DECLARE retention_days INT DEFAULT 30;
    
    -- 获取保留天数配置
    SELECT CAST(param_value AS UNSIGNED) INTO retention_days 
    FROM strategy_params 
    WHERE param_name = 'fpsm_data_retention_days' AND category = 'four_phase_smart_money';
    
    -- 清理过期检测结果
    DELETE FROM four_phase_smart_money_results 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL retention_days DAY);
    
    -- 清理过期状态转换记录
    DELETE FROM four_phase_stage_transitions 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL retention_days DAY);
    
    -- 记录清理结果
    SELECT 
        'Four Phase Data Cleanup' as operation,
        NOW() as cleanup_time,
        retention_days as retention_days,
        ROW_COUNT() as deleted_records;
END //
DELIMITER ;
