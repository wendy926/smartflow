# 部署 V2.0.0 到 VPS - 完整指南

**版本**: v2.0.0  
**状态**: ✅ 代码已推送到GitHub  
**下一步**: VPS部署和数据库清理

---

## ✅ 本地已完成

- ✅ 34个文件已提交
- ✅ v2.0.0标签已创建
- ✅ 代码已推送到GitHub
- ✅ 新币监控路由已禁用
- ✅ 9539行代码新增

**GitHub链接**:
- Commit: https://github.com/wendy926/smartflow/commit/9a3a9bf
- Tag: https://github.com/wendy926/smartflow/releases/tag/v2.0.0

---

## 🚀 VPS部署步骤

### Step 1: SSH到VPS

```bash
ssh -i ~/.ssh/smartflow_vps_new root@47.237.163.85
```

**VPS信息**:
- IP: 47.237.163.85
- 用户: root
- 项目路径: /home/admin/trading-system-v2/trading-system-v2

---

### Step 2: 拉取v2.0.0代码

```bash
# 进入项目目录
cd /home/admin/trading-system-v2/trading-system-v2

# 查看当前版本
git describe --tags

# 拉取最新标签
git fetch --tags

# 查看所有标签
git tag -l

# 切换到v2.0.0
git checkout v2.0.0

# 验证版本
cat package.json | grep version
# 应该显示: "version": "2.0.0"
```

---

### Step 3: 执行数据库清理和部署

#### 方法1: 一键执行（推荐）

```bash
# 赋予执行权限
chmod +x vps-cleanup-and-deploy-v2.0.sh

# 执行清理和部署
./vps-cleanup-and-deploy-v2.0.sh
```

**脚本会自动完成**:
1. ✅ 停止PM2服务
2. ✅ 备份数据库
3. ✅ 删除4个冗余表
4. ✅ 创建视图
5. ✅ 重命名v3_1表
6. ✅ 更新代码引用
7. ✅ 重启服务
8. ✅ 显示验证结果

---

#### 方法2: 手动执行（分步）

**2.1 停止服务**
```bash
pm2 stop all
pm2 status
```

**2.2 备份数据库**
```bash
mysqldump -u root -p trading_system > backup_v2.0_$(date +%Y%m%d_%H%M%S).sql

# 验证备份
ls -lh backup_v2.0_*.sql
```

**2.3 执行数据库清理**
```bash
mysql -u root -p trading_system < database/execute-cleanup-v2.0.sql
```

**2.4 验证清理结果**
```bash
mysql -u root -p trading_system << 'EOF'
-- 检查已删除的表（应返回0行）
SELECT table_name FROM information_schema.tables 
WHERE table_schema='trading_system' 
  AND table_name IN ('v3_telemetry', 'ict_telemetry', 'v3_win_rate_history', 'ict_win_rate_history');

-- 检查重命名的表（应返回2行）
SELECT table_name FROM information_schema.tables 
WHERE table_schema='trading_system' 
  AND table_name IN ('strategy_execution_logs', 'strategy_params');

-- 检查视图（应返回1行）
SELECT table_name, table_type FROM information_schema.tables 
WHERE table_schema='trading_system' 
  AND table_name = 'strategy_win_rate_history';

-- 统计表数
SELECT COUNT(*) as total_tables FROM information_schema.tables 
WHERE table_schema='trading_system' AND table_type='BASE TABLE';
EOF
```

**预期结果**:
- ✅ 4个表不存在
- ✅ 2个新表存在
- ✅ 1个视图存在
- ✅ 总表数约21个

**2.5 重启服务**
```bash
pm2 restart ecosystem.config.js

# 等待启动
sleep 5

# 查看状态
pm2 status

# 查看日志
pm2 logs main-app --lines 50
```

---

### Step 4: 功能验证

#### 4.1 验证API响应

```bash
# 健康检查
curl http://localhost:8080/health | jq

# 策略状态
curl http://localhost:8080/api/v1/strategies/current-status | jq '.success'

# AI分析
curl http://localhost:8080/api/v1/ai/macro-risk?symbols=BTC,ETH | jq

# 系统监控
curl http://localhost:8080/api/v1/monitoring/system | jq
```

**预期**: 所有API返回 `"success": true`

#### 4.2 验证数据库视图

```bash
mysql -u root -p trading_system << 'EOF'
-- 测试胜率视图
SELECT * FROM strategy_win_rate_history LIMIT 5;

-- 测试性能汇总视图
SELECT * FROM strategy_performance_summary LIMIT 5;
EOF
```

**预期**: 视图返回数据，无错误

#### 4.3 验证新币监控已禁用

```bash
# 应该返回404
curl http://localhost:8080/api/v1/new-coin-monitor/status
```

**预期**: 404 Not Found（功能已禁用）

#### 4.4 检查日志无错误

```bash
# 查看最近100行日志
pm2 logs main-app --lines 100 --nostream | grep -i "error\|v3.1\|cleanup"

# 查看实时日志
pm2 logs main-app
```

**预期**: 无critical错误，V3.1模块正常加载

---

### Step 5: 性能监控

#### 5.1 系统资源

```bash
# 实时监控
pm2 monit

# 或查看指标
pm2 status
```

**关注指标**:
- CPU使用率: 应<60%
- 内存使用率: 应<85%
- 服务状态: 全部online

#### 5.2 数据库大小

```bash
mysql -u root -p trading_system << 'EOF'
SELECT 
  table_name,
  table_rows,
  ROUND((data_length + index_length)/1024/1024, 2) as size_mb
FROM information_schema.tables
WHERE table_schema='trading_system' 
  AND table_type='BASE TABLE'
ORDER BY (data_length + index_length) DESC
LIMIT 10;
EOF
```

**预期**: 总大小比清理前减少15-20%

---

## 📊 验证检查清单

### 数据库层面

- [ ] 备份文件已创建（backup_v2.0_*.sql）
- [ ] v3_telemetry表已删除
- [ ] ict_telemetry表已删除
- [ ] v3_win_rate_history表已删除
- [ ] ict_win_rate_history表已删除
- [ ] strategy_execution_logs表已创建（重命名自v3_1_signal_logs）
- [ ] strategy_params表已创建（重命名自v3_1_strategy_params）
- [ ] strategy_win_rate_history视图已创建
- [ ] 总表数约21个

### 服务层面

- [ ] PM2所有服务online
- [ ] 无critical错误日志
- [ ] CPU使用率<60%
- [ ] 内存使用率<85%

### 功能层面

- [ ] 健康检查API正常
- [ ] 策略状态API正常
- [ ] AI分析API正常
- [ ] 系统监控API正常
- [ ] 新币监控API返回404（已禁用）
- [ ] 前端页面正常显示

### 数据层面

- [ ] strategy_win_rate_history视图有数据
- [ ] strategy_execution_logs表可查询
- [ ] strategy_params表有21个参数
- [ ] simulation_trades表有V3.1字段

---

## ⚠️ 回滚方案

如果出现任何问题，立即执行：

```bash
# 1. 停止服务
pm2 stop all

# 2. 恢复数据库
mysql -u root -p trading_system < backup_v2.0_20251010_XXXXXX.sql

# 3. 切换回v1.0.0
git checkout v1.0.0

# 4. 重启服务
pm2 restart all

# 5. 验证
pm2 logs
curl http://localhost:8080/health
```

---

## 📞 问题排查

### 问题1: 表重命名失败

```
ERROR 1050: Table 'strategy_execution_logs' already exists
```

**解决**:
```bash
# 检查表是否已重命名
mysql -u root -p trading_system -e "SHOW TABLES LIKE 'strategy%';"

# 如果已重命名，跳过此步骤
```

### 问题2: 视图查询报错

```
ERROR 1146: Table 'strategy_win_rate_history' doesn't exist
```

**解决**:
```bash
# 重新创建视图
mysql -u root -p trading_system < database/execute-cleanup-v2.0.sql
```

### 问题3: 服务启动失败

```bash
# 查看详细错误
pm2 logs main-app --err --lines 100

# 检查代码语法
node -c src/main.js

# 恢复main.js（如果需要）
git checkout src/main.js
pm2 restart main-app
```

---

## 🎊 部署成功标志

当你看到以下情况，说明部署成功：

✅ **数据库**:
```bash
mysql> SHOW TABLES;
# 21个表（不包含v3_telemetry等4个）
# strategy_execution_logs ✓
# strategy_params ✓
```

✅ **服务**:
```bash
pm2 status
# 所有服务 status: online ✓
```

✅ **API**:
```bash
curl http://localhost:8080/health | jq '.status'
# "healthy" ✓
```

✅ **日志**:
```bash
pm2 logs main-app --lines 10
# 无ERROR，V3.1模块加载成功 ✓
```

---

## 📈 后续监控（24-48小时）

部署后请持续监控以下指标：

### 关键指标

1. **早期趋势检测率**: 目标20-30%
```sql
SELECT 
  SUM(early_trend_detected) / COUNT(*) * 100 as detection_rate
FROM strategy_execution_logs
WHERE signal_time >= NOW() - INTERVAL 24 HOUR;
```

2. **假突破过滤拒绝率**: 目标30-40%
```sql
SELECT 
  fake_breakout_filter_result,
  COUNT(*) as count,
  COUNT(*) * 100.0 / (SELECT COUNT(*) FROM strategy_execution_logs WHERE signal_time >= NOW() - INTERVAL 24 HOUR) as percentage
FROM strategy_execution_logs
WHERE signal_time >= NOW() - INTERVAL 24 HOUR
GROUP BY fake_breakout_filter_result;
```

3. **置信度分布**: 目标 high:med:low = 20:50:30
```sql
SELECT 
  confidence,
  COUNT(*) as count
FROM strategy_execution_logs
WHERE signal_time >= NOW() - INTERVAL 24 HOUR
GROUP BY confidence;
```

4. **胜率变化**: 对比v1.0.0
```sql
SELECT * FROM strategy_win_rate_history
WHERE trade_date >= CURDATE() - INTERVAL 7 DAY
ORDER BY trade_date DESC;
```

### 性能指标

```bash
# 系统资源
pm2 monit

# 数据库大小
du -sh /var/lib/mysql/trading_system/

# 日志大小
du -sh logs/
```

---

## 🎯 成功部署！

如果所有验证都通过，恭喜你成功部署了 SmartFlow v2.0.0！

**接下来**:
1. ✅ 持续监控24-48小时
2. ✅ 观察早期趋势和过滤器效果
3. ✅ 根据实际表现调整参数
4. ✅ 收集反馈准备v2.1

**祝交易顺利！** 🚀📈

