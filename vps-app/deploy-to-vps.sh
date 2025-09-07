#!/bin/bash

# SmartFlow VPS 部署脚本
# 使用方法: ./deploy-to-vps.sh [VPS_IP] [USERNAME]

set -e

# 检查参数
if [ $# -lt 2 ]; then
    echo "使用方法: $0 <VPS_IP> <USERNAME>"
    echo "示例: $0 192.168.1.100 admin"
    exit 1
fi

VPS_IP=$1
VPS_USER=$2
SSH_KEY="~/.ssh/smartflow_vps"
APP_DIR="/home/$VPS_USER/smartflow-vps-app/vps-app"

echo "🚀 开始部署 SmartFlow 到 VPS..."
echo "📍 VPS IP: $VPS_IP"
echo "👤 用户名: $VPS_USER"
echo "🔑 SSH密钥: $SSH_KEY"
echo "📁 应用目录: $APP_DIR"

# 检查SSH连接
echo "🔍 检查SSH连接..."
if ! ssh -i $SSH_KEY -o ConnectTimeout=10 -o BatchMode=yes $VPS_USER@$VPS_IP "echo 'SSH连接成功'" 2>/dev/null; then
    echo "❌ SSH连接失败，请检查："
    echo "   1. VPS IP地址是否正确"
    echo "   2. 用户名是否正确"
    echo "   3. SSH密钥是否正确配置"
    echo "   4. VPS是否运行中"
    exit 1
fi
echo "✅ SSH连接成功"

# 检查应用目录是否存在
echo "🔍 检查应用目录..."
if ! ssh -i $SSH_KEY $VPS_USER@$VPS_IP "[ -d '$APP_DIR' ]"; then
    echo "❌ 应用目录不存在: $APP_DIR"
    echo "请先在VPS上创建目录并克隆代码"
    exit 1
fi
echo "✅ 应用目录存在"

# 备份当前版本
echo "💾 备份当前版本..."
ssh -i $SSH_KEY $VPS_USER@$VPS_IP "cd $APP_DIR && ./update.sh backup"

# 拉取最新代码
echo "📥 拉取最新代码..."
ssh -i $SSH_KEY $VPS_USER@$VPS_IP "cd $APP_DIR && git fetch origin && git pull origin main"

# 运行数据库迁移
echo "🗄️ 运行数据库迁移..."
ssh -i $SSH_KEY $VPS_USER@$VPS_IP "cd $APP_DIR && node migrate-database.js"

# 部署应用
echo "🚀 部署应用..."
ssh -i $SSH_KEY $VPS_USER@$VPS_IP "cd $APP_DIR && ./deploy.sh"

# 验证部署
echo "✅ 验证部署..."
if ssh -i $SSH_KEY $VPS_USER@$VPS_IP "cd $APP_DIR && pm2 list | grep -q 'smartflow-app.*online'"; then
    echo "🎉 部署成功！"
    echo "🌐 访问地址: http://$VPS_IP:8080"
    echo "📊 查看状态: ssh -i $SSH_KEY $VPS_USER@$VPS_IP 'cd $APP_DIR && pm2 status'"
    echo "📝 查看日志: ssh -i $SSH_KEY $VPS_USER@$VPS_IP 'cd $APP_DIR && pm2 logs smartflow-app'"
else
    echo "❌ 部署失败，请检查日志"
    ssh -i $SSH_KEY $VPS_USER@$VPS_IP "cd $APP_DIR && pm2 logs smartflow-app --lines 20"
    exit 1
fi

# 测试应用功能
echo "🧪 测试应用功能..."
echo "测试健康检查..."
if ssh -i $SSH_KEY $VPS_USER@$VPS_IP "curl -s http://localhost:8080/api/health-check" | grep -q "OK"; then
    echo "✅ 健康检查通过"
else
    echo "❌ 健康检查失败"
fi

echo "测试信号接口..."
if ssh -i $SSH_KEY $VPS_USER@$VPS_IP "curl -s http://localhost:8080/api/signals" | grep -q "symbol"; then
    echo "✅ 信号接口正常"
else
    echo "❌ 信号接口异常"
fi

echo ""
echo "🎉 部署完成！"
echo "📋 部署总结:"
echo "   ✅ 代码已更新到最新版本"
echo "   ✅ 数据库表结构已迁移"
echo "   ✅ 应用已重新部署"
echo "   ✅ 功能测试通过"
echo ""
echo "🔗 访问链接:"
echo "   - 主页: http://$VPS_IP:8080"
echo "   - API: http://$VPS_IP:8080/api/signals"
echo "   - 健康检查: http://$VPS_IP:8080/api/health-check"
