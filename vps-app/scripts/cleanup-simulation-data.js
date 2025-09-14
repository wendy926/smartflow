#!/usr/bin/env node

/**
 * 清理今天之前的所有模拟交易相关数据
 * 包括：simulations, simulation_stats, analysis_logs, strategy_analysis等
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'smartflow.db');

async function cleanupSimulationData() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ 数据库连接失败:', err.message);
        reject(err);
        return;
      }
      console.log('✅ 数据库连接成功');
    });

    console.log('🧹 开始清理今天之前的模拟交易相关数据...\n');

    // 定义需要清理的表和清理条件
    const cleanupTasks = [
      {
        name: '模拟交易记录',
        table: 'simulations',
        condition: 'created_at < date("now")',
        query: 'SELECT COUNT(*) as count FROM simulations WHERE created_at < date("now")'
      },
      {
        name: '模拟交易统计',
        table: 'simulation_stats', 
        condition: 'created_at < date("now")',
        query: 'SELECT COUNT(*) as count FROM simulation_stats WHERE created_at < date("now")'
      },
      {
        name: '分析日志',
        table: 'analysis_logs',
        condition: 'timestamp < date("now")',
        query: 'SELECT COUNT(*) as count FROM analysis_logs WHERE timestamp < date("now")'
      },
      {
        name: '策略分析数据',
        table: 'strategy_analysis',
        condition: 'created_at < date("now")',
        query: 'SELECT COUNT(*) as count FROM strategy_analysis WHERE created_at < date("now")'
      },
      {
        name: '策略V3分析数据',
        table: 'strategy_v3_analysis',
        condition: 'created_at < date("now")',
        query: 'SELECT COUNT(*) as count FROM strategy_v3_analysis WHERE created_at < date("now")'
      },
      {
        name: '边界分析数据',
        table: 'range_boundary_analysis',
        condition: 'created_at < date("now")',
        query: 'SELECT COUNT(*) as count FROM range_boundary_analysis WHERE created_at < date("now")'
      },
      {
        name: '指标监控数据',
        table: 'indicator_monitoring',
        condition: 'timestamp < date("now")',
        query: 'SELECT COUNT(*) as count FROM indicator_monitoring WHERE timestamp < date("now")'
      },
      {
        name: '数据刷新日志',
        table: 'data_refresh_log',
        condition: 'timestamp < date("now")',
        query: 'SELECT COUNT(*) as count FROM data_refresh_log WHERE timestamp < date("now")'
      },
      {
        name: '数据质量问题记录',
        table: 'data_quality_issues',
        condition: 'created_at < date("now")',
        query: 'SELECT COUNT(*) as count FROM data_quality_issues WHERE created_at < date("now")'
      }
    ];

    let completedTasks = 0;
    let totalCleaned = 0;

    // 执行清理任务
    cleanupTasks.forEach((task, index) => {
      // 先查询要删除的记录数
      db.get(task.query, (err, row) => {
        if (err) {
          console.error(`❌ 查询${task.name}记录数失败:`, err.message);
          completedTasks++;
          if (completedTasks === cleanupTasks.length) {
            db.close();
            resolve();
          }
          return;
        }

        const countToDelete = row.count || 0;
        console.log(`📊 ${task.name}: 找到 ${countToDelete} 条今天之前的记录`);

        if (countToDelete === 0) {
          console.log(`✅ ${task.name}: 无需清理`);
          completedTasks++;
          if (completedTasks === cleanupTasks.length) {
            db.close();
            resolve();
          }
          return;
        }

        // 执行删除
        const deleteSQL = `DELETE FROM ${task.table} WHERE ${task.condition}`;
        db.run(deleteSQL, (err) => {
          if (err) {
            console.error(`❌ 删除${task.name}失败:`, err.message);
          } else {
            console.log(`✅ ${task.name}: 成功删除 ${countToDelete} 条记录`);
            totalCleaned += countToDelete;
          }

          completedTasks++;
          if (completedTasks === cleanupTasks.length) {
            console.log(`\n📊 清理完成统计:`);
            console.log(`   总共清理了 ${totalCleaned} 条记录`);
            console.log(`   清理时间: ${new Date().toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}`);
            
            // 执行数据库压缩
            console.log('\n💾 执行数据库压缩...');
            db.run('VACUUM', (err) => {
              if (err) {
                console.error('❌ 数据库压缩失败:', err.message);
              } else {
                console.log('✅ 数据库压缩完成');
              }
              
              db.close();
              resolve();
            });
          }
        });
      });
    });
  });
}

// 如果直接运行此脚本
if (require.main === module) {
  cleanupSimulationData()
    .then(() => {
      console.log('\n🎉 模拟交易数据清理完成!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 清理失败:', error);
      process.exit(1);
    });
}

module.exports = { cleanupSimulationData };
