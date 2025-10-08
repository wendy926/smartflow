-- AI集成数据库迁移脚本
-- 创建时间: 2025-10-08
-- 用途: 支持Claude AI Agent集成

USE trading_system;

-- 1. AI配置表
CREATE TABLE IF NOT EXISTS ai_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE COMMENT '配置键',
    config_value TEXT NOT NULL COMMENT '配置值(加密)',
    config_type ENUM('API_KEY', 'PROXY', 'PROMPT', 'SETTING') DEFAULT 'SETTING',
    description TEXT DEFAULT NULL COMMENT '配置描述',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否激活',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_config_key (config_key),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI配置表';

-- 2. AI市场分析记录表
CREATE TABLE IF NOT EXISTS ai_market_analysis (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL COMMENT '交易对符号',
    analysis_type ENUM('MACRO_RISK', 'SYMBOL_TREND') NOT NULL COMMENT '分析类型',
    analysis_data JSON NOT NULL COMMENT 'AI分析结果(JSON格式)',
    risk_level ENUM('SAFE', 'WATCH', 'DANGER', 'EXTREME') DEFAULT NULL COMMENT '风险等级',
    confidence_score DECIMAL(5, 2) DEFAULT NULL COMMENT '置信度(0-100)',
    alert_triggered BOOLEAN DEFAULT FALSE COMMENT '是否触发告警',
    raw_response TEXT DEFAULT NULL COMMENT 'AI原始响应',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_symbol_type (symbol, analysis_type),
    INDEX idx_risk_level (risk_level),
    INDEX idx_created_at (created_at),
    INDEX idx_alert_triggered (alert_triggered)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI市场分析记录表';

-- 3. AI告警历史表
CREATE TABLE IF NOT EXISTS ai_alert_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    analysis_id BIGINT NOT NULL COMMENT '分析记录ID',
    alert_type ENUM('RISK_WARNING', 'RISK_CRITICAL') NOT NULL COMMENT '告警类型',
    alert_message TEXT NOT NULL COMMENT '告警消息',
    telegram_sent BOOLEAN DEFAULT FALSE COMMENT '是否已发送Telegram',
    telegram_message_id VARCHAR(100) DEFAULT NULL COMMENT 'Telegram消息ID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_analysis_id (analysis_id),
    INDEX idx_alert_type (alert_type),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (analysis_id) REFERENCES ai_market_analysis(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI告警历史表';

-- 4. AI调用日志表
CREATE TABLE IF NOT EXISTS ai_api_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    request_type ENUM('MACRO_MONITOR', 'SYMBOL_ANALYST') NOT NULL,
    request_data JSON DEFAULT NULL COMMENT '请求数据',
    response_status ENUM('SUCCESS', 'ERROR', 'TIMEOUT') NOT NULL,
    response_time_ms INT DEFAULT NULL COMMENT '响应时间(毫秒)',
    error_message TEXT DEFAULT NULL COMMENT '错误消息',
    tokens_used INT DEFAULT NULL COMMENT '使用Token数',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_request_type (request_type),
    INDEX idx_response_status (response_status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI API调用日志表';

-- 5. 扩展 strategy_judgments 表
-- 检查列是否存在，不存在则添加
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'strategy_judgments'
    AND COLUMN_NAME = 'ai_analysis_id'
  ) > 0,
  "SELECT 'Column ai_analysis_id already exists' AS msg;",
  "ALTER TABLE strategy_judgments 
   ADD COLUMN ai_analysis_id BIGINT DEFAULT NULL COMMENT 'AI分析记录ID',
   ADD INDEX idx_ai_analysis_id (ai_analysis_id);"
));

PREPARE alterStatement FROM @preparedStatement;
EXECUTE alterStatement;
DEALLOCATE PREPARE alterStatement;

-- 6. 插入初始配置数据
INSERT INTO ai_config (config_key, config_value, config_type, description) VALUES
('claude_api_key', '', 'API_KEY', 'Claude API密钥(加密存储)'),
('claude_api_proxy', '', 'PROXY', 'Claude API代理地址'),
('claude_model', 'claude-3-5-sonnet-20241022', 'SETTING', 'Claude模型版本'),
('claude_max_tokens', '4000', 'SETTING', '最大Token数'),
('claude_temperature', '0.3', 'SETTING', '温度参数(0-1)'),
('macro_update_interval', '7200', 'SETTING', '宏观分析更新间隔(秒)'),
('symbol_update_interval', '300', 'SETTING', '交易对分析更新间隔(秒)'),
('ai_analysis_enabled', 'true', 'SETTING', 'AI分析是否启用'),
('alert_danger_enabled', 'true', 'SETTING', '危险告警是否启用'),
('alert_extreme_enabled', 'true', 'SETTING', '极度危险告警是否启用'),
('alert_cooldown_seconds', '3600', 'SETTING', '告警冷却时间(秒)'),
('cache_analysis_ttl', '7200', 'SETTING', '分析结果缓存TTL(秒)')
ON DUPLICATE KEY UPDATE 
    config_value = VALUES(config_value),
    updated_at = CURRENT_TIMESTAMP;

-- 7. 创建AI分析数据清理存储过程
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS CleanupAIAnalysisData()
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- 清理30天前的AI分析记录
    DELETE FROM ai_market_analysis 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
    
    -- 清理30天前的AI调用日志
    DELETE FROM ai_api_logs 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
    
    -- 清理90天前的告警历史
    DELETE FROM ai_alert_history 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
    
    -- 优化表
    OPTIMIZE TABLE ai_market_analysis;
    OPTIMIZE TABLE ai_api_logs;
    OPTIMIZE TABLE ai_alert_history;
    
    COMMIT;
    
    SELECT 'AI analysis data cleanup completed!' AS status;
END //
DELIMITER ;

-- 8. 创建获取最新AI分析的视图
CREATE OR REPLACE VIEW v_latest_ai_analysis AS
SELECT 
    ama.symbol,
    ama.analysis_type,
    ama.analysis_data,
    ama.risk_level,
    ama.confidence_score,
    ama.alert_triggered,
    ama.created_at,
    ama.updated_at,
    s.last_price,
    s.price_change_24h
FROM ai_market_analysis ama
INNER JOIN symbols s ON ama.symbol = s.symbol
WHERE ama.id IN (
    SELECT MAX(id) 
    FROM ai_market_analysis 
    GROUP BY symbol, analysis_type
)
ORDER BY ama.created_at DESC;

-- 9. 创建AI分析统计视图
CREATE OR REPLACE VIEW v_ai_analysis_stats AS
SELECT 
    DATE(created_at) AS analysis_date,
    request_type,
    COUNT(*) AS total_requests,
    SUM(CASE WHEN response_status = 'SUCCESS' THEN 1 ELSE 0 END) AS success_count,
    SUM(CASE WHEN response_status = 'ERROR' THEN 1 ELSE 0 END) AS error_count,
    SUM(CASE WHEN response_status = 'TIMEOUT' THEN 1 ELSE 0 END) AS timeout_count,
    ROUND(AVG(response_time_ms), 2) AS avg_response_time_ms,
    SUM(COALESCE(tokens_used, 0)) AS total_tokens_used
FROM ai_api_logs
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY DATE(created_at), request_type
ORDER BY analysis_date DESC, request_type;

-- 10. 显示创建结果
SELECT 'AI Integration database schema created successfully!' AS status;
SELECT COUNT(*) as ai_config_count FROM ai_config;
SELECT TABLE_NAME, TABLE_ROWS FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'trading_system' 
AND TABLE_NAME LIKE 'ai_%'
ORDER BY TABLE_NAME;

