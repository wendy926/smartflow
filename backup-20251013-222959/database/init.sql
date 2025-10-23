-- 交易系统V2.0数据库初始化脚本
-- 基于database-design.md的设计

-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS trading_system 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE trading_system;

-- 1. 交易对管理表
CREATE TABLE IF NOT EXISTS symbols (
    id INT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL UNIQUE COMMENT '交易对符号',
    status ENUM('ACTIVE', 'INACTIVE', 'MAINTENANCE') DEFAULT 'ACTIVE' COMMENT '状态',
    funding_rate DECIMAL(10, 8) DEFAULT 0.00000000 COMMENT '资金费率',
    last_price DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '最新价格',
    volume_24h DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '24小时成交量',
    price_change_24h DECIMAL(10, 4) DEFAULT 0.0000 COMMENT '24小时价格变化率',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_symbol (symbol),
    INDEX idx_status (status),
    INDEX idx_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='交易对管理表';

-- 2. 策略判断记录表
CREATE TABLE IF NOT EXISTS strategy_judgments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    symbol_id INT NOT NULL COMMENT '交易对ID',
    strategy_name ENUM('V3', 'ICT') NOT NULL COMMENT '策略名称',
    timeframe ENUM('1D', '4H', '1H', '15M') NOT NULL COMMENT '时间级别',
    trend_direction ENUM('RANGE', 'UP', 'DOWN') NOT NULL COMMENT '趋势方向',
    entry_signal ENUM('BUY', 'SELL', 'HOLD') NOT NULL COMMENT '入场信号',
    confidence_score DECIMAL(5, 2) DEFAULT 0.00 COMMENT '置信度分数(0-100)',
    indicators_data JSON COMMENT '指标数据',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_symbol_strategy (symbol_id, strategy_name),
    INDEX idx_timeframe (timeframe),
    INDEX idx_created_at (created_at),
    INDEX idx_trend_direction (trend_direction),
    FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='策略判断记录表';

-- 3. 模拟交易记录表
CREATE TABLE IF NOT EXISTS simulation_trades (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    symbol_id INT NOT NULL COMMENT '交易对ID',
    strategy_name ENUM('V3', 'ICT') NOT NULL COMMENT '策略名称',
    trade_type ENUM('LONG', 'SHORT') NOT NULL COMMENT '交易类型',
    entry_price DECIMAL(20, 8) NOT NULL COMMENT '入场价格',
    exit_price DECIMAL(20, 8) DEFAULT NULL COMMENT '出场价格',
    quantity DECIMAL(20, 8) NOT NULL COMMENT '交易数量',
    leverage DECIMAL(5, 2) DEFAULT 1.00 COMMENT '杠杆倍数',
    margin_used DECIMAL(20, 8) NOT NULL COMMENT '使用保证金',
    stop_loss DECIMAL(20, 8) DEFAULT NULL COMMENT '止损价格',
    take_profit DECIMAL(20, 8) DEFAULT NULL COMMENT '止盈价格',
    pnl DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '盈亏',
    pnl_percentage DECIMAL(10, 4) DEFAULT 0.0000 COMMENT '盈亏百分比',
    status ENUM('OPEN', 'CLOSED', 'STOPPED') DEFAULT 'OPEN' COMMENT '交易状态',
    entry_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '入场时间',
    exit_time TIMESTAMP NULL DEFAULT NULL COMMENT '出场时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_symbol_strategy (symbol_id, strategy_name),
    INDEX idx_status (status),
    INDEX idx_entry_time (entry_time),
    INDEX idx_exit_time (exit_time),
    FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='模拟交易记录表';

-- 4. 系统监控数据表
CREATE TABLE IF NOT EXISTS system_monitoring (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    metric_name VARCHAR(50) NOT NULL COMMENT '指标名称',
    metric_value DECIMAL(10, 4) NOT NULL COMMENT '指标值',
    metric_unit VARCHAR(20) DEFAULT NULL COMMENT '指标单位',
    component VARCHAR(50) NOT NULL COMMENT '组件名称',
    status ENUM('NORMAL', 'WARNING', 'CRITICAL') DEFAULT 'NORMAL' COMMENT '状态',
    details JSON DEFAULT NULL COMMENT '详细信息',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_metric_name (metric_name),
    INDEX idx_component (component),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统监控数据表';

-- 5. 交易对统计表
CREATE TABLE IF NOT EXISTS symbol_statistics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    symbol_id INT NOT NULL COMMENT '交易对ID',
    strategy_name ENUM('V3', 'ICT') NOT NULL COMMENT '策略名称',
    timeframe ENUM('1D', '4H', '1H', '15M') NOT NULL COMMENT '时间级别',
    total_trades INT DEFAULT 0 COMMENT '总交易次数',
    winning_trades INT DEFAULT 0 COMMENT '盈利交易次数',
    losing_trades INT DEFAULT 0 COMMENT '亏损交易次数',
    win_rate DECIMAL(5, 2) DEFAULT 0.00 COMMENT '胜率(%)',
    total_pnl DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '总盈亏',
    avg_pnl DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '平均盈亏',
    max_pnl DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '最大盈利',
    min_pnl DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '最大亏损',
    profit_factor DECIMAL(10, 4) DEFAULT 0.0000 COMMENT '盈利因子',
    sharpe_ratio DECIMAL(10, 4) DEFAULT 0.0000 COMMENT '夏普比率',
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    UNIQUE KEY uk_symbol_strategy_timeframe (symbol_id, strategy_name, timeframe),
    INDEX idx_win_rate (win_rate),
    INDEX idx_total_pnl (total_pnl),
    INDEX idx_last_updated (last_updated),
    FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='交易对统计表';

-- 6. 系统配置表
CREATE TABLE IF NOT EXISTS system_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE COMMENT '配置键',
    config_value TEXT NOT NULL COMMENT '配置值',
    config_type ENUM('STRING', 'NUMBER', 'BOOLEAN', 'JSON') DEFAULT 'STRING' COMMENT '配置类型',
    description TEXT DEFAULT NULL COMMENT '配置描述',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否激活',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_config_key (config_key),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统配置表';

-- 插入初始配置数据
INSERT INTO system_config (config_key, config_value, config_type, description) VALUES
('system_name', 'Trading System V2.0', 'STRING', '系统名称'),
('system_version', '2.0.0', 'STRING', '系统版本'),
('data_retention_days', '60', 'NUMBER', '数据保留天数'),
('strategy_update_interval', '300', 'NUMBER', '策略更新间隔(秒)'),
('monitoring_interval', '30', 'NUMBER', '监控间隔(秒)'),
('cpu_threshold', '60', 'NUMBER', 'CPU使用率阈值(%)'),
('memory_threshold', '60', 'NUMBER', '内存使用率阈值(%)'),
('disk_threshold', '80', 'NUMBER', '磁盘使用率阈值(%)'),
('api_success_threshold', '95', 'NUMBER', 'API成功率阈值(%)'),
('cache_ttl_strategy', '300', 'NUMBER', '策略缓存TTL(秒)'),
('cache_ttl_symbol', '300', 'NUMBER', '交易对缓存TTL(秒)'),
('cache_ttl_statistics', '3600', 'NUMBER', '统计缓存TTL(秒)'),
('cache_ttl_config', '86400', 'NUMBER', '配置缓存TTL(秒)'),
('binance_rate_limit', '1200', 'NUMBER', 'Binance API速率限制(每分钟)'),
('max_symbols_per_batch', '50', 'NUMBER', '每批处理最大交易对数量'),
('strategy_batch_size', '5', 'NUMBER', '策略批处理大小'),
('memory_limit_main', '120', 'NUMBER', '主进程内存限制(MB)'),
('memory_limit_worker', '150', 'NUMBER', '工作进程内存限制(MB)'),
('memory_limit_cleaner', '50', 'NUMBER', '清理进程内存限制(MB)'),
('memory_limit_monitor', '30', 'NUMBER', '监控进程内存限制(MB)'),
('redis_max_memory', '80mb', 'STRING', 'Redis最大内存'),
('mysql_buffer_pool_size', '150M', 'STRING', 'MySQL缓冲池大小'),
('telegram_enabled', 'false', 'BOOLEAN', 'Telegram通知是否启用'),
('telegram_bot_token', '', 'STRING', 'Telegram机器人令牌'),
('telegram_chat_id', '', 'STRING', 'Telegram聊天ID'),
('default_symbols', 'BTCUSDT,ETHUSDT,ONDOUSDT,MKRUSDT,PENDLEUSDT,MPLUSDT,LINKUSDT,LDOUSDT', 'STRING', '默认交易对列表')
ON DUPLICATE KEY UPDATE 
    config_value = VALUES(config_value),
    updated_at = CURRENT_TIMESTAMP;

-- 插入默认交易对数据
INSERT INTO symbols (symbol, status, funding_rate, last_price, volume_24h, price_change_24h) VALUES
('BTCUSDT', 'ACTIVE', 0.00010000, 50000.00000000, 1000000.00000000, 2.5000),
('ETHUSDT', 'ACTIVE', 0.00010000, 3500.00000000, 800000.00000000, 3.2000),
('ONDOUSDT', 'ACTIVE', 0.00010000, 0.25000000, 500000.00000000, 5.5000),
('MKRUSDT', 'ACTIVE', 0.00010000, 2500.00000000, 300000.00000000, 2.8000),
('PENDLEUSDT', 'ACTIVE', 0.00010000, 2.50000000, 400000.00000000, 4.2000),
('MPLUSDT', 'ACTIVE', 0.00010000, 0.15000000, 200000.00000000, -1.5000),
('LINKUSDT', 'ACTIVE', 0.00010000, 15.00000000, 600000.00000000, 1.8000),
('LDOUSDT', 'ACTIVE', 0.00010000, 3.50000000, 350000.00000000, 2.3000)
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    funding_rate = VALUES(funding_rate),
    last_price = VALUES(last_price),
    volume_24h = VALUES(volume_24h),
    price_change_24h = VALUES(price_change_24h),
    updated_at = CURRENT_TIMESTAMP;

-- 创建分区表（按月分区，提高查询性能）
-- 注意：MySQL 5.7+ 支持分区，这里为strategy_judgments表创建分区
ALTER TABLE strategy_judgments 
PARTITION BY RANGE (UNIX_TIMESTAMP(created_at)) (
    PARTITION p202401 VALUES LESS THAN (UNIX_TIMESTAMP('2024-02-01')),
    PARTITION p202402 VALUES LESS THAN (UNIX_TIMESTAMP('2024-03-01')),
    PARTITION p202403 VALUES LESS THAN (UNIX_TIMESTAMP('2024-04-01')),
    PARTITION p202404 VALUES LESS THAN (UNIX_TIMESTAMP('2024-05-01')),
    PARTITION p202405 VALUES LESS THAN (UNIX_TIMESTAMP('2024-06-01')),
    PARTITION p202406 VALUES LESS THAN (UNIX_TIMESTAMP('2024-07-01')),
    PARTITION p202407 VALUES LESS THAN (UNIX_TIMESTAMP('2024-08-01')),
    PARTITION p202408 VALUES LESS THAN (UNIX_TIMESTAMP('2024-09-01')),
    PARTITION p202409 VALUES LESS THAN (UNIX_TIMESTAMP('2024-10-01')),
    PARTITION p202410 VALUES LESS THAN (UNIX_TIMESTAMP('2024-11-01')),
    PARTITION p202411 VALUES LESS THAN (UNIX_TIMESTAMP('2024-12-01')),
    PARTITION p202412 VALUES LESS THAN (UNIX_TIMESTAMP('2025-01-01')),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);

-- 为simulation_trades表创建分区
ALTER TABLE simulation_trades 
PARTITION BY RANGE (UNIX_TIMESTAMP(created_at)) (
    PARTITION p202401 VALUES LESS THAN (UNIX_TIMESTAMP('2024-02-01')),
    PARTITION p202402 VALUES LESS THAN (UNIX_TIMESTAMP('2024-03-01')),
    PARTITION p202403 VALUES LESS THAN (UNIX_TIMESTAMP('2024-04-01')),
    PARTITION p202404 VALUES LESS THAN (UNIX_TIMESTAMP('2024-05-01')),
    PARTITION p202405 VALUES LESS THAN (UNIX_TIMESTAMP('2024-06-01')),
    PARTITION p202406 VALUES LESS THAN (UNIX_TIMESTAMP('2024-07-01')),
    PARTITION p202407 VALUES LESS THAN (UNIX_TIMESTAMP('2024-08-01')),
    PARTITION p202408 VALUES LESS THAN (UNIX_TIMESTAMP('2024-09-01')),
    PARTITION p202409 VALUES LESS THAN (UNIX_TIMESTAMP('2024-10-01')),
    PARTITION p202410 VALUES LESS THAN (UNIX_TIMESTAMP('2024-11-01')),
    PARTITION p202411 VALUES LESS THAN (UNIX_TIMESTAMP('2024-12-01')),
    PARTITION p202412 VALUES LESS THAN (UNIX_TIMESTAMP('2025-01-01')),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);

-- 为system_monitoring表创建分区
ALTER TABLE system_monitoring 
PARTITION BY RANGE (UNIX_TIMESTAMP(created_at)) (
    PARTITION p202401 VALUES LESS THAN (UNIX_TIMESTAMP('2024-02-01')),
    PARTITION p202402 VALUES LESS THAN (UNIX_TIMESTAMP('2024-03-01')),
    PARTITION p202403 VALUES LESS THAN (UNIX_TIMESTAMP('2024-04-01')),
    PARTITION p202404 VALUES LESS THAN (UNIX_TIMESTAMP('2024-05-01')),
    PARTITION p202405 VALUES LESS THAN (UNIX_TIMESTAMP('2024-06-01')),
    PARTITION p202406 VALUES LESS THAN (UNIX_TIMESTAMP('2024-07-01')),
    PARTITION p202407 VALUES LESS THAN (UNIX_TIMESTAMP('2024-08-01')),
    PARTITION p202408 VALUES LESS THAN (UNIX_TIMESTAMP('2024-09-01')),
    PARTITION p202409 VALUES LESS THAN (UNIX_TIMESTAMP('2024-10-01')),
    PARTITION p202410 VALUES LESS THAN (UNIX_TIMESTAMP('2024-11-01')),
    PARTITION p202411 VALUES LESS THAN (UNIX_TIMESTAMP('2024-12-01')),
    PARTITION p202412 VALUES LESS THAN (UNIX_TIMESTAMP('2025-01-01')),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);

-- 创建视图：策略性能概览
CREATE OR REPLACE VIEW strategy_performance_overview AS
SELECT 
    s.symbol,
    sj.strategy_name,
    sj.timeframe,
    COUNT(sj.id) as total_judgments,
    COUNT(CASE WHEN sj.entry_signal = 'BUY' THEN 1 END) as buy_signals,
    COUNT(CASE WHEN sj.entry_signal = 'SELL' THEN 1 END) as sell_signals,
    COUNT(CASE WHEN sj.entry_signal = 'HOLD' THEN 1 END) as hold_signals,
    AVG(sj.confidence_score) as avg_confidence,
    MAX(sj.created_at) as last_judgment
FROM symbols s
JOIN strategy_judgments sj ON s.id = sj.symbol_id
WHERE sj.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY s.symbol, sj.strategy_name, sj.timeframe
ORDER BY s.symbol, sj.strategy_name, sj.timeframe;

-- 创建视图：交易统计概览
CREATE OR REPLACE VIEW trade_statistics_overview AS
SELECT 
    s.symbol,
    st.strategy_name,
    COUNT(st.id) as total_trades,
    COUNT(CASE WHEN st.status = 'CLOSED' THEN 1 END) as closed_trades,
    COUNT(CASE WHEN st.pnl > 0 THEN 1 END) as winning_trades,
    COUNT(CASE WHEN st.pnl < 0 THEN 1 END) as losing_trades,
    ROUND(COUNT(CASE WHEN st.pnl > 0 THEN 1 END) * 100.0 / COUNT(CASE WHEN st.status = 'CLOSED' THEN 1 END), 2) as win_rate,
    SUM(st.pnl) as total_pnl,
    AVG(st.pnl) as avg_pnl,
    MAX(st.pnl) as max_pnl,
    MIN(st.pnl) as min_pnl
FROM symbols s
JOIN simulation_trades st ON s.id = st.symbol_id
WHERE st.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY s.symbol, st.strategy_name
ORDER BY total_pnl DESC;

-- 创建存储过程：清理过期数据
DELIMITER //
CREATE PROCEDURE CleanupExpiredData()
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- 清理60天前的策略判断数据
    DELETE FROM strategy_judgments 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL 60 DAY);
    
    -- 清理90天前的模拟交易数据
    DELETE FROM simulation_trades 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
    
    -- 清理30天前的监控数据
    DELETE FROM system_monitoring 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
    
    -- 优化表
    OPTIMIZE TABLE strategy_judgments;
    OPTIMIZE TABLE simulation_trades;
    OPTIMIZE TABLE system_monitoring;
    
    COMMIT;
END //
DELIMITER ;

-- 创建事件：自动清理过期数据（每天凌晨2点执行）
CREATE EVENT IF NOT EXISTS cleanup_expired_data
ON SCHEDULE EVERY 1 DAY
STARTS TIMESTAMP(CURDATE() + INTERVAL 1 DAY, '02:00:00')
DO
    CALL CleanupExpiredData();

-- 启用事件调度器
SET GLOBAL event_scheduler = ON;

-- 显示创建结果
SELECT 'Database initialization completed successfully!' as status;
SELECT COUNT(*) as symbols_count FROM symbols;
SELECT COUNT(*) as config_count FROM system_config;
