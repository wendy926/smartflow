// fix-simulation-records.js
// 修复现有模拟交易记录中错误的杠杆和保证金数据

const SmartFlowStrategyV3 = require('./modules/strategy/SmartFlowStrategyV3');
const DatabaseManager = require('./modules/database/DatabaseManager');

class SimulationRecordsFixer {
  constructor() {
    this.db = null;
  }

  async init() {
    this.db = new DatabaseManager();
    await this.db.init();
    console.log('✅ 数据库连接初始化完成');
  }

  /**
   * 修复所有进行中的模拟交易记录
   */
  async fixActiveSimulations() {
    try {
      console.log('🔍 开始修复进行中的模拟交易记录...');

      // 获取所有进行中的交易记录
      const activeSimulations = await this.db.runQuery(`
        SELECT id, symbol, entry_price, stop_loss_price, max_leverage, min_margin, direction, created_at
        FROM simulations 
        WHERE status = 'ACTIVE'
        ORDER BY created_at DESC
      `);

      console.log(`📊 找到 ${activeSimulations.length} 条进行中的交易记录`);

      let fixedCount = 0;
      let totalCount = 0;

      for (const simulation of activeSimulations) {
        totalCount++;
        const { id, symbol, entry_price, stop_loss_price, max_leverage, min_margin, direction } = simulation;

        console.log(`\n🔧 检查交易记录 [${symbol}] (ID: ${id}):`);
        console.log(`  入场价: ${entry_price}`);
        console.log(`  止损价: ${stop_loss_price}`);
        console.log(`  方向: ${direction}`);
        console.log(`  当前杠杆: ${max_leverage}`);
        console.log(`  当前保证金: ${min_margin}`);

        // 计算正确的杠杆和保证金数据
        const correctData = await SmartFlowStrategyV3.calculateLeverageData(
          entry_price, 
          stop_loss_price, 
          null, 
          direction, 
          this.db,
          100 // 使用默认最大损失金额
        );

        console.log(`  正确杠杆: ${correctData.maxLeverage}`);
        console.log(`  正确保证金: ${correctData.minMargin}`);
        console.log(`  止损距离: ${correctData.stopLossDistance.toFixed(4)}%`);

        // 检查是否需要修复
        const needsFix = (
          max_leverage !== correctData.maxLeverage || 
          min_margin !== correctData.minMargin ||
          correctData.error // 如果计算有错误，也需要修复
        );

        if (needsFix) {
          if (correctData.error) {
            console.log(`  ⚠️ 计算失败: ${correctData.error}`);
            console.log(`  🔧 将使用安全的默认值`);
          } else {
            console.log(`  ✅ 计算成功，准备更新记录`);
          }

          // 更新数据库记录
          await this.db.run(`
            UPDATE simulations 
            SET max_leverage = ?, min_margin = ?, stop_loss_distance = ?
            WHERE id = ?
          `, [correctData.maxLeverage, correctData.minMargin, correctData.stopLossDistance, id]);

          console.log(`  ✅ 已更新记录 ID: ${id}`);
          fixedCount++;
        } else {
          console.log(`  ✅ 数据正确，无需修复`);
        }
      }

      console.log(`\n🎯 修复完成:`);
      console.log(`  总记录数: ${totalCount}`);
      console.log(`  修复记录数: ${fixedCount}`);
      console.log(`  正确记录数: ${totalCount - fixedCount}`);

    } catch (error) {
      console.error('❌ 修复过程出错:', error);
      throw error;
    }
  }

  /**
   * 验证修复结果
   */
  async verifyFixResults() {
    try {
      console.log('\n🔍 验证修复结果...');

      const activeSimulations = await this.db.runQuery(`
        SELECT symbol, entry_price, stop_loss_price, max_leverage, min_margin, direction, stop_loss_distance
        FROM simulations 
        WHERE status = 'ACTIVE'
        ORDER BY created_at DESC
      `);

      console.log('\n📊 修复后的交易记录:');
      console.log('交易对\t\t入场价\t\t止损价\t\t杠杆\t保证金\t止损距离%\t状态');
      console.log('─'.repeat(100));

      for (const sim of activeSimulations) {
        const { symbol, entry_price, stop_loss_price, max_leverage, min_margin, stop_loss_distance } = sim;
        
        // 验证当前记录是否正确
        const verification = await SmartFlowStrategyV3.calculateLeverageData(
          entry_price, 
          stop_loss_price, 
          null, 
          'LONG', // 假设都是多头
          this.db,
          100
        );

        const isCorrect = (
          max_leverage === verification.maxLeverage && 
          min_margin === verification.minMargin &&
          !verification.error
        );

        const status = isCorrect ? '✅' : '❌';
        
        console.log(`${symbol.padEnd(12)}\t${entry_price.toFixed(4)}\t\t${stop_loss_price.toFixed(4)}\t\t${max_leverage}\t${min_margin}\t${stop_loss_distance.toFixed(4)}%\t\t${status}`);
      }

    } catch (error) {
      console.error('❌ 验证过程出错:', error);
      throw error;
    }
  }

  /**
   * 运行完整的修复流程
   */
  async runFullFix() {
    try {
      await this.fixActiveSimulations();
      await this.verifyFixResults();
      console.log('\n🎉 所有修复任务完成！');
    } catch (error) {
      console.error('❌ 修复流程失败:', error);
      throw error;
    }
  }

  async close() {
    if (this.db) {
      await this.db.close();
      console.log('✅ 数据库连接已关闭');
    }
  }
}

// 主函数
async function main() {
  const fixer = new SimulationRecordsFixer();
  
  try {
    await fixer.init();
    await fixer.runFullFix();
  } catch (error) {
    console.error('❌ 修复失败:', error);
    process.exit(1);
  } finally {
    await fixer.close();
  }
}

// 运行修复脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = SimulationRecordsFixer;
