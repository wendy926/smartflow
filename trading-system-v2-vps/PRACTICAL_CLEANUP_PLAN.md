# 数据库清理 - 实用执行方案

**优先级**: 先做安全、高收益的清理  
**原则**: 不影响现有功能，渐进式优化

---

## 🎯 三阶段清理方案

### ✅ 阶段1: 立即执行（零风险，高收益）

**删除对象**: 4个无代码引用的表

```
v3_telemetry ❌            - 代码无引用
ict_telemetry ❌           - 代码无引用  
v3_win_rate_history ❌     - 代码无引用，改用视图
ict_win_rate_history ❌    - 代码无引用，改用视图
```

**执行步骤**:
```bash
# 1. 备份
mysqldump -u root -p trading_system > backup_$(date +%Y%m%d).sql

# 2. 执行清理
mysql -u root -p trading_system < database/safe-cleanup-phase1.sql

# 3. 验证
mysql -u root -p trading_system -e "
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema='trading_system' 
    AND table_name IN ('v3_telemetry', 'ict_telemetry', 'v3_win_rate_history', 'ict_win_rate_history');
"
# 应该返回0行
```

**预期收益**:
- ✅ 删除4个表
- ✅ 节省15-20%存储
- ✅ 无需修改代码
- ✅ 执行时间: 5分钟

---

### ⚠️ 阶段2: 禁用新币监控（低风险，中收益）

**目标**: 软禁用new-coin-monitor功能（保留代码和表）

**修改文件**: `src/main.js`

```javascript
// 找到这一行（约第69行）
this.app.use('/api/v1/new-coin-monitor', require('./api/routes/new-coin-monitor'));

// 注释掉
// this.app.use('/api/v1/new-coin-monitor', require('./api/routes/new-coin-monitor'));
```

**执行步骤**:
```bash
# 修改main.js
nano src/main.js  
# 或使用你喜欢的编辑器

# 重启服务
pm2 restart main-app

# 验证new-coin-monitor API不可访问
curl http://localhost:8080/api/v1/new-coin-monitor/status
# 应该返回404
```

**未来**: 如果确认不需要，可以删除new_coin_*表和相关代码

**预期收益**:
- ✅ 释放API路由
- ✅ 减少内存占用
- ✅ 可随时恢复
- ✅ 执行时间: 2分钟

---

### 🟡 阶段3: 宏观监控迁移（中风险，需测试）

**目标**: 将macro_monitoring_*迁移到system_monitoring

**决策**: 暂缓执行，理由如下：

1. **复杂度高**: 涉及7个文件的修改
2. **测试成本**: 需要完整回归测试
3. **功能重要**: 宏观监控是核心功能
4. **收益有限**: 只减少3个表

**建议**: 
- 现阶段保留macro_monitoring_*表
- 等v2.0稳定后再考虑迁移
- 或等v2.1/v2.2版本再处理

---

## 📋 本次清理执行清单

### 立即执行（推荐）

- [x] 创建所有SQL脚本
- [ ] 执行阶段1: 删除4个无引用的表
- [ ] 执行阶段2: 禁用新币监控路由
- [ ] 测试验证

### 暂缓执行

- [ ] 阶段3: 迁移宏观监控（等v2.0稳定后）

---

## 🚀 快速执行命令

### 完整执行脚本

```bash
#!/bin/bash
# 一键清理脚本

cd /Users/kaylame/KaylaProject/smartflow/trading-system-v2

# 1. 备份数据库
echo "备份数据库..."
mysqldump -u root -p trading_system > backup_cleanup_$(date +%Y%m%d_%H%M%S).sql

# 2. 执行阶段1清理
echo "执行阶段1清理..."
mysql -u root -p trading_system < database/safe-cleanup-phase1.sql

# 3. 禁用新币监控
echo "禁用新币监控路由..."
sed -i.bak "s|this.app.use('/api/v1/new-coin-monitor'|// this.app.use('/api/v1/new-coin-monitor'|" src/main.js

# 4. 验证
echo "验证清理结果..."
mysql -u root -p trading_system << 'EOF'
SELECT '剩余表数:' as info, COUNT(*) as count 
FROM information_schema.tables 
WHERE table_schema='trading_system' AND table_type='BASE TABLE';

SELECT '已删除表检查:' as info;
SELECT CASE 
  WHEN COUNT(*) = 0 THEN '✅ 删除成功'
  ELSE '❌ 删除失败'
END as result
FROM information_schema.tables 
WHERE table_schema='trading_system' 
  AND table_name IN ('v3_telemetry', 'ict_telemetry', 'v3_win_rate_history', 'ict_win_rate_history');

SELECT '视图检查:' as info;
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema='trading_system' 
  AND table_name = 'strategy_win_rate_history';
EOF

echo "清理完成！"
echo "请重启服务: pm2 restart ecosystem.config.js"
```

**保存为**: `scripts/execute-cleanup.sh`

---

## 📊 预期结果

### 清理前
```
总表数: 25个
├── 核心表: 11个
├── 冗余表: 4个 ← 将删除
├── 未使用: 9个 ← new_coin禁用
└── 重复: 1个 ← 暂保留
```

### 清理后
```
总表数: 21个（-4个）
├── 核心表: 11个
├── 视图: 2个（新增）
├── macro_monitoring: 3个（暂保留）
└── new_coin: 6个（禁用但保留）
```

**实际收益**:
- ✅ 删除4个表（16%）
- ✅ 节省15-20%存储
- ✅ 新增2个视图（实时计算）
- ✅ 代码修改最小化

---

## ⚠️ 重要决策

### 为什么暂不迁移macro_monitoring？

1. **复杂度高**: 需要修改7个文件，约30-40处代码
2. **测试成本**: 需要完整的回归测试
3. **风险较大**: 宏观监控是生产功能
4. **收益有限**: 只减少3个表（12%）

### 替代方案

**当前**: 保留macro_monitoring_*表，正常运行  
**V2.1**: 逐步迁移到统一的monitoring接口  
**V2.2**: 完成所有遗留表的清理

---

## ✅ 执行检查清单

### 执行前
- [ ] 已阅读完整方案
- [ ] 已备份数据库
- [ ] 已停止PM2服务
- [ ] 已在测试环境验证

### 执行中
- [ ] 执行safe-cleanup-phase1.sql
- [ ] 验证表已删除
- [ ] 验证视图创建成功
- [ ] 禁用new-coin-monitor路由

### 执行后
- [ ] 重启服务成功
- [ ] 无错误日志
- [ ] API响应正常
- [ ] 前端显示正常
- [ ] 视图数据正确

---

**建议**: 本次只执行阶段1和阶段2，宏观监控迁移留待v2.1版本处理。

**收益**: 在最小风险下获得约20%的优化收益。

