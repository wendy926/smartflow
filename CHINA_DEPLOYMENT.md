# 中国用户部署指南

## 问题说明

由于网络环境限制，`workers.dev` 域名在中国大陆可能无法正常访问。本指南提供几种解决方案。

## 解决方案

### 方案1：使用自定义域名（推荐）

#### 步骤1：购买域名
- 推荐使用国内域名服务商：阿里云、腾讯云、华为云
- 或使用国外服务商：Namecheap、GoDaddy

#### 步骤2：配置 Cloudflare
1. 将域名添加到 Cloudflare
2. 更新 DNS 记录
3. 配置 Worker 路由

#### 步骤3：更新 wrangler.toml
```toml
name = "smartflow-trader"
main = "src/index.js"
compatibility_date = "2025-01-07"

# 自定义域名配置
[routes]
pattern = "your-domain.com/*"
zone_name = "your-domain.com"

# 环境变量
[vars]
TG_BOT_TOKEN = "your_telegram_bot_token"
TG_CHAT_ID = "your_telegram_chat_id"

# 定时任务
[[triggers]]
cron = "0 * * * *"
```

#### 步骤4：部署
```bash
wrangler deploy
```

### 方案2：使用国内云服务

#### 阿里云函数计算
```bash
# 安装 Serverless Devs
npm install -g @serverless-devs/s

# 初始化项目
s init smartflow-trader

# 部署
s deploy
```

#### 腾讯云云函数
```bash
# 安装 Serverless Framework
npm install -g serverless

# 部署
serverless deploy
```

### 方案3：使用 Vercel（推荐）

#### 步骤1：安装 Vercel CLI
```bash
npm install -g vercel
```

#### 步骤2：创建 vercel.json
```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "src/index.js"
    }
  ]
}
```

#### 步骤3：部署
```bash
vercel --prod
```

### 方案4：使用 Netlify

#### 步骤1：安装 Netlify CLI
```bash
npm install -g netlify-cli
```

#### 步骤2：创建 netlify.toml
```toml
[build]
  functions = "src"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/index"
  status = 200

[[redirects]]
  from = "/*"
  to = "/.netlify/functions/index"
  status = 200
```

#### 步骤3：部署
```bash
netlify deploy --prod
```

## 测试访问

### 使用 VPN
1. 连接海外 VPN
2. 访问 https://smartflow-trader.wendy-wang926.workers.dev

### 使用代理
1. 配置 HTTP 代理
2. 设置环境变量：
```bash
export HTTP_PROXY=http://your-proxy:port
export HTTPS_PROXY=http://your-proxy:port
```

### 使用移动网络
1. 使用手机热点
2. 某些移动网络可能可以访问

## 推荐方案

对于中国用户，推荐使用：

1. **Vercel** - 免费、稳定、访问速度快
2. **自定义域名 + Cloudflare** - 功能完整、可控制
3. **阿里云函数计算** - 国内服务、访问稳定

## 注意事项

1. **API 限制** - Binance API 在中国可以正常使用
2. **网络环境** - 建议使用稳定的网络环境
3. **合规性** - 确保使用符合当地法规

## 快速开始

选择 Vercel 方案：

```bash
# 1. 安装 Vercel CLI
npm install -g vercel

# 2. 登录 Vercel
vercel login

# 3. 部署项目
vercel --prod

# 4. 访问你的应用
# Vercel 会提供一个 .vercel.app 域名
```

这样你就可以在中国正常访问你的 SmartFlow 交易策略系统了！
