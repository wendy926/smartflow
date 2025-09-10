#!/usr/bin/env node

// 测试TREND_REVERSAL修复是否有效

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'smartflow.db');

async function testTrendReversalFix() {
  const db = new sqlite3.Database(dbPath);

  try {
    console.log('🔍 测试TREND_REVERSAL修复...');

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

    // 检查是否有direction列
    const hasDirection = tableInfo.some(col => col.name === 'direction');
    console.log(`✅ direction列存在: ${hasDirection}`);

    if (!hasMarketType || !hasExecutionModeV3 || !hasDirection) {
      console.log('❌ 缺少必要的列，需要运行数据库迁移');
      return;
    }

    // 检查是否有任何模拟交易记录
    const totalRecords = await new Promise((resolve, reject) => {
      db.get("SELECT COUNT(*) as count FROM simulations", (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    console.log(`\n📊 总模拟交易记录数: ${totalRecords}`);

    if (totalRecords === 0) {
      console.log('ℹ️ 数据库中没有模拟交易记录，无法测试TREND_REVERSAL问题');
      return;
    }

    // 检查TREND_REVERSAL记录
    const trendReversalRecords = await new Promise((resolve, reject) => {
      db.all(`
        SELECT id, symbol, direction, trigger_reason, exit_reason, market_type, execution_mode_v3, created_at
        FROM simulations 
        WHERE exit_reason = 'TREND_REVERSAL'
        ORDER BY created_at DESC
        LIMIT 10
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    console.log(`\n🔍 TREND_REVERSAL记录数: ${trendReversalRecords.length}`);

    if (trendReversalRecords.length > 0) {
      console.log('❌ 发现TREND_REVERSAL记录:');
      trendReversalRecords.forEach(record => {
        const isRangeSignal = record.trigger_reason?.includes('区间');
        console.log(`  - ID: ${record.id}, ${record.symbol}, ${record.direction}`);
        console.log(`    触发原因: ${record.trigger_reason}`);
        console.log(`    出场原因: ${record.exit_reason}`);
        console.log(`    市场类型: ${record.market_type || 'NULL'}`);
        console.log(`    执行模式: ${record.execution_mode_v3 || 'NULL'}`);
        console.log(`    是否区间信号: ${isRangeSignal}`);
        console.log(`    时间: ${record.created_at}`);
        console.log('    ---');
      });

      // 检查是否有区间信号使用TREND_REVERSAL的情况
      const problematicRecords = trendReversalRecords.filter(record => 
        record.trigger_reason?.includes('区间')
      );

      if (problematicRecords.length > 0) {
        console.log(`\n❌ 发现 ${problematicRecords.length} 条有问题的记录（区间信号使用TREND_REVERSAL）:`);
        problematicRecords.forEach(record => {
          console.log(`  - ID: ${record.id}, ${record.symbol}, ${record.trigger_reason} -> ${record.exit_reason}`);
        });
      } else {
        console.log('\n✅ 没有发现区间信号使用TREND_REVERSAL的情况');
      }
    } else {
      console.log('✅ 没有发现TREND_REVERSAL记录');
    }

    // 检查所有模拟交易记录的市场类型分布
    const marketTypeStats = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          market_type,
          COUNT(*) as count,
          COUNT(CASE WHEN exit_reason = 'TREND_REVERSAL' THEN 1 END) as trend_reversal_count
        FROM simulations 
        GROUP BY market_type
        ORDER BY count DESC
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    console.log('\n📊 市场类型统计:');
    marketTypeStats.forEach(stat => {
      console.log(`  - ${stat.market_type || 'NULL'}: ${stat.count} 条记录, ${stat.trend_reversal_count} 条TREND_REVERSAL`);
    });

    // 检查触发原因分布
    const triggerReasonStats = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          trigger_reason,
          COUNT(*) as count,
          COUNT(CASE WHEN exit_reason = 'TREND_REVERSAL' THEN 1 END) as trend_reversal_count
        FROM simulations 
        GROUP BY trigger_reason
        ORDER BY count DESC
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    console.log('\n📊 触发原因统计:');
    triggerReasonStats.forEach(stat => {
      console.log(`  - ${stat.trigger_reason}: ${stat.count} 条记录, ${stat.trend_reversal_count} 条TREND_REVERSAL`);
    });

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    db.close();
  }
}

// 运行测试
testTrendReversalFix().catch(console.error);
