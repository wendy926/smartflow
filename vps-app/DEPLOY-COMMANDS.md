# VPS 部署命令速查

## 🚀 一键部署（推荐）

```bash
# 在 vps-app 目录中执行
./update-deploy.sh
```

## ⚡ 快速部署

```bash
# 快速更新和部署
./quick-deploy.sh
```

## 🔧 手动部署步骤

```bash
# 1. 停止应用
pm2 stop smartflow-app

# 2. 备份数据库
cp smartflow.db smartflow.db.backup.$(date +%Y%m%d_%H%M%S)

# 3. 获取最新代码
git stash
git pull origin main

# 4. 安装依赖
npm install --production

# 5. 启动应用
pm2 start ecosystem.config.js
```

## 📊 验证部署

```bash
# 检查状态
pm2 status

# 查看日志
pm2 logs smartflow-app

# 测试接口
curl http://localhost:8080/api/health-check
```

## 🌐 访问地址

- **主页**: `http://your-server-ip:8080`
- **测试页面**: `http://your-server-ip:8080/test-iphone.html`

## 🆕 新功能

- iPhone 16 Pro Max 竖屏/横屏适配
- 统一监控中心性能优化
- 数据更新时机修复
- 触摸交互体验优化
