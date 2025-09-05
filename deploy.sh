#!/bin/bash

# SmartFlow 部署脚本
# 用于自动化部署到Cloudflare Worker

echo "🚀 开始部署 SmartFlow 交易策略系统..."

# 检查是否安装了wrangler
if ! command -v wrangler &> /dev/null; then
    echo "❌ 错误: 未找到 wrangler CLI"
    echo "请先安装: npm install -g wrangler"
    exit 1
fi

# 检查是否已登录
if ! wrangler whoami &> /dev/null; then
    echo "⚠️  未登录 Cloudflare，请先登录:"
    wrangler login
fi

# 检查配置文件
if [ ! -f "wrangler.toml" ]; then
    echo "❌ 错误: 未找到 wrangler.toml 配置文件"
    exit 1
fi

# 检查环境变量
echo "🔍 检查配置..."

# 检查Telegram配置
if grep -q "your_telegram_bot_token" wrangler.toml; then
    echo "⚠️  警告: 请先配置 Telegram Bot Token"
    echo "编辑 wrangler.toml 文件，设置正确的 TG_BOT_TOKEN 和 TG_CHAT_ID"
    read -p "是否继续部署？(y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 检查KV命名空间
if grep -q "your_kv_namespace_id" wrangler.toml; then
    echo "⚠️  警告: 请先创建 KV 命名空间"
    echo "运行: wrangler kv:namespace create \"TRADE_LOG\""
    read -p "是否继续部署？(y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 运行测试
echo "🧪 运行API测试..."
if [ -f "test/test-api.js" ]; then
    node test/test-api.js
    if [ $? -ne 0 ]; then
        echo "❌ API测试失败，请检查网络连接"
        read -p "是否继续部署？(y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
else
    echo "⚠️  未找到测试文件，跳过测试"
fi

# 部署到Cloudflare
echo "📦 开始部署到 Cloudflare Worker..."
wrangler deploy

if [ $? -eq 0 ]; then
    echo "✅ 部署成功！"
    echo ""
    echo "🎯 下一步操作："
    echo "1. 访问你的 Worker URL 查看仪表板"
    echo "2. 配置 Telegram Bot 获取推送通知"
    echo "3. 设置定时任务（每小时自动分析）"
    echo ""
    echo "📊 可用接口："
    echo "- / (前端仪表板)"
    echo "- /api/analyze?symbol=BTCUSDT (分析单个交易对)"
    echo "- /api/analyze-all (分析所有交易对)"
    echo "- /api/test (测试API连接)"
    echo ""
    echo "🔧 管理命令："
    echo "- 查看日志: wrangler tail"
    echo "- 查看KV: wrangler kv:key list --binding TRADE_LOG"
    echo "- 更新配置: 编辑 wrangler.toml 后重新运行此脚本"
else
    echo "❌ 部署失败，请检查错误信息"
    exit 1
fi
