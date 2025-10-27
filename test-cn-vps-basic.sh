#!/bin/bash

# CN VPS基础功能测试脚本

echo "============================================"
echo "CN VPS 基础功能测试"
echo "============================================"

ssh -i ~/.ssh/smartflow_vps_cn root@121.41.228.109 << 'ENDSSH'

cd /home/admin/trading-system-v2

echo "=== 1. 检查应用状态 ==="
pm2 status

echo ""
echo "=== 2. 检查数据库连接 ==="
mysql -u root -pSmartFlow2024! smartflow -e "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema='smartflow';"

echo ""
echo "=== 3. 检查Redis连接 ==="
redis-cli ping

echo ""
echo "=== 4. 检查HTTP服务器 ==="
curl -s http://localhost:8080/ -I | head -5

echo ""
echo "=== 5. 检查端口监听 ==="
netstat -tlnp 2>/dev/null | grep 8080 || ss -tlnp | grep 8080

echo ""
echo "=== 6. 测试API端点 ==="
curl -s http://localhost:8080/api/v1/symbols 2>&1 | head -10

echo ""
echo "=== 7. 应用日志关键信息 ==="
pm2 logs smartflow-cn --lines 20 --nostream | grep -E 'started|connected|listening'

echo ""
echo "============================================"
echo "测试完成"
echo "============================================"

ENDSSH

echo "✅ CN VPS测试脚本执行完成"

