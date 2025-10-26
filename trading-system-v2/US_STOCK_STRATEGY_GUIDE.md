# 美股策略实施指南

**日期**: 2025-10-26  
**版本**: v3.0.0  
**策略**: V3 + ICT (纯技术分析)

---

## 🎯 策略概述

### 核心原则
**仅使用趋势交易策略，不做聪明钱分析**

- ✅ 只使用V3和ICT策略
- ✅ 纯技术分析，基于价格和成交量
- ❌ 不使用聪明钱检测
- ❌ 不使用大额挂单逻辑
- ❌ 不使用期权链和VIX数据

---

## 📊 策略1: V3 Multi-factor Trend Strategy

### 策略逻辑

#### 1. 多时间框架趋势识别
```javascript
// 4H级别判断大趋势
const trend4H = analyzeTrend(klines4H);

// 1H级别确认中期动量
const momentum1H = analyzeMomentum(klines1H);

// 15m级别精确入场
const entry15m = identifyEntry(klines15m, trend4H, momentum1H);
```

#### 2. 因子确认
- **趋势因子**: EMA200、EMA50交叉
- **动量因子**: RSI、MACD
- **成交量因子**: Volume Profile

#### 3. 入场规则
```javascript
// 做多信号
if (trend4H === 'BULLISH' && 
    momentum1H > 50 && 
    entry15m.signal === 'BUY') {
  const entryPrice = entry15m.price;
  const stopLoss = entryPrice - (entryPrice * 0.02);  // 2%止损
  const takeProfit = entryPrice + (entryPrice * 0.04);  // 4%止盈
  
  createTrade('LONG', entryPrice, stopLoss, takeProfit);
}
```

#### 4. 出场规则
- **止损**: 2% 或 ATR * 2
- **止盈**: 4% 或 R:R 1:2
- **时间止损**: 持仓超过5天强制平仓

---

## 📊 策略2: ICT Order Block Strategy

### 策略逻辑

#### 1. 订单块识别
```javascript
// 识别订单块
const orderBlock = identifyOrderBlock(klines, {
  blockSize: 10,        // 订单块大小
  minVolume: 1000000,   // 最小成交量
  timeframe: '15m'      // 时间框架
});

// 做多订单块（买方订单块）
if (orderBlock.type === 'BUY' && 
    price <= orderBlock.high) {
  entrySignal = 'BUY';
}
```

#### 2. 流动性扫荡
```javascript
// 检测流动性扫荡
const liquidityLevels = identifyLiquidity({
  stops: 'ABOVE_HIGH',  // 上方止损
  range: 50             // 价格区间
});

// 扫荡后入场
if (priceSweptAboveHigh && pricePullback) {
  entrySignal = 'BUY';
}
```

#### 3. 入场规则
```javascript
// ICT做多入场
if (orderBlock.direction === 'UP' && 
    liquiditySwept && 
    priceRetestOrderBlock) {
  
  const entryPrice = orderBlock.retestPrice;
  const stopLoss = orderBlock.low - 0.01;
  const takeProfit = entryPrice + ((entryPrice - stopLoss) * 2);
  
  createTrade('LONG', entryPrice, stopLoss, takeProfit);
}
```

#### 4. 出场规则
- **止损**: 订单块低点下方
- **止盈**: R:R 1:2 或下一个流动性区域
- **订单块失效**: 订单块被突破则止损

---

## 🔄 策略执行流程

### 1. 数据准备

```javascript
// 初始化适配器
const usStockAdapter = new USStockAdapter({
  symbols: ['AAPL', 'MSFT', 'GOOGL'],
  alpaca: {
    apiKey: process.env.ALPACA_API_KEY
  },
  alphaVantage: {
    apiKey: process.env.ALPHA_VANTAGE_API_KEY  // 已提供
  }
});

// 获取多时间框架数据
const klines4H = await usStockAdapter.getKlines('AAPL', '4h', 200);
const klines1H = await usStockAdapter.getKlines('AAPL', '1h', 200);
const klines15m = await usStockAdapter.getKlines('AAPL', '15m', 200);
```

### 2. 策略执行

```javascript
// V3策略
const v3Strategy = new V3Strategy();
const v3Signals = await v3Strategy.execute({
  klines4H,  // 大趋势
  klines1H,  // 中期动量
  klines15m  // 精确入场
});

// ICT策略
const ictStrategy = new ICTStrategy();
const ictSignals = await ictStrategy.execute({
  klines15m,  // 订单块和流动性
  timeframe: '15m'
});
```

### 3. 模拟下单

```javascript
// 合并信号
const allSignals = [...v3Signals, ...ictSignals];

// 模拟下单
for (const signal of allSignals) {
  const simulatedOrder = await usStockAdapter.placeOrder({
    symbol: signal.symbol,
    side: signal.side,
    type: 'MARKET',
    quantity: calculatePositionSize(signal),
    strategy: signal.strategyName
  });
  
  // 记录到数据库
  await recordTradeToDatabase(simulatedOrder);
}
```

### 4. 回测计算

```javascript
// 收盘时计算PnL
for (const trade of openTrades) {
  const currentPrice = await usStockAdapter.getTicker(trade.symbol);
  const pnl = calculatePnL(trade, currentPrice);
  
  // 更新数据库
  await updateTradePnL(trade.orderId, pnl);
}
```

---

## 📈 回测指标

### 1. 基础指标
```javascript
{
  totalTrades: 100,        // 总交易次数
  winningTrades: 65,        // 盈利次数
  losingTrades: 35,         // 亏损次数
  winRate: 65.00,          // 胜率
  totalProfit: 5000.00,     // 总盈利
  totalLoss: -2000.00,     // 总亏损
  netPnl: 3000.00          // 净利润
}
```

### 2. 风险指标
```javascript
{
  maxDrawdown: -800.00,    // 最大回撤
  sharpeRatio: 1.85,       // 夏普比率
  profitFactor: 2.50,      // 盈亏比
  avgWin: 76.92,           // 平均盈利
  avgLoss: -57.14          // 平均亏损
}
```

### 3. 时间指标
```javascript
{
  avgHoldingPeriod: 2.5,   // 平均持仓天数
  maxHoldingPeriod: 5,     // 最长持仓天数
  tradingDays: 252         // 交易天数
}
```

---

## 📋 实施检查清单

### 配置
- [x] Alpha Vantage API密钥已配置
- [ ] 美股市场数据表已创建
- [ ] 模拟交易表已创建
- [ ] 回测结果表已创建

### 策略参数
- [ ] V3策略参数配置（激进/平衡/保守模式）
- [ ] ICT策略参数配置（激进/平衡/保守模式）
- [ ] 止损止盈参数设置
- [ ] 仓位管理规则

### 测试
- [ ] 数据获取测试（AAPL、MSFT）
- [ ] 模拟下单测试
- [ ] 回测计算测试
- [ ] 胜率计算测试

### 部署
- [ ] 策略引擎集成
- [ ] 数据库表创建
- [ ] 回测任务调度
- [ ] 日志和监控

---

## 🎯 策略参数配置示例

### V3策略参数

```javascript
// 激进模式
const aggressiveParams = {
  trend: { emaFast: 10, emaSlow: 20 },
  momentum: { rsiPeriod: 14, rsiOverbought: 70, rsiOversold: 30 },
  stopLoss: 0.015,      // 1.5%止损
  takeProfit: 0.06      // 6%止盈
};

// 平衡模式  
const balancedParams = {
  trend: { emaFast: 12, emaSlow: 26 },
  momentum: { rsiPeriod: 14, rsiOverbought: 75, rsiOversold: 25 },
  stopLoss: 0.02,       // 2%止损
  takeProfit: 0.04      // 4%止盈
};

// 保守模式
const conservativeParams = {
  trend: { emaFast: 15, emaSlow: 30 },
  momentum: { rsiPeriod: 14, rsiOverbought: 80, rsiOversold: 20 },
  stopLoss: 0.025,      // 2.5%止损
  takeProfit: 0.03       // 3%止盈
};
```

### ICT策略参数

```javascript
// 激进模式
const ictAggressiveParams = {
  orderBlockSize: 10,
  liquidityRange: 0.005,     // 0.5%流动性区间
  stopLossATRMultiplier: 1.5,
  takeProfitRatio: 3.0       // R:R 1:3
};

// 平衡模式
const ictBalancedParams = {
  orderBlockSize: 15,
  liquidityRange: 0.008,     // 0.8%流动性区间
  stopLossATRMultiplier: 2.0,
  takeProfitRatio: 2.0       // R:R 1:2
};

// 保守模式
const ictConservativeParams = {
  orderBlockSize: 20,
  liquidityRange: 0.01,      // 1%流动性区间
  stopLossATRMultiplier: 2.5,
  takeProfitRatio: 1.5       // R:R 1:1.5
};
```

---

## ✅ 总结

### 美股策略特点
1. **纯技术分析**: 只使用价格和成交量
2. **趋势交易**: V3和ICT都是趋势策略
3. **模拟交易**: 不上实盘，仅回测验证
4. **数据库记录**: 所有模拟交易记录到MySQL
5. **胜率计算**: 基于历史数据计算PnL和胜率

### 需要的API
- ✅ **Alpha Vantage**: `6XV08K479PGSITYI` - 已提供
- ✅ **Alpaca Market Data**: 可选 - 获取K线数据

### 不使用的功能
- ❌ 聪明钱检测
- ❌ 大额挂单逻辑
- ❌ 期权链分析
- ❌ VIX恐慌指数
- ❌ 机构资金流向

### 下一步
1. 创建数据库表结构
2. 配置策略参数
3. 实施回测逻辑
4. 测试和验证
5. 生成回测报告

