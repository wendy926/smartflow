# 交易策略对比分析

## 策略V3 - 趋势交易策略

### 时间框架设计
- **4H趋势过滤**：判断大方向（多头/空头/震荡）
- **1H趋势确认**：多因子打分机制验证趋势有效性
- **15m入场执行**：精确择时，设置止盈止损

### 关键指标
- **4H级别**：MA20、MA50、MA200、ADX(14)、BBW（布林带宽度）
- **1H级别**：VWAP、成交量、OI变化、资金费率、Delta买卖盘不平衡
- **15m级别**：EMA20、EMA50、ATR14、布林带宽

### 趋势判断逻辑

#### 4H趋势判断（满分10分）
1. **趋势方向**（必选，每个方向至少2分）
   - 多头：收盘价>MA20 + MA20>MA50 + MA50>MA200
   - 空头：收盘价<MA20 + MA20<MA50 + MA50<MA200
   - 不满足则判定为震荡

2. **其他因子**（每项1分）
   - 趋势稳定性：连续≥2根4H K线满足趋势方向
   - 趋势强度：ADX(14)>20且DI方向正确
   - 布林带扩张：最近10根K线后5根BBW均值>前5根均值×1.05
   - 动量确认：当前K线收盘价离MA20距离≥0.5%

3. **判断标准**：得分≥4分保留趋势，<4分输出震荡

#### 1H多因子确认（score≥3才有效）
1. **VWAP方向一致**（必须满足）
2. **突破确认**：收盘价突破/跌破最近20根4H K线高低点
3. **成交量双确认**：15m成交量≥1.5×20期均量 + 1h成交量≥1.2×20期均量
4. **OI变化**：多头6h OI≥+2%，空头6h OI≤-3%
5. **资金费率**：-0.05%≤Funding Rate≤+0.05%
6. **Delta不平衡**：主动买盘≥卖盘×1.2（多头），主动卖盘≥买盘×1.2（空头）

### 入场逻辑

#### 趋势市15m入场
- **多头**：VWAP方向正确 + 多因子得分≥2 + 回踩EMA20/50支撑 + 突破setup candle高点
- **空头**：VWAP方向正确 + 多因子得分≥2 + 反抽EMA20/50阻力 + 跌破setup candle低点

#### 震荡市15m入场（假突破）
- **条件**：15分钟布林带宽收窄 + 1H边界有效 + 前一根突破边界+当前回撤区间
- **多头假突破**：prevClose<rangeLow且lastClose>rangeLow且下轨有效
- **空头假突破**：prevClose>rangeHigh且lastClose<rangeHigh且上轨有效

### 止盈止损逻辑

#### 止损设置
- **趋势市**：setup candle另一端或1.2×ATR(14)，取更远者
- **震荡市**：结构性止损（跌破/突破1H边界±ATR）

#### 止盈设置
- **固定RR**：风险回报比1:2
- **时间止损**：持仓超过3小时自动止盈或止损
- **多因子止损**：VWAP、Delta、OI、Volume因子得分≤-2时触发

---

## ICT策略 - 订单块交易策略

### 时间框架设计
- **1D高时间框架**：判断市场整体趋势方向
- **4H中时间框架**：识别并评分订单块(OB)和失衡区(FVG)
- **15m低时间框架**：精确入场点、止损、目标位

### 关键指标
- **1D级别**：收盘价比较（20根日线）
- **4H级别**：ATR(4H)、订单块高度、年龄、Sweep速率
- **15m级别**：ATR(15m)、吞没形态、成交量、Sweep微观速率

### 趋势判断逻辑

#### 1D趋势判断
- **上升趋势**：最近20根日线收盘价末值>首值
- **下降趋势**：最近20根日线收盘价末值<首值
- **震荡趋势**：否则忽略信号

#### 4H订单块检测
- **OB高度过滤**：≥0.25×ATR(4H)
- **OB年龄过滤**：≤30天
- **Sweep宏观速率确认**：关键swing高/低在≤2根4H内被刺破并收回，刺破幅度÷bar数≥0.4×ATR(4H)

### 入场逻辑

#### 15m入场确认条件
1. **OB/FVG年龄**：≤2天
2. **吞没形态**：后一根15m K线实体≥前一根1.5倍，且方向与趋势一致
3. **Sweep微观速率**：sweep发生在≤3根15m内收回，sweep幅度÷bar数≥0.2×ATR(15m)
4. **成交量放大**（可选加强过滤）

### 止盈止损逻辑

#### 止损设置
- **上升趋势**：OB下沿-1.5×ATR(4H)，或最近3根4H的最低点
- **下降趋势**：OB上沿+1.5×ATR(4H)，或最近3根4H的最高点

#### 止盈设置
- **固定盈亏比**：RR=3:1
- **分批出场**：可分批止盈和移动止损

#### 仓位计算
- **风险资金**：Equity×风险比例（如1%）
- **单位数**：风险资金÷止损距离
- **保证金**：Notional÷杠杆

---

## 两个策略的主要区别

### 核心理念差异
1. **策略V3**：基于技术指标的多因子打分系统，适用于趋势市和震荡市
2. **ICT策略**：基于订单块和流动性概念的供需分析，更注重市场微观结构

### 时间框架差异
3. **V3策略**：时间框架更细（4H→1H→15m），因子更全面
4. **ICT策略**：时间框架更粗（1D→4H→15m），更注重结构分析

### 适用场景
5. **V3策略**：适合量化交易，指标明确，逻辑清晰
6. **ICT策略**：适合手动交易，需要更多主观判断，但更贴近市场本质

### 风险控制
7. **V3策略**：多因子动态止损，更灵活
8. **ICT策略**：基于结构止损，更稳定

两个策略都强调多时间框架分析，但V3更偏向量化指标，ICT更偏向市场结构分析。在实际应用中，可以根据市场环境和个人交易风格选择合适的策略。

---

## Binance API 调用映射

### 策略V3所需API调用

#### REST API调用

**1. K线数据获取**
```javascript
// 4H K线数据 (趋势过滤)
GET /fapi/v1/klines?symbol={symbol}&interval=4h&limit=250

// 1H K线数据 (多因子确认)  
GET /fapi/v1/klines?symbol={symbol}&interval=1h&limit=50

// 15m K线数据 (入场执行)
GET /fapi/v1/klines?symbol={symbol}&interval=15m&limit=50
```

**2. 资金费率**
```javascript
// 获取当前资金费率
GET /fapi/v1/premiumIndex?symbol={symbol}
```

**3. 持仓量历史**
```javascript
// 获取6小时OI变化数据
GET /fapi/v1/openInterestHist?symbol={symbol}&period=1h&limit=6
```

**4. 24小时价格统计**
```javascript
// 获取VWAP相关数据
GET /fapi/v1/ticker/24hr?symbol={symbol}
```

#### WebSocket API调用

**1. Delta数据 (买卖盘不平衡)**
```javascript
// 实时交易数据流
wss://fstream.binance.com/ws/{symbol}@aggTrade

// 伪代码实现
function calculateDelta(aggTradeData) {
  let buyVolume = 0, sellVolume = 0;
  
  for (const trade of aggTradeData) {
    if (trade.maker) {
      // maker=true表示买方被动成交→主动卖单
      sellVolume += parseFloat(trade.q);
    } else {
      // maker=false表示卖方被动成交→主动买单  
      buyVolume += parseFloat(trade.q);
    }
  }
  
  const totalVolume = buyVolume + sellVolume;
  return totalVolume > 0 ? (buyVolume - sellVolume) / totalVolume : 0;
}
```

### ICT策略所需API调用

#### REST API调用

**1. K线数据获取**
```javascript
// 1D K线数据 (趋势判断)
GET /fapi/v1/klines?symbol={symbol}&interval=1d&limit=25

// 4H K线数据 (订单块检测)
GET /fapi/v1/klines?symbol={symbol}&interval=4h&limit=20

// 15m K线数据 (入场确认)
GET /fapi/v1/klines?symbol={symbol}&interval=15m&limit=50
```

**2. 交易对信息**
```javascript
// 验证交易对可用性
GET /fapi/v1/exchangeInfo
```

#### WebSocket API调用

**1. 实时价格数据**
```javascript
// 实时价格流
wss://fstream.binance.com/ws/{symbol}@ticker
```

---

## 关键指标计算逻辑

### 策略V3指标计算

#### 4H级别指标

**1. 移动平均线 (MA)**
```javascript
// 伪代码
function calculateMA(prices, period) {
  const ma = [];
  for (let i = period - 1; i < prices.length; i++) {
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    ma.push(sum / period);
  }
  return ma;
}

// 调用示例
const ma20 = calculateMA(closes, 20);
const ma50 = calculateMA(closes, 50); 
const ma200 = calculateMA(closes, 200);
```

**2. ADX指标**
```javascript
// 伪代码
function calculateADX(highs, lows, closes, period = 14) {
  // 1. 计算TR (真实波幅)
  const tr = calculateTR(highs, lows, closes);
  
  // 2. 计算DM+和DM-
  const { dmPlus, dmMinus } = calculateDM(highs, lows);
  
  // 3. 平滑处理
  const smTR = smoothArray(tr, period);
  const smDmPlus = smoothArray(dmPlus, period);
  const smDmMinus = smoothArray(dmMinus, period);
  
  // 4. 计算DI+和DI-
  const diPlus = smDmPlus.map((v, i) => 100 * v / smTR[i]);
  const diMinus = smDmMinus.map((v, i) => 100 * v / smTR[i]);
  
  // 5. 计算DX
  const dx = diPlus.map((v, i) => 100 * Math.abs(v - diMinus[i]) / (v + diMinus[i]));
  
  // 6. 计算ADX (DX的EMA)
  const adx = calculateEMA(dx, period);
  
  return {
    adx: adx[adx.length - 1],
    diPlus: diPlus[diPlus.length - 1],
    diMinus: diMinus[diMinus.length - 1]
  };
}
```

**3. 布林带宽度 (BBW)**
```javascript
// 伪代码
function calculateBBW(prices, period = 20, multiplier = 2) {
  const sma = calculateSMA(prices, period);
  const variance = prices.slice(-period).reduce((sum, p) => 
    sum + Math.pow(p - sma[sma.length - 1], 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  
  const upper = sma[sma.length - 1] + multiplier * stdDev;
  const lower = sma[sma.length - 1] - multiplier * stdDev;
  
  return (upper - lower) / sma[sma.length - 1];
}
```

#### 1H级别指标

**1. VWAP计算**
```javascript
// 伪代码
function calculateVWAP(klines) {
  let pvSum = 0, vSum = 0;
  
  for (const k of klines) {
    const typicalPrice = (k.high + k.low + k.close) / 3;
    pvSum += typicalPrice * k.volume;
    vSum += k.volume;
  }
  
  return vSum > 0 ? pvSum / vSum : null;
}
```

**2. OI变化率**
```javascript
// 伪代码
function calculateOIChange(oiHistory) {
  if (oiHistory.length < 2) return 0;
  
  const currentOI = oiHistory[oiHistory.length - 1].sumOpenInterest;
  const pastOI = oiHistory[0].sumOpenInterest;
  
  return (currentOI - pastOI) / pastOI;
}
```

#### 15m级别指标

**1. EMA计算**
```javascript
// 伪代码
function calculateEMA(prices, period) {
  const k = 2 / (period + 1);
  const ema = [prices[0]];
  
  for (let i = 1; i < prices.length; i++) {
    ema[i] = prices[i] * k + ema[i - 1] * (1 - k);
  }
  
  return ema;
}
```

**2. ATR计算**
```javascript
// 伪代码
function calculateATR(highs, lows, closes, period = 14) {
  const tr = calculateTR(highs, lows, closes);
  return calculateEMA(tr, period);
}
```

### ICT策略指标计算

#### 1D级别指标

**1. 趋势判断**
```javascript
// 伪代码
function detectTrend1D(klines1d, lookback = 20) {
  const closes = klines1d.map(k => k.close);
  const recent = closes.slice(-lookback);
  
  if (recent[recent.length - 1] > recent[0]) return "up";
  if (recent[recent.length - 1] < recent[0]) return "down";
  return "sideways";
}
```

#### 4H级别指标

**1. 订单块检测**
```javascript
// 伪代码
function detectOrderBlocks(klines4h, atr4h, maxAgeDays = 30) {
  const obCandidates = [];
  
  for (let i = klines4h.length - 10; i < klines4h.length - 1; i++) {
    const kline = klines4h[i];
    const obHeight = kline.high - kline.low;
    
    // 过滤条件：高度≥0.25×ATR，年龄≤30天
    if (obHeight >= 0.25 * atr4h) {
      const ageDays = (Date.now() - kline.openTime) / (1000 * 3600 * 24);
      if (ageDays <= maxAgeDays) {
        obCandidates.push({
          low: kline.low,
          high: kline.high,
          time: kline.openTime,
          age: ageDays
        });
      }
    }
  }
  
  return obCandidates;
}
```

**2. Sweep宏观速率检测**
```javascript
// 伪代码
function detectSweepHTF(extreme, bars, atr4h) {
  const exceed = bars[0].high - extreme;
  let barsToReturn = 0;
  
  for (let i = 1; i < bars.length; i++) {
    barsToReturn++;
    if (bars[i].close < extreme) break;
  }
  
  const sweepSpeed = exceed / barsToReturn;
  return sweepSpeed >= 0.4 * atr4h && barsToReturn <= 2;
}
```

#### 15m级别指标

**1. 吞没形态检测**
```javascript
// 伪代码
function isEngulfingPattern(prevCandle, currCandle, atr15, trend = "up") {
  const prevBody = Math.abs(prevCandle.close - prevCandle.open);
  const currBody = Math.abs(currCandle.close - currCandle.open);
  
  // 实体大小检查
  if (currBody < 0.6 * atr15) return false;
  if (currBody < 1.5 * prevBody) return false;
  
  // 方向检查
  if (trend === "up") {
    return currCandle.close > prevCandle.open && 
           currCandle.open < prevCandle.close;
  } else {
    return currCandle.close < prevCandle.open && 
           currCandle.open > prevCandle.close;
  }
}
```

**2. Sweep微观速率检测**
```javascript
// 伪代码
function detectSweepLTF(extreme, bars, atr15) {
  const exceed = bars[0].high - extreme;
  let barsToReturn = 0;
  
  for (let i = 1; i < bars.length; i++) {
    barsToReturn++;
    if (bars[i].close < extreme) break;
  }
  
  const sweepSpeed = exceed / barsToReturn;
  return sweepSpeed >= 0.2 * atr15 && barsToReturn <= 3;
}
```

---

## 数据刷新频率建议

| 时间框架 | 刷新频率 | 理由 |
|---------|---------|------|
| 4H 趋势 | 每 1 小时 | 足够稳定，减少API压力 |
| 1H 打分 | 每 5 分钟 | 提前捕捉突破和VWAP偏移 |
| 15m 入场 | 每 1~3 分钟 | 精确捕捉setup突破 |
| Delta/盘口 | 实时（WebSocket） | 否则失去意义 |
| 1D 趋势 | 每 4 小时 | 日线变化缓慢 |
| 4H 订单块 | 每 30 分钟 | 订单块相对稳定 |


# 最大杠杆和最小保证金计算方式
采用逐仓模式，止损距离，最大杠杆数和最小保证金数计算方式：
- 止损距离X%：
  - 多头：(entrySignal - stopLoss) / entrySignal
  - 空头：(stopLoss - entrySignal) / entrySignal
- 最大损失金额(U)：用户选择的单次交易最大损失金额
    - 最大杠杆数Y：1/(X%+0.5%) 数值向下取整。
    - 保证金Z：M/(Y*X%) 数值向上取整。
