# **一、系统架构**

模块划分：

| **功能块** | **数据来源** | **功能** |
| --- | --- | --- |
| 技术/团队 | GitHub API | 自动获取项目活跃度（commit、contributors）、团队背景（可手动输入） |
| 代币经济 | Binance API | 代币总量、流通量、首发锁仓信息（部分需手动补充） |
| 市场流动性 | Binance API | 首发交易所、交易量、订单簿深度 |
| 市场情绪 | Twitter API / Telegram 社群（可手动输入） | 社群活跃度、舆论情绪（暂用粉丝数/消息量） |
| 报警推送 | Telegram Bot API | 根据评分触发推送 |

# **二、准备工作**

1. 安装依赖

npm install node-fetch

1. 环境变量配置（推荐）

export GITHUB_TOKEN="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"

# **三、核心 JS 实现**

```jsx
// ======================
// 新币监控系统 v1.0
// ======================

const fetch = require("node-fetch");

// === 配置 ===
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN; // Telegram Bot Token
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID; // Chat ID
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // GitHub Token，可选

const BINANCE_BASE = "https://api.binance.com/api/v3";

// === 新币列表 ===
const newCoins = [
  {
    name: "ExampleCoin",            // Binance交易对名，如 "EXAMPLEUSDT"
    githubRepo: "username/repo",    // GitHub仓库
    teamScore: 8,                   // 团队经验分（0-10）
    supplyTotal: 100000000,         // 代币总量
    supplyCirculation: 5000000,     // 流通量
    vestingLockScore: 7,            // 锁仓分（0-10）
    twitterFollowers: 5000          // 市场情绪指标
  }
];

// === Telegram 推送 ===
async function sendTelegram(message) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=${encodeURIComponent(message)}`;
    await fetch(url);
  } catch(e) {
    console.error("Telegram发送失败:", e.message);
  }
}

// === GitHub评分 ===
async function getGithubScore(repo){
  try {
    const url = `https://api.github.com/repos/${repo}`;
    const headers = GITHUB_TOKEN ? { Authorization: `token ${GITHUB_TOKEN}` } : {};
    const res = await fetch(url, { headers });
    const data = await res.json();
    let score = 0;
    if(data.stargazers_count) score += Math.min(10, data.stargazers_count / 100);
    if(data.forks_count) score += Math.min(5, data.forks_count / 50);
    if(data.open_issues_count) score += Math.min(5, data.open_issues_count / 20);
    return Math.min(score, 10);
  } catch(e){
    console.error("GitHub获取失败:", e.message);
    return 0;
  }
}

// === Binance流动性评分 ===
async function getBinanceLiquidity(symbol){
  try {
    const ticker = await fetch(`${BINANCE_BASE}/ticker/24hr?symbol=${symbol}`).then(r=>r.json());
    const volumeScore = Math.min(10, Math.log10(parseFloat(ticker.volume)+1));
    const depth = await fetch(`${BINANCE_BASE}/depth?symbol=${symbol}&limit=50`).then(r=>r.json());
    let bid = depth.bids.reduce((sum,b)=>sum+parseFloat(b[1]),0);
    let ask = depth.asks.reduce((sum,a)=>sum+parseFloat(a[1]),0);
    let depthScore = Math.min(10, Math.log10(bid+ask+1));
    return (volumeScore + depthScore)/2;
  } catch(e){
    console.error("Binance流动性获取失败:", e.message);
    return 0;
  }
}

// === 首日价格波动评分 ===
async function getFirstDayVolatilityScore(symbol){
  try{
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=24`;
    const res = await fetch(url);
    const data = await res.json();
    if(!data || data.length === 0) return 0;
    const openFirst = parseFloat(data[0][1]);
    let highMax = Math.max(...data.map(k=>parseFloat(k[2])));
    let lowMin = Math.min(...data.map(k=>parseFloat(k[3])));
    const volatility = (highMax - lowMin)/openFirst;
    if(volatility < 0.05) return 10;
    else if(volatility <0.10) return 8;
    else if(volatility <0.20) return 5;
    else return 2;
  } catch(e){
    console.error("首日波动评分获取失败:", e.message);
    return 0;
  }
}

// === 市场情绪评分 ===
async function getMarketSentimentScore(coin){
  const socialScore = Math.min(10, coin.twitterFollowers/1000);
  const volatilityScore = await getFirstDayVolatilityScore(coin.name+"USDT");
  return (socialScore + volatilityScore)/2;
}

// === 代币经济评分 ===
function getTokenEconomicsScore(coin){
  const circulationRatio = coin.supplyCirculation / coin.supplyTotal;
  const supplyScore = (1 - circulationRatio) * 10;
  return Math.min(10, (supplyScore + coin.vestingLockScore)/2);
}

// === 权重配置 ===
const weights = {
  techTeam: 0.3,
  tokenEconomics: 0.25,
  liquidity: 0.25,
  marketSentiment: 0.2
};

// === 综合评分计算 ===
async function evaluateCoin(coin){
  const techScore = await getGithubScore(coin.githubRepo) * 0.7 + coin.teamScore * 0.3;
  const tokenScore = getTokenEconomicsScore(coin);
  const liquidityScore = await getBinanceLiquidity(coin.name+"USDT");
  const marketSentimentScore = await getMarketSentimentScore(coin);
  
  const totalScore = techScore*weights.techTeam +
                     tokenScore*weights.tokenEconomics +
                     liquidityScore*weights.liquidity +
                     marketSentimentScore*weights.marketSentiment;

  let strategy;
  if(totalScore >= 9) strategy = "高可靠性，中长期可持有";
  else if(totalScore >=7) strategy = "中等可靠性，短线+观望";
  else if(totalScore >=5) strategy = "低可靠性，仅适合极短线博弈";
  else strategy = "高风险，建议规避";

  // 报警阈值：总分<7
  if(totalScore <7){
    sendTelegram(`⚠ 新币评分警报: ${coin.name}, 总分: ${totalScore.toFixed(1)}, 建议策略: ${strategy}`);
  }

  return {
    name: coin.name,
    techScore: techScore.toFixed(1),
    tokenScore: tokenScore.toFixed(1),
    liquidityScore: liquidityScore.toFixed(1),
    marketSentimentScore: marketSentimentScore.toFixed(1),
    totalScore: totalScore.toFixed(1),
    strategy
  }
}

// === 主程序 ===
async function run(){
  const results = [];
  for(const coin of newCoins){
    const r = await evaluateCoin(coin);
    results.push(r);
  }
  console.table(results);
}

// 每分钟监控一次
setInterval(run, 60_000);

// 首次执行
run();
```

# **四、功能说明**

1. 自动拉取数据
    - GitHub：仓库活跃度（stars/forks/issues）
    - Binance：交易量、订单簿深度
    - 市场情绪：Twitter粉丝数（可拓展为 Telegram 社群活跃度 API）
2. 自动评分
    - 技术/团队、代币经济、市场流动性、市场情绪打分
    - 权重加权计算总分
3. 自动报警
    - 总分 <7 自动通过 Telegram Bot 推送报警信息
    - 可根据总分阈值自定义策略（短线/中长期/规避）
4. 可扩展
    - 可以增加更多社群 API（Reddit、Telegram）
    - 可以增加 首日波动 评分
    - 可拓展 多交易所数据

**功能说明**

1. 自动拉取数据：GitHub 活跃度、Binance 交易量和深度、首日价格波动
2. 评分模块：
    - 技术/团队评分（0-10）
    - 代币经济评分（0-10）
    - 市场流动性评分（0-10）
    - 市场情绪评分（社群活跃 + 首日波动，0-10）
3. 自动评分总分：按权重加权计算
4. 自动报警：总分低于 7 自动 Telegram 推送
5. 可扩展：
    - 添加更多交易所数据
    - 添加 Reddit/Telegram 社群活跃度 API
    - 自定义报警阈值、监控周期