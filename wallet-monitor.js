#!/usr/bin/env node

/**
 * 大资金钱包监控脚本
 * 监控BTC和ETH钱包的大额交易和大额转账
 * BTC > $10M / ETH > 1000 ETH
 */

// 使用Node.js内置的fetch (Node.js 18+)
// const fetch = require('node-fetch'); // 如果使用旧版本Node.js，取消注释此行

// === 地址标签库 ===
const walletLabels = {
  BTC: {
    "binance-coldwallet": ["34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo"],
  },
  ETH: {
    "binance-exchange": ["0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE".toLowerCase()],
    "binance-14": ["0x28C6c06298d514Db089934071355E5743bf21d60".toLowerCase()],
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
async function monitorBTC(threshold = 10_000_000) {
  try {
    console.log(`🔍 开始监控BTC大额转账 (阈值: $${threshold.toLocaleString()})`);
    
    const url = `https://api.blockchair.com/bitcoin/transactions?q=value_usd(${threshold}..)`;
    const res = await fetch(url);
    const json = await res.json();

    if (!json.data || json.data.length === 0) {
      console.log("📊 当前无符合阈值的BTC大额交易");
      return;
    }

    for (const tx of json.data) {
      const inputs = tx.inputs.map((i) => i.recipient);
      const outputs = tx.outputs.map((o) => o.recipient);

      const inputLabels = inputs.map((i) => getAddressLabel(i, "BTC"));
      const outputLabels = outputs.map((o) => getAddressLabel(o, "BTC"));

      console.log(`📌 BTC 交易: ${tx.transaction_hash}`);
      console.log(`   金额(USD): $${tx.value_usd.toLocaleString()}`);
      console.log(`   时间: ${new Date(tx.time).toLocaleString()}`);

      if (inputLabels.includes("binance-coldwallet") && !outputLabels.includes("binance-coldwallet")) {
        console.log(`🚨 Binance冷钱包 → 外部, 转出 $${tx.value_usd.toLocaleString()}`);
      } else if (!inputLabels.includes("binance-coldwallet") && outputLabels.includes("binance-coldwallet")) {
        console.log(`🚨 外部 → Binance冷钱包, 转入 $${tx.value_usd.toLocaleString()}`);
      } else if (inputLabels.some(label => label !== "unknown") || outputLabels.some(label => label !== "unknown")) {
        console.log(`🐋 大资金转账: $${tx.value_usd.toLocaleString()}`);
      }
      console.log("---");
    }
  } catch (err) {
    console.error("❌ BTC监控错误:", err.message);
  }
}

// === ETH 大额转账监控 ===
async function monitorETH(threshold = 1000) { // 1000 ETH ≈ $10M
  try {
    console.log(`🔍 开始监控ETH大额转账 (阈值: ${threshold} ETH)`);
    
    const url = `https://api.ethplorer.io/getTopTransactions?apiKey=freekey`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.operations || data.operations.length === 0) {
      console.log("📊 当前无符合阈值的ETH大额交易");
      return;
    }

    for (const op of data.operations) {
      const from = op.from?.toLowerCase();
      const to = op.to?.toLowerCase();
      const valueETH = op.value || 0;
      const valueUSD = valueETH * (op.tokenInfo?.price?.rate || 0);

      if (valueETH > threshold) {
        const fromLabel = getAddressLabel(from, "ETH");
        const toLabel = getAddressLabel(to, "ETH");

        console.log(`📌 ETH 交易: ${op.transactionHash}`);
        console.log(`   金额: ${valueETH.toLocaleString()} ETH ($${valueUSD.toLocaleString()})`);
        console.log(`   时间: ${new Date(op.timestamp * 1000).toLocaleString()}`);

        if (fromLabel !== "unknown" && toLabel === "unknown") {
          console.log(`🚨 ${fromLabel} → 外部, 转出 ${valueETH.toLocaleString()} ETH`);
        } else if (fromLabel === "unknown" && toLabel !== "unknown") {
          console.log(`🚨 外部 → ${toLabel}, 转入 ${valueETH.toLocaleString()} ETH`);
        } else if (fromLabel !== "unknown" || toLabel !== "unknown") {
          console.log(`🐋 大资金转账: ${valueETH.toLocaleString()} ETH`);
        }
        console.log("---");
      }
    }
  } catch (err) {
    console.error("❌ ETH监控错误:", err.message);
  }
}

// === 定时运行 ===
async function run() {
  console.log(`\n⏰ ${new Date().toLocaleString()} - 开始执行钱包监控`);
  console.log("=" * 50);
  
  await monitorBTC();
  console.log("");
  await monitorETH();
  
  console.log("=" * 50);
  console.log("✅ 监控完成\n");
}

// 主程序
if (require.main === module) {
  console.log("🚀 启动大资金钱包监控系统");
  console.log("📋 监控配置:");
  console.log("   BTC阈值: $10,000,000");
  console.log("   ETH阈值: 1,000 ETH");
  console.log("   Binance冷钱包: 34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo");
  console.log("   Binance Exchange: 0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE");
  console.log("   Binance 14: 0x28C6c06298d514Db089934071355E5743bf21d60");
  console.log("");

  // 立即执行一次
  run();

  // 每分钟执行一次
  setInterval(run, 60_000);
}

module.exports = { monitorBTC, monitorETH, walletLabels };
