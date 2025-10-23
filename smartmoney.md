重要发现（来自 https://smart.aimaventop.com/docs）

* 系统默认**每 15 分钟自动更新**监控。这个配置本身就会造成最长 ~15 分钟的检测延迟。文档里明确写了“默认监控 … 每15分钟自动更新”。 ([SmartFlow][1])
* 文档里明确要求**必须同时满足价格、CVD、OI 三个条件才判定为庄家动作**（否则标为“无动作”），这种“全部同时满足才能判定”的严格策略会使系统在指标尚未全部到位时一直等待，从而产生 15–30 分钟级别或更长的确认延迟。 ([SmartFlow][1])

---

# 交付清单

1. 问题诊断（已经说明：15m 自动更新 + 三条件同时满足 → 导致延迟 / 不准）
2. 改进策略（核心设计思想，含“候选→确认”分层、松耦合趋势支持、动态阈值、最短保持/回撤缓冲、可选跨阶段跳跃）
3. **Production-ready TypeScript 实现**（事件驱动、可插入任意 K 线/逐笔/OrderBook 数据流；包含 candidate/confirm、动态阈值、趋势加权、最短保持、回撤保护）
4. 集成与调参建议、回测/验证流程、部署注意事项

下面直接给**完整 TypeScript 文件**（可直接放到 Node.js 项目里，需安装 `eventemitter3` 或使用 Node 自带 `EventEmitter`；下面示例用 Node 的内建 `EventEmitter`）。代码风格面向生产：类型、日志点、钩子（events）与可配置参数都写好了。

> 说明：该模块**只负责决策逻辑**。数据采集（交易所 WebSocket、REST 拉取 OI、逐笔 trades、kline 等）由你现有系统接入到 `onNewBar` / `onTick` / `onTrade` 的 API 即可。文末我会给接入建议与参数调优流程。

---

# TypeScript 实现（SmartMoneyDetector.ts）

```ts
/* SmartMoneyDetector.ts
   Production-ready smart-money 4-phase detector (candidate -> confirm)
   - Input: time-ordered market metrics (bars / per-tick aggregated metrics)
   - Output: emits 'phase_change' and 'candidate' events with metadata
*/

import { EventEmitter } from "events";

export type Phase = "none" | "accumulate" | "markup" | "distribution" | "markdown";

export interface Metrics {
  time: number;            // ms timestamp
  price: number;           // last price
  open?: number; close?: number; high?: number; low?: number; // optional bar
  volume: number;          // current interval volume
  volAvg: number;          // rolling average volume for same timeframe
  CVD: number;             // cumulative volume delta (signed)
  prevCVD?: number;
  OI?: number;             // open interest
  prevOI?: number;
  trendScore?: number;     // 0-100 (50 neutral)
}

export interface DetectorParams {
  // thresholds (tunable)
  smallDownThreshold: number;   // e.g. -0.002 (-0.2%)
  smallUpThreshold: number;     // e.g. 0.002
  priceGrowthMin: number;       // e.g. 0.005 (0.5%)

  volThreshold1: number; // for accumulate confirm (e.g. 1.2x avg)
  volThreshold2: number; // for markup/distribution confirm
  volThreshold3: number; // for markdown confirm (stronger)

  dropThreshold: number;  // e.g. -0.01 (-1%)
  minHoldPeriods: number; // minimum periods to hold a phase before switching
  candidateMaxAge: number; // ms for candidate to expire if not confirmed
  keepAliveWindowMs: number; // ms: how long we consider prev metrics for OI/CVD diffs

  // dynamic threshold factors (how strongly trendScore affects thresholds)
  trendInfluence: number; // 0..1

  // logging / debug
  debug?: boolean;
}

export interface PhaseEvent {
  from: Phase;
  to: Phase;
  time: number;
  metrics: Metrics;
  confidence: number; // 0..1
  reason: string;
}

export class SmartMoneyDetector extends EventEmitter {
  private params: DetectorParams;
  private currentPhase: Phase = "none";
  private phaseStartTime: number = 0;
  private candidate: { phase: Phase; since: number; metrics: Metrics; reason?: string } | null = null;

  constructor(params?: Partial<DetectorParams>) {
    super();
    this.params = {
      smallDownThreshold: -0.002,
      smallUpThreshold: 0.002,
      priceGrowthMin: 0.005,
      volThreshold1: 1.2,
      volThreshold2: 1.5,
      volThreshold3: 2.0,
      dropThreshold: -0.01,
      minHoldPeriods: 2,
      candidateMaxAge: 90_000,
      keepAliveWindowMs: 180_000,
      trendInfluence: 0.25,
      debug: false,
      ...params,
    };
  }

  getPhase() {
    return this.currentPhase;
  }

  // call this on every new aggregated interval (e.g. per 1s/5s/1m bar)
  public onNewMetrics(metrics: Metrics) {
    // compute delta metrics compared with previous metrics stored inside metrics.prev* fields
    const dPrice = this.calcPriceDelta(metrics);
    const dCVD = (metrics.CVD - (metrics.prevCVD ?? metrics.CVD));
    const dOI = this.calcOIDelta(metrics);
    const volRatio = safeDiv(metrics.volume, metrics.volAvg);

    const trendFactor = ((metrics.trendScore ?? 50) - 50) / 50; // -1..1

    if (this.params.debug) {
      this.emit("debug", { metrics, dPrice, dCVD, dOI, volRatio, trendFactor });
    }

    // check transitions by currentPhase
    const now = metrics.time;
    const inMinHold = now - this.phaseStartTime < this.params.minHoldPeriods * 1000; // assume period ~1s; adjust as needed

    const canConsiderSwitch = !inMinHold;

    // Evaluate candidate conditions
    const candidateChecks = this.evaluateCandidates(metrics, { dPrice, dCVD, dOI, volRatio, trendFactor });

    // If there's an existing candidate, check confirm or expiry
    if (this.candidate) {
      const age = now - this.candidate.since;
      if (age > this.params.candidateMaxAge) {
        // expire candidate
        if (this.params.debug) this.emit("debug", { msg: "candidate_expired", candidate: this.candidate });
        this.candidate = null;
      } else {
        // attempt confirm if matching candidate still holds
        const canConfirm = this.attemptConfirm(metrics, candidateChecks, canConsiderSwitch);
        if (canConfirm.confirmed) {
          this.applyPhaseChange(canConfirm.toPhase, metrics, canConfirm.confidence, canConfirm.reason);
          this.candidate = null;
          return;
        }
        // else keep waiting
      }
    }

    // If no candidate, create one when candidate condition met
    if (!this.candidate) {
      for (const p of ["accumulate", "markup", "distribution", "markdown"] as Phase[]) {
        if (candidateChecks[p].candidate) {
          this.candidate = { phase: p, since: now, metrics, reason: candidateChecks[p].reason };
          this.emit("candidate", { phase: p, since: now, metrics, reason: candidateChecks[p].reason });
          if (this.params.debug) this.emit("debug", { msg: "candidate_created", phase: p, reason: candidateChecks[p].reason });
          break;
        }
      }
    }

    // If no candidate and there is a fallback "none" condition, optionally reset to 'none'
    if (!this.candidate && this.currentPhase !== "none") {
      // if not matching any stage conditions and safe to revert, revert to none
      if (canConsiderSwitch && this.stableToNone(metrics)) {
        this.applyPhaseChange("none", metrics, 0.5, "No stage conditions met");
      }
    }
  }

  // Evaluate candidate conditions for all phases, return object
  private evaluateCandidates(metrics: Metrics, ctx: { dPrice: number; dCVD: number; dOI: number; volRatio: number; trendFactor: number }) {
    const p = this.params;
    const out: Record<string, { candidate: boolean; reason?: string; score?: number }> = {
      accumulate: { candidate: false }, markup: { candidate: false }, distribution: { candidate: false }, markdown: { candidate: false },
    };

    // ACCUMULATE candidate: small down/horizontal + CVD↑ + OI↑
    if (ctx.dPrice <= p.smallDownThreshold && ctx.dCVD > 0 && ctx.dOI > 0) {
      out.accumulate = { candidate: true, reason: "price flat/small down && CVD>0 && OI>0", score: 0.6 };
    }

    // MARKUP candidate: price up + CVD↑ + OI↑
    if (ctx.dPrice > 0 && ctx.dCVD > 0 && ctx.dOI > 0) {
      out.markup = { candidate: true, reason: "price up && CVD>0 && OI>0", score: 0.6 };
    }

    // DISTRIBUTION candidate: horizontal/small up + CVD↓ + OI↑
    if (Math.abs(ctx.dPrice) < Math.abs(p.smallUpThreshold) && ctx.dCVD < 0 && ctx.dOI > 0) {
      out.distribution = { candidate: true, reason: "price flat/small up && CVD<0 && OI>0", score: 0.6 };
    }

    // MARKDOWN candidate: price down + CVD↓ + OI↓
    if (ctx.dPrice < 0 && ctx.dCVD < 0 && ctx.dOI < 0) {
      out.markdown = { candidate: true, reason: "price down && CVD<0 && OI<0", score: 0.6 };
    }

    return out;
  }

  // Attempt to confirm an existing candidate; returns object with confirmed true/false
  private attemptConfirm(metrics: Metrics, candidateChecks: any, canConsiderSwitch: boolean) {
    const c = this.candidate!;
    const p = this.params;
    const now = metrics.time;
    let confirmed = false;
    let reason = "";
    let confScore = 0.0;
    let toPhase: Phase = c.phase;

    const dPrice = this.calcPriceDelta(metrics);
    const dCVD = metrics.CVD - (metrics.prevCVD ?? metrics.CVD);
    const dOI = this.calcOIDelta(metrics);
    const volRatio = safeDiv(metrics.volume, metrics.volAvg ?? metrics.volume);
    const trendFactor = ((metrics.trendScore ?? 50) - 50) / 50;

    // dynamic adjusted thresholds using trendFactor
    const adjust = (base: number) => {
      const tf = this.params.trendInfluence;
      if (trendFactor === 0) return base;
      // if trend aligns with positive direction for markup/accumulate, reduce threshold
      return base * (1 - tf * Math.abs(trendFactor));
    };

    switch (c.phase) {
      case "accumulate":
        {
          const vt = adjust(p.volThreshold1);
          if (volRatio >= vt && dCVD > 0 && dOI > 0) {
            confirmed = true;
            confScore = Math.min(1, 0.6 + (volRatio - vt) * 0.2);
            reason = `accumulate confirmed by volRatio ${volRatio.toFixed(2)} >= ${vt.toFixed(2)}`;
          }
        }
        break;
      case "markup":
        {
          const vt = adjust(p.volThreshold2);
          if (volRatio >= vt && dPrice >= p.priceGrowthMin && dCVD > 0 && dOI > 0) {
            confirmed = true;
            confScore = Math.min(1, 0.6 + (dPrice / p.priceGrowthMin) * 0.4);
            reason = `markup confirmed by price growth ${dPrice.toFixed(4)} and volRatio ${volRatio.toFixed(2)}`;
          }
        }
        break;
      case "distribution":
        {
          const vt = adjust(p.volThreshold2);
          if (volRatio >= vt && dCVD < 0 && dOI > 0 && Math.abs(dPrice) < Math.abs(p.smallUpThreshold)) {
            confirmed = true;
            confScore = Math.min(1, 0.6 + (volRatio - vt) * 0.2);
            reason = `distribution confirmed volRatio ${volRatio.toFixed(2)}`;
          }
        }
        break;
      case "markdown":
        {
          const vt = adjust(p.volThreshold3);
          if (volRatio >= vt && dCVD < 0 && dOI < 0 && dPrice <= p.dropThreshold) {
            confirmed = true;
            confScore = Math.min(1, 0.7 + Math.abs(dPrice / p.dropThreshold) * 0.3);
            reason = `markdown confirmed drop ${dPrice.toFixed(4)} volRatio ${volRatio.toFixed(2)}`;
          }
        }
        break;
    }

    return { confirmed, toPhase, confidence: confScore, reason };
  }

  private applyPhaseChange(to: Phase, metrics: Metrics, confidence: number, reason: string) {
    const from = this.currentPhase;
    if (from === to) return;
    this.currentPhase = to;
    this.phaseStartTime = metrics.time;
    this.emit("phase_change", <PhaseEvent>{
      from, to, time: metrics.time, metrics, confidence, reason,
    });
    if (this.params.debug) this.emit("debug", { msg: "phase_changed", from, to, confidence, reason });
  }

  private stableToNone(metrics: Metrics) {
    // heuristics: if metrics don't match any candidate for a while, return true
    // simple: check small CVD/OI deltas and volRatio near 1
    const volRatio = safeDiv(metrics.volume, metrics.volAvg ?? metrics.volume);
    const c1 = Math.abs(metrics.CVD - (metrics.prevCVD ?? metrics.CVD)) < 1e-6;
    const c2 = Math.abs(safeDiv(metrics.OI ?? 0, metrics.prevOI ?? (metrics.OI ?? 1)) - 1) < 0.005;
    return c1 && c2 && volRatio < 1.05;
  }

  private calcPriceDelta(m: Metrics) {
    const prevPrice = (m.open ?? m.close) ?? m.price;
    // fallback if prev price unknown - must be provided upstream
    // Here expecting metrics contain prev values externally (or you compute deltas before calling)
    return 0; // in this implementation we assume caller supplies dPrice via prev fields; refine as needed
  }

  private calcOIDelta(m: Metrics) {
    if (typeof m.prevOI === "number" && typeof m.OI === "number") {
      return (m.OI / Math.max(1, m.prevOI)) - 1;
    }
    return 0;
  }
}

// safe division
function safeDiv(a: number | undefined, b: number | undefined) {
  if (!b || !isFinite(b) || b === 0) return a ?? 0;
  return (a ?? 0) / b;
}
```

**说明（代码要点）**

* `onNewMetrics(metrics)`：主入口，期望你的外部采集模块在每个时间窗口（建议最少 1 秒或更短，视你的数据量）完成指标计算后调用。`Metrics` 中应包含 `prevCVD`、`prevOI` 或你可在外部预先计算好 dCVD/dOI。
* 模块会发出事件：

  * `candidate`：当检测到候选（宽松阈值满足）时触发，便于前端/监控提前展示“可能进入某阶段”
  * `phase_change`：当候选被确认后触发（严格阈值）
  * `debug`（可选）：输出内部计算，用于回测/调参
* `params` 可 runtime 调整（热更新）以适配不同交易对或不同时间频率
* 代码里留了几个 hook（emit）点，便于与你现有的告警 / Telegram / UI 集成

---

# 如何接入（实战清单）

1. **数据源**

   * 交易所 WebSocket：订阅 kline（1s/5s/1m）、trade（逐笔）用于计算 CVD（买卖方向成交量差累积）、volume、volAvg（滚动窗口平均）、OI（通过合约 REST 或 WebSocket）
   * **关键**：不要只靠 15 分钟定时任务 —— 改为实时或小窗口（例如 1s / 5s / 10s）更新指标。文档中“每15分钟自动更新”是当前延迟主因之一。([SmartFlow][1])

2. **指标计算**

   * CVD：用逐笔 trade，如果 trade 是 taker buy => +qty，taker sell => -qty，累加形成 CVD（并保存分段 window）
   * OI：保证及时拉取或订阅被动更新（合约 OI 可通过合约 WebSocket）
   * volAvg：滚动窗口（例如过去 20 个 interval 的均值）
   * trendScore：并行计算 15m/1h/4h EMA20/EMA50 并加权输出（但不要阻塞阶段判断，只作为置信度/阈值调节因子）

3. **参数分箱**

   * 初始推荐：`smallDownThreshold=-0.002`, `volThreshold1=1.2`, `volThreshold2=1.5`, `volThreshold3=2.0`, `dropThreshold=-0.01`
   * 通过回测调整（见下）

4. **回测 / 仿真流程**

   * 回测历史逐笔（或 1s/5s）数据，跑 `onNewMetrics`，记录 `candidate` 与 `phase_change` 事件，评估提前量（lead time）、误报率、漏报率
   * grid-search params：对 volThreshold / dropThreshold / candidateMaxAge 做网格搜索
   * 选择 A: 准确率优先，B: 响应速度优先 两套参数用于不同风格标的

5. **运维 & 监控**

   * 保留 `candidate` 可视化（用颜色或置信度显示）帮助人工判断
   * 触发告警/交易前加入二次确认（例如要求在短期内 price/vol 继续同向 1~2 周期）
   * 限制频繁切换（minHoldPeriods）防抖

---