#!/bin/bash

# SmartFlow VPS 应用快速部署脚本
# 一键部署到新加坡 VPS

set -e

echo "🚀 SmartFlow VPS 应用快速部署"
echo "================================"

# 检查是否在 VPS 上
if [[ ! -f /etc/os-release ]] || ! grep -q "Ubuntu" /etc/os-release; then
    echo "❌ 此脚本需要在 Ubuntu VPS 上运行"
    exit 1
fi

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "📦 安装 Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm 未安装，请先安装 Node.js"
    exit 1
fi

# 检查 PM2
if ! command -v pm2 &> /dev/null; then
    echo "📦 安装 PM2..."
    sudo npm install -g pm2
fi

echo "✅ 环境检查完成"

# 执行部署
echo "🚀 开始部署..."
bash deploy.sh

echo "🎉 部署完成！"
echo "🌍 访问地址: http://47.237.163.85:3000"
echo "📊 管理命令: pm2 status, pm2 logs smartflow-app"
