#!/bin/bash

# CN VPS SSH密钥配置脚本
# 此脚本将帮助您配置SSH免密登录

echo "============================================"
echo "CN VPS SSH免密登录配置"
echo "============================================"
echo ""

# 显示公钥
echo "您的SSH公钥是："
echo ""
cat ~/.ssh/smartflow_vps_cn.pub
echo ""
echo "============================================"
echo ""

# 尝试添加密钥
read -p "请确保您知道CN VPS的密码。按Enter继续..."

ssh-copy-id -i ~/.ssh/smartflow_vps_cn.pub root@121.41.228.109

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SSH密钥配置成功！"
    echo ""
    echo "现在您可以这样登录："
    echo "  ssh -i ~/.ssh/smartflow_vps_cn root@121.41.228.109"
    echo ""
    
    # 测试连接
    read -p "是否测试连接？(y/n) " test_conn
    if [ "$test_conn" = "y" ]; then
        ssh -i ~/.ssh/smartflow_vps_cn root@121.41.228.109 "echo '连接成功！' && hostname && ip addr show | grep 'inet '"
    fi
else
    echo ""
    echo "❌ 自动配置失败"
    echo ""
    echo "请手动执行以下步骤："
    echo ""
    echo "1. 复制您的公钥："
    echo "   cat ~/.ssh/smartflow_vps_cn.pub"
    echo ""
    echo "2. SSH登录到CN VPS："
    echo "   ssh root@121.41.228.109"
    echo ""
    echo "3. 在服务器上执行："
    echo "   mkdir -p ~/.ssh"
    echo "   chmod 700 ~/.ssh"
    echo "   echo '您的公钥内容' >> ~/.ssh/authorized_keys"
    echo "   chmod 600 ~/.ssh/authorized_keys"
    echo ""
    echo "4. 退出并测试："
    echo "   exit"
    echo "   ssh -i ~/.ssh/smartflow_vps_cn root@121.41.228.109"
fi

echo ""
echo "============================================"

