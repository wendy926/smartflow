#!/bin/bash

###############################################################################
# 聪明钱跟踪功能集成脚本
# 自动修改main.js和index.html，集成聪明钱功能
###############################################################################

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================="
echo "  聪明钱跟踪功能集成"
echo "========================================="
echo ""

# 1. 备份文件
echo -e "${YELLOW}[1/4] 备份原文件...${NC}"
cp src/main.js src/main.js.backup_smartmoney
cp src/web/index.html src/web/index.html.backup_smartmoney
echo -e "${GREEN}✓ 文件已备份${NC}"

# 2. 修改main.js
echo -e "${YELLOW}[2/4] 修改main.js...${NC}"

# 2.1 添加导入（在第20行附近）
sed -i.tmp "/const MacroMonitorController/a\\
const SmartMoneyDetector = require('./services/smart-money-detector');" src/main.js

# 2.2 添加属性初始化（在constructor中）
sed -i.tmp "/this.macroMonitor = null;/a\\
    this.smartMoneyDetector = null;" src/main.js

# 2.3 添加路由注册
sed -i.tmp "/this.app.use('\/api\/v1\/macro-monitor'/a\\
    this.app.use('/api/v1/smart-money', require('./api/routes/smart-money'));" src/main.js

# 2.4 添加服务初始化（在setupDatabase中的macroMonitor初始化后）
sed -i.tmp "/await this.macroMonitor.start();/a\\
\\
      // 初始化聪明钱检测器\\
      this.smartMoneyDetector = new SmartMoneyDetector(database);\\
      await this.smartMoneyDetector.initialize();\\
      this.app.set('smartMoneyDetector', this.smartMoneyDetector);\\
      logger.info('聪明钱检测器启动成功');" src/main.js

rm -f src/main.js.tmp

echo -e "${GREEN}✓ main.js已修改${NC}"

# 3. 修改index.html（添加导航和页面内容）
echo -e "${YELLOW}[3/4] 修改index.html...${NC}"

# 这部分需要手动完成，因为HTML结构复杂
echo -e "${YELLOW}⚠️  index.html需要手动添加以下内容:${NC}"
echo ""
echo "1. 在导航栏添加:"
echo '   <li class="nav-item">'
echo '     <a href="#/smart-money" class="nav-link" data-page="smart-money">'
echo '       💰 聪明钱跟踪'
echo '     </a>'
echo '   </li>'
echo ""
echo "2. 在</body>前添加:"
echo '   <script src="/public/js/smart-money.js"></script>'
echo '   <link rel="stylesheet" href="/public/css/smart-money.css">'
echo ""

# 4. 验证文件
echo -e "${YELLOW}[4/4] 验证文件...${NC}"

files=(
  "database/smart-money-tracking-schema.sql"
  "src/services/smart-money-detector.js"
  "src/api/routes/smart-money.js"
  "src/web/public/js/smart-money.js"
  "src/web/public/css/smart-money.css"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo -e "${GREEN}✓ $file${NC}"
  else
    echo -e "${YELLOW}⚠️  $file 不存在${NC}"
  fi
done

echo ""
echo "========================================="
echo -e "${GREEN}  集成准备完成${NC}"
echo "========================================="
echo ""
echo "下一步:"
echo "1. 手动修改 src/web/index.html（添加导航和页面）"
echo "2. 提交代码"
echo "3. 部署到VPS"
echo ""

