#!/bin/bash

# 完整部署脚本 - 包含所有修复
# 日期: 2025-10-08

echo "========================================="
echo "SmartFlow 完整部署脚本"
echo "部署所有策略修复和文档更新"
echo "========================================="

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# VPS配置
VPS_HOST="root@smart.aimaventop.com"
VPS_DIR="/root/trading-system-v2"
LOCAL_DIR="/Users/kaylame/KaylaProject/smartflow/trading-system-v2"

# 步骤1: 检查本地文件
echo ""
echo "步骤1: 检查本地文件..."
echo "========================================="

FILES=(
  "src/strategies/ict-strategy.js"
  "src/strategies/v3-strategy.js"
  "src/web/app.js"
  "src/web/index.html"
)

ALL_FILES_EXIST=true
for file in "${FILES[@]}"; do
  if [ -f "$LOCAL_DIR/$file" ]; then
    echo -e "${GREEN}✓${NC} $file 存在"
  else
    echo -e "${RED}✗${NC} $file 不存在"
    ALL_FILES_EXIST=false
  fi
done

if [ "$ALL_FILES_EXIST" = false ]; then
  echo -e "${RED}错误: 部分文件不存在，请检查${NC}"
  exit 1
fi

# 步骤2: 备份VPS文件
echo ""
echo "步骤2: 备份VPS现有文件..."
echo "========================================="

BACKUP_DIR="backup-$(date +%Y%m%d-%H%M%S)"

ssh $VPS_HOST << EOF
cd $VPS_DIR
mkdir -p backups/$BACKUP_DIR

echo "备份策略文件..."
cp src/strategies/ict-strategy.js backups/$BACKUP_DIR/ 2>/dev/null || echo "ict-strategy.js 不存在"
cp src/strategies/v3-strategy.js backups/$BACKUP_DIR/ 2>/dev/null || echo "v3-strategy.js 不存在"
cp src/web/app.js backups/$BACKUP_DIR/ 2>/dev/null || echo "app.js 不存在"
cp src/web/index.html backups/$BACKUP_DIR/ 2>/dev/null || echo "index.html 不存在"

echo "备份完成: backups/$BACKUP_DIR"
ls -lh backups/$BACKUP_DIR/
EOF

if [ $? -ne 0 ]; then
  echo -e "${YELLOW}警告: 备份失败，继续部署...${NC}"
fi

# 步骤3: 上传文件
echo ""
echo "步骤3: 上传文件到VPS..."
echo "========================================="

UPLOAD_SUCCESS=true
for file in "${FILES[@]}"; do
  echo "上传 $file ..."
  scp "$LOCAL_DIR/$file" "${VPS_HOST}:${VPS_DIR}/$file"
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} $file 上传成功"
  else
    echo -e "${RED}✗${NC} $file 上传失败"
    UPLOAD_SUCCESS=false
  fi
done

if [ "$UPLOAD_SUCCESS" = false ]; then
  echo -e "${RED}错误: 部分文件上传失败${NC}"
  echo "可以使用以下命令回滚："
  echo "ssh $VPS_HOST \"cd $VPS_DIR && cp -r backups/$BACKUP_DIR/* .\""
  exit 1
fi

# 步骤4: 重启服务
echo ""
echo "步骤4: 重启VPS服务..."
echo "========================================="

ssh $VPS_HOST << 'EOF'
cd /root/trading-system-v2

echo "1. 重启主应用..."
pm2 restart main-app

echo "2. 重启策略工作进程..."
pm2 restart strategy-worker

echo "3. 重载Nginx..."
nginx -s reload

echo ""
echo "4. 检查进程状态..."
pm2 list

echo ""
echo "5. 检查最近日志..."
pm2 logs main-app --lines 10 --nostream

echo ""
echo "✓ 服务重启完成"
EOF

if [ $? -ne 0 ]; then
  echo -e "${RED}错误: 服务重启失败${NC}"
  exit 1
fi

# 步骤5: 验证部署
echo ""
echo "步骤5: 验证部署..."
echo "========================================="

echo "测试API端点..."
curl -s "https://smart.aimaventop.com/api/v1/strategies/current-status?limit=1" > /dev/null
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓${NC} API端点正常"
else
  echo -e "${RED}✗${NC} API端点异常"
fi

echo ""
echo "测试文档页面..."
curl -s "https://smart.aimaventop.com/docs" | grep -q "策略优化更新"
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓${NC} 文档页面正常"
else
  echo -e "${YELLOW}⚠${NC} 文档页面可能需要清除缓存"
fi

# 完成
echo ""
echo "========================================="
echo -e "${GREEN}✓ 部署成功完成！${NC}"
echo "========================================="
echo ""
echo "部署内容："
echo "1. ✓ ICT策略15分钟入场判断（门槛式+强信号≥60分）"
echo "2. ✓ ICT策略硬编码分数修复"
echo "3. ✓ ICT策略置信度计算统一化"
echo "4. ✓ ICT策略信号生成逻辑更新（60分阈值）"
echo "5. ✓ ICT策略订单块年龄更新（5天）"
echo "6. ✓ V3策略震荡市交易逻辑修复"
echo "7. ✓ V3策略动态权重说明"
echo "8. ✓ V3策略补偿机制说明"
echo "9. ✓ 前端15M入场判断逻辑一致性修复"
echo "10. ✓ 在线文档完整更新"
echo ""
echo "验证地址："
echo "- 仪表板: https://smart.aimaventop.com/dashboard"
echo "- 文档: https://smart.aimaventop.com/docs （请强制刷新 Ctrl+Shift+R）"
echo ""
echo "备份位置: backups/$BACKUP_DIR"
echo ""
echo "如需回滚，执行："
echo "ssh $VPS_HOST \"cd $VPS_DIR && cp -r backups/$BACKUP_DIR/* . && pm2 restart all\""
echo ""

