#!/bin/bash

echo "🌐 配置 smart.aimaventop.com 域名访问..."

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then
    echo "❌ 请使用 root 用户运行此脚本"
    exit 1
fi

# 更新系统
echo "📦 更新系统包..."
apt update && apt upgrade -y

# 安装 Nginx
echo "🔧 安装 Nginx..."
apt install nginx -y

# 创建 Nginx 配置
echo "📝 创建 Nginx 配置..."
cat > /etc/nginx/sites-available/smart.aimaventop.com << 'EOF'
server {
    listen 80;
    server_name smart.aimaventop.com;
    
    # 重定向 HTTP 到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name smart.aimaventop.com;
    
    # SSL 配置（Cloudflare 会处理证书）
    ssl_certificate /etc/ssl/certs/cloudflare-origin.pem;
    ssl_certificate_key /etc/ssl/private/cloudflare-origin.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # 反向代理到 Node.js 应用
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # WebSocket 支持
    location /ws {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # 静态文件缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        proxy_pass http://127.0.0.1:8080;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # 日志
    access_log /var/log/nginx/smart.aimaventop.com.access.log;
    error_log /var/log/nginx/smart.aimaventop.com.error.log;
}
EOF

# 启用站点
echo "🔗 启用 Nginx 站点..."
ln -sf /etc/nginx/sites-available/smart.aimaventop.com /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 测试 Nginx 配置
echo "🧪 测试 Nginx 配置..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx 配置测试通过"
    
    # 重启 Nginx
    echo "🔄 重启 Nginx..."
    systemctl restart nginx
    systemctl enable nginx
    
    # 检查 Nginx 状态
    echo "📊 检查 Nginx 状态..."
    systemctl status nginx --no-pager
    
    echo ""
    echo "🎉 域名配置完成！"
    echo "🌍 访问地址: https://smart.aimaventop.com"
    echo "🔗 API 地址: https://smart.aimaventop.com/api/test"
    echo "📊 健康检查: https://smart.aimaventop.com/health"
    echo ""
    echo "📋 管理命令:"
    echo "  - 查看 Nginx 状态: systemctl status nginx"
    echo "  - 重启 Nginx: systemctl restart nginx"
    echo "  - 查看 Nginx 日志: tail -f /var/log/nginx/smart.aimaventop.com.access.log"
    echo "  - 查看错误日志: tail -f /var/log/nginx/smart.aimaventop.com.error.log"
    echo ""
    echo "⚠️  注意: 请确保在 Cloudflare 中配置了正确的 DNS 记录"
    echo "   - A 记录: smart -> 47.237.163.85"
    echo "   - SSL/TLS 模式: 完全（严格）"
else
    echo "❌ Nginx 配置测试失败，请检查配置文件"
    exit 1
fi
