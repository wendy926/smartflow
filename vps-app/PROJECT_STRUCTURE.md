# SmartFlow 项目结构说明

## 📁 核心文件

### 服务端文件
- `server.js` - 主服务器文件，包含所有API和业务逻辑
- `package.json` - 项目依赖配置
- `ecosystem.config.js` - PM2 进程管理配置

### 前端文件
- `public/index.html` - 主页面，包含所有前端逻辑
- `public/rollup-calculator.html` - 斐波拉契滚仓计算器页面

### 部署脚本
- `deploy.sh` - 完整部署脚本（首次部署使用）
- `update.sh` - 快速更新脚本（代码更新后使用）
- `start-with-env.sh` - 带环境变量的启动脚本

### 配置脚本
- `install-deps.sh` - 安装依赖脚本
- `restart-app.sh` - 重启应用脚本
- `setup-telegram.sh` - Telegram配置脚本
- `fix-telegram-env.sh` - 修复Telegram环境变量脚本

### 文档文件
- `TELEGRAM_SETUP.md` - Telegram配置说明
- `DOMAIN_SETUP.md` - 域名配置说明

## 🚀 部署和更新流程

### 首次部署
```bash
# 1. 上传整个 vps-app 目录到 VPS
# 2. 进入 vps-app 目录
cd vps-app

# 3. 运行部署脚本
./deploy.sh
```

### 代码更新
```bash
# 1. 上传更新的文件到 VPS
# 2. 进入 vps-app 目录
cd vps-app

# 3. 运行更新脚本
./update.sh
```

### 手动操作
```bash
# 查看应用状态
pm2 status

# 查看日志
pm2 logs smartflow-app

# 重启应用
pm2 restart smartflow-app

# 停止应用
pm2 stop smartflow-app

# 启动应用
pm2 start smartflow-app
```

## 📊 数据库文件
- `smartflow.db` - SQLite数据库文件（自动创建）
- 包含以下表：
  - `signal_records` - 信号记录
  - `execution_records` - 执行记录
  - `result_markers` - 结果标记
  - `simulations` - 模拟交易记录
  - `win_rate_stats` - 胜率统计

## 🔧 环境变量
需要设置以下环境变量：
- `TELEGRAM_BOT_TOKEN` - Telegram机器人令牌
- `TELEGRAM_CHAT_ID` - Telegram聊天ID

## 📝 注意事项
1. 确保 VPS 上已安装 Node.js 18+
2. 确保 VPS 上已安装 PM2
3. 确保端口 3000 已开放
4. 数据库文件会自动创建，无需手动操作
5. 历史数据会自动清理（保留6个月）
