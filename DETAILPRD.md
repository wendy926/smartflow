# SmartFlow 详细产品设计文档 (DETAILPRD)

## 项目概述

SmartFlow 是一个基于多周期共振的高胜率高盈亏比加密货币交易策略系统，集成斐波拉契滚仓计算器。系统通过日线趋势过滤、小时确认、15分钟执行的三层共振机制，结合实时数据监控和告警系统，为交易者提供完整的策略分析和风险管理工具。

## 核心架构

### 1. 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    SmartFlow 系统架构                        │
├─────────────────────────────────────────────────────────────┤
│  前端层 (Frontend)                                          │
│  ├── 主界面 (index.html)                                    │
│  ├── 斐波拉契滚仓计算器 (rollup-calculator.html)            │
│  ├── 样式文件 (main.css)                                    │
│  └── JavaScript 模块                                        │
│      ├── main.js (主逻辑)                                   │
│      ├── api.js (API客户端)                                 │
│      ├── DataManager.js (数据管理)                          │
│      └── Modal.js (组件)                                    │
├─────────────────────────────────────────────────────────────┤
│  后端层 (Backend)                                           │
│  ├── 服务器 (server.js)                                     │
│  ├── 策略模块 (SmartFlowStrategy.js)                        │
│  ├── 数据监控 (DataMonitor.js)                              │
│  ├── 数据库管理 (DatabaseManager.js)                        │
│  ├── API接口 (BinanceAPI.js)                               │
│  ├── 限流器 (RateLimiter.js)                               │
│  ├── 通知系统 (TelegramNotifier.js)                        │
│  └── 工具模块 (TechnicalIndicators.js, DataCache.js)       │
├─────────────────────────────────────────────────────────────┤
│  数据层 (Data Layer)                                        │
│  ├── SQLite 数据库 (smartflow.db)                          │
│  ├── Binance Futures API                                   │
│  └── 数据缓存系统                                           │
└─────────────────────────────────────────────────────────────┘
```

### 2. 模块依赖关系

```
server.js
├── SmartFlowStrategy.js
│   ├── BinanceAPI.js
│   ├── TechnicalIndicators.js
│   └── DataMonitor.js
├── DatabaseManager.js
├── SimulationManager.js
├── TelegramNotifier.js
└── DataCache.js
```

## 核心功能详细设计

### 1. 交易策略分析系统

#### 1.1 多周期共振机制

**日线趋势过滤 (1D)**
- **价格位置**：价格在 MA200 上方 (多头) / 价格在 MA200 下方 (空头)
- **MA排列判断**：MA20 > MA50 (多头) / MA20 < MA50 (空头)
- **趋势强度**：ADX(14) > 20 (说明趋势强度足够)
- **波动率扩张**：布林带开口扩张 - 布林带上轨和下轨间距最近 20 根 K 线逐渐扩大，代表波动率增加，趋势在走强

**小时确认 (1H) → 多因子打分体系**
- **打分体系**：每个条件满足都为1分，满足一个则加1分
- **1. VWAP方向一致**：收盘价在VWAP上方（做多）/下方（做空）
- **2. 突破结构**：收盘价突破最近20根K线的最高点/最低点
- **3. 成交量确认**：当前K线成交量 ≥ 1.5 × 20期平均成交量
- **4. OI确认**：未平仓合约OI在6h内上涨≥+2%（做多）/下降≥-2%（做空）
- **5. 资金费率**：资金费率 ≤ 0.15%/8h
- **6. Delta确认**：买卖盘不平衡（突破时15m Delta > 过去20根平均Delta的2倍）

**根据打分体系小时级信号大小判断的执行规则：**
- **得分 ≥ 2分** → 可以进入小周期观察入场机会
- **得分 ≥ 4分** → 优先级最高（强信号，允许加仓）

**15分钟执行 (15m) → 入场与风控**
- **要求**：两种入场模式同时执行，避免错过机会

**模式A：回踩确认模式（胜率高）**
- 等价格回踩到EMA20/50或前高/前低支撑位
- 回踩时成交量缩小，价格不有效跌破支撑
- 下一根K线突破setup candle的高点（做多）/低点（做空）→ 入场

**模式B：动能突破模式（机会多）**
- 当价格突破setup candle的高点/低点时，如果15m成交量&OI同步放大，直接追单入场，不等回踩

**止损止盈计算逻辑：**
- **止损**：设置在setup candle的另一端 或 1.2 × ATR(14)，取更远的位置
- **止盈**：第一目标：1.5R平掉50%仓位；第二目标：剩余仓位用追踪止损（如跟随15m EMA20/前一小时低点）直到被动出场

#### 1.2 技术指标计算

**移动平均线 (MA)**
```javascript
// 计算简单移动平均线
function calculateSMA(values, period) {
  return values.slice(-period).reduce((sum, val) => sum + val, 0) / period;
}
```

**VWAP (成交量加权平均价格)**
```javascript
// 计算VWAP
function calculateVWAP(candles) {
  let cumulativePV = 0, cumulativeVol = 0;
  return candles.map(c => {
    const typical = (c.high + c.low + c.close) / 3;
    cumulativePV += typical * c.volume;
    cumulativeVol += c.volume;
    return cumulativePV / cumulativeVol;
  });
}
```

**ADX (平均方向指数)**
```javascript
// 计算ADX
function calculateADX(klines, period = 14) {
  // 计算True Range, +DM, -DM
  const trueRanges = [];
  const plusDMs = [];
  const minusDMs = [];
  
  for (let i = 1; i < klines.length; i++) {
    const high = parseFloat(klines[i].high);
    const low = parseFloat(klines[i].low);
    const prevHigh = parseFloat(klines[i - 1].high);
    const prevLow = parseFloat(klines[i - 1].low);

    const tr = Math.max(high - low, Math.abs(high - prevHigh), Math.abs(low - prevLow));
    trueRanges.push(tr);

    const plusDM = high - prevHigh > prevLow - low && high - prevHigh > 0 ? high - prevHigh : 0;
    const minusDM = prevLow - low > high - prevHigh && prevLow - low > 0 ? prevLow - low : 0;

    plusDMs.push(plusDM);
    minusDMs.push(minusDM);
  }

  // 计算平滑的TR, +DM, -DM，然后计算+DI, -DI, DX, ADX
  // ... (详细实现)
}
```

**布林带开口扩张检测**
```javascript
// 计算布林带开口扩张
function calculateBollingerBandExpansion(data, period = 20) {
  const bands = calculateBollingerBands(data, period);
  const recentBands = bands.slice(-20);
  const widths = recentBands.map(band => band.upper - band.lower);
  
  const firstHalf = widths.slice(0, 10);
  const secondHalf = widths.slice(10, 20);
  
  const avgFirstHalf = firstHalf.reduce((sum, w) => sum + w, 0) / firstHalf.length;
  const avgSecondHalf = secondHalf.reduce((sum, w) => sum + w, 0) / secondHalf.length;
  
  // 如果后半段平均宽度比前半段大15%以上，认为开口扩张
  return avgSecondHalf > avgFirstHalf * 1.15;
}
```

**Delta (净主动买卖量)**
```javascript
// 计算Delta
function calculateDelta(klines) {
  return klines.map(k => {
    const high = parseFloat(k.high);
    const low = parseFloat(k.low);
    const close = parseFloat(k.close);
    const volume = parseFloat(k.volume);

    const priceRange = high - low;
    const pricePosition = priceRange > 0 ? (close - low) / priceRange : 0.5;
    
    // 如果收盘价在K线上半部分，认为是买入主导
    return pricePosition > 0.5 ? volume : -volume;
  });
}
```

**CVD (累计成交量差)**
```javascript
// 计算CVD
function calculateCVD(klines) {
  const deltas = calculateDelta(klines);
  const cvd = [];
  let cumulativeDelta = 0;

  for (const delta of deltas) {
    cumulativeDelta += delta;
    cvd.push(cumulativeDelta);
  }

  return cvd;
}
```

#### 1.3 信号判断逻辑

**日线趋势过滤**
```javascript
// 多头趋势：价格在MA200上方 + MA20 > MA50 + ADX > 20 + 布林带开口扩张
if (latestClose > latestMA200 && 
    latestMA20 > latestMA50 && 
    latestADX > 20 && 
    bollingerExpansion) {
  trend = 'UPTREND';
}

// 空头趋势：价格在MA200下方 + MA20 < MA50 + ADX > 20 + 布林带开口扩张
else if (latestClose < latestMA200 && 
         latestMA20 < latestMA50 && 
         latestADX > 20 && 
         bollingerExpansion) {
  trend = 'DOWNTREND';
}
```

**小时级多因子打分体系**
```javascript
// 6个条件，每个满足得1分
let score = 0;

// 1. VWAP方向一致
if (priceVsVwap > 0 || priceVsVwap < 0) score += 1;

// 2. 突破结构
if (breakoutUp || breakoutDown) score += 1;

// 3. 成交量确认
if (volumeRatio >= 1.5) score += 1;

// 4. OI确认
if (oiChange >= 2 || oiChange <= -2) score += 1;

// 5. 资金费率
if (Math.abs(fundingRate) <= 0.0015) score += 1;

// 6. Delta确认
if (deltaConfirmed) score += 1;

// 信号强度判断
if (score >= 4) signalStrength = 'STRONG';
else if (score >= 2) signalStrength = 'MODERATE';
```

**最终信号判断**
```javascript
// 只有当日线趋势明确且小时级得分≥2分时才产生信号
if (dailyTrend.trend === 'UPTREND' && hourlyConfirmation.signalStrength !== 'NONE') {
  signal = 'LONG';
} else if (dailyTrend.trend === 'DOWNTREND' && hourlyConfirmation.signalStrength !== 'NONE') {
  signal = 'SHORT';
}
```

**15分钟执行判断**
```javascript
// 模式A：回踩确认模式
if (pullbackToSupport && volumeContraction && (breakSetupHigh || breakSetupLow)) {
  executionMode = 'PULLBACK_CONFIRMATION';
  executionSignal = breakSetupHigh ? 'LONG_EXECUTE' : 'SHORT_EXECUTE';
}

// 模式B：动能突破模式
else if (momentumBreakout) {
  executionMode = 'MOMENTUM_BREAKOUT';
  executionSignal = breakSetupHigh ? 'LONG_EXECUTE' : 'SHORT_EXECUTE';
}
```

### 2. 斐波拉契滚仓计算器

#### 2.1 初始本金计算

**计算公式**
```
建议保证金 = 最大损失金额 ÷ (最大杠杆 × 止损距离)
```

**参数说明**
- 最大损失金额：用户设定的愿意承担的最大损失
- 最大杠杆：基于止损距离计算，确保风险可控
- 止损距离：((订单区上沿 - 止损价格) ÷ 订单区上沿) × 100%
- 止损价格：订单区下沿价格 - 4H级别ATR

#### 2.2 杠杆策略设计

**固定序列策略 [30, 25, 20, 15, 10, 5]**
- 使用预设的杠杆序列，从高到低递减
- 保证金计算：所需保证金 = (可用利润 × 0.1) ÷ 杠杆倍数
- 特点：高杠杆起步，风险较高但收益潜力大

**动态计算策略**
- 杠杆计算：baseLeverage × decayFactor
- 衰减因子：max(0.6, 1 - 步骤 × 0.08)
- 保证金计算：标准保证金 = 可用利润 ÷ 10
- 特点：保守策略，风险较低但收益相对稳定

#### 2.3 斐波拉契回调位

**回调位设置**
```
[0.236, 0.382, 0.5, 0.618, 0.786]
```

**计算方式**
```
峰值价格 = 起始价格 + 回调位 × (目标价格 - 起始价格)
回调价格 = 峰值价格 - 0.618 × (峰值价格 - 起始价格)
```

#### 2.4 风险控制机制

**本金保护判断**
```
判断条件：最坏情况损失 < 本金 × 0.8
最坏情况损失 = |目标价格 - 加权平均入场价| × 总数量
保护比例 = max(0, (本金 - 最坏情况损失) ÷ 本金)
```

**最大回撤计算**
```
最大回撤 = 最坏情况损失 ÷ 本金 × 100%
风险等级：
- 绿色（安全）：回撤 < 20%
- 黄色（中等）：20% ≤ 回撤 < 50%
- 红色（高风险）：回撤 ≥ 50%
```

### 3. 数据监控与告警系统

#### 3.1 数据质量监控

**监控指标**
- 数据收集成功率：各API接口调用成功率
- 数据验证状态：数据格式和内容验证结果
- 数据质量状态：分析过程中的错误和异常

**告警触发条件**
- 数据收集率 < 100%
- 数据验证出现错误
- 数据质量出现问题
- 告警冷却期：30分钟防止重复告警

#### 3.2 告警系统设计

**Telegram通知**
```javascript
// 告警消息格式
const alertMessage = `
🚨 SmartFlow 系统告警
时间: ${new Date().toLocaleString()}
数据收集率: ${dataCollectionRate}%
信号分析率: ${signalAnalysisRate}%
数据验证: ${dataValidation.hasErrors ? '❌ 异常' : '✅ 正常'}
数据质量: ${dataQuality.hasIssues ? '❌ 异常' : '✅ 正常'}
`;
```

### 4. 数据库设计

#### 4.1 核心表结构

**signals表**
```sql
CREATE TABLE signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  trend TEXT NOT NULL,
  signal TEXT NOT NULL,
  execution TEXT NOT NULL,
  -- 详细数据字段
  daily_trend_data TEXT,
  hourly_confirmation_data TEXT,
  execution_data TEXT,
  raw_data TEXT
);
```

**user_settings表**
```sql
CREATE TABLE user_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 4.2 数据关系

```
signals (1) ──→ (N) signal_history
user_settings (1) ──→ (N) user_preferences
```

### 5. API接口设计

#### 5.1 RESTful API

**主要接口**
- `GET /api/signals` - 获取所有交易对信号数据
- `GET /api/monitoring-dashboard` - 获取监控中心数据
- `GET /api/history/:symbol?` - 获取历史记录
- `POST /api/mark-result` - 标记结果

**用户设置接口**
- `GET /api/user-settings` - 获取用户设置
- `POST /api/user-settings` - 保存用户设置

**告警接口**
- `POST /api/trigger-alert-check` - 手动触发告警检查
- `POST /api/test-data-quality-alert` - 测试数据质量告警

#### 5.2 数据格式

**信号数据格式**
```json
{
  "symbol": "BTCUSDT",
  "trend": "UPTREND",
  "signal": "LONG",
  "execution": "EXECUTION",
  "vwap": 110109.99,
  "volumeRatio": 1.44,
  "oiChange": -0.056,
  "fundingRate": 0.0000511,
  "cvd": "BEARISH",
  "cvdValue": -1361.73,
  "priceVsVwap": 221.00,
  "dataCollectionRate": 100
}
```

### 6. 前端界面设计

#### 6.1 主界面布局

**顶部导航**
- 系统标题和状态
- 刷新控制按钮
- 用户设置入口

**核心数据表格**
- 交易对列表
- 实时信号状态
- 数据采集率显示
- 折叠详情功能

**监控中心**
- 数据质量状态
- 告警信息
- 系统健康状态

#### 6.2 斐波拉契滚仓计算器

**输入区域**
- 最大损失金额
- 订单区价格范围
- 4H级别ATR
- 目标价格
- 杠杆策略选择

**计算结果显示**
- 初单计算结果
- 策略对比分析
- 滚仓路径详情
- 风险控制指标

**计算逻辑说明**
- 详细的计算公式
- 参数说明
- 风险等级说明

### 7. 数据更新机制

#### 7.1 分层更新策略

**趋势数据更新（4小时周期）**
- **更新频率**：每4小时更新一次
- **更新时间**：北京时间 00:00、04:00、08:00、12:00、16:00、20:00
- **更新内容**：日线趋势分析（MA20/50/200排列、价格位置）
- **技术实现**：`updateTrendData()` 方法调用 `analyzeDailyTrend()`

**信号数据更新（1小时周期）**
- **更新频率**：每1小时更新一次
- **更新内容**：小时确认分析（VWAP、成交量、OI、资金费率、CVD）
- **技术实现**：`updateSignalData()` 方法调用 `analyzeHourlyConfirmation()`

**入场执行更新（15分钟周期）**
- **更新频率**：每15分钟更新一次
- **更新内容**：15分钟执行分析（EMA回踩、突破确认、止损目标）
- **技术实现**：`updateExecutionData()` 方法调用 `analyze15mExecution()`

#### 7.2 更新状态监控

**前端状态显示**
```javascript
// 更新状态显示
updateStatusDisplay() {
  const formatTime = (time) => {
    if (!time) return '--';
    return new Date(time).toLocaleTimeString('zh-CN', { 
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };
  
  document.getElementById('trendUpdateTime').textContent = formatTime(this.updateTimes.trend);
  document.getElementById('signalUpdateTime').textContent = formatTime(this.updateTimes.signal);
  document.getElementById('executionUpdateTime').textContent = formatTime(this.updateTimes.execution);
}
```

**后端定时器管理**
```javascript
// 趋势数据定时器
this.trendInterval = setInterval(async () => {
  // 更新趋势数据
}, 4 * 60 * 60 * 1000); // 4小时

// 信号数据定时器
this.signalInterval = setInterval(async () => {
  // 更新信号数据
}, 60 * 60 * 1000); // 1小时

// 执行数据定时器
this.executionInterval = setInterval(async () => {
  // 更新执行数据
}, 15 * 60 * 1000); // 15分钟
```

#### 7.3 手动刷新机制

**保留功能**
- 手动刷新按钮：立即触发完整数据更新
- 单个交易对刷新：针对特定交易对进行数据更新
- 实时状态显示：显示各层数据的最后更新时间

**移除功能**
- 自动刷新间隔选择：不再提供用户自定义刷新频率
- 页面可见性自动暂停：简化刷新逻辑

### 8. 部署架构

#### 8.1 系统要求

**硬件要求**
- CPU: 2核心以上
- 内存: 2GB+ 推荐
- 存储: 30GB+ 可用空间
- 网络: 10Mbps以上带宽

**软件要求**
- Node.js: >= 18.0.0
- 操作系统: Ubuntu 20.04+ 或 CentOS 8+
- 数据库: SQLite3
- 进程管理: PM2

#### 7.2 部署流程

**1. 环境准备**
```bash
# 安装Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装PM2
npm install -g pm2
```

**2. 应用部署**
```bash
# 克隆代码
git clone https://github.com/username/smartflow.git
cd smartflow/vps-app

# 安装依赖
npm install

# 启动服务
pm2 start ecosystem.config.js
```

**3. 服务配置**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'smartflow-app',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 8080
    }
  }]
};
```

### 8. 监控与维护

#### 8.1 系统监控

**性能监控**
- CPU使用率
- 内存使用率
- 磁盘空间
- 网络连接状态

**应用监控**
- PM2进程状态
- 应用日志
- 数据库状态
- API响应时间

#### 8.2 维护策略

**定期维护**
- 数据库备份
- 日志清理
- 依赖更新
- 安全补丁

**故障处理**
- 自动重启机制
- 告警通知
- 日志分析
- 问题诊断

### 9. 安全设计

#### 9.1 数据安全

**API安全**
- 请求频率限制
- 数据验证
- 错误处理
- 日志记录

**数据库安全**
- 数据备份
- 访问控制
- 数据加密
- 定期清理

#### 9.2 系统安全

**网络安全**
- 防火墙配置
- SSL/TLS加密
- 访问控制
- 监控告警

**应用安全**
- 输入验证
- 错误处理
- 日志安全
- 依赖管理

### 10. 性能优化

#### 10.1 缓存策略

**数据缓存**
- API响应缓存
- 计算结果缓存
- 静态资源缓存
- 缓存清理机制

#### 10.2 数据库优化

**查询优化**
- 索引设计
- 查询优化
- 连接池管理
- 数据分页

### 11. 扩展性设计

#### 11.1 模块化架构

**核心模块**
- 策略分析模块
- 数据监控模块
- 告警通知模块
- 用户管理模块

**扩展接口**
- 插件系统
- API扩展
- 数据源扩展
- 通知渠道扩展

#### 11.2 配置管理

**环境配置**
- 开发环境
- 测试环境
- 生产环境
- 配置热更新

### 12. 测试策略

#### 12.1 单元测试

**核心模块测试**
- 策略计算测试
- 数据验证测试
- API接口测试
- 数据库操作测试

#### 12.2 集成测试

**系统集成测试**
- 端到端测试
- 性能测试
- 压力测试
- 兼容性测试

### 13. 文档维护

#### 13.1 技术文档

**API文档**
- 接口说明
- 参数定义
- 响应格式
- 错误码说明

**开发文档**
- 代码规范
- 架构说明
- 部署指南
- 故障排除

#### 13.2 用户文档

**使用指南**
- 功能介绍
- 操作说明
- 常见问题
- 最佳实践

---

## 版本历史

- **v1.0.0** (2025-01-07): 初始版本，包含基础交易策略分析和斐波拉契滚仓计算器
- **v1.1.0** (2025-01-07): 增加数据监控和告警系统
- **v1.2.0** (2025-01-07): 完善用户设置和界面优化
- **v1.3.0** (2025-01-07): 修复杠杆策略差异问题，增加计算逻辑说明
- **v1.4.0** (2025-01-07): 实现分层更新机制，优化数据更新策略
- **v1.5.0** (2025-01-07): 配置域名和SSL证书，支持HTTPS访问

## 域名配置

### 域名信息
- **域名**: smart.aimaventop.com
- **SSL证书**: Let's Encrypt (自动续期)
- **SSL模式**: Cloudflare Full (Strict)
- **HTTPS重定向**: 自动从HTTP重定向到HTTPS

### 服务器配置
- **操作系统**: Ubuntu 24.04 LTS
- **Web服务器**: Nginx 1.24.0
- **SSL管理**: Certbot
- **防火墙**: UFW (开放80、443、8080端口)

### 访问地址
- **主页**: https://smart.aimaventop.com/
- **API端点**: https://smart.aimaventop.com/api/signals
- **监控面板**: https://smart.aimaventop.com/api/monitoring-dashboard
- **斐波拉契计算器**: https://smart.aimaventop.com/rollup-calculator.html

---

## 联系方式

- 项目地址: https://github.com/username/smartflow
- 技术支持: support@smartflow.com
- 文档更新: 2025-01-07
