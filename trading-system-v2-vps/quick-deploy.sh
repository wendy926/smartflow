#!/bin/bash

# 快速部署脚本 - 在VPS上执行
# 使用方法: curl -sSL https://raw.githubusercontent.com/wendy926/smartflow/main/trading-system-v2/deploy-to-vps.sh | bash

echo "🚀 SmartFlow交易系统快速部署开始..."

# 进入项目目录
cd /home/admin/trading-system-v2/trading-system-v2

# 停止服务
echo "⏹️ 停止当前服务..."
pm2 stop smartflow-trading 2>/dev/null || true

# 拉取最新代码
echo "📥 拉取最新代码..."
git fetch origin
git reset --hard origin/main

# 安装依赖
echo "📦 安装依赖..."
npm install

# 运行测试
echo "🧪 运行测试..."
echo "1. 外部API测试..."
node test-external-apis.js

echo "2. Sweep测试..."
node test-sweep.js

echo "3. Jest测试套件..."
npm test -- --passWithNoTests

# 启动服务
echo "🔄 启动服务..."
pm2 start ecosystem.config.js

# 检查状态
echo "📊 检查服务状态..."
pm2 status

echo "✅ 部署完成！"
echo "🌐 访问地址: http://47.237.163.85:3000"
echo "📊 监控面板: http://47.237.163.85:3000/monitoring"

