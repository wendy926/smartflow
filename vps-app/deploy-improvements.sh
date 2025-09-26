#!/bin/bash

# 部署改进后的代码到VPS
# 请在VPS上执行此脚本

echo "🚀 开始部署改进后的代码..."

# 1. 进入项目目录
cd /home/admin/smartflow-vps-app/vps-app

# 2. 停止当前服务
echo "⏹️ 停止当前服务..."
pm2 stop smartflow-server || true
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

# 5. 安装依赖（如果有新的依赖）
echo "📦 检查依赖..."
npm install

# 6. 运行测试脚本
echo "🧪 运行改进测试..."
node test-improvements.js

# 7. 重启服务
echo "🔄 重启服务..."
pm2 start ecosystem.config.js

# 8. 检查服务状态
echo "📊 检查服务状态..."
pm2 status

# 9. 查看日志
echo "📋 查看最新日志..."
pm2 logs --lines 20

echo "✅ 部署完成！"
echo ""
echo "📋 改进内容："
echo "1. ✅ API重试机制 - 失败时自动重试2次"
echo "2. ✅ 前端错误展示 - 右上角显示API错误监控面板"
echo "3. ✅ ICT策略条件放宽 - 增加交易频率"
echo ""
echo "🌐 访问地址: http://47.237.163.85:8080"
echo "📊 监控面板: http://47.237.163.85:8080/monitoring.html"
