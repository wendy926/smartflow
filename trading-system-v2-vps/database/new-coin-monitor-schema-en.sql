-- New Coin Monitor Database Schema (English Version)
-- Based on new-coin-monitor.md design

USE trading_system;

-- 1. New Coin Basic Info Table
CREATE TABLE IF NOT EXISTS new_coins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    github_repo VARCHAR(200) DEFAULT NULL,
    team_score DECIMAL(3,1) DEFAULT 0.0,
    supply_total BIGINT DEFAULT 0,
    supply_circulation BIGINT DEFAULT 0,
    vesting_lock_score DECIMAL(3,1) DEFAULT 0.0,
    twitter_followers INT DEFAULT 0,
    telegram_members INT DEFAULT 0,
    status ENUM('ACTIVE', 'INACTIVE', 'MONITORING') DEFAULT 'ACTIVE',
    listing_date TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_symbol (symbol),
    INDEX idx_status (status),
    INDEX idx_listing_date (listing_date),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. New Coin Scores Table
CREATE TABLE IF NOT EXISTS new_coin_scores (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    coin_id INT NOT NULL,
    tech_score DECIMAL(4,2) DEFAULT 0.00,
    token_score DECIMAL(4,2) DEFAULT 0.00,
    liquidity_score DECIMAL(4,2) DEFAULT 0.00,
    sentiment_score DECIMAL(4,2) DEFAULT 0.00,
    total_score DECIMAL(4,2) DEFAULT 0.00,
    strategy_recommendation VARCHAR(100) DEFAULT NULL,
    evaluation_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_coin_id (coin_id),
    INDEX idx_total_score (total_score),
    INDEX idx_evaluation_time (evaluation_time),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (coin_id) REFERENCES new_coins(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. New Coin Market Data Table
CREATE TABLE IF NOT EXISTS new_coin_market_data (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    coin_id INT NOT NULL,
    price DECIMAL(20,8) DEFAULT 0.00000000,
    volume_24h DECIMAL(20,8) DEFAULT 0.00000000,
    price_change_24h DECIMAL(10,4) DEFAULT 0.0000,
    high_24h DECIMAL(20,8) DEFAULT 0.00000000,
    low_24h DECIMAL(20,8) DEFAULT 0.00000000,
    bid_depth DECIMAL(20,8) DEFAULT 0.00000000,
    ask_depth DECIMAL(20,8) DEFAULT 0.00000000,
    volatility_score DECIMAL(4,2) DEFAULT 0.00,
    data_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_coin_id (coin_id),
    INDEX idx_data_time (data_time),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (coin_id) REFERENCES new_coins(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. GitHub Data Table
CREATE TABLE IF NOT EXISTS new_coin_github_data (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    coin_id INT NOT NULL,
    stars_count INT DEFAULT 0,
    forks_count INT DEFAULT 0,
    issues_count INT DEFAULT 0,
    commits_count INT DEFAULT 0,
    contributors_count INT DEFAULT 0,
    last_commit_date TIMESTAMP DEFAULT NULL,
    github_score DECIMAL(4,2) DEFAULT 0.00,
    data_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_coin_id (coin_id),
    INDEX idx_data_time (data_time),
    INDEX idx_github_score (github_score),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (coin_id) REFERENCES new_coins(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. New Coin Monitor Config Table
CREATE TABLE IF NOT EXISTS new_coin_monitor_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    config_type ENUM('STRING', 'NUMBER', 'BOOLEAN', 'JSON') DEFAULT 'STRING',
    description TEXT DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_config_key (config_key),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. New Coin Alerts Table
CREATE TABLE IF NOT EXISTS new_coin_alerts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    coin_id INT NOT NULL,
    alert_type ENUM('LOW_SCORE', 'HIGH_VOLATILITY', 'LIQUIDITY_WARNING', 'GITHUB_ACTIVITY', 'CUSTOM') NOT NULL,
    alert_level ENUM('INFO', 'WARNING', 'CRITICAL') DEFAULT 'WARNING',
    alert_message TEXT NOT NULL,
    alert_data JSON DEFAULT NULL,
    is_sent BOOLEAN DEFAULT FALSE,
    sent_time TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_coin_id (coin_id),
    INDEX idx_alert_type (alert_type),
    INDEX idx_alert_level (alert_level),
    INDEX idx_is_sent (is_sent),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (coin_id) REFERENCES new_coins(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default config
INSERT INTO new_coin_monitor_config (config_key, config_value, config_type, description) VALUES
('monitor_enabled', 'true', 'BOOLEAN', 'Enable new coin monitoring'),
('evaluation_interval', '300', 'NUMBER', 'Evaluation update interval in seconds'),
('market_data_interval', '60', 'NUMBER', 'Market data update interval in seconds'),
('github_data_interval', '3600', 'NUMBER', 'GitHub data update interval in seconds'),
('alert_score_threshold', '7.0', 'NUMBER', 'Alert threshold for scores'),
('alert_volatility_threshold', '0.20', 'NUMBER', 'Alert threshold for volatility'),
('alert_liquidity_threshold', '3.0', 'NUMBER', 'Alert threshold for liquidity'),
('github_token', '', 'STRING', 'GitHub API Token'),
('telegram_bot_token', '', 'STRING', 'Telegram Bot Token'),
('telegram_chat_id', '', 'STRING', 'Telegram Chat ID'),
('binance_api_timeout', '10000', 'NUMBER', 'Binance API timeout in milliseconds'),
('github_api_timeout', '10000', 'NUMBER', 'GitHub API timeout in milliseconds'),
('max_concurrent_requests', '5', 'NUMBER', 'Maximum concurrent requests'),
('data_retention_days', '30', 'NUMBER', 'Data retention days'),
('weight_tech_team', '0.30', 'NUMBER', 'Technology team weight'),
('weight_token_economics', '0.25', 'NUMBER', 'Token economics weight'),
('weight_liquidity', '0.25', 'NUMBER', 'Liquidity weight'),
('weight_market_sentiment', '0.20', 'NUMBER', 'Market sentiment weight')
ON DUPLICATE KEY UPDATE 
    config_value = VALUES(config_value),
    updated_at = CURRENT_TIMESTAMP;

-- Show creation result
SELECT 'New coin monitor database schema created successfully!' as status;
SELECT COUNT(*) as config_count FROM new_coin_monitor_config;
