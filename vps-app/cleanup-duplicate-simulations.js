#!/usr/bin/env node

// 清理重复的模拟交易数据脚本
const DatabaseManager = require('./modules/database/DatabaseManager');

async function cleanupDuplicateSimulations() {
  const dbManager = new DatabaseManager();
  
  try {
    await dbManager.init();
    console.log('🔍 开始分析模拟交易数据...');
    
    // 获取所有模拟交易数据
    const simulations = await dbManager.runQuery('SELECT * FROM simulations ORDER BY created_at DESC');
    console.log(`📊 总共有 ${simulations.length} 个模拟交易记录`);
    
    // 识别重复的交易（基于交易对+方向+时间窗口）
    const duplicates = [];
    const seen = new Map();
    
    for (const sim of simulations) {
      // 创建唯一键：交易对 + 方向 + 时间（精确到分钟）
      const timeKey = sim.created_at.substring(0, 16); // 精确到分钟
      const key = `${sim.symbol}_${sim.direction}_${timeKey}`;
      
      if (seen.has(key)) {
        // 找到重复，保留ID较小的（较早创建的）
        const existing = seen.get(key);
        if (sim.id > existing.id) {
          duplicates.push(sim);
        } else {
          duplicates.push(existing);
          seen.set(key, sim);
        }
      } else {
        seen.set(key, sim);
      }
    }
    
    console.log(`🔍 发现 ${duplicates.length} 个重复的模拟交易记录`);
    
    if (duplicates.length > 0) {
      console.log('📋 重复记录详情:');
      duplicates.forEach((dup, index) => {
        console.log(`${index + 1}. ID: ${dup.id}, 交易对: ${dup.symbol}, 方向: ${dup.direction}, 入场价格: ${dup.entry_price}, 创建时间: ${dup.created_at}`);
      });
      
      // 删除重复记录
      console.log('🗑️ 开始删除重复记录...');
      for (const dup of duplicates) {
        await dbManager.run('DELETE FROM simulations WHERE id = ?', [dup.id]);
        console.log(`✅ 已删除重复记录 ID: ${dup.id}`);
      }
      
      console.log(`✅ 成功删除 ${duplicates.length} 个重复的模拟交易记录`);
    } else {
      console.log('✅ 没有发现重复的模拟交易记录');
    }
    
    // 显示清理后的统计信息
    const remainingSimulations = await dbManager.runQuery('SELECT * FROM simulations ORDER BY created_at DESC');
    console.log(`📊 清理后剩余 ${remainingSimulations.length} 个模拟交易记录`);
    
    // 按交易对统计
    const symbolStats = {};
    remainingSimulations.forEach(sim => {
      if (!symbolStats[sim.symbol]) {
        symbolStats[sim.symbol] = 0;
      }
      symbolStats[sim.symbol]++;
    });
    
    console.log('📈 各交易对交易数量统计:');
    Object.entries(symbolStats).forEach(([symbol, count]) => {
      console.log(`  ${symbol}: ${count} 个交易`);
    });
    
  } catch (error) {
    console.error('❌ 清理过程中发生错误:', error);
  } finally {
    await dbManager.close();
  }
}

// 运行清理脚本
cleanupDuplicateSimulations().then(() => {
  console.log('🎉 模拟交易数据清理完成');
  process.exit(0);
}).catch(error => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});