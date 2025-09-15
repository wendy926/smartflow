#!/bin/bash

# ICT策略VPS部署脚本
echo "🚀 开始部署ICT策略到VPS..."

# 1. 压缩代码文件
echo "📦 压缩代码文件..."
tar -czf ict-strategy-deploy.tar.gz \
  src/core/modules/strategy/ict-trading/ \
  src/core/modules/database/ICTDatabaseManager.js \
  src/core/modules/database/ICTMigration.js \
  src/core/server.js \
  src/web/public/index.html \
  src/web/public/js/main.js \
  src/web/public/js/api.js \
  package.json \
  --exclude='*.test.js' \
  --exclude='*.spec.js'

# 2. 上传到VPS
echo "📤 上传文件到VPS..."
scp -i ~/.ssh/smartflow_vps_correct ict-strategy-deploy.tar.gz root@47.237.163.85:/home/admin/

# 3. 在VPS上执行部署
echo "🔧 在VPS上执行部署..."
ssh -i ~/.ssh/smartflow_vps_correct root@47.237.163.85 << 'EOF'
cd /home/admin/

# 备份现有文件
if [ -d "smartflow-vps-app/vps-app" ]; then
  echo "💾 备份现有文件..."
  cp -r smartflow-vps-app/vps-app smartflow-vps-app/vps-app-backup-$(date +%Y%m%d%H%M%S)
fi

# 解压新文件
echo "📂 解压新文件..."
cd smartflow-vps-app/vps-app
tar -xzf /home/admin/ict-strategy-deploy.tar.gz

# 安装依赖
echo "📥 安装新依赖..."
npm install better-sqlite3

# 检查进程并重启
echo "🔄 重启服务..."
pkill -f "node.*server.js" || true
sleep 2

# 启动服务
echo "▶️ 启动新服务..."
nohup node src/core/server.js > logs/ict-deploy.log 2>&1 &

echo "✅ ICT策略部署完成!"
echo "📝 查看日志: tail -f /home/admin/smartflow-vps-app/vps-app/logs/ict-deploy.log"

# 等待服务启动
sleep 5

# 检查服务状态
if pgrep -f "node.*server.js" > /dev/null; then
  echo "✅ 服务启动成功!"
else
  echo "❌ 服务启动失败，请检查日志"
fi

EOF

# 4. 清理本地临时文件
echo "🧹 清理临时文件..."
rm -f ict-strategy-deploy.tar.gz

echo "🎉 ICT策略部署脚本执行完成!"
echo "🔗 请访问: http://47.237.163.85:3000 查看运行状态"
