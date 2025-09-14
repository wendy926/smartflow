# SmartFlow VPS 部署指南

## 概述

本指南将帮助你在VPS上获取最新代码并重新部署SmartFlow应用，包括最新的iPhone 16 Pro Max适配功能。

## 部署前准备

### 1. 系统要求
- **操作系统**: Ubuntu 20.04+ 或 CentOS 8+
- **Node.js**: 18.0.0 或更高版本
- **内存**: 2GB+ 推荐
- **存储**: 30GB+ 可用空间
- **网络**: 稳定的网络连接

### 2. 必要软件
```bash
# 更新系统包
sudo apt update && sudo apt upgrade -y

# 安装必要软件
sudo apt install -y git curl wget unzip

# 安装 Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version
npm --version
```

## 部署步骤

### 方法一：使用更新部署脚本（推荐）

#### 1. 克隆或更新代码
```bash
# 如果是首次部署，克隆仓库
git clone <your-repository-url> smartflow
cd smartflow/vps-app

# 如果已有代码，直接进入目录
cd /path/to/smartflow/vps-app
```

#### 2. 运行更新部署脚本
```bash
# 使用默认分支 (main)
./update-deploy.sh

# 或指定分支
./update-deploy.sh develop
```

#### 3. 脚本功能说明
- ✅ 自动备份当前版本
- ✅ 备份数据库文件
- ✅ 拉取最新代码
- ✅ 安装/更新依赖
- ✅ 停止旧应用
- ✅ 启动新应用
- ✅ 健康检查
- ✅ 设置开机自启

### 方法二：手动部署

#### 1. 备份当前版本
```bash
# 创建备份目录
mkdir -p ../backups/$(date +%Y%m%d_%H%M%S)
cp -r . ../backups/$(date +%Y%m%d_%H%M%S)/

# 备份数据库
cp smartflow.db smartflow.db.backup.$(date +%Y%m%d_%H%M%S)
```

#### 2. 获取最新代码
```bash
# 保存当前修改
git stash push -m "Backup before update $(date)"

# 拉取最新代码
git fetch origin
git checkout main
git pull origin main
```

#### 3. 安装依赖
```bash
# 安装生产环境依赖
npm install --production

# 安装 PM2（如果未安装）
npm install -g pm2
```

#### 4. 重启应用
```bash
# 停止现有应用
pm2 stop smartflow-app

# 启动应用
pm2 start ecosystem.config.js

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup
```

## 部署后验证

### 1. 检查应用状态
```bash
# 查看 PM2 状态
pm2 status

# 查看应用日志
pm2 logs smartflow-app

# 查看实时日志
pm2 logs smartflow-app --follow
```

### 2. 检查端口监听
```bash
# 检查端口 8080 是否监听
netstat -tlnp | grep :8080

# 或使用 ss 命令
ss -tlnp | grep :8080
```

### 3. 测试应用功能
```bash
# 测试健康检查
curl http://localhost:8080/api/health-check

# 测试信号接口
curl http://localhost:8080/api/signals

# 测试监控面板
curl http://localhost:8080/api/monitoring-dashboard
```

### 4. 访问应用
- **主页**: `http://your-server-ip:8080`
- **测试页面**: `http://your-server-ip:8080/test-iphone.html`
- **API端点**: `http://your-server-ip:8080/api/signals`

## 新功能验证

### 1. iPhone 16 Pro Max 适配测试
1. 访问测试页面：`http://your-server-ip:8080/test-iphone.html`
2. 点击"打开监控面板"按钮
3. 测试竖屏和横屏模式切换
4. 验证触摸交互是否正常

### 2. 统一监控中心测试
1. 访问主页：`http://your-server-ip:8080`
2. 点击"统一监控中心"按钮
3. 验证页面加载速度
4. 测试各种交互功能

### 3. 数据更新时机测试
1. 查看状态显示区域
2. 验证趋势更新时间（4小时周期）
3. 验证信号更新时间（1小时周期）
4. 验证执行更新时间（15分钟周期）

## 故障排除

### 1. 应用启动失败
```bash
# 查看详细日志
pm2 logs smartflow-app --lines 50

# 检查端口占用
lsof -i :8080

# 重启应用
pm2 restart smartflow-app
```

### 2. 数据库问题
```bash
# 检查数据库文件权限
ls -la smartflow.db

# 修复权限
chmod 664 smartflow.db

# 恢复备份
cp smartflow.db.backup.* smartflow.db
```

### 3. 依赖问题
```bash
# 清理 node_modules
rm -rf node_modules package-lock.json

# 重新安装
npm install --production
```

### 4. 网络问题
```bash
# 检查防火墙
sudo ufw status

# 开放端口
sudo ufw allow 8080

# 检查 Nginx 配置（如果使用）
sudo nginx -t
```

## 性能优化

### 1. 系统优化
```bash
# 增加文件描述符限制
echo "* soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 65536" | sudo tee -a /etc/security/limits.conf

# 优化内核参数
echo "net.core.somaxconn = 65535" | sudo tee -a /etc/sysctl.conf
echo "net.ipv4.tcp_max_syn_backlog = 65535" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### 2. PM2 优化
```bash
# 设置 PM2 最大内存限制
pm2 start ecosystem.config.js --max-memory-restart 1G

# 启用集群模式（多核CPU）
pm2 start ecosystem.config.js -i max
```

### 3. Nginx 配置（可选）
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 监控和维护

### 1. 日志管理
```bash
# 查看应用日志
pm2 logs smartflow-app

# 清理旧日志
pm2 flush

# 设置日志轮转
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 2. 性能监控
```bash
# 查看系统资源使用
pm2 monit

# 查看进程信息
pm2 show smartflow-app

# 重启应用
pm2 restart smartflow-app
```

### 3. 定期维护
```bash
# 创建维护脚本
cat > maintenance.sh << 'EOF'
#!/bin/bash
echo "开始维护任务..."
pm2 restart smartflow-app
pm2 flush
echo "维护完成"
EOF

chmod +x maintenance.sh

# 设置定时任务
crontab -e
# 添加：0 2 * * * /path/to/maintenance.sh
```

## 安全建议

### 1. 防火墙配置
```bash
# 只开放必要端口
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 8080
sudo ufw enable
```

### 2. SSL 证书（推荐）
```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 获取 SSL 证书
sudo certbot --nginx -d your-domain.com
```

### 3. 定期更新
```bash
# 更新系统包
sudo apt update && sudo apt upgrade -y

# 更新 Node.js
sudo npm install -g n
sudo n stable
```

## 总结

通过本指南，你可以成功在VPS上部署和更新SmartFlow应用。新版本包含了iPhone 16 Pro Max的完整适配，提供了更好的移动端用户体验。

### 主要特性
- ✅ iPhone 16 Pro Max 竖屏和横屏适配
- ✅ 统一监控中心性能优化
- ✅ 数据更新时机修复
- ✅ 触摸交互体验优化
- ✅ 响应式布局改进

### 支持
如果遇到问题，请检查：
1. 系统日志：`pm2 logs smartflow-app`
2. 应用状态：`pm2 status`
3. 端口监听：`netstat -tlnp | grep :8080`
4. 网络连接：`curl http://localhost:8080/api/health-check`
