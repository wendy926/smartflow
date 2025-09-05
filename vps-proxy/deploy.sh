#!/bin/bash

# VPS 部署脚本
# 用于在新加坡 VPS 上部署代理服务器

echo "🚀 开始部署 VPS 代理服务器..."

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，正在安装..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# 检查 PM2 是否安装
if ! command -v pm2 &> /dev/null; then
    echo "📦 安装 PM2..."
    sudo npm install -g pm2
fi

# 创建项目目录
PROJECT_DIR="/opt/smartflow-proxy"
sudo mkdir -p $PROJECT_DIR
sudo chown $USER:$USER $PROJECT_DIR

# 复制项目文件
echo "📁 复制项目文件..."
cp -r . $PROJECT_DIR/
cd $PROJECT_DIR

# 安装依赖
echo "📦 安装依赖..."
npm install --production

# 创建 systemd 服务文件
echo "🔧 创建 systemd 服务..."
sudo tee /etc/systemd/system/smartflow-proxy.service > /dev/null <<EOF
[Unit]
Description=SmartFlow VPS Proxy Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PROJECT_DIR
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF

# 重新加载 systemd
sudo systemctl daemon-reload

# 启动服务
echo "🚀 启动服务..."
sudo systemctl enable smartflow-proxy
sudo systemctl start smartflow-proxy

# 检查服务状态
echo "📊 检查服务状态..."
sudo systemctl status smartflow-proxy --no-pager

# 检查端口是否监听
echo "🔍 检查端口监听..."
netstat -tlnp | grep :3000

# 测试健康检查
echo "🧪 测试健康检查..."
sleep 5
curl -s http://localhost:3000/health | jq .

echo "✅ VPS 代理服务器部署完成！"
echo "🌍 外部访问地址: http://47.237.163.85:3000"
echo "🔗 Binance API 代理: http://47.237.163.85:3000/api/binance"
echo "📊 服务状态: sudo systemctl status smartflow-proxy"
echo "📝 查看日志: sudo journalctl -u smartflow-proxy -f"
