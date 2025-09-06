# SmartFlow VPS 部署指南

## 🚀 快速部署

### 1. 服务器准备
```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version
npm --version
```

### 2. 项目部署
```bash
# 克隆项目
git clone <repository-url>
cd smartflow/vps-app

# 一键部署
./deploy.sh
```

### 3. 配置 Nginx (可选)
```bash
# 安装 Nginx
sudo apt install nginx -y

# 配置反向代理
sudo cp nginx-config.conf /etc/nginx/sites-available/smartflow
sudo ln -s /etc/nginx/sites-available/smartflow /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 🔧 管理命令

### 应用管理
```bash
./deploy.sh      # 完整部署
./update.sh      # 更新应用
./restart.sh     # 重启应用
./status.sh      # 检查状态
./cleanup.sh     # 清理项目
```

### PM2 管理
```bash
pm2 status                    # 查看状态
pm2 logs smartflow-app       # 查看日志
pm2 restart smartflow-app    # 重启应用
pm2 stop smartflow-app       # 停止应用
pm2 delete smartflow-app     # 删除应用
pm2 save                     # 保存配置
pm2 startup                  # 设置开机自启
```

## 📊 监控和维护

### 系统监控
```bash
# 查看系统资源
htop
df -h
free -h

# 查看端口占用
netstat -tuln | grep 8080
lsof -i :8080
```

### 日志管理
```bash
# 查看应用日志
pm2 logs smartflow-app

# 查看系统日志
sudo journalctl -u nginx
sudo tail -f /var/log/nginx/access.log
```

### 数据库备份
```bash
# 备份数据库
cp smartflow.db smartflow.db.backup.$(date +%Y%m%d_%H%M%S)

# 恢复数据库
cp smartflow.db.backup.YYYYMMDD_HHMMSS smartflow.db
```

## 🛡️ 安全配置

### 防火墙设置
```bash
# 配置 UFW 防火墙
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 8080
sudo ufw enable
```

### SSL 证书 (Let's Encrypt)
```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx -y

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo crontab -e
# 添加: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 🔄 更新流程

### 自动更新
```bash
# 创建更新脚本
cat > auto-update.sh << 'EOF'
#!/bin/bash
cd /path/to/smartflow/vps-app
git pull origin main
./update.sh
EOF

chmod +x auto-update.sh

# 设置定时任务
crontab -e
# 添加: 0 2 * * * /path/to/auto-update.sh
```

### 手动更新
```bash
# 1. 备份当前版本
./cleanup.sh

# 2. 拉取最新代码
git pull origin main

# 3. 更新应用
./update.sh

# 4. 检查状态
./status.sh
```

## 🚨 故障排除

### 常见问题

1. **应用无法启动**
   ```bash
   # 检查端口占用
   lsof -i :8080
   
   # 检查日志
   pm2 logs smartflow-app
   
   # 重启应用
   pm2 restart smartflow-app
   ```

2. **内存不足**
   ```bash
   # 查看内存使用
   free -h
   
   # 重启应用释放内存
   pm2 restart smartflow-app
   
   # 增加交换空间
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

3. **数据库错误**
   ```bash
   # 检查数据库文件
   ls -la smartflow.db
   
   # 修复权限
   chmod 664 smartflow.db
   chown $USER:$USER smartflow.db
   ```

4. **API 连接失败**
   ```bash
   # 检查网络连接
   ping api.binance.com
   
   # 检查防火墙
   sudo ufw status
   ```

### 性能优化

1. **增加内存限制**
   ```bash
   # 编辑 ecosystem.config.js
   max_memory_restart: '2G'
   ```

2. **启用集群模式**
   ```bash
   # 编辑 ecosystem.config.js
   instances: 'max',
   exec_mode: 'cluster'
   ```

3. **优化 Nginx**
   ```bash
   # 编辑 /etc/nginx/nginx.conf
   worker_processes auto;
   worker_connections 1024;
   ```

## 📈 监控指标

### 关键指标
- **CPU 使用率**: < 80%
- **内存使用率**: < 85%
- **磁盘使用率**: < 90%
- **应用响应时间**: < 2秒
- **错误率**: < 1%

### 监控工具
```bash
# 安装监控工具
sudo apt install htop iotop nethogs -y

# 实时监控
htop                    # CPU 和内存
iotop                   # 磁盘 I/O
nethogs                 # 网络使用
```

## 🔐 安全建议

1. **定期更新系统**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **配置 SSH 密钥**
   ```bash
   ssh-keygen -t rsa -b 4096
   ssh-copy-id user@server
   ```

3. **禁用密码登录**
   ```bash
   sudo nano /etc/ssh/sshd_config
   # 设置: PasswordAuthentication no
   sudo systemctl restart ssh
   ```

4. **定期备份**
   ```bash
   # 创建备份脚本
   cat > backup.sh << 'EOF'
   #!/bin/bash
   tar -czf smartflow-backup-$(date +%Y%m%d).tar.gz /path/to/smartflow/
   EOF
   ```

---

**部署完成！** 🎉

访问地址: `http://your-server-ip:8080`
