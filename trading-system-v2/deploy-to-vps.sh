#!/bin/bash

# VPS部署脚本 - 拉取最新代码并部署
# 请在VPS上执行此脚本

echo "🚀 开始部署SmartFlow交易系统..."

# 1. 进入项目目录
cd /home/admin/trading-system-v2/trading-system-v2

# 2. 停止当前服务
echo "⏹️ 停止当前服务..."
pm2 stop smartflow-trading || true
pm2 stop all || true

# 3. 备份当前代码
echo "💾 备份当前代码..."
if [ -d "backup-$(date +%Y%m%d-%H%M%S)" ]; then
    echo "备份目录已存在，跳过备份"
else
    cp -r . "../backup-$(date +%Y%m%d-%H%M%S)"
    echo "✅ 代码已备份到 ../backup-$(date +%Y%m%d-%H%M%S)"
fi

# 4. 拉取最新代码
echo "📥 拉取最新代码..."
git fetch origin
git reset --hard origin/main

# 5. 安装依赖
echo "📦 安装依赖..."
npm install

# 6. 运行测试
echo "🧪 运行测试..."
if [ -f "test-external-apis.js" ]; then
    echo "运行外部API测试..."
    node test-external-apis.js
fi

if [ -f "test-sweep.js" ]; then
    echo "运行Sweep测试..."
    node test-sweep.js
fi

# 7. 运行Jest测试
echo "🔬 运行Jest测试套件..."
npm test -- --passWithNoTests

# 8. 启动服务
echo "🔄 启动服务..."
pm2 start ecosystem.config.js

# 9. 检查服务状态
echo "📊 检查服务状态..."
pm2 status

# 10. 查看日志
echo "📋 查看最新日志..."
pm2 logs --lines 20

echo "✅ 部署完成！"
echo ""
echo "📋 部署内容："
echo "1. ✅ 拉取最新代码"
echo "2. ✅ 安装依赖"
echo "3. ✅ 运行测试"
echo "4. ✅ 启动服务"
echo ""
echo "🌐 访问地址: http://47.237.163.85:3000"
echo "📊 监控面板: http://47.237.163.85:3000/monitoring"
echo ""
echo "🔧 常用命令："
echo "- 查看状态: pm2 status"
echo "- 查看日志: pm2 logs"
echo "- 重启服务: pm2 restart smartflow-trading"
echo "- 停止服务: pm2 stop smartflow-trading"

