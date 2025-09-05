# 数据中转服务 HTTPS 配置指南

## 🎯 目标

为数据中转服务添加 HTTPS 支持，使 Cloudflare Worker 能够访问。

## 🔐 方法1：Cloudflare Tunnel（推荐）

### 1. 在 VPS 上安装 cloudflared

```bash
# 下载并安装 cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
dpkg -i cloudflared-linux-amd64.deb
rm cloudflared-linux-amd64.deb

# 验证安装
cloudflared --version
```

### 2. 登录 Cloudflare

```bash
# 登录 Cloudflare
cloudflared tunnel login
```

### 3. 创建隧道

```bash
# 创建隧道
TUNNEL_NAME="smartflow-data-server"
cloudflared tunnel create $TUNNEL_NAME
```

### 4. 创建配置文件

```bash
# 创建配置目录
mkdir -p /root/.cloudflared

# 创建配置文件
cat > /root/.cloudflared/config.yml << EOF
tunnel: $TUNNEL_NAME
credentials-file: /root/.cloudflared/$(cloudflared tunnel list | grep $TUNNEL_NAME | awk '{print $1}').json

ingress:
  - hostname: data.smartflow-trader.wendy-wang926.workers.dev
    service: http://localhost:3000
  - service: http_status:404
EOF
```

### 5. 创建 systemd 服务

```bash
# 创建 systemd 服务文件
cat > /etc/systemd/system/cloudflared.service << EOF
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/cloudflared tunnel --config /root/.cloudflared/config.yml run
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# 启动服务
systemctl daemon-reload
systemctl enable cloudflared
systemctl start cloudflared
```

### 6. 在 Cloudflare 控制台配置

1. **登录 Cloudflare 控制台**
2. **进入 DNS 管理**
3. **添加 CNAME 记录**：
   - 名称：`data`
   - 目标：`<tunnel-id>.cfargotunnel.com`
   - 代理状态：已代理

### 7. 测试 HTTPS 访问

```bash
# 测试 HTTPS 访问
curl https://data.smartflow-trader.wendy-wang926.workers.dev/health

# 测试 API 中转
curl "https://data.smartflow-trader.wendy-wang926.workers.dev/api/binance/fapi/v1/klines?symbol=BTCUSDT&interval=1h&limit=5"
```

## 🔐 方法2：使用 Let's Encrypt SSL 证书

### 1. 安装 Certbot

```bash
# 安装 Certbot
apt update
apt install -y certbot

# 安装 Nginx（用于 SSL 终止）
apt install -y nginx
```

### 2. 获取 SSL 证书

```bash
# 获取 SSL 证书
certbot certonly --standalone -d data.smartflow-trader.wendy-wang926.workers.dev
```

### 3. 配置 Nginx

```bash
# 创建 Nginx 配置
cat > /etc/nginx/sites-available/smartflow-data-server << EOF
server {
    listen 80;
    server_name data.smartflow-trader.wendy-wang926.workers.dev;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl;
    server_name data.smartflow-trader.wendy-wang926.workers.dev;

    ssl_certificate /etc/letsencrypt/live/data.smartflow-trader.wendy-wang926.workers.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/data.smartflow-trader.wendy-wang926.workers.dev/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# 启用配置
ln -s /etc/nginx/sites-available/smartflow-data-server /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 4. 设置自动续期

```bash
# 添加自动续期任务
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
```

## 🔐 方法3：使用 Cloudflare SSL 证书

### 1. 在 Cloudflare 控制台生成证书

1. **登录 Cloudflare 控制台**
2. **进入 SSL/TLS → 源服务器**
3. **创建证书**
4. **下载证书文件**

### 2. 配置服务器

```bash
# 创建证书目录
mkdir -p /etc/ssl/cloudflare

# 上传证书文件
# 将证书文件上传到 /etc/ssl/cloudflare/

# 配置 Nginx
cat > /etc/nginx/sites-available/smartflow-data-server << EOF
server {
    listen 443 ssl;
    server_name data.smartflow-trader.wendy-wang926.workers.dev;

    ssl_certificate /etc/ssl/cloudflare/cert.pem;
    ssl_certificate_key /etc/ssl/cloudflare/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
```

## 🧪 测试 HTTPS 支持

### 1. 测试证书有效性

```bash
# 检查证书
openssl s_client -connect data.smartflow-trader.wendy-wang926.workers.dev:443 -servername data.smartflow-trader.wendy-wang926.workers.dev
```

### 2. 测试 API 访问

```bash
# 测试健康检查
curl https://data.smartflow-trader.wendy-wang926.workers.dev/health

# 测试 API 中转
curl "https://data.smartflow-trader.wendy-wang926.workers.dev/api/binance/fapi/v1/klines?symbol=BTCUSDT&interval=1h&limit=5"
```

## 🔄 更新 Cloudflare Worker

HTTPS 配置完成后，更新 Cloudflare Worker 配置：

```javascript
// 在 src/index.js 中更新
static PROXY_URL = 'https://data.smartflow-trader.wendy-wang926.workers.dev/api/binance';
```

## 📝 推荐方案

**推荐使用 Cloudflare Tunnel 方法**，因为：
- ✅ 无需 SSL 证书
- ✅ 自动 HTTPS 支持
- ✅ 与 Cloudflare 集成
- ✅ 配置简单
- ✅ 免费使用

## 🎯 下一步

1. 选择一种方法配置 HTTPS
2. 测试 HTTPS 访问
3. 更新 Cloudflare Worker 配置
4. 验证完整系统功能
