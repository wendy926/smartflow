#!/bin/bash

echo "📦 安装依赖包..."

# 进入应用目录
cd /home/admin/smartflow-vps-app/vps-app

# 检查npm是否可用
if ! command -v npm &> /dev/null; then
    echo "❌ npm未安装，正在安装Node.js和npm..."
    
    # 安装Node.js和npm
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    apt-get install -y nodejs
    
    echo "✅ Node.js和npm安装完成"
fi

# 检查当前Node.js版本
echo "📋 Node.js版本: $(node --version)"
echo "📋 npm版本: $(npm --version)"

# 安装依赖
echo "📦 安装项目依赖..."
npm install

# 特别安装dotenv
echo "📦 安装dotenv..."
npm install dotenv

# 检查安装结果
echo "✅ 依赖安装完成"
echo "📋 已安装的包:"
npm list --depth=0

echo "🔄 重启应用..."
pm2 restart smartflow-app

echo "⏳ 等待应用启动..."
sleep 5

echo "📊 检查应用状态..."
pm2 status

echo "🧪 测试API..."
curl -s "http://localhost:8080/api/telegram-status" | jq . || echo "API测试失败"

echo "✅ 修复完成！"
