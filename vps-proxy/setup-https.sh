#!/bin/bash

# 为数据中转服务添加 HTTPS 支持
# 使用 Cloudflare Tunnel 方法

echo "🔐 为数据中转服务添加 HTTPS 支持..."

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then
    echo "❌ 请使用 root 用户运行此脚本"
    echo "请执行: sudo su -"
    exit 1
fi

# 1. 安装 cloudflared
echo "📦 安装 cloudflared..."
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
dpkg -i cloudflared-linux-amd64.deb
rm cloudflared-linux-amd64.deb

# 2. 验证安装
echo "✅ 验证 cloudflared 安装..."
cloudflared --version

# 3. 登录 Cloudflare
echo "🔑 登录 Cloudflare..."
echo "请访问以下链接进行登录："
cloudflared tunnel login

# 4. 创建隧道
echo "🚇 创建隧道..."
TUNNEL_NAME="smartflow-data-server"
cloudflared tunnel create $TUNNEL_NAME

# 5. 创建配置文件
echo "📝 创建配置文件..."
mkdir -p /root/.cloudflared
cat > /root/.cloudflared/config.yml << EOF
tunnel: $TUNNEL_NAME
credentials-file: /root/.cloudflared/$(cloudflared tunnel list | grep $TUNNEL_NAME | awk '{print $1}').json

ingress:
  - hostname: data.smartflow-trader.wendy-wang926.workers.dev
    service: http://localhost:3000
  - service: http_status:404
EOF

# 6. 创建 systemd 服务
echo "🔧 创建 systemd 服务..."
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

# 7. 启动服务
echo "🚀 启动 Cloudflare Tunnel..."
systemctl daemon-reload
systemctl enable cloudflared
systemctl start cloudflared

# 8. 检查服务状态
echo "📊 检查服务状态..."
systemctl status cloudflared --no-pager

echo ""
echo "🎉 HTTPS 支持配置完成！"
echo "🌐 HTTPS 访问地址: https://data.smartflow-trader.wendy-wang926.workers.dev"
echo "🔗 API 中转: https://data.smartflow-trader.wendy-wang926.workers.dev/api/binance/*"
echo ""
echo "📝 下一步："
echo "1. 在 Cloudflare 控制台添加 CNAME 记录"
echo "2. 更新 Cloudflare Worker 配置"
echo "3. 测试 HTTPS 访问"
