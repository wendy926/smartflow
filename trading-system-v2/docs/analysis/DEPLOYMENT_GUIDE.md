# 交易系统V2.0部署指南

## 📋 项目概述

**项目名称**: Trading System V2.0  
**GitHub仓库**: https://github.com/UpMeAI/trade_strategy.git  
**域名**: https://smart.aimaventop.com  
**主服务端口**: 8080  
**VPS规格**: 2C 1G 30GB  

## 🏗️ 项目结构

```
trading-system-v2/
├── src/                          # 源代码目录
│   ├── main.js                   # 主应用入口
│   ├── config/                   # 配置文件
│   ├── strategies/               # 策略实现
│   ├── workers/                  # 工作进程
│   ├── api/                      # API接口
│   ├── database/                 # 数据库相关
│   ├── cache/                    # 缓存相关
│   ├── utils/                    # 工具函数
│   └── web/                      # 前端页面
├── database/                     # 数据库脚本
│   └── init.sql                  # 数据库初始化脚本
├── config/                       # 配置文件
│   └── nginx/                    # Nginx配置
│       └── nginx.conf            # Nginx主配置
├── scripts/                      # 部署脚本
│   ├── deploy-vps.sh             # VPS部署脚本
│   ├── update-vps.sh             # VPS更新脚本
│   └── init-git.sh               # Git初始化脚本
├── logs/                         # 日志目录
├── data/                         # 数据目录
├── package.json                  # 项目依赖
├── ecosystem.config.js           # PM2配置
├── env.example                   # 环境变量示例
├── .gitignore                    # Git忽略文件
└── .gitattributes               # Git属性文件
```

## 🚀 快速部署

### 1. 本地准备

```bash
# 进入项目目录
cd /Users/kaylame/KaylaProject/smartflow/trading-system-v2

# 初始化Git仓库
./scripts/init-git.sh

# 提交代码到GitHub
git add .
git commit -m "Initial commit: Trading System V2.0"
git push -u origin main
```

### 2. VPS部署

```bash
# 执行部署脚本
./scripts/deploy-vps.sh
```

### 3. 代码更新

```bash
# 更新代码到VPS
./scripts/update-vps.sh
```

## ⚙️ 系统配置

### 端口配置
- **主服务端口**: 8080
- **Nginx端口**: 80 (HTTP) / 443 (HTTPS)
- **MySQL端口**: 3306
- **Redis端口**: 6379

### 内存分配
- **主应用**: 120MB
- **策略工作进程**: 150MB
- **数据清理进程**: 50MB
- **监控进程**: 30MB
- **MySQL**: 150MB
- **Redis**: 80MB
- **总计**: ~680MB (66% 使用率)

### 进程配置
- **主应用**: 1个实例，端口8080
- **策略工作进程**: 1个实例，每5分钟重启
- **数据清理进程**: 1个实例，每天凌晨2点执行
- **监控进程**: 1个实例，持续运行

## 🗄️ 数据库设计

### 主要表结构
1. **symbols** - 交易对管理表
2. **strategy_judgments** - 策略判断记录表
3. **simulation_trades** - 模拟交易记录表
4. **system_monitoring** - 系统监控数据表
5. **symbol_statistics** - 交易对统计表
6. **system_config** - 系统配置表

### 数据保留策略
- **策略判断数据**: 60天
- **模拟交易数据**: 90天
- **监控数据**: 30天
- **日志数据**: 7天

## 🔧 环境变量配置

```bash
# 应用配置
NODE_ENV=production
PORT=8080
API_PREFIX=/api/v1

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_NAME=trading_system
DB_USER=trading_user
DB_PASSWORD=Trading@2024!

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Binance API配置
BINANCE_API_KEY=your_binance_api_key
BINANCE_SECRET_KEY=your_binance_secret_key

# Telegram配置
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
TELEGRAM_ENABLED=false

# 监控配置
MONITOR_INTERVAL=30000
CPU_THRESHOLD=60
MEMORY_THRESHOLD=60
DISK_THRESHOLD=80
```

## 📊 监控与告警

### 资源监控
- **CPU使用率**: 超过60%告警
- **内存使用率**: 超过60%告警
- **磁盘使用率**: 超过80%告警

### 服务监控
- **API成功率**: 超过95%阈值
- **数据库连接**: 连接池状态
- **Redis连接**: 缓存状态
- **策略执行**: 成功率统计

### 告警方式
- **Telegram通知**: 实时告警
- **日志记录**: 详细日志
- **PM2监控**: 进程状态

## 🔄 维护操作

### 常用命令

```bash
# 连接VPS
ssh -i ~/.ssh/smartflow_vps_correct root@47.237.163.85

# 进入项目目录
cd /home/admin/trading-system-v2

# 查看服务状态
pm2 status

# 查看日志
pm2 logs

# 重启服务
pm2 restart all

# 停止服务
pm2 stop all

# 查看系统资源
htop
df -h
free -h

# 查看Nginx状态
systemctl status nginx

# 查看MySQL状态
systemctl status mysql

# 查看Redis状态
systemctl status redis-server
```

### 数据库维护

```bash
# 连接数据库
mysql -u trading_user -p'Trading@2024!' trading_system

# 查看表状态
SHOW TABLE STATUS;

# 优化表
OPTIMIZE TABLE strategy_judgments;
OPTIMIZE TABLE simulation_trades;

# 清理过期数据
CALL CleanupExpiredData();
```

## 🚨 故障排除

### 常见问题

1. **服务无法启动**
   - 检查端口占用: `netstat -tlnp | grep 8080`
   - 查看PM2日志: `pm2 logs`
   - 检查内存使用: `free -h`

2. **数据库连接失败**
   - 检查MySQL状态: `systemctl status mysql`
   - 检查连接配置: 查看`.env`文件
   - 测试连接: `mysql -u trading_user -p`

3. **Nginx配置错误**
   - 测试配置: `nginx -t`
   - 查看错误日志: `tail -f /var/log/nginx/error.log`
   - 重启Nginx: `systemctl restart nginx`

4. **内存不足**
   - 查看内存使用: `free -h`
   - 重启服务: `pm2 restart all`
   - 清理缓存: `pm2 flush`

### 紧急恢复

```bash
# 完全重启系统
pm2 kill
pm2 start ecosystem.config.js

# 重启所有服务
systemctl restart nginx mysql redis-server

# 清理系统缓存
sync
echo 3 > /proc/sys/vm/drop_caches
```

## 📈 性能优化

### 数据库优化
- 使用分区表提高查询性能
- 定期清理过期数据
- 优化索引配置
- 调整缓冲池大小

### 缓存优化
- Redis内存限制80MB
- 使用LRU淘汰策略
- 设置合理的TTL
- 压缩存储数据

### 应用优化
- 限制进程内存使用
- 启用垃圾回收
- 批量处理数据
- 异步处理任务

## 🔐 安全配置

### SSL证书
- 使用Let's Encrypt免费证书
- 自动续期配置
- 强制HTTPS重定向

### 防火墙
- 只开放必要端口
- 限制访问来源
- 定期更新系统

### 数据安全
- 数据库用户权限最小化
- 敏感信息加密存储
- 定期备份数据

## 📞 技术支持

如有问题，请检查：
1. 系统日志: `pm2 logs`
2. 错误日志: `tail -f logs/error.log`
3. 系统资源: `htop`, `df -h`
4. 服务状态: `systemctl status`

---

**最后更新**: 2025-01-07  
**版本**: 2.0.0  
**维护者**: SmartFlow Team
