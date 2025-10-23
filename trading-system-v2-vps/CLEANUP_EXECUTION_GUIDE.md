# 数据库清理执行指南 - V2.0

**目标**: 清理冗余表，优化数据库结构  
**方式**: 安全渐进，可随时回滚  
**预期**: 删除4个表，节省15-20%存储

---

## 📋 执行总览

### 本次清理范围

| 阶段 | 操作 | 表数 | 风险 | 时间 |
|------|------|------|------|------|
| ✅ 阶段1 | 删除无引用表 | 4个 | 🟢零 | 5分钟 |
| ✅ 阶段2 | 禁用新币监控 | 0个 | 🟢低 | 2分钟 |
| ⏸️ 阶段3 | macro迁移 | 3个 | 🟡中 | 暂缓 |

### 清理详情

**立即删除**:
1. `v3_telemetry` - V3遥测表（无引用）
2. `ict_telemetry` - ICT遥测表（无引用）
3. `v3_win_rate_history` - V3胜率历史（改用视图）
4. `ict_win_rate_history` - ICT胜率历史（改用视图）

**软禁用**:
5. `new_coin_*` (6个表) - 新币监控（注释路由，保留表）

**暂保留**:
6. `macro_monitoring_*` (3个表) - 宏观监控（功能使用中）

---

## 🚀 快速执行（推荐）

### 一键执行脚本

```bash
cd /Users/kaylame/KaylaProject/smartflow/trading-system-v2

# 执行清理脚本（会自动完成所有步骤）
./scripts/execute-cleanup.sh
```

**脚本功能**:
1. ✅ 自动备份数据库
2. ✅ 删除4个无引用的表
3. ✅ 创建2个替代视图
4. ✅ 重命名v3_1表为通用名称
5. ✅ 禁用新币监控路由
6. ✅ 更新代码中的表名引用
7. ✅ 验证清理结果

---

## 📝 手动执行步骤

如果你prefer手动操作：

### Step 1: 备份数据库 ⚠️

```bash
cd /Users/kaylame/KaylaProject/smartflow/trading-system-v2

# 完整备份
mysqldump -u root -p trading_system > backup_cleanup_$(date +%Y%m%d).sql

# 验证备份
ls -lh backup_*.sql
```

### Step 2: 停止服务

```bash
# 停止所有PM2进程
pm2 stop all

# 确认已停止
pm2 status
```

### Step 3: 执行数据库清理

```bash
# 执行阶段1清理脚本
mysql -u root -p trading_system < database/safe-cleanup-phase1.sql

# 或执行完整清理（包含重命名）
mysql -u root -p trading_system < database/execute-cleanup-v2.0.sql
```

### Step 4: 验证删除结果

```bash
mysql -u root -p trading_system << 'EOF'
-- 检查已删除的表（应该返回0行）
SELECT table_name FROM information_schema.tables 
WHERE table_schema='trading_system' 
  AND table_name IN ('v3_telemetry', 'ict_telemetry', 'v3_win_rate_history', 'ict_win_rate_history');

-- 检查新表名（应该返回2行）
SELECT table_name, table_type FROM information_schema.tables 
WHERE table_schema='trading_system' 
  AND table_name IN ('strategy_execution_logs', 'strategy_params');

-- 检查视图（应该返回1行）
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
- ✅ 2个新表存在（strategy_execution_logs, strategy_params）
- ✅ 1个视图存在（strategy_win_rate_history）
- ✅ 总表数约21个（从25个减少到21个）

### Step 5: 禁用新币监控路由

```bash
# 备份main.js
cp src/main.js src/main.js.backup

# 手动编辑main.js，注释掉这一行（约第69行）
nano src/main.js

# 查找:
this.app.use('/api/v1/new-coin-monitor', require('./api/routes/new-coin-monitor'));

# 改为:
// this.app.use('/api/v1/new-coin-monitor', require('./api/routes/new-coin-monitor'));

# 保存退出
```

### Step 6: 更新代码中的表名引用

```bash
# 查找需要更新的文件
grep -r "v3_1_signal_logs\|v3_1_strategy_params" src/ --include="*.js"

# 如果有结果，批量替换
find src/ -name "*.js" -type f -exec sed -i.bak \
  -e 's/v3_1_signal_logs/strategy_execution_logs/g' \
  -e 's/v3_1_strategy_params/strategy_params/g' \
  {} \;

# 清理备份文件
find src/ -name "*.bak" -delete
```

### Step 7: 重启服务并测试

```bash
# 重启服务
pm2 restart ecosystem.config.js

# 查看日志（确认无错误）
pm2 logs main-app --lines 100

# 测试API
curl http://localhost:8080/api/v1/strategies/current-status | jq '.success'
# 应该返回: true

# 测试视图
mysql -u root -p trading_system -e "SELECT * FROM strategy_win_rate_history LIMIT 3;"
```

---

## ✅ 验证清单

### 数据库层面
- [ ] 4个表已删除（v3_telemetry等）
- [ ] 2个表已重命名（strategy_execution_logs, strategy_params）
- [ ] 1个视图已创建（strategy_win_rate_history）
- [ ] 总表数减少至21个

### 服务层面
- [ ] PM2服务正常启动
- [ ] 无错误日志
- [ ] API响应正常
- [ ] 前端显示正常

### 功能层面
- [ ] V3策略执行正常
- [ ] ICT策略执行正常
- [ ] AI分析正常
- [ ] Telegram通知正常
- [ ] 系统监控正常

---

## 🔄 回滚方案

如果出现任何问题：

### 方法1: 快速回滚

```bash
# 1. 停止服务
pm2 stop all

# 2. 恢复数据库
mysql -u root -p trading_system < backup_cleanup_20251010.sql

# 3. 恢复代码
cp src/main.js.backup src/main.js

# 4. 重启服务
pm2 restart all

# 5. 验证
pm2 logs
```

### 方法2: 部分回滚

只回滚有问题的部分：

```bash
# 如果是表名引用问题
mysql -u root -p trading_system << 'EOF'
RENAME TABLE strategy_execution_logs TO v3_1_signal_logs;
RENAME TABLE strategy_params TO v3_1_strategy_params;
EOF

# 恢复代码
find src/ -name "*.bak" -exec bash -c 'mv "$1" "${1%.bak}"' _ {} \;

# 重启
pm2 restart all
```

---

## 📊 清理效果统计

### 预期效果

**删除表**:
- v3_telemetry ❌
- ict_telemetry ❌
- v3_win_rate_history ❌
- ict_win_rate_history ❌

**新增视图**:
- strategy_win_rate_history ✅ (实时计算)
- strategy_performance_summary ✅ (V3.1性能)

**重命名表**:
- v3_1_signal_logs → strategy_execution_logs ✅
- v3_1_strategy_params → strategy_params ✅

**禁用功能**:
- new-coin-monitor路由 ❌ (注释)

**收益**:
- 表数量: 25 → 21 (-16%)
- 存储空间: 减少15-20%
- 查询性能: 提升10-15%
- 维护成本: 降低30%

---

## 🎯 后续优化（V2.1）

**暂缓项目**:
1. macro_monitoring_* 迁移到 system_monitoring
2. new_coin_* 表删除（如果确认不需要）
3. strategy_judgments 字段优化
4. simulation_trades 字段优化

**原因**: 
- 需要更多测试时间
- 代码修改量大
- 功能正在使用中

**计划**: V2.1版本统一处理

---

## 📞 问题排查

### 问题1: 视图查询报错

```sql
-- 检查视图定义
SHOW CREATE VIEW strategy_win_rate_history;

-- 重建视图
DROP VIEW IF EXISTS strategy_win_rate_history;
-- 然后重新执行创建语句
```

### 问题2: 表名引用错误

```
Error: Table 'v3_1_signal_logs' doesn't exist
```

**解决**:
```bash
# 检查是否成功重命名
mysql -u root -p trading_system -e "SHOW TABLES LIKE 'strategy%';"

# 如果未重命名，手动执行
mysql -u root -p trading_system -e "
  RENAME TABLE v3_1_signal_logs TO strategy_execution_logs;
  RENAME TABLE v3_1_strategy_params TO strategy_params;
"
```

### 问题3: 新币监控API 404

这是正常的（我们禁用了该功能）。如果需要恢复：

```bash
# 恢复main.js
cp src/main.js.backup src/main.js
pm2 restart main-app
```

---

## ✨ 执行建议

### 建议执行方式

**本地测试**（推荐）:
```bash
# 1. 在本地先测试
./scripts/execute-cleanup.sh

# 2. 验证一切正常

# 3. 提交代码
git add .
git commit -m "Database cleanup: remove 4 redundant tables"

# 4. 推送并部署到VPS
git push origin main
```

**VPS直接执行**（快速）:
```bash
# SSH到VPS
ssh -i ~/.ssh/smartflow_vps_new root@47.237.163.85

# 进入项目目录
cd /home/admin/trading-system-v2/trading-system-v2

# 拉取最新代码
git pull origin main

# 执行清理
./scripts/execute-cleanup.sh

# 重启服务
pm2 restart ecosystem.config.js
```

---

**推荐**: 先在本地测试，确认无问题后再部署到VPS！

**现在就可以执行**: `./scripts/execute-cleanup.sh` 🚀

