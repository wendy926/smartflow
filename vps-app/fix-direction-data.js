#!/usr/bin/env node

// 修复模拟交易方向数据
const DatabaseManager = require('./modules/database/DatabaseManager');

async function fixDirectionData() {
  const db = new DatabaseManager();
  await db.init();

  try {
    console.log('🔧 开始修复模拟交易方向数据...');

    // 查询所有需要修复的记录
    const records = await db.runQuery(`
      SELECT id, symbol, trigger_reason, direction 
      FROM simulations 
      WHERE trigger_reason LIKE '%多头%' AND direction = 'SHORT'
         OR trigger_reason LIKE '%空头%' AND direction = 'LONG'
    `);

    console.log(`📊 找到 ${records.length} 条需要修复的记录`);

    for (const record of records) {
      let correctDirection = 'SHORT'; // 默认空头
      
      if (record.trigger_reason.includes('多头')) {
        correctDirection = 'LONG';
      } else if (record.trigger_reason.includes('空头')) {
        correctDirection = 'SHORT';
      }

      if (record.direction !== correctDirection) {
        await db.run(`
          UPDATE simulations 
          SET direction = ? 
          WHERE id = ?
        `, [correctDirection, record.id]);

        console.log(`✅ 修复记录 ${record.id}: ${record.symbol} ${record.trigger_reason} ${record.direction} -> ${correctDirection}`);
      }
    }

    console.log('🎉 方向数据修复完成！');

    // 验证修复结果
    const verification = await db.runQuery(`
      SELECT 
        trigger_reason,
        direction,
        COUNT(*) as count
      FROM simulations 
      WHERE trigger_reason LIKE '%多头%' OR trigger_reason LIKE '%空头%'
      GROUP BY trigger_reason, direction
      ORDER BY trigger_reason, direction
    `);

    console.log('\n📋 修复后的数据分布:');
    verification.forEach(row => {
      console.log(`${row.trigger_reason} | ${row.direction} | ${row.count}条`);
    });

  } catch (error) {
    console.error('❌ 修复过程中出错:', error);
  } finally {
    await db.close();
  }
}

// 运行修复
fixDirectionData().catch(console.error);
