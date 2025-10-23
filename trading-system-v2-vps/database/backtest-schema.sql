-- 策略参数化回测数据库扩展
-- 扩展现有表结构，支持180天历史数据回测

USE trading_system;

-- 1. 扩展 strategy_parameter_backtest_results 表，添加更多回测指标
ALTER TABLE strategy_parameter_backtest_results
ADD COLUMN backtest_start_date DATE COMMENT '回测开始日期',
ADD COLUMN backtest_end_date DATE COMMENT '回测结束日期',
ADD COLUMN total_days INT DEFAULT 180 COMMENT '回测天数',
ADD COLUMN profit_factor DECIMAL(10, 4) DEFAULT 0.0000 COMMENT '盈利因子',
ADD COLUMN avg_trade_duration DECIMAL(10, 2) DEFAULT 0.00 COMMENT '平均持仓时长(小时)',
ADD COLUMN max_consecutive_wins INT DEFAULT 0 COMMENT '最大连续盈利次数',
ADD COLUMN max_consecutive_losses INT DEFAULT 0 COMMENT '最大连续亏损次数',
ADD COLUMN total_fees DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '总手续费',
ADD COLUMN net_profit DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '净利润(扣除手续费)',
ADD COLUMN backtest_status ENUM('RUNNING', 'COMPLETED', 'FAILED') DEFAULT 'RUNNING' COMMENT '回测状态',
ADD COLUMN backtest_config JSON COMMENT '回测配置参数',
ADD COLUMN error_message TEXT COMMENT '错误信息';

-- 2. 创建回测交易记录表（复用现有simulation_trades表结构）
CREATE TABLE IF NOT EXISTS backtest_trades (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    backtest_id INT NOT NULL COMMENT '回测ID',
    strategy_name VARCHAR(20) NOT NULL COMMENT '策略名称',
    strategy_mode VARCHAR(20) NOT NULL COMMENT '策略模式',
    symbol VARCHAR(20) NOT NULL COMMENT '交易对',
    trade_type ENUM('LONG', 'SHORT') NOT NULL COMMENT '交易类型',
    entry_time TIMESTAMP NOT NULL COMMENT '入场时间',
    exit_time TIMESTAMP NULL COMMENT '出场时间',
    entry_price DECIMAL(20, 8) NOT NULL COMMENT '入场价格',
    exit_price DECIMAL(20, 8) NULL COMMENT '出场价格',
    quantity DECIMAL(20, 8) NOT NULL COMMENT '交易数量',
    pnl DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '盈亏',
    pnl_percent DECIMAL(10, 4) DEFAULT 0.0000 COMMENT '盈亏百分比',
    fees DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '手续费',
    duration_hours DECIMAL(10, 2) DEFAULT 0.00 COMMENT '持仓时长(小时)',
    exit_reason VARCHAR(50) COMMENT '出场原因',
    confidence_score DECIMAL(5, 2) DEFAULT 0.00 COMMENT '置信度分数',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_backtest_strategy (backtest_id, strategy_name, strategy_mode),
    INDEX idx_symbol_time (symbol, entry_time),
    INDEX idx_pnl (pnl),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='回测交易记录表';

-- 3. 创建回测市场数据表（存储180天历史K线数据）
CREATE TABLE IF NOT EXISTS backtest_market_data (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL COMMENT '交易对',
    timeframe VARCHAR(10) NOT NULL COMMENT '时间周期',
    open_time TIMESTAMP NOT NULL COMMENT '开盘时间',
    close_time TIMESTAMP NOT NULL COMMENT '收盘时间',
    open_price DECIMAL(20, 8) NOT NULL COMMENT '开盘价',
    high_price DECIMAL(20, 8) NOT NULL COMMENT '最高价',
    low_price DECIMAL(20, 8) NOT NULL COMMENT '最低价',
    close_price DECIMAL(20, 8) NOT NULL COMMENT '收盘价',
    volume DECIMAL(20, 8) NOT NULL COMMENT '成交量',
    quote_volume DECIMAL(20, 8) NOT NULL COMMENT '成交额',
    trades_count INT DEFAULT 0 COMMENT '成交笔数',
    taker_buy_volume DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '主动买入成交量',
    taker_buy_quote_volume DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '主动买入成交额',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_symbol_timeframe_time (symbol, timeframe, open_time),
    INDEX idx_symbol_timeframe (symbol, timeframe),
    INDEX idx_open_time (open_time),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='回测市场数据表';

-- 4. 创建回测任务表（管理回测任务状态）
CREATE TABLE IF NOT EXISTS backtest_tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    strategy_name VARCHAR(20) NOT NULL COMMENT '策略名称',
    task_type ENUM('SINGLE_MODE', 'ALL_MODES') NOT NULL COMMENT '任务类型',
    target_mode VARCHAR(20) NULL COMMENT '目标模式(单模式任务)',
    status ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED') DEFAULT 'PENDING' COMMENT '任务状态',
    progress_percent DECIMAL(5, 2) DEFAULT 0.00 COMMENT '进度百分比',
    start_time TIMESTAMP NULL COMMENT '开始时间',
    end_time TIMESTAMP NULL COMMENT '结束时间',
    total_days INT DEFAULT 180 COMMENT '回测天数',
    symbols TEXT COMMENT '交易对列表(JSON)',
    error_message TEXT COMMENT '错误信息',
    created_by VARCHAR(50) DEFAULT 'system' COMMENT '创建人',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_strategy_status (strategy_name, status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='回测任务表';

-- 5. 创建回测指标表（存储详细回测指标）
CREATE TABLE IF NOT EXISTS backtest_metrics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    backtest_id INT NOT NULL COMMENT '回测ID',
    strategy_name VARCHAR(20) NOT NULL COMMENT '策略名称',
    strategy_mode VARCHAR(20) NOT NULL COMMENT '策略模式',
    metric_name VARCHAR(50) NOT NULL COMMENT '指标名称',
    metric_value DECIMAL(20, 8) NOT NULL COMMENT '指标值',
    metric_type VARCHAR(20) NOT NULL COMMENT '指标类型(rate/amount/count/ratio)',
    description TEXT COMMENT '指标描述',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_backtest_metric (backtest_id, metric_name),
    INDEX idx_strategy_metric (strategy_name, strategy_mode, metric_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='回测指标表';

-- 6. 添加外键约束
ALTER TABLE backtest_trades 
ADD CONSTRAINT fk_backtest_trades_backtest 
FOREIGN KEY (backtest_id) REFERENCES strategy_parameter_backtest_results(id) ON DELETE CASCADE;

ALTER TABLE backtest_metrics 
ADD CONSTRAINT fk_backtest_metrics_backtest 
FOREIGN KEY (backtest_id) REFERENCES strategy_parameter_backtest_results(id) ON DELETE CASCADE;

-- 7. 创建索引优化查询性能
CREATE INDEX idx_backtest_results_strategy_mode ON strategy_parameter_backtest_results(strategy_name, strategy_mode, created_at);
CREATE INDEX idx_backtest_trades_backtest_symbol ON backtest_trades(backtest_id, symbol);
CREATE INDEX idx_market_data_symbol_timeframe_time ON backtest_market_data(symbol, timeframe, open_time);

-- 8. 插入默认回测配置
INSERT INTO strategy_parameter_backtest_results 
(strategy_name, strategy_mode, backtest_period, total_trades, winning_trades, losing_trades, win_rate, total_pnl, backtest_status, backtest_start_date, backtest_end_date, total_days)
VALUES 
('ICT', 'AGGRESSIVE', '180天', 0, 0, 0, 0.0000, 0.00000000, 'COMPLETED', DATE_SUB(CURDATE(), INTERVAL 180 DAY), CURDATE(), 180),
('ICT', 'BALANCED', '180天', 0, 0, 0, 0.0000, 0.00000000, 'COMPLETED', DATE_SUB(CURDATE(), INTERVAL 180 DAY), CURDATE(), 180),
('ICT', 'CONSERVATIVE', '180天', 0, 0, 0, 0.0000, 0.00000000, 'COMPLETED', DATE_SUB(CURDATE(), INTERVAL 180 DAY), CURDATE(), 180),
('V3', 'AGGRESSIVE', '180天', 0, 0, 0, 0.0000, 0.00000000, 'COMPLETED', DATE_SUB(CURDATE(), INTERVAL 180 DAY), CURDATE(), 180),
('V3', 'BALANCED', '180天', 0, 0, 0, 0.0000, 0.00000000, 'COMPLETED', DATE_SUB(CURDATE(), INTERVAL 180 DAY), CURDATE(), 180),
('V3', 'CONSERVATIVE', '180天', 0, 0, 0, 0.0000, 0.00000000, 'COMPLETED', DATE_SUB(CURDATE(), INTERVAL 180 DAY), CURDATE(), 180);

SELECT 'Backtest schema created successfully!' AS status;
