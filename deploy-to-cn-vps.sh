#!/bin/bash

# ============================================
# CN VPS 自动化部署脚本
# ============================================

set -e

VPS_IP="121.41.228.109"
DOMAIN="smart.aimaven.top"
GITHUB_REPO="https://github.com/wendy926/smartflow.git"
APP_DIR="/home/admin/trading-system-v2"

echo "==========================================="
echo "CN VPS 自动化部署脚本"
echo "==========================================="
echo "IP: $VPS_IP"
echo "域名: $DOMAIN"
echo ""

# 检查是否有SSH访问
echo "正在检查SSH连接..."
if ! ssh -o ConnectTimeout=5 root@$VPS_IP "echo 'SSH连接成功'" 2>/dev/null; then
    echo "❌ 错误: 无法连接到CN VPS"
    echo ""
    echo "请确保："
    echo "1. 服务器IP正确: $VPS_IP"
    echo "2. 可以SSH登录到服务器"
    echo "3. 防火墙允许SSH连接"
    echo ""
    echo "手动连接命令："
    echo "  ssh root@$VPS_IP"
    echo ""
    exit 1
fi

echo "✅ SSH连接成功"
echo ""

# 在服务器上执行部署命令
echo "开始部署..."
ssh root@$VPS_IP << 'ENDSSH'
set -e

echo "==========================================="
echo "步骤 1: 更新系统并安装软件"
echo "==========================================="

# 更新系统
yum update -y -q

# 安装必要软件
yum install -y -q git nginx certbot python3-certbot-nginx

# 安装Node.js 18 LTS
if ! command -v node &> /dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_18.x | bash - -q
    yum install -y -q nodejs
fi

# 安装PM2
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2 --silent
fi

echo "✅ 软件安装完成"
echo ""

echo "==========================================="
echo "步骤 2: 克隆和配置代码"
echo "==========================================="

# 创建目录
mkdir -p /home/admin
cd /home/admin

# 克隆或更新代码
if [ -d "trading-system-v2" ]; then
    echo "更新现有代码..."
    cd trading-system-v2
    git pull origin main -q
else
    echo "克隆代码..."
    git clone https://github.com/wendy926/smartflow.git trading-system-v2 -q
    cd trading-system-v2
fi

# 安装依赖
echo "安装依赖..."
npm install --production --silent

echo "✅ 代码准备完成"
echo ""

echo "==========================================="
echo "步骤 3: 配置环境变量"
echo "==========================================="

# 创建.env文件（如果不存在）
if [ ! -f .env ]; then
    cat > .env << 'EOF'
NODE_ENV=production
REGION=CN
PORT=8080

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=trading_user
DB_PASSWORD=trading_password123
DB_NAME=trading_system

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# AI配置（需要填写）
DEEPSEEK_API_KEY=sk-your-key-here
DEEPSEEK_ENABLED=true
DEFAULT_AI_PROVIDER=deepseek
EOF
    echo "✅ 环境变量文件已创建，请手动编辑 .env 文件"
else
    echo "✅ 环境变量文件已存在"
fi

echo ""

echo "==========================================="
echo "步骤 4: 配置Nginx"
echo "==========================================="

# 创建Nginx配置
cat > /etc/nginx/conf.d/smart.conf << 'EOF'
server {
    listen 80;
    server_name smart.aimaven.top;
    
    # 强制跳转到HTTPS（证书配置后）
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name smart.aimaven.top;
    
    # SSL证书路径（Certbot会填充）
    # ssl_certificate /etc/letsencrypt/live/smart.aimaven.top/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/smart.aimaven.top/privkey.pem;
    
    # SSL配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # 反向代理
    location / {
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
}
EOF

echo "✅ Nginx配置已创建"
echo ""

echo "==========================================="
echo "步骤 5: 启动服务"
echo "==========================================="

# 启动Nginx
systemctl restart nginx
systemctl enable nginx

echo "✅ Nginx已启动"
echo ""

echo "==========================================="
echo "部署完成！"
echo "==========================================="
echo ""
echo "后续步骤："
echo "1. 确保DNS解析已生效: smart.aimaven.top -> 121.41.228.109"
echo "2. 配置SSL证书："
echo "   sudo certbot --nginx -d smart.aimaven.top"
echo "3. 编辑环境变量:"
echo "   cd /home/admin/trading-system-v2"
echo "   vi .env"
echo "4. 初始化数据库（如需要）:"
echo "   mysql -u root -p < database/users_schema.sql"
echo "5. 启动应用:"
echo "   cd /home/admin/trading-system-v2"
echo "   pm2 start src/main.js --name main-app"
echo "   pm2 startup"
echo "   pm2 save"
echo ""
echo "==========================================="

ENDSSH

echo ""
echo "部署命令已发送到服务器！"
echo ""
echo "下一步：请SSH登录服务器完成剩余配置："
echo "  ssh root@$VPS_IP"
echo ""

