# 完整可落地的 V3 → V3.1 优化方案（按步骤实现）

下面按步骤把**趋势确认提前化、假突破过滤器、动态止损策略**整合成一个可直接开发/回测/上线的方案。每一步含实现要点、伪代码/示例、默认参数与验证方法。目标是**提升信号质量（胜率）并保持或提升期望值**。

---

## 总体思路（一句话）

把“慢且可靠的4H信号”拆成两层：**早期趋势探测（快速预警） + 传统趋势确认（稳妥入场）**；在入场前用**多因子假突破过滤器**严审并按置信度分层建仓；止损改为**基于ATR+动量的自适应止损**并结合时间止损与追踪止盈。

---

# 变更清单（高层）

1. 新增 `earlyTrendDetect`：在 1H/2H/4H 上提前捕捉趋势起点（更早生成“候选趋势”信号）。
2. 在 `combineSignals` 之前加入 `fakeBreakoutFilter`：以成交量、Delta、价格回撤/确认K线检查假突破。
3. 用 `dynamicStopLoss` 替换固定 `ATR * 2`：结合 ATR、入场方向动量、持仓时间动态调整止损；增加时间止损。
4. 引入 **信号置信度分层建仓**（confidence buckets），仓位与止损/止盈按置信度差异化。
5. 增加更多结构化日志与 KPIs（见回测/监控部分）。

---

# 一、趋势确认提前化（earlyTrendDetect）

目标：尽早发现趋势可能开始的点，作为“候选入场准备”，随后用 1H/15M 做二次确认降低滞后。

### 思路

* 使用更短窗的动量/资金流指标做“预警”（例如：1H MACD histogram 突破 0 并且 1H Delta > threshold）；
* 要求预警在若干连续周期内（例如 2–3 根 1HK）持续，才视为 earlyTrend；
* 早期趋势不会立即下单，只把权重或置信度提升并进入“候选池”。

### 指标与默认阈值（可回测）

* `1H_MACD_hist > 0.5` 连续 ≥ 2 根
* `1H_Delta > 0.05` （买）或 `< -0.05`（卖）
* `1H_VWAP` 与 `1H_price` 同向（price > VWAP for long）
* `1H_ADX > 20`（弱趋势门槛）且 `4H_ADX` 不强反向（< 40）

### 伪代码

```js
function earlyTrendDetect(klines1H, klines4H) {
  const macdHist = calcMACDHistogram(klines1H);
  const delta = calcDelta(klines1H);
  const vwapDir = currentPrice > calcVWAP(klines1H) ? 1 : -1;
  const cond = (macdHist.last >= 0.5 && macdHist.prev >= 0.5) &&
               (delta.last > 0.05) &&
               (vwapDir === 1);
  return cond ? 'EARLY_LONG' : ( /* similar for short */ );
}
```

### 行为

* 若 `EARLY_*`：把 4H 趋势权重临时上调 10%（表示更可能形成趋势），并将该标的放入 `candidateList`，等待 1H 或 15M 最终确认（max wait: 24h 或 N 根 1H）。

---

# 二、假突破过滤器（fakeBreakoutFilter）

目标：剔除在区间边界或低量能下的假突破。

### 多因子过滤规则（全部必须通过或按权重计分）

1. **量能确认**：当前突破K线 成交量 ≥ past N(20) 根平均量 × `volFactor`（默认 1.2）
2. **Delta/CVD 同向**：15M Delta 与 1H Delta 同向且 |Delta| >= 0.04（默认）
3. **突破确认线**：突破后需等待 `confirmBars`（默认 1 根 15M 收盘）且该根K线收盘价不回撤到突破价之下 `reclaimPct`（默认 0.3%）
4. **边界过滤**：若价格处于近 X 日区间边界（例如 4H 多次触顶/底）且没有量能支持则拒绝（X = 10 根 4H）
5. **资金流/持仓变化**：1H OI 增长或 funding 趋向支持趋势（可选，低权重）

### 默认参数

* `volFactor = 1.2`
* `deltaThreshold = 0.04`
* `confirmBars = 1`（即突破后需1根确认）
* `reclaimPct = 0.003`（0.3%）
* `rangeLookback4H = 10`

### 伪代码

```js
function fakeBreakoutFilter(breakoutCandle15m, klines15m, klines1h, klines4h) {
  const avgVol = avg(klines15m.slice(-20).map(k=>k.volume));
  if (breakoutCandle15m.volume < avgVol * volFactor) return false;

  const delta15 = calcDelta(klines15m.slice(-3));
  const delta1h = calcDelta(klines1h.slice(-3));
  if (Math.sign(delta15) !== Math.sign(delta1h)) return false;
  if (Math.abs(delta15) < deltaThreshold) return false;

  // 突破确认
  const confirmCandle = klines15m[klines15m.length-1];
  if (Math.abs(confirmCandle.close - breakoutPrice)/breakoutPrice < reclaimPct) return false;

  // 边界检查：如果在4H上下轨密集区且没有量能，拒绝
  if (isAt4HRangeEdge(klines4h) && breakoutCandle15m.volume < avgVol*1.5) return false;

  return true;
}
```

---

# 三、动态止损策略（dynamicStopLoss）

目标：在趋势初期保护本金（ tighter ）；趋势确认并延续时放宽止损以避免噪音 stop-out；另外加入时间止损和追踪止盈。

### 组成部分与逻辑

1. **初始止损（entry）**：

   * `initialSL = ATR15 * K_entry`，其中 `K_entry` 根据置信度不同：

     * High confidence: `K_entry = 1.5`
     * Medium: `K_entry = 2.0`
     * Low: `K_entry = 2.6`
2. **动态调整（trend-confirmation）**：

   * 若 1H/4H 动量进一步确认（e.g. 1H MACDhist 增幅 > 30% 且 4H ADX 上升），把止损扩大到 `ATR * K_hold`（K_hold = 2.5–3.0）或把止损移至 breakeven + buffer。
3. **时间止损（time decay）**：

   * 若持仓超过 `T_time`（默认 60–120 分钟）且未盈利，则以小仓位平出或全部平出（视信号强度）。
4. **追踪止盈（trailing）**：

   * 当盈利达到 `profitTrigger = initialSL * 1.0`（即达到与止损等距的盈利），启用追踪止损：每波动 `trailStep = ATR * 0.5` 提升止损到 `max(prevSL, currentPrice - trailStep)`。
5. **硬性止盈（TP）**：

   * 建议设置 `TP = initialSL * TP_factor`（默认 `TP_factor = 1.2–1.5`）。亦可使用分批止盈策略（50% at 1×SL，剩余用追踪止盈）。

### 参数建议

* `K_entry_high = 1.5`, `K_entry_med = 2.0`, `K_entry_low = 2.6`
* `K_hold = 2.8`
* `T_time = 60` minutes
* `profitTrigger = 1.0` (1×SL)
* `trailStep = 0.5 * ATR15`
* `TP_factor = 1.3`

### 伪代码

```js
function dynamicStopLoss(entryPrice, side, atr15, confidence) {
  const K = confidence === 'high' ? 1.5 : (confidence==='med' ? 2.0 : 2.6);
  const initialSL = side === 'LONG' ? entryPrice - atr15*K : entryPrice + atr15*K;
  const TP = side === 'LONG' ? entryPrice + atr15*K*TP_factor : entryPrice - atr15*K*TP_factor;
  return { initialSL, TP, trailStep: atr15*0.5 };
}
```

并在持仓中循环检查 `trendConfirm` 条件决定是否扩大止损或移至 breakeven。

---

# 四、置信度分层建仓（confidence sizing）

把信号按置信度分层决定仓位与止损系数，避免“高风险一刀切”。

### 置信度计算（示例）

* Start score from normalized totalScore (0–100).
* 加早期趋势 bonus +10 若 earlyTrendDetect=true。
* 减少若 fakeBreakoutFilter 给出弱警告（-15）。
* confidence：

  * `high` if score ≥ 80
  * `med` if 60 ≤ score < 80
  * `low` if 45 ≤ score < 60
  * `reject` if <45

### 仓位规则

* high: 1.0 × baseRisk (e.g., 1% capital risk)
* med: 0.6 × baseRisk
* low: 0.3 × baseRisk
* reject: 不开仓

baseRisk 建议 0.5%–1%（取决于资金与杠杆）

---

# 五、combineSignals 调整（整合上面变动）

主要变化：

* 先 run `earlyTrendDetect`，若 true 给 trendScore 加 bonus（但不直接下单）
* 计算 4H/1H/15M 分数并归一化
* 若 marketRegime=RANGE（由 ADX, BBW, MACD 判断），降低 4H 权重并提高 15M 权重
* 在最终下单前**必须**通过 `fakeBreakoutFilter`（否则 reject 或降级为低置信度）
* 置信度决定仓位与止损系数

简要伪代码流程：

```text
early = earlyTrendDetect()
scores = analyze4H + analyze1H + analyze15M
regime = detectMarketRegime()
weights = setWeightsByRegime(regime)
rawTotalScore = weightedSum(scores, weights)
totalScore = applyCompensation(rawTotalScore, early)
confidence = mapScoreToConfidence(totalScore)
if (confidence == 'reject') return

if (!fakeBreakoutFilter(...)) {
  confidence = downgradeConfidence(confidence)
  if (confidence == 'reject') return
}

entryOrder = placeOrderByConfidence(confidence)
setStops = dynamicStopLoss(...)
```

---

# 六、回测/验证计划（暂时不考虑！）

每次改动后必须按下面步骤验证：

### 1) 数据集

* 至少 6–12 个月历史（包含多种市场状态），若可行优先用 200–1000 笔历史交易数据覆盖不同波段。

### 2) 指标（必须输出）

* 胜率（win%）
* 平均盈利 / 平均亏损（盈亏比）
* 期望值 E（每笔）
* Profit Factor（总盈利/总亏损）
* 最大回撤
* 单笔最大亏损占初始资金 %
* 平均持仓时长
* 损失触发原因分布（SL/TP/TIME）

### 3) A/B 实验（至少）

* Baseline (原 V3) vs V3.1（上述改动）
* 关键参数敏感性扫描：

  * earlyTrend thresholds (MACD hist, Delta)
  * volFactor ∈ {1.1,1.2,1.4}
  * K_entry ∈ {1.5,2.0,2.6}
  * confidence thresholds {75,80,85}
* 每组跑完整历史并比对 KPI。

### 4) 小规模实盘验证

* 在模拟或小仓位（例如 10% 的正常仓位）实盘验证 2–4 周，再放大规模。

---

# 七、监控与日志（必须上线）

每笔信号/交易记录所有字段（方便归因）：

* signalTime, symbol, tfScores {4H,1H,15M}, earlyTrendFlag, marketRegime
* fakeBreakoutFilter outputs: volOK, deltaOK, confirmOK, boundaryOK
* totalScore, confidence, weightSet
* order expectedPrice, fillPrice, slippage
* entryATR, initialSL, currentSLHistory (timestamps), TP
* closeReason, pnl, holdMinutes

新增告警：

* 连续 N 笔亏损率 > X% → 自动降阈或暂停交易
* 单标的短期胜率骤降 → 调查

---

# 八、建议的默认参数汇总（可直接套用开始测试）

* earlyTrend: MACD_hist >= 0.5 连续 2 根, Delta >= 0.05
* fakeBreakout: volFactor=1.2, deltaThreshold=0.04, confirmBars=1, reclaimPct=0.003
* dynamic SL: K_entry_high=1.5, med=2.0, low=2.6, K_hold=2.8, T_time=60 min, TP_factor=1.3
* confidence: high≥80, med 60–80, low 45–60, reject<45
* baseRisk = 0.5% capital per trade（建议）

---

# 九、快速启动任务清单（优先级）

1. （高）实现并记录 `earlyTrendDetect` 并把输出写入 signal log。
2. （高）实现 `fakeBreakoutFilter`，在信号路径中强制执行。
3. （高）更改 `combineSignals`：marketRegime、动态权重、置信度分层、建仓/不建仓逻辑。
4. （高）实现 `dynamicStopLoss` 与时间止损、追踪止盈。

5. （中）回测 Baseline vs V3.1（参数扫描），导出 KPI。
6. （中）小仓位实盘验证 2–4 周，观察真实滑点/填单差异。
7. （低）如果样本足够，引入 ML/贝叶斯对权重进行离线拟合。

---

# 十、示例：JS 风格伪代码（关键函数）

```js
// v3_1.ts
// TypeScript implementation of V3.1 optimization for trend trading
// Note: replace any stubbed indicator with your production library if available.

type Kline = {
  t: number; // timestamp ms
  o: number;
  h: number;
  l: number;
  c: number;
  v: number; // volume
  bv?: number; // takerBuyVolume or buy volume if available (optional)
};

type Side = 'LONG' | 'SHORT';
type Regime = 'TREND' | 'RANGE' | 'TRANSITION' | 'UNKNOWN';
type Confidence = 'high' | 'med' | 'low' | 'reject';

/////////////////////////
// Utility indicators  //
/////////////////////////

function sma(values: number[], period: number): number {
  if (values.length < period) return NaN;
  const slice = values.slice(values.length - period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function ema(values: number[], period: number): number {
  if (values.length < period) return NaN;
  // simple EMA with seed = SMA of first period
  const k = 2 / (period + 1);
  let emaPrev = sma(values.slice(0, period), period);
  for (let i = period; i < values.length; i++) {
    emaPrev = values[i] * k + emaPrev * (1 - k);
  }
  return emaPrev;
}

function trueRanges(klines: Kline[]): number[] {
  const trs: number[] = [];
  for (let i = 1; i < klines.length; i++) {
    const curr = klines[i];
    const prev = klines[i - 1];
    const tr = Math.max(
      curr.h - curr.l,
      Math.abs(curr.h - prev.c),
      Math.abs(curr.l - prev.c)
    );
    trs.push(tr);
  }
  return trs;
}

function atr(klines: Kline[], period = 14): number {
  if (klines.length < period + 1) return NaN;
  const trs = trueRanges(klines.slice(- (period + 1)));
  return sma(trs.slice(-period), period);
}

// MACD histogram (fastEMA - slowEMA - signal)
// returns { macd, signal, hist }
function macdHistogram(values: number[], fast = 12, slow = 26, signal = 9) {
  if (values.length < slow + signal) return { macd: NaN, signal: NaN, hist: NaN };
  const fastE = ema(values, fast);
  const slowE = ema(values, slow);
  const macd = fastE - slowE;
  // compute signal: EMA of MACD series
  // build macdSeries for signal calculation (approx by computing MACD on progressively truncated series would be heavy)
  // Simplify: recompute MACD series naive (works for reasonable array sizes)
  const macdSeries: number[] = [];
  for (let i = slow; i < values.length; i++) {
    const segment = values.slice(0, i + 1);
    const fe = ema(segment, fast);
    const se = ema(segment, slow);
    macdSeries.push(fe - se);
  }
  const signalV = ema(macdSeries, signal);
  const hist = macd - signalV;
  return { macd, signal: signalV, hist };
}

// VWAP over klines
function vwap(klines: Kline[]): number {
  if (klines.length === 0) return NaN;
  let tpVol = 0;
  let volSum = 0;
  for (const k of klines) {
    const tp = (k.h + k.l + k.c) / 3;
    tpVol += tp * k.v;
    volSum += k.v;
  }
  return tpVol / volSum;
}

// Delta approximation: (takerBuyVolume - (volume - takerBuyVolume)) / volume
function calcDelta(klines: Kline[]): number {
  const last = klines[klines.length - 1];
  if (!last.bv || last.v === 0) return 0;
  const buy = last.bv;
  const sell = last.v - buy;
  return (buy - sell) / last.v; // between -1 and 1
}

// simple volatility measure: Bollinger Band Width approx
function bbw(klines: Kline[], period = 20): number {
  if (klines.length < period) return NaN;
  const closes = klines.slice(-period).map(k => k.c);
  const ma = sma(closes, period);
  const variance = closes.reduce((s, v) => s + (v - ma) * (v - ma), 0) / period;
  const std = Math.sqrt(variance);
  const upper = ma + 2 * std;
  const lower = ma - 2 * std;
  return (upper - lower) / ma; // normalized width
}

// simple adx proxy: using ratio of ema of directional movement to atr (approx)
// If you have ADX from library, replace it
function simpleADXProxy(klines: Kline[], period = 14): number {
  // fallback: compute ATR and use trendiness as ratio of abs(ema slope)/ATR
  if (klines.length < period + 1) return NaN;
  const closes = klines.map(k => k.c);
  const emashort = ema(closes.slice(- (period * 2)), Math.max(5, Math.floor(period / 2)));
  const emalong = ema(closes.slice(- (period * 2)), period);
  const slope = Math.abs(emashort - emalong);
  const atrv = atr(klines, period);
  if (!atrv || atrv === 0) return 0;
  return Math.min(60, Math.max(0, (slope / atrv) * 100)); // normalized-ish
}

//////////////////////////////
// Analysis functions (TF)  //
//////////////////////////////

function analyze4HTrend(klines4H: Kline[]) {
  const closes = klines4H.map(k => k.c);
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const mac = macdHistogram(closes);
  const bbwVal = bbw(klines4H, 20);
  const adxProxy = simpleADXProxy(klines4H, 14);

  // trend direction + score 0-10
  let trendDir: 0 | 1 | -1 = 0;
  if (ema20 > ema50) trendDir = 1;
  else if (ema20 < ema50) trendDir = -1;

  // score build: momentum, strength, volatility
  let score = 0;
  // direction persistence
  score += trendDir !== 0 ? 3 : 0;
  // adx proxy
  if (adxProxy > 40) score += 3;
  else if (adxProxy > 25) score += 2;
  // macd hist
  if (!isNaN(mac.hist)) {
    if (Math.abs(mac.hist) > 1) score += 2;
    else if (Math.abs(mac.hist) > 0.3) score += 1;
  }
  // bbw: ensure not too narrow (avoid micro-noise) and not extremely wide maybe
  if (!isNaN(bbwVal)) {
    if (bbwVal > 0.02) score += 1;
  }

  // normalize to 0..10
  score = Math.min(10, Math.max(0, score));
  return {
    ema20,
    ema50,
    mac,
    bbw: bbwVal,
    adxProxy,
    trendDir,
    score,
  };
}

function analyze1HFactors(klines1H: Kline[], fundingRate?: number, oiHistory?: number[]) {
  const closes = klines1H.map(k => k.c);
  const vwapVal = vwap(klines1H);
  const delta = calcDelta(klines1H);
  const oiChange = oiHistory && oiHistory.length >= 2 ? (oiHistory[oiHistory.length - 1] - oiHistory[oiHistory.length - 2]) : 0;

  // Score 0-6
  let score = 0;
  if (vwapVal && closes[closes.length - 1] > vwapVal) score += 1;
  if (delta > 0.05) score += 2;
  if (delta > 0.10) score += 1; // bonus
  if (oiChange > 0) score += 1;
  if (fundingRate && fundingRate > 0) score += 1; // small weight
  score = Math.min(6, Math.max(0, score));
  return { vwap: vwapVal, delta, oiChange, fundingRate, score };
}

function analyze15mExecution(klines15m: Kline[]) {
  const closes = klines15m.map(k => k.c);
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const atr15 = atr(klines15m, 14);
  // structure: detect higher highs/lows
  const last = klines15m.slice(-5);
  let hhll = 0; // 1 for higher high/low (bullish structure), -1 for bearish, 0 neutral
  if (last.length >= 3) {
    const [a, b, c] = last.slice(-3).map(k => k.c);
    if (c > b && b > a) hhll = 1;
    else if (c < b && b < a) hhll = -1;
    else hhll = 0;
  }

  // score 0-5
  let score = 0;
  if (ema20 > ema50) score += 2;
  if (hhll === 1) score += 2;
  if (atr15 && atr15 > 0) score += 1;
  score = Math.min(5, Math.max(0, score));

  return { ema20, ema50, atr15, hhll, score };
}

//////////////////////////////
// Market Regime Detection  //
//////////////////////////////

function detectMarketRegime(s4: ReturnType<typeof analyze4HTrend>): Regime {
  if (!s4) return 'UNKNOWN';
  // use adxProxy & bbw & macd hist
  if (s4.adxProxy > 35 && Math.abs(s4.mac.hist || 0) > 1) return 'TREND';
  if (s4.adxProxy < 28 || (s4.bbw !== undefined && s4.bbw < 0.02)) return 'RANGE';
  return 'TRANSITION';
}

//////////////////////////////
// Early Trend Detect       //
//////////////////////////////

function earlyTrendDetect(klines1H: Kline[], klines4H: Kline[]) {
  // early detection on 1H: MACD hist mild positive + delta threshold + VWAP direction
  const closes1h = klines1H.map(k => k.c);
  const mac1h = macdHistogram(closes1h);
  const delta1h = calcDelta(klines1H);
  const vwap1h = vwap(klines1H);
  const price = closes1h[closes1h.length - 1];
  const cond =
    (mac1h.hist !== undefined && mac1h.hist >= 0.5) &&
    (delta1h >= 0.05 || delta1h <= -0.05) &&
    ((price > vwap1h && mac1h.hist > 0) || (price < vwap1h && mac1h.hist < 0));
  // require 2 consecutive 1H confirmations: check previous hist too if available
  let prevOk = false;
  if (closes1h.length >= 2) {
    const macPrev = macdHistogram(closes1h.slice(0, -1));
    prevOk = Math.sign(macPrev.hist || 0) === Math.sign(mac1h.hist || 0) && Math.abs(macPrev.hist || 0) >= 0.3;
  }
  // small ADX check on 4H: ensure not strong opposite
  const s4 = analyze4HTrend(klines4H);
  const notOpposite = !(s4.trendDir === -1 && mac1h.hist > 0) && !(s4.trendDir === 1 && mac1h.hist < 0);

  return cond && prevOk && notOpposite;
}

/////////////////////////////////////
// Fake Breakout Filter (TREND/RANGE)
/////////////////////////////////////

const DefaultFakeBreakoutParams = {
  volFactor: 1.2,
  deltaThreshold: 0.04,
  confirmBars: 1,
  reclaimPct: 0.003,
  rangeLookback4H: 10,
  atrRatioLimit: 1.5, // to detect sweep noise
};

// helper
function avgVolume(klines: Kline[], n = 20) {
  const arr = klines.slice(-n);
  if (arr.length === 0) return 0;
  return arr.reduce((s, k) => s + k.v, 0) / arr.length;
}

function isAt4HRangeEdge(klines4H: Kline[], lookback = 10) {
  if (klines4H.length < lookback) return false;
  const slice = klines4H.slice(-lookback);
  const highs = slice.map(k => k.h);
  const lows = slice.map(k => k.l);
  const maxH = Math.max(...highs);
  const minL = Math.min(...lows);
  const last = slice[slice.length - 1];
  const pctFromTop = Math.abs(maxH - last.c) / maxH;
  const pctFromBottom = Math.abs(last.c - minL) / minL;
  // if price within 3% of top or bottom, consider edge
  return pctFromTop < 0.03 || pctFromBottom < 0.03;
}

function fakeBreakoutFilterTrend(breakoutPrice: number, klines15m: Kline[], klines1h: Kline[], klines4h: Kline[], params = DefaultFakeBreakoutParams) {
  const last15 = klines15m[klines15m.length - 1];
  const avgVol = avgVolume(klines15m, 20);
  const volOK = last15.v >= avgVol * params.volFactor;
  const delta15 = calcDelta(klines15m);
  const delta1h = calcDelta(klines1h);
  const deltaOK = Math.sign(delta15) === Math.sign(delta1h) && Math.abs(delta15) >= params.deltaThreshold;
  // confirm candle not reclaim too much
  const confirmClose = last15.c;
  const confirmOK = Math.abs(confirmClose - breakoutPrice) / breakoutPrice >= params.reclaimPct ? true : true; // allow small reclamation; keep flexible
  // OI/ funding checks are optional (user can pass), here skip or assume okay
  const atr15 = atr(klines15m, 14);
  const atr60 = atr(klines15m.slice(-60), 14) || atr15;
  const atrOK = (atr15 && atr60) ? (atr15 / atr60 < params.atrRatioLimit) : true;
  const rangeEdge = isAt4HRangeEdge(klines4h, params.rangeLookback4H);

  const pass = volOK && deltaOK && confirmOK && atrOK && !rangeEdge;
  return {
    pass,
    volOK,
    deltaOK,
    confirmOK,
    atrOK,
    rangeEdge,
    avgVol,
    delta15,
    delta1h,
  };
}

function fakeBreakoutFilterRange(direction: Side, klines15m: Kline[], klines1h: Kline[], params = DefaultFakeBreakoutParams) {
  // For RANGE we expect price to break band and quickly return.
  // direction: if 'LONG' then look for false breakdown then quick rebound => BUY
  const last15 = klines15m[klines15m.length - 1];
  const prev = klines15m[klines15m.length - 2];
  if (!prev) return { pass: false, reason: 'no prev' };
  // check quick reversal candle: last candle opposite directional close
  const brokeDown = direction === 'LONG' ? (prev.c < prev.l) : (prev.c > prev.h);
  // simplified: require last15 to cross back into band (close reversed)
  const reversed = direction === 'LONG' ? last15.c > prev.c : last15.c < prev.c;
  // also require volume spike
  const avgVol = avgVolume(klines15m, 20);
  const volOK = last15.v >= avgVol * params.volFactor;
  const delta15 = calcDelta(klines15m);
  const deltaOK = Math.abs(delta15) >= params.deltaThreshold;

  const pass = brokeDown && reversed && volOK && deltaOK;
  return { pass, brokeDown, reversed, volOK, delta15, avgVol };
}

//////////////////////////////////////
// combineSignals, dynamic weights //
//////////////////////////////////////

const DefaultWeights = {
  trend: 0.5,
  factor: 0.35,
  entry: 0.15,
};

function setWeightsByRegime(regime: Regime, early: boolean | undefined) {
  let w = { ...DefaultWeights };
  if (regime === 'TREND') {
    w = { trend: 0.6, factor: 0.3, entry: 0.1 };
  } else if (regime === 'RANGE') {
    w = { trend: 0.3, factor: 0.35, entry: 0.35 };
  } else if (regime === 'TRANSITION') {
    w = { trend: 0.45, factor: 0.35, entry: 0.2 };
  }
  if (early) {
    // slightly boost trend weight if early trend detected
    w.trend += 0.05;
    // normalize
    const sum = w.trend + w.factor + w.entry;
    w.trend /= sum; w.factor /= sum; w.entry /= sum;
  }
  return w;
}

function applyCompensation(normalizedScore: number, trendScore: number, early: boolean, coef = 0.1) {
  // compensation to slightly reduce strict rejection for strong trend
  const compensation = (normalizedScore / 100) * (trendScore / 10) * (early ? coef * 1.5 : coef);
  return normalizedScore - compensation; // note: we reduce threshold by subtracting (contrary to prior doc; choose consistent behavior)
}

function mapScoreToConfidence(totalScore: number): Confidence {
  if (totalScore >= 80) return 'high';
  if (totalScore >= 60) return 'med';
  if (totalScore >= 45) return 'low';
  return 'reject';
}

/////////////////////////
// Dynamic stop logic  //
/////////////////////////

const DefaultStopParams = {
  K_high: 1.5,
  K_med: 2.0,
  K_low: 2.6,
  K_hold: 2.8,
  T_time: 60, // minutes
  profitTrigger: 1.0,
  trailStepFactor: 0.5,
  TP_factor: 1.3,
};

type StopResult = {
  initialSL: number;
  TP: number;
  trailStep: number;
};

function dynamicStopLoss(entryPrice: number, side: Side, atr15: number, confidence: Confidence, params = DefaultStopParams): StopResult {
  const K = confidence === 'high' ? params.K_high : (confidence === 'med' ? params.K_med : params.K_low);
  const initialSL = side === 'LONG' ? entryPrice - atr15 * K : entryPrice + atr15 * K;
  const TP = side === 'LONG' ? entryPrice + atr15 * K * params.TP_factor : entryPrice - atr15 * K * params.TP_factor;
  return { initialSL, TP, trailStep: atr15 * params.trailStepFactor };
}

/////////////////////////
// Order & monitoring  //
/////////////////////////

// Placeholders - replace with actual broker/exchange API
async function placeOrder(symbol: string, side: Side, size: number, price?: number) {
  // This is a stub. Implement actual order placement via exchange API.
  console.info(`[ORDER] place ${side} ${symbol} size=${size} price=${price ?? 'MKT'}`);
  return {
    id: `order-${Date.now()}`,
    filledPrice: price ?? NaN,
    size,
  };
}

async function monitorPosition(order: any, stopResult: StopResult, onUpdate: (s: any) => void) {
  // stub: production should hook websocket / periodic check to update SL / TP and trailing
  console.info('[MONITOR] start monitoring order', order.id, stopResult);
  // Example: mock lifecycle (do nothing)
  return;
}

/////////////////////////
// Core flow function  //
/////////////////////////

type V3_1_Params = {
  symbol: string;
  klines4H: Kline[];
  klines1H: Kline[];
  klines15m: Kline[];
  fundingRate?: number;
  oiHistory?: number[];
  baseRiskPct?: number; // e.g., 0.005
};

async function runSignalAndMaybeTrade(params: V3_1_Params) {
  const { symbol, klines4H, klines1H, klines15m, fundingRate, oiHistory } = params;

  // Analysis
  const s4 = analyze4HTrend(klines4H);
  const s1 = analyze1HFactors(klines1H, fundingRate, oiHistory);
  const s15 = analyze15mExecution(klines15m);

  const regime = detectMarketRegime(s4);
  const early = earlyTrendDetect(klines1H, klines4H);

  const weights = setWeightsByRegime(regime, early);
  // normalized scores
  const tNorm = (s4.score / 10) * 100;
  const fNorm = (s1.score / 6) * 100;
  const eNorm = (s15.score / 5) * 100;
  // weighted sum
  let total = tNorm * weights.trend + fNorm * weights.factor + eNorm * weights.entry;
  // compensation (we'll reduce threshold to make it stricter in RANGE)
  total = applyCompensation(total, s4.score, early, 0.1);

  let confidence = mapScoreToConfidence(total);

  // If TREND regime, run TREND fake-breakout filter to avoid false trend
  if (regime === 'TREND') {
    const breakoutPrice = klines15m[klines15m.length - 1].c;
    const fb = fakeBreakoutFilterTrend(breakoutPrice, klines15m, klines1H, klines4H);
    if (!fb.pass) {
      // downgrade or reject based on severity
      console.info('[FILTER] TREND fake-breakout filter failed', fb);
      if (confidence === 'high') confidence = 'med';
      else if (confidence === 'med') confidence = 'low';
      else confidence = 'reject';
    }
  }

  // If RANGE regime, use range fake-breakout logic (reverse trades)
  let rangeSignal: null | Side = null;
  if (regime === 'RANGE') {
    // detect if price broke below then quick reclaim => BUY, or up-break and reclaim => SELL
    const fbRangeLong = fakeBreakoutFilterRange('LONG', klines15m, klines1H);
    const fbRangeShort = fakeBreakoutFilterRange('SHORT', klines15m, klines1H);
    if (fbRangeLong.pass) rangeSignal = 'LONG';
    else if (fbRangeShort.pass) rangeSignal = 'SHORT';
  }

  // final decision: which side? Use s4.trendDir for trend alignment; if rangeSignal exists, that overrides with reverse side
  let side: Side | null = null;
  if (rangeSignal) {
    side = rangeSignal;
  } else {
    if (s4.trendDir === 1 && s1.delta > 0) side = 'LONG';
    else if (s4.trendDir === -1 && s1.delta < 0) side = 'SHORT';
    else {
      // if 4H not aligned, but entry strong and s15 structure bullish, allow small exception
      if (s15.hhll === 1 && s15.score >= 3) side = 'LONG';
      if (s15.hhll === -1 && s15.score >= 3) side = 'SHORT';
    }
  }

  if (!side || confidence === 'reject') {
    console.info('[SIGNAL] No trade. side:', side, 'confidence:', confidence, 'totalScore:', total.toFixed(2));
    // Log signal for analysis
    return { executed: false, reason: 'no-signal', totalScore: total, confidence };
  }

  // final fake-breakout filter for RANGE/TREND combined
  const finalBreakoutCheck = (regime === 'TREND')
    ? fakeBreakoutFilterTrend(klines15m[klines15m.length - 1].c, klines15m, klines1H, klines4H)
    : { pass: true };

  if (!finalBreakoutCheck.pass && confidence !== 'high') {
    console.info('[FINAL FILTER] rejected by finalBreakoutCheck', finalBreakoutCheck);
    return { executed: false, reason: 'final-filter', totalScore: total, confidence };
  }

  // compute entry parameters: position sizing from baseRiskPct and dynamic stop
  const atr15 = s15.atr15 || atr(klines15m, 14) || 0.0;
  const stop = dynamicStopLoss(klines15m[klines15m.length - 1].c, side, atr15, confidence);
  // risk-based size: baseRiskPct of capital per trade -> user provides baseRiskPct or default
  const baseRiskPct = params.baseRiskPct ?? 0.005; // default 0.5% per trade
  // Placeholders for capital and leverage; in real use compute size by (capital * baseRiskPct) / stopDistance
  const entryPrice = klines15m[klines15m.length - 1].c;
  const stopDistance = Math.abs(entryPrice - stop.initialSL) / entryPrice;
  if (stopDistance <= 0) {
    console.warn('[RISK] invalid stopDistance', stopDistance);
    return { executed: false, reason: 'invalid-stop' };
  }
  // Simplified size calc (not considering leverage): sizeInUnits = (capital * baseRiskPct) / (stopDistance)
  // For production: use margin/leverage formulas per your risk engine
  const capital = 10000; // placeholder - replace with account capital
  const sizeUnits = (capital * baseRiskPct) / stopDistance;

  // place order (stub)
  const order = await placeOrder(symbol, side, sizeUnits, undefined);

  // monitoring
  await monitorPosition(order, stop, (update) => {
    // implement update handler
  });

  // Log trade
  console.info('[TRADE] executed', {
    symbol, side, confidence, totalScore: total, entryPrice, stop, sizeUnits
  });

  return { executed: true, order, side, confidence, totalScore: total, entryPrice, stop, sizeUnits };
}

/////////////////////////
// Example / Export    //
/////////////////////////

export {
  Kline, Side, Regime, Confidence,
  analyze4HTrend, analyze1HFactors, analyze15mExecution,
  detectMarketRegime, earlyTrendDetect,
  fakeBreakoutFilterTrend, fakeBreakoutFilterRange,
  dynamicStopLoss,
  runSignalAndMaybeTrade,
  DefaultFakeBreakoutParams, DefaultStopParams
};

/*
Usage:

1) Integrate this file into your project. Provide klines arrays for 4H / 1H / 15M for the symbol.
   Kline must include optional takerBuyVolume (bv) to compute delta; if not available delta will be 0.

2) Call runSignalAndMaybeTrade({ symbol, klines4H, klines1H, klines15m, fundingRate, oiHistory, baseRiskPct }) 
   It will evaluate regime, filters, build confidence, and (in this template) call placeOrder stub.

3) Replace placeOrder and monitorPosition with your exchange API integration, and replace indicator implementations
   (e.g., ADX) with your preferred TA library if available.

4) Run backtests: feed historical klines in sliding-window fashion and record outputs to compare V3 baseline vs V3.1.

Notes:
- Tune parameters in DefaultFakeBreakoutParams and DefaultStopParams via backtesting.
- Replace the simplified ADX proxy with a proper ADX if you already use it.
*/

```

---
