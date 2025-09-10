#!/usr/bin/env node

// 验证TREND_REVERSAL修复是否有效

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'smartflow.db');

async function verifyTrendReversalFix() {
  const db = new sqlite3.Database(dbPath);

  try {
    console.log('🔍 验证TREND_REVERSAL修复效果...\n');

    // 1. 检查历史问题记录
    console.log('📊 历史问题记录统计:');
    const historicalIssues = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN trigger_reason LIKE '%区间%' AND exit_reason = 'TREND_REVERSAL' THEN 1 ELSE 0 END) as range_trend_reversal
        FROM simulations 
        WHERE created_at < datetime('now', '-1 hour')
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows[0]);
      });
    });

    console.log(`  总模拟交易记录: ${historicalIssues.total}`);
    console.log(`  区间交易使用TREND_REVERSAL: ${historicalIssues.range_trend_reversal}`);
    console.log(`  问题比例: ${((historicalIssues.range_trend_reversal / historicalIssues.total) * 100).toFixed(2)}%\n`);

    // 2. 检查修复后的记录
    console.log('📊 修复后记录统计 (最近1小时):');
    const recentRecords = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN trigger_reason LIKE '%区间%' AND exit_reason = 'TREND_REVERSAL' THEN 1 ELSE 0 END) as range_trend_reversal,
          SUM(CASE WHEN trigger_reason LIKE '%区间%' AND exit_reason != 'TREND_REVERSAL' THEN 1 ELSE 0 END) as range_other_exit
        FROM simulations 
        WHERE created_at >= datetime('now', '-1 hour')
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows[0]);
      });
    });

    console.log(`  总模拟交易记录: ${recentRecords.total}`);
    console.log(`  区间交易使用TREND_REVERSAL: ${recentRecords.range_trend_reversal}`);
    console.log(`  区间交易使用其他出场原因: ${recentRecords.range_other_exit}`);
    
    if (recentRecords.total > 0) {
      console.log(`  问题比例: ${((recentRecords.range_trend_reversal / recentRecords.total) * 100).toFixed(2)}%`);
    } else {
      console.log('  暂无新记录');
    }

    // 3. 检查最新的区间交易记录
    console.log('\n📋 最新区间交易记录:');
    const latestRangeTrades = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          id, symbol, direction, trigger_reason, exit_reason, market_type, 
          execution_mode_v3, created_at
        FROM simulations 
        WHERE trigger_reason LIKE '%区间%'
        ORDER BY created_at DESC 
        LIMIT 10
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    latestRangeTrades.forEach(trade => {
      const status = trade.exit_reason === 'TREND_REVERSAL' ? '❌ 问题' : '✅ 正常';
      console.log(`  ${status} ${trade.symbol} ${trade.direction} ${trade.trigger_reason} -> ${trade.exit_reason} (${trade.created_at})`);
    });

    // 4. 检查修复代码是否存在
    console.log('\n🔧 修复代码验证:');
    const fs = require('fs');
    const simulationManagerPath = path.join(__dirname, 'modules/database/SimulationManager.js');
    
    if (fs.existsSync(simulationManagerPath)) {
      const content = fs.readFileSync(simulationManagerPath, 'utf8');
      const hasIsRangeSignal = content.includes('isRangeSignal');
      const hasRangeExitLogic = content.includes('marketType === \'震荡市\' || isRangeSignal');
      
      console.log(`  isRangeSignal检测: ${hasIsRangeSignal ? '✅ 存在' : '❌ 缺失'}`);
      console.log(`  区间交易特殊处理: ${hasRangeExitLogic ? '✅ 存在' : '❌ 缺失'}`);
    } else {
      console.log('  ❌ SimulationManager.js 文件不存在');
    }

    console.log('\n🎯 修复效果总结:');
    if (recentRecords.range_trend_reversal === 0 && recentRecords.total > 0) {
      console.log('  ✅ 修复成功！最近1小时内没有区间交易使用TREND_REVERSAL');
    } else if (recentRecords.total === 0) {
      console.log('  ⏳ 等待新的模拟交易记录来验证修复效果');
    } else {
      console.log('  ⚠️  仍有区间交易使用TREND_REVERSAL，需要进一步检查');
    }

  } catch (error) {
    console.error('❌ 验证过程中出现错误:', error);
  } finally {
    db.close();
  }
}

// 运行验证
verifyTrendReversalFix();
