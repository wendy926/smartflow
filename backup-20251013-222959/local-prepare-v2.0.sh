#!/bin/bash

###############################################################################
# 本地端 - V2.0发布准备脚本
# 
# 功能：
# 1. 验证所有文件已创建
# 2. 检查代码修改
# 3. 提交到Git
# 4. 创建标签
# 5. 推送到GitHub
#
# 在本地执行：
#   cd /Users/kaylame/KaylaProject/smartflow/trading-system-v2
#   chmod +x local-prepare-v2.0.sh
#   ./local-prepare-v2.0.sh
###############################################################################

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

VERSION="2.0.0"
TAG_NAME="v${VERSION}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  V2.0 本地发布准备${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# ============================================
# Step 1: 验证文件完整性
# ============================================

echo -e "${YELLOW}[1/6] 验证文件完整性...${NC}"

required_files=(
  # V3.1核心模块
  "src/strategies/v3-1-early-trend.js"
  "src/strategies/v3-1-fake-breakout-filter.js"
  "src/strategies/v3-1-dynamic-stop-loss.js"
  "src/strategies/v3-strategy-v3-1-integrated.js"
  
  # 数据库操作
  "src/database/v3-1-operations.js"
  "src/database/unified-monitoring-operations.js"
  
  # 数据库Schema
  "database/v3.1-optimization-schema.sql"
  "database/execute-cleanup-v2.0.sql"
  
  # 测试
  "tests/v3-1-early-trend.test.js"
  "tests/v3-1-fake-breakout-filter.test.js"
  "tests/v3-1-dynamic-stop-loss.test.js"
  
  # 文档
  "RELEASE_NOTES_v2.0.md"
  "V2.0_RELEASE_GUIDE.md"
  "DATABASE_CLEANUP_SUMMARY.md"
  
  # 脚本
  "release-v2.0.sh"
  "vps-cleanup-and-deploy-v2.0.sh"
)

missing_count=0
for file in "${required_files[@]}"; do
  if [ ! -f "$file" ]; then
    echo -e "${RED}✗ 缺失: $file${NC}"
    missing_count=$((missing_count + 1))
  fi
done

if [ $missing_count -eq 0 ]; then
  echo -e "${GREEN}✓ 所有${#required_files[@]}个必需文件都存在${NC}"
else
  echo -e "${RED}✗ 缺失${missing_count}个文件${NC}"
  exit 1
fi

echo ""

# ============================================
# Step 2: 检查代码修改
# ============================================

echo -e "${YELLOW}[2/6] 检查代码修改...${NC}"

# 检查package.json版本
version_in_file=$(grep '"version"' package.json | head -1 | sed 's/.*: "\(.*\)".*/\1/')
if [ "$version_in_file" = "$VERSION" ]; then
  echo -e "${GREEN}✓ package.json版本正确: ${VERSION}${NC}"
else
  echo -e "${RED}✗ package.json版本错误: ${version_in_file} (期望: ${VERSION})${NC}"
  exit 1
fi

# 检查main.js是否禁用了新币监控
if grep -q "// this.app.use('/api/v1/new-coin-monitor'" src/main.js; then
  echo -e "${GREEN}✓ 新币监控路由已禁用${NC}"
else
  echo -e "${YELLOW}⚠️  新币监控路由可能未禁用${NC}"
fi

echo ""

# ============================================
# Step 3: 显示Git状态
# ============================================

echo -e "${YELLOW}[3/6] Git状态检查...${NC}"

git status --short | head -20

file_count=$(git status --short | wc -l | tr -d ' ')
echo -e "${BLUE}总计: ${file_count} 个文件有变更${NC}"

echo ""

# ============================================
# Step 4: 提交代码
# ============================================

echo -e "${YELLOW}[4/6] 准备提交代码...${NC}"
echo ""

read -p "是否提交所有变更? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
  git add .
  
  commit_message="Release v${VERSION} - V3.1 Optimization + Database Cleanup

✨ V3.1策略优化:
- 早期趋势探测模块 (v3-1-early-trend.js)
- 假突破过滤器 (v3-1-fake-breakout-filter.js)
- 动态止损策略 (v3-1-dynamic-stop-loss.js)
- V3.1集成策略 (v3-strategy-v3-1-integrated.js)

🗄️ 数据库优化:
- 新增 strategy_execution_logs 表（完整决策链日志）
- 新增 strategy_params 表（21个可配置参数）
- 扩展 simulation_trades 表（26个V3.1字段）
- 删除 4个冗余表（v3_telemetry等）
- 创建 strategy_win_rate_history 视图

🧪 测试覆盖:
- 早期趋势探测测试（8个用例）
- 假突破过滤器测试（10个用例）
- 动态止损测试（15个用例）

📝 文档完善:
- 数据库表分析和优化方案
- 完整的执行指南和脚本
- 发布说明和操作手册

🚀 代码优化:
- 禁用新币监控路由（功能未使用）
- 创建统一监控操作模块
- 完整JSDoc注释

Release Date: $(date +%Y-%m-%d)
Status: Ready for Deployment"

  git commit -m "$commit_message"
  echo -e "${GREEN}✓ 代码已提交${NC}"
else
  echo -e "${YELLOW}跳过提交${NC}"
fi

echo ""

# ============================================
# Step 5: 创建Git标签
# ============================================

echo -e "${YELLOW}[5/6] 创建Git标签 ${TAG_NAME}...${NC}"
echo ""

# 检查标签是否已存在
if git rev-parse "${TAG_NAME}" >/dev/null 2>&1; then
  echo -e "${YELLOW}⚠️  标签 ${TAG_NAME} 已存在${NC}"
  read -p "是否删除并重新创建? (y/N): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    git tag -d "${TAG_NAME}"
    echo -e "${GREEN}✓ 旧标签已删除${NC}"
  else
    echo -e "${YELLOW}跳过创建标签${NC}"
    TAG_NAME=""
  fi
fi

if [ -n "${TAG_NAME}" ]; then
  tag_message="SmartFlow v${VERSION} - V3.1 Strategy Optimization + Database Cleanup

🚀 核心优化:
1. 早期趋势探测 - 提前捕捉趋势起点
2. 假突破过滤器 - 多因子验证提升信号质量
3. 动态止损策略 - 置信度分层精细化管理

🗄️ 数据库优化:
- 删除4个冗余表（-16%）
- 新增完整决策链日志
- 21个可配置参数
- 创建实时计算视图

📊 预期提升:
- 胜率: +5-10%
- 期望值: +15-20%
- 信号质量: 减少30-40%无效信号

🔗 详情: RELEASE_NOTES_v2.0.md

Release Date: $(date +%Y-%m-%d)"

  git tag -a "${TAG_NAME}" -m "${tag_message}"
  echo -e "${GREEN}✓ 标签 ${TAG_NAME} 创建成功${NC}"
fi

echo ""

# ============================================
# Step 6: 推送到GitHub
# ============================================

echo -e "${YELLOW}[6/6] 准备推送到GitHub...${NC}"
echo ""

echo -e "${BLUE}将要执行:${NC}"
echo -e "  1. git push origin main"
if [ -n "${TAG_NAME}" ]; then
  echo -e "  2. git push origin ${TAG_NAME}"
fi
echo ""

read -p "确认推送到GitHub? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}推送代码...${NC}"
  git push origin main
  
  if [ -n "${TAG_NAME}" ]; then
    echo -e "${YELLOW}推送标签...${NC}"
    git push origin "${TAG_NAME}"
  fi
  
  echo -e "${GREEN}✓ 已推送到GitHub${NC}"
  
  echo ""
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}  ✅ V2.0发布准备完成！${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo ""
  
  echo -e "${BLUE}GitHub链接:${NC}"
  echo -e "  https://github.com/wendy926/smartflow/releases/tag/${TAG_NAME}"
  echo ""
  
  echo -e "${BLUE}下一步操作:${NC}"
  echo -e "  1. 在GitHub上基于 ${TAG_NAME} 创建Release"
  echo -e "  2. 复制 RELEASE_NOTES_v2.0.md 到Release说明"
  echo -e "  3. SSH到VPS执行部署:"
  echo -e "     ssh -i ~/.ssh/smartflow_vps_new root@47.237.163.85"
  echo -e "     cd /home/admin/trading-system-v2/trading-system-v2"
  echo -e "     git fetch --tags"
  echo -e "     git checkout ${TAG_NAME}"
  echo -e "     ./vps-cleanup-and-deploy-v2.0.sh"
  echo ""
else
  echo -e "${YELLOW}✗ 取消推送${NC}"
  echo ""
  echo -e "${BLUE}提示: 稍后可手动推送:${NC}"
  echo -e "  git push origin main"
  if [ -n "${TAG_NAME}" ]; then
    echo -e "  git push origin ${TAG_NAME}"
  fi
fi

echo ""

