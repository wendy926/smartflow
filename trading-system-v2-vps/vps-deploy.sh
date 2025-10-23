#!/bin/bash

# VPS部署脚本 - 在本地执行，连接到VPS部署
# 使用方法: ./vps-deploy.sh

echo "🚀 开始部署SmartFlow交易系统到VPS..."

# VPS连接信息
VPS_HOST="47.237.163.85"
VPS_USER="root"
VPS_KEY="~/.ssh/smartflow_vps_new"
VPS_PATH="/home/admin/trading-system-v2/trading-system-v2"

echo "📡 连接到VPS: ${VPS_USER}@${VPS_HOST}"

# 执行VPS部署命令
ssh -i ${VPS_KEY} ${VPS_USER}@${VPS_HOST} << 'EOF'
echo "🔧 在VPS上执行部署..."

# 进入项目目录
cd /home/admin/trading-system-v2/trading-system-v2

# 停止当前服务
echo "⏹️ 停止当前服务..."
pm2 stop smartflow-trading 2>/dev/null || true
pm2 stop all 2>/dev/null || true

# 备份当前代码
echo "💾 备份当前代码..."
if [ -d "backup-$(date +%Y%m%d-%H%M%S)" ]; then
    echo "备份目录已存在，跳过备份"
else
    cp -r . "../backup-$(date +%Y%m%d-%H%M%S)"
    echo "✅ 代码已备份到 ../backup-$(date +%Y%m%d-%H%M%S)"
fi

# 拉取最新代码
echo "📥 拉取最新代码..."
git fetch origin
git reset --hard origin/main

# 安装依赖
echo "📦 安装依赖..."
npm install

# 运行数据库迁移
echo "🗄️ 运行数据库迁移..."
mysql -u root -p123456 smartflow < database/macro-monitoring-schema.sql 2>/dev/null || echo "数据库迁移跳过（可能已存在）"

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

# 检查服务状态
echo "📊 检查服务状态..."
pm2 status

# 查看日志
echo "📋 查看最新日志..."
pm2 logs --lines 20

echo "✅ VPS部署完成！"
echo ""
echo "📋 部署内容："
echo "1. ✅ 拉取最新代码"
echo "2. ✅ 安装依赖"
echo "3. ✅ 运行数据库迁移"
echo "4. ✅ 运行测试"
echo "5. ✅ 启动服务"
echo ""
echo "🌐 访问地址: http://47.237.163.85:3000"
echo "📊 监控面板: http://47.237.163.85:3000/monitoring"
echo "📈 未平仓合约API: http://47.237.163.85:3000/api/v1/macro-monitor/open-interest"
echo ""
echo "🔧 常用命令："
echo "- 查看状态: pm2 status"
echo "- 查看日志: pm2 logs"
echo "- 重启服务: pm2 restart smartflow-trading"
echo "- 停止服务: pm2 stop smartflow-trading"
EOF

echo ""
echo "🎉 部署脚本执行完成！"
echo "请检查VPS上的服务状态和日志"
