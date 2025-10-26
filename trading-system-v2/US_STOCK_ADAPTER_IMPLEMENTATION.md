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

### Market Data API (市场数据)
**用途**: 获取美股历史K线数据和实时行情

**获取方式**:
1. 访问 https://alpaca.markets
2. 注册账号（无需金融认证）
3. 获取 API Key
4. **注意**: 仅用于数据获取，不进行真实交易

**环境变量**:
```bash
ALPACA_API_KEY=your_alpaca_api_key  # 可选，如需历史数据
ALPACA_USE_SANDBOX=true
```

**说明**: 由于只做回测和模拟交易，无需Trading API的Secret Key

### Alpha Vantage API (已提供)
**用途**: 期权数据、机构资金流、VIX指数

**环境变量**:
```bash
ALPHA_VANTAGE_API_KEY=6XV08K479PGSITYI
```

**API限制**: 500 calls/day, 5 calls/min

---

## 💾 模拟交易和回测架构

### 数据流程
1. **获取市场数据**: 使用Market Data API和Alpha Vantage获取K线和市场指标
2. **策略分析**: 运行交易策略，产生交易信号
3. **模拟下单**: 不调用真实API，直接生成订单
4. **记录数据库**: 将模拟订单存储到MySQL数据库
5. **回测计算**: 基于历史数据模拟执行，计算PnL和胜率

### 数据库表设计
```sql
-- 模拟交易记录
CREATE TABLE IF NOT EXISTS us_stock_trades (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    symbol VARCHAR(20) NOT NULL,
    side ENUM('BUY', 'SELL') NOT NULL,
    type ENUM('MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT') NOT NULL,
    quantity DECIMAL(18, 8) NOT NULL,
    price DECIMAL(18, 8),
    stop_price DECIMAL(18, 8),
    status ENUM('PENDING', 'FILLED', 'CANCELLED', 'REJECTED') NOT NULL,
    filled_quantity DECIMAL(18, 8),
    avg_fill_price DECIMAL(18, 8),
    pnl DECIMAL(18, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    filled_at TIMESTAMP NULL,
    INDEX idx_symbol (symbol),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- 回测结果
CREATE TABLE IF NOT EXISTS us_stock_backtest_results (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    strategy_name VARCHAR(50) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_trades INT NOT NULL,
    winning_trades INT NOT NULL,
    losing_trades INT NOT NULL,
    win_rate DECIMAL(5, 2),
    total_profit DECIMAL(18, 8),
    total_loss DECIMAL(18, 8),
    net_pnl DECIMAL(18, 8),
    max_drawdown DECIMAL(18, 8),
    sharpe_ratio DECIMAL(10, 4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_strategy (strategy_name),
    INDEX idx_symbol (symbol)
);
```

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

