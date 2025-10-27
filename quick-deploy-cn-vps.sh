#!/bin/bash

# CN VPS快速部署脚本
set -e

echo "============================================"
echo "CN VPS 快速部署"
echo "============================================"

# 连接到CN VPS执行部署
ssh -i ~/.ssh/smartflow_vps_cn root@121.41.228.109 << 'ENDSSH'

cd /home/admin/trading-system-v2

echo "=== 1. 安装Node.js和PM2 ==="
if [ ! -d "$HOME/.nvm" ]; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
fi

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# 安装Node.js 18
nvm install 18
nvm use 18
npm install -g pm2

echo "=== 2. 安装项目依赖 ==="
npm install

echo "=== 3. 配置环境变量 ==="
if [ ! -f .env ]; then
    cat > .env << 'EOF'
# 环境配置
NODE_ENV=production
REGION=CN
PORT=8080

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=请修改为实际密码
DB_NAME=smartflow

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT配置
JWT_SECRET=请生成随机密钥

# AI服务配置（CN VPS主要使用DeepSeek）
DEEPSEEK_API_KEY=请填入实际API密钥
DEEPSEEK_ENABLED=true
CLAUDE_API_KEY=
CLAUDE_ENABLED=false
EOF
    echo "✅ .env文件已创建"
else
    echo "ℹ️ .env文件已存在"
fi

echo "=== 4. 配置Nginx（如果未安装） ==="
if ! command -v nginx &> /dev/null; then
    yum install -y nginx
    systemctl enable nginx
    systemctl start nginx
fi

echo "=== 5. 部署说明 ==="
echo ""
echo "✅ 基础部署完成！"
echo ""
echo "📝 接下来请手动完成："
echo ""
echo "1. 编辑环境变量文件："
echo "   vi /home/admin/trading-system-v2/.env"
echo ""
echo "2. 配置MySQL数据库："
echo "   - 创建数据库: CREATE DATABASE smartflow;"
echo "   - 导入SQL: 查看database/schema.sql"
echo ""
echo "3. 配置Nginx："
echo "   查看部署指南中的Nginx配置"
echo ""
echo "4. 启动应用："
echo "   cd /home/admin/trading-system-v2"
echo "   pm2 start src/main.js --name smartflow-cn"
echo ""
echo "5. 查看日志："
echo "   pm2 logs smartflow-cn"

ENDSSH

echo ""
echo "============================================"
echo "部署脚本执行完成"
echo "============================================"

