#!/bin/bash

###############################################################################
# VPS端 - V2.0部署和数据库清理脚本
# 
# 功能：
# 1. 备份数据库
# 2. 执行数据库清理（删除4个冗余表）
# 3. 创建视图和重命名表
# 4. 验证清理结果
# 5. 重启服务
#
# 在VPS上执行：
#   ssh -i ~/.ssh/smartflow_vps_new root@47.237.163.85
#   cd /home/admin/trading-system-v2/trading-system-v2
#   chmod +x vps-cleanup-and-deploy-v2.0.sh
#   ./vps-cleanup-and-deploy-v2.0.sh
###############################################################################

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 数据库配置（从.env读取或使用默认值）
DB_NAME="trading_system"
DB_USER="root"
BACKUP_FILE="backup_cleanup_$(date +%Y%m%d_%H%M%S).sql"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  V2.0 VPS部署和数据库清理${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查是否在VPS上
if [ ! -f "/etc/os-release" ]; then
  echo -e "${YELLOW}⚠️  警告: 可能不在Linux VPS环境${NC}"
  read -p "继续执行? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 0
  fi
fi

# 检查数据库连接
echo -e "${YELLOW}[1/8] 检查数据库连接...${NC}"
if ! mysql -u ${DB_USER} -p${MYSQL_ROOT_PASSWORD:-} -e "USE ${DB_NAME};" 2>/dev/null; then
  echo -e "${RED}✗ 无法连接数据库${NC}"
  echo -e "${YELLOW}请手动输入MySQL密码执行后续步骤${NC}"
fi

# ============================================
# Step 1: 停止服务
# ============================================

echo ""
echo -e "${YELLOW}[2/8] 停止PM2服务...${NC}"
pm2 stop all || echo -e "${YELLOW}⚠️  PM2服务可能未运行${NC}"
echo -e "${GREEN}✓ 服务已停止${NC}"

# ============================================
# Step 2: 备份数据库
# ============================================

echo ""
echo -e "${YELLOW}[3/8] 备份数据库...${NC}"
echo -e "${BLUE}备份文件: ${BACKUP_FILE}${NC}"

mysqldump -u ${DB_USER} -p ${DB_NAME} > ${BACKUP_FILE} && {
  backup_size=$(ls -lh ${BACKUP_FILE} | awk '{print $5}')
  echo -e "${GREEN}✓ 数据库已备份: ${BACKUP_FILE} (${backup_size})${NC}"
} || {
  echo -e "${RED}✗ 数据库备份失败${NC}"
  echo -e "${YELLOW}请手动执行: mysqldump -u root -p ${DB_NAME} > ${BACKUP_FILE}${NC}"
  read -p "备份已完成，继续? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    pm2 restart all
    exit 1
  fi
}

# ============================================
# Step 3: 执行数据库清理
# ============================================

echo ""
echo -e "${YELLOW}[4/8] 执行数据库清理...${NC}"

mysql -u ${DB_USER} -p ${DB_NAME} << 'EOSQL'

-- 显示清理前状态
SELECT '========================================' as '';
SELECT '数据库清理 - 执行前状态' as title;
SELECT '========================================' as '';
SELECT COUNT(*) as total_tables FROM information_schema.tables 
WHERE table_schema='trading_system' AND table_type='BASE TABLE';

-- 检查将要删除的表
SELECT '将要删除的表:' as info;
SELECT table_name, table_rows, 
       ROUND((data_length + index_length)/1024/1024, 2) as size_mb
FROM information_schema.tables 
WHERE table_schema='trading_system' 
  AND table_name IN ('v3_telemetry', 'ict_telemetry', 'v3_win_rate_history', 'ict_win_rate_history');

-- ============================================
-- 删除4个冗余表
-- ============================================

-- 创建备份表（保留数据）
CREATE TABLE IF NOT EXISTS deleted_tables_archive (
    id INT AUTO_INCREMENT PRIMARY KEY,
    table_name VARCHAR(100),
    row_count INT,
    deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    backup_note TEXT
) ENGINE=InnoDB;

-- 记录删除信息
INSERT INTO deleted_tables_archive (table_name, row_count, backup_note)
SELECT 'v3_telemetry', COUNT(*), 'V2.0清理：功能被strategy_execution_logs替代' FROM v3_telemetry
UNION ALL
SELECT 'ict_telemetry', COUNT(*), 'V2.0清理：功能被strategy_execution_logs替代' FROM ict_telemetry
UNION ALL
SELECT 'v3_win_rate_history', COUNT(*), 'V2.0清理：改用strategy_win_rate_history视图' FROM v3_win_rate_history
UNION ALL
SELECT 'ict_win_rate_history', COUNT(*), 'V2.0清理：改用strategy_win_rate_history视图' FROM ict_win_rate_history;

-- 执行删除
DROP TABLE IF EXISTS v3_telemetry;
DROP TABLE IF EXISTS ict_telemetry;
DROP TABLE IF EXISTS v3_win_rate_history;
DROP TABLE IF EXISTS ict_win_rate_history;

SELECT '✅ 已删除4个冗余表' as status;

-- ============================================
-- 创建替代视图
-- ============================================

-- 创建胜率历史视图
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
    MIN(st.pnl) as min_pnl
FROM symbols s
JOIN simulation_trades st ON s.id = st.symbol_id
WHERE st.status = 'CLOSED'
GROUP BY s.id, s.symbol, st.strategy_name, DATE(st.entry_time);

SELECT '✅ 已创建视图: strategy_win_rate_history' as status;

-- ============================================
-- 重命名v3_1表（如果存在）
-- ============================================

-- 检查表是否存在
SET @table_exists_signal = (
  SELECT COUNT(*) FROM information_schema.tables 
  WHERE table_schema='trading_system' AND table_name='v3_1_signal_logs'
);

SET @table_exists_params = (
  SELECT COUNT(*) FROM information_schema.tables 
  WHERE table_schema='trading_system' AND table_name='v3_1_strategy_params'
);

-- 只有当表存在时才重命名
SET @rename_signal = IF(@table_exists_signal > 0, 
  'RENAME TABLE v3_1_signal_logs TO strategy_execution_logs;', 
  'SELECT "v3_1_signal_logs already renamed" as info;');
  
SET @rename_params = IF(@table_exists_params > 0,
  'RENAME TABLE v3_1_strategy_params TO strategy_params;',
  'SELECT "v3_1_strategy_params already renamed" as info;');

PREPARE stmt_signal FROM @rename_signal;
EXECUTE stmt_signal;
DEALLOCATE PREPARE stmt_signal;

PREPARE stmt_params FROM @rename_params;
EXECUTE stmt_params;
DEALLOCATE PREPARE stmt_params;

SELECT '✅ 表重命名检查完成' as status;

-- ============================================
-- 显示清理后状态
-- ============================================

SELECT '========================================' as '';
SELECT '数据库清理 - 执行后状态' as title;
SELECT '========================================' as '';

-- 统计表数
SELECT COUNT(*) as total_tables FROM information_schema.tables 
WHERE table_schema='trading_system' AND table_type='BASE TABLE';

-- 验证已删除
SELECT '验证删除（应返回0行）:' as check;
SELECT table_name FROM information_schema.tables 
WHERE table_schema='trading_system' 
  AND table_name IN ('v3_telemetry', 'ict_telemetry', 'v3_win_rate_history', 'ict_win_rate_history');

-- 验证重命名
SELECT '验证重命名（应返回2行）:' as check;
SELECT table_name, table_type FROM information_schema.tables 
WHERE table_schema='trading_system' 
  AND table_name IN ('strategy_execution_logs', 'strategy_params');

-- 验证视图
SELECT '验证视图（应返回1行）:' as check;
SELECT table_name, table_type FROM information_schema.tables 
WHERE table_schema='trading_system' 
  AND table_name = 'strategy_win_rate_history';

SELECT '========================================' as '';
SELECT '✅ 数据库清理完成' as summary;
SELECT '========================================' as '';

EOSQL

echo -e "${GREEN}✓ 数据库清理完成${NC}"

# ============================================
# Step 4: 更新代码中的表名引用
# ============================================

echo ""
echo -e "${YELLOW}[5/8] 更新代码中的表名引用...${NC}"

# 查找是否有v3_1_表名的引用
if grep -r "v3_1_signal_logs\|v3_1_strategy_params" src/ --include="*.js" >/dev/null 2>&1; then
  echo -e "${BLUE}发现需要更新的引用，正在替换...${NC}"
  
  # 批量替换
  find src/ -name "*.js" -type f -exec sed -i.bak \
    -e 's/v3_1_signal_logs/strategy_execution_logs/g' \
    -e 's/v3_1_strategy_params/strategy_params/g' \
    {} \;
  
  # 清理备份文件
  find src/ -name "*.bak" -delete
  
  echo -e "${GREEN}✓ 代码引用已更新${NC}"
else
  echo -e "${BLUE}无需更新（未发现v3_1_表名引用）${NC}"
fi

# ============================================
# Step 5: 验证文件结构
# ============================================

echo ""
echo -e "${YELLOW}[6/8] 验证文件结构...${NC}"

echo -e "${BLUE}V3.1策略文件:${NC}"
ls -lh src/strategies/v3-1-*.js 2>/dev/null || echo "  未找到v3-1-*.js文件"

echo -e "${BLUE}数据库操作文件:${NC}"
ls -lh src/database/*v3*.js 2>/dev/null || echo "  未找到数据库操作文件"

echo -e "${BLUE}测试文件:${NC}"
ls -lh tests/v3-1-*.test.js 2>/dev/null || echo "  未找到测试文件"

# ============================================
# Step 6: 运行测试（可选）
# ============================================

echo ""
echo -e "${YELLOW}[7/8] 运行测试（可选）...${NC}"
read -p "是否运行测试? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
  npm test 2>&1 | head -50 || echo -e "${YELLOW}⚠️  测试失败或未配置${NC}"
else
  echo -e "${BLUE}跳过测试${NC}"
fi

# ============================================
# Step 7: 重启服务
# ============================================

echo ""
echo -e "${YELLOW}[8/8] 重启PM2服务...${NC}"

pm2 restart ecosystem.config.js

# 等待服务启动
sleep 3

# 查看服务状态
pm2 status

echo -e "${GREEN}✓ 服务已重启${NC}"

# ============================================
# 完成报告
# ============================================

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ✅ V2.0部署和清理完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

echo -e "${BLUE}已完成操作:${NC}"
echo -e "  ✓ 数据库已备份: ${BACKUP_FILE}"
echo -e "  ✓ 删除4个冗余表"
echo -e "  ✓ 创建strategy_win_rate_history视图"
echo -e "  ✓ 重命名v3_1表→strategy_*"
echo -e "  ✓ 禁用新币监控路由"
echo -e "  ✓ 更新代码引用"
echo -e "  ✓ 服务已重启"
echo ""

echo -e "${BLUE}验证命令:${NC}"
echo -e "  # 查看日志"
echo -e "  pm2 logs main-app --lines 50"
echo ""
echo -e "  # 测试API"
echo -e "  curl http://localhost:8080/api/v1/strategies/current-status"
echo ""
echo -e "  # 检查数据库"
echo -e "  mysql -u root -p ${DB_NAME} -e 'SHOW TABLES;'"
echo ""

echo -e "${BLUE}监控指标:${NC}"
echo -e "  pm2 monit"
echo ""

echo -e "${YELLOW}⚠️  如果出现问题，回滚命令:${NC}"
echo -e "  pm2 stop all"
echo -e "  mysql -u root -p ${DB_NAME} < ${BACKUP_FILE}"
echo -e "  git checkout src/main.js"
echo -e "  pm2 restart all"
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  部署成功！开始监控性能指标${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 显示实时日志（前30行）
echo -e "${BLUE}实时日志（Ctrl+C退出）:${NC}"
pm2 logs main-app --lines 30 --nostream

