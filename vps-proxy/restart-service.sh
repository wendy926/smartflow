#!/bin/bash

# 重启 VPS 代理服务
# 确保服务正确绑定到 0.0.0.0

echo "🔄 重启 VPS 代理服务..."

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then
    echo "❌ 请使用 root 用户运行此脚本"
    echo "请执行: sudo su -"
    exit 1
fi

# 1. 停止服务
echo "⏹️ 停止服务..."
pm2 stop smartflow-proxy

# 2. 删除服务
echo "🗑️ 删除服务..."
pm2 delete smartflow-proxy

# 3. 检查服务器文件
echo "📝 检查服务器文件..."
cd /home/admin/smartflow-proxy
if [ ! -f "server.js" ]; then
    echo "❌ server.js 文件不存在"
    exit 1
fi

# 4. 确保服务绑定到 0.0.0.0
echo "🔧 确保服务绑定到 0.0.0.0..."
sed -i "s/app.listen(PORT, '0.0.0.0'/app.listen(PORT, '0.0.0.0'/g" server.js

# 5. 重新启动服务
echo "🚀 重新启动服务..."
pm2 start server.js --name smartflow-proxy

# 6. 设置开机自启
pm2 startup
pm2 save

# 7. 等待服务启动
echo "⏳ 等待服务启动..."
sleep 5

# 8. 检查服务状态
echo "📊 检查服务状态..."
pm2 status

# 9. 检查端口监听
echo "🔌 检查端口监听..."
netstat -tlnp | grep :3000

# 10. 测试本地连接
echo "🏥 测试本地连接..."
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ 本地连接正常"
    curl -s http://localhost:3000/health | head -3
else
    echo "❌ 本地连接失败"
    echo "查看服务日志:"
    pm2 logs smartflow-proxy --lines 10
fi

# 11. 测试外部连接
echo "🧪 测试外部连接..."
EXTERNAL_IP=$(curl -s ifconfig.me)
if curl -s --connect-timeout 10 http://$EXTERNAL_IP:3000/health > /dev/null; then
    echo "✅ 外部连接正常"
    curl -s http://$EXTERNAL_IP:3000/health | head -3
else
    echo "❌ 外部连接失败"
    echo "请检查云服务器安全组设置"
fi

echo ""
echo "🎯 服务重启完成！"
echo "🌍 外部访问地址: http://$EXTERNAL_IP:3000"
echo "🔗 API 代理: http://$EXTERNAL_IP:3000/api/binance"
