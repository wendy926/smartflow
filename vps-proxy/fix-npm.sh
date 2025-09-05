#!/bin/bash

# 修复 npm 安装问题
# 解决 Node.js 已安装但 npm 缺失的问题

echo "🔧 修复 npm 安装问题..."

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then
    echo "❌ 请使用 root 用户运行此脚本"
    echo "请执行: sudo su -"
    exit 1
fi

# 1. 卸载现有的 Node.js
echo "🗑️ 卸载现有 Node.js..."
apt remove -y nodejs

# 2. 清理 apt 缓存
echo "🧹 清理 apt 缓存..."
apt clean
apt autoclean

# 3. 安装 Node.js 和 npm（包含 npm）
echo "📦 安装 Node.js 和 npm..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# 4. 验证安装
echo "✅ Node.js 版本: $(node --version)"
echo "✅ npm 版本: $(npm --version)"

# 5. 如果 npm 仍然缺失，手动安装
if ! command -v npm &> /dev/null; then
    echo "📦 手动安装 npm..."
    curl -L https://npmjs.org/install.sh | sh
fi

# 6. 再次验证
echo "✅ 最终验证:"
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"

# 7. 进入项目目录
PROJECT_DIR="/home/admin/smartflow-proxy"
cd $PROJECT_DIR

# 8. 安装依赖
echo "📦 安装项目依赖..."
npm install

# 9. 安装 PM2
echo "📦 安装 PM2..."
npm install -g pm2

# 10. 启动服务
echo "🚀 启动服务..."
pm2 start server.js --name smartflow-proxy
pm2 startup
pm2 save

# 11. 等待服务启动
sleep 5

# 12. 测试服务
echo "🧪 测试服务..."
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ 健康检查通过"
    curl -s http://localhost:3000/health | head -3
else
    echo "❌ 健康检查失败"
    echo "查看日志: pm2 logs smartflow-proxy"
fi

echo ""
echo "🎉 修复完成！"
echo "🌍 访问地址: http://47.237.163.85:3000"
echo "🔗 API 代理: http://47.237.163.85:3000/api/binance"
