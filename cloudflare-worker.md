# smart flow- cloudflare worker

把整个系统整合成一个 可在 Cloudflare Worker 或 Pages 上运行的完整方案，包括：

1. 后台定时策略分析（Cron Trigger 或 Worker Scheduled Event）
2. 多品种数据收集（BTC/ETH/LINK/LDO 永续合约）
3. 日线趋势 + 小时级别确认 + 15m 执行模拟
4. Telegram 推送（信号触发立即推送）
5. 前端可视化页面（K 线 + 当前信号状态）

# **整体架构设计**

```markdown
Worker/Pages
├── /analyze?symbol=BTCUSDT    # 返回 JSON 分析结果
├── /                        # 前端页面，展示所有品种信号
├── scheduled()              # 每小时触发分析并发送 Telegram
└── KV (可选)                # 保存历史日志，前端可展示
```

# **Worker/Pages 统一脚本（示例）**

```jsx
export default {
  async scheduled(event, env, ctx) {
    // 每小时定时触发
    const symbols = ["BTCUSDT", "ETHUSDT", "LINKUSDT", "LDOUSDT"];
    for (const s of symbols) {
      const signal = await analyze(s, env);
      if (signal.signal !== "NO_SIGNAL") {
        await notifyTelegram(env, signal);
      }
      // 可选：存入 KV
      await env.TRADE_LOG.put(`${s}:${Date.now()}`, JSON.stringify(signal));
    }
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    const symbol = url.searchParams.get("symbol");

    if (url.pathname === "/analyze" && symbol) {
      const result = await analyze(symbol, env);
      return new Response(JSON.stringify(result, null, 2), { headers: { "Content-Type": "application/json" } });
    }

    // 前端页面
    return new Response(generateFrontendPage(), { headers: { "Content-Type": "text/html;charset=UTF-8" } });
  }
};

// ---------------- 工具函数 ----------------

async function getKlines(symbol, interval, limit = 500) {
  const res = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
  const data = await res.json();
  return data.map(k => ({
    time: k[0], open: parseFloat(k[1]), high: parseFloat(k[2]),
    low: parseFloat(k[3]), close: parseFloat(k[4]), volume: parseFloat(k[5])
  }));
}

function sma(values, period) {
  if (values.length < period) return [];
  let res = [];
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    res.push(slice.reduce((a, b) => a + b, 0) / period);
  }
  return res;
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

async function analyze(symbol, env) {
  const now = new Date().toISOString();
  const daily = await getKlines(symbol, "1d", 250);
  const closesD = daily.map(c => c.close);
  const ma20 = sma(closesD, 20).at(-1);
  const ma50 = sma(closesD, 50).at(-1);
  const ma200 = sma(closesD, 200).at(-1);
  const lastClose = closesD.at(-1);

  let trend = "RANGE";
  if (ma20 > ma50 && ma50 > ma200 && lastClose > ma20) trend = "UPTREND";
  if (ma20 < ma50 && ma50 < ma200 && lastClose < ma20) trend = "DOWNTREND";

  if (trend === "RANGE") return { time: now, symbol, trend, signal: "NO_SIGNAL" };

  // 小时确认
  const hourly = await getKlines(symbol, "1h", 200);
  const closesH = hourly.map(c => c.close);
  const volsH = hourly.map(c => c.volume);
  const vwap = calcVWAP(hourly).at(-1);
  const lastCloseH = closesH.at(-1);
  const avgVol = sma(volsH, 20).at(-1);
  const lastVol = volsH.at(-1);

  const highs20 = hourly.slice(-20).map(c => c.high);
  const lows20 = hourly.slice(-20).map(c => c.low);
  const breakoutUp = lastCloseH > Math.max(...highs20);
  const breakoutDown = lastCloseH < Math.min(...lows20);

  const fr = await fetch(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=1`);
  const funding = parseFloat((await fr.json())[0].fundingRate);

  let signal = "NO_SIGNAL";
  if (trend === "UPTREND" && lastCloseH > vwap && breakoutUp && lastVol > 1.5 * avgVol && Math.abs(funding) < 0.001)
    signal = "LONG_SIGNAL";
  if (trend === "DOWNTREND" && lastCloseH < vwap && breakoutDown && lastVol > 1.5 * avgVol && Math.abs(funding) < 0.001)
    signal = "SHORT_SIGNAL";

  // 15m 执行模拟
  let setupHigh = null, setupLow = null, stopLoss = null, targetPrice = null;
  if (signal !== "NO_SIGNAL") {
    const m15 = await getKlines(symbol, "15m", 50);
    const setupK = m15[m15.length - 2];
    setupHigh = setupK.high;
    setupLow = setupK.low;

    if (signal === "LONG_SIGNAL") {
      stopLoss = setupLow;
      targetPrice = lastCloseH + 2 * (lastCloseH - stopLoss);
    } else {
      stopLoss = setupHigh;
      targetPrice = lastCloseH - 2 * (stopLoss - lastCloseH);
    }
  }

  return { time: now, symbol, trend, closeH: lastCloseH, vwap, volume: lastVol, avgVol, funding, signal, setupHigh, setupLow, stopLoss, targetPrice };
}

async function notifyTelegram(env, signal) {
  const message = `⚡ ${signal.symbol} 触发信号\n趋势: ${signal.trend}\n信号: ${signal.signal}\n入场: ${signal.closeH}\n止损: ${signal.stopLoss}\n目标: ${signal.targetPrice}`;
  await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.TG_CHAT_ID, text: message })
  });
}

// ---------------- 前端简易页面 ----------------
function generateFrontendPage() {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>Crypto Signal Dashboard</title>
    <style>
      body { font-family: sans-serif; padding: 20px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ccc; padding: 8px; text-align: center; }
      th { background: #eee; }
    </style>
  </head>
  <body>
    <h1>Crypto Signal Dashboard</h1>
    <table id="signalTable">
      <thead>
        <tr>
          <th>Symbol</th><th>Trend</th><th>Signal</th><th>Last Close</th><th>SetupHigh</th><th>SetupLow</th><th>StopLoss</th><th>Target</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
    <script>
      const symbols = ["BTCUSDT","ETHUSDT","LINKUSDT","LDOUSDT"];
      const tbody = document.querySelector("tbody");
      symbols.forEach(async sym => {
        const res = await fetch('/analyze?symbol=' + sym);
        const data = await res.json();
        const row = document.createElement("tr");
        row.innerHTML = '<td>'+data.symbol+'</td><td>'+data.trend+'</td><td>'+data.signal+'</td><td>'+data.closeH+'</td><td>'+data.setupHigh+'</td><td>'+data.setupLow+'</td><td>'+data.stopLoss+'</td><td>'+data.targetPrice+'</td>';
        tbody.appendChild(row);
      });
    </script>
  </body>
  </html>
  `;
}
```

**✅ 部署步骤**

1. 创建 Worker/Pages 项目

npm create cloudflare@latest my-trader

cd my-trader

1. 配置 wrangler.toml

```toml
name = "smartflow-trader"
main = "src/index.js"
compatibility_date = "2025-09-05"

[vars]
TG_BOT_TOKEN = "你的telegram_bot_token"
TG_CHAT_ID = "你的chat_id"

[[triggers]]
cron = "0 * * * *"   # 每小时执行一次
```

1. 部署

npx wrangler deploy

1. 访问前端

https://yourdomain.com/  # 可看到四个品种信号表格

1. Telegram 推送
- 每小时定时分析
- 触发信号立即推送消息

这样，你就有了一个Cloudflare 全栈部署的策略系统：

- 定时后台策略分析 + Telegram报警
- 前端页面可视化实时查看信号
- 多品种支持 + 15m 执行模拟