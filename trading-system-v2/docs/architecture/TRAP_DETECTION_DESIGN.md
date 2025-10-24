# 诱多/诱空检测设计文档

**设计时间**: 2025-10-13 00:35  
**基于文档**: smartmoney.md (行681-858)  
**目标**: 防止被大资金诱多/诱空误导  

---

## 📋 需求分析

### smartmoney.md防御系统（4重）

#### 1️⃣ 信号过滤（Order Persistence Filter）
```
持续性 >= 10秒 → 真单
持续性 <= 3秒且重复 → 诱单
```

#### 2️⃣ 成交验证（Execution Validation）
```
成交比例 > 30% + CVD同向 → 真信号
撤单比例 > 80% + 成交 < 20% → 诱单
```

#### 3️⃣ 时序验证（Temporal Sequence Check）
```
CVD + OI + 价格 三者同步 → 真趋势
单次spike + 快速反转 → 假信号
```

#### 4️⃣ 跨市场验证（Cross-Market Consistency）
```
多交易所同向 → 真资金流
单一交易所 → 高概率诱单
```

---

## 🗄️ 数据库设计（复用现有表）

### 复用表1: large_order_detection_results ✅

**新增字段**:
```sql
trap_detected BOOLEAN DEFAULT FALSE 
  COMMENT '是否检测到诱多/诱空',
trap_type VARCHAR(20) DEFAULT NULL 
  COMMENT '陷阱类型 (BULL_TRAP/BEAR_TRAP/NONE)',
trap_confidence DECIMAL(5,2) DEFAULT NULL 
  COMMENT '陷阱置信度(0-1)',
trap_indicators JSON DEFAULT NULL 
  COMMENT '陷阱指标 {persistence, filledRatio, cvdAligned, oiAligned}',
persistent_orders_count INT DEFAULT 0 
  COMMENT '持续挂单数量(>=10s)',
flash_orders_count INT DEFAULT 0 
  COMMENT '闪现挂单数量(<3s)',
cancel_ratio DECIMAL(5,2) DEFAULT NULL 
  COMMENT '撤单比率'
```

**估计影响**: +7字段, ~80bytes/记录

### 无需新建表 ✅

---

## 🏗️ 服务端设计

### 模块1: TrapDetector（诱多诱空检测器）

**文件**: `src/services/smart-money/trap-detector.js`

**职责**:
- 检测诱多（Bull Trap）
- 检测诱空（Bear Trap）
- 4重防御逻辑
- 置信度计算

**类设计**:
```javascript
class TrapDetector {
  constructor(config)
  
  // 1. 信号过滤
  checkPersistence(orders)
  
  // 2. 成交验证
  checkExecution(order, cvdChange, oiChange)
  
  // 3. 时序验证
  checkTemporalSequence(priceHistory, cvdSeries, oiSeries)
  
  // 4. 跨市场验证（简化：先跳过）
  // checkCrossMarket(exchanges)
  
  // 综合判断
  detect(data)
}
```

### 模块2: 集成到SmartMoneyDetector

**修改文件**: `src/services/smart-money-detector.js`

**新增**:
- 引入TrapDetector
- 在detectSmartMoneyV2中调用
- 返回trap信息

**输出格式**:
```javascript
{
  symbol, action, confidence,
  trap: {
    detected: true,
    type: 'BULL_TRAP',
    confidence: 0.85,
    indicators: {
      persistence: 2.5,      // 秒
      filledRatio: 0.15,     // 成交比例
      cancelRatio: 0.85,     // 撤单比例
      cvdAligned: false,
      oiAligned: false
    }
  }
}
```

---

## 🎨 前端设计（smartmoney.md风格）

### 颜色约定
```css
/* 动作分类 */
.action-accumulate { color: #16a34a; }  /* 绿色 */
.action-markup { color: #16a34a; }
.action-distribution { color: #ef4444; }  /* 红色 */
.action-markdown { color: #ef4444; }
.action-manipulation { color: #f59e0b; }  /* 橙色 */
.action-spoof { color: #9ca3af; }  /* 灰色 */

/* 陷阱标记 */
.trap-bull { 
  background: #fef3c7; 
  border: 2px solid #f59e0b;
}
.trap-bear { 
  background: #fee2e2; 
  border: 2px solid #ef4444;
}

/* 图标 */
.icon-persistent::before { content: '●'; color: #16a34a; }
.icon-transient::before { content: '○'; color: #9ca3af; }
.icon-consumed::before { content: '🔥'; }
.icon-high-impact::before { content: '!'; color: #f59e0b; }
.icon-trap::before { content: '⚠️'; }
```

### 表格列展示
```html
<td class="action-cell">
  <span class="badge action-${action}">${action}</span>
  <span class="trap-indicator" v-if="trap.detected">
    ⚠️ ${trap.type}
  </span>
</td>

<td class="persistence-cell">
  <span class="${isPersistent ? 'icon-persistent' : 'icon-transient'}">
    ${duration}s
  </span>
</td>

<td class="impact-cell">
  ${impactRatio.toFixed(1)}%
  <span v-if="impactRatio >= 25" class="icon-high-impact"></span>
</td>
```

---

## 📊 判定逻辑

### 诱多（Bull Trap）识别

**条件（满足3项以上）**:
```
✅ 大买单闪现(<3s)后撤单
✅ 撤单比例 > 80%
✅ 价格横盘或下跌（与买单方向矛盾）
✅ CVD不升反降
✅ OI无明显变化
```

**置信度**:
```javascript
confidence = 0.2 * (persistence < 3s ? 1 : 0) +
             0.3 * (cancelRatio > 0.8 ? 1 : 0) +
             0.2 * (!cvdAligned ? 1 : 0) +
             0.2 * (!oiAligned ? 1 : 0) +
             0.1 * (!priceAligned ? 1 : 0)
```

### 诱空（Bear Trap）识别

**条件**:
```
✅ 大卖单闪现(<3s)后撤单
✅ 撤单比例 > 80%
✅ 价格横盘或上涨
✅ CVD不降反升
✅ OI无明显变化或下降
```

---

## ⚡ 性能评估

### 新增计算

| 计算项 | 复杂度 | 频率 | 影响 |
|--------|--------|------|------|
| 持续性检查 | O(n) n≤100 | 每次 | <1ms |
| 成交验证 | O(1) | 每次 | <0.1ms |
| 时序验证 | O(m) m≤20 | 每次 | <1ms |
| 置信度计算 | O(1) | 每次 | <0.1ms |

**总计**: +2-3ms/次检测 ✅

### 数据库影响

- 写入: +7字段 (~25%增量)
- 查询: 无影响（仅追加字段）
- 存储: +80bytes/记录

**结论**: 性能影响可接受 ✅

---

## 🎯 实施计划

### Phase 1: 修复当前数据为空问题（15分钟）
- [x] 检查WebSocket连接状态
- [x] 降低阈值到10M
- [ ] 检查depth数据是否到达tracker
- [ ] 验证数据流

### Phase 2: 数据库扩展（5分钟）
- [ ] 扩展large_order_detection_results（+7字段）
- [ ] 添加索引
- [ ] 验证字段

### Phase 3: TrapDetector模块（30分钟）
- [ ] 创建trap-detector.js
- [ ] 实现4重防御逻辑
- [ ] 计算置信度

### Phase 4: 集成SmartMoney（20分钟）
- [ ] SmartMoneyDetector调用TrapDetector
- [ ] 返回trap信息
- [ ] 保存到数据库

### Phase 5: 前端样式（15分钟）
- [ ] 更新CSS（按文档风格）
- [ ] 更新large-orders.js渲染
- [ ] 更新smart-money.js渲染

### Phase 6: 单元测试（20分钟）
- [ ] trap-detector.test.js
- [ ] 测试4重防御

### Phase 7: VPS部署（10分钟）
- [ ] 部署代码
- [ ] 数据库迁移
- [ ] 验证功能

**总工期**: 约115分钟

---

## 🔧 当前问题诊断

**大额挂单数据为空原因**:
1. ✅ WebSocket已连接（2个）
2. ✅ 阈值已降到10M
3. ❌ 但trackedEntriesCount仍为0

**可能原因**:
- OrderTracker._filterLargeOrders没有正确过滤
- depth数据未正确传递
- valueUSD计算错误
- 或市场上确实没有>10M挂单

**下一步**: 添加debug日志查看depth数据

