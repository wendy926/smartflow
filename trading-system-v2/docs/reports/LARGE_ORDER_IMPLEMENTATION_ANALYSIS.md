# 大额挂单聪明钱模块实现分析

## 一、需求分析（基于 smartmoney.md）

### 核心功能
1. **大额挂单监控** (>100M USD)
   - 实时监控 order book depth
   - 跟踪大额挂单生命周期
   - 记录创建、更新、撤销、成交事件

2. **Spoof 检测**（诱导挂单）
   - 检测快速撤销的挂单 (<3s)
   - 识别虚假深度操纵

3. **Impact Ratio 计算**
   - `impactRatio = order_value / topN_depth_value`
   - 阈值：≥0.25 表示足以影响价格

4. **成交消耗检测**
   - 通过 aggTrade 流判断挂单被吃掉的情况
   - 区分 SWEEP_BUY vs SWEEP_SELL

5. **智能分类**
   - DEFENSIVE_BUY（吸筹/防守）
   - DEFENSIVE_SELL（派发/压制）
   - SWEEP_BUY（拉升）
   - SWEEP_SELL（砸盘）
   - SPOOF（诱导）
   - MANIPULATION（操纵）

6. **信号合成**
   - 整合大额挂单信号 + CVD + OI
   - 输出最终动作：ACCUMULATE/MARKUP、DISTRIBUTION/MARKDOWN、MANIPULATION、UNKNOWN

---

## 二、数据库表结构分析

### 现有可复用的表
✅ **smart_money_watch_list** - 存储监控交易对配置（完全复用）
✅ **strategy_params** - 存储配置参数（可复用）

### 需要新建的表

#### 1. large_order_tracking（大额挂单追踪表）
```sql
CREATE TABLE IF NOT EXISTS large_order_tracking (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL COMMENT '交易对',
    side ENUM('bid', 'ask') NOT NULL COMMENT '买卖方向',
    price DECIMAL(20,8) NOT NULL COMMENT '价格',
    qty DECIMAL(20,8) NOT NULL COMMENT '数量',
    value_usd DECIMAL(20,2) NOT NULL COMMENT 'USD价值',
    
    created_at BIGINT NOT NULL COMMENT '首次发现时间(ms)',
    last_seen_at BIGINT NOT NULL COMMENT '最后发现时间(ms)',
    canceled_at BIGINT DEFAULT NULL COMMENT '撤销时间(ms)',
    seen_count INT DEFAULT 1 COMMENT '连续发现次数',
    
    filled_volume_observed DECIMAL(20,8) DEFAULT 0 COMMENT '观察到的成交量',
    impact_ratio DECIMAL(6,4) DEFAULT 0 COMMENT '影响力比率',
    
    classification VARCHAR(50) DEFAULT 'UNKNOWN' COMMENT '分类',
    is_persistent BOOLEAN DEFAULT FALSE COMMENT '是否持续',
    is_spoof BOOLEAN DEFAULT FALSE COMMENT '是否为诱导单',
    was_consumed BOOLEAN DEFAULT FALSE COMMENT '是否被吃掉',
    
    INDEX idx_symbol_time (symbol, created_at),
    INDEX idx_side (side),
    INDEX idx_classification (classification),
    INDEX idx_canceled (canceled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 2. large_order_detection_results（检测结果表）
```sql
CREATE TABLE IF NOT EXISTS large_order_detection_results (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL COMMENT '交易对',
    timestamp BIGINT NOT NULL COMMENT '检测时间(ms)',
    
    final_action VARCHAR(50) NOT NULL COMMENT '最终动作',
    buy_score DECIMAL(6,2) DEFAULT 0 COMMENT '买入得分',
    sell_score DECIMAL(6,2) DEFAULT 0 COMMENT '卖出得分',
    cvd_cum DECIMAL(20,8) DEFAULT 0 COMMENT 'CVD累积值',
    oi DECIMAL(20,8) DEFAULT NULL COMMENT '持仓量',
    oi_change_pct DECIMAL(10,4) DEFAULT NULL COMMENT 'OI变化百分比',
    spoof_count INT DEFAULT 0 COMMENT 'Spoof数量',
    
    tracked_entries_count INT DEFAULT 0 COMMENT '追踪挂单数量',
    detection_data JSON DEFAULT NULL COMMENT '完整检测数据',
    
    INDEX idx_symbol_time (symbol, timestamp),
    INDEX idx_final_action (final_action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 3. large_order_config（配置表）
```sql
CREATE TABLE IF NOT EXISTS large_order_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE COMMENT '配置键',
    config_value TEXT NOT NULL COMMENT '配置值',
    config_type ENUM('NUMBER', 'STRING', 'BOOLEAN') DEFAULT 'NUMBER',
    description TEXT DEFAULT NULL COMMENT '描述',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 三、Binance API 复用分析

### 可直接复用 ✅
1. **getDepth(symbol, limit)** - 获取深度数据
   - 位置：`src/api/binance-api.js`
   - 用途：获取 order book 快照

2. **getOpenInterest(symbol)** - 获取持仓量
   - 位置：`src/api/binance-api.js`
   - 用途：计算 OI 变化

3. **getKlines(symbol, interval, limit)** - 获取K线
   - 用途：计算 CVD（间接）

### 需要新增 🆕
1. **aggTrade WebSocket 管理**
   - 用途：实时监控成交，判断挂单消耗
   - 实现：创建 WebSocket 管理类

2. **depth WebSocket（可选优化）**
   - 当前：使用 REST 轮询（2s间隔）
   - 优化：使用 depth@100ms WebSocket 流

---

## 四、架构设计

### 核心服务类结构

```
src/services/
├── large-order/
│   ├── detector.js           # LargeOrderDetector 主服务
│   ├── tracker.js             # OrderTracker 挂单追踪器
│   ├── classifier.js          # OrderClassifier 分类器
│   ├── aggregator.js          # SignalAggregator 信号聚合器
│   └── websocket-manager.js  # WebSocket 管理器
```

### 数据流

```
1. depth REST 轮询 (2s) → 发现大额挂单 (>100M)
   ↓
2. OrderTracker 追踪 → 记录生命周期
   ↓
3. aggTrade WS 流 → 检测成交消耗
   ↓
4. OrderClassifier → 分类 (DEFENSIVE/SWEEP/SPOOF)
   ↓
5. SignalAggregator → 合成 CVD/OI → 最终动作
   ↓
6. 返回结果 + 存储数据库
```

### 状态管理

```javascript
// 内存状态（Map）
state = {
  tracked: Map<key, TrackedOrder>,  // key = side@price
  cvdSeries: Array<{ts, delta}>,
  cvdCum: number,
  prevOI: number,
  oi: number
}

// 定期持久化到数据库（每5分钟）
persistState() → large_order_tracking 表
```

---

## 五、前端设计

### 页面结构（基于文档）

#### A. Summary Bar（顶部卡片）
```
┌─────────────────────────────────────────────────────────┐
│ 【ETHUSDT】 最终动作: ACCUMULATE/MARKUP (绿色)          │
│ Buy Score: 5.5 | Sell Score: 2.0 | CVD: +12345.67      │
│ OI: 987654321 (+1.2%) | Spoof: 0 | 更新: 12s ago       │
└─────────────────────────────────────────────────────────┘
```

#### B. Tracked Entries Table（主表格）
```
┌────┬──────┬────────┬────────┬──────────┬───────┬─────────────────┬──────────┬─────────┬─────────┐
│ #  │ Side │ Price  │ Qty    │ Value    │Impact │ Classification  │Persistent│Consumed │ Actions │
├────┼──────┼────────┼────────┼──────────┼───────┼─────────────────┼──────────┼─────────┼─────────┤
│ 1  │ BUY  │2500.00 │ 40000  │100,000,000│ 30%  │ DEFENSIVE_BUY   │   🟢    │    —    │ [Drill] │
│ 2  │ SELL │2600.00 │ 50000  │130,000,000│ 39%  │ SPOOF           │   ⚪    │    —    │ [Alert] │
└────┴──────┴────────┴────────┴──────────┴───────┴─────────────────┴──────────┴─────────┴─────────┘
```

#### C. 颜色规则
- DEFENSIVE_BUY → 浅绿色背景
- DEFENSIVE_SELL → 浅红色背景
- SWEEP_BUY/SELL → 黄色 + 加粗
- SPOOF → 灰底 + 波浪图标
- Impact ≥ 0.25 → 闪烁 `!` 标记

---

## 六、实施计划

### Phase 1: 数据库 & 基础架构
1. 创建数据库 schema
2. 实现 OrderTracker 类
3. 实现 WebSocket 管理器
4. 单元测试

### Phase 2: 核心检测逻辑
1. 实现 LargeOrderDetector
2. 实现 OrderClassifier
3. 实现 SignalAggregator
4. 单元测试

### Phase 3: API & 前端
1. 创建 API 路由
2. 实现前端 UI
3. 集成测试

### Phase 4: 部署 & 验证
1. 部署到 VPS
2. 功能验证
3. Git tag v2.1.0

---

## 七、关键技术点

### 1. Rate Limit 管理
- REST depth：限制 1 req/2s
- WebSocket：限制连接数（5个/symbol）

### 2. 内存优化
- 只保留最近 4h 的 CVD 数据
- tracked Map 自动清理已取消且超过1h的记录

### 3. 精度匹配
- aggTrade price vs depth price：使用 0.05% tolerance

### 4. 错误处理
- WebSocket 断线重连（5s延迟）
- REST 失败重试（3次）

---

## 八、复用现有代码

### 完全复用 ✅
1. `src/api/binance-api.js` - getDepth, getOpenInterest
2. `src/database/index.js` - 数据库连接
3. `src/utils/logger.js` - 日志
4. `src/web/app.js` - 前端路由框架

### 部分复用 🔄
1. `src/services/smart-money-detector.js` - 参考 CVD 计算逻辑
2. `src/web/styles.css` - 复用表格样式

### 完全新建 🆕
1. `src/services/large-order/` - 所有大额挂单相关逻辑
2. `src/api/routes/large-orders.js` - 新 API 路由
3. `src/web/public/js/large-orders.js` - 新前端逻辑
4. `src/web/public/css/large-orders.css` - 新样式

---

## 九、23个设计原则对齐

1. ✅ **单一职责** - 每个类只负责一个功能
2. ✅ **开闭原则** - 易于扩展新的分类器
3. ✅ **依赖倒置** - 依赖抽象接口
4. ✅ **接口隔离** - 小而精的接口
5. ✅ **错误处理** - 完整的 try-catch
6. ✅ **日志记录** - 详细日志
7. ✅ **单元测试** - 覆盖核心逻辑
8. ✅ **JSDoc 注释** - 完整文档
9. ✅ **函数式编程** - 避免副作用
10. ✅ **异步处理** - async/await

---

## 十、时间估算

| 阶段 | 任务 | 时间 |
|------|------|------|
| Phase 1 | 数据库 + 基础架构 | 30min |
| Phase 2 | 核心检测逻辑 | 45min |
| Phase 3 | API + 前端 | 45min |
| Phase 4 | 部署 + 验证 | 20min |
| **总计** | | **~2.5h** |

---

**状态**: ✅ 分析完成，准备开始实施  
**下一步**: 创建数据库 schema

