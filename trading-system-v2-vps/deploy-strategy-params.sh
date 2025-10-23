#!/bin/bash

# 策略参数化调优部署脚本
# 用于在VPS上部署策略参数化功能

set -e

echo "=========================================="
echo "策略参数化调优部署脚本"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 数据库配置
DB_USER="root"
DB_PASS="SmartFlow@2024"
DB_NAME="trading_system"

# 项目目录
PROJECT_DIR="/home/admin/trading-system-v2/trading-system-v2"
DB_DIR="${PROJECT_DIR}/database"

echo -e "${GREEN}[1/6] 备份当前数据库...${NC}"
mysqldump -u${DB_USER} -p${DB_PASS} ${DB_NAME} > "${PROJECT_DIR}/backup_before_params_$(date +%Y%m%d_%H%M%S).sql"
echo -e "${GREEN}✓ 备份完成${NC}"
echo ""

echo -e "${GREEN}[2/6] 执行数据库基础扩展...${NC}"
mysql -u${DB_USER} -p${DB_PASS} ${DB_NAME} < "${DB_DIR}/strategy-parameterization-base.sql"
echo -e "${GREEN}✓ 基础扩展完成${NC}"
echo ""

echo -e "${GREEN}[3/6] 插入激进策略参数...${NC}"
mysql -u${DB_USER} -p${DB_PASS} ${DB_NAME} < "${DB_DIR}/strategy-parameterization-aggressive.sql"
echo -e "${GREEN}✓ 激进策略参数插入完成${NC}"
echo ""

echo -e "${GREEN}[4/6] 插入平衡策略参数...${NC}"
mysql -u${DB_USER} -p${DB_PASS} ${DB_NAME} < "${DB_DIR}/strategy-parameterization-balanced.sql"
echo -e "${GREEN}✓ 平衡策略参数插入完成${NC}"
echo ""

echo -e "${GREEN}[5/6] 插入保守策略参数...${NC}"
mysql -u${DB_USER} -p${DB_PASS} ${DB_NAME} < "${DB_DIR}/strategy-parameterization-conservative.sql"
echo -e "${GREEN}✓ 保守策略参数插入完成${NC}"
echo ""

echo -e "${GREEN}[6/6] 验证数据库扩展...${NC}"
echo "检查 strategy_params 表结构..."
mysql -u${DB_USER} -p${DB_PASS} ${DB_NAME} -e "DESCRIBE strategy_params;" | grep -E "strategy_name|strategy_mode|param_group"
echo ""

echo "检查参数数量..."
AGGRESSIVE_COUNT=$(mysql -u${DB_USER} -p${DB_PASS} ${DB_NAME} -N -e "SELECT COUNT(*) FROM strategy_params WHERE strategy_mode='AGGRESSIVE';")
BALANCED_COUNT=$(mysql -u${DB_USER} -p${DB_PASS} ${DB_NAME} -N -e "SELECT COUNT(*) FROM strategy_params WHERE strategy_mode='BALANCED';")
CONSERVATIVE_COUNT=$(mysql -u${DB_USER} -p${DB_PASS} ${DB_NAME} -N -e "SELECT COUNT(*) FROM strategy_params WHERE strategy_mode='CONSERVATIVE';")

echo -e "${GREEN}激进策略参数: ${AGGRESSIVE_COUNT} 个${NC}"
echo -e "${GREEN}平衡策略参数: ${BALANCED_COUNT} 个${NC}"
echo -e "${GREEN}保守策略参数: ${CONSERVATIVE_COUNT} 个${NC}"
echo ""

echo -e "${GREEN}[7/7] 重启应用服务...${NC}"
cd ${PROJECT_DIR}
pm2 restart main-app
echo -e "${GREEN}✓ 应用服务已重启${NC}"
echo ""

echo "=========================================="
echo -e "${GREEN}部署完成！${NC}"
echo "=========================================="
echo ""
echo "下一步："
echo "1. 访问前端页面: https://smart.aimaventop.com/strategy-params"
echo "2. 测试API接口: curl https://smart.aimaventop.com/api/v1/strategy-params/ICT/BALANCED"
echo "3. 运行单元测试: cd ${PROJECT_DIR} && npm test -- strategy-parameter-manager.test.js"
echo ""

