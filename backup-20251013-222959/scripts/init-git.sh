#!/bin/bash

# Git仓库初始化脚本 - 交易系统V2.0
# GitHub仓库: https://github.com/UpMeAI/trade_strategy.git

set -e

echo "🔧 初始化Git仓库..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置变量
GITHUB_REPO="https://github.com/UpMeAI/trade_strategy.git"
PROJECT_DIR="/Users/kaylame/KaylaProject/smartflow/trading-system-v2"

cd "$PROJECT_DIR"

echo -e "${YELLOW}📋 Git配置:${NC}"
echo "  仓库地址: $GITHUB_REPO"
echo "  项目目录: $PROJECT_DIR"
echo ""

# 检查是否已经是Git仓库
if [ -d ".git" ]; then
    echo -e "${YELLOW}⚠️  项目已经是Git仓库，跳过初始化${NC}"
    echo "当前远程仓库:"
    git remote -v
    echo ""
    echo "是否要重新设置远程仓库？(y/N)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo "🔄 重新设置远程仓库..."
        git remote remove origin 2>/dev/null || true
        git remote add origin "$GITHUB_REPO"
        echo -e "${GREEN}✅ 远程仓库已重新设置${NC}"
    fi
else
    echo "🔧 初始化Git仓库..."
    git init
    
    echo "🔗 添加远程仓库..."
    git remote add origin "$GITHUB_REPO"
    
    echo -e "${GREEN}✅ Git仓库初始化完成${NC}"
fi

echo "📝 检查Git状态..."
git status

echo ""
echo -e "${YELLOW}📋 下一步操作:${NC}"
echo "  1. 添加文件到暂存区: git add ."
echo "  2. 提交更改: git commit -m 'Initial commit: Trading System V2.0'"
echo "  3. 推送到GitHub: git push -u origin main"
echo ""
echo -e "${YELLOW}🔧 常用Git命令:${NC}"
echo "  git status                    # 查看状态"
echo "  git add .                     # 添加所有文件"
echo "  git commit -m 'message'       # 提交更改"
echo "  git push                      # 推送到远程"
echo "  git pull                      # 拉取更新"
echo "  git log --oneline             # 查看提交历史"
echo "  git branch                    # 查看分支"
echo "  git checkout -b feature-name  # 创建新分支"
echo ""
echo -e "${GREEN}✅ Git仓库配置完成！${NC}"
