# A股适配器实现文档

**日期**: 2025-10-26  
**版本**: v3.0.0  
**状态**: 实施中  
**重点**: 指数交易，模拟交易，不真实下单

---

## 📋 概述

### 实施目标
1. **只交易指数** - 专注沪深300、中证500、创业板指等主要指数
2. **模拟交易** - 所有交易记录仅写入数据库，不实际下单
3. **回测分析** - 用于策略回测和胜率计算
4. **数据源** - 使用Tushare Pro API获取A股市场数据

### 指数列表
```javascript
const indices = [
  '000300.SH', // 沪深300 - 大盘蓝筹
  '000905.SH', // 中证500 - 中小盘
  '000852.SH', // 中证1000 - 小盘
  '399001.SZ', // 深证成指 - 深市大盘
  '399006.SZ'  // 创业板指 - 成长股
];
```

---

## 🏗️ 架构设计

### 1. API层 - Tushare集成

#### TushareAPI类
```javascript
// src/api/cn-stock-api.js

class TushareAPI {
  // 核心方法
  - getIndexBasic(indexCode)        // 获取指数基本信息
  - getIndexDaily(tsCode, dates)    // 获取指数日线行情
  - getIndexDailyBasic(tsCode)      // 获取指数基本面数据
  - getIndexWeight(indexCode)       // 获取指数权重
  - getTradeCal(dates)              // 获取交易日历
  
  // 市场数据
  - getHKExTrade(date)              // 沪深港通数据
  - getMarginTrade(date)            // 融资融券数据
}
```

#### 数据获取流程
```
交易系统请求 -> ChinaStockAdapter -> TushareAPI -> Tushare Pro
                                              ↓
                                       解析数据格式
                                              ↓
                                      返回统一Kline格式
```

### 2. 适配器层 - ChinaStockAdapter

#### 核心功能
```javascript
class ChinaStockAdapter {
  // 市场数据
  - getKlines(symbol, timeframe, limit)
  - getTicker(symbol)
  - getMarketMetrics(symbol)
  
  // 模拟交易（只写入数据库）
  - placeOrder(orderRequest)
  - cancelOrder(orderId)      // 不支持真实取消
  - getOrders(symbol)         // 从数据库读取
  - getAccount()              // 模拟账户
  - getPositions(symbol)      // 从数据库读取
  
  // 市场时间
  - isTradingTime()           // 检查是否在交易时间
}
```

#### 交易时间
```
周一至周五:
- 上午: 09:30 - 11:30
- 下午: 13:00 - 15:00
- 时区: Asia/Shanghai
```

### 3. 数据库设计

#### 表结构

**cn_stock_market_data** - 市场数据
```sql
- ts_code VARCHAR(20)         -- 指数代码
- trade_date DATE             -- 交易日期
- timeframe VARCHAR(10)       -- 时间框架
- open/high/low/close         -- OHLC数据
- volume/amount               -- 成交量/成交额
- pb/pe                       -- 市净率/市盈率
- total_mv/float_mv           -- 总市值/流通市值
```

**cn_stock_simulation_trades** - 模拟交易
```sql
- trade_id VARCHAR(100)      -- 交易ID
- ts_code VARCHAR(20)         -- 指数代码
- strategy_type VARCHAR(50)    -- 策略类型
- entry_time/exit_time       -- 入场/出场时间
- entry_price/exit_price     -- 入场/出场价格
- trade_type                 -- LONG/SHORT
- trade_status               -- OPEN/CLOSED/CANCELLED
- raw_pnl/net_pnl            -- 原始盈亏/净盈亏
```

**cn_stock_backtest_results** - 回测结果
```sql
- strategy_type              -- 策略类型
- index_code                 -- 指数代码
- start_date/end_date        -- 回测日期范围
- total_trades               -- 总交易次数
- win_rate                   -- 胜率
- total_pnl                  -- 总盈亏
- sharpe_ratio               -- 夏普比率
- max_drawdown               -- 最大回撤
```

**cn_stock_indices** - 指数信息
```sql
- ts_code                    -- 指数代码
- index_name                 -- 指数名称
- market                     -- 市场
- index_type                 -- 指数类型
- category                   -- 分类
```

---

## 🔧 API使用方法

### Tushare API配置

#### 1. 获取Token
访问 [Tushare Pro](https://tushare.pro/) 注册并获取Token

#### 2. 配置环境变量
```bash
# .env
TUSHARE_TOKEN=your_tushare_token_here
```

#### 3. 使用示例
```javascript
const { TushareAPI } = require('./src/api/cn-stock-api');

const api = new TushareAPI({
  token: process.env.TUSHARE_TOKEN
});

// 获取沪深300指数数据
const data = await api.getIndexDaily('000300.SH', '20250101', '20250126');

// 获取指数基本信息
const basic = await api.getIndexBasic('000300.SH');

// 获取交易日历
const tradeCal = await api.getTradeCal('20250101', '20250131', 'SSE');
```

---

## 📊 数据格式

### Kline数据结构
```javascript
{
  timestamp: Date,          // 时间戳
  open: number,             // 开盘价
  high: number,             // 最高价
  low: number,              // 最低价
  close: number,            // 收盘价
  volume: number,           // 成交量
  symbol: string,           // 指数代码
  timeframe: string,        // 时间框架
  marketType: 'CN_STOCK'   // 市场类型
}
```

### MarketMetrics数据结构
```javascript
{
  volume: number,           // 成交量
  turnover: number,         // 成交额
  // A股特有
  pb: number,              // 市净率
  pe: number,              // 市盈率
  totalMv: number,        // 总市值
  floatMv: number,        // 流通市值
  financingBalance: number, // 融资余额
  northwardFunds: number    // 北向资金
}
```

---

## 🎯 实施步骤

### 阶段1: API集成 ✅
- [x] 实现TushareAPI类
- [x] 配置环境变量
- [x] 测试API连接

### 阶段2: 适配器实现
- [x] 实现ChinaStockAdapter
- [ ] 实现数据格式转换
- [ ] 实现交易时间检查
- [ ] 实现模拟交易记录

### 阶段3: 数据库
- [x] 设计数据库表结构
- [ ] 创建数据库表
- [ ] 初始化指数数据
- [ ] 测试数据写入

### 阶段4: 策略适配
- [ ] V3策略适配A股指数
- [ ] ICT策略适配A股指数
- [ ] 测试策略信号生成

### 阶段5: 回测引擎
- [ ] 实现A股回测引擎
- [ ] 计算胜率指标
- [ ] 生成回测报告

---

## ⚠️ 注意事项

### 1. 交易限制
- ⛔ **不支持真实交易** - 仅模拟交易记录到数据库
- ✅ **仅指数交易** - 不涉及个股交易
- ✅ **模拟回测** - 用于策略验证和胜率计算

### 2. 数据获取
- 🕐 **交易日限制** - 仅获取交易日数据
- 📊 **数据频率** - 支持日线，分钟数据需要高级权限
- 🔑 **API权限** - 部分高级数据需要积分

### 3. 时区处理
- 📍 所有时间使用 `Asia/Shanghai` 时区
- 🕐 交易时间判断基于中国时间
- 📅 交易日历使用沪市交易所数据

### 4. 指数选择
当前支持的指数：
- 沪深300 (000300.SH) - 大盘蓝筹
- 中证500 (000905.SH) - 中小盘
- 中证1000 (000852.SH) - 小盘
- 深证成指 (399001.SZ) - 深市大盘
- 创业板指 (399006.SZ) - 成长股

---

## 🚀 快速开始

### 1. 安装依赖
```bash
npm install tushare
```

### 2. 配置环境变量
```bash
# .env
TUSHARE_TOKEN=your_token_here
```

### 3. 初始化数据库
```bash
mysql -u root -p < database/cn_stock_schema.sql
```

### 4. 测试适配器
```javascript
const ChinaStockAdapter = require('./src/adapters/ChinaStockAdapter');

const adapter = new ChinaStockAdapter({
  tushare: {
    token: process.env.TUSHARE_TOKEN
  },
  symbols: ['000300.SH', '000905.SH'],
  simulationMode: true
});

// 获取K线数据
const klines = await adapter.getKlines('000300.SH', '1d', 100);

// 获取实时行情
const ticker = await adapter.getTicker('000300.SH');

// 模拟下单
const order = await adapter.placeOrder({
  symbol: '000300.SH',
  side: 'BUY',
  type: 'MARKET',
  quantity: 100
});
```

---

## 📈 后续计划

1. **策略适配** - 将V3和ICT策略适配到A股指数
2. **回测引擎** - 实现A股指数回测功能
3. **数据预加载** - 批量加载历史数据
4. **性能优化** - 缓存策略，减少API调用
5. **监控告警** - 添加市场监控和异常告警

---

**参考文档**: [Tushare Pro 文档](https://tushare.pro/document/2?doc_id=385)

