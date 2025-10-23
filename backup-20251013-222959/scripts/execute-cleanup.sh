#!/bin/bash

###############################################################################
# V2.0数据库清理 - 一键执行脚本
# 
# 功能：
# 1. 备份数据库
# 2. 删除4个无引用的冗余表
# 3. 创建视图替代胜率历史表
# 4. 禁用新币监控路由
# 5. 重命名v3_1表为通用名称
#
# 使用方法：
#   cd /Users/kaylame/KaylaProject/smartflow/trading-system-v2
#   chmod +x scripts/execute-cleanup.sh
#   ./scripts/execute-cleanup.sh
###############################################################################

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_FILE="backup_cleanup_$(date +%Y%m%d_%H%M%S).sql"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  V2.0 数据库清理执行${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
  echo -e "${RED}错误: 请在项目根目录执行此脚本${NC}"
  exit 1
fi

echo -e "${YELLOW}将要执行的操作:${NC}"
echo -e "  1. 备份数据库到: ${BACKUP_FILE}"
echo -e "  2. 删除4个无引用的表"
echo -e "  3. 创建2个替代视图"
echo -e "  4. 重命名2个v3_1表为通用名称"
echo -e "  5. 禁用新币监控路由"
echo ""

read -p "确认继续? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}取消执行${NC}"
  exit 0
fi

# ============================================
# Step 1: 备份数据库
# ============================================

echo ""
echo -e "${YELLOW}[1/5] 备份数据库...${NC}"

mysqldump -u root -p trading_system > "${BACKUP_FILE}" 2>&1 || {
  echo -e "${RED}✗ 数据库备份失败${NC}"
  exit 1
}

backup_size=$(ls -lh "${BACKUP_FILE}" | awk '{print $5}')
echo -e "${GREEN}✓ 数据库已备份: ${BACKUP_FILE} (${backup_size})${NC}"

# ============================================
# Step 2: 执行数据库清理SQL
# ============================================

echo ""
echo -e "${YELLOW}[2/5] 执行数据库清理...${NC}"

mysql -u root -p trading_system << 'EOSQL'

-- 检查将要删除的表
SELECT '检查表数据量:' as info;
SELECT 'v3_telemetry' as table_name, COUNT(*) as rows FROM v3_telemetry
UNION ALL
SELECT 'ict_telemetry', COUNT(*) FROM ict_telemetry
UNION ALL  
SELECT 'v3_win_rate_history', COUNT(*) FROM v3_win_rate_history
UNION ALL
SELECT 'ict_win_rate_history', COUNT(*) FROM ict_win_rate_history;

-- 删除表
DROP TABLE IF EXISTS v3_telemetry;
DROP TABLE IF EXISTS ict_telemetry;
DROP TABLE IF EXISTS v3_win_rate_history;
DROP TABLE IF EXISTS ict_win_rate_history;

SELECT '✅ 已删除4个冗余表' as status;

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
    SUM(st.pnl) as total_pnl
FROM symbols s
JOIN simulation_trades st ON s.id = st.symbol_id
WHERE st.status = 'CLOSED'
GROUP BY s.id, s.symbol, st.strategy_name, DATE(st.entry_time);

SELECT '✅ 已创建视图: strategy_win_rate_history' as status;

-- 重命名v3_1表
RENAME TABLE v3_1_signal_logs TO strategy_execution_logs;
RENAME TABLE v3_1_strategy_params TO strategy_params;

SELECT '✅ 已重命名表: v3_1_* → strategy_*' as status;

EOSQL

echo -e "${GREEN}✓ 数据库清理完成${NC}"

# ============================================
# Step 3: 禁用新币监控路由
# ============================================

echo ""
echo -e "${YELLOW}[3/5] 禁用新币监控路由...${NC}"

# 备份main.js
cp src/main.js src/main.js.backup_$(date +%Y%m%d)

# 注释掉new-coin-monitor路由
sed -i.tmp "s|this.app.use('/api/v1/new-coin-monitor'|// this.app.use('/api/v1/new-coin-monitor'|" src/main.js
sed -i.tmp "s|'/new-coin-monitor'|// '/new-coin-monitor'|" src/main.js
rm -f src/main.js.tmp

echo -e "${GREEN}✓ 已禁用新币监控路由${NC}"

# ============================================
# Step 4: 更新代码中的表名引用
# ============================================

echo ""
echo -e "${YELLOW}[4/5] 更新代码中的表名引用...${NC}"

# 查找需要更新的文件
files_to_update=$(grep -rl "v3_1_signal_logs\|v3_1_strategy_params" src/ --include="*.js" || true)

if [ -n "$files_to_update" ]; then
  echo -e "${BLUE}需要更新的文件:${NC}"
  echo "$files_to_update"
  
  # 批量替换
  echo "$files_to_update" | while read file; do
    if [ -f "$file" ]; then
      # 备份
      cp "$file" "${file}.backup_$(date +%Y%m%d)"
      
      # 替换表名
      sed -i.tmp 's/v3_1_signal_logs/strategy_execution_logs/g' "$file"
      sed -i.tmp 's/v3_1_strategy_params/strategy_params/g' "$file"
      rm -f "${file}.tmp"
      
      echo -e "${GREEN}✓ 已更新: $file${NC}"
    fi
  done
else
  echo -e "${BLUE}无需更新代码（表名未在代码中直接使用）${NC}"
fi

# ============================================
# Step 5: 验证清理结果
# ============================================

echo ""
echo -e "${YELLOW}[5/5] 验证清理结果...${NC}"

mysql -u root -p trading_system << 'EOSQL'
SELECT '========================================' as '';
SELECT '数据库清理验证报告' as report;
SELECT '========================================' as '';

-- 检查已删除的表
SELECT '已删除的表检查:' as check_deleted;
SELECT CASE 
  WHEN COUNT(*) = 0 THEN '✅ 4个表已成功删除'
  ELSE CONCAT('❌ 还有 ', COUNT(*), ' 个表未删除')
END as result
FROM information_schema.tables 
WHERE table_schema='trading_system' 
  AND table_name IN ('v3_telemetry', 'ict_telemetry', 'v3_win_rate_history', 'ict_win_rate_history');

-- 检查重命名的表
SELECT '重命名的表检查:' as check_renamed;
SELECT table_name, table_type
FROM information_schema.tables 
WHERE table_schema='trading_system' 
  AND table_name IN ('strategy_execution_logs', 'strategy_params');

-- 检查视图
SELECT '视图检查:' as check_views;
SELECT table_name, table_type
FROM information_schema.tables 
WHERE table_schema='trading_system' 
  AND table_name = 'strategy_win_rate_history';

-- 统计当前表数
SELECT '当前表统计:' as stats;
SELECT 
  COUNT(*) as total_tables,
  SUM(CASE WHEN table_type='BASE TABLE' THEN 1 ELSE 0 END) as base_tables,
  SUM(CASE WHEN table_type='VIEW' THEN 1 ELSE 0 END) as views
FROM information_schema.tables 
WHERE table_schema='trading_system';

SELECT '========================================' as '';
EOSQL

# ============================================
# 完成提示
# ============================================

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ✅ 清理完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}已完成:${NC}"
echo -e "  ✓ 数据库已备份: ${BACKUP_FILE}"
echo -e "  ✓ 删除4个冗余表"
echo -e "  ✓ 创建2个替代视图"
echo -e "  ✓ 重命名v3_1表"
echo -e "  ✓ 禁用新币监控路由"
echo ""
echo -e "${BLUE}下一步操作:${NC}"
echo -e "  1. 运行测试: npm test"
echo -e "  2. 重启服务: pm2 restart ecosystem.config.js"
echo -e "  3. 检查日志: pm2 logs"
echo -e "  4. 验证功能正常"
echo ""
echo -e "${YELLOW}⚠️  如果出现问题，回滚命令:${NC}"
echo -e "  mysql -u root -p trading_system < ${BACKUP_FILE}"
echo -e "  cp src/main.js.backup_$(date +%Y%m%d) src/main.js"
echo -e "  pm2 restart all"
echo ""

