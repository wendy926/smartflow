#!/bin/bash
# deploy-leverage-fix.sh
# VPS部署脚本：验证杠杆计算修复效果

echo "🚀 开始部署杠杆计算修复..."

# 1. 拉取最新代码
echo "📥 拉取最新代码..."
git pull origin main

# 2. 安装依赖（如果需要）
echo "📦 检查依赖..."
npm install

# 3. 运行测试验证修复
echo "🧪 运行杠杆计算测试..."
npm test -- tests/leverage-calculation-comprehensive.test.js

# 4. 重启服务
echo "🔄 重启服务..."
pm2 restart smartflow

# 5. 等待服务启动
echo "⏳ 等待服务启动..."
sleep 10

# 6. 检查服务状态
echo "📊 检查服务状态..."
pm2 status

# 7. 测试API端点
echo "🔍 测试API端点..."
curl -s http://localhost:8080/api/health-check | jq .

# 8. 测试用户设置API
echo "💰 测试用户设置API..."
curl -s -X POST http://localhost:8080/api/user-settings \
  -H "Content-Type: application/json" \
  -d '{"key": "maxLossAmount", "value": "50"}' | jq .

# 9. 获取用户设置验证
echo "✅ 验证用户设置..."
curl -s http://localhost:8080/api/user-settings | jq .

# 10. 测试信号API（查看杠杆计算）
echo "📈 测试信号API..."
curl -s http://localhost:8080/api/signals | jq '.[0] | {symbol, maxLeverage, minMargin, stopLossDistance}'

echo "🎉 部署完成！请检查模拟交易数据页面验证修复效果。"
