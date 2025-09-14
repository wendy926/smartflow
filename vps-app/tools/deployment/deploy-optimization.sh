#!/bin/bash
# VPS优化部署脚本

set -e

echo "🚀 开始VPS优化部署..."

# 1. 安装Redis
echo "📦 安装Redis..."
sudo apt update
sudo apt install -y redis-server

# 2. 配置Redis
echo "⚙️ 配置Redis..."
sudo tee /etc/redis/redis.conf > /dev/null <<EOF
# Redis配置文件
bind 127.0.0.1
port 6379
timeout 300
tcp-keepalive 60
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
EOF

# 3. 启动Redis服务
echo "🔄 启动Redis服务..."
sudo systemctl enable redis-server
sudo systemctl start redis-server
sudo systemctl status redis-server --no-pager

# 4. 验证Redis连接
echo "✅ 验证Redis连接..."
redis-cli ping

# 5. 安装Node.js依赖
echo "📦 安装Node.js依赖..."
cd /home/admin/smartflow-vps-app
npm install

# 6. 安装Redis Node.js客户端
echo "📦 安装Redis客户端..."
npm install redis

# 7. 设置环境变量
echo "🔧 设置环境变量..."
cat >> ~/.bashrc <<EOF

# SmartFlow环境变量
export REDIS_HOST=localhost
export REDIS_PORT=6379
export REDIS_DB=0
export ENABLE_REDIS=true
export NODE_ENV=production
EOF

source ~/.bashrc

# 8. 运行数据库优化
echo "🗄️ 运行数据库优化..."
node -e "
const DatabaseOptimization = require('./modules/database/DatabaseOptimization');
const optimization = new DatabaseOptimization();
optimization.optimizeDatabase().then(() => {
  console.log('✅ 数据库优化完成');
  process.exit(0);
}).catch(err => {
  console.error('❌ 数据库优化失败:', err);
  process.exit(1);
});
"

# 9. 运行单元测试
echo "🧪 运行单元测试..."
npm test

# 10. 重启应用
echo "🔄 重启应用..."
pm2 restart smartflow-app || pm2 start ecosystem.config.js

# 11. 验证服务状态
echo "✅ 验证服务状态..."
pm2 status
redis-cli ping

echo "🎉 VPS优化部署完成！"
echo "📊 性能监控: https://smart.aimaventop.com/api/performance"
echo "🗄️ 缓存统计: https://smart.aimaventop.com/api/cache/stats"
echo "📈 数据库统计: https://smart.aimaventop.com/api/database/stats"
