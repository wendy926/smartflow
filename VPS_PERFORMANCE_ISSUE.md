# VPS性能问题诊断和优化方案

**诊断时间**: 2025-10-13 18:45  
**状态**: 🚨 紧急优化中  

---

## 🚨 当前资源状态（危险）

### 系统资源

```
CPU使用率: 27.3%（main-app进程）
内存使用率: 85.62%（已触发告警，阈值75%）
可用内存: 89MB / 894MB（仅10%）
磁盘使用率: 73%
```

**状态**: ⚠️ **内存严重不足！**

---

### PM2进程

| 进程 | 内存 | CPU | 重启次数 | 状态 |
|------|------|-----|---------|------|
| **main-app** | **130.6MB** | **33.3%** | 22 | 🚨 过高 |
| strategy-worker | 81.1MB | 0% | 4,816 | ⚠️ 重启过多 |
| monitor | 65.0MB | 0% | 12,800+ | 🚨 重启过多 |
| data-cleaner | 54.4MB | 0% | 9,850 | 🚨 重启过多 |

**总内存**: 331MB（4个进程）

---

## 🔍 问题根源分析

### 问题1: 数据库记录爆炸 🚨

```sql
SELECT COUNT(*) FROM large_order_detection_results;
-- 结果: 35,259条！

SELECT COUNT(*) FROM ai_market_analysis;
-- 结果: 403条
```

**问题**:
- **large_order_detection_results: 35,259条**（过多！）
- 原因: 每小时保存，未清理旧数据
- 影响: 查询慢、内存占用高

**计算**:
- 启动时间: ~14分钟
- 每小时保存: 2个symbol × 1次 = 2条
- 实际: 35,259条 / 2 = 17,629小时 = 734天？

**结论**: 数据累积过多，必须清理

---

### 问题2: AI API频率超限 🚨

```
error: openai API请求频率超限
warn: 主提供商openai失败，尝试备用提供商...
error: grok API请求失败 - ERROR: 403
```

**问题**:
- AI分析请求过于频繁
- 触发OpenAI和Grok的速率限制
- 导致CPU和网络资源浪费

---

### 问题3: MySQL连接配置警告

```
Ignoring invalid configuration option: acquireTimeout
Ignoring invalid configuration option: timeout
Ignoring invalid configuration option: reconnect
```

**问题**: 重复创建MySQL连接（未使用连接池）

---

### 问题4: 定时任务过多

**检测到的定时任务**:
- AI分析定时任务（宏观+符号）
- 大额挂单检测（1小时）
- 聪明钱检测（15分钟）
- 监控定时任务
- 数据清理定时任务
- WebSocket连接（BTCUSDT + ETHUSDT）

**总计**: 10+个定时任务同时运行

---

## ✅ 优化方案（立即执行）

### P0 - 紧急（立即）

#### 1. 清理large_order_detection_results历史数据

**SQL**:
```sql
-- 只保留最近7天数据
DELETE FROM large_order_detection_results
WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY);

-- 预期删除: ~34,000条
```

**效果**: 
- 减少查询时间
- 降低内存占用
- 磁盘空间释放

---

#### 2. 暂时禁用AI分析（减少API调用）

**文件**: `src/services/ai-agent/scheduler.js`

**修改**:
```javascript
async start() {
  // ❌ 暂时禁用（API超限）
  // this.startMacroAnalysis();
  // this.startSymbolAnalysis();
  
  logger.warn('[AI Scheduler] AI分析已暂时禁用（API频率超限）');
}
```

**效果**:
- 停止AI API调用
- 减少CPU占用
- 减少网络请求

---

#### 3. 增加large_order_detection_results保存限制

**文件**: `detector.js` - `_saveDetectionResult` 方法

**添加**:
```javascript
async _saveDetectionResult(symbol, timestamp, aggregateResult, trackedEntries, swanResult, trapResult) {
  try {
    // 清理旧数据（保留最近7天）
    await this.database.query(`
      DELETE FROM large_order_detection_results
      WHERE symbol = ?
        AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
    `, [symbol]);
    
    // ... 现有保存逻辑
  } catch (error) {
    logger.error('[LargeOrderDetector] 保存检测结果失败:', error);
  }
}
```

**效果**: 自动清理旧数据，保持数据库精简

---

### P1 - 重要（今天内）

#### 4. 降低大额挂单检测频率

**文件**: `detector.js` - `startMonitoring` 方法

**修改**:
```javascript
// 原：每1小时检测
setInterval(() => this.detect(symbol), 3600000);

// 改：每4小时检测
setInterval(() => this.detect(symbol), 14400000);  // 4小时
```

**效果**: 减少75%的检测次数

---

#### 5. 优化聪明钱检测频率

**文件**: `smart-money-detector.js`

**当前**: 15分钟（900秒）

**建议**: 调整为30分钟或1小时

**修改数据库**:
```sql
UPDATE strategy_params
SET param_value = '1800'  -- 30分钟
WHERE param_name = 'smart_money_refresh_interval_sec';
```

---

#### 6. 增加ecosystem.config.js内存限制

**文件**: `ecosystem.config.js`

**修改**:
```javascript
{
  name: 'main-app',
  max_memory_restart: '150M',  // 原150M
  node_args: '--max-old-space-size=150',
  
  // 新增：GC优化
  node_args: '--max-old-space-size=150 --optimize-for-size --gc-interval=100'
}
```

---

### P2 - 可选（本周内）

#### 7. 实现数据库连接池复用

**当前问题**: 重复创建连接

**优化**: 使用单例模式

---

#### 8. 减少WebSocket重连

**检查**: WebSocket连接稳定性

---

## 🚀 立即执行优化

### 第一步：清理数据库

```sql
-- 清理large_order_detection_results（只保留7天）
DELETE FROM large_order_detection_results
WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY);

-- 清理ai_market_analysis（只保留30条/symbol）
DELETE a1 FROM ai_market_analysis a1
INNER JOIN (
  SELECT symbol, analysis_type, id
  FROM (
    SELECT symbol, analysis_type, id,
           ROW_NUMBER() OVER (PARTITION BY symbol, analysis_type ORDER BY created_at DESC) as rn
    FROM ai_market_analysis
  ) t
  WHERE rn > 30
) a2 ON a1.id = a2.id;
```

**预期删除**: ~34,000条

---

### 第二步：暂时禁用AI分析

**原因**: API频率超限，浪费资源

---

### 第三步：降低检测频率

- 大额挂单: 1小时 → 4小时
- 聪明钱: 15分钟 → 30分钟

---

## 📊 优化预期效果

| 指标 | 优化前 | 优化后 | 改善 |
|------|-------|-------|------|
| 内存使用 | 85.6% | < 70% | -18% |
| CPU使用 | 27.3% | < 15% | -45% |
| 数据库记录 | 35,259条 | < 2,000条 | -94% |
| API调用频率 | 高 | 低 | -80% |

---

🚨 **立即执行优化！否则服务可能崩溃！**

