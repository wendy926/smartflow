#!/bin/bash

# VPS部署脚本 - 交易系统V2.0
# 域名: https://smart.aimaventop.com/
# 端口: 8080

set -e

echo "🚀 开始部署交易系统V2.0到VPS..."

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
DOMAIN="smart.aimaventop.com"

echo -e "${YELLOW}📋 部署配置:${NC}"
echo "  VPS: $VPS_HOST"
echo "  用户: $VPS_USER"
echo "  项目目录: $PROJECT_DIR"
echo "  域名: $DOMAIN"
echo "  端口: 8080"
echo ""

# 检查SSH密钥
if [ ! -f "$SSH_KEY" ]; then
    echo -e "${RED}❌ SSH密钥不存在: $SSH_KEY${NC}"
    exit 1
fi

echo -e "${YELLOW}🔧 步骤1: 连接VPS并准备环境...${NC}"

# 连接到VPS并执行部署
ssh -i "$SSH_KEY" "$VPS_USER@$VPS_HOST" << 'EOF'
set -e

echo "📦 更新系统包..."
apt update && apt upgrade -y

echo "🔧 安装必要软件..."
apt install -y nginx mysql-server redis-server nodejs npm git certbot python3-certbot-nginx

echo "📁 创建项目目录..."
mkdir -p /home/admin/trading-system-v2
cd /home/admin/trading-system-v2

echo "🗄️ 配置MySQL..."
systemctl start mysql
systemctl enable mysql

# 创建数据库和用户
mysql -e "CREATE DATABASE IF NOT EXISTS trading_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS 'trading_user'@'localhost' IDENTIFIED BY 'Trading@2024!';"
mysql -e "GRANT ALL PRIVILEGES ON trading_system.* TO 'trading_user'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

echo "🔴 配置Redis..."
systemctl start redis-server
systemctl enable redis-server

# 配置Redis内存限制
echo "maxmemory 80mb" >> /etc/redis/redis.conf
echo "maxmemory-policy allkeys-lru" >> /etc/redis/redis.conf
systemctl restart redis-server

echo "🌐 配置Nginx..."
# 备份原配置
cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup

# 创建新的nginx配置
cat > /etc/nginx/sites-available/trading-system << 'NGINX_EOF'
# 上游服务器配置
upstream trading_system {
    server 127.0.0.1:8080;
    keepalive 32;
}

# HTTP重定向到HTTPS
server {
    listen 80;
    server_name smart.aimaventop.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS主配置
server {
    listen 443 ssl http2;
    server_name smart.aimaventop.com;

    # SSL证书配置
    ssl_certificate /etc/letsencrypt/live/smart.aimaventop.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/smart.aimaventop.com/privkey.pem;
    
    # SSL安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # 安全头
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # 日志配置
    access_log /var/log/nginx/trading_system_access.log;
    error_log /var/log/nginx/trading_system_error.log;

    # 客户端配置
    client_max_body_size 10M;
    client_body_timeout 60s;
    client_header_timeout 60s;

    # 代理配置
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
    proxy_buffer_size 4k;
    proxy_buffers 8 4k;
    proxy_busy_buffers_size 8k;

    # 静态文件缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options nosniff;
        try_files $uri @proxy;
    }

    # API路由
    location /api/ {
        proxy_pass http://trading_system;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket支持
    location /socket.io/ {
        proxy_pass http://trading_system;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 健康检查
    location /health {
        proxy_pass http://trading_system;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        access_log off;
    }

    # 主应用路由
    location / {
        try_files $uri @proxy;
    }

    # 代理到应用服务器
    location @proxy {
        proxy_pass http://trading_system;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 安全配置
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    location ~ \.(env|log|sql|conf)$ {
        deny all;
        access_log off;
        log_not_found off;
    }
}
NGINX_EOF

# 启用站点
ln -sf /etc/nginx/sites-available/trading-system /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 测试nginx配置
nginx -t

echo "🔐 获取SSL证书..."
certbot --nginx -d smart.aimaventop.com --non-interactive --agree-tos --email admin@aimaventop.com

echo "🔄 重启服务..."
systemctl restart nginx
systemctl enable nginx

echo "📊 配置MySQL优化..."
cat >> /etc/mysql/mysql.conf.d/mysqld.cnf << 'MYSQL_EOF'

# 交易系统优化配置
[mysqld]
innodb_buffer_pool_size = 150M
innodb_log_file_size = 16M
innodb_log_buffer_size = 8M
innodb_flush_log_at_trx_commit = 2
innodb_flush_method = O_DIRECT
query_cache_size = 8M
query_cache_type = 1
tmp_table_size = 8M
max_heap_table_size = 8M
max_connections = 50
table_open_cache = 200
thread_cache_size = 8
key_buffer_size = 16M
read_buffer_size = 256K
read_rnd_buffer_size = 256K
sort_buffer_size = 256K
MYSQL_EOF

systemctl restart mysql

echo "📈 安装PM2..."
npm install -g pm2

echo "✅ VPS环境准备完成！"
EOF

echo -e "${GREEN}✅ VPS环境准备完成！${NC}"

echo -e "${YELLOW}📤 步骤2: 上传项目代码...${NC}"

# 创建临时部署目录
TEMP_DIR="/tmp/trading-system-v2-$(date +%s)"
mkdir -p "$TEMP_DIR"

# 复制项目文件（排除node_modules等）
rsync -av --exclude='node_modules' --exclude='.git' --exclude='logs' --exclude='coverage' \
    /Users/kaylame/KaylaProject/smartflow/trading-system-v2/ "$TEMP_DIR/"

# 上传到VPS
echo "📤 上传项目文件到VPS..."
rsync -av -e "ssh -i $SSH_KEY" "$TEMP_DIR/" "$VPS_USER@$VPS_HOST:$PROJECT_DIR/"

# 清理临时目录
rm -rf "$TEMP_DIR"

echo -e "${YELLOW}🔧 步骤3: 在VPS上安装依赖和启动服务...${NC}"

ssh -i "$SSH_KEY" "$VPS_USER@$VPS_HOST" << EOF
set -e

cd $PROJECT_DIR

echo "📦 安装项目依赖..."
npm install --production

echo "📁 创建必要目录..."
mkdir -p logs data/database

echo "🔧 设置环境变量..."
cp env.example .env

echo "🗄️ 初始化数据库..."
mysql -u trading_user -p'Trading@2024!' trading_system < database/init.sql

echo "🚀 启动服务..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

echo "📊 检查服务状态..."
pm2 status

echo "🌐 检查Nginx状态..."
systemctl status nginx --no-pager

echo "🔴 检查Redis状态..."
systemctl status redis-server --no-pager

echo "🗄️ 检查MySQL状态..."
systemctl status mysql --no-pager

echo "✅ 部署完成！"
echo "🌐 访问地址: https://smart.aimaventop.com"
echo "📊 PM2状态: pm2 status"
echo "📝 查看日志: pm2 logs"
EOF

echo -e "${GREEN}🎉 部署完成！${NC}"
echo ""
echo -e "${YELLOW}📋 部署信息:${NC}"
echo "  🌐 访问地址: https://smart.aimaventop.com"
echo "  🔌 主服务端口: 8080"
echo "  📊 监控: pm2 status"
echo "  📝 日志: pm2 logs"
echo ""
echo -e "${YELLOW}🔧 常用命令:${NC}"
echo "  ssh -i $SSH_KEY $VPS_USER@$VPS_HOST"
echo "  cd $PROJECT_DIR"
echo "  pm2 restart all"
echo "  pm2 logs --lines 100"
echo "  systemctl status nginx"
echo ""
echo -e "${GREEN}✅ 交易系统V2.0已成功部署到VPS！${NC}"
