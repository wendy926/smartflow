# smartflow - strategy

这是一套「多周期共振 · 高胜率 高盈亏比」完整可执行方案（新手可照单执行）。

# **一、系统结构（3 层共振）**

大周期过滤（4H/日线） → 中周期确认（1H） → 小周期执行（15m）

- 趋势过滤（4H/1D）：MA50 相对 MA200；价格是否在 MA50 上；资金费率是否温和（|FR| ≤ 0.1%/8h）；OI 6h 变动是否顺势（多 ≥ +2%，空 ≤ -2%）。
- 入场确认（1H）：价格与 VWAP 方向一致；突破近 20 根高/低点；放量 ≥ 1.5×(20MA)；CVD 与方向一致；ATR 允许 ≥1:2 盈亏比。
- 执行时机（15m）：回踩 EMA20/50 或前高/前低位缩量不破；用“突破触发单”入场；止损放在触发 K 另一侧或 1.2×ATR(14)（取更远）。

对称适用于做空。

# **二、指标与参数（默认）**

- 趋势：MA(50/200)，VWAP（锚定当日/会话），资金费率绝对值≤0.1%/8h，OI 6h 变动阈值 ±2%。
- 确认：1H 突破 20 根高/低、成交量≥1.5×(20SMA)，CVD 同向，ATR(14) 评估空间。
- 执行：15m EMA(20/50)；触发=突破“设置 K”高/低；Taker 主动成交量同向。

所有参数已写入：MTF_SmartFlow_Config.json

# **三、入场规则（傻瓜式）**

# **做多**

1. 先看 4H/1D：MA50＞MA200 且价在 MA50 上；|FR|≤0.1%；OI 6h 变动 ≥ +2%。
2. 切 1H：价格在 VWAP 上；突破近 20 根高点；放量≥1.5×；CVD 向上；ATR 允许≥1:2。
3. 切 15m：等待回踩 EMA20/50 或前高支撑缩量企稳；挂止损单在触发 K 的高点上方（加最小跳动/约 0.05% 垫步）。
4. 止损：触发 K 的低点或 1.2×ATR(14)（取更远）。
5. 仓位：数量 = 账户权益×风险比例 / 止损距离（按风险定仓位）。
6. 杠杆：仅为降低保证金；把强平价放在止损外≥3×止损距离。

# **做空（镜像反向）**

- 条件与操作完全对称：方向、突破、放量、CVD、止损与触发位均镜像。

# **四、盈亏比与持仓管理**

- 固定规则：
    - +1R：止损提至保本；
    - +1.5R：减仓 30%；
    - +2R：启用追踪止盈（15m ATR×1.5 类“吊灯止盈”）；
- 硬退出：
    - 1H 上 OI 自入场后峰值回落 >3% + CVD 背离；
    - 入场 8 小时未达 +0.5R；
    - 当日净成绩 ≤ -3R（停手）。

# **五、风险与资金管理（默认）**

- 单笔风险 1% 账户权益；最多 3 笔同时持仓；避免同向强相关品种过度集中。
- 不追求高胜率，追求盈亏比 ≥ 1:2 与纪律执行。
- 手续费/滑点：回测与小额实盘先测真实成本；若成本过高，放宽触发与减少交易频率。

# **六、每天怎么做（新手流程）**

1. 早上 10 分钟：跑一遍 4H/1D 过滤（不合格品种直接跳过）。
2. 每整点：看 1H 是否满足突破+放量+CVD 同向+ATR 空间。
3. 符合才切 15m：等回踩 → 挂突破触发单与止损 → 计算仓位 → 下单。
4. 进场后：按 1R/1.5R/2R 规则处理；同时盯 1H OI 与 CVD。
5. 复盘：把每笔写进 MTF_SmartFlow_TradeLog.csv，周末统计胜率/期望/回撤。

# **七、调优与验证**

- 先做 模拟或小资金 连续 ≥ 50 笔；仅在样本足够后小步调参（一次改一个，记录变化）。
- 建议优先调：1H 突破窗口（20→30）、放量倍数（1.5→1.8）、15m ATR 倍数（1.2→1.4）。

# **八、常见坑**

- 逆势（没过 4H/1D 过滤）；
- 只见价格不看放量与 OI；
- 15m 追单导致止损太近；
- 不执行 -3R 日损停手；
- 资金费率极端却强行入场。

# **可下载材料（已为你生成）**

- 配置文件（可导入自定义工具或作为策略参数参考）：MTF_SmartFlow_Config.json

```json
{
  "system_name": "MTF_SmartFlow_v1",
  "timeframes": {
    "trend": "4H / 1D",
    "confirm": "1H",
    "execute": "15m (or 5m for tighter stops)"
  },
  "indicators": {
    "trend": {
      "MA": {
        "fast": 50,
        "slow": 200,
        "slope_filter": true
      },
      "VWAP": {
        "anchor": "session/day"
      },
      "FundingRate": {
        "abs_max_per_8h": 0.001
      },
      "OpenInterest": {
        "roc_lookback_hours": 6,
        "long_threshold": 0.02,
        "short_threshold": -0.02
      }
    },
    "confirm": {
      "VWAP": {
        "above_for_long": true,
        "below_for_short": true
      },
      "Breakout": {
        "lookback_bars": 20
      },
      "Volume": {
        "multiple_vs_sma": 1.5,
        "sma_len": 20
      },
      "CVD": {
        "slope_len": 10,
        "direction": "same_as_trade_direction"
      },
      "ATR": {
        "len": 14
      }
    },
    "execute": {
      "EMA": {
        "fast": 20,
        "slow": 50
      },
      "Trigger": "break of setup candle high/low",
      "TakerFlow": {
        "use": true,
        "confirm_direction": true
      }
    }
  },
  "entries": {
    "long": [
      "4H/1D: MA50 > MA200 & price above MA50",
      "4H: OI 6h ROC >= +2% & |Funding| <= 0.1%/8h",
      "1H: Price above VWAP; break 20-bar high with Volume >= 1.5x 20SMA; CVD up",
      "15m: Pullback to EMA20/50 or prior breakout level; trigger = break of setup candle high"
    ],
    "short": [
      "4H/1D: MA50 < MA200 & price below MA50",
      "4H: OI 6h ROC <= -2% & |Funding| <= 0.1%/8h",
      "1H: Price below VWAP; break 20-bar low with Volume >= 1.5x 20SMA; CVD down",
      "15m: Pullback to EMA20/50 or prior breakdown level; trigger = break of setup candle low"
    ]
  },
  "position_sizing": {
    "risk_per_trade": 0.01,
    "max_daily_R": -3,
    "max_concurrent_positions": 3,
    "calc": "qty = (equity * risk_per_trade) / stop_distance_in_quote",
    "leverage_note": "Choose leverage so liquidation is >3x stop distance away; size by risk, not by leverage."
  },
  "stops_targets": {
    "stop_loss": "15m ATR(14) * 1.2 or last swing (choose farther)",
    "breakeven": "at +1R move stop to entry",
    "partial_take": "30% at +1.5R",
    "trailing": "from +2R, trail by 15m ATR(14) * 1.5 (chandelier-style)",
    "hard_exit": [
      "1H OI drops >3% from post-entry peak + CVD diverges",
      "Time stop: no +0.5R after 8 hours"
    ]
  },
  "filters": {
    "correlation": "Avoid >2 highly correlated longs/shorts",
    "liquidity": "Prefer top-10 perp pairs by volume",
    "schedule": "Avoid 30m around major macro prints (if applicable)"
  },
  "review": {
    "weekly": [
      "Win rate",
      "Average R",
      "Expectancy",
      "Max drawdown",
      "Compliance to rules"
    ],
    "notes": "Adjust thresholds only after >= 50 trades"
  }
}
```

- 交易日志模板（直接记录每笔，自动算 R 最方便）：MTF_SmartFlow_TradeLog.csv

| Datetime_UTC | Symbol | Direction | Trend_OK | Confirm_OK | Execute_OK | Entry | Stop | Target1 | Risk_R | Qty | Leverage | Fees | Slippage | Exit | ExitReason | PnL_R | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
- 新手操作手册（逐步流程，照着做）：MTF_SmartFlow_Playbook.md

```markdown
# MTF SmartFlow v1 — 操作手册（新手可直接照做）

**更新时间**：2025-09-05 00:45 UTC

## 0. 统一风险
- 账户单笔风险：1%（可在 `MTF_SmartFlow_Config.json` 修改）。
- 当日最大亏损：-3R（达到后当天停止交易）。

## 1. 每日准备（10 分钟）
1) 打开 1D/4H 图：
   - 多头仅在 MA50 > MA200、价格在 MA50 上方时操作；
   - 空头仅在 MA50 < MA200、价格在 MA50 下方时操作。
2) 检查 4H：资金费率 |FR| ≤ 0.1%/8h；OI 6 小时变动：多头需 ≥ +2%，空头需 ≤ -2%。

## 2. 寻找机会（每小时巡检 1H）
- 条件全部满足才继续：
  - 价格在 VWAP 上方（做多）/下方（做空）；
  - 突破 1H 近 20 根 K 高/低点；
  - 放量 ≥ 1.5 × 20SMA；
  - CVD 与方向一致；
  - ATR(14) 显示至少可做 ≥ 1:2 的盈亏比。

## 3. 执行入场（15m）
1) 等待回踩（做多示例）：回踩到 EMA20/EMA50 或前高支撑，缩量不破位；
2) 触发方式：挂“突破买入”止损单在触发 K 高点之上（加最小跳动/0.05% 垫步）；
3) 止损：放在触发 K 低点或 1.2×ATR(14)（二者取更远）；
4) 头寸：`数量 = 账户权益 × 风险比例 / 止损距离`；
5) 杠杆：仅用于降低保证金占用；把强平价远离止损 ≥ 3× 止损距离。

（做空对称处理）

## 4. 出场与持仓管理
- +1R：止损抬到保本；
- +1.5R：止盈 30%；
- +2R：启动追踪止盈（1.5× ATR(15m)）；
- 硬性退出：
  - 1H OI 自入场后峰值回落 > 3% 且 CVD 背离；
  - 入场 8 小时未达 +0.5R；
  - 当日已达 -3R。

## 5. 记录与复盘
- 每笔交易填写 `MTF_SmartFlow_TradeLog.csv`；
- 每周统计：胜率、平均盈利 R、期望值 E、最大回撤；
- 仅在累计 ≥ 50 笔后再微调参数（一次只改一个）。

## 6. 常见错误
- 逆势入场（没过 1D/4H 过滤）；
- 不等 1H 放量突破；
- 15m 随意追单导致止损过近；
- 不按 -3R 日损停手。

> 提示：本手册仅为教育用途，不构成投资建议。请先小额或模拟盘验证。
```