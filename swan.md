# 一、推荐的检测准则（具体、可执行）

## A. 原始度量（直接计算）

对于每个挂单（价格 p，数量 q）计算：

* `order_value = p × q` （USDT）
* `topN_depth_value = sum_{i=1..N}(price_i × qty_i)`（两侧或单侧，根据场景）
* `impactRatio = order_value / topN_depth_value`
* `volume24hValue = 24h 总成交额（USDT）`
* `oi = open_interest`（USDT nominal，若可用）

## B. 推荐阈值（用于触发“显著单”）

1. **绝对阈值**（candidate）：

   * `order_value >= 100,000,000`（100M）
2. **相对阈值（至少满足一项）**：

   * `impactRatio >= 0.20` （该单至少占 topN 深度的 20%）
   * **或** `order_value / volume24hValue >= 0.03`（占 24h 成交额 ≥ 3%）
   * **或** `order_value / oi >= 0.05`（占 open interest ≥ 5%）
3. **快速消费判定（更危险）**（若满足下面任意，可判定为“高危挂单/已触发”）：

   * 挂单在 **短时间内被 market orders 吃掉 > 30%**，并伴随 **price move ≥ 3%** 在 **5分钟内**。
   * 或在吃掉过程中伴随 **OI 突降 > 5%**（平仓潮迹象）。

> 说明：这些数值是经验起点，应通过回测微调（见后文）。

---

# 二、检测重大黑天鹅的多因子规则（逻辑层次）

**目标**：在黑天鹅（极端抛售/闪崩）发生前或发生中快速识别并报警 — 关键是组合多个独立证据链，避免单因子误报。

## 黑天鹅候选触发器（任一强信号或多项弱信号组合触发预警）

### 强触发（立即高优先级告警）

* 大额挂单 `order_value ≥ 100M` 且 `impactRatio ≥ 0.20` 且 在 **1-3 分钟内被吃掉 30%+** 且 **price 下跌 ≥ 3%**。
* 或：在多交易所同时观测到**短时间内**（<= 5min）**大额卖单**（总计 > 300M）并且**price 跌幅 ≥ 5%**。

### 中级触发（警戒）

* 单侧（卖盘）短时间出现 **多个 >=100M** 挂单或吃单事件（例如 3 次 / 10 分钟），或 `order_value / 24hVolume ≥ 0.05`。
* OI 与 Funding 同时异常：`OI` 急剧上升（杠杆增）、同时 `fundingRate` 快速变负或变极端，表明杠杆空或多在疯狂积累/平仓压力。
* 交易所 BTC 储备（exchange reserves）短期大量下降（资金外流）或短期大量流入（可能触发暴跌/暴涨），阈值依交易所与历史标准化（如 z-score ≥ 3）。

### 低级触发（观察）

* CVD 连续大幅负（短期净卖出）但 price 未立即反应（潜在压制）；或 OBI 大幅偏向卖盘但成交未跟进（可能是 spoofing 或等待时机）。

## 合成规则（示例）

* **CRITICAL ALARM**：any STRONG_TRIGGER OR ( ≥2 MID_TRIGGERS within 5min )
* **WARNING**：1 MID_TRIGGER OR (≥3 LOW_TRIGGER within 10min)
* **INFO**：single LOW_TRIGGER

---

# 三、工程化实现（JS 示例：检测器核心）

下面给一段**可直接放入你监控系统**的 Node.js/JS 函数，基于 depth websocket + aggTrade + REST 获取 24h volume & OI & fundingRate。脚本聚焦判定是否把某一单或一系列事件标记为“黑天鹅候选”。（示例简洁、可扩展）

```js
// black_swan_detector.js
// 注意：需预先维护本地 orderbook via depth websocket and aggTrade websocket

// 假设你已有：orderBook (bids, asks arrays), aggTrade stream pushes trades into recentTrades[], and you can fetch 24h stats & OI
// 依赖: none core libs (use fetch, ws in your app)

const STRONG_ORDER_USD = 100_000_000; // 100M
const IMPACT_RATIO_TH = 0.20; // 20%
const VOL24H_RATIO_TH = 0.03; // 3% of 24h volume
const SWEEP_PCT = 0.3; // 被吃掉30%
const PRICE_DROP_STRONG = 0.03; // 3% price drop within window
const PRICE_DROP_CRITICAL = 0.05; // 5% critical
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// helper
function sumTopN(depthSide, N=50) {
  let s = 0;
  for (let i=0;i<Math.min(N, depthSide.length);i++){
    const p = parseFloat(depthSide[i][0]), q = parseFloat(depthSide[i][1]);
    s += p*q;
  }
  return s;
}

// given an order {side, price, qty, value}
function isSignificantOrder(order, orderBook, stats24h, oi) {
  const orderValue = order.value;
  const topNValue = sumTopN(orderBook.bids,50) + sumTopN(orderBook.asks,50);
  const impactRatio = orderValue / Math.max(1, topNValue);
  const vol24 = stats24h.quoteVolume || stats24h.volumeUSD || 0; // adapt to API keys
  const volRatio = vol24 ? (orderValue / vol24) : 0;
  const oiRatio = oi? (orderValue / oi) : 0;
  const passesAbsolute = orderValue >= STRONG_ORDER_USD;
  const passesRelative = impactRatio >= IMPACT_RATIO_TH || volRatio >= VOL24H_RATIO_TH || oiRatio >= 0.05;
  return { passesAbsolute, passesRelative, impactRatio, volRatio, oiRatio, topNValue };
}

// sweep detector: check recent trades to see how much of price-level got eaten within W ms
function detectSweep(order, recentTrades, windowMs = WINDOW_MS) {
  const start = Date.now() - windowMs;
  // count trades that likely consumed that price (tolerance)
  let consumed = 0;
  for (const t of recentTrades) {
    if (t.timestamp < start) continue;
    // t: {price, qty, takerIsBuyer}
    if (Math.abs(t.price - order.price) / order.price < 0.0005) {
      // if order.side == 'ask' and takerIsBuyer == true -> consumption
      if ((order.side === 'ask' && t.takerIsBuyer) || (order.side === 'bid' && !t.takerIsBuyer)) {
        consumed += t.qty * t.price;
      }
    }
  }
  const pct = consumed / Math.max(1, order.value);
  return { consumedUSD: consumed, pctConsumed: pct };
}

// main check: build alerts
async function checkOrderForSwan(order, orderBook, stats24h, oi, recentTrades, priceHistory) {
  // order: {side, price, qty, value}
  const info = isSignificantOrder(order, orderBook, stats24h, oi);
  if (!info.passesAbsolute && !info.passesRelative) return null; // not significant
  const sweep = detectSweep(order, recentTrades);
  // price move check: get percentage change in last WINDOW_MS for last traded price
  const now = Date.now();
  const pastTs = now - WINDOW_MS;
  const recentPrices = priceHistory.filter(p=>p.ts>=pastTs).map(p=>p.price);
  const priceNow = priceHistory[priceHistory.length-1].price;
  const pricePast = recentPrices.length? recentPrices[0] : priceNow;
  const priceDrop = (pricePast - priceNow) / pricePast; // positive if drop
  // assemble conditions
  const strongSweep = sweep.pctConsumed >= SWEEP_PCT;
  const strongPriceDrop = priceDrop >= PRICE_DROP_STRONG;
  const criticalPriceDrop = priceDrop >= PRICE_DROP_CRITICAL;
  // final rules
  let level = null;
  if (info.passesAbsolute && info.passesRelative && strongSweep && (strongPriceDrop || criticalPriceDrop)) {
    level = 'CRITICAL';
  } else if ((info.passesAbsolute && info.passesRelative && (strongSweep || strongPriceDrop)) || (criticalPriceDrop)) {
    level = 'HIGH';
  } else {
    level = 'WATCH';
  }
  const alert = {
    ts: Date.now(),
    order,
    info,
    sweep,
    priceDrop,
    level
  };
  return alert;
}
```

### 输出示例（告警 JSON）

```json
{
  "ts": 169xxx,
  "order": {"side":"ask","price":65200,"qty":1600,"value":104320000},
  "info": {"passesAbsolute":true,"passesRelative":true,"impactRatio":0.27,"volRatio":0.035,"oiRatio":0.06,"topNValue":386000000},
  "sweep": {"consumedUSD":50000000,"pctConsumed":0.48},
  "priceDrop":0.036,
  "level":"CRITICAL"
}
```

---

# 四、如何把这些信号用作“黑天鹅预警”管控（实战决策流程）

## 1) 告警分级与即时响应

* **CRITICAL**：立即触发全自动保护动作（例如：降低所有头寸杠杆 50%，暂停新仓 30分钟，发送短信/推送 + 人工确认）。
* **HIGH**：发送紧急通知，自动减仓（例如减持 30%），提高止损灵敏度（把所有 SL 拉近至 breakeven + small buffer）。
* **WATCH**：密切监控（1-3min 频率），并记录所有相关 depth/aggTrade/oi snapshots 以备回放分析。

## 2) 跨市场证据加权

* 对于黑天鹅判断，**跨交易所 / 跨合约的一致性**非常重要：

  * 若 Binance、Bybit、OKX 在同一时窗均出现高危告警 → 可信度大增。
  * 建议部署多交易所流（depth & aggTrade & OI）并做合成判断。

## 3) 预案（自动 & 人工）

* 自动：减仓、close non-core positions、暂停自动开新仓、切换到现金/稳定币。
* 人工：风险小组确认是否为市场操纵（spoofing）或真实抛售，然后决定是否恢复策略。

---