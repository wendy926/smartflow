# VPS内存优化方案

## 🔍 问题分析

### 当前内存使用情况
- **总内存**: 894MB
- **已使用**: 620MB (69.4%) - 清理PM2日志进程后
- **可用内存**: 274MB
- **主要内存消费者**:
  - MySQL: 149MB (16.2%)
  - main-app: 94MB (10.3%)
  - strategy-worker: 75MB (8.2%)
  - monitor: 60MB (6.5%)

### 发现的问题
1. **PM2日志进程过多**: 8个pm2 logs进程占用约150MB内存
2. **MySQL配置未优化**: InnoDB缓冲池仅64MB，对于1GB内存服务器偏小
3. **Node.js应用内存占用较高**: 主应用和策略工作进程占用较多内存

## 🛠️ 优化方案

### 1. 立即优化 (已完成)
- ✅ **清理PM2日志进程**: 释放150MB内存
- ✅ **修复ICT策略代码错误**: 减少错误日志和内存泄漏

### 2. MySQL内存优化
```bash
# 优化MySQL配置
sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf

# 添加以下配置
[mysqld]
# InnoDB缓冲池优化 (建议为总内存的50-70%)
innodb_buffer_pool_size = 256M

# 查询缓存优化
query_cache_type = 1
query_cache_size = 32M
query_cache_limit = 2M

# 临时表优化
tmp_table_size = 32M
max_heap_table_size = 32M

# 连接优化
max_connections = 50
thread_cache_size = 4

# 其他优化
key_buffer_size = 32M
innodb_log_buffer_size = 8M
```

### 3. Node.js应用优化
```bash
# 优化PM2配置
pm2 start ecosystem.config.js --update-env

# 添加内存限制
max_memory_restart: "200M"
```

### 4. 系统级优化
```bash
# 清理系统缓存
sudo sync && echo 3 | sudo tee /proc/sys/vm/drop_caches

# 优化交换空间
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

## 📊 预期效果

### 内存使用优化
- **MySQL**: 从149MB → 120MB (优化缓冲池配置)
- **Node.js应用**: 通过内存限制和重启策略控制
- **系统缓存**: 定期清理释放内存
- **总内存使用**: 从69% → 50-60%

### 性能提升
- 减少内存压力导致的性能下降
- 提高系统稳定性
- 减少OOM (Out of Memory) 风险

## 🚀 实施步骤

1. **立即执行** (已完成)
   - 清理PM2日志进程
   - 修复代码错误

2. **MySQL优化** (待执行)
   - 备份当前配置
   - 更新MySQL配置
   - 重启MySQL服务

3. **Node.js优化** (待执行)
   - 更新PM2配置
   - 重启应用服务

4. **系统优化** (待执行)
   - 添加交换空间
   - 设置定期清理任务

## ⚠️ 注意事项

1. **MySQL配置调整**: 需要重启MySQL服务，会有短暂服务中断
2. **内存监控**: 实施后需要监控内存使用情况
3. **性能测试**: 确保优化后性能没有下降
4. **备份配置**: 修改前备份原始配置文件

## 📈 监控指标

- 内存使用率 < 70%
- MySQL响应时间 < 100ms
- 应用启动时间 < 30s
- 系统负载 < 1.0
