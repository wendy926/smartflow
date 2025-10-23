-- V2.0 简化数据库清理脚本
-- 执行前请确保已备份！

USE trading_system;

-- ============================================
-- Step 1: 检查将要删除的表
-- ============================================

SELECT 'Checking tables to delete...' as info;

SELECT COUNT(*) INTO @v3_tele_count FROM v3_telemetry;
SELECT COUNT(*) INTO @ict_tele_count FROM ict_telemetry;
SELECT COUNT(*) INTO @v3_win_count FROM v3_win_rate_history;
SELECT COUNT(*) INTO @ict_win_count FROM ict_win_rate_history;

SELECT 'v3_telemetry' as table_name, @v3_tele_count as row_count
UNION ALL SELECT 'ict_telemetry', @ict_tele_count
UNION ALL SELECT 'v3_win_rate_history', @v3_win_count
UNION ALL SELECT 'ict_win_rate_history', @ict_win_count;

-- ============================================
-- Step 2: 删除4个冗余表
-- ============================================

DROP TABLE IF EXISTS v3_telemetry;
DROP TABLE IF EXISTS ict_telemetry;
DROP TABLE IF EXISTS v3_win_rate_history;
DROP TABLE IF EXISTS ict_win_rate_history;

SELECT 'Deleted 4 redundant tables' as status;

-- ============================================
-- Step 3: 创建胜率历史视图
-- ============================================

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
    SUM(st.pnl) as total_pnl
FROM symbols s
JOIN simulation_trades st ON s.id = st.symbol_id
WHERE st.status = 'CLOSED'
GROUP BY s.id, s.symbol, st.strategy_name, DATE(st.entry_time);

SELECT 'Created view: strategy_win_rate_history' as status;

-- ============================================
-- Step 4: 重命名v3_1表（如果存在）
-- ============================================

-- 检查表是否存在再重命名
DROP PROCEDURE IF EXISTS RenameTableIfExists;

DELIMITER //
CREATE PROCEDURE RenameTableIfExists()
BEGIN
    DECLARE table_count INT;
    
    -- 检查v3_1_signal_logs
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_schema='trading_system' AND table_name='v3_1_signal_logs';
    
    IF table_count > 0 THEN
        RENAME TABLE v3_1_signal_logs TO strategy_execution_logs;
        SELECT 'Renamed: v3_1_signal_logs -> strategy_execution_logs' as status;
    ELSE
        SELECT 'Table v3_1_signal_logs not found or already renamed' as status;
    END IF;
    
    -- 检查v3_1_strategy_params
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_schema='trading_system' AND table_name='v3_1_strategy_params';
    
    IF table_count > 0 THEN
        RENAME TABLE v3_1_strategy_params TO strategy_params;
        SELECT 'Renamed: v3_1_strategy_params -> strategy_params' as status;
    ELSE
        SELECT 'Table v3_1_strategy_params not found or already renamed' as status;
    END IF;
END //
DELIMITER ;

CALL RenameTableIfExists();
DROP PROCEDURE RenameTableIfExists;

-- ============================================
-- Step 5: 验证清理结果
-- ============================================

SELECT 'Verification Results:' as info;

-- 检查已删除的表
SELECT COUNT(*) as deleted_tables_remaining FROM information_schema.tables 
WHERE table_schema='trading_system' 
  AND table_name IN ('v3_telemetry', 'ict_telemetry', 'v3_win_rate_history', 'ict_win_rate_history');

-- 检查重命名的表
SELECT COUNT(*) as renamed_tables_exist FROM information_schema.tables 
WHERE table_schema='trading_system' 
  AND table_name IN ('strategy_execution_logs', 'strategy_params');

-- 检查视图
SELECT COUNT(*) as views_created FROM information_schema.tables 
WHERE table_schema='trading_system' 
  AND table_name = 'strategy_win_rate_history';

-- 统计总表数
SELECT COUNT(*) as total_base_tables FROM information_schema.tables 
WHERE table_schema='trading_system' AND table_type='BASE TABLE';

SELECT 'Cleanup completed successfully!' as final_status;

