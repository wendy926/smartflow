#!/bin/bash
# VPS部署脚本 - 在VPS上执行

set -e

echo "🚀 开始VPS部署..."

# 1. 拉取最新代码
echo "📥 拉取最新代码..."
cd /home/admin/smartflow-vps-app
git pull origin main

# 2. 安装Redis（如果未安装）
echo "📦 检查并安装Redis..."
if ! command -v redis-server &> /dev/null; then
    echo "安装Redis..."
    sudo apt update
    sudo apt install -y redis-server
    
    # 配置Redis
    sudo tee /etc/redis/redis.conf > /dev/null <<EOF
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
    
    # 启动Redis服务
    sudo systemctl enable redis-server
    sudo systemctl start redis-server
    echo "✅ Redis安装完成"
else
    echo "✅ Redis已安装"
fi

# 3. 验证Redis连接
echo "🔍 验证Redis连接..."
redis-cli ping

# 4. 安装Node.js依赖
echo "📦 安装Node.js依赖..."
npm install

# 5. 安装Redis Node.js客户端
echo "📦 安装Redis客户端..."
npm install redis

# 6. 设置环境变量
echo "🔧 设置环境变量..."
if ! grep -q "REDIS_HOST" ~/.bashrc; then
    cat >> ~/.bashrc <<EOF

# SmartFlow环境变量
export REDIS_HOST=localhost
export REDIS_PORT=6379
export REDIS_DB=0
export ENABLE_REDIS=true
export NODE_ENV=production
EOF
    echo "✅ 环境变量已设置"
else
    echo "✅ 环境变量已存在"
fi

# 7. 运行数据库优化
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

# 8. 运行单元测试
echo "🧪 运行单元测试..."
npm test

# 9. 重启应用
echo "🔄 重启应用..."
pm2 restart smartflow-app || pm2 start ecosystem.config.js

# 10. 验证服务状态
echo "✅ 验证服务状态..."
pm2 status
redis-cli ping

# 11. 测试API端点
echo "🌐 测试API端点..."
echo "测试性能监控API..."
curl -s http://localhost:8080/api/performance | head -c 100
echo ""

echo "测试缓存统计API..."
curl -s http://localhost:8080/api/cache/stats | head -c 100
echo ""

echo "测试数据库统计API..."
curl -s http://localhost:8080/api/database/stats | head -c 100
echo ""

echo "🎉 VPS部署完成！"
echo "📊 性能监控: https://smart.aimaventop.com/api/performance"
echo "🗄️ 缓存统计: https://smart.aimaventop.com/api/cache/stats"
echo "📈 数据库统计: https://smart.aimaventop.com/api/database/stats"
echo "🏠 主页面: https://smart.aimaventop.com/"
