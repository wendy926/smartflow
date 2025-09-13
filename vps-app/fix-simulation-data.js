// fix-simulation-data.js
// 修复模拟交易记录中错误的杠杆和保证金数据

const DatabaseManager = require('./modules/database/DatabaseManager');

class SimulationDataFixer {
  constructor() {
    this.db = null;
  }

  async init() {
    this.db = new DatabaseManager();
    await this.db.init();
    console.log('✅ 数据库连接初始化完成');
  }

  /**
   * 计算正确的杠杆和保证金数据
   */
  calculateCorrectLeverageData(entryPrice, stopLossPrice, direction = 'LONG', maxLossAmount = 100) {
    let maxLeverage = 0;
    let minMargin = 0;
    let stopLossDistance = 0;

    if (entryPrice && stopLossPrice && entryPrice > 0) {
      // 根据方向计算止损距离百分比
      if (direction === 'LONG') {
        // 多头：止损价低于入场价
        stopLossDistance = (entryPrice - stopLossPrice) / entryPrice;
      } else {
        // 空头：止损价高于入场价
        stopLossDistance = (stopLossPrice - entryPrice) / entryPrice;
      }

      // 确保止损距离为正数
      stopLossDistance = Math.abs(stopLossDistance);

      // 最大杠杆数：1/(止损距离% + 0.5%) 数值向下取整
      if (stopLossDistance > 0) {
        maxLeverage = Math.floor(1 / (stopLossDistance + 0.005));
      }

      // 最小保证金：最大损失金额/(杠杆数 × 止损距离%) 数值向上取整
      if (maxLeverage > 0 && stopLossDistance > 0) {
        minMargin = Math.ceil(maxLossAmount / (maxLeverage * stopLossDistance));
      }
    }

    return {
      maxLeverage: Math.max(1, maxLeverage),
      minMargin: minMargin,
      stopLossDistance: stopLossDistance * 100 // 转换为百分比
    };
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

        // 计算正确的杠杆和保证金数据
        const correctData = this.calculateCorrectLeverageData(
          entry_price, 
          stop_loss_price, 
          direction, 
          100 // 使用默认最大损失金额
        );

        // 检查是否需要修复
        const needsFix = (
          max_leverage !== correctData.maxLeverage || 
          min_margin !== correctData.minMargin
        );

        if (needsFix) {
          console.log(`\n🔧 修复交易记录 [${symbol}]:`);
          console.log(`  入场价: ${entry_price}`);
          console.log(`  止损价: ${stop_loss_price}`);
          console.log(`  方向: ${direction}`);
          console.log(`  止损距离: ${correctData.stopLossDistance.toFixed(4)}%`);
          console.log(`  当前杠杆: ${max_leverage} → 正确杠杆: ${correctData.maxLeverage}`);
          console.log(`  当前保证金: ${min_margin} → 正确保证金: ${correctData.minMargin}`);

          // 更新数据库记录
          await this.db.run(`
            UPDATE simulations 
            SET max_leverage = ?, min_margin = ?, stop_loss_distance = ?
            WHERE id = ?
          `, [correctData.maxLeverage, correctData.minMargin, correctData.stopLossDistance, id]);

          console.log(`  ✅ 已更新记录 ID: ${id}`);
          fixedCount++;
        } else {
          console.log(`✅ [${symbol}] 数据正确，无需修复`);
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
      console.log('交易对\t\t入场价\t\t止损价\t\t杠杆\t保证金\t止损距离%');
      console.log('─'.repeat(80));

      for (const sim of activeSimulations) {
        const { symbol, entry_price, stop_loss_price, max_leverage, min_margin, stop_loss_distance } = sim;
        console.log(`${symbol.padEnd(12)}\t${entry_price.toFixed(4)}\t\t${stop_loss_price.toFixed(4)}\t\t${max_leverage}\t${min_margin}\t${stop_loss_distance.toFixed(4)}%`);
      }

    } catch (error) {
      console.error('❌ 验证过程出错:', error);
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
  const fixer = new SimulationDataFixer();
  
  try {
    await fixer.init();
    await fixer.fixActiveSimulations();
    await fixer.verifyFixResults();
    console.log('\n🎉 所有修复任务完成！');
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

module.exports = SimulationDataFixer;
