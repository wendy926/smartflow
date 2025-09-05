#!/bin/bash

# VPS 代理诊断脚本
# 用于诊断网络连接问题

echo "🔍 开始诊断 VPS 代理问题..."

# 1. 检查 PM2 状态
echo "📊 检查 PM2 状态..."
pm2 status

# 2. 检查端口监听
echo "🔌 检查端口监听..."
netstat -tlnp | grep :3000

# 3. 检查本地健康检查
echo "🏥 检查本地健康检查..."
curl -v http://localhost:3000/health

# 4. 检查防火墙状态
echo "🔥 检查防火墙状态..."
ufw status

# 5. 检查 iptables 规则
echo "🛡️ 检查 iptables 规则..."
iptables -L -n | grep 3000

# 6. 检查服务日志
echo "📝 检查服务日志..."
pm2 logs smartflow-proxy --lines 10

# 7. 检查网络接口
echo "🌐 检查网络接口..."
ip addr show

# 8. 检查进程
echo "⚙️ 检查进程..."
ps aux | grep node

echo "🎯 诊断完成！"
