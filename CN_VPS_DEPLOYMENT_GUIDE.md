# CN VPS 部署指南

## 服务器信息
- **IP**: 121.41.228.109
- **域名**: smart.aimaven.top
- **地区**: 中国大陆

## 连接方式

### 方式1: SSH密钥认证（推荐）

如果有SSH密钥，添加公钥到服务器：

```bash
# 在本地生成密钥对（如果没有）
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"

# 复制公钥到服务器
ssh-copy-id root@121.41.228.109
```

### 方式2: 密码认证

```bash
ssh root@121.41.228.109
# 输入密码后连接
```

## 部署步骤

### 1. 安装基础软件

```bash
# 更新系统
yum update -y

# 安装Nginx
yum install -y nginx

# 安装Certbot (Let's Encrypt证书)
yum install -y certbot python3-certbot-nginx

# 安装Node.js 18 LTS
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs

# 安装PM2
npm install -g pm2

# 安装MySQL（如果未安装）
yum install -y mysql-server
systemctl start mysqld
systemctl enable mysqld

# 安装Redis
yum install -y redis
systemctl start redis
systemctl enable redis
```

### 2. 配置Nginx

创建Nginx配置文件：

```bash
cat > /etc/nginx/conf.d/smart.conf << 'EOF'
server {
    listen 80;
    server_name smart.aimaven.top;
    
    # 强制跳转到HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name smart.aimaven.top;
    
    ssl_certificate /etc/letsencrypt/live/smart.aimaven.top/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/smart.aimaven.top/privkey.pem;
    
    # SSL配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # 反向代理到Node.js
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
```

### 3. 配置SSL证书

```bash
# 获取SSL证书
certbot --nginx -d smart.aimaven.top --non-interactive --agree-tos --email admin@aimaven.top

# 测试证书自动续期
certbot renew --dry-run
```

### 4. 启动Nginx

```bash
# 测试配置
nginx -t

# 启动Nginx
systemctl start nginx
systemctl enable nginx

# 重载配置
systemctl reload nginx
```

### 5. 部署应用程序

```bash
# 创建项目目录
mkdir -p /home/admin/trading-system-v2
cd /home/admin

# 克隆代码
git clone https://github.com/wendy926/smartflow.git trading-system-v2

# 进入项目目录
cd trading-system-v2

# 安装依赖
npm install
```

### 6. 配置环境变量

```bash
cd trading-system-v2

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

# AI配置
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxx
DEEPSEEK_ENABLED=true
DEFAULT_AI_PROVIDER=deepseek

# 加密密钥
ENCRYPTION_KEY=your-encryption-key-here
EOF
```

### 7. 初始化数据库

```bash
cd trading-system-v2

# 创建数据库
mysql -u root -p << 'SQL'
CREATE DATABASE IF NOT EXISTS trading_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'trading_user'@'localhost' IDENTIFIED BY 'trading_password123';
GRANT ALL PRIVILEGES ON trading_system.* TO 'trading_user'@'localhost';
FLUSH PRIVILEGES;
SQL

# 导入表结构
mysql -u root -p trading_system < database/users_schema.sql
mysql -u root -p trading_system < database/verification_codes_schema.sql
```

### 8. 启动应用

```bash
cd trading-system-v2

# 使用PM2启动
pm2 start src/main.js --name main-app

# 查看状态
pm2 status
pm2 logs main-app
```

### 9. 配置防火墙

```bash
# 开放端口
firewall-cmd --permanent --add-port=80/tcp
firewall-cmd --permanent --add-port=443/tcp
firewall-cmd --permanent --add-port=8080/tcp
firewall-cmd --reload

# 或使用iptables
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT
iptables -A INPUT -p tcp --dport 8080 -j ACCEPT
```

### 10. 验证部署

```bash
# 检查Nginx
systemctl status nginx

# 检查Node.js应用
pm2 list
pm2 logs main-app

# 检查端口
netstat -tuln | grep -E '80|443|8080'

# 测试SSL
curl -I https://smart.aimaven.top
```

## Cloudflare配置

### 1. DNS设置
确保在Cloudflare中添加A记录：
- **Type**: A
- **Name**: smart
- **Content**: 121.41.228.109
- **Proxy status**: DNS only（灰色云）

### 2. SSL/TLS设置
- **Mode**: Full (strict)
- **Always Use HTTPS**: On
- **Automatic HTTPS Rewrites**: On

### 3. 强制HTTPS
在Cloudflare页面规则中添加：
- **URL**: `http://*smart.aimaven.top/*`
- **Setting**: SSL → HTTPS → Redirect

## 故障排查

### SSL证书问题
```bash
# 查看证书状态
certbot certificates

# 手动续期证书
certbot renew

# 检查证书到期时间
certbot certificates | grep Expiry
```

### Nginx问题
```bash
# 检查Nginx错误日志
tail -f /var/log/nginx/error.log

# 测试配置
nginx -t

# 重载配置
systemctl reload nginx
```

### 应用问题
```bash
# 查看PM2日志
pm2 logs main-app

# 重启应用
pm2 restart main-app

# 查看应用状态
pm2 status
```

## 后续维护

### 更新代码
```bash
cd /home/admin/trading-system-v2
git pull origin main
npm install
pm2 restart main-app
```

### 查看日志
```bash
# 应用日志
pm2 logs main-app

# Nginx访问日志
tail -f /var/log/nginx/access.log

# Nginx错误日志
tail -f /var/log/nginx/error.log
```

### 备份
```bash
# 备份数据库
mysqldump -u root -p trading_system > backup_$(date +%Y%m%d).sql

# 备份代码
tar -czf trading-system-backup-$(date +%Y%m%d).tar.gz /home/admin/trading-system-v2
```

