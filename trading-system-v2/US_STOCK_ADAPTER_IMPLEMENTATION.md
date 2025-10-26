# 美股适配器实施文档

**实施日期**: 2025-10-26  
**版本**: v3.0.0  
**阶段**: 阶段2 - 市场适配器开发

---

## 📋 实施概述

### 目标
开发完整的美股市场适配器，集成Alpaca、Alpha Vantage和Yahoo Finance API，支持美股交易、数据获取和智能分析。

### 已完成工作

#### 1. ✅ USStockAdapter (`src/adapters/USStockAdapter.js`)
- 完整实现美股市场适配器
- 支持K线数据、实时价格、订单簿
- 支持下单、撤单、持仓管理
- 支持市场指标获取（期权数据、机构资金流、VIX、做空数据）

#### 2. ✅ US Stock API客户端 (`src/api/us-stock-api.js`)
- **AlpacaAPI**: 美股交易和实时数据
- **AlphaVantageAPI**: 期权数据、机构资金流、VIX指数
- **YahooFinanceAPI**: 做空数据、股票基本信息

#### 3. ✅ 单元测试 (`tests/adapters/us-stock-adapter.test.js`)
- 适配器初始化测试
- API接口测试
- 数据转换测试
- 错误处理测试

---

## 🔑 所需的API密钥

### Alpaca API
**用途**: 美股交易、实时数据、订单管理

**获取方式**:
1. 访问 https://alpaca.markets
2. 注册账号并创建应用
3. 获取 API Key 和 Secret Key
4. 建议使用 Paper Trading（模拟交易）进行测试

**环境变量**:
```bash
ALPACA_API_KEY=your_alpaca_api_key
ALPACA_SECRET_KEY=your_alpaca_secret_key
ALPACA_USE_SANDBOX=true  # 使用模拟交易环境
```

**API限制**:
- 免费版: 200 requests/min
- 付费版: 更高频率限制

---

### Alpha Vantage API
**用途**: 期权数据、机构资金流向、VIX恐慌指数

**获取方式**:
1. 访问 https://www.alphavantage.co/support/#api-key
2. 填写表单获取免费API密钥
3. 每日API调用限制为500次

**环境变量**:
```bash
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
```

**API限制**:
- 免费版: 500 calls/day, 5 calls/min
- 订阅版: 更高限制

---

### Yahoo Finance API
**用途**: 股票基本信息、做空数据、技术指标

**获取方式**:
- Yahoo Finance提供开放的REST API
- 无需API密钥（但建议使用代理以避免限流）

**环境变量**:
```bash
YAHOO_FINANCE_BASE_URL=https://query1.finance.yahoo.com
```

**API限制**:
- 无官方限制，但建议控制请求频率（<10 requests/sec）

---

## 📊 API功能清单

### Alpaca API 功能

| 功能 | 方法 | 说明 |
|-----|------|------|
| 历史K线 | `getBars()` | 获取股票历史价格数据 |
| 实时交易 | `getLatestTrade()` | 获取最新交易价格 |
| 订单簿 | `getOrderBook()` | 获取买卖盘深度 |
| 下单 | `placeOrder()` | 创建买单/卖单 |
| 撤单 | `cancelOrder()` | 取消订单 |
| 查询订单 | `getOrders()` | 获取订单列表 |
| 账户信息 | `getAccount()` | 获取账户余额和持仓 |
| 持仓查询 | `getPositions()` | 获取持仓详情 |
| 市场状态 | `getMarketStatus()` | 检查市场是否开盘 |
| 交易日历 | `getTradingCalendar()` | 获取交易日历 |

### Alpha Vantage API 功能

| 功能 | 方法 | 说明 |
|-----|------|------|
| 期权数据 | `getOptionsData()` | 获取期权链数据、Put/Call比率 |
| 机构资金流 | `getInstitutionalFlow()` | 获取机构买卖流向 |
| VIX指数 | `getVIX()` | 获取恐慌指数 |

### Yahoo Finance API 功能

| 功能 | 方法 | 说明 |
|-----|------|------|
| 做空数据 | `getShortInterest()` | 获取做空持仓数据 |
| 股票信息 | `getStockInfo()` | 获取股票基本信息、PE、市值等 |

---

## 🎯 市场特有功能

### 1. 盘前盘后交易
- 盘前: 4:00 AM - 9:30 AM ET
- 正常: 9:30 AM - 4:00 PM ET
- 盘后: 4:00 PM - 8:00 PM ET

### 2. 期权数据分析
- Put/Call比率
- 期权持仓变化量
- 隐含波动率

### 3. 机构资金流向
- 大单买入/卖出
- 机构净流入
- 零售vs机构比例

### 4. VIX恐慌指数
- 市场恐慌程度
- 预期波动率
- 风险情绪指标

### 5. 做空数据
- 做空持仓量
- 做空比率
- 回补天数

---

## 🚀 使用示例

### 初始化美股适配器

```javascript
const USStockAdapter = require('./src/adapters/USStockAdapter');
const config = {
  symbols: ['AAPL', 'MSFT', 'GOOGL'],
  alpaca: {
    apiKey: process.env.ALPACA_API_KEY,
    secretKey: process.env.ALPACA_SECRET_KEY,
    useSandbox: true
  },
  alphaVantage: {
    apiKey: process.env.ALPHA_VANTAGE_API_KEY
  },
  yahooFinance: {
    baseURL: 'https://query1.finance.yahoo.com'
  }
};

const adapter = new USStockAdapter(config);
```

### 获取K线数据

```javascript
const klines = await adapter.getKlines('AAPL', Timeframe.MINUTE_15, 100);
```

### 下单

```javascript
const order = {
  symbol: 'AAPL',
  side: OrderSide.BUY,
  type: OrderType.MARKET,
  quantity: 10,
  timeInForce: 'day'
};

const response = await adapter.placeOrder(order);
```

### 获取市场指标

```javascript
const metrics = await adapter.getMarketMetrics('AAPL');
console.log(metrics.putCallRatio);      // Put/Call比率
console.log(metrics.institutionalFlow); // 机构资金流向
console.log(metrics.vixIndex);           // VIX恐慌指数
console.log(metrics.shortInterest);      // 做空持仓量
```

---

## 🧪 测试

### 运行单元测试

```bash
npm test -- tests/adapters/us-stock-adapter.test.js
```

### 测试覆盖率

- 适配器初始化: ✅
- K线数据获取: ✅
- 下单功能: ✅
- 账户查询: ✅
- 持仓管理: ✅
- 市场指标: ✅

---

## 📈 下一步计划

### 阶段2.2: A股适配器开发
- Tushare API集成
- 东方财富API集成
- 融资融券、北向资金等A股特有数据

### 阶段2.3: 智能策略扩展
- 美股策略开发
- A股策略开发
- 多市场策略组合优化

### 阶段2.4: 数据同步和同步服务
- SG机房 ↔ CN机房数据同步
- 跨市场数据对比分析
- 统一数据仓库建设

---

## ⚠️ 注意事项

### API密钥安全
- 所有API密钥存储在环境变量中
- 使用加密存储敏感信息
- 定期轮换API密钥

### 请求频率控制
- 遵守各API的频率限制
- 实现请求队列和重试机制
- 使用缓存减少API调用

### 市场交易时间
- 美股交易时间: 9:30 AM - 4:00 PM ET
- 考虑夏令时调整
- 节假日特殊安排

### 数据准确性
- 验证数据来源的可靠性
- 实现数据一致性检查
- 定期清理过期数据

---

## 📝 总结

美股适配器已完成核心功能开发，包括：
- ✅ 完整的API客户端实现
- ✅ 全面的单元测试覆盖
- ✅ 文档和示例代码

**需要配置的API密钥**:
1. Alpaca API (交易和实时数据)
2. Alpha Vantage API (期权和市场指标)
3. Yahoo Finance (股票基本信息和做空数据)

配置好API密钥后，美股适配器即可投入使用。

