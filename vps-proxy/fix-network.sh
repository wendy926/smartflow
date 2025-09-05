#!/bin/bash

# 修复 VPS 网络连接问题
# 解决外部无法访问的问题

echo "🔧 修复 VPS 网络连接问题..."

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then
    echo "❌ 请使用 root 用户运行此脚本"
    echo "请执行: sudo su -"
    exit 1
fi

# 1. 检查服务状态
echo "📊 检查服务状态..."
pm2 status

# 2. 检查端口监听
echo "🔌 检查端口监听..."
netstat -tlnp | grep :3000

# 3. 如果端口没有监听，重启服务
if ! netstat -tlnp | grep :3000 > /dev/null; then
    echo "🔄 端口未监听，重启服务..."
    pm2 restart smartflow-proxy
    sleep 3
fi

# 4. 配置防火墙
echo "🔥 配置防火墙..."
ufw --force enable
ufw allow 3000
ufw allow ssh
ufw status

# 5. 检查 iptables 规则
echo "🛡️ 检查 iptables 规则..."
iptables -L -n | grep 3000

# 6. 如果 iptables 阻止了连接，添加规则
if ! iptables -L -n | grep 3000 > /dev/null; then
    echo "➕ 添加 iptables 规则..."
    iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
    iptables -A OUTPUT -p tcp --sport 3000 -j ACCEPT
    iptables-save > /etc/iptables/rules.v4
fi

# 7. 检查服务绑定地址
echo "🌐 检查服务绑定地址..."
netstat -tlnp | grep :3000

# 8. 测试本地连接
echo "🏥 测试本地连接..."
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ 本地连接正常"
    curl -s http://localhost:3000/health | head -3
else
    echo "❌ 本地连接失败"
    echo "查看服务日志:"
    pm2 logs smartflow-proxy --lines 10
fi

# 9. 检查外部 IP
echo "🌍 检查外部 IP..."
curl -s ifconfig.me
echo ""

# 10. 测试外部连接
echo "🧪 测试外部连接..."
EXTERNAL_IP=$(curl -s ifconfig.me)
if curl -s --connect-timeout 10 http://$EXTERNAL_IP:3000/health > /dev/null; then
    echo "✅ 外部连接正常"
    curl -s http://$EXTERNAL_IP:3000/health | head -3
else
    echo "❌ 外部连接失败"
    echo "可能的原因："
    echo "1. 云服务器安全组未开放 3000 端口"
    echo "2. 服务绑定到 127.0.0.1 而不是 0.0.0.0"
    echo "3. 防火墙阻止了连接"
fi

echo ""
echo "🎯 修复完成！"
echo "🌍 外部访问地址: http://$EXTERNAL_IP:3000"
echo "🔗 API 代理: http://$EXTERNAL_IP:3000/api/binance"
