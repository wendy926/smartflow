#!/bin/bash

# 测试VPS连接脚本
# 使用方法: ./scripts/test-vps-connection.sh

VPS_HOST="47.237.163.85"
VPS_USER="root"
SSH_KEY="~/.ssh/smartflow_vps_new"

echo "🔍 测试VPS连接..."

# 测试SSH连接
if ssh -i $SSH_KEY -o ConnectTimeout=10 $VPS_USER@$VPS_HOST "echo '✅ SSH连接成功'"; then
    echo "🎉 VPS连接正常，可以开始部署！"
    echo ""
    echo "运行部署命令："
    echo "./scripts/deploy-to-vps.sh"
else
    echo "❌ VPS连接失败"
    echo ""
    echo "请先在VPS控制台执行以下命令配置SSH密钥："
    echo ""
    echo "mkdir -p ~/.ssh && chmod 700 ~/.ssh"
    echo "echo '$(cat ~/.ssh/smartflow_vps_new.pub)' >> ~/.ssh/authorized_keys"
    echo "chmod 600 ~/.ssh/authorized_keys && chown -R root:root ~/.ssh"
    echo ""
    echo "公钥内容："
    cat ~/.ssh/smartflow_vps_new.pub
fi
