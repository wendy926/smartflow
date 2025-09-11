# SmartFlow 交易策略 API 使用总结

## 概述

SmartFlow 交易策略系统使用 Binance API 进行数据获取，包括 REST API 和 WebSocket API 两种方式。本文档详细梳理了各个指标计算使用的 API 类型。

## 1. Binance REST API 使用

### 1.1 K线数据获取
**API端点**: `/fapi/v1/klines`
**使用场景**:
- 4H级别趋势判断：获取4H K线数据（250根）
- 1H多因子打分：获取1H K线数据（50根）
- 震荡市1H边界判断：获取1H K线数据（50根）
- 15分钟入场判断：获取15m K线数据（50根）
- 4H突破确认：获取4H K线数据（20根）

**技术指标计算**:
- MA20, MA50, MA200（简单移动平均线）
- EMA20, EMA50（指数移动平均线）
- VWAP（成交量加权平均价格）
- ATR14（平均真实波幅）
- 布林带（Bollinger Bands）
- 布林带宽度（BB Width）

### 1.2 24小时价格数据
**API端点**: `/fapi/v1/ticker/24hr`
**使用场景**:
- 获取当前价格用于VWAP因子计算
- 价格变化率计算
- 实时价格监控

### 1.3 资金费率数据
**API端点**: `/fapi/v1/fundingRate`
**使用场景**:
- 1H多因子打分中的资金费率确认
- 资金费率因子评分（-0.05% ≤ 费率 ≤ +0.05%）

### 1.4 持仓量历史数据
**API端点**: `/futures/data/openInterestHist`
**使用场景**:
- 1H多因子打分中的OI变化确认
- 震荡市1H边界判断中的OI因子
- 6小时持仓量变化计算

### 1.5 持仓量实时数据
**API端点**: `/fapi/v1/openInterest`
**使用场景**:
- 实时持仓量监控
- OI变化率计算

## 2. Binance WebSocket API 使用

### 2.1 Delta数据（买卖盘不平衡）
**WebSocket端点**: `wss://fstream.binance.com/ws/{symbol}@aggTrade`
**使用场景**:
- 实时Delta数据收集
- 买卖盘不平衡计算
- 1H多因子打分中的Delta确认
- 震荡市1H边界判断中的Delta因子
- 15分钟多因子打分中的Delta因子

**数据更新频率**: 实时（约6秒一次）
**计算逻辑**:
```javascript
// 主动买盘：price >= 中间价
// 主动卖盘：price < 中间价
// Delta = 买盘成交量 - 卖盘成交量
// 不平衡率 = |Delta| / (买盘 + 卖盘)
```

## 3. 技术指标计算分类

### 3.1 基于REST API数据的指标
| 指标名称 | 数据源 | 计算频率 | 用途 |
|---------|--------|----------|------|
| MA20/MA50/MA200 | 4H K线 | 1小时 | 4H趋势判断 |
| EMA20/EMA50 | 15m K线 | 2分钟 | 15m入场判断 |
| VWAP | 1H/15m K线 | 5分钟/2分钟 | 多因子打分 |
| ATR14 | 15m K线 | 2分钟 | 止损止盈计算 |
| 布林带 | 1H K线 | 5分钟 | 震荡市边界判断 |
| 布林带宽度 | 15m K线 | 2分钟 | 假突破检测 |
| 资金费率 | REST API | 5分钟 | 多因子打分 |
| OI变化 | REST API | 5分钟 | 多因子打分 |

### 3.2 基于WebSocket数据的指标
| 指标名称 | 数据源 | 计算频率 | 用途 |
|---------|--------|----------|------|
| Delta不平衡 | WebSocket | 实时 | 多因子打分 |
| 买卖盘比例 | WebSocket | 实时 | 市场情绪分析 |

## 4. 数据刷新频率管理

### 4.1 刷新间隔配置
```javascript
const refreshIntervals = {
  '4h_trend': 60,      // 4H趋势：每1小时
  '1h_scoring': 5,     // 1H打分：每5分钟
  '15m_entry': 2,      // 15m入场：每2分钟
  'delta': 0.1         // Delta/盘口：实时（6秒）
};
```

### 4.2 缓存策略
- **K线数据**: 5分钟缓存
- **价格数据**: 30秒缓存
- **资金费率**: 1小时缓存
- **持仓量数据**: 5分钟缓存
- **Delta数据**: 实时更新，无缓存

## 5. API限流管理

### 5.1 限流配置
```javascript
const rateLimits = {
  klines: { weight: 1, limit: 1200, window: 60000 },     // 1分钟1200次
  ticker: { weight: 1, limit: 1200, window: 60000 },
  fundingRate: { weight: 1, limit: 1200, window: 60000 },
  openInterest: { weight: 1, limit: 1200, window: 60000 },
  openInterestHist: { weight: 1, limit: 1200, window: 60000 }
};
```

### 5.2 优先级管理
- 高优先级交易对优先获取数据
- 自动重试机制
- 错误处理和降级策略

## 6. 实时监控

### 6.1 API成功率监控
- 实时统计各API调用成功率
- 错误分类和统计
- 性能指标监控

### 6.2 数据质量监控
- 数据完整性检查
- 异常数据检测
- 数据延迟监控

## 7. 总结

### 7.1 REST API使用场景
- **历史数据获取**: K线、价格、资金费率、持仓量
- **技术指标计算**: 基于历史数据的各种技术指标
- **定期更新**: 按照固定频率更新数据

### 7.2 WebSocket API使用场景
- **实时数据流**: Delta数据、买卖盘不平衡
- **高频更新**: 需要实时响应的数据
- **市场情绪分析**: 基于实时交易数据

### 7.3 混合使用策略
- REST API提供稳定的历史数据和基础指标
- WebSocket API提供实时的市场情绪数据
- 两者结合实现完整的交易策略分析

## 8. 文件结构

```
vps-app/modules/
├── api/
│   ├── BinanceAPI.js          # REST API封装
│   └── RateLimiter.js         # API限流管理
├── data/
│   ├── DeltaManager.js        # WebSocket Delta数据管理
│   └── DataRefreshManager.js  # 数据刷新频率管理
├── utils/
│   └── TechnicalIndicators.js # 技术指标计算
└── monitoring/
    └── RealTimeDataMonitor.js # 实时数据监控
```

这个架构确保了数据获取的高效性、实时性和稳定性，为SmartFlow交易策略提供了可靠的数据基础。
