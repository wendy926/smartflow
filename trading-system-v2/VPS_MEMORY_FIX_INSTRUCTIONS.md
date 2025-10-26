# VPS内存泄漏修复和重启指南

**日期**: 2025-10-26  
**问题**: VPS内存使用100%，已重启实例恢复  
**解决方案**: 修复美股策略内存泄漏，重启加密货币服务

---

## ✅ 已修复的问题

### 1. 美股回测引擎优化
- ✅ 减少PnL更新频率（每10根K线一次）
- ✅ 定期清理trades数组（避免内存堆积）
- ✅ 添加512MB内存限制
- ✅ 添加内存监控和垃圾回收

### 2. 美股Worker禁用
- ✅ Worker默认不启动（避免占用内存）
- ✅ 需要通过环境变量启用
- ✅ 不会影响加密货币策略

### 3. 代码已提交
- ✅ 所有修复已推送到GitHub
- ✅ 创建了VPS更新脚本
- ✅ 创建了详细的操作指南

---

## 🚀 在VPS上执行操作

### 方法1: 使用更新脚本（推荐）

```bash
# 1. SSH连接到VPS
ssh root@47.237.163.85

# 2. 进入项目目录
cd /home/admin/smartflow-vps-app/vps-app

# 3. 如果脚本还在，直接运行
chmod +x update-vps.sh
./update-vps.sh
```

### 方法2: 手动执行命令

```bash
# 1. SSH连接到VPS
ssh root@47.237.163.85

# 2. 进入项目目录
cd /home/admin/smartflow-vps-app/vps-app

# 3. 查看当前PM2进程
pm2 list

# 4. 拉取最新代码
git pull origin main

# 5. 重启加密货币策略服务
pm2 restart strategy-worker

# 6. 重启main-app（如果需要）
pm2 restart main-app

# 7. 检查状态
pm2 list
pm2 logs strategy-worker --lines 50
```

---

## 📋 详细操作步骤

### 1. 连接VPS

```bash
ssh root@47.237.163.85
```

如果连接失败，检查SSH密钥：

```bash
ssh -i ~/.ssh/id_rsa root@47.237.163.85
```

### 2. 检查PM2进程

```bash
pm2 list
```

期望输出：
```
┌─────┬──────────────────┬─────────┬─────────┬──────────┬─────────┐
│ id  │ name              │ status  │ uptime  │ memory   │ cpu     │
├─────┼──────────────────┼─────────┼─────────┼──────────┼─────────┤
│ 0   │ main-app          │ online  │ ...     │ ...      │ ...     │
│ 1   │ strategy-worker   │ online  │ ...     │ ...      │ ...     │
└─────┴──────────────────┴─────────┴─────────┴──────────┴─────────┘
```

### 3. 拉取代码

```bash
cd /home/admin/smartflow-vps-app/vps-app
git pull origin main
```

如果有冲突：
```bash
git stash
git pull origin main
git stash pop
```

### 4. 重启服务

```bash
# 重启策略执行器
pm2 restart strategy-worker

# 等待几秒查看状态
sleep 3
pm2 list

# 查看日志
pm2 logs strategy-worker --lines 50
```

### 5. 验证服务

```bash
# 检查内存使用
free -h

# 检查PM2状态
pm2 list

# 查看最新日志
pm2 logs strategy-worker --lines 100 | tail -n 50

# 实时监控（按Ctrl+C退出）
pm2 monit
```

---

## 🔍 验证要点

### 1. PM2进程正常
- ✅ main-app 状态为 online
- ✅ strategy-worker 状态为 online
- ✅ 内存使用正常（< 80%）

### 2. 策略正常运行
```bash
# 查看策略日志
pm2 logs strategy-worker | grep "策略执行"

# 检查最新交易
# （需要数据库访问）
```

### 3. 内存使用正常
```bash
free -h
# 应该显示内存使用率 < 80%

# 查看详细内存使用
pm2 monit
```

---

## ⚠️ 注意事项

### 美股模块状态
- ✅ **未启动**: 美股Worker默认不运行
- ✅ **不影响**: 不会影响加密货币策略
- ✅ **可用**: 需要时可通过API手动触发

### 加密货币服务
- ✅ **保持运行**: main-app 和 strategy-worker
- ✅ **正常交易**: 加密货币策略继续运行
- ✅ **无影响**: 美股模块不影响现有服务

### 内存管理
- ✅ **优化**: 回测引擎已优化内存使用
- ✅ **监控**: 添加了内存监控机制
- ✅ **限制**: 512MB内存使用限制
- ✅ **清理**: 定期清理大数组

---

## 🎯 预期结果

### PM2状态
```bash
┌─────┬──────────────────┬────────┬─────────┬──────────┬─────────┐
│ id  │ name              │ status │ uptime  │ memory   │ cpu     │
├─────┼──────────────────┼────────┼─────────┼──────────┼─────────┤
│ 0   │ main-app          │ online │ 5m      │ ~120MB   │ ~2%     │
│ 1   │ strategy-worker   │ online │ 2m      │ ~80MB    │ ~5%     │
└─────┴──────────────────┴────────┴─────────┴──────────┴─────────┘
```

### 内存使用
```bash
              total        used        free      shared  buff/cache   available
Mem:          2.0G        1.5G        200M        50M        300M       500M
```

### 日志输出
```bash
[strategy-worker] 策略执行正常
[strategy-worker] V3策略分析完成
[strategy-worker] ICT策略分析完成
```

---

## 📊 内存泄漏修复详情

### 问题分析
- 美股回测引擎在处理大量数据时可能堆积内存
- 每次循环都更新PnL导致频繁数据库操作
- trades数组未清理导致内存积累

### 修复措施

#### 1. 减少PnL更新频率
```javascript
// 修复前：每次循环都更新
for (const [posSymbol, position] of positions.entries()) {
  await this.simulationTrades.updatePnL(...);
}

// 修复后：每10根K线更新一次
if (i % 10 === 0) {
  for (const [posSymbol, position] of positions.entries()) {
    await this.simulationTrades.updatePnL(...);
  }
}
```

#### 2. 定期清理大数组
```javascript
// 定期清理trades数组，保留最近100条
if (trades.length > 100 && i % 50 === 0) {
  trades.splice(0, trades.length - 100);
}
```

#### 3. 添加内存监控
```javascript
// 监控内存使用
this.startMemoryMonitoring();

// 超过512MB时触发垃圾回收
if (heapUsed > this.maxMemoryUsage) {
  global.gc();
}
```

#### 4. 禁用Worker默认启动
```javascript
// 只有明确设置才启动
if (process.env.ENABLE_US_STOCK_WORKER === 'true') {
  // 启动Worker
}
```

---

## ✅ 执行检查清单

完成VPS操作后，检查：

- [ ] PM2进程正常运行
- [ ] main-app在线
- [ ] strategy-worker在线
- [ ] 内存使用 < 80%
- [ ] 策略日志正常
- [ ] 有新的加密货币交易产生
- [ ] 代码已更新到最新版本
- [ ] 没有内存泄漏迹象

---

## 🎉 完成标志

### 成功的标志
1. ✅ PM2显示所有服务online
2. ✅ 内存使用正常（< 80%）
3. ✅ 策略日志显示正常执行
4. ✅ 加密货币交易正常进行
5. ✅ 代码已更新

### 如果仍有问题
1. 查看PM2日志：`pm2 logs strategy-worker`
2. 检查系统日志：`dmesg | tail`
3. 重启VPS：`reboot`
4. 联系技术支持

---

**所有修复已完成并提交到GitHub，现在可以在VPS上执行更新操作！**

