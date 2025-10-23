-- 新币监控模块数据库表结构（简化版）
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

-- 显示创建结果
SELECT 'New coin monitor database schema created successfully!' as status;
SELECT COUNT(*) as config_count FROM new_coin_monitor_config;
