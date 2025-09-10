const DatabaseManager = require('./modules/database/DatabaseManager');

async function cleanupSignalNoneRecords() {
  const db = new DatabaseManager();
  
  try {
    console.log('🔍 开始清理SIGNAL_NONE记录...');
    
    // 初始化数据库连接
    await db.init();
    
    // 查询SIGNAL_NONE记录数量
    const countResult = await db.runQuery(`
      SELECT COUNT(*) as count FROM simulations 
      WHERE trigger_reason = 'SIGNAL_NONE'
    `);
    
    const totalCount = countResult[0].count;
    console.log(`📊 发现 ${totalCount} 条SIGNAL_NONE记录`);
    
    if (totalCount === 0) {
      console.log('✅ 没有需要清理的记录');
      return;
    }
    
    // 显示清理前的统计信息
    const statsBefore = await db.runQuery(`
      SELECT 
        symbol,
        COUNT(*) as count,
        MIN(created_at) as earliest,
        MAX(created_at) as latest
      FROM simulations 
      WHERE trigger_reason = 'SIGNAL_NONE'
      GROUP BY symbol
      ORDER BY count DESC
    `);
    
    console.log('\n📋 清理前的记录分布:');
    statsBefore.forEach(stat => {
      console.log(`  ${stat.symbol}: ${stat.count}条 (${stat.earliest} ~ ${stat.latest})`);
    });
    
    // 执行删除操作
    console.log('\n🗑️ 开始删除SIGNAL_NONE记录...');
    const deleteResult = await db.runCommand(`
      DELETE FROM simulations 
      WHERE trigger_reason = 'SIGNAL_NONE'
    `);
    
    console.log(`✅ 成功删除 ${deleteResult.changes} 条SIGNAL_NONE记录`);
    
    // 验证清理结果
    const remainingCount = await db.runQuery(`
      SELECT COUNT(*) as count FROM simulations 
      WHERE trigger_reason = 'SIGNAL_NONE'
    `);
    
    console.log(`🔍 清理后剩余SIGNAL_NONE记录: ${remainingCount[0].count}条`);
    
    // 显示清理后的总记录数
    const totalSimulations = await db.runQuery(`
      SELECT COUNT(*) as count FROM simulations
    `);
    
    console.log(`📊 清理后总模拟交易记录数: ${totalSimulations[0].count}条`);
    
    console.log('\n✅ SIGNAL_NONE记录清理完成');
    
  } catch (error) {
    console.error('❌ 清理SIGNAL_NONE记录失败:', error);
  } finally {
    await db.close();
  }
}

// 执行清理
cleanupSignalNoneRecords();
