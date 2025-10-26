# 模拟交易和回测架构设计

**日期**: 2025-10-26  
**版本**: v3.0.0  
**状态**: ✅ 模拟交易模式

---

## 🎯 架构概述

### 核心理念
**只做模拟交易，不做真实交易**

- ✅ 获取真实市场数据
- ✅ 运行真实交易策略
- ✅ 模拟下单并记录到数据库
- ✅ 基于历史数据回测
- ✅ 计算PnL和胜率
- ❌ 不进行任何真实交易

---

## 💾 数据流程

```
1. 获取市场数据 (Market Data API + Alpha Vantage)
   ↓
2. 运行交易策略 (Strategy Engine)
   ↓
3. 生成交易信号 (Trading Signal)
   ↓
4. 模拟下单 (Simulated Order)
   ↓
5. 记录数据库 (MySQL)
   ↓
6. 回测计算 (PnL, Win Rate, Sharpe)
```

---

## 🔑 API配置（已优化）

### 只需要的API

#### 1. Alpha Vantage API ✅ **已配置**
- **API Key**: `6XV08K479PGSITYI`
- **用途**: 期权数据、机构资金流、VIX指数
- **限制**: 500 calls/day, 5 calls/min

#### 2. Alpaca Market Data API (可选)
- **用途**: K线数据、实时价格
- **可选**: 如需更丰富的历史数据
- **说明**: 不使用Trading API，仅数据获取

---

## 📊 数据库设计

### 1. 模拟交易记录表

```sql
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
    
    -- PnL计算
    entry_price DECIMAL(18, 8),
    exit_price DECIMAL(18, 8),
    realized_pnl DECIMAL(18, 8),
    
    -- 元数据
    order_id VARCHAR(50),
    strategy_name VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    filled_at TIMESTAMP NULL,
    closed_at TIMESTAMP NULL,
    
    INDEX idx_symbol (symbol),
    INDEX idx_status (status),
    INDEX idx_strategy (strategy_name),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2. 回测结果表

```sql
CREATE TABLE IF NOT EXISTS us_stock_backtest_results (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    strategy_name VARCHAR(50) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- 交易统计
    total_trades INT NOT NULL,
    winning_trades INT NOT NULL,
    losing_trades INT NOT NULL,
    win_rate DECIMAL(5, 2) NOT NULL,
    
    -- 盈亏统计
    total_profit DECIMAL(18, 8),
    total_loss DECIMAL(18, 8),
    net_pnl DECIMAL(18, 8) NOT NULL,
    
    -- 风险指标
    max_drawdown DECIMAL(18, 8),
    sharpe_ratio DECIMAL(10, 4),
    profit_factor DECIMAL(10, 4),
    
    -- 平均指标
    avg_win DECIMAL(18, 8),
    avg_loss DECIMAL(18, 8),
    avg_holding_period INT,  -- 平均持仓时间（天）
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_strategy (strategy_name),
    INDEX idx_symbol (symbol),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 3. 市场数据表

```sql
CREATE TABLE IF NOT EXISTS us_stock_market_data (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    symbol VARCHAR(20) NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    open DECIMAL(18, 8) NOT NULL,
    high DECIMAL(18, 8) NOT NULL,
    low DECIMAL(18, 8) NOT NULL,
    close DECIMAL(18, 8) NOT NULL,
    volume BIGINT NOT NULL,
    
    UNIQUE KEY uk_symbol_timeframe_timestamp (symbol, timeframe, timestamp),
    INDEX idx_symbol (symbol),
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 🔄 模拟交易流程

### 1. 获取市场数据

```javascript
// 从Alpha Vantage获取市场指标
const metrics = await adapter.getMarketMetrics('AAPL');
const putCallRatio = metrics.putCallRatio;  // Put/Call比率
const vixIndex = metrics.vixIndex;          // VIX恐慌指数
const institutionalFlow = metrics.institutionalFlow;  // 机构资金流
```

### 2. 运行策略分析

```javascript
// 使用现有策略引擎
const strategyEngine = new StrategyEngine(database, parameterManager, signalProcessor);
const signals = await strategyEngine.analyzeMarketData('AAPL', marketData);
```

### 3. 模拟下单

```javascript
// 不调用真实API，直接模拟
const order = {
  symbol: 'AAPL',
  side: OrderSide.BUY,
  type: OrderType.MARKET,
  quantity: 10,
  strategy: 'US_V3_STRATEGY'
};

// 模拟订单响应
const simulatedOrder = await adapter.placeOrder(order);
// 返回: { orderId, status: 'FILLED', filledQuantity, avgPrice }
```

### 4. 记录数据库

```javascript
// 保存到us_stock_trades表
await database.query(`
  INSERT INTO us_stock_trades 
  (order_id, symbol, side, type, quantity, price, status, filled_quantity, avg_fill_price, strategy_name)
  VALUES (?, ?, ?, ?, ?, ?, 'FILLED', ?, ?, ?)
`, [
  order.orderId,
  order.symbol,
  order.side,
  order.type,
  order.quantity,
  order.price,
  order.quantity,
  order.price,
  'US_V3_STRATEGY'
]);
```

### 5. 回测计算

```javascript
// 基于历史数据计算PnL
const backtestResult = await calculateBacktest({
  trades: simulatedTrades,
  startDate: '2024-01-01',
  endDate: '2025-10-26',
  strategy: 'US_V3_STRATEGY'
});

// 保存回测结果
await database.query(`
  INSERT INTO us_stock_backtest_results
  (strategy_name, symbol, start_date, end_date, total_trades, winning_trades, 
   losing_trades, win_rate, net_pnl, sharpe_ratio)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`, [
  'US_V3_STRATEGY',
  'AAPL',
  '2024-01-01',
  '2025-10-26',
  backtestResult.totalTrades,
  backtestResult.winningTrades,
  backtestResult.losingTrades,
  backtestResult.winRate,
  backtestResult.netPnl,
  backtestResult.sharpeRatio
]);
```

---

## 📈 胜率计算逻辑

### PnL计算

```javascript
function calculatePnL(trade) {
  const entryPrice = trade.avg_fill_price;
  const exitPrice = currentMarketPrice;
  const quantity = trade.filled_quantity;
  
  if (trade.side === 'BUY') {
    // 做多盈亏
    const pnl = (exitPrice - entryPrice) * quantity;
    return pnl;
  } else {
    // 做空盈亏（美股支持做空）
    const pnl = (entryPrice - exitPrice) * quantity;
    return pnl;
  }
}
```

### 胜率计算

```javascript
function calculateWinRate(trades) {
  const totalTrades = trades.length;
  const winningTrades = trades.filter(trade => 
    calculatePnL(trade) > 0
  ).length;
  
  const winRate = (winningTrades / totalTrades) * 100;
  
  return {
    totalTrades,
    winningTrades,
    losingTrades: totalTrades - winningTrades,
    winRate: winRate.toFixed(2)
  };
}
```

### 风险指标

```javascript
function calculateMetrics(trades) {
  const pnlArray = trades.map(trade => calculatePnL(trade));
  
  const totalProfit = pnlArray.filter(pnl => pnl > 0).reduce((sum, pnl) => sum + pnl, 0);
  const totalLoss = Math.abs(pnlArray.filter(pnl => pnl < 0).reduce((sum, pnl) => sum + pnl, 0));
  
  const netPnl = pnlArray.reduce((sum, pnl) => sum + pnl, 0);
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : 0;
  
  // Sharpe Ratio
  const avgReturn = pnlArray.reduce((sum, pnl) => sum + pnl, 0) / pnlArray.length;
  const variance = pnlArray.reduce((sum, pnl) => sum + Math.pow(pnl - avgReturn, 2), 0) / pnlArray.length;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;
  
  return { netPnl, profitFactor, sharpeRatio };
}
```

---

## 🎯 与现有系统集成

### 适配Binance的聪明钱逻辑

现有的加密货币聪明钱检测逻辑（大额挂单、散户资金流向等）同样适用于美股：

1. **期权链数据**: 类似于币圈的资金费率，反映市场情绪
2. **机构资金流**: 类似于聪明钱，大单买入卖出
3. **做空数据**: 类似于空头持仓，反映市场看空情绪
4. **VIX指数**: 类似于币圈的恐慌指数

### 策略复用

现有的V3策略和ICT策略可以直接适配美股：

```javascript
// 原有策略引擎
const strategyEngine = new StrategyEngine(database, parameterManager);

// 美股适配器
const usStockAdapter = new USStockAdapter(config);

// 使用统一接口
const signals = await strategyEngine.analyze({
  symbol: 'AAPL',
  marketData: usStockKlines,
  marketMetrics: usStockMetrics,  // 美股特有指标
  adapter: usStockAdapter
});
```

---

## ✅ 总结

### 核心特点
1. **只做模拟**: 不进行真实交易
2. **真实数据**: 使用真实市场数据
3. **策略复用**: 复用现有交易策略
4. **数据记录**: 所有模拟交易记录到数据库
5. **回测支持**: 完整支持回测和胜率计算

### 已配置
- ✅ Alpha Vantage API Key
- ✅ 模拟交易下单逻辑
- ✅ 数据库表结构
- ✅ PnL和胜率计算

### 待实施
- ⏳ 创建数据库表
- ⏳ 集成到策略引擎
- ⏳ 添加回测计算模块
- ⏳ 美股策略参数配置

