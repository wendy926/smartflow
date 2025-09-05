# SmartFlow 代码更新指南

## 🚀 快速更新流程

### 方法一：使用更新脚本（推荐）
```bash
# 1. 上传更新的文件到 VPS
scp -r vps-app/* root@47.237.163.85:/root/smartflow/

# 2. 登录 VPS
ssh root@47.237.163.85

# 3. 进入项目目录
cd /root/smartflow

# 4. 运行更新脚本
./update.sh
```

### 方法二：手动更新
```bash
# 1. 上传更新的文件到 VPS
scp -r vps-app/* root@47.237.163.85:/root/smartflow/

# 2. 登录 VPS
ssh root@47.237.163.85

# 3. 进入项目目录
cd /root/smartflow

# 4. 重启应用
pm2 restart smartflow-app

# 5. 检查状态
pm2 status
```

## 📁 需要更新的核心文件

### 服务端更新
- `server.js` - 主服务器文件
- `package.json` - 依赖配置（如有变化）

### 前端更新
- `public/index.html` - 主页面
- `public/rollup-calculator.html` - 计算器页面

## 🔍 更新后检查

### 1. 检查应用状态
```bash
pm2 status
```
应该看到 `smartflow-app` 状态为 `online`

### 2. 检查日志
```bash
pm2 logs smartflow-app
```
查看是否有错误信息

### 3. 检查网站
访问 `https://smart.aimaventop.com` 确认功能正常

## 🛠️ 常见问题解决

### 应用启动失败
```bash
# 查看错误日志
pm2 logs smartflow-app --err

# 重启应用
pm2 restart smartflow-app

# 如果还是失败，检查依赖
npm install
```

### 端口被占用
```bash
# 查看端口使用情况
netstat -tlnp | grep :3000

# 杀死占用端口的进程
kill -9 <PID>
```

### 数据库问题
```bash
# 检查数据库文件
ls -la smartflow.db

# 如果数据库损坏，删除后重启应用（会重新创建）
rm smartflow.db
pm2 restart smartflow-app
```

## 📊 监控命令

### 实时监控
```bash
# 实时查看日志
pm2 logs smartflow-app --lines 100

# 监控系统资源
htop
```

### 定期检查
```bash
# 查看应用状态
pm2 status

# 查看内存使用
pm2 monit
```

## 🔄 回滚操作

如果更新后出现问题，可以回滚到之前版本：

```bash
# 恢复备份文件
cp server.js.backup server.js
cp -r public.backup public

# 重启应用
pm2 restart smartflow-app
```

## 📝 更新记录

建议每次更新后记录：
- 更新日期
- 更新内容
- 测试结果
- 备注信息
