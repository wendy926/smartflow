#!/bin/bash

# CN VPS完整部署脚本
set -e

echo "============================================"
echo "CN VPS 完整部署开始"
echo "============================================"
echo ""

# 连接到CN VPS并执行部署
ssh -i ~/.ssh/smartflow_vps_cn root@121.41.228.109 << 'ENDSSH'

echo "=== 1. 安装基础软件 ==="
yum update -y
yum install -y git nginx redis

# 安装Node.js (使用nvm)
if [ ! -d "$HOME/.nvm" ]; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
fi

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# 安装Node.js 18
nvm install 18
nvm use 18
npm install -g pm2

echo "=== 2. 克隆代码 ==="
if [ -d "/home/admin/trading-system-v2" ]; then
    cd /home/admin/trading-system-v2
    git pull origin main
else
    cd /home/admin
    git clone https://github.com/wendy926/smartflow.git trading-system-v2
fi

echo "=== 3. 安装项目依赖 ==="
cd /home/admin/trading-system-v2/trading-system-v2
npm install

echo "=== 4. 配置环境变量 ==="
cat > .env << 'EOF'
# 环境配置
NODE_ENV=production
REGION=CN
PORT=8080

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=smartflow

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT配置
JWT_SECRET=your_jwt_secret_key_here

# AI服务配置
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_ENABLED=true
CLAUDE_API_KEY=your_claude_api_key
CLAUDE_ENABLED=true
EOF

echo "=== 5. 配置Nginx ==="
cat > /etc/nginx/conf.d/smartflow.conf << 'EOF'
server {
    listen 80;
    server_name smart.aimaven.top;

    # 重定向到HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name smart.aimaven.top;

    # SSL证书配置（使用Let's Encrypt）
    ssl_certificate /etc/nginx/ssl/smartflow.crt;
    ssl_certificate_key /etc/nginx/ssl/smartflow.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # 静态文件
    root /home/admin/trading-system-v2/trading-system-v2/src/web;
    index index.html home.html;

    # API代理
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 静态文件
    location / {
        try_files $uri $uri/ =404;
    }

    # WebSocket支持
    location /socket.io/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF

# 创建SSL证书目录
mkdir -p /etc/nginx/ssl

# 生成临时自签名证书（生产环境应该使用Let's Encrypt）
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/smartflow.key \
    -out /etc/nginx/ssl/smartflow.crt \
    -subj "/C=CN/ST=ZJ/L=HZ/O=SmartFlow/OU=IT/CN=smart.aimaven.top"

echo "=== 6. 配置防火墙 ==="
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload

echo "=== 7. 启动服务 ==="
systemctl enable nginx
systemctl start nginx
systemctl enable redis
systemctl start redis

# 重启应用
cd /home/admin/trading-system-v2/trading-system-v2
pm2 delete main-app || true
pm2 start src/main.js --name main-app --max-restarts 10

pm2 save
pm2 startup

echo "=== 8. 部署完成 ==="
echo "请完成以下配置："
echo "1. 编辑 .env 文件，填入正确的数据库密码和API密钥"
echo "2. 配置域名DNS指向: 121.41.228.109"
echo "3. 使用Let's Encrypt替换自签名证书"
echo ""
echo "vi /home/admin/trading-system-v2/trading-system-v2/.env"
echo ""

ENDSSH

echo ""
echo "============================================"
echo "部署脚本执行完成"
echo "============================================"
echo ""
echo "后续步骤："
echo "1. SSH登录到CN VPS: ssh -i ~/.ssh/smartflow_vps_cn root@121.41.228.109"
echo "2. 编辑环境变量: vi /home/admin/trading-system-v2/trading-system-v2/.env"
echo "3. 重启服务: cd /home/admin/trading-system-v2/trading-system-v2 && pm2 restart all"
echo "4. 查看日志: pm2 logs"

