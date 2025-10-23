# Main-App 内存使用分析与优化

**当前内存使用**: 104.3MB  
**原配置限制**: 100MB  
**新配置限制**: 150MB  
**分析时间**: 2025-10-12

---

## 📊 内存使用现状

### PM2监控数据
```
main-app:
├─ 内存使用: 104.3MB
├─ 运行时间: 2分钟+（稳定）
├─ 重启次数: 0（修复后）
└─ CPU使用: 0%
```

### Node.js堆内存
```javascript
Heap总量: 4.6MB
Heap使用: 4.0MB
外部内存: 0.3MB
RSS: 41.1MB
```

**说明**: PM2显示的104.3MB是进程总内存（RSS + V8开销 + 库占用），Node.js堆只占4.6MB

---

## 🔍 内存消耗分析

### 模块级内存分配（估算）

| 模块 | 预估内存 | 占比 | 说明 |
|------|---------|------|------|
| **Node.js基础** | ~30MB | 29% | V8引擎、内置模块 |
| **Express.js框架** | ~15MB | 14% | 中间件、路由 |
| **依赖库** | ~10MB | 10% | axios, ws, mysql2等 |
| **WebSocket连接** | ~8MB | 8% | 2个depth@100ms连接 |
| **AI分析调度器** | ~12MB | 12% | AIAnalysisScheduler + BinanceAPI实例 |
| **聪明钱检测器** | ~8MB | 8% | SmartMoneyDetector + state |
| **大额挂单检测器** | ~10MB | 10% | LargeOrderDetector + tracker + classifier |
| **宏观监控** | ~5MB | 5% | MacroMonitorController |
| **数据库连接池** | ~3MB | 3% | MySQL连接池 |
| **Redis缓存** | ~2MB | 2% | Redis连接 |
| **缓冲区和其他** | ~5MB | 5% | 日志缓冲、临时数据 |
| **总计** | **~108MB** | 104% | 实际104.3MB ✅ |

---

## 🎯 主要内存消耗点

### 1. WebSocket连接（~8MB）

<function_calls>
<invoke name="grep">
<parameter name="pattern">class.*Scheduler|class.*Monitor|class.*Detector|new Map|this.state|this.cache
