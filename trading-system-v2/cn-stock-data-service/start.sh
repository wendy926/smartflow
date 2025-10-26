#!/bin/bash
# A股数据服务启动脚本

echo "🚀 启动A股数据服务..."

# 检查Python环境
if ! command -v python3 &> /dev/null; then
    echo "❌ 未找到Python3，请先安装Python"
    exit 1
fi

# 安装依赖
echo "📦 安装Python依赖..."
pip3 install -r requirements.txt

# 启动服务
echo "🎯 启动Flask服务..."
python3 main.py

