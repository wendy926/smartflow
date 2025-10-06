#!/bin/bash

# 添加新交易对脚本
# 执行时间：2025-10-06

echo "开始添加新的交易对：ADA/USDT、BNB/USDT、SOL/USDT"

# 检查MySQL连接
echo "检查MySQL连接..."
mysql -h localhost -u trading_user -p -e "SELECT 1;" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "MySQL连接失败，请检查数据库配置"
    exit 1
fi

# 执行SQL脚本
echo "执行数据库更新..."
mysql -h localhost -u trading_user -p trading_system < /home/admin/trading-system-v2/trading-system-v2/database/add-new-symbols.sql

if [ $? -eq 0 ]; then
    echo "新交易对添加成功！"
    echo "已添加的交易对："
    mysql -h localhost -u trading_user -p -e "USE trading_system; SELECT symbol, status, last_price FROM symbols WHERE symbol IN ('ADAUSDT', 'BNBUSDT', 'SOLUSDT');"
else
    echo "数据库更新失败"
    exit 1
fi

echo "新交易对添加完成！"
