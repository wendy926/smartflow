# 交易策略执行

既有逻辑严谨性，又能增加入场机会的版本

# **🔹 改进版多周期交易策略**

**步骤 1：大周期趋势过滤（日线-天级别）**

目的是只做趋势方向的单子，避免逆势交易。只要价格和短中均线一致，同时趋势强度和波动率扩张确认，就认为有方向性行情。

- 多头趋势：
    - 价格在 MA20 上方
    - MA20 > MA50 > MA200
    - ADX(14) > 20（说明趋势强度足够）
    - 布林带开口扩张：布林带上轨和下轨间距最近 20 根 K 线逐渐扩大，代表波动率增加，趋势在走强。
- 空头趋势：
    - 价格在 MA20 下方
    - MA20 < MA50 < MA200
    - ADX(14) > 20
    - 布林带开口扩张：布林带上轨和下轨间距最近 20 根 K 线逐渐扩大，代表波动率增加，趋势在走强。
  
  趋势信号确认条件：
1. 趋势基础条件（必须满足）
    - 价格相对 MA20 的位置（在上方做多 / 下方做空）
    - MA20 / MA50 /MA200 顺序与趋势方向一致
2. 趋势强度 & 波动率条件（择一即可）
    - ADX(14) > 20 或
    - 布林带开口扩张
输出：trend4h = "多头" | "空头" | "震荡"

**步骤 2：中周期确认（1H） → 多因子打分体系**

要求必须满足VWAP方向一致，并且给每个条件打分，只要总分达到 3 分及以上 就允许进场。

**打分体系（以下每个条件满足都为1 分，满足一个则加1分）：**

1. VWAP方向一致：（必须满足）
  - 多头：收盘价 > VWAP
  - 空头：收盘价 < VWAP
2. 突破结构：
  - 多头：收盘价突破最近 20 根 4H K线高点
  - 空头：收盘价跌破最近 20 根 4H K线低点
3. 成交量确认：
  - 15m 成交量 ≥ 1.5 × 20期均量
  - 1h 成交量 ≥ 1.2 × 20期均量
4. OI确认：
  - 多头：6h OI ≥ +2%
  - 空头：6h OI ≤ -3%
5. 资金费率：0.05% ≤ Funding Rate ≤ +0.05%
6. Delta确认：买卖盘不平衡（解释见下）。
  - 多头：主动买盘 ≥ 卖盘 × 1.2
  - 空头：主动卖盘 ≥ 买盘 × 1.2

Delta确认的判断逻辑说明：
- Delta（净主动买卖量） = 主动买单成交量 - 主动卖单成交量。
- 如果 Delta 在突破方向显著放大（如突破时 15m Delta > 过去 20 根平均 Delta 的 2 倍），说明是真实资金推动，而不是假突破。
- 交易所层面：看 CVD（Cumulative Volume Delta 累积买卖盘差）。CVD 向上倾斜 → 买方主动，向下倾斜 → 卖方主动。

**根据打分体系小时级信号大小判断的执行规则：**

- VWAP方向一致：（必须满足）
- 得分 ≥ 3 分。

**步骤 3：小周期执行（15m） → 入场与风控**

**🟢 多头模式（趋势跟随型）**

- 入场逻辑：回踩EMA20/50 或 前高/前低支撑 → setup candle突破确认。
- 止盈：≥ 2R（可分批出场）。
- 止损：setup candle 另一端 或 ATR1.2×。
- 特点：持仓周期可以更久，因为上涨趋势延续性强。

**🔴 空头模式（动能短线型）**

- 入场逻辑：强趋势确认后，15m 或 5m 出现 放量跌破前低 → 直接做空。
- 止盈：1.2R ~ 1.5R 就平大部分仓位，剩余用移动止损跟踪。
- 止损：setup candle 高点 或 ATR1.2×。
- 特点：强调“快进快出”，不吃长波段，避免空头反抽。

# **🔹 执行流程简述**

1. 看大周期（1D）：
    - 确认趋势方向（价格 vs MA200 + MA20/50 顺序 + ADX>20 + 布林带开口扩张）。
    - 确定只做多 or 只做空。
2. 看中周期（1H）：
    - 依次检查 6 个条件（VWAP / 突破 / 成交量 / OI / 资金费率 / Delta）。
    - 每满足一个 +1 分，≥2 分才进入 15m 观察。
3. 看小周期（15m）：
    - 如果行情给回踩，按 回踩模式 入场。
    - 如果突破时伴随成交量 & OI 放大，按 动能模式 追单。
4. 风险控制：
    - 止损 = setup candle 另一端 或 ATR × 1.2，取更远。
    - 止盈 = 分批：1.5R 平一半，剩余跟踪止损。

**ADX(14) 的计算逻辑**

基于 K线数据自己算：/fapi/v1/klines（获取 high, low, close）

1. 计算 True Range (TR)

TR = max(high - low, abs(high - previous_close), abs(low - previous_close))

2. 计算方向移动 DM+ / DM-

DM+ = high - previous_high (若 >0 且 > (previous_low - low)，否则 0)

DM- = previous_low - low (若 >0 且 > (high - previous_high)，否则 0)

3. 平滑处理 (14 周期)
用 Wilder’s smoothing（类似EMA）：

TR14 = TR14_prev - (TR14_prev / 14) + TR

DM+14 = DM+14_prev - (DM+14_prev / 14) + DM+

DM-14 = DM-14_prev - (DM-14_prev / 14) + DM-

4. 计算方向指标 DI+ / DI-

DI+ = 100 * (DM+14 / TR14)

DI- = 100 * (DM-14 / TR14)

5. 计算 DX

DX = 100 * abs(DI+ - DI-) / (DI+ + DI-)

6. 平滑得到 ADX

ADX = (前一ADX * 13 + DX) / 14



# 4小时趋势判断代码逻辑：
```jsx
/**
 * 计算简单移动平均 (SMA)
 */
function sma(values, period) {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

/**
 * 计算真实波动范围 (TR)
 */
function trueRange(high, low, prevClose) {
  return Math.max(
    high - low,
    Math.abs(high - prevClose),
    Math.abs(low - prevClose)
  );
}

/**
 * 计算 ADX(14)
 */
function calculateADX(klines, period = 14) {
  if (klines.length < period + 1) return null;

  let trs = [];
  let dmPlus = [];
  let dmMinus = [];

  for (let i = 1; i < klines.length; i++) {
    const [ , , high, low, close ] = klines[i].map(Number);
    const [ , , prevHigh, prevLow, prevClose ] = klines[i - 1].map(Number);

    const tr = trueRange(high, low, prevClose);
    trs.push(tr);

    const upMove = high - prevHigh;
    const downMove = prevLow - low;

    dmPlus.push(upMove > downMove && upMove > 0 ? upMove : 0);
    dmMinus.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  const atr = sma(trs, period);
  const avgDMPlus = sma(dmPlus, period);
  const avgDMMinus = sma(dmMinus, period);

  if (!atr || atr === 0) return null;

  const diPlus = (100 * avgDMPlus) / atr;
  const diMinus = (100 * avgDMMinus) / atr;
  const dx = (100 * Math.abs(diPlus - diMinus)) / (diPlus + diMinus);

  return dx; // 简化版，可扩展为平滑ADX
}

/**
 * 计算布林带带宽
 */
function bollingerBandwidth(closes, period = 20, k = 2) {
  if (closes.length < period) return null;

  const ma = sma(closes, period);
  const slice = closes.slice(-period);
  const variance = slice.reduce((sum, p) => sum + Math.pow(p - ma, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  const upper = ma + k * stdDev;
  const lower = ma - k * stdDev;

  return (upper - lower) / ma; // 带宽相对值
}

/**
 * 主趋势判断逻辑 (4H)
 */
function getTrend4h(klines) {
  const closes = klines.map(k => parseFloat(k[4]));

  const ma20 = sma(closes, 20);
  const ma50 = sma(closes, 50);
  const ma200 = sma(closes, 200);
  const lastClose = closes[closes.length - 1];

  const adx = calculateADX(klines, 14);
  const bbWidth = bollingerBandwidth(closes, 20);

  // 过滤条件
  const adxOk = adx && adx > 20;
  const bbOk = bbWidth && bbWidth > 0.05; // 经验阈值，可调

  if (ma20 && ma50 && ma200 && adxOk && bbOk) {
    if (ma20 > ma50 && ma50 > ma200 && lastClose > ma20) {
      return "多头";
    }
    if (ma20 < ma50 && ma50 < ma200 && lastClose < ma20) {
      return "空头";
    }
  }

  return "震荡";
}

// ==== 使用示例 ====
// 假设从 Binance FAPI /fapi/v1/klines 获取 4h 数据
(async () => {
  const sampleKlines = [
    // [openTime, open, high, low, close, volume, ...]
    [1690000000000, "30000", "30100", "29900", "30050", "120.5"],
    [1690014400000, "30050", "30200", "29950", "30100", "150.8"],
    [1690028800000, "30100", "30250", "30000", "30200", "200.3"],
    // ... 至少200根数据
  ];

  const trend = getTrend4h(sampleKlines);
  console.log("4H趋势判断:", trend);
})();
```

# 小时级别趋势加强判断代码逻辑
```jsx
import fetch from "node-fetch";

// === 获取K线数据 ===
async function fetchKlines(symbol = "BTCUSDT", interval = "1h", limit = 50) {
  const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const response = await fetch(url);
  const data = await response.json();
  return data.map(k => ({
    time: k[0],
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

// === 获取未平仓合约 OI ===
async function fetchOI(symbol = "BTCUSDT") {
  const url = `https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`;
  const data = await fetch(url).then(res => res.json());
  return parseFloat(data.openInterest);
}

// === 获取资金费率 ===
async function fetchFundingRate(symbol = "BTCUSDT") {
  const url = `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=1`;
  const data = await fetch(url).then(res => res.json());
  return parseFloat(data[0].fundingRate);
}

// === 计算VWAP ===
function calculateVWAP(klines) {
  let cumulativePV = 0;
  let cumulativeVolume = 0;
  klines.forEach(k => {
    const typicalPrice = (k.high + k.low + k.close) / 3;
    cumulativePV += typicalPrice * k.volume;
    cumulativeVolume += k.volume;
  });
  return cumulativePV / cumulativeVolume;
}

// === 计算突破结构 ===
function isBreakout(klines) {
  const lastClose = klines[klines.length - 1].close;
  const last20 = klines.slice(-21, -1); // 最近20根
  const high20 = Math.max(...last20.map(k => k.high));
  const low20 = Math.min(...last20.map(k => k.low));
  return {
    breakoutLong: lastClose > high20,
    breakoutShort: lastClose < low20
  };
}

// === 计算成交量确认 ===
function isVolumeConfirmed(klines, multiplier = 1.5) {
  const lastClose = klines[klines.length - 1];
  const avgVol = klines.slice(-21, -1).reduce((a, k) => a + k.volume, 0) / 20;
  return lastClose.volume >= avgVol * multiplier;
}

// === Delta（简化） ===
function isDeltaPositive(klines, threshold = 1.0) {
  // 用高低价与收盘价差模拟主动买卖强度
  const last = klines[klines.length - 1];
  const delta = (last.close - last.open); // 收-开 简化代替真实CVD
  return delta > 0; // 大于0 认为买方占优
}

// === 计算趋势强度打分 ===
async function calculateTrendScore(symbol, trend) {
  const klines = await fetchKlines(symbol, "1h", 50);

  let score = 0;

  // VWAP方向
  const vwap = calculateVWAP(klines);
  const lastClose = klines[klines.length - 1].close;
  if ((trend === "多头趋势" && lastClose > vwap) ||
      (trend === "空头趋势" && lastClose < vwap)) {
    score += 1;
  }

  // 突破结构
  const breakout = isBreakout(klines);
  if ((trend === "多头趋势" && breakout.breakoutLong) ||
      (trend === "空头趋势" && breakout.breakoutShort)) {
    score += 1;
  }

  // 成交量确认
  if (isVolumeConfirmed(klines)) score += 1;

  // OI确认
  const oi = await fetchOI(symbol);
  // 假设6h内变化±2%判断
  if (trend === "多头趋势" && oi > 1.02 * oi) score += 1;
  if (trend === "空头趋势" && oi < 0.98 * oi) score += 1;

  // 资金费率
  const funding = await fetchFundingRate(symbol);
  if (Math.abs(funding) <= 0.0015) score += 1;

  // Delta确认
  if ((trend === "多头趋势" && isDeltaPositive(klines)) ||
      (trend === "空头趋势" && !isDeltaPositive(klines))) {
    score += 1;
  }

  // 最终判断
  let action = "观望/不做";
  if (score >= 4) {
    action = trend === "多头趋势" ? "做多" : "做空";
  }

  return {
    symbol,
    trend,
    score,
    action
  };
}

// === 示例运行 ===
(async () => {
  const symbol = "BTCUSDT";
  // 这里假设之前趋势JS返回的结果
  const trend = "多头趋势"; // 可以替换成你之前趋势判断的返回值

  const result = await calculateTrendScore(symbol, trend);
  console.log("=== 趋势强度打分 ===");
  console.log("交易对:", result.symbol);
  console.log("趋势:", result.trend);
  console.log("总分:", result.score);
  console.log("操作建议:", result.action);
})();
```
## 小时级别打分计算逻辑
```jsx
/**
 * 4小时级别多因子打分系统
 * 
 * VWAP 必须方向一致，否则直接返回 0 分
 * 其他因子每满足一个 +1
 * 
 * @param {Object} params
 * @param {string} params.trend4h - 4小时趋势 ("多头" | "空头" | "震荡")
 * @param {number} params.close - 最新收盘价
 * @param {number} params.vwap - 当前 VWAP 值
 * @param {number} params.breakoutLevel - 关键突破价位（比如20根4H高点/低点）
 * @param {number} params.volume15m - 最新15m成交量
 * @param {number} params.avgVolume15m - 过去20期15m均量
 * @param {number} params.volume1h - 最新1h成交量
 * @param {number} params.avgVolume1h - 过去20期1h均量
 * @param {number} params.oiChange6h - 最近6小时OI变动百分比 (如 0.025 = +2.5%)
 * @param {number} params.fundingRate - 当前资金费率 (每8h)
 * @param {number} params.deltaBuy - 主动买盘成交量
 * @param {number} params.deltaSell - 主动卖盘成交量
 * 
 * @returns {Object} { score, allowLong, allowShort }
 */
function scoreFactors4h({
  trend4h,
  close,
  vwap,
  breakoutLevel,
  volume15m,
  avgVolume15m,
  volume1h,
  avgVolume1h,
  oiChange6h,
  fundingRate,
  deltaBuy,
  deltaSell
}) {
  let score = 0;
  let allowLong = false;
  let allowShort = false;

  // 1. VWAP 必须方向一致
  if (trend4h === "多头" && close <= vwap) return { score: 0, allowLong, allowShort };
  if (trend4h === "空头" && close >= vwap) return { score: 0, allowLong, allowShort };

  // 2. 突破条件 (4h关键位突破)
  if (trend4h === "多头" && close > breakoutLevel) score++;
  if (trend4h === "空头" && close < breakoutLevel) score++;

  // 3. 成交量双确认 (15m + 1h)
  if (volume15m >= 1.5 * avgVolume15m && volume1h >= 1.2 * avgVolume1h) {
    score++;
  }

  // 4. OI变化
  if (trend4h === "多头" && oiChange6h >= 0.02) score++; // ≥+2%
  if (trend4h === "空头" && oiChange6h <= -0.03) score++; // ≤-3%

  // 5. 资金费率合理
  if (fundingRate >= -0.0005 && fundingRate <= 0.0005) {
    score++;
  }

  // 6. Delta/主动买卖盘不平衡
  if (trend4h === "多头" && deltaBuy >= 1.2 * deltaSell) score++;
  if (trend4h === "空头" && deltaSell >= 1.2 * deltaBuy) score++;

  // 判断是否允许开仓
  if (trend4h === "多头" && score >= 3) allowLong = true;
  if (trend4h === "空头" && score >= 3) allowShort = true;

  return { score, allowLong, allowShort };
}

// ==== 示例调用 ====
const result = scoreFactors4h({
  trend4h: "多头",
  close: 102,
  vwap: 101,
  breakoutLevel: 100,
  volume15m: 1500,
  avgVolume15m: 900,
  volume1h: 6000,
  avgVolume1h: 4500,
  oiChange6h: 0.025, // +2.5%
  fundingRate: 0.0002, // 0.02%/8h
  deltaBuy: 1200,
  deltaSell: 800
});

console.log(result);
/**
 输出示例:
 {
   score: 5,
   allowLong: true,
   allowShort: false
 }
 */
```
## delta计算逻辑
```jsx
// deltaOrderflow.js
const WebSocket = require("ws");

class DeltaOrderflow {
  constructor(symbol = "btcusdt") {
    this.symbol = symbol.toLowerCase();
    this.deltaBuy = 0;
    this.deltaSell = 0;
    this.orderbook = { bids: [], asks: [] };

    // 连接 aggTrade WebSocket
    this.wsTrade = new WebSocket(
      `wss://fstream.binance.com/ws/${this.symbol}@aggTrade`
    );

    this.wsTrade.on("message", (msg) => {
      const data = JSON.parse(msg);
      this.handleAggTrade(data);
    });

    // 连接 orderbook WebSocket
    this.wsDepth = new WebSocket(
      `wss://fstream.binance.com/ws/${this.symbol}@depth20@100ms`
    );

    this.wsDepth.on("message", (msg) => {
      const data = JSON.parse(msg);
      this.handleDepth(data);
    });
  }

  // 处理逐笔成交
  handleAggTrade(trade) {
    const qty = parseFloat(trade.q);
    if (trade.m === false) {
      // 买方主动（taker 是买）
      this.deltaBuy += qty;
    } else {
      // 卖方主动（taker 是卖）
      this.deltaSell += qty;
    }
  }

  // 处理订单簿快照
  handleDepth(data) {
    this.orderbook = {
      bids: data.b.map(([price, qty]) => ({
        price: parseFloat(price),
        qty: parseFloat(qty),
      })),
      asks: data.a.map(([price, qty]) => ({
        price: parseFloat(price),
        qty: parseFloat(qty),
      })),
    };
  }

  // 获取买卖盘不平衡 (主动成交)
  getDeltaImbalance() {
    if (this.deltaSell === 0) return Infinity;
    return this.deltaBuy / this.deltaSell;
  }

  // 获取订单簿挂单不平衡
  getOrderbookImbalance() {
    const bidSum = this.orderbook.bids.reduce((s, b) => s + b.qty, 0);
    const askSum = this.orderbook.asks.reduce((s, a) => s + a.qty, 0);
    if (askSum === 0) return Infinity;
    return bidSum / askSum;
  }

  // 定期重置（避免数据无限累积）
  resetDelta() {
    this.deltaBuy = 0;
    this.deltaSell = 0;
  }
}

// ==== 使用示例 ====
const deltaFlow = new DeltaOrderflow("btcusdt");

// 每 10 秒输出一次数据
setInterval(() => {
  console.log("主动买卖盘统计:");
  console.log("deltaBuy:", deltaFlow.deltaBuy.toFixed(2));
  console.log("deltaSell:", deltaFlow.deltaSell.toFixed(2));
  console.log("成交不平衡 (Buy/Sell):", deltaFlow.getDeltaImbalance().toFixed(2));
  console.log("挂单不平衡 (Bid/Ask):", deltaFlow.getOrderbookImbalance().toFixed(2));
  console.log("----");

  // 重置，避免无限累积
  deltaFlow.resetDelta();
}, 10000);
```

# 15分钟级别入场判断代码逻辑
```jsx
/**
 * 15分钟级别入场信号判断
 * @param {Object} params
 * @param {string} params.dailyTrend - 日线趋势结果 ("多头" | "空头" | "震荡")
 * @param {string} params.hourlyConfirm - 小时级别确认结果 ("看多" | "看空" | "无信号")
 * @param {Array} params.klines15m - 15m K线数组 [{open, high, low, close, volume}]
 * @param {Array} params.ema20 - EMA20 数组
 * @param {Array} params.ema50 - EMA50 数组
 * @param {number} params.atr14 - 最新 ATR14 值
 * @param {number} params.oiChange6h - 最近6h OI 变动百分比（如 +0.025 = +2.5%）
 */
function calculateEntry15m({ 
  dailyTrend, 
  hourlyConfirm, 
  klines15m, 
  ema20, 
  ema50, 
  atr14, 
  oiChange6h 
}) {
  const last = klines15m[klines15m.length - 1];
  const prev = klines15m[klines15m.length - 2]; // setup candle
  const lastClose = last.close;
  const lastHigh = last.high;
  const lastLow = last.low;
  const setupHigh = prev.high;
  const setupLow = prev.low;

  let entrySignal = null;
  let stopLoss = null;
  let takeProfit = null;
  let stopLossPct = null;
  let mode = null;

  // === 过滤条件 ===
  // 必须日线趋势和小时级确认一致，才考虑入场
  if ((dailyTrend === "多头" && hourlyConfirm !== "看多") ||
      (dailyTrend === "空头" && hourlyConfirm !== "看空")) {
    return { entrySignal, stopLoss, takeProfit, stopLossPct, mode };
  }

  // === 多头模式 ===
  if (dailyTrend === "多头" && oiChange6h >= 0.02) {
    const supportLevel = Math.min(
      ema20[ema20.length - 1],
      ema50[ema50.length - 1]
    );

    // 回踩 EMA20/50 上方并突破 setup candle 高点
    if (lastClose >= supportLevel && lastHigh > setupHigh) {
      entrySignal = lastHigh;
      stopLoss = Math.min(setupLow, lastClose - 1.2 * atr14);
      takeProfit = entrySignal + 2 * (entrySignal - stopLoss);
      stopLossPct = ((entrySignal - stopLoss) / entrySignal) * 100;
      mode = "多头回踩突破";
    }
  }

  // === 空头模式 ===
  if (dailyTrend === "空头" && oiChange6h <= -0.02) {
    const resistanceLevel = Math.max(
      ema20[ema20.length - 1],
      ema50[ema50.length - 1]
    );

    // 反抽 EMA20/50 下方并跌破 setup candle 低点
    if (lastClose <= resistanceLevel && lastLow < setupLow) {
      entrySignal = lastLow;
      stopLoss = Math.max(setupHigh, lastClose + 1.2 * atr14);
      takeProfit = entrySignal - 2 * (stopLoss - entrySignal);
      stopLossPct = ((stopLoss - entrySignal) / entrySignal) * 100;
      mode = "空头反抽破位";
    }
  }

  return { entrySignal, stopLoss, takeProfit, stopLossPct, mode };
}

// ==== 示例调用 ====
const klines15m = [
  {open: 100, high: 102, low: 99, close: 101, volume: 10},
  {open: 101, high: 103, low: 100, close: 102, volume: 12},
  {open: 102, high: 104, low: 101, close: 103, volume: 15},
];

const ema20 = [100, 101, 102];
const ema50 = [99, 100, 101];
const atr14 = 1.5;

const result = calculateEntry15m({
  dailyTrend: "多头",
  hourlyConfirm: "看多",
  klines15m,
  ema20,
  ema50,
  atr14,
  oiChange6h: 0.03  // OI +3%
});

console.log(result);

/**
输出示例:
{
  entrySignal: 103,
  stopLoss: 100,
  takeProfit: 106,
  stopLossPct: 2.91,
  mode: "多头回踩突破"
}
*/
```

# 止损出场逻辑
```jsx
/**
 * 出场判断（包含时间止损）
 * @param {Object} params
 * @param {string} params.position - "long" 或 "short"
 * @param {number} params.entryPrice - 入场价格
 * @param {Object} params.setupCandle - 入场K线 { high, low, close }
 * @param {number} params.atr14 - ATR(14) 最新值
 * @param {number} params.currentPrice - 当前价格
 * @param {number} params.score1h - 1H 多因子打分
 * @param {string} params.trend4h - 当前4H趋势 ("多头" | "空头" | "震荡")
 * @param {number} params.deltaBuy - 当前主动买盘量
 * @param {number} params.deltaSell - 当前主动卖盘量
 * @param {number} params.ema20 - EMA20 当前值
 * @param {number} params.ema50 - EMA50 当前值
 * @param {number} params.prevHigh - 近期前高
 * @param {number} params.prevLow - 近期前低
 * @param {number} params.timeInPosition - 已持仓时间，单位：15m K线数
 * @param {number} params.maxTimeInPosition - 最大允许持仓时间，单位：15m K线数
 * @returns {Object} { exit: boolean, reason: string, exitPrice: number }
 */
function checkExit(params) {
  const {
    position,
    entryPrice,
    setupCandle,
    atr14,
    currentPrice,
    score1h,
    trend4h,
    deltaBuy,
    deltaSell,
    ema20,
    ema50,
    prevHigh,
    prevLow,
    timeInPosition,
    maxTimeInPosition
  } = params;

  let stopLoss, takeProfit;

  // 止损计算
  if (position === "long") {
    stopLoss = Math.min(setupCandle.low, entryPrice - 1.2 * atr14);
    takeProfit = entryPrice + 2 * (entryPrice - stopLoss);
  } else {
    stopLoss = Math.max(setupCandle.high, entryPrice + 1.2 * atr14);
    takeProfit = entryPrice - 2 * (stopLoss - entryPrice);
  }

  // 1️⃣ 止损触发
  if ((position === "long" && currentPrice <= stopLoss) ||
      (position === "short" && currentPrice >= stopLoss)) {
    return { exit: true, reason: "止损触发", exitPrice: stopLoss };
  }

  // 2️⃣ 止盈触发
  if ((position === "long" && currentPrice >= takeProfit) ||
      (position === "short" && currentPrice <= takeProfit)) {
    return { exit: true, reason: "止盈触发", exitPrice: takeProfit };
  }

  // 3️⃣ 趋势反转
  if ((position === "long" && (trend4h !== "多头" || score1h < 3)) ||
      (position === "short" && (trend4h !== "空头" || score1h < 3))) {
    return { exit: true, reason: "趋势或多因子反转", exitPrice: currentPrice };
  }

  // 4️⃣ Delta / 买卖盘减弱
  if ((position === "long" && deltaBuy / (deltaSell || 1) < 1.1) ||
      (position === "short" && deltaSell / (deltaBuy || 1) < 1.1)) {
    return { exit: true, reason: "Delta / 主动买卖盘减弱", exitPrice: currentPrice };
  }

  // 5️⃣ 价格跌破关键支撑 / 突破关键阻力
  if ((position === "long" && (currentPrice < ema20 || currentPrice < ema50 || currentPrice < prevLow)) ||
      (position === "short" && (currentPrice > ema20 || currentPrice > ema50 || currentPrice > prevHigh))) {
    return { exit: true, reason: "跌破支撑或突破阻力", exitPrice: currentPrice };
  }

  // 6️⃣ 时间止损
  if (timeInPosition >= maxTimeInPosition) {
    return { exit: true, reason: "超时止损", exitPrice: currentPrice };
  }

  // 否则继续持仓
  return { exit: false, reason: "", exitPrice: null };
}

// ==== 使用示例 ====
const exitSignal = checkExit({
  position: "long",
  entryPrice: 100,
  setupCandle: { high: 102, low: 99, close: 101 },
  atr14: 1.5,
  currentPrice: 101.2,
  score1h: 4,
  trend4h: "多头",
  deltaBuy: 1200,
  deltaSell: 900,
  ema20: 101.5,
  ema50: 100.8,
  prevHigh: 103,
  prevLow: 99.5,
  timeInPosition: 13,   // 已持仓13根15m K线
  maxTimeInPosition: 12 // 最大允许12根15m K线
});

console.log(exitSignal);
/**
 输出示例:
 {
   exit: true,
   reason: "超时止损",
   exitPrice: 101.2
 }
*/
```

# 数据刷新频率：
| **时间框架** | **刷新频率** | **理由** |
| --- | --- | --- |
| 4H 趋势 | 每 1 小时 | 足够稳定，减少API压力 |
| 1H 打分 | 每 5 分钟 | 提前捕捉突破和VWAP偏移 |
| 15m 入场 | 每 1~3 分钟 | 精确捕捉setup突破 |
| Delta/盘口 | 实时（WebSocket） | 否则失去意义 |


采用逐仓模式，止损距离，最大杠杆数和最小保证金数计算方式：
- 止损距离X%：
  - 多头：(entrySignal - stopLoss) / entrySignal
  - 空头：(stopLoss - entrySignal) / entrySignal
- 最大损失金额(U)：用户选择的单次交易最大损失金额
    - 最大杠杆数Y：1/(X%+0.5%) 数值向下取整。
    - 保证金Z：M/(Y*X%) 数值向上取整。