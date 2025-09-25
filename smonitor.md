这是一个完全免费 + 多交易所覆盖的监控框架，可以监控：

- 链上大额资金流
- 市场情绪
- 合约市场风险（多空比 / OI / 资金费率）
- 宏观金融风险（利率 + 通胀）

# **一、监控框架说明**

- 资金流向：Blockchair（BTC大额交易） + Etherscan（交易所钱包大额ETH转账）
- 市场情绪：Fear & Greed Index
- 合约市场指标：Binance + Bybit + OKX
    - 多空比（Long/Short Ratio）
    - 未平仓合约（Open Interest）
    - 资金费率（Funding Rate）
- 宏观指标：FRED
    - 美联储利率
    - CPI同比通胀率
        - **通胀率计算逻辑**
        - FRED 数据集：CPIAUCSL （1982-84=100 为基期，月度数据）。
        - 取最近一个月（latest）与去年同月（latest - 12）做比较：
        
        通胀率 (%) = (CPI_now - CPI_last_year) / CPI_last_year * 100
        
        - 报警阈值：
            - 4% → ⚠ 高通胀风险
            - < 1% → ⚠ 通缩风险

# **二、 JS 实现示例**

```jsx
// npm i node-fetch
const fetch = require("node-fetch");

// ========== 配置 ==========
const ETHERSCAN_KEY = process.env.ETHERSCAN_KEY || "YOUR_ETHERSCAN_KEY"; // Etherscan 免费注册
const FRED_KEY = process.env.FRED_KEY || "YOUR_FRED_KEY"; // FRED 免费注册

const BLOCKCHAIR_API = "https://api.blockchair.com/bitcoin/transactions?q=value_usd(gt.1000000)";
const FEAR_GREED_API = "https://api.alternative.me/fng/?limit=1";

const BINANCE_LONG_SHORT = "https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=5m";
const BINANCE_OI = "https://fapi.binance.com/futures/data/openInterestHist?symbol=BTCUSDT&period=5m";

const BYBIT_LONG_SHORT = "https://api.bybit.com/v2/public/position/list?symbol=BTCUSD";
const BYBIT_FUNDING = "https://api.bybit.com/v2/public/funding/prev-funding-rate?symbol=BTCUSD";

const OKX_OI = "https://www.okx.com/api/v5/public/open-interest?instId=BTC-USDT-SWAP";
const OKX_FUNDING = "https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USDT-SWAP";

// Binance ETH 热钱包示例
const EXCHANGE_WALLET = "0x28C6c06298d514Db089934071355E5743bf21d60";

// ========== 资金流监控 ==========
async function checkLargeTx_Blockchair() {
  const r = await fetch(BLOCKCHAIR_API);
  const j = await r.json();
  if (j.data && j.data.length > 0) {
    j.data.forEach(tx => {
      const usd = parseFloat(tx.value_usd || 0);
      if (usd > 0) {
        console.log("BTC大额交易：", usd, "USD Hash:", tx.transaction_hash);
        if (usd > 10_000_000) console.warn("⚠ 大额BTC转账报警！", usd, "USD");
      }
    });
  }
}

async function checkExchangeFlows() {
  const url = `https://api.etherscan.io/api?module=account&action=txlist&address=${EXCHANGE_WALLET}&apikey=${ETHERSCAN_KEY}`;
  const r = await fetch(url);
  const j = await r.json();
  if (j.status === "1") {
    j.result.slice(-5).forEach(tx => {
      const valueEth = parseFloat(tx.value) / 1e18;
      if (valueEth > 1000) console.warn("⚠ 交易所钱包大额转账:", valueEth, "ETH Hash:", tx.hash);
    });
  }
}

// ========== 市场情绪 ==========
async function checkFearGreed() {
  const r = await fetch(FEAR_GREED_API);
  const j = await r.json();
  const idx = parseInt(j.data[0].value);
  console.log("市场恐惧贪婪指数:", idx, "(", j.data[0].value_classification, ")");
  if (idx < 20) console.warn("⚠ 极度恐惧！可能出现反转机会");
  if (idx > 80) console.warn("⚠ 极度贪婪！注意市场过热风险");
}

// ========== 合约市场指标（替代 Coinglass） ==========
async function checkFuturesMarkets() {
  try {
    // ----- Binance -----
    let r = await fetch(BINANCE_LONG_SHORT);
    let data = await r.json();
    if (Array.isArray(data) && data.length > 0) {
      const latest = data[data.length-1];
      const ratio = parseFloat(latest.longShortRatio);
      console.log("[Binance] 多空比:", ratio);
      if(ratio > 2) console.warn("⚠ Binance 多头过热");
      if(ratio < 0.5) console.warn("⚠ Binance 空头过重");
    }

    r = await fetch(BINANCE_OI);
    data = await r.json();
    if(Array.isArray(data) && data.length>0){
      console.log("[Binance] 未平仓合约:", data[data.length-1].sumOpenInterest, "USD");
    }

    // ----- Bybit -----
    r = await fetch(BYBIT_LONG_SHORT);
    data = await r.json();
    if(data.result && data.result.length>0){
      const positions = data.result;
      const long = positions.filter(p=>p.side==="Buy").length;
      const short = positions.filter(p=>p.side==="Sell").length;
      console.log(`[Bybit] 多:${long} 空:${short} 总:${positions.length}`);
      if(long/short>2) console.warn("⚠ Bybit 多头过热");
      if(long/short<0.5) console.warn("⚠ Bybit 空头过重");
    }

    r = await fetch(BYBIT_FUNDING);
    data = await r.json();
    if(data.result && data.result.length>0){
      console.log("[Bybit] 资金费率:", data.result[0].funding_rate);
    }

    // ----- OKX -----
    r = await fetch(OKX_OI);
    data = await r.json();
    if(data.data && data.data.length>0){
      console.log("[OKX] 未平仓合约:", data.data[0].oi);
    }

    r = await fetch(OKX_FUNDING);
    data = await r.json();
    if(data.data && data.data.length>0){
      console.log("[OKX] 资金费率:", data.data[0].fundingRate);
    }

  } catch(e){
    console.error("合约市场监控出错:", e.message);
  }
}

// ========== 宏观指标（FRED） ==========

// 美联储利率
async function checkFedFunds() {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=FEDFUNDS&api_key=${FRED_KEY}&file_type=json`;
  const r = await fetch(url);
  const j = await r.json();
  const obs = j.observations;
  if(obs && obs.length>0){
    const latest = obs[obs.length-1];
    const value = parseFloat(latest.value);
    console.log(`美联储利率: ${value}% (${latest.date})`);
    if(value>5) console.warn(`⚠ 利率过高 (${value}%)`);
    if(value<2) console.warn(`⚠ 利率过低 (${value}%)`);
  }
}

// CPI同比通胀率
async function checkCPI() {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL&api_key=${FRED_KEY}&file_type=json`;
  const r = await fetch(url);
  const j = await r.json();
  const obs = j.observations;
  if(obs && obs.length>12){
    const latest = obs[obs.length-1];
    const lastYear = obs[obs.length-13];
    const yoy = ((parseFloat(latest.value)-parseFloat(lastYear.value))/parseFloat(lastYear.value))*100;
    console.log(`美国CPI同比: ${yoy.toFixed(2)}% (${latest.date})`);
    if(yoy>4) console.warn(`⚠ 高通胀风险 (${yoy.toFixed(2)}%)`);
    if(yoy<1) console.warn(`⚠ 通缩风险 (${yoy.toFixed(2)}%)`);
  }
}

async function checkMacro() {
  await checkFedFunds();
  await checkCPI();
}

// ========== 主程序 ==========
async function run() {
  await checkLargeTx_Blockchair();
  await checkExchangeFlows();
  await checkFearGreed();
  await checkFuturesMarkets();
  await checkMacro();
}

setInterval(run, 60_000); // 每分钟跑一次
```

# **三、资金流向监控的实现逻辑**
```jsx
import fetch from "node-fetch";

// === 地址标签库 ===
const walletLabels = {
  BTC: {
    binance: ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"],
    coinbase: ["3Cbq7aT1tY8kMxWLbitaG7yT6bPbKChq64"],
    kraken: ["3M219KRhuz2Q2DcbLNCgH3BeE4Y3H3w8sN"],
    whales: ["1FeexV6bAHb8ybZjqQMjJrcCrHGW9sb6uF"],
  },
  ETH: {
    binance: ["0x564286362092D8e7936f0549571a803B203aAceD".toLowerCase()],
    coinbase: ["0x503828976D22510aad0201ac7EC88293211D23Da".toLowerCase()],
    kraken: ["0x0a869d79a7052c7f1b55a8ebabbea3420f0d1e13".toLowerCase()],
    whales: ["0x742d35Cc6634C0532925a3b844Bc454e4438f44e".toLowerCase()],
  },
};

// === 判断地址标签 ===
function getAddressLabel(addr, chain = "BTC") {
  const labels = walletLabels[chain];
  for (const [name, list] of Object.entries(labels)) {
    if (list.includes(addr)) return name;
  }
  return "unknown";
}

// === BTC 大额转账监控 ===
async function monitorBTC(threshold = 5_000_000) {
  try {
    const url = `https://api.blockchair.com/bitcoin/transactions?q=value_usd(${threshold}..)`;
    const res = await fetch(url);
    const json = await res.json();

    for (const tx of json.data || []) {
      const inputs = tx.inputs.map((i) => i.recipient);
      const outputs = tx.outputs.map((o) => o.recipient);

      const inputLabels = inputs.map((i) => getAddressLabel(i, "BTC"));
      const outputLabels = outputs.map((o) => getAddressLabel(o, "BTC"));

      console.log("📌 BTC 交易:", tx.transaction_hash, "金额(USD):", tx.value_usd);

      if (inputLabels.includes("binance") && !outputLabels.includes("binance")) {
        console.log(`🚨 Binance → 外部, 转出 ${tx.value_usd} USD`);
      } else if (!inputLabels.includes("binance") && outputLabels.includes("binance")) {
        console.log(`🚨 外部 → Binance, 转入 ${tx.value_usd} USD`);
      } else if (inputLabels.includes("whales") || outputLabels.includes("whales")) {
        console.log(`🐋 巨鲸转账: ${tx.value_usd} USD`);
      }
    }
  } catch (err) {
    console.error("BTC监控错误:", err.message);
  }
}

// === ETH 大额转账监控 ===
async function monitorETH(threshold = 10_000_000) {
  try {
    const url = `https://api.ethplorer.io/getTopTransactions?apiKey=freekey`;
    const res = await fetch(url);
    const data = await res.json();

    for (const op of data.operations || []) {
      const from = op.from?.toLowerCase();
      const to = op.to?.toLowerCase();
      const valueUSD = (op.value || 0) * (op.tokenInfo?.price?.rate || 0);

      if (valueUSD > threshold) {
        const fromLabel = getAddressLabel(from, "ETH");
        const toLabel = getAddressLabel(to, "ETH");

        console.log("📌 ETH 交易:", op.transactionHash, "金额(USD):", valueUSD);

        if (fromLabel !== "unknown" && toLabel === "unknown") {
          console.log(`🚨 ${fromLabel} → 外部, 转出 ${valueUSD} USD`);
        } else if (fromLabel === "unknown" && toLabel !== "unknown") {
          console.log(`🚨 外部 → ${toLabel}, 转入 ${valueUSD} USD`);
        } else if (fromLabel === "whales" || toLabel === "whales") {
          console.log(`🐋 巨鲸转账: ${valueUSD} USD`);
        }
      }
    }
  } catch (err) {
    console.error("ETH监控错误:", err.message);
  }
}

// === 定时运行 ===
async function run() {
  await monitorBTC();
  await monitorETH();
}

setInterval(run, 60_000); // 每分钟检查一次
```


# **四、报警逻辑总结**

- 大额转账：BTC > $10M / ETH > 1000 ETH → ⚠
- 市场情绪：恐惧指数 <20 或 >80 → ⚠
- 合约市场：多空比 >2（多头过热）或 <0.5（空头过重） → ⚠
- 宏观利率：>5% 或 <2% → ⚠
- 通胀率：>4%（高通胀）或 <1%（通缩） → ⚠

# **五、需要申请 Key 的数据源清单（更新版）**

| **数据源** | **用途** | **是否需要 Key** | **申请地址** | 真实api key |
| --- | --- | --- | --- | --- |
| Etherscan | 交易所钱包监控/资金流 | ✅ 免费 Key | https://etherscan.io/register | AZAZFVBNA16WCUMAHPGDFTVSXB5KJUHCIM |
| FRED
https://fred.stlouisfed.org/docs/api/fred/ | 美联储利率/CPI通胀数据 | ✅ 免费 Key | https://fred.stlouisfed.org/docs/api/api_key.html | fbfe3e85bdec733f71b17800eaa614fd |
| Binance API | 多空比/未平仓合约/资金费率 | ❌ 无需 Key | https://binance-docs.github.io/apidocs/futures/en/ |  |
| Bybit API | 多空比/资金费率 | ❌ 无需 Key | https://bybit-exchange.github.io/docs/linear/#t-introduction |  |
| OKX API | 未平仓合约/资金费率 | ❌ 无需 Key | https://www.okx.com/docs-v5/en/ |  |
| Blockchair | BTC/ETH大额交易监控 | ❌ 无需 Key | https://blockchair.com/api/docs |  |
| Fear & Greed | 市场情绪指数 | ❌ 无需 Key | https://alternative.me/crypto/fear-and-greed-index/ |  |