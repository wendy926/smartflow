# **一、总体框架**

1. 高时间框架(HTF): 1D 判断市场整体趋势 上升、下降还是震荡。
2. 中时间框架(MTF): 在与 1D 同向的 4H K 线范围内，识别并评分 OB/FVG，并过滤（高度 & 年龄 & 成交量）。
3. 低时间框架（LTF）：15Min找精确入场点（Entry）、止损（SL）、目标（TP），在选定 4H 区域内，用 15m 的吞没/结构确认入场（需满足体积/尺寸条件）。
4. 风控（止损/止盈/仓位）：SL 用 4H 结构 + ATR，对仓位做动态调整（按风险%），TP 以 RR=3:1 为默认，并可分批出场/移动止损。
5. 额外信号强化：要求 4H OB 与 liquidity zone 有重合（overlap）并伴随有效 sweep（速率判定）或成交量增强，优先级更高。

# **二、 ICT 策略整体逻辑**

**1. 高时间框架（HTF – 1D）**

- 目标：确定市场主要趋势方向（up / down / sideways）。
- 方法：比较最近 20 根日线收盘价：
    - 末值 > 首值 → 上升趋势
    - 末值 < 首值 → 下降趋势
    - 否则 → 震荡（忽略信号）

**2. 中时间框架（MTF – 4H）**

- 目标：找到潜在订单块（OB）和失衡区（FVG）。
- 过滤条件：
    - OB 高度 ≥ 0.25 × ATR(4H)
    - OB 年龄 ≤ 30 天
- Sweep 宏观速率确认：
    - 检测关键 swing 高/低是否在 ≤2 根 4H 内被刺破并收回。
    - 刺破幅度 ÷ bar 数 ≥ 0.4 × ATR(4H) → 有效 sweep。

**3. 低时间框架（LTF – 15m）**

- 目标：在 OB/FVG 内找到精确入场。
- 过滤条件：
    1. OB/FVG 年龄 ≤ 2 天
- 入场确认条件：
    1. 吞没形态（Engulfing）：后一根 15m K 线实体 ≥ 前一根 1.5 倍，且方向与趋势一致。
    2. Sweep 微观速率：
        - sweep 发生在 ≤3 根 15m 内收回；
        - sweep 幅度 ÷ bar 数 ≥ 0.2 × ATR(15m)。
    3. 成交量放大（可选加强过滤）。

**4. 风险管理**

- 止损（SL）：
    - 上升趋势：OB 下沿 - 1.5×ATR(4H)，或最近 3 根 4H 的最低点。
    - 下降趋势：OB 上沿 + 1.5×ATR(4H)，或最近 3 根 4H 的最高点。
- 止盈（TP）：
    - 固定盈亏比 RR = 3:1
- 仓位计算：
    - 资金总额 = Equity
    - 风险资金 = Equity × 风险比例（如 1%）
    - 单位数 = 风险资金 ÷ 止损距离
    - 保证金 = Notional ÷ 杠杆

# **三、ICT 策略流程图**

```mermaid
flowchart TD

A([开始]) --> B[1D 趋势判断]
B -->|趋势=上升或下降| C[4H OB/FVG 检测]
B -->|趋势=震荡| Z([忽略信号])

C --> D{OB 过滤条件}
D -->|不满足| Z
D --> E[4H Sweep 宏观速率确认]

E -->|无效| Z
E -->|有效| F[15m 入场确认]

F --> G{OB/FVG ≤ 2天?}
G -->|否| Z
G -->|是| H[吞没形态确认]

H -->|不成立| Z
H -->|成立| I[15m Sweep 微观速率确认]

I -->|无效| Z
I -->|有效| J[设置入场 Entry]

J --> K[计算止损 SL]
K --> L[计算止盈 TP (RR=3:1)]
L --> M[计算仓位大小 (风险资金/SL距离)]
M --> N([输出交易信号])
N --> O([结束])
```

# 四、核心逻辑的代码实现示例：

1. 指标公式（ATR、均值、BOS、吞没、Sweep 等）
2. 趋势判断（1D）
3. 中级别 4H OB/FVG 检测
    - OB 最小高度过滤（>0.25×ATR）
    - OB 最大年龄过滤（≤30天）
    - Sweep 宏观速率判断（4H级别）
4. 低级别 15m 入场确认
    - OB/FVG 最大年龄过滤（≤2天）
    - 吞没形态 + 成交量确认
    - Sweep 微观速率判断（15m级别）
5. 止损、止盈、仓位计算
    - 止损：OB边界 ± 1.5×ATR
    - 止盈：RR = 3:1
    - 仓位：基于风险金额 / 止损距离

```jsx
// === 工具函数 ===

// ATR (Average True Range)
function atr(data, period = 14) {
  let trs = [];
  for (let i = 1; i < data.length; i++) {
    let h = data[i].high, l = data[i].low, cPrev = data[i - 1].close;
    let tr = Math.max(h - l, Math.abs(h - cPrev), Math.abs(l - cPrev));
    trs.push(tr);
  }
  let atrs = [];
  for (let i = 0; i < trs.length; i++) {
    if (i < period) atrs.push(null);
    else {
      let slice = trs.slice(i - period, i);
      atrs.push(slice.reduce((a, b) => a + b, 0) / period);
    }
  }
  return atrs;
}

// 简单均值
function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// 趋势检测（基于过去N天收盘价）
function detectTrend(data, lookback = 20) {
  let closes = data.map(d => d.close);
  let last = closes.slice(-lookback);
  if (last[last.length - 1] > last[0]) return "up";
  if (last[last.length - 1] < last[0]) return "down";
  return "sideways";
}

// 吞没蜡烛 (15m) 检测
function isEngulfing(prev, curr, atr15, trend = "up") {
  let prevBody = Math.abs(prev.close - prev.open);
  let currBody = Math.abs(curr.close - curr.open);

  if (currBody < 0.6 * atr15) return false;
  if (currBody < 1.5 * prevBody) return false;

  if (trend === "up") {
    return curr.close > prev.open && curr.open < prev.close;
  } else {
    return curr.close < prev.open && curr.open > prev.close;
  }
}

// Sweep 宏观速率 (4H) 检测
function detectSweepHTF(extreme, bars, atr4h) {
  // extreme: swing 高/低
  // bars: 最近几根 4H
  let exceed = bars[0].high - extreme;
  let barsToReturn = 0;
  for (let i = 1; i < bars.length; i++) {
    barsToReturn++;
    if (bars[i].close < extreme) break;
  }
  let sweepSpeed = exceed / barsToReturn;
  return sweepSpeed >= 0.4 * atr4h && barsToReturn <= 2;
}

// Sweep 微观速率 (15m) 检测
function detectSweepLTF(extreme, bars, atr15) {
  let exceed = bars[0].high - extreme;
  let barsToReturn = 0;
  for (let i = 1; i < bars.length; i++) {
    barsToReturn++;
    if (bars[i].close < extreme) break;
  }
  let sweepSpeed = exceed / barsToReturn;
  return sweepSpeed >= 0.2 * atr15 && barsToReturn <= 3;
}

// OB 检测 (简化: 前一根大阳/大阴 K 的区间)
function detectOB(data4H, atr4h, maxAgeDays = 30) {
  let obCandidates = [];
  let lastIndex = data4H.length - 2;
  let obBar = data4H[lastIndex];
  let ob = { low: obBar.low, high: obBar.high, time: obBar.time };

  // 过滤小OB
  if ((ob.high - ob.low) < 0.25 * atr4h) return null;

  // 过滤过期OB
  let now = new Date(data4H[data4H.length - 1].time);
  let obTime = new Date(ob.time);
  let ageDays = (now - obTime) / (1000 * 3600 * 24);
  if (ageDays > maxAgeDays) return null;

  return ob;
}

// === 策略主流程 ===
function ictStrategy({
  data1D,
  data4H,
  data15M,
  equity = 10000,
  riskPct = 0.01,
  RR = 3
}) {
  // Step 1: 趋势
  let trend = detectTrend(data1D);
  if (trend === "sideways") return null;

  let atr4hArr = atr(data4H, 14);
  let atr4h = atr4hArr[atr4hArr.length - 1];
  let atr15Arr = atr(data15M, 14);
  let atr15 = atr15Arr[atr15Arr.length - 1];

  // Step 2: 4H OB 检测
  let OB = detectOB(data4H, atr4h, 30);
  if (!OB) return null;

  // Step 3: Sweep (HTF 4H 层)
  let extreme = Math.max(...data4H.slice(-20).map(b => b.high)); // 示例：看上升趋势高点
  let hasSweepHTF = detectSweepHTF(extreme, data4H.slice(-3), atr4h);

  if (!hasSweepHTF) return null;

  // Step 4: 15m 入场确认 (OB/FVG 最大年龄 ≤ 2天)
  let now = new Date(data15M[data15M.length - 1].time);
  let obTime = new Date(OB.time);
  let ageDays = (now - obTime) / (1000 * 3600 * 24);
  if (ageDays > 2) return null;

  let last2 = data15M.slice(-2);
  let engulf = isEngulfing(last2[0], last2[1], atr15, trend);

  if (!engulf) return null;

  // Sweep (LTF 15m 层)
  let extreme15 = Math.max(...data15M.slice(-20).map(b => b.high));
  let hasSweepLTF = detectSweepLTF(extreme15, data15M.slice(-3), atr15);

  if (!hasSweepLTF) return null;

  // Step 5: Entry, SL, TP
  let entry = last2[1].close;
  let SL =
    trend === "up"
      ? Math.min(...data4H.slice(-3).map(b => b.low), OB.low - 1.5 * atr4h)
      : Math.max(...data4H.slice(-3).map(b => b.high), OB.high + 1.5 * atr4h);
  let stopDist = Math.abs(entry - SL);
  let TP = trend === "up" ? entry + RR * stopDist : entry - RR * stopDist;

  // Step 6: 仓位计算
  let riskAmount = equity * riskPct;
  let units = riskAmount / stopDist;
  let notional = entry * units;
  let leverage = 5;
  let margin = notional / leverage;

  return {
    trend,
    OB,
    hasSweepHTF,
    hasSweepLTF,
    entry,
    SL,
    TP,
    stopDist,
    units,
    notional,
    margin
  };
}
```

使用

```jsx
// 假设你已经加载好 1D/4H/15m 的数据 (数组，每个元素 = {open, high, low, close, volume})
const signal = ictStrategy({
  data1D: dailyData,
  data4H: fourHourData,
  data15M: fifteenMinData,
  equity: 10000,
  riskPct: 0.01,
  RR: 3
});

console.log(signal);
```

输出

```jsx
{
  "trend": "up",
  "OB": { "low": 1.1005, "high": 1.1050 },
  "hasSweep": true,
  "entry": 1.1030,
  "SL": 1.0975,
  "TP": 1.1105,
  "stopDist": 0.0055,
  "units": 18181.81,
  "notional": 20000,
  "margin": 4000
}
```

# **五、每日早上8点/12点/16点/20点 执行清单**

1. 确认 1D 趋势方向（上/下/无趋势） → 若无趋势，勿做。
2. 计算 ATR_4H、ATR_15、4H 平均量。
3. 在 4H 判断是否存在 candidate OB（按规则检测并过滤）→ 得到 top_OB。
4. 检查 top_OB 是否满足 overlap & volume & sweep（若不是高分则放弃）。
5. 切 15m，在 OB 区内等吞没+BOS+体量确认 → 触发入场。
6. 下单前计算 SL/TP/units（按上面的逐步公式），检查所需保证金是否在可接受范围。
7. 进场后按分批 TP/移动止损管理，并记录所有数据。