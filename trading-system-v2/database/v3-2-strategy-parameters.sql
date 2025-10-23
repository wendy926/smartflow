-- V3.2策略参数配置
-- 基于v3-optimize.md文档建议的改进方案
-- 复用现有strategy_params表结构

USE trading_system;

-- 清理旧的V3.2参数（如果存在）
DELETE FROM strategy_params WHERE strategy_name = 'V3.2';

-- V3.2 AGGRESSIVE 模式参数
INSERT INTO strategy_params (strategy_name, strategy_mode, param_group, param_name, param_value, param_type, category, description, unit, min_value, max_value, is_active) VALUES

-- 1. 早期趋势探测优化参数
('V3.2', 'AGGRESSIVE', 'early_trend', 'earlyTrendWeightBonus', '0.05', 'number', 'early_trend', '早期趋势权重奖励（降低）', '', '0.01', '0.1', 1),
('V3.2', 'AGGRESSIVE', 'early_trend', 'earlyTrendDelayBars', '2', 'number', 'early_trend', '早期趋势延迟确认K线数', '根', '1', '5', 1),
('V3.2', 'AGGRESSIVE', 'early_trend', 'earlyTrendMacdDivergence', 'true', 'boolean', 'early_trend', '启用MACD背离确认', '', 'false', 'true', 1),

-- 2. 假突破过滤器优化参数
('V3.2', 'AGGRESSIVE', 'fake_breakout', 'volFactor', '1.1', 'number', 'fake_breakout', '成交量因子（放宽）', '倍', '1.0', '2.0', 1),
('V3.2', 'AGGRESSIVE', 'fake_breakout', 'reclaimPct', '0.006', 'number', 'fake_breakout', '回撤容忍度（放宽）', '%', '0.001', '0.01', 1),
('V3.2', 'AGGRESSIVE', 'fake_breakout', 'trendScoreThreshold', '8', 'number', 'fake_breakout', '趋势评分阈值（弱化过滤）', '分', '5', '10', 1),

-- 3. 动态止损优化参数
('V3.2', 'AGGRESSIVE', 'dynamic_stop', 'kEntryHigh', '1.8', 'number', 'dynamic_stop', '高置信度止损ATR倍数（放宽）', '倍', '1.0', '3.0', 1),
('V3.2', 'AGGRESSIVE', 'dynamic_stop', 'kEntryMed', '2.0', 'number', 'dynamic_stop', '中置信度止损ATR倍数', '倍', '1.5', '3.0', 1),
('V3.2', 'AGGRESSIVE', 'dynamic_stop', 'kEntryLow', '2.2', 'number', 'dynamic_stop', '低置信度止损ATR倍数', '倍', '2.0', '3.5', 1),
('V3.2', 'AGGRESSIVE', 'dynamic_stop', 'profitTrigger', '1.5', 'number', 'dynamic_stop', '追踪止盈触发倍数（延迟）', '倍', '1.0', '2.0', 1),
('V3.2', 'AGGRESSIVE', 'dynamic_stop', 'trailStep', '0.8', 'number', 'dynamic_stop', '追踪止盈步长（放宽）', '倍', '0.3', '1.0', 1),

-- 4. 动态权重优化参数
('V3.2', 'AGGRESSIVE', 'dynamic_weight', 'minEntryWeight', '0.25', 'number', 'dynamic_weight', '最小入场权重', '', '0.1', '0.4', 1),
('V3.2', 'AGGRESSIVE', 'dynamic_weight', 'trendWeightMax', '0.45', 'number', 'dynamic_weight', '最大趋势权重', '', '0.3', '0.6', 1),
('V3.2', 'AGGRESSIVE', 'dynamic_weight', 'macdContractionThreshold', '0.3', 'number', 'dynamic_weight', 'MACD收缩检测阈值', '', '0.1', '0.5', 1),

-- 5. 时间止损优化参数
('V3.2', 'AGGRESSIVE', 'time_stop', 'baseTimeStopMinutes', '90', 'number', 'time_stop', '基础时间止损（延长）', '分钟', '60', '180', 1),
('V3.2', 'AGGRESSIVE', 'time_stop', 'trendScoreThreshold', '7', 'number', 'time_stop', '趋势评分阈值（禁用时间止损）', '分', '5', '10', 1),
('V3.2', 'AGGRESSIVE', 'time_stop', 'dynamicTimeStop', 'true', 'boolean', 'time_stop', '启用动态时间止损', '', 'false', 'true', 1),

-- 6. 盈利锁仓优化参数
('V3.2', 'AGGRESSIVE', 'profit_lock', 'lockStepMultiplier', '0.8', 'number', 'profit_lock', '锁仓步长倍数（放宽）', '倍', '0.5', '1.0', 1),
('V3.2', 'AGGRESSIVE', 'profit_lock', 'maxLockLevels', '5', 'number', 'profit_lock', '最大锁仓层级', '层', '3', '10', 1);

-- V3.2 BALANCED 模式参数
INSERT INTO strategy_params (strategy_name, strategy_mode, param_group, param_name, param_value, param_type, category, description, unit, min_value, max_value, is_active) VALUES

-- 1. 早期趋势探测优化参数
('V3.2', 'BALANCED', 'early_trend', 'earlyTrendWeightBonus', '0.03', 'number', 'early_trend', '早期趋势权重奖励（降低）', '', '0.01', '0.1', 1),
('V3.2', 'BALANCED', 'early_trend', 'earlyTrendDelayBars', '3', 'number', 'early_trend', '早期趋势延迟确认K线数', '根', '1', '5', 1),
('V3.2', 'BALANCED', 'early_trend', 'earlyTrendMacdDivergence', 'true', 'boolean', 'early_trend', '启用MACD背离确认', '', 'false', 'true', 1),

-- 2. 假突破过滤器优化参数
('V3.2', 'BALANCED', 'fake_breakout', 'volFactor', '1.15', 'number', 'fake_breakout', '成交量因子（放宽）', '倍', '1.0', '2.0', 1),
('V3.2', 'BALANCED', 'fake_breakout', 'reclaimPct', '0.005', 'number', 'fake_breakout', '回撤容忍度（放宽）', '%', '0.001', '0.01', 1),
('V3.2', 'BALANCED', 'fake_breakout', 'trendScoreThreshold', '7', 'number', 'fake_breakout', '趋势评分阈值（弱化过滤）', '分', '5', '10', 1),

-- 3. 动态止损优化参数
('V3.2', 'BALANCED', 'dynamic_stop', 'kEntryHigh', '2.0', 'number', 'dynamic_stop', '高置信度止损ATR倍数（放宽）', '倍', '1.0', '3.0', 1),
('V3.2', 'BALANCED', 'dynamic_stop', 'kEntryMed', '2.2', 'number', 'dynamic_stop', '中置信度止损ATR倍数', '倍', '1.5', '3.0', 1),
('V3.2', 'BALANCED', 'dynamic_stop', 'kEntryLow', '2.5', 'number', 'dynamic_stop', '低置信度止损ATR倍数', '倍', '2.0', '3.5', 1),
('V3.2', 'BALANCED', 'dynamic_stop', 'profitTrigger', '1.5', 'number', 'dynamic_stop', '追踪止盈触发倍数（延迟）', '倍', '1.0', '2.0', 1),
('V3.2', 'BALANCED', 'dynamic_stop', 'trailStep', '0.8', 'number', 'dynamic_stop', '追踪止盈步长（放宽）', '倍', '0.3', '1.0', 1),

-- 4. 动态权重优化参数
('V3.2', 'BALANCED', 'dynamic_weight', 'minEntryWeight', '0.25', 'number', 'dynamic_weight', '最小入场权重', '', '0.1', '0.4', 1),
('V3.2', 'BALANCED', 'dynamic_weight', 'trendWeightMax', '0.45', 'number', 'dynamic_weight', '最大趋势权重', '', '0.3', '0.6', 1),
('V3.2', 'BALANCED', 'dynamic_weight', 'macdContractionThreshold', '0.25', 'number', 'dynamic_weight', 'MACD收缩检测阈值', '', '0.1', '0.5', 1),

-- 5. 时间止损优化参数
('V3.2', 'BALANCED', 'time_stop', 'baseTimeStopMinutes', '105', 'number', 'time_stop', '基础时间止损（延长）', '分钟', '60', '180', 1),
('V3.2', 'BALANCED', 'time_stop', 'trendScoreThreshold', '7', 'number', 'time_stop', '趋势评分阈值（禁用时间止损）', '分', '5', '10', 1),
('V3.2', 'BALANCED', 'time_stop', 'dynamicTimeStop', 'true', 'boolean', 'time_stop', '启用动态时间止损', '', 'false', 'true', 1),

-- 6. 盈利锁仓优化参数
('V3.2', 'BALANCED', 'profit_lock', 'lockStepMultiplier', '0.8', 'number', 'profit_lock', '锁仓步长倍数（放宽）', '倍', '0.5', '1.0', 1),
('V3.2', 'BALANCED', 'profit_lock', 'maxLockLevels', '4', 'number', 'profit_lock', '最大锁仓层级', '层', '3', '10', 1);

-- V3.2 CONSERVATIVE 模式参数
INSERT INTO strategy_params (strategy_name, strategy_mode, param_group, param_name, param_value, param_type, category, description, unit, min_value, max_value, is_active) VALUES

-- 1. 早期趋势探测优化参数
('V3.2', 'CONSERVATIVE', 'early_trend', 'earlyTrendWeightBonus', '0.02', 'number', 'early_trend', '早期趋势权重奖励（降低）', '', '0.01', '0.1', 1),
('V3.2', 'CONSERVATIVE', 'early_trend', 'earlyTrendDelayBars', '4', 'number', 'early_trend', '早期趋势延迟确认K线数', '根', '1', '5', 1),
('V3.2', 'CONSERVATIVE', 'early_trend', 'earlyTrendMacdDivergence', 'true', 'boolean', 'early_trend', '启用MACD背离确认', '', 'false', 'true', 1),

-- 2. 假突破过滤器优化参数
('V3.2', 'CONSERVATIVE', 'fake_breakout', 'volFactor', '1.2', 'number', 'fake_breakout', '成交量因子（放宽）', '倍', '1.0', '2.0', 1),
('V3.2', 'CONSERVATIVE', 'fake_breakout', 'reclaimPct', '0.004', 'number', 'fake_breakout', '回撤容忍度（放宽）', '%', '0.001', '0.01', 1),
('V3.2', 'CONSERVATIVE', 'fake_breakout', 'trendScoreThreshold', '6', 'number', 'fake_breakout', '趋势评分阈值（弱化过滤）', '分', '5', '10', 1),

-- 3. 动态止损优化参数
('V3.2', 'CONSERVATIVE', 'dynamic_stop', 'kEntryHigh', '2.2', 'number', 'dynamic_stop', '高置信度止损ATR倍数（放宽）', '倍', '1.0', '3.0', 1),
('V3.2', 'CONSERVATIVE', 'dynamic_stop', 'kEntryMed', '2.5', 'number', 'dynamic_stop', '中置信度止损ATR倍数', '倍', '1.5', '3.0', 1),
('V3.2', 'CONSERVATIVE', 'dynamic_stop', 'kEntryLow', '2.8', 'number', 'dynamic_stop', '低置信度止损ATR倍数', '倍', '2.0', '3.5', 1),
('V3.2', 'CONSERVATIVE', 'dynamic_stop', 'profitTrigger', '1.5', 'number', 'dynamic_stop', '追踪止盈触发倍数（延迟）', '倍', '1.0', '2.0', 1),
('V3.2', 'CONSERVATIVE', 'dynamic_stop', 'trailStep', '0.8', 'number', 'dynamic_stop', '追踪止盈步长（放宽）', '倍', '0.3', '1.0', 1),

-- 4. 动态权重优化参数
('V3.2', 'CONSERVATIVE', 'dynamic_weight', 'minEntryWeight', '0.25', 'number', 'dynamic_weight', '最小入场权重', '', '0.1', '0.4', 1),
('V3.2', 'CONSERVATIVE', 'dynamic_weight', 'trendWeightMax', '0.45', 'number', 'dynamic_weight', '最大趋势权重', '', '0.3', '0.6', 1),
('V3.2', 'CONSERVATIVE', 'dynamic_weight', 'macdContractionThreshold', '0.2', 'number', 'dynamic_weight', 'MACD收缩检测阈值', '', '0.1', '0.5', 1),

-- 5. 时间止损优化参数
('V3.2', 'CONSERVATIVE', 'time_stop', 'baseTimeStopMinutes', '120', 'number', 'time_stop', '基础时间止损（延长）', '分钟', '60', '180', 1),
('V3.2', 'CONSERVATIVE', 'time_stop', 'trendScoreThreshold', '6', 'number', 'time_stop', '趋势评分阈值（禁用时间止损）', '分', '5', '10', 1),
('V3.2', 'CONSERVATIVE', 'time_stop', 'dynamicTimeStop', 'true', 'boolean', 'time_stop', '启用动态时间止损', '', 'false', 'true', 1),

-- 6. 盈利锁仓优化参数
('V3.2', 'CONSERVATIVE', 'profit_lock', 'lockStepMultiplier', '0.8', 'number', 'profit_lock', '锁仓步长倍数（放宽）', '倍', '0.5', '1.0', 1),
('V3.2', 'CONSERVATIVE', 'profit_lock', 'maxLockLevels', '3', 'number', 'profit_lock', '最大锁仓层级', '层', '3', '10', 1);

-- 创建V3.2策略执行日志表（复用现有表结构）
CREATE TABLE IF NOT EXISTS v3_2_strategy_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL COMMENT '交易对',
    strategy_mode VARCHAR(20) NOT NULL COMMENT '策略模式',
    signal_type VARCHAR(20) NOT NULL COMMENT '信号类型',
    trend_score DECIMAL(5, 2) DEFAULT 0.00 COMMENT '趋势评分',
    factor_score DECIMAL(5, 2) DEFAULT 0.00 COMMENT '因子评分',
    entry_score DECIMAL(5, 2) DEFAULT 0.00 COMMENT '入场评分',
    total_score DECIMAL(5, 2) DEFAULT 0.00 COMMENT '总评分',
    early_trend_detected BOOLEAN DEFAULT FALSE COMMENT '早期趋势检测',
    fake_breakout_passed BOOLEAN DEFAULT FALSE COMMENT '假突破过滤通过',
    confidence_level VARCHAR(10) DEFAULT 'med' COMMENT '置信度等级',
    stop_loss_atr_multiplier DECIMAL(5, 2) DEFAULT 0.00 COMMENT '止损ATR倍数',
    profit_trigger_multiplier DECIMAL(5, 2) DEFAULT 0.00 COMMENT '止盈触发倍数',
    time_stop_minutes INT DEFAULT 0 COMMENT '时间止损分钟数',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_symbol_time (symbol, created_at),
    INDEX idx_strategy_mode (strategy_mode),
    INDEX idx_signal_type (signal_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='V3.2策略执行日志表';
