#!/bin/bash

# CN VPS 部署脚本
# IP: 121.41.228.109
# 域名: smart.aimaven.top

VPS_IP="121.41.228.109"
DOMAIN="smart.aimaven.top"

echo "=================================================="
echo "CN VPS 部署脚本"
echo "=================================================="
echo "IP: $VPS_IP"
echo "域名: $DOMAIN"
echo ""

# 1. 更新系统
echo "1. 更新系统..."
yum update -y

# 2. 安装必要软件
echo "2. 安装必要软件..."
yum install -y git nodejs npm nginx certbot python3-certbot-nginx

# 3. 配置Node.js版本
echo "3. 配置Node.js..."
npm install -g n
n lts

# 4. 配置Nginx
echo "4. 配置Nginx..."
cat > /etc/nginx/conf.d/smart.conf << 'EOF'
server {
    listen 80;
    server_name smart.aimaven.top;
    
    location / {
        return 301 https://$host$request_uri;
    }
}
EOF

# 5. 启动Nginx
echo "5. 启动Nginx..."
systemctl start nginx
systemctl enable nginx

# 6. 配置SSL证书（需要先配置DNS）
echo "6. 配置SSL证书..."
certbot --nginx -d smart.aimaven.top --non-interactive --agree-tos --email admin@aimaven.top

# 7. 部署应用程序
echo "7. 部署应用程序..."
cd /home/admin
git clone https://github.com/wendy926/smartflow.git trading-system-v2

# 8. 安装依赖
cd trading-system-v2
npm install

# 9. 配置环境变量
cat > .env << 'ENV'
NODE_ENV=production
REGION=CN
PORT=8080

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=SmartFlow@2024
DB_NAME=trading_system

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
ENV

# 10. 初始化数据库
mysql -u root -p < trading-system-v2/database/users_schema.sql
mysql -u root -p < trading-system-v2/database/verification_codes_schema.sql

# 11. 安装PM2
npm install -g pm2

# 12. 启动应用
cd trading-system-v2
pm2 start ecosystem.config.js

# 13. 配置防火墙
echo "13. 配置防火墙..."
firewall-cmd --permanent --add-port=80/tcp
firewall-cmd --permanent --add-port=443/tcp
firewall-cmd --permanent --add-port=8080/tcp
firewall-cmd --reload

echo ""
echo "=================================================="
echo "部署完成！"
echo "=================================================="
echo "域名: https://$DOMAIN"
echo ""
echo "后续步骤："
echo "1. 确认DNS解析已生效"
echo "2. 运行此脚本完成部署"
echo "3. 访问 https://$DOMAIN 查看系统"
echo "=================================================="

