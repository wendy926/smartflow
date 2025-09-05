#!/bin/bash

# 网络连接测试脚本
# 用于测试 VPS 代理的网络连接

echo "🧪 开始网络连接测试..."

# 1. 测试本地连接
echo "🏥 测试本地连接..."
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ 本地连接正常"
    curl -s http://localhost:3000/health | head -3
else
    echo "❌ 本地连接失败"
    exit 1
fi

# 2. 测试外部 IP 连接
echo "🌍 测试外部 IP 连接..."
EXTERNAL_IP=$(curl -s ifconfig.me)
echo "外部 IP: $EXTERNAL_IP"

if curl -s --connect-timeout 10 http://$EXTERNAL_IP:3000/health > /dev/null; then
    echo "✅ 外部 IP 连接正常"
    curl -s http://$EXTERNAL_IP:3000/health | head -3
else
    echo "❌ 外部 IP 连接失败"
    echo "可能的原因："
    echo "1. 云服务器安全组未开放 3000 端口"
    echo "2. 防火墙阻止了连接"
    echo "3. 网络配置问题"
fi

# 3. 测试 Binance API 代理
echo "🔗 测试 Binance API 代理..."
if curl -s --connect-timeout 10 "http://$EXTERNAL_IP:3000/api/binance/fapi/v1/klines?symbol=BTCUSDT&interval=1h&limit=5" > /dev/null; then
    echo "✅ Binance API 代理正常"
    curl -s "http://$EXTERNAL_IP:3000/api/binance/fapi/v1/klines?symbol=BTCUSDT&interval=1h&limit=5" | head -3
else
    echo "❌ Binance API 代理失败"
fi

# 4. 检查端口监听
echo "🔌 检查端口监听..."
netstat -tlnp | grep :3000

# 5. 检查防火墙
echo "🔥 检查防火墙..."
ufw status

# 6. 检查 iptables
echo "🛡️ 检查 iptables..."
iptables -L -n | grep 3000

echo ""
echo "🎯 测试完成！"
echo "🌍 外部访问地址: http://$EXTERNAL_IP:3000"
echo "🔗 API 代理: http://$EXTERNAL_IP:3000/api/binance"
