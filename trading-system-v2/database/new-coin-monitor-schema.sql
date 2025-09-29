-- 新币监控模块数据库表结构
-- 基于 new-coin-monitor.md 设计

USE trading_system;

-- 1. 新币基本信息表
CREATE TABLE IF NOT EXISTS new_coins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL UNIQUE COMMENT '交易对符号，如EXAMPLEUSDT',
    name VARCHAR(100) NOT NULL COMMENT '代币名称',
    github_repo VARCHAR(200) DEFAULT NULL COMMENT 'GitHub仓库地址',
    team_score DECIMAL(3,1) DEFAULT 0.0 COMMENT '团队经验分(0-10)',
    supply_total BIGINT DEFAULT 0 COMMENT '代币总量',
    supply_circulation BIGINT DEFAULT 0 COMMENT '流通量',
    vesting_lock_score DECIMAL(3,1) DEFAULT 0.0 COMMENT '锁仓分(0-10)',
    twitter_followers INT DEFAULT 0 COMMENT 'Twitter粉丝数',
    telegram_members INT DEFAULT 0 COMMENT 'Telegram社群成员数',
    status ENUM('ACTIVE', 'INACTIVE', 'MONITORING') DEFAULT 'ACTIVE' COMMENT '监控状态',
    listing_date TIMESTAMP DEFAULT NULL COMMENT '上线日期',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_symbol (symbol),
    INDEX idx_status (status),
    INDEX idx_listing_date (listing_date),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='新币基本信息表';

-- 2. 新币评分记录表
CREATE TABLE IF NOT EXISTS new_coin_scores (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    coin_id INT NOT NULL COMMENT '新币ID',
    tech_score DECIMAL(4,2) DEFAULT 0.00 COMMENT '技术团队评分(0-10)',
    token_score DECIMAL(4,2) DEFAULT 0.00 COMMENT '代币经济评分(0-10)',
    liquidity_score DECIMAL(4,2) DEFAULT 0.00 COMMENT '市场流动性评分(0-10)',
    sentiment_score DECIMAL(4,2) DEFAULT 0.00 COMMENT '市场情绪评分(0-10)',
    total_score DECIMAL(4,2) DEFAULT 0.00 COMMENT '综合评分(0-10)',
    strategy_recommendation VARCHAR(100) DEFAULT NULL COMMENT '策略建议',
    evaluation_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '评分时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_coin_id (coin_id),
    INDEX idx_total_score (total_score),
    INDEX idx_evaluation_time (evaluation_time),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (coin_id) REFERENCES new_coins(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='新币评分记录表';

-- 3. 新币市场数据表
CREATE TABLE IF NOT EXISTS new_coin_market_data (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    coin_id INT NOT NULL COMMENT '新币ID',
    price DECIMAL(20,8) DEFAULT 0.00000000 COMMENT '当前价格',
    volume_24h DECIMAL(20,8) DEFAULT 0.00000000 COMMENT '24小时成交量',
    price_change_24h DECIMAL(10,4) DEFAULT 0.0000 COMMENT '24小时价格变化率',
    high_24h DECIMAL(20,8) DEFAULT 0.00000000 COMMENT '24小时最高价',
    low_24h DECIMAL(20,8) DEFAULT 0.00000000 COMMENT '24小时最低价',
    bid_depth DECIMAL(20,8) DEFAULT 0.00000000 COMMENT '买单深度',
    ask_depth DECIMAL(20,8) DEFAULT 0.00000000 COMMENT '卖单深度',
    volatility_score DECIMAL(4,2) DEFAULT 0.00 COMMENT '波动性评分(0-10)',
    data_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '数据时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_coin_id (coin_id),
    INDEX idx_data_time (data_time),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (coin_id) REFERENCES new_coins(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='新币市场数据表';

-- 4. GitHub数据表
CREATE TABLE IF NOT EXISTS new_coin_github_data (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    coin_id INT NOT NULL COMMENT '新币ID',
    stars_count INT DEFAULT 0 COMMENT 'Stars数量',
    forks_count INT DEFAULT 0 COMMENT 'Forks数量',
    issues_count INT DEFAULT 0 COMMENT 'Issues数量',
    commits_count INT DEFAULT 0 COMMENT '最近30天提交数',
    contributors_count INT DEFAULT 0 COMMENT '贡献者数量',
    last_commit_date TIMESTAMP DEFAULT NULL COMMENT '最后提交时间',
    github_score DECIMAL(4,2) DEFAULT 0.00 COMMENT 'GitHub评分(0-10)',
    data_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '数据时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_coin_id (coin_id),
    INDEX idx_data_time (data_time),
    INDEX idx_github_score (github_score),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (coin_id) REFERENCES new_coins(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='GitHub数据表';

-- 5. 新币监控配置表
CREATE TABLE IF NOT EXISTS new_coin_monitor_config (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='新币监控配置表';

-- 6. 新币监控告警记录表
CREATE TABLE IF NOT EXISTS new_coin_alerts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    coin_id INT NOT NULL COMMENT '新币ID',
    alert_type ENUM('LOW_SCORE', 'HIGH_VOLATILITY', 'LIQUIDITY_WARNING', 'GITHUB_ACTIVITY', 'CUSTOM') NOT NULL COMMENT '告警类型',
    alert_level ENUM('INFO', 'WARNING', 'CRITICAL') DEFAULT 'WARNING' COMMENT '告警级别',
    alert_message TEXT NOT NULL COMMENT '告警消息',
    alert_data JSON DEFAULT NULL COMMENT '告警相关数据',
    is_sent BOOLEAN DEFAULT FALSE COMMENT '是否已发送',
    sent_time TIMESTAMP DEFAULT NULL COMMENT '发送时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_coin_id (coin_id),
    INDEX idx_alert_type (alert_type),
    INDEX idx_alert_level (alert_level),
    INDEX idx_is_sent (is_sent),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (coin_id) REFERENCES new_coins(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='新币监控告警记录表';

-- 插入新币监控模块默认配置
INSERT INTO new_coin_monitor_config (config_key, config_value, config_type, description) VALUES
('monitor_enabled', 'true', 'BOOLEAN', '是否启用新币监控'),
('evaluation_interval', '300', 'NUMBER', '评分更新间隔(秒)'),
('market_data_interval', '60', 'NUMBER', '市场数据更新间隔(秒)'),
('github_data_interval', '3600', 'NUMBER', 'GitHub数据更新间隔(秒)'),
('alert_score_threshold', '7.0', 'NUMBER', '评分告警阈值'),
('alert_volatility_threshold', '0.20', 'NUMBER', '波动性告警阈值'),
('alert_liquidity_threshold', '3.0', 'NUMBER', '流动性告警阈值'),
('github_token', '', 'STRING', 'GitHub API Token'),
('telegram_bot_token', '', 'STRING', 'Telegram Bot Token'),
('telegram_chat_id', '', 'STRING', 'Telegram Chat ID'),
('binance_api_timeout', '10000', 'NUMBER', 'Binance API超时时间(毫秒)'),
('github_api_timeout', '10000', 'NUMBER', 'GitHub API超时时间(毫秒)'),
('max_concurrent_requests', '5', 'NUMBER', '最大并发请求数'),
('data_retention_days', '30', 'NUMBER', '数据保留天数'),
('weight_tech_team', '0.30', 'NUMBER', '技术团队权重'),
('weight_token_economics', '0.25', 'NUMBER', '代币经济权重'),
('weight_liquidity', '0.25', 'NUMBER', '流动性权重'),
('weight_market_sentiment', '0.20', 'NUMBER', '市场情绪权重')
ON DUPLICATE KEY UPDATE 
    config_value = VALUES(config_value),
    updated_at = CURRENT_TIMESTAMP;

-- 为新币评分记录表创建分区（按月分区）
ALTER TABLE new_coin_scores 
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

-- 为新币市场数据表创建分区
ALTER TABLE new_coin_market_data 
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

-- 为新币告警记录表创建分区
ALTER TABLE new_coin_alerts 
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

-- 创建视图：新币监控概览
CREATE OR REPLACE VIEW new_coin_monitor_overview AS
SELECT 
    nc.id,
    nc.symbol,
    nc.name,
    nc.status,
    nc.listing_date,
    ncs.tech_score,
    ncs.token_score,
    ncs.liquidity_score,
    ncs.sentiment_score,
    ncs.total_score,
    ncs.strategy_recommendation,
    ncs.evaluation_time,
    ncmd.price,
    ncmd.volume_24h,
    ncmd.price_change_24h,
    ncmd.volatility_score,
    ncmd.data_time as last_market_update,
    ncgh.stars_count,
    ncgh.forks_count,
    ncgh.github_score,
    ncgh.data_time as last_github_update
FROM new_coins nc
LEFT JOIN (
    SELECT coin_id, 
           tech_score, 
           token_score, 
           liquidity_score, 
           sentiment_score, 
           total_score, 
           strategy_recommendation,
           evaluation_time,
           ROW_NUMBER() OVER (PARTITION BY coin_id ORDER BY evaluation_time DESC) as rn
    FROM new_coin_scores
) ncs ON nc.id = ncs.coin_id AND ncs.rn = 1
LEFT JOIN (
    SELECT coin_id, 
           price, 
           volume_24h, 
           price_change_24h, 
           volatility_score,
           data_time,
           ROW_NUMBER() OVER (PARTITION BY coin_id ORDER BY data_time DESC) as rn
    FROM new_coin_market_data
) ncmd ON nc.id = ncmd.coin_id AND ncmd.rn = 1
LEFT JOIN (
    SELECT coin_id, 
           stars_count, 
           forks_count, 
           github_score,
           data_time,
           ROW_NUMBER() OVER (PARTITION BY coin_id ORDER BY data_time DESC) as rn
    FROM new_coin_github_data
) ncgh ON nc.id = ncgh.coin_id AND ncgh.rn = 1
ORDER BY ncs.total_score DESC, nc.created_at DESC;

-- 创建视图：新币告警统计
CREATE OR REPLACE VIEW new_coin_alert_statistics AS
SELECT 
    nc.symbol,
    nc.name,
    COUNT(nca.id) as total_alerts,
    COUNT(CASE WHEN nca.alert_level = 'CRITICAL' THEN 1 END) as critical_alerts,
    COUNT(CASE WHEN nca.alert_level = 'WARNING' THEN 1 END) as warning_alerts,
    COUNT(CASE WHEN nca.alert_level = 'INFO' THEN 1 END) as info_alerts,
    COUNT(CASE WHEN nca.is_sent = TRUE THEN 1 END) as sent_alerts,
    MAX(nca.created_at) as last_alert_time
FROM new_coins nc
LEFT JOIN new_coin_alerts nca ON nc.id = nca.coin_id
WHERE nca.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY nc.id, nc.symbol, nc.name
ORDER BY total_alerts DESC, last_alert_time DESC;

-- 创建存储过程：清理新币监控过期数据
DELIMITER //
CREATE PROCEDURE CleanupNewCoinMonitorData()
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- 清理30天前的评分数据
    DELETE FROM new_coin_scores 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
    
    -- 清理7天前的市场数据
    DELETE FROM new_coin_market_data 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY);
    
    -- 清理30天前的GitHub数据
    DELETE FROM new_coin_github_data 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
    
    -- 清理7天前的告警数据
    DELETE FROM new_coin_alerts 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY);
    
    -- 优化表
    OPTIMIZE TABLE new_coin_scores;
    OPTIMIZE TABLE new_coin_market_data;
    OPTIMIZE TABLE new_coin_github_data;
    OPTIMIZE TABLE new_coin_alerts;
    
    COMMIT;
END //
DELIMITER ;

-- 创建事件：自动清理新币监控过期数据（每天凌晨3点执行）
CREATE EVENT IF NOT EXISTS cleanup_new_coin_monitor_data
ON SCHEDULE EVERY 1 DAY
STARTS TIMESTAMP(CURDATE() + INTERVAL 1 DAY, '03:00:00')
DO
    CALL CleanupNewCoinMonitorData();

-- 显示创建结果
SELECT 'New coin monitor database schema created successfully!' as status;
SELECT COUNT(*) as config_count FROM new_coin_monitor_config;
