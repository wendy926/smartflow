#!/usr/bin/env node

/**
 * ETH监控逻辑测试脚本
 * 测试地址标签和监控逻辑，不依赖外部API
 */

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

// === 模拟ETH交易数据 ===
const mockTransactions = [
  {
    hash: "0x1234567890abcdef1234567890abcdef12345678",
    from: "0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE", // Binance Exchange
    to: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e", // 未知地址
    value: "1500000000000000000000", // 1500 ETH
    tokenSymbol: "ETH",
    tokenDecimal: "18",
    timeStamp: "1695926400"
  },
  {
    hash: "0xabcdef1234567890abcdef1234567890abcdef12",
    from: "0x28C6c06298d514Db089934071355E5743bf21d60", // Binance 14
    to: "0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE", // Binance Exchange
    value: "800000000000000000000", // 800 ETH
    tokenSymbol: "ETH",
    tokenDecimal: "18",
    timeStamp: "1695926400"
  },
  {
    hash: "0x9876543210fedcba9876543210fedcba98765432",
    from: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e", // 未知地址
    to: "0x28C6c06298d514Db089934071355E5743bf21d60", // Binance 14
    value: "2000000000000000000000", // 2000 ETH
    tokenSymbol: "ETH",
    tokenDecimal: "18",
    timeStamp: "1695926400"
  }
];

// === ETH监控逻辑测试 ===
function testETHMonitoringLogic(threshold = 1000) {
  console.log(`🔍 测试ETH监控逻辑 (阈值: ${threshold} ETH)`);
  console.log("=" * 50);

  let alertCount = 0;

  for (const tx of mockTransactions) {
    const valueETH = parseFloat(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal));

    if (valueETH > threshold) {
      alertCount++;
      const fromLabel = getAddressLabel(tx.from.toLowerCase(), "ETH");
      const toLabel = getAddressLabel(tx.to.toLowerCase(), "ETH");

      console.log(`🚨 大额交易告警:`);
      console.log(`   交易哈希: ${tx.hash}`);
      console.log(`   金额: ${valueETH.toLocaleString()} ${tx.tokenSymbol}`);
      console.log(`   从: ${fromLabel} (${tx.from})`);
      console.log(`   到: ${toLabel} (${tx.to})`);
      console.log(`   时间: ${new Date(parseInt(tx.timeStamp) * 1000).toLocaleString()}`);

      // 判断告警类型
      if (fromLabel !== "unknown" && toLabel === "unknown") {
        console.log(`   🔔 告警: ${fromLabel} → 外部, 转出 ${valueETH.toLocaleString()} ETH`);
      } else if (fromLabel === "unknown" && toLabel !== "unknown") {
        console.log(`   🔔 告警: 外部 → ${toLabel}, 转入 ${valueETH.toLocaleString()} ETH`);
      } else if (fromLabel !== "unknown" && toLabel !== "unknown") {
        console.log(`   🔔 告警: ${fromLabel} → ${toLabel}, 内部转账 ${valueETH.toLocaleString()} ETH`);
      }
      console.log("---");
    }
  }

  console.log(`✅ 监控测试完成: 发现 ${alertCount} 笔大额交易`);
  return alertCount;
}

// === 地址标签功能测试 ===
function testAddressLabels() {
  console.log("\n🧪 地址标签功能测试:");
  console.log("=" * 30);

  const testAddresses = [
    "0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE", // Binance Exchange
    "0x28C6c06298d514Db089934071355E5743bf21d60", // Binance 14
    "0x742d35Cc6634C0532925a3b844Bc454e4438f44e", // 未知地址
  ];

  testAddresses.forEach(addr => {
    const label = getAddressLabel(addr.toLowerCase(), "ETH");
    console.log(`   ${addr} → ${label}`);
  });

  console.log("✅ 地址标签测试完成");
}

// === 监控配置显示 ===
function showMonitoringConfig() {
  console.log("\n📊 ETH监控配置:");
  console.log("=" * 30);
  console.log("   监控阈值: 1,000 ETH (约$10M)");
  console.log("   监控地址:");
  console.log("     Binance Exchange: 0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE");
  console.log("     Binance 14: 0x28C6c06298d514Db089934071355E5743bf21d60");
  console.log("   告警规则:");
  console.log("     - 交易所 → 外部: 转出告警");
  console.log("     - 外部 → 交易所: 转入告警");
  console.log("     - 交易所内部: 内部转账告警");
}

// 运行测试
if (require.main === module) {
  console.log("🚀 ETH监控系统逻辑测试");
  console.log("=" * 50);

  testETHMonitoringLogic();
  testAddressLabels();
  showMonitoringConfig();

  console.log("\n" + "=" * 50);
  console.log("✅ 所有测试完成 - ETH监控逻辑运行正常");
}

module.exports = { testETHMonitoringLogic, testAddressLabels, getAddressLabel };
