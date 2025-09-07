# SmartFlow VPS 部署说明

## 🚀 快速开始

### 方法一：一键部署（推荐）
```bash
# 在 vps-app 目录中运行
./update-deploy.sh
```

### 方法二：快速部署
```bash
# 快速更新和部署
./quick-deploy.sh
```

### 方法三：手动部署
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

## 📋 部署脚本说明

| 脚本 | 功能 | 适用场景 |
|------|------|----------|
| `update-deploy.sh` | 完整更新部署 | 正式环境，需要完整备份和检查 |
| `quick-deploy.sh` | 快速部署 | 开发环境，快速更新 |
| `deploy.sh` | 初始部署 | 首次部署应用 |

## 🔧 部署后验证

### 1. 检查应用状态
```bash
pm2 status
pm2 logs smartflow-app
```

### 2. 测试功能
```bash
# 健康检查
curl http://localhost:8080/api/health-check

# 信号接口
curl http://localhost:8080/api/signals

# 监控面板
curl http://localhost:8080/api/monitoring-dashboard
```

### 3. 访问应用
- **主页**: `http://your-server-ip:8080`
- **测试页面**: `http://your-server-ip:8080/test-iphone.html`

## 📱 新功能特性

### iPhone 16 Pro Max 适配
- ✅ 竖屏模式 (430×932)
- ✅ 横屏模式 (932×430)
- ✅ 触摸优化 (44px 最小点击区域)
- ✅ 响应式布局

### 性能优化
- ✅ 统一监控中心加载优化
- ✅ 数据更新时机修复
- ✅ 触摸交互体验改进

## 🛠️ 故障排除

### 应用启动失败
```bash
# 查看详细日志
pm2 logs smartflow-app --lines 50

# 检查端口占用
lsof -i :8080

# 重启应用
pm2 restart smartflow-app
```

### 数据库问题
```bash
# 检查数据库文件
ls -la smartflow.db

# 修复权限
chmod 664 smartflow.db
```

### 依赖问题
```bash
# 清理并重新安装
rm -rf node_modules package-lock.json
npm install --production
```

## 📊 监控命令

```bash
# 查看应用状态
pm2 status

# 查看实时日志
pm2 logs smartflow-app --follow

# 查看系统资源
pm2 monit

# 重启应用
pm2 restart smartflow-app

# 停止应用
pm2 stop smartflow-app
```

## 🔒 安全建议

1. **防火墙配置**
   ```bash
   sudo ufw allow 8080
   sudo ufw enable
   ```

2. **SSL 证书**（推荐）
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

3. **定期更新**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

## 📞 支持

如果遇到问题，请检查：
1. 应用日志：`pm2 logs smartflow-app`
2. 系统状态：`pm2 status`
3. 端口监听：`netstat -tlnp | grep :8080`
4. 网络连接：`curl http://localhost:8080/api/health-check`

---

**注意**: 部署前请确保已备份重要数据，建议在测试环境先验证功能正常后再部署到生产环境。
