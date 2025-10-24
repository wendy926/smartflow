# 大额挂单模块重构分析（swan.md对齐）

**分析时间**: 2025-10-12 23:05  
**对比对象**: 当前实现 vs swan.md黑天鹅检测要求  

---

## 📋 swan.md核心要求

### A. 原始度量
```
✅ order_value = p × q
✅ topN_depth_value
✅ impactRatio = order_value / topN_depth_value
🆕 volume24hValue（24h成交额）
🆕 order_value / volume24hValue >= 0.03
🆕 order_value / oi >= 0.05
```

### B. 推荐阈值
1. **绝对阈值**: order_value >= 100M ✅ (已实现)
2. **相对阈值**（至少一项）:
   - impactRatio >= 0.20 ✅ (已实现，当前0.25)
   - order_value / volume24h >= 0.03 🆕 (需新增)
   - order_value / oi >= 0.05 🆕 (需新增)
3. **快速消费判定**:
   - 被吃掉>30% + 价格波动>=3% in 5分钟 🆕 (需新增)
   - OR OI突降>5% 🆕 (需新增)

### C. 黑天鹅分级
```
CRITICAL: 100M + impactRatio>=0.20 + 被吃30%+ + 价格跌>=3%
HIGH: 满足部分CRITICAL条件
WATCH: 单项触发
```

---

## 🔍 当前实现分析

### 已实现功能 ✅
```
✅ 大额挂单检测（>100M）
✅ impactRatio计算
✅ 持续性判断（persistSnapshots）
✅ Spoofing检测（<3秒）
✅ 被消费判断（wasConsumed）
✅ WebSocket深度流
✅ CVD/OI追踪
```

### 缺失功能 🆕
```
❌ volume24h相对阈值（order/vol24h >= 3%）
❌ OI相对阈值（order/oi >= 5%）
❌ 快速消费+价格波动判定（5分钟窗口）
❌ OI突降检测（>5%）
❌ 黑天鹅分级（CRITICAL/HIGH/WATCH）
❌ 告警级别输出
```

---

## 🗄️ 数据库设计（复用现有表）

### 当前表结构
**表名**: `large_order_detection_results`

**现有字段**:
```sql
id, symbol, timestamp,
final_action, buy_score, sell_score,
cvd_cum, open_interest, oi_change_pct,
spoof_count, tracked_entries_count,
detection_data (JSON)
```

### 需要扩展的字段
```sql
ALTER TABLE large_order_detection_results
ADD COLUMN swan_alert_level VARCHAR(20) DEFAULT NULL 
  COMMENT '黑天鹅告警级别 (CRITICAL/HIGH/WATCH/NONE)',
ADD COLUMN price_drop_pct DECIMAL(10,4) DEFAULT NULL 
  COMMENT '5分钟价格跌幅(%)',
ADD COLUMN volume_24h DECIMAL(20,8) DEFAULT NULL 
  COMMENT '24小时成交额',
ADD COLUMN max_order_to_vol24h_ratio DECIMAL(10,6) DEFAULT NULL 
  COMMENT '最大挂单/24h成交额比率',
ADD COLUMN max_order_to_oi_ratio DECIMAL(10,6) DEFAULT NULL 
  COMMENT '最大挂单/持仓量比率',
ADD COLUMN sweep_detected BOOLEAN DEFAULT FALSE 
  COMMENT '是否检测到快速消费',
ADD COLUMN sweep_pct DECIMAL(10,4) DEFAULT NULL 
  COMMENT '被消费百分比',
ADD COLUMN alert_triggers JSON DEFAULT NULL 
  COMMENT '触发的告警条件';
```

**估计影响**:
- 存储开销: +8个字段，约100bytes/记录
- 查询性能: 索引swan_alert_level即可
- 写入性能: 影响<5%

---

## 🏗️ 代码设计

### 新增模块
**文件**: `src/services/large-order/swan-detector.js`

**职责**:
- 计算相对阈值（vol24h, oi）
- 检测快速消费+价格波动
- OI突降检测
- 黑天鹅分级（CRITICAL/HIGH/WATCH）

**类设计**:
```javascript
class SwanDetector {
  constructor(config)
  
  // 计算24h成交额相对阈值
  checkVolume24hRatio(orderValue, symbol)
  
  // 计算OI相对阈值
  checkOIRatio(orderValue, oi)
  
  // 检测快速消费（5分钟窗口）
  detectRapidSweep(order, priceHistory, consumedPct)
  
  // 检测OI突降
  detectOICollapse(currentOI, prevOI)
  
  // 黑天鹅分级
  classifySwanLevel(metrics)
}
```

### 修改模块
**文件**: `src/services/large-order/detector.js`

**改动**:
- 添加SwanDetector实例
- 获取24h成交额数据
- 维护5分钟价格历史
- 调用SwanDetector分级
- 保存扩展字段

---

## 📊 改进对比

| 指标 | 当前实现 | swan.md要求 | 新增 |
|------|---------|------------|------|
| **绝对阈值** | 100M ✅ | 100M | 一致 |
| **impactRatio** | >=0.25 ✅ | >=0.20 | 降低阈值 |
| **vol24h比率** | ❌ 无 | >=0.03 | 🆕 新增 |
| **OI比率** | ❌ 无 | >=0.05 | 🆕 新增 |
| **快速消费** | wasConsumed ✅ | >30%+价格3% | 🆕 增强 |
| **OI突降** | ❌ 无 | >5% | 🆕 新增 |
| **分级告警** | ❌ 无 | CRITICAL/HIGH/WATCH | 🆕 新增 |

---

## 🎯 实施计划

### Phase 1: 数据库扩展（5分钟）
- [ ] 扩展large_order_detection_results表（+8字段）
- [ ] 添加索引优化查询
- [ ] 验证字段添加成功

### Phase 2: SwanDetector模块（30分钟）
- [ ] 创建swan-detector.js
- [ ] 实现相对阈值检查
- [ ] 实现快速消费检测
- [ ] 实现OI突降检测
- [ ] 实现黑天鹅分级

### Phase 3: 集成到LargeOrderDetector（20分钟）
- [ ] 添加SwanDetector实例
- [ ] 获取24h成交额
- [ ] 维护价格历史（5分钟）
- [ ] 调用分级逻辑
- [ ] 保存扩展字段

### Phase 4: 单元测试（20分钟）
- [ ] swan-detector.test.js
- [ ] 测试相对阈值
- [ ] 测试快速消费
- [ ] 测试分级逻辑

### Phase 5: VPS部署（15分钟）
- [ ] 数据库迁移
- [ ] 代码部署
- [ ] 服务重启
- [ ] API验证

**总工期**: 约90分钟

---

## 🎯 预期效果

### 改进1: 更精准的阈值
- 不仅看绝对值（100M）
- 还看相对值（占24h成交3%或占OI的5%）
- 小交易对也能有效检测

### 改进2: 黑天鹅预警
- 3级告警：CRITICAL/HIGH/WATCH
- 快速响应能力
- 自动化风控

### 改进3: 性能优化
- 复用现有表（+8字段）
- 索引优化查询
- 内存缓存价格历史

---

## 📋 数据库复用方案

### 复用表1: large_order_detection_results ✅
**扩展**: +8个字段（swan相关）

### 复用表2: large_order_config ✅
**新增参数**:
```sql
INSERT INTO large_order_config VALUES
('SWAN_VOL24H_RATIO_THRESHOLD', '0.03', 'NUMBER', 'order/24h成交额阈值(3%)'),
('SWAN_OI_RATIO_THRESHOLD', '0.05', 'NUMBER', 'order/OI阈值(5%)'),
('SWAN_SWEEP_PCT_THRESHOLD', '0.30', 'NUMBER', '快速消费阈值(30%)'),
('SWAN_PRICE_DROP_THRESHOLD', '0.03', 'NUMBER', '价格跌幅阈值(3%)'),
('SWAN_CRITICAL_PRICE_DROP', '0.05', 'NUMBER', '严重价格跌幅(5%)'),
('SWAN_OI_COLLAPSE_THRESHOLD', '0.05', 'NUMBER', 'OI突降阈值(5%)'),
('SWAN_WINDOW_MS', '300000', 'NUMBER', '检测窗口(5分钟)');
```

### 不需要新建表 ✅
- 完全复用现有表结构
- 仅扩展字段
- 零冗余设计

---

## ⚡ 性能影响评估

### 新增计算
| 计算项 | 频率 | 复杂度 | 数据源 |
|--------|------|--------|--------|
| 24h成交额 | 每次检测 | O(1) | REST API |
| vol24h比率 | 每次检测 | O(1) | 计算 |
| OI比率 | 每次检测 | O(1) | 计算 |
| 价格历史 | 持续维护 | O(n) n=20 | 内存队列 |
| 快速消费 | 每次检测 | O(1) | 已有数据 |
| OI突降 | 每次检测 | O(1) | 已有数据 |

**总体影响**: +10-15% CPU，+5MB内存 ✅ 可接受

### 数据库影响
- 写入: +8个字段，约+30%
- 查询: 添加索引后无影响
- 存储: +100bytes/记录

**结论**: 性能影响在可接受范围内 ✅

---

## 🎯 下一步行动

1. ⏳ 创建数据库扩展脚本
2. ⏳ 实现SwanDetector模块
3. ⏳ 集成到LargeOrderDetector
4. ⏳ 编写单元测试
5. ⏳ VPS部署验证

**开始实施！**

