#!/bin/bash

# VPS部署脚本
# 使用方法: ./scripts/deploy-to-vps.sh

set -e

VPS_HOST="47.237.163.85"
VPS_USER="root"
SSH_KEY="~/.ssh/smartflow_vps_new"
PROJECT_DIR="/home/admin/trading-system-v2"
GIT_REPO="https://github.com/wendy926/smartflow.git"

echo "🚀 开始部署交易系统到VPS..."

# 检查SSH连接
echo "📡 检查SSH连接..."
if ! ssh -i $SSH_KEY -o ConnectTimeout=10 $VPS_USER@$VPS_HOST "echo 'SSH连接成功'"; then
    echo "❌ SSH连接失败，请先配置SSH密钥"
    echo "公钥内容："
    cat ~/.ssh/smartflow_vps_new.pub
    echo ""
    echo "请在VPS上执行以下命令添加公钥："
    echo "mkdir -p ~/.ssh && chmod 700 ~/.ssh"
    echo "echo '$(cat ~/.ssh/smartflow_vps_new.pub)' >> ~/.ssh/authorized_keys"
    echo "chmod 600 ~/.ssh/authorized_keys && chown -R root:root ~/.ssh"
    exit 1
fi

echo "✅ SSH连接成功"

# 在VPS上执行部署命令
echo "🔧 在VPS上执行部署..."
ssh -i $SSH_KEY $VPS_USER@$VPS_HOST << 'EOF'
set -e

echo "📦 更新系统包..."
apt update && apt upgrade -y

echo "🔧 安装必要软件..."
apt install -y curl wget git nginx mysql-server redis-server

echo "📥 安装Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

echo "📥 安装PM2..."
npm install -g pm2

echo "📁 创建项目目录..."
mkdir -p /home/admin
cd /home/admin

echo "📥 克隆代码仓库..."
if [ -d "trading-system-v2" ]; then
    echo "🔄 更新现有代码..."
    cd trading-system-v2
    git pull origin main
else
    echo "📥 克隆新代码..."
    git clone https://github.com/wendy926/smartflow.git trading-system-v2
    cd trading-system-v2
fi

echo "📦 安装依赖..."
npm install

echo "🗄️ 配置数据库..."
# 启动MySQL服务
systemctl start mysql
systemctl enable mysql

# 创建数据库和用户
mysql -e "CREATE DATABASE IF NOT EXISTS trading_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS 'trading_user'@'localhost' IDENTIFIED BY 'Trading@2024!';"
mysql -e "GRANT ALL PRIVILEGES ON trading_system.* TO 'trading_user'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

# 初始化数据库表
mysql -u trading_user -p'Trading@2024!' trading_system < database/init.sql

echo "🔧 配置Redis..."
systemctl start redis-server
systemctl enable redis-server

echo "🔧 配置Nginx..."
cp config/nginx/nginx.conf /etc/nginx/sites-available/trading-system
ln -sf /etc/nginx/sites-available/trading-system /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "🔧 配置环境变量..."
cp env.example .env
sed -i 's/PORT=3000/PORT=8080/' .env
sed -i 's/DB_HOST=localhost/DB_HOST=localhost/' .env
sed -i 's/DB_USER=root/DB_USER=trading_user/' .env
sed -i 's/DB_PASSWORD=password/DB_PASSWORD=Trading@2024!/' .env
sed -i 's/DB_NAME=trading_system/DB_NAME=trading_system/' .env

echo "🧪 运行测试..."
npm test

echo "🚀 启动服务..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

echo "✅ 部署完成！"
echo "🌐 访问地址: http://47.237.163.85"
echo "📊 PM2状态: pm2 status"
echo "📝 查看日志: pm2 logs"

EOF

echo "🎉 部署完成！"
echo "🌐 访问地址: http://47.237.163.85"
echo "📊 检查服务状态: ssh -i $SSH_KEY $VPS_USER@$VPS_HOST 'pm2 status'"
echo "📝 查看日志: ssh -i $SSH_KEY $VPS_USER@$VPS_HOST 'pm2 logs'"
