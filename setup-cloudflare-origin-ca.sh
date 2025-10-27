#!/bin/bash

# Cloudflare Origin CA证书配置脚本
# 用于生成Cloudflare专用的Origin CA证书

echo "============================================"
echo "Cloudflare Origin CA证书配置"
echo "============================================"

# 下载cloudflared工具（用于生成私钥）
if [ ! -f cloudflared ]; then
  echo "下载cloudflared工具..."
  wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O cloudflared
  chmod +x cloudflared
fi

echo ""
echo "请按以下步骤操作："
echo ""
echo "1. 登录Cloudflare控制台"
echo "2. 进入 'SSL/TLS' → '源服务器'"
echo "3. 点击 '创建证书'"
echo "4. 选择 '私钥类型': RSA (2048)"
echo "5. 选择 '主机名': smart.aimaven.top"
echo "6. 点击 '创建'"
echo "7. 复制显示的证书内容"
echo ""
echo "然后运行以下命令导入证书："
echo ""

cat << 'EOF'
# 创建证书目录
mkdir -p /etc/letsencrypt/live/smart.aimaven.top/

# 保存Cloudflare Origin CA私钥
vi /etc/letsencrypt/live/smart.aimaven.top/privkey.pem
# 粘贴从Cloudflare复制的私钥

# 保存Cloudflare Origin CA证书
vi /etc/letsencrypt/live/smart.aimaven.top/fullchain.pem
# 粘贴从Cloudflare复制的证书

# 设置权限
chmod 600 /etc/letsencrypt/live/smart.aimaven.top/privkey.pem
chmod 644 /etc/letsencrypt/live/smart.aimaven.top/fullchain.pem

# 重启HTTPS代理
pm2 restart https-proxy
EOF

echo ""
echo "============================================"
echo "说明:"
echo "- Cloudflare Origin CA证书专门用于源服务器"
echo "- 证书免费且永久有效"
echo "- 由Cloudflare自动信任"
echo "============================================"

