# Alpaca API选择指南

**日期**: 2025-10-26
**参考**: https://alpaca.markets

---

## 📊 Alpaca API产品对比

| API类型 | 用途 | 适用场景 | 是否使用 |
|---------|------|----------|---------|
| **Trading API** | 交易执行、账户管理 | 自动化交易、策略执行 | ✅ **是** |
| **Market Data API** | 实时/历史市场数据 | K线、行情、订单簿 | ✅ **是** |
| **Broker API** | 构建经纪服务平台 | 开发第三方经纪应用 | ❌ **否** |

---

## ✅ 我们使用的API组合

### 1. Trading API (主API)
**Base URL**: `https://api.alpaca.markets` (生产) 或 `https://paper-api.alpaca.markets` (模拟)

**主要功能**:
- ✅ **下单/撤单**: 创建和管理交易订单
- ✅ **账户信息**: 查询账户余额和配置
- ✅ **持仓管理**: 查看持仓和盈亏
- ✅ **订单历史**: 查询历史订单
- ✅ **市场状态**: 检查市场是否开盘

**实现代码**: `src/api/us-stock-api.js` - AlpacaAPI类

**关键方法**:
```javascript
// 下单
placeOrder(orderParams)
// 撤单
cancelOrder(orderId)
// 查询订单
getOrders(symbol)
// 账户信息
getAccount()
// 持仓信息
getPositions(symbol)
// 市场状态
getMarketStatus()
```

### 2. Market Data API (数据API)
**Data URL**: `https://data.alpaca.markets`

**主要功能**:
- ✅ **历史K线**: 获取历史价格数据
- ✅ **实时交易**: 获取最新交易价格
- ✅ **订单簿**: 获取买卖盘深度
- ✅ **实时报价**: 获取实时报价数据

**实现代码**: `src/api/us-stock-api.js` - AlpacaAPI类

**关键方法**:
```javascript
// 历史K线
getBars(symbol, timeframe, limit)
// 最新交易
getLatestTrade(symbol)
// 订单簿
getOrderBook(symbol)
```

---

## 📝 为什么选择这个组合？

### Trading API的优势
1. **完整交易功能**: 支持所有交易操作
2. **免费佣金**: 免佣金交易（符合条件）
3. **模拟环境**: 提供Paper Trading测试
4. **RESTful设计**: 易于集成
5. **FINRA/SIPC成员**: 资金安全有保障

### Market Data API的优势
1. **实时数据**: 低延迟市场数据
2. **历史数据**: 丰富的历史K线数据
3. **多时间框架**: 支持1m到1d的所有时间框架
4. **免费Plan**: 基础数据免费提供

### Broker API为什么不选？
- **用途不同**: Broker API用于开发经纪服务，提供账户开设、客户管理等
- **过度复杂**: 我们的系统不需要经纪服务功能
- **合规要求**: Broker API需要更多合规审批

---

## 🎯 我们的API使用方案

### 配置示例

```javascript
// .env配置
ALPACA_API_KEY=your_trading_api_key
ALPACA_SECRET_KEY=your_trading_api_secret
ALPACA_USE_SANDBOX=true  # 使用Paper Trading环境

// Market Data无需额外配置，使用Trading API的密钥即可
```

### 使用场景

#### 1. 交易执行 (Trading API)
```javascript
// 下单
const order = {
  symbol: 'AAPL',
  qty: 10,
  side: 'buy',
  type: 'market',
  time_in_force: 'day'
};

await alpacaAPI.placeOrder(order);
```

#### 2. 获取K线 (Market Data API)
```javascript
// 获取15分钟K线
const bars = await alpacaAPI.getBars('AAPL', '15Min', 100);
```

#### 3. 账户管理 (Trading API)
```javascript
// 获取账户信息
const account = await alpacaAPI.getAccount();
console.log(account.buying_power);
```

---

## 🔑 API密钥获取

### 步骤
1. **注册账号**: https://alpaca.markets
2. **创建API密钥**: Dashboard → Your API Keys
3. **选择环境**: Paper Trading (测试) 或 Live Trading (生产)
4. **获取密钥**: API Key 和 Secret Key
5. **配置环境变量**: 添加到.env文件

### API密钥特点
- **模拟环境**: Paper Trading完全免费，不影响实际账户
- **生产环境**: 需要真实资金和账户验证
- **双密钥**: 一个Trading API密钥可用于Trading和Market Data

---

## 📚 参考文档

### Trading API
- **文档**: https://alpaca.markets/docs/trading-api/
- **参考**: https://alpaca.markets/docs/api-documentation/api-v2/
- **端点**: 订单、账户、持仓等

### Market Data API
- **文档**: https://alpaca.markets/docs/market-data-api/
- **参考**: https://alpaca.markets/docs/api-documentation/market-data-api/
- **端点**: K线、行情、订单簿等

### 示例代码
- **Python SDK**: https://github.com/alpacahq/alpaca-trade-api-python
- **Node.js**: https://github.com/alpacahq/alpaca-trade-api-js

---

## ⚠️ 注意事项

### 环境选择
- **开发阶段**: 使用Paper Trading (模拟交易)
- **生产阶段**: 使用Live Trading (真实交易)
- **切换环境**: 修改baseURL即可

### API限制
- **免费版**:
  - Trading API: 200 requests/min
  - Market Data: 实时数据免费
- **付费版**:
  - 更高的请求频率
  - 更多高级功能

### 安全建议
1. **使用环境变量**: 不要在代码中硬编码API密钥
2. **不同环境**: 测试和生产使用不同的API密钥
3. **定期轮换**: 定期更新API密钥
4. **IP限制**: 在Alpaca仪表板中设置IP白名单

---

## 🎉 总结

### 我们的选择
- ✅ **Trading API**: 用于交易执行和账户管理
- ✅ **Market Data API**: 用于获取市场数据
- ❌ **Broker API**: 不适用于我们的场景

### 优势
1. **简单易用**: API设计清晰，文档完善
2. **功能完整**: 满足所有交易和数据需求
3. **免费测试**: Paper Trading完全免费
4. **安全可靠**: FINRA/SIPC保护资金安全
5. **社区支持**: 活跃的开发者社区

### 下一步
1. 注册Alpaca账号
2. 创建API密钥
3. 配置到环境变量
4. 测试连接和功能
5. 开始使用美股适配器

