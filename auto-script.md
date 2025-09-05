# smartflow-auto script

**需求总结**

1. 默认逻辑
    - 用 成交量 + OI 替代 CVD，作为小时级别入场确认的一部分；
2. WebSocket 实时 CVD 计算（备用）
    - 订阅 aggTrade 流，按买卖方向累积成交量；
    - 生成 累计净主动买量 - 卖量（CVD）；
    - 小时确认时可选择启用/忽略 CVD；
3. 人工输入 CVD（兜底）
    - 如果 WebSocket 出现断流，允许人工给出 CVD 值（正/负），脚本逻辑仍能继续运行。

# **Node.js 升级版脚本**

**安装依赖**

```powershell
npm init -y
npm install csv-writer
npm install axios technicalindicators ws readline-sync
npm install csv-writer technicalindicators axios ws readline-sync
```

**工作机制**

- 趋势过滤（1D）：只要 MA20/50/200 排列不明确 → 不交易；
- 小时确认（1H）：成交量放量、VWAP、OI、Funding、CVD 综合；
- CVD优先级：
    - 有 WS → 自动用实时成交流算；
    - WS 挂了 → 提示人工输入 +（买盘主导）或 -（卖盘主导）；
- 输出结果：当信号成立时，提示你切到 15m 执行步骤 并给出盈亏比设定。

### **1. 数据源选择（Binance API）**

你要做的是 杠杆合约交易（有 OI、资金费率），所以必须用 币安期货 REST API。

原因：

- 现货没有持仓量（OI）、资金费率（Funding Rate）数据；
- 永续合约（USDT-M Futures API）提供了：
    - K 线数据（/fapi/v1/klines）
    - 持仓量 OI（/futures/data/openInterestHist）
    - 资金费率（/fapi/v1/fundingRate）

👉 所以我们选 Binance Futures REST API。

### **2. 策略逻辑梳理**

根据前面完整系统，拆成自动化脚本 3 层：

**A. 日线趋势确认（过滤方向）**

指标：MA20 / MA50 / MA200

- 多头：MA20 > MA50 > MA200 且收盘 > MA20
- 空头：MA20 < MA50 < MA200 且收盘 < MA20
- 其余：RANGE，不做交易

**B. 小时级别确认入场信号**

指标组合：

1. VWAP：收盘价 > VWAP（做多），收盘价 < VWAP（做空）
    - （VWAP = ∑(典型价×成交量)/∑成交量）
2. 
3. 成交量放量：最新成交量 ≥ 1.5 × 20H 平均成交量
4. OI（持仓量）：过去 6H 变动 ≥ +2%（做多）或 ≤ -2%（做空）
5. 资金费率：|Funding| ≤ 0.1%（不过热）
6. 突破条件：收盘价突破最近 20 根小时高点/低点

满足所有 → 触发潜在入场信号

**C. 15m 执行时机 + 盈亏比设定**

当 B 条件满足时：

1. 执行规则（做多示例）：
    - 等待回踩 EMA20/50 或前高支撑缩量企稳
    - 触发条件：15m K 线突破 setup candle 高点
    - 止损：setup candle 低点 或 1.2×ATR(14)（取更远）
2. 盈亏比
    - 止盈目标 ≥ 2R
    - 管理：+1R 移动止损到保本；+1.5R 部分止盈；+2R 启动追踪止盈（15m ATR×1.5）

### **3. 脚本设计（Node.js）**

功能：

- 每隔 5 分钟运行一次
- 获取日线 K 线 → 计算趋势（过滤方向）
- 获取 1H K 线 + OI + Funding → 判断是否触发入场信号
- 若触发 → 自动获取 15m K 线，计算执行时机 + 止损 + 盈亏比方案
- 控制台输出「执行信号」

### **4. 数据缺口说明**

- VWAP：币安 API 没有直接提供，要用 K 线数据自己计算
- OI（持仓量）：币安 Futures 提供，但只能查历史逐日或逐小时，精度够用
- 资金费率：有 API 可以获取，没问题
- CVD（主动买卖成交量差）：币安 REST API 没有，需要 WebSocket 的逐笔成交流才能算（实时交易量的买卖方向差）。
👉 建议先忽略 CVD，用「成交量+OI」替代；如果必须用，我可以帮你接入 WebSocket 做实时计算。

## **功能总结**

1. 默认监控品种：BTCUSDT、ETHUSDT、LINKUSDT、LDOUSDT（永续合约）。
2. 数据收集：日线趋势 (MA20/50/200)、1H 确认 (VWAP, 成交量, OI, Funding, CVD)。
3. 15m 执行时机模拟：
    - 找出“setup candle”（触发前一根 K）
    - 模拟突破挂单：setupK 高点/低点
    - 止损：setupK 另一端 or 1.2×ATR(14)
    - 止盈：2R 目标
    - 日志里存：setupHigh、setupLow、stopLoss、targetPrice
4. 日志 CSV：每个周期追加一行，覆盖所有品种。
    1. 新增 csv-writer 库，把分析结果写入 CSV；
    2. 每次运行 analyze() 时，都会追加一条记录：
        - 时间戳
        - 币种
        - 日线趋势
        - 小时确认条件（成交量、VWAP、OI变化、Funding、CVD）
        - 信号结果（多头/空头/无信号）

# **完整脚本（multi-symbol + 15m 执行时机）**

```jsx
const axios = require("axios");
const ti = require("technicalindicators");
const WebSocket = require("ws");
const readlineSync = require("readline-sync");
const { createObjectCsvWriter } = require("csv-writer");

const REST = "https://fapi.binance.com"; 
const WS_BASE = "wss://fstream.binance.com/ws"; 

// 默认监控品种
const symbols = ["BTCUSDT", "ETHUSDT", "LINKUSDT", "LDOUSDT"];

let liveCVD = {};
let useWS_CVD = {};

// CSV 日志
const csvWriter = createObjectCsvWriter({
  path: "trade_log.csv",
  append: true,
  header: [
    { id: "time", title: "Time" },
    { id: "symbol", title: "Symbol" },
    { id: "trend", title: "DailyTrend" },
    { id: "closeH", title: "Close_1H" },
    { id: "vwap", title: "VWAP" },
    { id: "volume", title: "Volume" },
    { id: "avgVol", title: "AvgVol20H" },
    { id: "oiChange", title: "OI_6H(%)" },
    { id: "funding", title: "Funding" },
    { id: "cvd", title: "CVD" },
    { id: "signal", title: "Signal" },
    { id: "setupHigh", title: "SetupHigh" },
    { id: "setupLow", title: "SetupLow" },
    { id: "stopLoss", title: "StopLoss" },
    { id: "targetPrice", title: "TargetPrice" }
  ]
});

// 工具函数
async function getKlines(symbol, interval, limit = 500) {
  const url = `${REST}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const { data } = await axios.get(url);
  return data.map(k => ({
    time: k[0],
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

function calcMA(values, period) {
  return ti.SMA.calculate({ period, values });
}

function calcVWAP(candles) {
  let cumulativePV = 0, cumulativeVol = 0;
  return candles.map(c => {
    const typical = (c.high + c.low + c.close) / 3;
    cumulativePV += typical * c.volume;
    cumulativeVol += c.volume;
    return cumulativePV / cumulativeVol;
  });
}

async function getOpenInterestHist(symbol, period = "1h", limit = 24) {
  const url = `${REST}/futures/data/openInterestHist?symbol=${symbol}&period=${period}&limit=${limit}`;
  const { data } = await axios.get(url);
  return data.map(d => ({
    time: d.timestamp,
    oi: parseFloat(d.sumOpenInterest),
  }));
}

async function getFundingRate(symbol, limit = 1) {
  const url = `${REST}/fapi/v1/fundingRate?symbol=${symbol}&limit=${limit}`;
  const { data } = await axios.get(url);
  return parseFloat(data[0].fundingRate);
}

// WebSocket CVD计算
function startCVD_WS(symbol = "btcusdt") {
  liveCVD[symbol] = 0;
  useWS_CVD[symbol] = true;
  const ws = new WebSocket(`${WS_BASE}/${symbol.toLowerCase()}@aggTrade`);

  ws.on("message", msg => {
    const trade = JSON.parse(msg);
    const qty = parseFloat(trade.q);
    if (trade.m) {
      liveCVD[symbol] -= qty;
    } else {
      liveCVD[symbol] += qty;
    }
  });

  ws.on("open", () => console.log(`✅ WebSocket CVD 已连接: ${symbol}`));
  ws.on("close", () => {
    console.log(`⚠️ WebSocket 断开: ${symbol}`);
    useWS_CVD[symbol] = false;
  });
}

// ATR 计算
function calcATR(candles, period = 14) {
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const closes = candles.map(c => c.close);
  const atr = ti.ATR.calculate({ high: highs, low: lows, close: closes, period });
  return atr;
}

// 主分析流程
async function analyze(symbol = "BTCUSDT") {
  const now = new Date().toISOString();

  // ===== 日线趋势 =====
  const daily = await getKlines(symbol, "1d", 250);
  const closesD = daily.map(k => k.close);
  const ma20 = calcMA(closesD, 20);
  const ma50 = calcMA(closesD, 50);
  const ma200 = calcMA(closesD, 200);

  const latestClose = closesD.at(-1);
  const latestMA20 = ma20.at(-1);
  const latestMA50 = ma50.at(-1);
  const latestMA200 = ma200.at(-1);

  let trend = "RANGE";
  if (latestMA20 > latestMA50 && latestMA50 > latestMA200 && latestClose > latestMA20) {
    trend = "UPTREND";
  } else if (latestMA20 < latestMA50 && latestMA50 < latestMA200 && latestClose < latestMA20) {
    trend = "DOWNTREND";
  }

  if (trend === "RANGE") {
    await csvWriter.writeRecords([{ time: now, symbol, trend, signal: "NO_TRADE" }]);
    return;
  }

  // ===== 小时级别 =====
  const hourly = await getKlines(symbol, "1h", 200);
  const closesH = hourly.map(k => k.close);
  const volumesH = hourly.map(k => k.volume);

  const vwapArr = calcVWAP(hourly);
  const lastVWAP = vwapArr.at(-1);
  const lastCloseH = closesH.at(-1);

  const vol20 = calcMA(volumesH, 20);
  const avgVol = vol20.at(-1);
  const lastVol = volumesH.at(-1);

  const highs20 = hourly.slice(-20).map(k => k.high);
  const lows20 = hourly.slice(-20).map(k => k.low);
  const breakoutUp = lastCloseH > Math.max(...highs20);
  const breakoutDown = lastCloseH < Math.min(...lows20);

  const oiHist = await getOpenInterestHist(symbol, "1h", 7);
  const oiChange = (oiHist.at(-1).oi - oiHist[0].oi) / oiHist[0].oi * 100;

  const funding = await getFundingRate(symbol);

  let cvdText = "N/A";
  if (useWS_CVD[symbol]) {
    cvdText = liveCVD[symbol] >= 0 ? "CVD(+)" : "CVD(-)";
  } else {
    const manual = readlineSync.question(`[${symbol}] WebSocket不可用，请输入人工CVD方向 (+/-): `);
    cvdText = manual === "+" ? "CVD(+)" : "CVD(-)";
  }

  // ===== 入场确认 =====
  let signal = "NO_SIGNAL";
  if (trend === "UPTREND" && lastCloseH > lastVWAP && breakoutUp &&
      lastVol > 1.5 * avgVol && oiChange >= 2 && Math.abs(funding) <= 0.001) {
    signal = "LONG_SIGNAL";
  }
  if (trend === "DOWNTREND" && lastCloseH < lastVWAP && breakoutDown &&
      lastVol > 1.5 * avgVol && oiChange <= -2 && Math.abs(funding) <= 0.001) {
    signal = "SHORT_SIGNAL";
  }

  let setupHigh = null, setupLow = null, stopLoss = null, targetPrice = null;

  if (signal !== "NO_SIGNAL") {
    // ===== 15m 执行模拟 =====
    const m15 = await getKlines(symbol, "15m", 50);
    const setupK = m15[m15.length - 2]; // 最近一根完成的K线作为 setup
    setupHigh = setupK.high;
    setupLow = setupK.low;

    const atr = calcATR(m15, 14);
    const lastATR = atr.at(-1);

    if (signal === "LONG_SIGNAL") {
      stopLoss = Math.min(setupLow, latestClose - 1.2 * lastATR);
      targetPrice = latestClose + 2 * (latestClose - stopLoss);
    } else if (signal === "SHORT_SIGNAL") {
      stopLoss = Math.max(setupHigh, latestClose + 1.2 * lastATR);
      targetPrice = latestClose - 2 * (stopLoss - latestClose);
    }

    console.log(`⚡ ${symbol} 入场信号触发！`);
    console.log(`SetupK: 高=${setupHigh}, 低=${setupLow}`);
    console.log(`止损: ${stopLoss}, 目标价: ${targetPrice}`);
  }

  // 写入日志
  await csvWriter.writeRecords([{
    time: now,
    symbol,
    trend,
    closeH: lastCloseH,
    vwap: lastVWAP,
    volume: lastVol,
    avgVol,
    oiChange: oiChange.toFixed(2),
    funding,
    cvd: cvdText,
    signal,
    setupHigh,
    setupLow,
    stopLoss,
    targetPrice
  }]);
}

// 启动 WebSocket
symbols.forEach(s => startCVD_WS(s));

// 每小时运行一次，循环监控所有品种
setInterval(() => {
  symbols.forEach(s => analyze(s).catch(console.error));
}, 60 * 60 * 1000);
```

**日志输出示例trade_log.csv**

| **Time** | **Symbol** | **DailyTrend** | **Close_1H** | **VWAP** | **Volume** | **AvgVol20H** | **OI_6H(%)** | **Funding** | **CVD** | **Signal** | **SetupHigh** | **SetupLow** | **StopLoss** | **TargetPrice** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2025-09-05T08:00Z | BTCUSDT | UPTREND | 43250.5 | 43180 | 1500 | 980 | 3.2 | 0.0001 | CVD(+) | LONG_SIGNAL | 43300 | 43100 | 43050 | 43850 |
| 2025-09-05T08:00Z | ETHUSDT | RANGE | … | … | … | … | … | … | … | NO_TRADE |  |  |  |  |