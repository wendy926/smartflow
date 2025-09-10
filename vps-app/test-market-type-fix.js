#!/usr/bin/env node

// 测试market_type修复是否有效

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'smartflow.db');

async function testMarketTypeFix() {
  const db = new sqlite3.Database(dbPath);

  try {
    console.log('🔍 测试market_type修复...');

    // 检查数据库表结构
    const tableInfo = await new Promise((resolve, reject) => {
      db.all("PRAGMA table_info(simulations)", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    console.log('📊 simulations表结构:');
    tableInfo.forEach(col => {
      console.log(`  - ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
    });

    // 检查是否有market_type列
    const hasMarketType = tableInfo.some(col => col.name === 'market_type');
    console.log(`\n✅ market_type列存在: ${hasMarketType}`);

    // 检查是否有execution_mode_v3列
    const hasExecutionModeV3 = tableInfo.some(col => col.name === 'execution_mode_v3');
    console.log(`✅ execution_mode_v3列存在: ${hasExecutionModeV3}`);

    // 检查是否有setup_candle_high列
    const hasSetupCandleHigh = tableInfo.some(col => col.name === 'setup_candle_high');
    console.log(`✅ setup_candle_high列存在: ${hasSetupCandleHigh}`);

    // 检查是否有setup_candle_low列
    const hasSetupCandleLow = tableInfo.some(col => col.name === 'setup_candle_low');
    console.log(`✅ setup_candle_low列存在: ${hasSetupCandleLow}`);

    // 检查是否有atr14列
    const hasAtr14 = tableInfo.some(col => col.name === 'atr14');
    console.log(`✅ atr14列存在: ${hasAtr14}`);

    if (!hasMarketType || !hasExecutionModeV3 || !hasSetupCandleHigh || !hasSetupCandleLow || !hasAtr14) {
      console.log('\n❌ 缺少必要的V3字段，需要运行数据库迁移');
      console.log('请运行: node run-v3-migration.js');
    } else {
      console.log('\n✅ 所有V3字段都存在，数据库结构正确');
    }

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    db.close();
  }
}

// 运行测试
testMarketTypeFix().then(() => {
  console.log('🎉 测试完成');
  process.exit(0);
}).catch(error => {
  console.error('❌ 测试失败:', error);
  process.exit(1);
});
