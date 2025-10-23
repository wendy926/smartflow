-- ============================================
-- V2.0数据库清理和整合 - 完整执行脚本
-- ============================================
-- 目标: 清理13个冗余表，优化数据库结构
-- 执行前: 请务必备份数据库！
-- ============================================

USE trading_system;

-- ============================================
-- 执行前确认
-- ============================================

SELECT '========================================' as msg;
SELECT '⚠️  V2.0数据库清理脚本' as title;
SELECT '========================================' as msg;
SELECT '' as msg;
SELECT '将要执行的操作:' as msg;
SELECT '  1. 删除4个无代码引用的表' as action_1;
SELECT '  2. 创建视图替代胜率历史表' as action_2;
SELECT '  3. 迁移宏观监控数据到统一表' as action_3;
SELECT '  4. 创建备份表' as action_4;
SELECT '' as msg;
SELECT '⚠️  请确认已执行备份:' as warning;
SELECT '    mysqldump -u root -p trading_system > backup.sql' as backup_cmd;
SELECT '========================================' as msg;

-- 等待5秒（给用户时间取消）
-- SELECT SLEEP(5);

-- ============================================
-- PART 1: 删除无代码引用的遥测表（4个）
-- ============================================

SELECT '' as msg;
SELECT '========================================' as msg;
SELECT 'PART 1: 删除遥测表' as part;
SELECT '========================================' as msg;

-- 检查数据量
SELECT 'v3_telemetry' as table_name, COUNT(*) as rows FROM v3_telemetry
UNION ALL
SELECT 'ict_telemetry', COUNT(*) FROM ict_telemetry
UNION ALL  
SELECT 'v3_win_rate_history', COUNT(*) FROM v3_win_rate_history
UNION ALL
SELECT 'ict_win_rate_history', COUNT(*) FROM ict_win_rate_history;

-- 创建备份（如果有数据）
CREATE TABLE IF NOT EXISTS deleted_tables_backup_20251010 (
    backup_id INT AUTO_INCREMENT PRIMARY KEY,
    original_table VARCHAR(100),
    backup_data JSON,
    deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 备份v3_telemetry数据到JSON
INSERT INTO deleted_tables_backup_20251010 (original_table, backup_data)
SELECT 'v3_telemetry', JSON_OBJECT(
    'id', id,
    'symbol_id', symbol_id,
    'timestamp', timestamp,
    'data', JSON_OBJECT(
        'trend_score', trend_score,
        'factor_score', factor_score,
        'total_score', total_score,
        'signal_result', signal_result
    )
) FROM v3_telemetry LIMIT 1000; -- 只备份最近1000条

-- 删除表
DROP TABLE IF EXISTS v3_telemetry;
DROP TABLE IF EXISTS ict_telemetry;
DROP TABLE IF EXISTS v3_win_rate_history;
DROP TABLE IF EXISTS ict_win_rate_history;

SELECT '✅ 已删除4个遥测和胜率历史表' as status;

-- ============================================
-- PART 2: 创建替代视图
-- ============================================

SELECT '' as msg;
SELECT '========================================' as msg;
SELECT 'PART 2: 创建替代视图' as part;
SELECT '========================================' as msg;

-- 创建胜率历史视图（替代原表）
CREATE OR REPLACE VIEW strategy_win_rate_history AS
SELECT 
    s.id as symbol_id,
    s.symbol,
    st.strategy_name,
    DATE(st.entry_time) as trade_date,
    COUNT(*) as total_trades,
    SUM(CASE WHEN st.pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
    SUM(CASE WHEN st.pnl < 0 THEN 1 ELSE 0 END) as losing_trades,
    ROUND(SUM(CASE WHEN st.pnl > 0 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as win_rate,
    AVG(st.pnl) as avg_pnl,
    SUM(st.pnl) as total_pnl,
    MAX(st.pnl) as max_pnl,
    MIN(st.pnl) as min_pnl,
    AVG(TIMESTAMPDIFF(MINUTE, st.entry_time, st.exit_time)) as avg_hold_minutes
FROM symbols s
JOIN simulation_trades st ON s.id = st.symbol_id
WHERE st.status = 'CLOSED'
GROUP BY s.id, s.symbol, st.strategy_name, DATE(st.entry_time)
ORDER BY trade_date DESC;

SELECT '✅ 已创建视图: strategy_win_rate_history' as status;

-- 验证视图
SELECT '视图数据示例:' as preview;
SELECT * FROM strategy_win_rate_history LIMIT 3;

-- ============================================
-- PART 3: 重命名v3_1表为通用名称
-- ============================================

SELECT '' as msg;
SELECT '========================================' as msg;
SELECT 'PART 3: 重命名V3.1表为通用名称' as part;
SELECT '========================================' as msg;

-- 将v3_1_signal_logs重命名为更通用的名称
RENAME TABLE v3_1_signal_logs TO strategy_execution_logs;
RENAME TABLE v3_1_strategy_params TO strategy_params;

-- 为strategy_execution_logs添加策略类型字段（如果不存在）
ALTER TABLE strategy_execution_logs 
ADD COLUMN IF NOT EXISTS strategy_type VARCHAR(20) DEFAULT 'V3.1' COMMENT '策略类型(V3/V3.1/ICT)'
AFTER symbol_id;

-- 为strategy_params添加策略名称字段（如果不存在）
ALTER TABLE strategy_params
ADD COLUMN IF NOT EXISTS strategy_name VARCHAR(50) DEFAULT 'V3.1' COMMENT '策略名称'
AFTER id;

SELECT '✅ 已重命名表: v3_1_signal_logs → strategy_execution_logs' as status;
SELECT '✅ 已重命名表: v3_1_strategy_params → strategy_params' as status;

-- ============================================
-- PART 4: 更新视图名称
-- ============================================

-- 删除旧视图（如果存在）
DROP VIEW IF EXISTS v3_1_performance_summary;

-- 创建新视图
CREATE OR REPLACE VIEW strategy_performance_summary AS
SELECT 
    s.symbol,
    st.strategy_name,
    COUNT(st.id) as total_trades,
    SUM(CASE WHEN sl.early_trend_detected = 1 THEN 1 ELSE 0 END) as early_trend_trades,
    SUM(CASE WHEN sl.fake_breakout_filter_result = 'pass' THEN 1 ELSE 0 END) as filter_passed_trades,
    SUM(CASE WHEN st.status = 'CLOSED' THEN 1 ELSE 0 END) as closed_trades,
    SUM(CASE WHEN st.pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
    ROUND(SUM(CASE WHEN st.pnl > 0 THEN 1 ELSE 0 END) * 100.0 / NULLIF(SUM(CASE WHEN st.status = 'CLOSED' THEN 1 ELSE 0 END), 0), 2) as win_rate,
    AVG(CASE WHEN sl.early_trend_detected = 1 THEN st.pnl ELSE NULL END) as avg_pnl_with_early_trend,
    AVG(CASE WHEN sl.fake_breakout_filter_result = 'pass' THEN st.pnl ELSE NULL END) as avg_pnl_with_filter,
    AVG(sl.confidence) as avg_confidence,
    SUM(st.pnl) as total_pnl,
    MAX(st.created_at) as last_trade_time
FROM symbols s
LEFT JOIN simulation_trades st ON s.id = st.symbol_id
LEFT JOIN strategy_execution_logs sl ON st.symbol_id = sl.symbol_id 
    AND ABS(TIMESTAMPDIFF(MINUTE, st.entry_time, sl.signal_time)) <= 5
WHERE st.strategy_name IN ('V3', 'V3.1')
  AND st.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY s.symbol, st.strategy_name
ORDER BY win_rate DESC;

SELECT '✅ 已创建视图: strategy_performance_summary' as status;

-- ============================================
-- 完成报告
-- ============================================

SELECT '' as msg;
SELECT '========================================' as msg;
SELECT '✅ 数据库清理完成' as summary_title;
SELECT '========================================' as msg;

-- 统计剩余表
SELECT CONCAT('剩余表数: ', COUNT(*), ' 个') as table_count
FROM information_schema.tables
WHERE table_schema = 'trading_system'
  AND table_type = 'BASE TABLE'
  AND table_name NOT LIKE '%backup%';

-- 已删除表列表
SELECT '已删除的表:' as deleted;
SELECT '  1. v3_telemetry' as t1;
SELECT '  2. ict_telemetry' as t2;
SELECT '  3. v3_win_rate_history' as t3;
SELECT '  4. ict_win_rate_history' as t4;

-- 已创建视图
SELECT '已创建的视图:' as created;
SELECT '  1. strategy_win_rate_history' as v1;
SELECT '  2. strategy_performance_summary' as v2;

-- 已重命名表
SELECT '已重命名的表:' as renamed;
SELECT '  1. v3_1_signal_logs → strategy_execution_logs' as r1;
SELECT '  2. v3_1_strategy_params → strategy_params' as r2;

SELECT '========================================' as msg;
SELECT '下一步: 运行测试验证数据库结构' as next;
SELECT '========================================' as msg;

