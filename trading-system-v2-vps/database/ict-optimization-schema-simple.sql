-- ICT策略第二次优化数据库表结构变更（简化版）
-- 基于ict-plus.md中的第二次优化需求

USE trading_system;

-- 1. 扩展策略判断记录表，添加谐波形态和吞没强度字段
ALTER TABLE strategy_judgments 
ADD COLUMN harmonic_type ENUM('NONE', 'CYPHER', 'BAT', 'SHARK') DEFAULT 'NONE' COMMENT '谐波形态类型',
ADD COLUMN harmonic_score DECIMAL(5, 4) DEFAULT 0.0000 COMMENT '谐波形态得分(0-1)',
ADD COLUMN harmonic_rmse DECIMAL(8, 6) DEFAULT NULL COMMENT '谐波形态RMSE值',
ADD COLUMN engulfing_strength DECIMAL(5, 4) DEFAULT 0.0000 COMMENT '吞没形态强度(0-1)',
ADD COLUMN confirmation_bars INT DEFAULT 0 COMMENT '确认等待K线数',
ADD COLUMN confirmation_status ENUM('PENDING', 'CONFIRMED', 'FAILED') DEFAULT 'PENDING' COMMENT '确认状态',
ADD COLUMN adaptive_stop_multiplier DECIMAL(5, 3) DEFAULT 2.000 COMMENT '自适应止损倍数',
ADD COLUMN position_size_usd DECIMAL(15, 2) DEFAULT 0.00 COMMENT '仓位大小(USD)',
ADD COLUMN historical_win_rate DECIMAL(5, 4) DEFAULT 0.5000 COMMENT '历史胜率',
ADD COLUMN total_confidence DECIMAL(5, 4) DEFAULT 0.0000 COMMENT '总置信度(0-1)',
ADD COLUMN gate_passed BOOLEAN DEFAULT FALSE COMMENT '门槛是否通过',
ADD COLUMN secondary_passed BOOLEAN DEFAULT FALSE COMMENT '次要条件是否通过',
ADD COLUMN sweep_direction ENUM('NONE', 'BELOW', 'ABOVE') DEFAULT 'NONE' COMMENT '扫荡方向',
ADD COLUMN sweep_confidence DECIMAL(5, 4) DEFAULT 0.0000 COMMENT '扫荡置信度',
ADD COLUMN order_block_valid BOOLEAN DEFAULT FALSE COMMENT '订单块是否有效',
ADD COLUMN order_block_swept BOOLEAN DEFAULT FALSE COMMENT '订单块是否被扫荡',
ADD COLUMN order_block_reentry BOOLEAN DEFAULT FALSE COMMENT '订单块是否重新进入';

-- 2. 创建ICT策略遥测数据表
CREATE TABLE IF NOT EXISTS ict_telemetry (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    symbol_id INT NOT NULL COMMENT '交易对ID',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '时间戳',
    total_score DECIMAL(5, 2) NOT NULL COMMENT '总得分',
    confidence DECIMAL(5, 4) NOT NULL COMMENT '置信度(0-1)',
    trend VARCHAR(10) NOT NULL COMMENT '趋势方向',
    order_block_data JSON COMMENT '订单块数据',
    sweep_data JSON COMMENT '扫荡数据',
    engulfing_data JSON COMMENT '吞没形态数据',
    harmonic_data JSON COMMENT '谐波形态数据',
    atr_15m DECIMAL(20, 8) DEFAULT NULL COMMENT '15M ATR值',
    stop_multiplier DECIMAL(5, 3) DEFAULT NULL COMMENT '止损倍数',
    position_usd DECIMAL(15, 2) DEFAULT NULL COMMENT '仓位大小(USD)',
    signal_direction VARCHAR(10) DEFAULT NULL COMMENT '信号方向',
    gate_passed BOOLEAN DEFAULT FALSE COMMENT '门槛通过',
    secondary_passed BOOLEAN DEFAULT FALSE COMMENT '次要条件通过',
    confirmation_status VARCHAR(20) DEFAULT NULL COMMENT '确认状态',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_symbol_timestamp (symbol_id, timestamp),
    INDEX idx_created_at (created_at),
    INDEX idx_total_score (total_score),
    INDEX idx_confidence (confidence),
    FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ICT策略遥测数据表';

-- 3. 创建ICT策略历史胜率统计表
CREATE TABLE IF NOT EXISTS ict_win_rate_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    symbol_id INT NOT NULL COMMENT '交易对ID',
    timeframe ENUM('1D', '4H', '15M') NOT NULL COMMENT '时间框架',
    period_start TIMESTAMP NOT NULL COMMENT '统计周期开始',
    period_end TIMESTAMP NOT NULL COMMENT '统计周期结束',
    total_trades INT DEFAULT 0 COMMENT '总交易数',
    winning_trades INT DEFAULT 0 COMMENT '盈利交易数',
    losing_trades INT DEFAULT 0 COMMENT '亏损交易数',
    win_rate DECIMAL(5, 4) DEFAULT 0.0000 COMMENT '胜率(0-1)',
    avg_pnl DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '平均盈亏',
    total_pnl DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '总盈亏',
    max_drawdown DECIMAL(10, 4) DEFAULT 0.0000 COMMENT '最大回撤',
    sharpe_ratio DECIMAL(8, 4) DEFAULT 0.0000 COMMENT '夏普比率',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_symbol_timeframe (symbol_id, timeframe),
    INDEX idx_period (period_start, period_end),
    INDEX idx_win_rate (win_rate),
    FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ICT策略历史胜率统计表';

-- 4. 创建ICT策略参数配置表
CREATE TABLE IF NOT EXISTS ict_strategy_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    parameter_name VARCHAR(50) NOT NULL UNIQUE COMMENT '参数名称',
    parameter_value DECIMAL(10, 6) NOT NULL COMMENT '参数值',
    parameter_type ENUM('FLOAT', 'INT', 'BOOLEAN', 'STRING') NOT NULL COMMENT '参数类型',
    description TEXT COMMENT '参数描述',
    min_value DECIMAL(10, 6) DEFAULT NULL COMMENT '最小值',
    max_value DECIMAL(10, 6) DEFAULT NULL COMMENT '最大值',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否激活',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_parameter_name (parameter_name),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ICT策略参数配置表';

-- 5. 插入默认参数配置
INSERT INTO ict_strategy_config (parameter_name, parameter_value, parameter_type, description, min_value, max_value) VALUES
('min_engulf_strength', 0.6000, 'FLOAT', '最小吞没形态强度阈值', 0.0000, 1.0000),
('min_harmonic_score', 0.6000, 'FLOAT', '最小谐波形态得分阈值', 0.0000, 1.0000),
('confirmation_bars', 2.0000, 'INT', '确认等待K线数', 1.0000, 3.0000),
('min_stop_multiplier', 1.5000, 'FLOAT', '最小止损倍数', 1.0000, 3.0000),
('max_stop_multiplier', 2.5000, 'FLOAT', '最大止损倍数', 1.0000, 5.0000),
('base_risk_percent', 0.1000, 'FLOAT', '基础风险百分比', 0.0100, 1.0000),
('max_risk_percent', 0.5000, 'FLOAT', '最大风险百分比', 0.1000, 2.0000),
('order_block_max_age', 12.0000, 'INT', '订单块最大年龄(4H K线数)', 6.0000, 24.0000),
('sweep_lookback_bars', 8.0000, 'INT', '扫荡检测回看K线数', 4.0000, 16.0000),
('harmonic_lookback_bars', 120.0000, 'INT', '谐波检测回看K线数', 60.0000, 200.0000),
('volume_expansion_multiplier', 1.5000, 'FLOAT', '成交量放大倍数', 1.2000, 2.0000),
('trend_change_threshold', 0.0200, 'FLOAT', '趋势变化阈值', 0.0100, 0.0500);

-- 6. 创建索引优化查询性能
CREATE INDEX idx_strategy_judgments_harmonic ON strategy_judgments(harmonic_type, harmonic_score);
CREATE INDEX idx_strategy_judgments_engulfing ON strategy_judgments(engulfing_strength);
CREATE INDEX idx_strategy_judgments_confidence ON strategy_judgments(total_confidence);
CREATE INDEX idx_strategy_judgments_gate ON strategy_judgments(gate_passed, secondary_passed);
CREATE INDEX idx_strategy_judgments_sweep ON strategy_judgments(sweep_direction, sweep_confidence);
