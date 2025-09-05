#!/bin/bash

# 配置阿里云轻量应用服务器防火墙
# 解决外部无法访问的问题

echo "🔧 配置阿里云轻量应用服务器防火墙..."

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then
    echo "❌ 请使用 root 用户运行此脚本"
    echo "请执行: sudo su -"
    exit 1
fi

# 1. 启用防火墙
echo "🔥 启用防火墙..."
ufw --force enable

# 2. 开放必要端口
echo "🔓 开放必要端口..."
ufw allow ssh
ufw allow 3000

# 3. 检查防火墙状态
echo "📊 检查防火墙状态..."
ufw status

# 4. 检查端口监听
echo "🔌 检查端口监听..."
netstat -tlnp | grep :3000

# 5. 测试本地连接
echo "🏥 测试本地连接..."
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ 本地连接正常"
    curl -s http://localhost:3000/health | head -3
else
    echo "❌ 本地连接失败"
    exit 1
fi

# 6. 获取外部 IP
echo "🌍 获取外部 IP..."
EXTERNAL_IP=$(curl -s ifconfig.me)
echo "外部 IP: $EXTERNAL_IP"

# 7. 测试外部连接
echo "🧪 测试外部连接..."
if curl -s --connect-timeout 10 http://$EXTERNAL_IP:3000/health > /dev/null; then
    echo "✅ 外部连接正常"
    curl -s http://$EXTERNAL_IP:3000/health | head -3
else
    echo "❌ 外部连接失败"
    echo "请检查阿里云轻量应用服务器控制台的防火墙设置"
    echo "需要开放端口 3000"
fi

# 8. 测试 Binance API 代理
echo "🔗 测试 Binance API 代理..."
if curl -s --connect-timeout 10 "http://$EXTERNAL_IP:3000/api/binance/fapi/v1/klines?symbol=BTCUSDT&interval=1h&limit=5" > /dev/null; then
    echo "✅ Binance API 代理正常"
    curl -s "http://$EXTERNAL_IP:3000/api/binance/fapi/v1/klines?symbol=BTCUSDT&interval=1h&limit=5" | head -3
else
    echo "❌ Binance API 代理失败"
fi

echo ""
echo "🎯 配置完成！"
echo "🌍 外部访问地址: http://$EXTERNAL_IP:3000"
echo "🔗 API 代理: http://$EXTERNAL_IP:3000/api/binance"
echo ""
echo "📝 如果外部连接失败，请检查："
echo "1. 阿里云轻量应用服务器控制台 → 防火墙 → 添加规则"
echo "2. 端口：3000，协议：TCP，来源：0.0.0.0/0"
