# SmartFlow VPS 服务信息

## 服务器基本信息

- **服务器IP**: 47.237.163.85
- **SSH端口**: 22
- **用户名**: root
- **项目路径**: /home/admin/smartflow-vps-app/
- **应用端口**: 8080
- **域名**: https://smart.aimaventop.com

## 服务架构

### 1. 应用服务
- **服务名称**: smartflow-app
- **进程管理**: PM2
- **Node.js版本**: 18.19.1
- **启动文件**: server.js
- **运行模式**: fork_mode

### 2. 反向代理
- **服务**: Nginx
- **配置**: 反向代理到 localhost:8080
- **SSL**: 支持HTTPS访问
- **缓存**: 已配置缓存策略

### 3. 数据库
- **类型**: SQLite
- **文件位置**: /home/admin/smartflow-vps-app/vps-app/smartflow.db
- **表结构**:
  - `strategy_analysis`: 策略分析结果
  - `simulations`: 模拟交易记录
  - `alert_history`: 告警历史记录

## 部署流程

### 1. 代码部署
```bash
# 登录服务器
ssh root@47.237.163.85

# 进入项目目录
cd /home/admin/smartflow-vps-app/

# 拉取最新代码
git pull origin main

# 重启应用
pm2 restart all
```

### 2. 服务管理
```bash
# 查看服务状态
pm2 list

# 查看服务日志
pm2 logs smartflow-app

# 重启服务
pm2 restart smartflow-app

# 停止服务
pm2 stop smartflow-app

# 启动服务
pm2 start smartflow-app
```

### 3. Nginx管理
```bash
# 重新加载配置
nginx -s reload

# 清理缓存
rm -rf /var/cache/nginx/*
nginx -s reload
```

## 监控和维护

### 1. 系统监控
- **内存使用**: 通过PM2监控
- **CPU使用**: 通过PM2监控
- **磁盘空间**: 定期检查
- **网络状态**: 检查端口监听

### 2. 应用监控
- **数据收集率**: 通过监控中心查看
- **信号分析率**: 通过监控中心查看
- **模拟交易完成率**: 通过监控中心查看
- **告警历史**: 通过监控中心查看

### 3. 日志管理
- **应用日志**: /root/.pm2/logs/smartflow-app-out.log
- **错误日志**: /root/.pm2/logs/smartflow-app-error.log
- **PM2日志**: /root/.pm2/pm2.log

## 故障排除

### 1. 常见问题
- **端口占用**: 检查8080端口是否被占用
- **内存泄漏**: 定期重启应用
- **数据库锁定**: 检查SQLite文件权限
- **API超时**: 检查Binance API限制

### 2. 性能优化
- **内存清理**: 每5分钟自动清理
- **日志轮转**: 定期清理旧日志
- **缓存策略**: 优化Nginx缓存
- **数据库优化**: 定期清理历史数据

## 安全配置

### 1. SSH配置
- **密钥认证**: 已配置免密登录
- **端口**: 22
- **用户**: root

### 2. 防火墙
- **开放端口**: 22, 80, 443
- **限制访问**: 仅允许必要端口

### 3. 应用安全
- **API限制**: 已配置速率限制
- **数据验证**: 输入数据验证
- **错误处理**: 统一错误处理

## 备份策略

### 1. 代码备份
- **Git仓库**: 自动推送到GitHub
- **本地备份**: 定期备份到本地

### 2. 数据备份
- **数据库**: 定期备份SQLite文件
- **配置文件**: 备份Nginx和PM2配置

## 更新记录

### 2025-01-08
- 修复监控中心页面样式问题
- 优化数据质量状态显示
- 添加状态指示器
- 修复tab标题颜色对比度问题

### 2025-01-07
- 实现内存泄漏修复
- 优化数据库查询性能
- 添加告警历史功能
- 修复模拟交易逻辑

## 联系方式

- **技术支持**: 通过GitHub Issues
- **紧急联系**: 通过SSH直接访问服务器
- **监控告警**: 通过Telegram机器人

---

*最后更新: 2025-01-08*

