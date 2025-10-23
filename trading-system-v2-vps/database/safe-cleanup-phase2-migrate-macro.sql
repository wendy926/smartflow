-- 数据库安全清理脚本 - 阶段2（迁移宏观监控数据）
-- 将macro_monitoring_*数据迁移到system_monitoring
-- 需要配合代码修改

USE trading_system;

-- ============================================
-- 阶段2: 迁移macro_monitoring_data到system_monitoring
-- ============================================

SELECT '========================================' as '';
SELECT '阶段2: 迁移宏观监控数据' as phase;
SELECT '========================================' as '';

-- 检查数据量
SELECT 'macro_monitoring_data数据量:' as info;
SELECT COUNT(*) as total_rows FROM macro_monitoring_data;

-- 检查system_monitoring结构是否兼容
SELECT 'system_monitoring表结构:' as info;
DESCRIBE system_monitoring;

-- 迁移数据到system_monitoring
INSERT INTO system_monitoring (metric_name, metric_value, metric_unit, component, status, details, created_at)
SELECT 
    metric_name,
    metric_value,
    metric_unit,
    'macro_monitor' as component,  -- 标记为宏观监控组件
    CASE 
        WHEN alert_triggered = 1 THEN 'WARNING'
        ELSE 'NORMAL'
    END as status,
    JSON_OBJECT(
        'source', 'macro_monitoring_data',
        'alert_triggered', alert_triggered,
        'threshold_value', threshold_value,
        'alert_message', alert_message
    ) as details,
    created_at
FROM macro_monitoring_data
WHERE NOT EXISTS (
    SELECT 1 FROM system_monitoring sm
    WHERE sm.metric_name = macro_monitoring_data.metric_name
      AND sm.created_at = macro_monitoring_data.created_at
      AND sm.component = 'macro_monitor'
);

SELECT CONCAT('✅ 已迁移 ', ROW_COUNT(), ' 条数据到system_monitoring') as status;

-- ============================================
-- 迁移macro_monitoring_config到system_config
-- ============================================

SELECT 'macro_monitoring_config数据量:' as info;
SELECT COUNT(*) as total_rows FROM macro_monitoring_config;

-- 迁移配置
INSERT INTO system_config (config_key, config_value, config_type, description, is_active, created_at, updated_at)
SELECT 
    CONCAT('macro_', config_key) as config_key,
    config_value,
    config_type,
    description,
    is_active,
    created_at,
    updated_at
FROM macro_monitoring_config
WHERE NOT EXISTS (
    SELECT 1 FROM system_config sc
    WHERE sc.config_key = CONCAT('macro_', macro_monitoring_config.config_key)
)
ON DUPLICATE KEY UPDATE
    config_value = VALUES(config_value),
    updated_at = CURRENT_TIMESTAMP;

SELECT CONCAT('✅ 已迁移 ', ROW_COUNT(), ' 条配置到system_config') as status;

-- ============================================
-- 迁移macro_monitoring_alerts
-- ============================================

-- 检查是否有ai_alert_history表
SELECT 'macro_monitoring_alerts数据量:' as info;
SELECT COUNT(*) as total_rows FROM macro_monitoring_alerts;

-- 如果ai_alert_history不存在，创建它
CREATE TABLE IF NOT EXISTS macro_alert_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    alert_type VARCHAR(50) NOT NULL COMMENT '告警类型',
    severity ENUM('INFO', 'WARNING', 'CRITICAL') DEFAULT 'WARNING',
    symbol_id INT DEFAULT NULL COMMENT '关联交易对',
    message TEXT NOT NULL COMMENT '告警消息',
    alert_data JSON DEFAULT NULL COMMENT '告警详细数据',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_alert_type (alert_type),
    INDEX idx_severity (severity),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='宏观监控告警历史表';

-- 迁移告警数据
INSERT INTO macro_alert_history (alert_type, severity, message, alert_data, created_at)
SELECT 
    alert_type,
    severity,
    alert_message as message,
    JSON_OBJECT(
        'metric_name', metric_name,
        'metric_value', metric_value,
        'threshold_value', threshold_value,
        'details', details
    ) as alert_data,
    created_at
FROM macro_monitoring_alerts;

SELECT CONCAT('✅ 已迁移 ', ROW_COUNT(), ' 条告警到macro_alert_history') as status;

-- ============================================
-- 创建备份表（保险起见）
-- ============================================

CREATE TABLE IF NOT EXISTS macro_monitoring_data_backup_20251010 AS 
SELECT * FROM macro_monitoring_data;

CREATE TABLE IF NOT EXISTS macro_monitoring_config_backup_20251010 AS 
SELECT * FROM macro_monitoring_config;

CREATE TABLE IF NOT EXISTS macro_monitoring_alerts_backup_20251010 AS 
SELECT * FROM macro_monitoring_alerts;

SELECT '✅ 已创建备份表（带日期后缀）' as status;

-- ============================================
-- 删除原表（注释掉，手动确认后执行）
-- ============================================

-- 警告：删除前请确认代码已修改为使用system_monitoring
-- 
-- DROP TABLE IF EXISTS macro_monitoring_alerts;
-- DROP TABLE IF EXISTS macro_monitoring_config;  
-- DROP TABLE IF EXISTS macro_monitoring_data;
--
-- SELECT '✅ 已删除: macro_monitoring_* (3个表)' as status;

SELECT '⚠️  macro_monitoring_*表的删除已注释，请修改代码后手动执行' as warning;

-- ============================================
-- 阶段2 完成提示
-- ============================================

SELECT '========================================' as '';
SELECT '阶段2数据迁移完成' as summary;
SELECT '========================================' as '';
SELECT '已完成:' as '';
SELECT '  1. macro_monitoring_data → system_monitoring' as migration_1;
SELECT '  2. macro_monitoring_config → system_config' as migration_2;
SELECT '  3. macro_monitoring_alerts → macro_alert_history' as migration_3;
SELECT '  4. 创建备份表（3个）' as backups;
SELECT '' as '';
SELECT '下一步:' as next_steps;
SELECT '  1. 修改src/services/macro-monitor/*文件，改用system_monitoring' as step_1;
SELECT '  2. 测试功能正常' as step_2;
SELECT '  3. 手动执行DROP TABLE命令删除旧表' as step_3;
SELECT '========================================' as '';

