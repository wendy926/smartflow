-- 数据库表清理脚本
-- 用于删除冗余和未使用的表
-- 执行前请务必备份数据库！

USE trading_system;

-- ============================================
-- 阶段1: 删除未使用的新币监控模块（6个表）
-- ============================================

-- 检查表是否存在数据
SELECT 'new_coins' as table_name, COUNT(*) as row_count FROM new_coins
UNION ALL
SELECT 'new_coin_scores', COUNT(*) FROM new_coin_scores
UNION ALL
SELECT 'new_coin_market_data', COUNT(*) FROM new_coin_market_data
UNION ALL
SELECT 'new_coin_github_data', COUNT(*) FROM new_coin_github_data
UNION ALL
SELECT 'new_coin_monitor_config', COUNT(*) FROM new_coin_monitor_config
UNION ALL
SELECT 'new_coin_alerts', COUNT(*) FROM new_coin_alerts;

-- 如果确认无数据或数据可删除，执行以下删除语句
DROP TABLE IF EXISTS new_coin_alerts;
DROP TABLE IF EXISTS new_coin_github_data;
DROP TABLE IF EXISTS new_coin_market_data;
DROP TABLE IF EXISTS new_coin_scores;
DROP TABLE IF EXISTS new_coin_monitor_config;
DROP TABLE IF EXISTS new_coins;

SELECT '✅ 已删除6个未使用的新币监控表' as status;

-- ============================================
-- 阶段2: 删除冗余的宏观监控模块（3个表）
-- ============================================

-- 检查表是否存在数据
SELECT 'macro_monitoring_data' as table_name, COUNT(*) as row_count FROM macro_monitoring_data
UNION ALL
SELECT 'macro_monitoring_config', COUNT(*) FROM macro_monitoring_config
UNION ALL
SELECT 'macro_monitoring_alerts', COUNT(*) FROM macro_monitoring_alerts;

-- 如果确认可删除（功能已被system_monitoring替代）
DROP TABLE IF EXISTS macro_monitoring_alerts;
DROP TABLE IF EXISTS macro_monitoring_config;
DROP TABLE IF EXISTS macro_monitoring_data;

SELECT '✅ 已删除3个冗余的宏观监控表' as status;

-- ============================================
-- 阶段3: 删除冗余的策略遥测表（2个表）
-- ============================================

-- 警告：v3_telemetry 和 ict_telemetry 可能包含历史数据
-- 建议先导出数据备份，再删除

-- 检查数据量
SELECT 'v3_telemetry' as table_name, COUNT(*) as row_count FROM v3_telemetry
UNION ALL
SELECT 'ict_telemetry', COUNT(*) FROM ict_telemetry;

-- 可选：导出数据到JSON备份
-- SELECT * FROM v3_telemetry INTO OUTFILE '/tmp/v3_telemetry_backup.json';
-- SELECT * FROM ict_telemetry INTO OUTFILE '/tmp/ict_telemetry_backup.json';

-- 确认后删除（功能已被v3_1_signal_logs替代）
-- DROP TABLE IF EXISTS v3_telemetry;
-- DROP TABLE IF EXISTS ict_telemetry;

SELECT '⚠️  v3_telemetry 和 ict_telemetry 需要手动确认后删除' as status;

-- ============================================
-- 阶段4: 删除胜率历史表（改用视图）
-- ============================================

-- 检查数据量
SELECT 'v3_win_rate_history' as table_name, COUNT(*) as row_count FROM v3_win_rate_history
UNION ALL
SELECT 'ict_win_rate_history', COUNT(*) FROM ict_win_rate_history;

-- 创建视图替代（实时计算）
CREATE OR REPLACE VIEW strategy_win_rate_history AS
SELECT 
    symbol_id,
    strategy_name,
    DATE(entry_time) as trade_date,
    COUNT(*) as total_trades,
    SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
    ROUND(SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as win_rate,
    AVG(pnl) as avg_pnl,
    MAX(pnl) as max_pnl,
    MIN(pnl) as min_pnl
FROM simulation_trades
WHERE status = 'CLOSED'
GROUP BY symbol_id, strategy_name, DATE(entry_time)
ORDER BY trade_date DESC;

-- 确认视图工作后删除表
-- DROP TABLE IF EXISTS v3_win_rate_history;
-- DROP TABLE IF EXISTS ict_win_rate_history;

SELECT '⚠️  已创建视图，需手动确认后删除v3_win_rate_history和ict_win_rate_history' as status;

-- ============================================
-- 阶段5: 合并macro_alert_thresholds到system_config
-- ============================================

-- 检查数据
SELECT * FROM macro_alert_thresholds;

-- 迁移数据到system_config
INSERT INTO system_config (config_key, config_value, config_type, description)
SELECT 
    CONCAT('macro_threshold_', metric_name) as config_key,
    CAST(threshold_value AS CHAR) as config_value,
    'NUMBER' as config_type,
    CONCAT('Macro monitoring threshold for ', metric_name) as description
FROM macro_alert_thresholds
WHERE NOT EXISTS (
    SELECT 1 FROM system_config 
    WHERE config_key = CONCAT('macro_threshold_', macro_alert_thresholds.metric_name)
);

-- 确认迁移后删除
-- DROP TABLE IF EXISTS macro_alert_thresholds;

SELECT '⚠️  已迁移数据，需手动确认后删除macro_alert_thresholds' as status;

-- ============================================
-- 汇总报告
-- ============================================

SELECT '========================================' as '';
SELECT '数据库清理汇总报告' as report_title;
SELECT '========================================' as '';

SELECT 
    CONCAT('立即删除: ', 
           IF(COUNT(*) = 0, 'new_coin_* (6个表)', 'ERROR: 表仍存在')) as action_1
FROM information_schema.tables 
WHERE table_schema = 'trading_system' 
  AND table_name LIKE 'new_coin%';

SELECT 
    CONCAT('立即删除: ', 
           IF(COUNT(*) = 0, 'macro_monitoring_* (3个表)', 'ERROR: 表仍存在')) as action_2
FROM information_schema.tables 
WHERE table_schema = 'trading_system' 
  AND table_name LIKE 'macro_monitoring%';

SELECT '需手动确认: v3_telemetry, ict_telemetry (2个表)' as action_3;
SELECT '需手动确认: v3_win_rate_history, ict_win_rate_history (2个表)' as action_4;
SELECT '需手动确认: macro_alert_thresholds (1个表)' as action_5;

SELECT '========================================' as '';
SELECT CONCAT('预计删除表数: ', 
              (SELECT COUNT(*) FROM information_schema.tables 
               WHERE table_schema = 'trading_system' 
               AND (table_name LIKE 'new_coin%' 
                    OR table_name LIKE 'macro_monitoring%'
                    OR table_name IN ('v3_telemetry', 'ict_telemetry', 
                                     'v3_win_rate_history', 'ict_win_rate_history',
                                     'macro_alert_thresholds'))),
              ' 个') as summary;
SELECT '========================================' as '';

-- ============================================
-- 验证剩余表
-- ============================================

SELECT 
    table_name,
    ROUND((data_length + index_length) / 1024 / 1024, 2) as size_mb,
    table_rows
FROM information_schema.tables
WHERE table_schema = 'trading_system'
  AND table_type = 'BASE TABLE'
ORDER BY (data_length + index_length) DESC;

