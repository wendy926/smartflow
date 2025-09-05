#!/bin/bash

# SmartFlow 快速设置脚本
# 自动完成项目初始化和配置

echo "🚀 SmartFlow 交易策略系统 - 快速设置"
echo "======================================"

# 检查Node.js版本
echo "🔍 检查环境..."
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未安装 Node.js"
    echo "请先安装 Node.js: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version)
echo "✅ Node.js 版本: $NODE_VERSION"

# 检查npm
if ! command -v npm &> /dev/null; then
    echo "❌ 错误: 未安装 npm"
    exit 1
fi

echo "✅ npm 版本: $(npm --version)"

# 安装依赖
echo ""
echo "📦 安装项目依赖..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ 依赖安装失败"
    exit 1
fi

echo "✅ 依赖安装完成"

# 检查wrangler
echo ""
echo "🔧 检查 Cloudflare Wrangler..."
if ! command -v wrangler &> /dev/null; then
    echo "⚠️  未找到 wrangler，正在安装..."
    npm install -g wrangler
    if [ $? -ne 0 ]; then
        echo "❌ wrangler 安装失败"
        exit 1
    fi
fi

echo "✅ Wrangler 版本: $(wrangler --version)"

# 检查是否已登录Cloudflare
echo ""
echo "🔐 检查 Cloudflare 登录状态..."
if ! wrangler whoami &> /dev/null; then
    echo "⚠️  未登录 Cloudflare"
    echo "请运行以下命令登录:"
    echo "wrangler login"
    echo ""
    read -p "是否现在登录？(y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        wrangler login
    else
        echo "⚠️  请稍后手动登录: wrangler login"
    fi
else
    echo "✅ 已登录 Cloudflare"
fi

# 创建KV命名空间
echo ""
echo "🗄️  检查 KV 命名空间..."
if grep -q "your_kv_namespace_id" wrangler.toml; then
    echo "⚠️  需要创建 KV 命名空间"
    echo "正在创建 TRADE_LOG KV 命名空间..."
    
    KV_OUTPUT=$(wrangler kv:namespace create "TRADE_LOG" 2>&1)
    if [ $? -eq 0 ]; then
        # 提取KV ID
        KV_ID=$(echo "$KV_OUTPUT" | grep -o 'id = "[^"]*"' | cut -d'"' -f2)
        if [ ! -z "$KV_ID" ]; then
            # 更新wrangler.toml
            sed -i.bak "s/your_kv_namespace_id/$KV_ID/g" wrangler.toml
            echo "✅ KV 命名空间创建成功，ID: $KV_ID"
            echo "✅ 已更新 wrangler.toml 配置"
        else
            echo "⚠️  无法提取 KV ID，请手动更新 wrangler.toml"
        fi
    else
        echo "❌ KV 命名空间创建失败"
        echo "请手动运行: wrangler kv:namespace create \"TRADE_LOG\""
    fi
else
    echo "✅ KV 命名空间已配置"
fi

# 运行测试
echo ""
echo "🧪 运行系统测试..."
npm run test

if [ $? -eq 0 ]; then
    echo "✅ 系统测试通过"
else
    echo "⚠️  系统测试失败，但可以继续"
fi

# 显示下一步操作
echo ""
echo "🎉 设置完成！"
echo ""
echo "📋 下一步操作:"
echo "1. 配置 Telegram Bot (可选):"
echo "   - 编辑 wrangler.toml 设置 TG_BOT_TOKEN 和 TG_CHAT_ID"
echo ""
echo "2. 启动本地开发:"
echo "   npm run dev"
echo ""
echo "3. 部署到 Cloudflare:"
echo "   npm run deploy:prod"
echo ""
echo "4. 查看帮助:"
echo "   npm run"
echo ""
echo "🔗 有用的命令:"
echo "- 查看日志: npm run logs"
echo "- 查看KV: npm run kv:list"
echo "- 测试API: npm run test:api"
echo ""
echo "📚 更多信息请查看 README.md"
