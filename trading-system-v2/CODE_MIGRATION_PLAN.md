# 数据库清理 - 代码迁移方案

**目标**: 清理13个冗余表，修改相关代码逻辑  
**影响范围**: macro-monitor模块、new-coin-monitor模块

---

## 📋 迁移任务清单

### 阶段1: 安全删除（无代码引用）✅

**表清单**:
1. v3_telemetry ✅
2. ict_telemetry ✅  
3. v3_win_rate_history ✅ (改用视图)
4. ict_win_rate_history ✅ (改用视图)

**SQL脚本**: `database/safe-cleanup-phase1.sql`  
**代码修改**: 无需修改  
**风险等级**: 🟢 零风险

---

### 阶段2: 迁移宏观监控模块 ⚠️

**影响文件** (7个):
1. `src/services/macro-monitor/futures-market-monitor.js`
2. `src/services/macro-monitor/fund-flow-monitor.js`
3. `src/services/macro-monitor/market-sentiment-monitor.js`
4. `src/services/macro-monitor/macro-economic-monitor.js`
5. `src/services/macro-monitor/macro-monitor-controller.js`
6. `src/api/routes/macro-monitor.js`
7. `src/web/index.html`

**修改策略**: 将所有 `macro_monitoring_*` 表操作改为 `system_monitoring`

#### 修改模式示例

**修改前**:
```javascript
// INSERT到macro_monitoring_data
const query = `
  INSERT INTO macro_monitoring_data 
  (metric_name, metric_value, metric_unit, alert_triggered, threshold_value)
  VALUES (?, ?, ?, ?, ?)
`;
```

**修改后**:
```javascript
// INSERT到system_monitoring（添加component区分）
const query = `
  INSERT INTO system_monitoring 
  (metric_name, metric_value, metric_unit, component, status, details)
  VALUES (?, ?, ?, 'macro_monitor', ?, ?)
`;
```

**SQL脚本**: `database/safe-cleanup-phase2-migrate-macro.sql`  
**风险等级**: 🟡 中风险（需测试）

---

### 阶段3: 禁用新币监控模块 ⚠️

**影响文件** (2个):
1. `src/api/routes/new-coin-monitor.js`
2. `src/services/new-coin-monitor/new-coin-monitor-controller.js`

**修改策略**: 
- 选项1: 注释路由注册（软禁用）
- 选项2: 完全删除文件和表（硬删除）

**推荐**: 选项1（软禁用），保留代码但不启用功能

#### 修改示例

**修改文件**: `src/main.js`

```javascript
// 修改前
this.app.use('/api/v1/new-coin-monitor', require('./api/routes/new-coin-monitor'));

// 修改后（注释掉）
// this.app.use('/api/v1/new-coin-monitor', require('./api/routes/new-coin-monitor'));
```

**风险等级**: 🟢 低风险（功能未使用）

---

## 🔧 详细代码修改

### 修改1: futures-market-monitor.js

**文件**: `src/services/macro-monitor/futures-market-monitor.js`

**查找所有出现**:
```bash
grep -n "macro_monitoring_data\|macro_monitoring_alerts" \
  src/services/macro-monitor/futures-market-monitor.js
```

**替换模式**:

```javascript
// ============== 修改前 ==============
const insertQuery = `
  INSERT INTO macro_monitoring_data 
  (metric_name, metric_value, metric_unit, alert_triggered, threshold_value, alert_message)
  VALUES (?, ?, ?, ?, ?, ?)
`;

// ============== 修改后 ==============
const insertQuery = `
  INSERT INTO system_monitoring 
  (metric_name, metric_value, metric_unit, component, status, details)
  VALUES (?, ?, ?, 'macro_monitor', ?, ?)
`;

// 参数构建
const status = alertTriggered ? 'WARNING' : 'NORMAL';
const details = JSON.stringify({
  alert_triggered: alertTriggered,
  threshold_value: thresholdValue,
  alert_message: alertMessage
});

// ============== 查询修改 ==============
// 修改前
const selectQuery = `
  SELECT metric_value FROM macro_monitoring_data 
  WHERE metric_name = ? 
  ORDER BY created_at DESC LIMIT 1
`;

// 修改后
const selectQuery = `
  SELECT metric_value FROM system_monitoring 
  WHERE metric_name = ? 
    AND component = 'macro_monitor'
  ORDER BY created_at DESC LIMIT 1
`;
```

**重复次数**: 约4-6处

---

### 修改2: macro-monitor-controller.js

**文件**: `src/services/macro-monitor/macro-monitor-controller.js`

```javascript
// ============== 修改配置读取 ==============
// 修改前
const query = 'SELECT config_key, config_value FROM macro_monitoring_config WHERE is_active = 1';

// 修改后
const query = `
  SELECT config_key, config_value 
  FROM system_config 
  WHERE config_key LIKE 'macro_%' 
    AND is_active = 1
`;
```

---

### 修改3: macro-monitor.js (API路由)

**文件**: `src/api/routes/macro-monitor.js`

```javascript
// ============== 修改告警查询 ==============
// 修改前
let query = 'SELECT * FROM macro_monitoring_alerts WHERE 1=1';

// 修改后
let query = 'SELECT * FROM macro_alert_history WHERE 1=1';
```

---

### 修改4: 前端页面

**文件**: `src/web/index.html`

检查是否有直接的表名引用，通常前端通过API，无需修改。

---

## 🧪 测试验证

### 1. 数据库迁移测试

```sql
-- 验证数据迁移正确
SELECT 
    'system_monitoring' as table_name,
    component,
    COUNT(*) as row_count
FROM system_monitoring
WHERE component = 'macro_monitor'
GROUP BY component;

-- 对比原表数据量
SELECT 
    'macro_monitoring_data' as table_name,
    COUNT(*) as row_count
FROM macro_monitoring_data;
```

### 2. 功能测试

```bash
# 重启服务
pm2 restart ecosystem.config.js

# 测试宏观监控API
curl http://localhost:8080/api/v1/macro-monitor/overview

# 检查日志无错误
pm2 logs main-app --lines 100 | grep -i "error\|macro"
```

### 3. 数据一致性测试

```sql
-- 检查新数据是否正确写入system_monitoring
SELECT * FROM system_monitoring 
WHERE component = 'macro_monitor' 
  AND created_at >= NOW() - INTERVAL 1 HOUR
ORDER BY created_at DESC
LIMIT 10;
```

---

## 📦 完整执行步骤

### Step 1: 备份数据库

```bash
cd /home/admin/trading-system-v2/trading-system-v2

# 完整备份
mysqldump -u root -p trading_system > backup_before_cleanup_$(date +%Y%m%d_%H%M%S).sql

# 验证备份
ls -lh backup_*.sql
```

### Step 2: 执行阶段1清理（零风险）

```bash
# 执行SQL脚本
mysql -u root -p trading_system < database/safe-cleanup-phase1.sql

# 验证删除成功
mysql -u root -p trading_system -e "SHOW TABLES LIKE '%telemetry%';"
mysql -u root -p trading_system -e "SHOW TABLES LIKE '%win_rate_history%';"
```

**预期结果**: 
- v3_telemetry ❌ 不存在
- ict_telemetry ❌ 不存在
- v3_win_rate_history ❌ 不存在
- ict_win_rate_history ❌ 不存在
- strategy_win_rate_history ✅ 视图存在

### Step 3: 执行阶段2迁移（需代码配合）

```bash
# 3.1 执行数据迁移SQL
mysql -u root -p trading_system < database/safe-cleanup-phase2-migrate-macro.sql

# 3.2 验证迁移成功
mysql -u root -p trading_system -e "
  SELECT component, COUNT(*) as count 
  FROM system_monitoring 
  WHERE component='macro_monitor' 
  GROUP BY component;
"
```

### Step 4: 修改代码

使用搜索替换工具批量修改：

```bash
# 方法1: 使用sed（小心）
cd src/services/macro-monitor

# 备份原文件
cp futures-market-monitor.js futures-market-monitor.js.backup

# 替换表名（示例，需要根据实际情况调整）
sed -i 's/macro_monitoring_data/system_monitoring/g' futures-market-monitor.js
sed -i 's/macro_monitoring_config/system_config/g' futures-market-monitor.js
sed -i 's/macro_monitoring_alerts/macro_alert_history/g' futures-market-monitor.js

# 方法2: 手动修改（更安全）
# 使用编辑器逐个文件检查修改
```

### Step 5: 测试验证

```bash
# 5.1 运行单元测试
npm test

# 5.2 启动服务
pm2 restart ecosystem.config.js

# 5.3 查看日志
pm2 logs main-app --lines 50

# 5.4 测试API
curl http://localhost:8080/api/v1/macro-monitor/overview | jq
```

### Step 6: 确认后删除旧表

```bash
# 如果一切正常，删除旧表
mysql -u root -p trading_system << EOF
DROP TABLE IF EXISTS macro_monitoring_alerts;
DROP TABLE IF EXISTS macro_monitoring_config;  
DROP TABLE IF EXISTS macro_monitoring_data;
SELECT '✅ 宏观监控旧表已删除' as status;
EOF
```

---

## ⚠️ 风险控制

### 回滚方案

如果出现问题，立即回滚：

```bash
# 1. 停止服务
pm2 stop all

# 2. 恢复数据库
mysql -u root -p trading_system < backup_before_cleanup_20251010_HHMMSS.sql

# 3. 恢复代码
cd src/services/macro-monitor
cp futures-market-monitor.js.backup futures-market-monitor.js
# ... 恢复其他文件

# 4. 重启服务
pm2 restart all
```

### 验证检查点

每个步骤后检查：

- ✅ 服务正常启动
- ✅ API响应正常
- ✅ 无错误日志
- ✅ 数据正确写入
- ✅ 前端显示正常

---

## 📊 预期收益

### 立即收益（阶段1）

- 删除4个表
- 节省15-20%存储
- 无需代码修改
- 执行时间: 5分钟

### 完整收益（阶段1+2）

- 删除7个表（或13个如果禁用新币监控）
- 节省30-40%存储
- 简化数据结构
- 执行时间: 2-3小时

---

**建议**: 先执行阶段1（安全），验证无问题后再执行阶段2（需代码修改）

