# VPS部署指南 - SmartFlow交易系统

## 📋 部署前准备

### 1. 确认VPS环境
- 操作系统: Ubuntu 20.04+
- Node.js: 16.0.0+
- PM2: 已安装
- Git: 已安装

### 2. 确认项目目录
```bash
cd /home/admin/smartflow-vps-app/trading-system-v2
```

## 🚀 部署步骤

### 方法1: 使用自动化脚本（推荐）

1. **上传部署脚本到VPS**:
```bash
# 将 deploy-to-vps.sh 上传到VPS
scp deploy-to-vps.sh root@47.237.163.85:/home/admin/smartflow-vps-app/trading-system-v2/
```

2. **在VPS上执行部署**:
```bash
ssh root@47.237.163.85
cd /home/admin/smartflow-vps-app/trading-system-v2
chmod +x deploy-to-vps.sh
./deploy-to-vps.sh
```

### 方法2: 手动部署

1. **连接到VPS**:
```bash
ssh root@47.237.163.85
cd /home/admin/smartflow-vps-app/trading-system-v2
```

2. **停止当前服务**:
```bash
pm2 stop smartflow-trading
pm2 stop all
```

3. **备份当前代码**:
```bash
cp -r . "../backup-$(date +%Y%m%d-%H%M%S)"
```

4. **拉取最新代码**:
```bash
git fetch origin
git reset --hard origin/main
```

5. **安装依赖**:
```bash
npm install
```

6. **运行测试**:
```bash
# 运行外部API测试
node test-external-apis.js

# 运行Sweep测试
node test-sweep.js

# 运行Jest测试套件
npm test
```

7. **启动服务**:
```bash
pm2 start ecosystem.config.js
```

8. **检查服务状态**:
```bash
pm2 status
pm2 logs --lines 20
```

## 🧪 测试验证

### 1. 外部API测试
```bash
node test-external-apis.js
```
**预期输出**:
- ✅ Binance API: 正常
- ✅ Fear & Greed Index: 正常
- ✅ FRED API: 正常

### 2. Sweep测试
```bash
node test-sweep.js
```
**预期输出**:
- ICT策略分析完成
- 检测到扫荡信号

### 3. Jest测试套件
```bash
npm test
```
**预期输出**:
- 所有测试通过
- 测试覆盖率报告

### 4. 服务健康检查
```bash
pm2 status
```
**预期输出**:
- smartflow-trading: online
- 内存使用正常
- CPU使用正常

## 📊 监控和日志

### 1. 查看服务状态
```bash
pm2 status
pm2 monit
```

### 2. 查看日志
```bash
# 查看所有日志
pm2 logs

# 查看特定服务日志
pm2 logs smartflow-trading

# 查看实时日志
pm2 logs --follow
```

### 3. 重启服务
```bash
pm2 restart smartflow-trading
```

### 4. 停止服务
```bash
pm2 stop smartflow-trading
```

## 🌐 访问地址

部署完成后，可以通过以下地址访问：

- **主应用**: http://47.237.163.85:3000
- **监控面板**: http://47.237.163.85:3000/monitoring
- **API文档**: http://47.237.163.85:3000/api-docs

## 🔧 故障排除

### 1. 服务启动失败
```bash
# 查看详细错误日志
pm2 logs smartflow-trading --err

# 检查端口占用
netstat -tulpn | grep :3000

# 检查Node.js版本
node --version
```

### 2. 测试失败
```bash
# 检查网络连接
ping api.binance.com

# 检查API密钥配置
cat .env | grep API

# 运行单个测试
npm test -- --testNamePattern="特定测试名称"
```

### 3. 数据库连接问题
```bash
# 检查数据库配置
cat .env | grep DB

# 测试数据库连接
node -e "require('./src/database/connection').test()"
```

### 4. 内存不足
```bash
# 查看内存使用
free -h
htop

# 重启服务释放内存
pm2 restart smartflow-trading
```

## 📈 性能优化

### 1. 系统资源监控
```bash
# 安装htop
apt install htop

# 监控系统资源
htop
```

### 2. 日志轮转
```bash
# 配置PM2日志轮转
pm2 install pm2-logrotate
```

### 3. 自动重启
```bash
# 配置PM2自动重启
pm2 startup
pm2 save
```

## 🔄 更新流程

### 1. 日常更新
```bash
git pull origin main
npm install
pm2 restart smartflow-trading
```

### 2. 重大更新
```bash
# 备份当前版本
cp -r . "../backup-$(date +%Y%m%d-%H%M%S)"

# 拉取最新代码
git fetch origin
git reset --hard origin/main

# 安装依赖
npm install

# 运行测试
npm test

# 重启服务
pm2 restart smartflow-trading
```

## 📞 技术支持

如遇问题，请提供：
1. 错误日志: `pm2 logs smartflow-trading --err`
2. 系统状态: `pm2 status`
3. 系统资源: `htop` 截图
4. 测试结果: `npm test` 输出

---

**部署时间**: 2025年1月7日  
**部署状态**: 🔄 待部署  
**测试状态**: ✅ 已准备  
**服务状态**: ⏹️ 待启动
