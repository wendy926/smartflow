-- 宏观数据监控模块数据库表结构
-- 基于 smonitor.md 文档设计

-- 1. 宏观监控数据表
CREATE TABLE IF NOT EXISTS macro_monitoring_data (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    data_type ENUM('FUND_FLOW', 'MARKET_SENTIMENT', 'FUTURES_MARKET', 'MACRO_ECONOMIC') NOT NULL COMMENT '数据类型',
    source VARCHAR(50) NOT NULL COMMENT '数据源',
    metric_name VARCHAR(100) NOT NULL COMMENT '指标名称',
    metric_value DECIMAL(20, 8) NOT NULL COMMENT '指标值',
    metric_unit VARCHAR(20) DEFAULT NULL COMMENT '指标单位',
    alert_level ENUM('NORMAL', 'WARNING', 'CRITICAL') DEFAULT 'NORMAL' COMMENT '告警级别',
    raw_data JSON DEFAULT NULL COMMENT '原始数据',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_data_type (data_type),
    INDEX idx_source (source),
    INDEX idx_alert_level (alert_level),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='宏观监控数据表';

-- 2. 宏观监控配置表
CREATE TABLE IF NOT EXISTS macro_monitoring_config (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='宏观监控配置表';

-- 3. 宏观监控告警记录表
CREATE TABLE IF NOT EXISTS macro_monitoring_alerts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    alert_type ENUM('FUND_FLOW', 'MARKET_SENTIMENT', 'FUTURES_MARKET', 'MACRO_ECONOMIC') NOT NULL COMMENT '告警类型',
    alert_level ENUM('WARNING', 'CRITICAL') NOT NULL COMMENT '告警级别',
    title VARCHAR(200) NOT NULL COMMENT '告警标题',
    message TEXT NOT NULL COMMENT '告警消息',
    metric_name VARCHAR(100) NOT NULL COMMENT '指标名称',
    metric_value DECIMAL(20, 8) NOT NULL COMMENT '指标值',
    threshold_value DECIMAL(20, 8) NOT NULL COMMENT '阈值',
    is_sent BOOLEAN DEFAULT FALSE COMMENT '是否已发送',
    sent_at TIMESTAMP NULL DEFAULT NULL COMMENT '发送时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_alert_type (alert_type),
    INDEX idx_alert_level (alert_level),
    INDEX idx_is_sent (is_sent),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='宏观监控告警记录表';

-- 插入宏观监控默认配置
INSERT INTO macro_monitoring_config (config_key, config_value, config_type, description) VALUES
-- 资金流监控配置
('fund_flow_btc_threshold', '10000000', 'NUMBER', 'BTC大额转账告警阈值(USD)'),
('fund_flow_eth_threshold', '1000', 'NUMBER', 'ETH大额转账告警阈值(ETH)'),
('fund_flow_enabled', 'true', 'BOOLEAN', '资金流监控是否启用'),

-- 市场情绪配置
('fear_greed_low_threshold', '20', 'NUMBER', '恐惧贪婪指数低阈值'),
('fear_greed_high_threshold', '80', 'NUMBER', '恐惧贪婪指数高阈值'),
('market_sentiment_enabled', 'true', 'BOOLEAN', '市场情绪监控是否启用'),

-- 合约市场配置
('long_short_ratio_high', '2.0', 'NUMBER', '多空比高阈值'),
('long_short_ratio_low', '0.5', 'NUMBER', '多空比低阈值'),
('futures_market_enabled', 'true', 'BOOLEAN', '合约市场监控是否启用'),

-- 宏观指标配置
('fed_funds_high_threshold', '5.0', 'NUMBER', '美联储利率高阈值(%)'),
('fed_funds_low_threshold', '2.0', 'NUMBER', '美联储利率低阈值(%)'),
('cpi_high_threshold', '4.0', 'NUMBER', 'CPI通胀率高阈值(%)'),
('cpi_low_threshold', '1.0', 'NUMBER', 'CPI通胀率低阈值(%)'),
('macro_economic_enabled', 'true', 'BOOLEAN', '宏观指标监控是否启用'),

-- API配置
('etherscan_api_key', 'AZAZFVBNA16WCUMAHPGDFTVSXB5KJUHCIM', 'STRING', 'Etherscan API密钥'),
('fred_api_key', 'fbfe3e85bdec733f71b17800eaa614fd', 'STRING', 'FRED API密钥'),
('exchange_wallet_address', '0x28C6c06298d514Db089934071355E5743bf21d60', 'STRING', '交易所钱包地址'),

-- 监控间隔配置
('monitoring_interval', '60', 'NUMBER', '监控间隔(秒)'),
('data_retention_days', '30', 'NUMBER', '数据保留天数'),
('alert_cooldown_minutes', '30', 'NUMBER', '告警冷却时间(分钟)'),

-- Telegram配置
('telegram_macro_enabled', 'false', 'BOOLEAN', '宏观监控Telegram通知是否启用'),
('telegram_macro_bot_token', '', 'STRING', '宏观监控Telegram机器人令牌'),
('telegram_macro_chat_id', '', 'STRING', '宏观监控Telegram聊天ID')

ON DUPLICATE KEY UPDATE 
    config_value = VALUES(config_value),
    updated_at = CURRENT_TIMESTAMP;

-- 创建分区表（按月分区）
ALTER TABLE macro_monitoring_data 
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

-- 创建视图：宏观监控数据概览
CREATE OR REPLACE VIEW macro_monitoring_overview AS
SELECT 
    data_type,
    source,
    metric_name,
    metric_value,
    metric_unit,
    alert_level,
    created_at
FROM macro_monitoring_data
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
ORDER BY created_at DESC;

-- 创建存储过程：清理过期宏观监控数据
DELIMITER //
CREATE PROCEDURE CleanupMacroMonitoringData()
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- 清理30天前的宏观监控数据
    DELETE FROM macro_monitoring_data 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
    
    -- 清理90天前的告警记录
    DELETE FROM macro_monitoring_alerts 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
    
    -- 优化表
    OPTIMIZE TABLE macro_monitoring_data;
    OPTIMIZE TABLE macro_monitoring_alerts;
    
    COMMIT;
END //
DELIMITER ;

-- 创建事件：自动清理过期宏观监控数据（每天凌晨3点执行）
CREATE EVENT IF NOT EXISTS cleanup_macro_monitoring_data
ON SCHEDULE EVERY 1 DAY
STARTS TIMESTAMP(CURDATE() + INTERVAL 1 DAY, '03:00:00')
DO
    CALL CleanupMacroMonitoringData();

-- 显示创建结果
SELECT 'Macro monitoring database schema created successfully!' as status;
SELECT COUNT(*) as config_count FROM macro_monitoring_config;
