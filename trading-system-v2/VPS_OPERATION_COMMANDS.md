# VPS操作命令 - 拉取代码并重启服务

**日期**: 2025-10-26  
**目标**: 拉取最新代码并重启加密货币策略服务

---

## 📋 操作步骤

### 1. SSH连接到VPS

```bash
ssh root@47.237.163.85
```

或使用密钥：

```bash
ssh -i ~/.ssh/smartflow_vps_correct root@47.237.163.85
```

---

### 2. 切换到项目目录

```bash
cd /home/admin/smartflow-vps-app/vps-app
```

---

### 3. 检查当前PM2进程状态

```bash
pm2 list
```

期望看到的进程：
- main-app (加密货币Web服务)
- strategy-worker (加密货币策略执行器)
- 可能还有其他服务

---

### 4. 拉取最新代码

```bash
git pull origin main
```

---

### 5. 重启加密货币策略服务

```bash
# 重启strategy-worker
pm2 restart strategy-worker

# 重启main-app（如果需要）
pm2 restart main-app
```

---

### 6. 检查服务状态

```bash
# 检查PM2状态
pm2 list

# 查看strategy-worker日志
pm2 logs strategy-worker --lines 50

# 检查系统内存使用
free -h

# 实时监控（可选）
pm2 monit
```

---

## 🔍 验证步骤

### 检查加密货币策略是否正常运行

```bash
# 查看最新交易
mysql -u root -p -e "
SELECT * FROM simulation_trades 
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
ORDER BY created_at DESC
LIMIT 10;
"

# 查看策略日志
pm2 logs strategy-worker --lines 100
```

---

## ⚠️ 注意事项

### 1. 内存使用
- 检查内存是否正常：`free -h`
- 如果内存使用率过高，考虑重启VPS

### 2. 美股模块未启动
- 美股Worker默认未启用（避免占用内存）
- 美股回测需要手动通过API触发
- 不会影响加密货币策略运行

### 3. 保持加密货币服务运行
- main-app：Web服务
- strategy-worker：加密货币策略执行器
- 这两个服务需要保持运行

---

## 🚨 如果遇到问题

### PM2进程不存在

如果找不到strategy-worker，检查是否有其他进程：

```bash
# 查看所有PM2进程
pm2 list

# 查看进程信息
ps aux | grep node
```

### 代码拉取冲突

```bash
# 如果Git有冲突，先stash本地修改
git stash

# 然后拉取
git pull origin main

# 如果有冲突，手动解决
git status
```

### 重启失败

```bash
# 停止所有PM2进程
pm2 stop all

# 删除所有进程
pm2 delete all

# 重新启动（需要查看原来的启动脚本）
# 通常在 package.json 的 pm2.config.js 或类似文件中
```

---

## 📊 预期结果

### PM2进程状态

```bash
┌─────┬─────────────────────┬─────────┬─────────┬──────────┬─────────┐
│ id  │ name                 │ status  │ uptime  │ memory   │ cpu     │
├─────┼─────────────────────┼─────────┼─────────┼──────────┼─────────┤
│ 0   │ main-app             │ online  │ 5m      │ 120MB    │ 2%      │
│ 1   │ strategy-worker      │ online  │ 2m      │ 80MB     │ 5%      │
└─────┴─────────────────────┴─────────┴─────────┴──────────┴─────────┘
```

### 日志输出

```bash
[strategy-worker] 策略执行正常
[strategy-worker] V3策略分析完成
[strategy-worker] ICT策略分析完成
```

---

## ✅ 成功标志

1. ✅ PM2进程正常运行（main-app, strategy-worker）
2. ✅ 内存使用正常（< 80%）
3. ✅ 策略日志显示正常执行
4. ✅ 有新交易产生
5. ✅ 代码已更新到最新版本

---

## 📝 操作记录

执行完操作后，记录结果：

```bash
echo "操作时间: $(date)" >> /tmp/vps_operation.log
echo "PM2状态:" >> /tmp/vps_operation.log
pm2 list >> /tmp/vps_operation.log
echo "内存使用:" >> /tmp/vps_operation.log
free -h >> /tmp/vps_operation.log
```

查看操作记录：

```bash
cat /tmp/vps_operation.log
```

