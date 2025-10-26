#!/bin/bash

# Gmail SMTP 配置脚本
# 使用方法: ./configure-smtp.sh

echo "============================================"
echo "Gmail SMTP 配置脚本"
echo "============================================"
echo ""

# 检查是否已配置
if [ -f /home/admin/trading-system-v2/trading-system-v2/trading-system-v2/.env ]; then
    if grep -q "SMTP_USER" /home/admin/trading-system-v2/trading-system-v2/trading-system-v2/.env; then
        echo "⚠️  检测到已有 SMTP 配置"
        echo ""
        echo "当前配置："
        grep "^SMTP_" /home/admin/trading-system-v2/trading-system-v2/trading-system-v2/.env | sed 's/\(.*=\).*/\1***/'
        echo ""
        read -p "是否要重新配置？(y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "取消配置"
            exit 0
        fi
    fi
fi

# 获取用户输入
echo "请输入 Gmail 配置信息："
echo ""

read -p "Gmail 邮箱地址 (例如: wendy.wang926@gmail.com): " smtp_user
read -sp "Gmail 应用专用密码 (16位，格式: xxxx xxxx xxxx xxxx): " smtp_pass
echo ""
echo ""

# 验证输入
if [ -z "$smtp_user" ] || [ -z "$smtp_pass" ]; then
    echo "❌ 错误：邮箱和密码不能为空"
    exit 1
fi

# 去除密码中的空格
smtp_pass=$(echo "$smtp_pass" | tr -d ' ')

echo "配置中..."
cd /home/admin/trading-system-v2/trading-system-v2/trading-system-v2

# 备份现有配置
if [ -f .env ]; then
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ 已备份现有配置"
fi

# 删除旧的 SMTP 配置（如果存在）
sed -i '/^SMTP_/d' .env

# 添加新的 SMTP 配置
echo "" >> .env
echo "# Gmail SMTP 配置" >> .env
echo "SMTP_HOST=smtp.gmail.com" >> .env
echo "SMTP_PORT=587" >> .env
echo "SMTP_USER=$smtp_user" >> .env
echo "SMTP_PASS=$smtp_pass" >> .env

echo "✅ SMTP 配置已添加到 .env 文件"
echo ""
echo "📋 配置内容："
echo "SMTP_HOST=smtp.gmail.com"
echo "SMTP_PORT=587"
echo "SMTP_USER=$smtp_user"
echo "SMTP_PASS=***（已隐藏）"
echo ""

# 重启服务
echo "重启 main-app 服务..."
pm2 restart main-app

echo ""
echo "============================================"
echo "✅ SMTP 配置完成！"
echo "============================================"
echo ""
echo "请测试发送验证码功能。"
echo "如果验证码邮件发送成功，说明配置正确。"
echo ""

