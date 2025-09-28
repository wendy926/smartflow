#!/usr/bin/env node

/**
 * 测试钱包地址标签功能
 */

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

// === 测试函数 ===
function testWalletLabels() {
  console.log("🧪 测试钱包地址标签功能");
  console.log("=" * 50);
  
  // 测试BTC地址
  console.log("📋 BTC地址测试:");
  const btcAddresses = [
    "34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo", // Binance冷钱包
    "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", // 创世区块地址
    "1FeexV6bAHb8ybZjqQMjJrcCrHGW9sb6uF", // 未知地址
  ];
  
  btcAddresses.forEach(addr => {
    const label = getAddressLabel(addr, "BTC");
    console.log(`   ${addr} → ${label}`);
  });
  
  console.log("");
  
  // 测试ETH地址
  console.log("📋 ETH地址测试:");
  const ethAddresses = [
    "0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE", // Binance Exchange
    "0x28C6c06298d514Db089934071355E5743bf21d60", // Binance 14
    "0x742d35Cc6634C0532925a3b844Bc454e4438f44e", // 未知地址
  ];
  
  ethAddresses.forEach(addr => {
    const label = getAddressLabel(addr.toLowerCase(), "ETH");
    console.log(`   ${addr} → ${label}`);
  });
  
  console.log("");
  console.log("✅ 地址标签测试完成");
  
  // 显示监控配置
  console.log("");
  console.log("📊 监控配置:");
  console.log("   BTC阈值: $10,000,000");
  console.log("   ETH阈值: 1,000 ETH");
  console.log("   监控地址:");
  console.log("     BTC: 34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo (Binance冷钱包)");
  console.log("     ETH: 0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE (Binance Exchange)");
  console.log("     ETH: 0x28C6c06298d514Db089934071355E5743bf21d60 (Binance 14)");
}

// 运行测试
if (require.main === module) {
  testWalletLabels();
}

module.exports = { walletLabels, getAddressLabel };
