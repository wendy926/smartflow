#!/bin/bash

###############################################################################
# SmartFlow Trading System - Release v2.0.0 Script
# 
# 功能：
# 1. 提交所有V3.1优化代码
# 2. 创建v2.0.0标签
# 3. 推送到GitHub
#
# 使用方法：
#   chmod +x release-v2.0.sh
#   ./release-v2.0.sh
###############################################################################

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 版本信息
VERSION="2.0.0"
TAG_NAME="v${VERSION}"
RELEASE_DATE=$(date +"%Y-%m-%d")

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  SmartFlow Release v${VERSION}${NC}"
echo -e "${BLUE}  V3.1 Strategy Optimization${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 1. 检查Git状态
echo -e "${YELLOW}[1/6] 检查Git状态...${NC}"
if [ -d ".git" ]; then
    echo -e "${GREEN}✓ Git仓库已初始化${NC}"
else
    echo -e "${RED}✗ 错误: 不是Git仓库${NC}"
    exit 1
fi

# 检查是否有未提交的更改
if [[ -n $(git status -s) ]]; then
    echo -e "${YELLOW}发现未提交的更改${NC}"
    git status -s
else
    echo -e "${GREEN}✓ 工作目录干净${NC}"
fi

echo ""

# 2. 添加所有更改
echo -e "${YELLOW}[2/6] 添加所有更改到暂存区...${NC}"
git add .

# 显示将要提交的文件
echo -e "${BLUE}将要提交的文件:${NC}"
git diff --cached --name-status | head -20
file_count=$(git diff --cached --name-status | wc -l)
echo -e "${BLUE}... 共 ${file_count} 个文件${NC}"

echo ""

# 3. 提交更改
echo -e "${YELLOW}[3/6] 提交更改...${NC}"
commit_message="Release v${VERSION} - V3.1 Strategy Optimization

✨ 新增功能:
- 早期趋势探测模块 (v3-1-early-trend.js)
- 假突破过滤器模块 (v3-1-fake-breakout-filter.js)
- 动态止损策略模块 (v3-1-dynamic-stop-loss.js)
- V3.1策略集成 (v3-strategy-v3-1-integrated.js)

🗄️ 数据库增强:
- 新增 v3_1_signal_logs 表
- 新增 v3_1_strategy_params 表
- 扩展 simulation_trades 表（26个新字段）
- 新增存储过程和视图

🧪 测试覆盖:
- 早期趋势探测测试（8个用例）
- 假突破过滤器测试（10个用例）
- 动态止损测试（15个用例）

📝 文档完善:
- 更新 CHANGELOG.md
- 更新 package.json (v2.0.0)
- 新增 RELEASE_NOTES_v2.0.md
- 完整的代码注释和JSDoc

🎯 性能预期:
- 胜率提升: +5-10%
- 期望值提升: +15-20%
- 信号质量: 减少30-40%无效信号

Release Date: ${RELEASE_DATE}
Status: Ready for Testing"

git commit -m "${commit_message}" || {
    echo -e "${YELLOW}⚠ 没有新的更改需要提交（可能已经提交过）${NC}"
}

echo -e "${GREEN}✓ 代码已提交${NC}"
echo ""

# 4. 创建标签
echo -e "${YELLOW}[4/6] 创建Git标签 ${TAG_NAME}...${NC}"

# 检查标签是否已存在
if git rev-parse "${TAG_NAME}" >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠ 标签 ${TAG_NAME} 已存在${NC}"
    read -p "是否删除并重新创建? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git tag -d "${TAG_NAME}"
        echo -e "${GREEN}✓ 旧标签已删除${NC}"
    else
        echo -e "${RED}✗ 取消创建标签${NC}"
        exit 1
    fi
fi

# 创建带注释的标签
tag_message="SmartFlow v${VERSION} - V3.1 Strategy Optimization

🚀 主要优化:
1. 早期趋势探测 - 提前捕捉趋势起点
2. 假突破过滤器 - 提高信号质量
3. 动态止损策略 - 精细化风险管理

📊 预期提升:
- 胜率: +5-10%
- 期望值: +15-20%
- 信号质量: 减少30-40%无效信号

🔗 详情: RELEASE_NOTES_v2.0.md

Release Date: ${RELEASE_DATE}"

git tag -a "${TAG_NAME}" -m "${tag_message}"
echo -e "${GREEN}✓ 标签 ${TAG_NAME} 创建成功${NC}"
echo ""

# 5. 显示标签信息
echo -e "${YELLOW}[5/6] 标签信息:${NC}"
git show "${TAG_NAME}" --quiet
echo ""

# 6. 推送到远程仓库
echo -e "${YELLOW}[6/6] 准备推送到GitHub...${NC}"
echo -e "${BLUE}将要执行的操作:${NC}"
echo -e "  1. git push origin main"
echo -e "  2. git push origin ${TAG_NAME}"
echo ""

read -p "确认推送到GitHub? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}推送代码到main分支...${NC}"
    git push origin main || {
        echo -e "${RED}✗ 推送main分支失败${NC}"
        echo -e "${YELLOW}请检查网络连接和GitHub权限${NC}"
        exit 1
    }
    echo -e "${GREEN}✓ 代码已推送${NC}"
    
    echo -e "${YELLOW}推送标签 ${TAG_NAME}...${NC}"
    git push origin "${TAG_NAME}" || {
        echo -e "${RED}✗ 推送标签失败${NC}"
        echo -e "${YELLOW}请检查网络连接和GitHub权限${NC}"
        exit 1
    }
    echo -e "${GREEN}✓ 标签已推送${NC}"
    
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  ✅ Release v${VERSION} 发布成功!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${BLUE}GitHub标签页面:${NC}"
    echo -e "  https://github.com/wendy926/smartflow/releases/tag/${TAG_NAME}"
    echo ""
    echo -e "${BLUE}下一步操作:${NC}"
    echo -e "  1. 在GitHub上创建Release（基于标签 ${TAG_NAME}）"
    echo -e "  2. 复制 RELEASE_NOTES_v2.0.md 内容到Release说明"
    echo -e "  3. 部署到VPS进行测试验证"
    echo ""
else
    echo -e "${YELLOW}✗ 取消推送${NC}"
    echo -e "${BLUE}提示: 代码和标签已在本地创建，但未推送到GitHub${NC}"
    echo -e "${BLUE}稍后可手动推送:${NC}"
    echo -e "  git push origin main"
    echo -e "  git push origin ${TAG_NAME}"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  本地标签列表:${NC}"
git tag -l "v*" | tail -5
echo -e "${BLUE}========================================${NC}"

