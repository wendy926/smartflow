#!/bin/bash

# 内存优化部署脚本

echo "🚀 开始部署内存优化版本..."

# 1. 创建数据库表
echo "📊 创建内存优化数据库表..."
node memory-optimization-plan.js

# 2. 备份当前服务器
echo "💾 备份当前服务器..."
cp server.js server.js.backup
cp ecosystem.config.js ecosystem.config.js.backup

# 3. 更新PM2配置
echo "⚙️ 更新PM2配置..."
cat > ecosystem-memory-optimized.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'smartflow-app-optimized',
    script: 'memory-optimized-server.js',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '600M', // 内存超过600MB时重启
    node_args: '--expose-gc --max-old-space-size=512', // 启用垃圾回收，限制堆内存512MB
    env: {
      NODE_ENV: 'production',
      PORT: 8080
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF

# 4. 停止当前服务
echo "⏹️ 停止当前服务..."
pm2 stop smartflow-app || true

# 5. 启动优化版本
echo "▶️ 启动内存优化版本..."
pm2 start ecosystem-memory-optimized.config.js

# 6. 等待服务启动
echo "⏳ 等待服务启动..."
sleep 10

# 7. 检查服务状态
echo "🔍 检查服务状态..."
pm2 status

# 8. 检查内存使用情况
echo "📊 检查内存使用情况..."
free -h
pm2 show smartflow-app-optimized | grep -E 'memory|cpu|uptime'

# 9. 测试API
echo "🧪 测试API..."
curl -s http://localhost:8080/health | jq . || echo "API测试失败"

echo "✅ 内存优化部署完成！"
echo "📊 监控内存使用: curl http://localhost:8080/api/memory"
echo "🧹 清理内存缓存: curl -X POST http://localhost:8080/api/memory/clear"
echo "🗑️ 强制垃圾回收: curl -X POST http://localhost:8080/api/memory/gc"
