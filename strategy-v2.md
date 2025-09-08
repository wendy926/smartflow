# 交易策略执行

既有逻辑严谨性，又能增加入场机会的版本

# **🔹 改进版多周期交易策略**

**步骤 1：大周期趋势过滤（日线-天级别）**

目的是只做趋势方向的单子，避免逆势交易。只要价格和短中均线一致，同时趋势强度和波动率扩张确认，就认为有方向性行情。

- 多头趋势：
    - 价格在 MA200 上方
    - MA20 > MA50
    - ADX(14) > 20（说明趋势强度足够）
    - 布林带开口扩张：布林带上轨和下轨间距最近 20 根 K 线逐渐扩大，代表波动率增加，趋势在走强。
- 空头趋势：
    - 价格在 MA200 下方
    - MA20 < MA50
    - ADX(14) > 20
    - 布林带开口扩张：布林带上轨和下轨间距最近 20 根 K 线逐渐扩大，代表波动率增加，趋势在走强。
  
  趋势信号确认条件：
1. 趋势基础条件（必须满足）
    - 价格相对 MA200 的位置（在上方做多 / 下方做空）
    - MA20 / MA50 顺序与趋势方向一致
2. 趋势强度 & 波动率条件（择一即可）
    - ADX(14) > 20 或
    - 布林带开口扩张

**步骤 2：中周期确认（1H） → 多因子打分体系**

我们不要求所有条件都满足，而是给每个条件打分，只要总分达到 2 分及以上 就允许进场。

**打分体系（以下每个条件满足都为1 分，满足一个则加1分）：**

1. VWAP方向一致：收盘价在 VWAP 上方（做多）/下方（做空）。
2. 突破结构：收盘价突破最近 20 根 K 线的最高点/最低点。
3. 成交量确认：当前 K 线成交量 ≥ 1.5 × 20期平均成交量。
4. OI确认：未平仓合约 OI 在 6h 内上涨 ≥ +2%（做多）/下降 ≥ -2%（做空）。
5. 资金费率：资金费率 ≤ 0.15%/8h。
6. Delta确认：买卖盘不平衡（解释见下）。

Delta确认的判断逻辑说明：

- Delta（净主动买卖量） = 主动买单成交量 - 主动卖单成交量。
- 如果 Delta 在突破方向显著放大（如突破时 15m Delta > 过去 20 根平均 Delta 的 2 倍），说明是真实资金推动，而不是假突破。
- 交易所层面：看 CVD（Cumulative Volume Delta 累积买卖盘差）。CVD 向上倾斜 → 买方主动，向下倾斜 → 卖方主动。

**根据打分体系小时级信号大小判断的执行规则：**

- 得分 ≥ 2 分 → 可以进入小周期观察入场机会。
- 得分 ≥ 4 分 → 优先级最高（强信号，允许加仓）。

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

# 天级趋势判断代码逻辑：
```jsx
// 计算布林带带宽序列 (BBW) 并判断是否在扩张
function calculateBBW(closes, period = 20, k = 2) {
  if (closes.length < period) {
    throw new Error("数据长度不足，至少需要等于 period 的K线数据");
  }

  let bbw = [];

  for (let i = period - 1; i < closes.length; i++) {
    // 取最近 N 根收盘价
    const slice = closes.slice(i - period + 1, i + 1);

    // 计算均值 (中轨 MB)
    const mean = slice.reduce((a, b) => a + b, 0) / period;

    // 计算标准差 σ
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    // 上下轨
    const upper = mean + k * stdDev;
    const lower = mean - k * stdDev;

    // 带宽 (BBW)
    const bbwValue = (upper - lower) / mean;
    bbw.push(bbwValue);
  }

  return bbw;
}

// 判断布林带是否处于扩张状态
function isBBWExpanding(closes, period = 20, k = 2) {
  const bbw = calculateBBW(closes, period, k);

  // 最近两个BBW值
  const n = bbw.length;
  if (n < 2) return false;

  // 判断最新BBW是否大于前一个BBW
  return bbw[n - 1] > bbw[n - 2];
}

// ==== 示例 ====
// 假设你从 Binance K线接口拿到收盘价数组
const closes = [100, 102, 101, 103, 104, 106, 105, 107, 108, 110, 111, 112, 113, 115, 116, 118, 120, 121, 119, 122, 124];

console.log("BBW序列:", calculateBBW(closes));
console.log("当前是否扩张:", isBBWExpanding(closes));
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

采用逐仓模式，止损距离，最大杠杆数和最小保证金数计算方式：
- 止损距离X%：
  - 多头：(entrySignal - stopLoss) / entrySignal
  - 空头：(stopLoss - entrySignal) / entrySignal
- 最大损失金额(U)：用户选择的单次交易最大损失金额
    - 最大杠杆数Y：1/(X%+0.5%) 数值向下取整。
    - 保证金Z：M/(Y*X%) 数值向上取整。