#!/bin/bash

# VPS更新脚本 - 交易系统V2.0
# 用于快速更新代码到VPS

set -e

echo "🔄 开始更新交易系统V2.0到VPS..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置变量
VPS_HOST="47.237.163.85"
VPS_USER="root"
SSH_KEY="~/.ssh/smartflow_vps_correct"
PROJECT_DIR="/home/admin/trading-system-v2"

echo -e "${YELLOW}📋 更新配置:${NC}"
echo "  VPS: $VPS_HOST"
echo "  用户: $VPS_USER"
echo "  项目目录: $PROJECT_DIR"
echo ""

# 检查SSH密钥
if [ ! -f "$SSH_KEY" ]; then
    echo -e "${RED}❌ SSH密钥不存在: $SSH_KEY${NC}"
    exit 1
fi

echo -e "${YELLOW}📤 步骤1: 上传更新代码...${NC}"

# 创建临时更新目录
TEMP_DIR="/tmp/trading-system-v2-update-$(date +%s)"
mkdir -p "$TEMP_DIR"

# 复制项目文件（排除node_modules等）
rsync -av --exclude='node_modules' --exclude='.git' --exclude='logs' --exclude='coverage' \
    /Users/kaylame/KaylaProject/smartflow/trading-system-v2/ "$TEMP_DIR/"

# 上传到VPS
echo "📤 上传更新文件到VPS..."
rsync -av -e "ssh -i $SSH_KEY" "$TEMP_DIR/" "$VPS_USER@$VPS_HOST:$PROJECT_DIR/"

# 清理临时目录
rm -rf "$TEMP_DIR"

echo -e "${YELLOW}🔧 步骤2: 在VPS上更新服务...${NC}"

ssh -i "$SSH_KEY" "$VPS_USER@$VPS_HOST" << EOF
set -e

cd $PROJECT_DIR

echo "📦 安装/更新依赖..."
npm install --production

echo "🔄 重启服务..."
pm2 restart all

echo "📊 检查服务状态..."
pm2 status

echo "📝 查看最新日志..."
pm2 logs --lines 20

echo "✅ 更新完成！"
EOF

echo -e "${GREEN}🎉 更新完成！${NC}"
echo ""
echo -e "${YELLOW}📋 更新信息:${NC}"
echo "  🌐 访问地址: https://smart.aimaventop.com"
echo "  📊 PM2状态: pm2 status"
echo "  📝 查看日志: pm2 logs"
echo ""
echo -e "${YELLOW}🔧 常用命令:${NC}"
echo "  ssh -i $SSH_KEY $VPS_USER@$VPS_HOST"
echo "  cd $PROJECT_DIR"
echo "  pm2 restart all"
echo "  pm2 logs --lines 100"
echo ""
echo -e "${GREEN}✅ 交易系统V2.0已成功更新！${NC}"
