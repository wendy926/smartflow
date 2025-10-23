#!/bin/bash

# 部署ICT和V3策略修复到VPS
# 日期: 2025-10-08

echo "========================================="
echo "部署策略修复到VPS"
echo "========================================="

# VPS配置
VPS_HOST="root@smart.aimaventop.com"
VPS_DIR="/root/trading-system-v2"

# 文件列表
FILES=(
  "src/strategies/ict-strategy.js"
  "src/strategies/v3-strategy.js"
  "src/web/app.js"
  "src/web/index.html"
)

echo ""
echo "步骤1: 上传修复文件到VPS..."
echo "========================================="

for file in "${FILES[@]}"; do
  echo "上传 $file ..."
  scp "./$file" "${VPS_HOST}:${VPS_DIR}/$file"
  
  if [ $? -eq 0 ]; then
    echo "✓ $file 上传成功"
  else
    echo "✗ $file 上传失败"
    exit 1
  fi
done

echo ""
echo "步骤2: 重启VPS服务..."
echo "========================================="

ssh $VPS_HOST << 'EOF'
cd /root/trading-system-v2

echo "重启主应用..."
pm2 restart main-app

echo "重启策略工作进程..."
pm2 restart strategy-worker

echo "重载Nginx..."
nginx -s reload

echo "检查进程状态..."
pm2 status

echo ""
echo "✓ 服务重启完成"
EOF

if [ $? -eq 0 ]; then
  echo ""
  echo "========================================="
  echo "✓ 部署成功完成！"
  echo "========================================="
  echo ""
  echo "修复内容："
  echo "1. ✓ ICT策略15分钟入场判断（门槛式+强信号≥60分）"
  echo "2. ✓ ICT策略硬编码分数修复"
  echo "3. ✓ ICT策略置信度计算统一化"
  echo "4. ✓ V3策略震荡市交易逻辑修复"
  echo "5. ✓ 前端15M入场判断逻辑一致性修复"
  echo "6. ✓ 在线文档更新（策略优化更新章节）"
  echo ""
  echo "验证地址："
  echo "- 仪表板: https://smart.aimaventop.com/dashboard"
  echo "- 文档: https://smart.aimaventop.com/docs"
  echo ""
else
  echo ""
  echo "✗ 部署过程中出现错误"
  exit 1
fi

