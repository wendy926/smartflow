#!/bin/bash

# 统一监控中心部署脚本

echo "🚀 开始部署统一监控中心..."

# 检查Git状态
echo "📋 检查Git状态..."
git status

# 添加所有更改
echo "📦 添加所有更改..."
git add .

# 提交更改
echo "💾 提交更改..."
git commit -m "feat: 实现统一监控中心功能

- 添加统一监控中心数据库迁移脚本
- 实现统一监控管理器
- 实现统一监控API接口
- 添加单元测试和集成测试
- 支持V3和ICT策略的统一监控
- 支持数据刷新状态监控
- 支持统一模拟交易管理
- 支持监控告警管理"

# 推送到GitHub
echo "🌐 推送到GitHub..."
git push origin main

# 部署到VPS
echo "🖥️ 部署到VPS..."
ssh -i ~/.ssh/smartflow_vps_correct root@47.237.163.85 "cd /home/admin/smartflow-vps-app/vps-app && git pull origin main && npm install && pm2 restart smartflow-server"

# 运行测试
echo "🧪 运行测试..."
ssh -i ~/.ssh/smartflow_vps_correct root@47.237.163.85 "cd /home/admin/smartflow-vps-app/vps-app && npm test -- tests/simple-unified-monitoring.test.js"

echo "✅ 统一监控中心部署完成！"
