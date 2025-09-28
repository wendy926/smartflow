#!/usr/bin/env node

/**
 * ETH监控测试脚本
 * 测试ETH大额转账监控功能
 */

// 使用Node.js内置的fetch (Node.js 18+)

// === 地址标签库 ===
const walletLabels = {
  ETH: {
    "binance-exchange": ["0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE".toLowerCase()],
    "binance-14": ["0x28C6c06298d514Db089934071355E5743bf21d60".toLowerCase()],
  },
};

// === 判断地址标签 ===
function getAddressLabel(addr, chain = "ETH") {
  const labels = walletLabels[chain];
  for (const [name, list] of Object.entries(labels)) {
    if (list.includes(addr)) return name;
  }
  return "unknown";
}

// === ETH 大额转账监控测试 ===
async function testETHMonitoring(threshold = 1000) { // 1000 ETH ≈ $10M
  try {
    console.log(`🔍 测试ETH大额转账监控 (阈值: ${threshold} ETH)`);

    // 使用Etherscan API测试
    const apiKey = "freekey"; // 使用免费API
    const url = `https://api.etherscan.io/api?module=account&action=tokentx&address=0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE&startblock=0&endblock=999999999&sort=desc&apikey=${apiKey}`;

    console.log("📡 正在获取ETH交易数据...");
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "1" || !data.result) {
      console.log("❌ API请求失败:", data.message || "未知错误");
      return;
    }

    console.log(`📊 获取到 ${data.result.length} 条交易记录`);

    // 检查最近的交易
    let largeTransactions = 0;
    for (const tx of data.result.slice(0, 10)) { // 只检查最近10条
      const valueETH = parseFloat(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal) || 18);

      if (valueETH > threshold) {
        largeTransactions++;
        const fromLabel = getAddressLabel(tx.from.toLowerCase(), "ETH");
        const toLabel = getAddressLabel(tx.to.toLowerCase(), "ETH");

        console.log(`🚨 发现大额交易:`);
        console.log(`   交易哈希: ${tx.hash}`);
        console.log(`   金额: ${valueETH.toLocaleString()} ${tx.tokenSymbol}`);
        console.log(`   从: ${fromLabel} (${tx.from})`);
        console.log(`   到: ${toLabel} (${tx.to})`);
        console.log(`   时间: ${new Date(parseInt(tx.timeStamp) * 1000).toLocaleString()}`);
        console.log("---");
      }
    }

    if (largeTransactions === 0) {
      console.log("✅ 当前无符合阈值的大额ETH交易");
    } else {
      console.log(`✅ 发现 ${largeTransactions} 笔大额交易`);
    }

    // 测试地址标签功能
    console.log("\n🧪 测试地址标签功能:");
    const testAddresses = [
      "0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE", // Binance Exchange
      "0x28C6c06298d514Db089934071355E5743bf21d60", // Binance 14
      "0x742d35Cc6634C0532925a3b844Bc454e4438f44e", // 未知地址
    ];

    testAddresses.forEach(addr => {
      const label = getAddressLabel(addr.toLowerCase(), "ETH");
      console.log(`   ${addr} → ${label}`);
    });

  } catch (err) {
    console.error("❌ ETH监控测试错误:", err.message);
  }
}

// 运行测试
if (require.main === module) {
  console.log("🚀 ETH监控功能测试");
  console.log("=" * 50);
  testETHMonitoring().then(() => {
    console.log("=" * 50);
    console.log("✅ ETH监控测试完成");
  });
}

module.exports = { testETHMonitoring, getAddressLabel };
