// fix-atr-values.js
// 修复模拟交易记录中ATR值为空的问题

const DatabaseManager = require('./modules/database/DatabaseManager');
const StrategyV3Execution = require('./modules/strategy/StrategyV3Execution');

class ATRValueFixer {
  constructor() {
    this.db = null;
  }

  async init() {
    this.db = new DatabaseManager();
    await this.db.init();
    console.log('✅ 数据库连接初始化完成');
  }

  /**
   * 计算ATR值
   */
  async calculateATR(symbol, interval = '15m', period = 14) {
    try {
      console.log(`🧮 计算ATR值 [${symbol}][${interval}]...`);

      // 获取K线数据
      const klines = await this.db.runQuery(`
        SELECT open_time, close_time, open_price, high_price, low_price, close_price, volume
        FROM kline_data 
        WHERE symbol = ? AND interval = ?
        ORDER BY open_time DESC 
        LIMIT ?
      `, [symbol, interval, period + 10]); // 多取一些数据确保有足够的数据计算

      if (!klines || klines.length < period + 1) {
        console.warn(`⚠️ K线数据不足 [${symbol}][${interval}]: ${klines ? klines.length : 0} 条，需要至少 ${period + 1} 条`);
        return null;
      }

      // 转换为策略需要的格式（从最旧到最新）
      const candles = klines.reverse().map(row => ({
        open: parseFloat(row.open_price),
        high: parseFloat(row.high_price),
        low: parseFloat(row.low_price),
        close: parseFloat(row.close_price),
        volume: parseFloat(row.volume),
        openTime: row.open_time,
        closeTime: row.close_time
      }));

      // 使用StrategyV3Execution计算ATR
      const execution = new StrategyV3Execution(this.db);
      const atrValues = execution.calculateATR(candles, period);

      if (!atrValues || atrValues.length === 0) {
        console.warn(`⚠️ ATR计算失败 [${symbol}][${interval}]`);
        return null;
      }

      const latestATR = atrValues[atrValues.length - 1];
      console.log(`✅ ATR计算成功 [${symbol}][${interval}]: ${latestATR.toFixed(8)}`);
      
      return latestATR;

    } catch (error) {
      console.error(`❌ ATR计算异常 [${symbol}][${interval}]:`, error.message);
      return null;
    }
  }

  /**
   * 修复所有ATR值为空的模拟交易记录
   */
  async fixMissingATRValues() {
    try {
      console.log('🔍 开始修复ATR值为空的模拟交易记录...');

      // 获取所有ATR值为空的模拟交易记录
      const simulations = await this.db.runQuery(`
        SELECT id, symbol, entry_price, stop_loss_price, created_at
        FROM simulations 
        WHERE (atr_value IS NULL OR atr_value = 0) 
        AND (atr14 IS NULL OR atr14 = 0)
        ORDER BY created_at DESC
      `);

      console.log(`📊 找到 ${simulations.length} 条ATR值为空的记录`);

      let fixedCount = 0;
      let failedCount = 0;

      for (const sim of simulations) {
        const { id, symbol, entry_price, stop_loss_price } = sim;
        
        console.log(`\n🔧 修复记录 [${symbol}] (ID: ${id}):`);
        console.log(`  入场价: ${entry_price}`);
        console.log(`  止损价: ${stop_loss_price}`);

        // 计算ATR值
        const atrValue = await this.calculateATR(symbol, '15m', 14);
        
        if (atrValue && atrValue > 0) {
          // 更新数据库记录
          await this.db.run(`
            UPDATE simulations 
            SET atr_value = ?, atr14 = ?
            WHERE id = ?
          `, [atrValue, atrValue, id]);

          console.log(`  ✅ ATR值已更新: ${atrValue.toFixed(8)}`);
          fixedCount++;
        } else {
          console.log(`  ❌ ATR值计算失败`);
          failedCount++;
        }
      }

      console.log(`\n🎯 修复完成:`);
      console.log(`  成功修复: ${fixedCount} 条`);
      console.log(`  修复失败: ${failedCount} 条`);

      return { fixedCount, failedCount };

    } catch (error) {
      console.error('❌ 修复ATR值过程出错:', error);
      throw error;
    }
  }

  /**
   * 验证修复结果
   */
  async verifyATRFix() {
    try {
      console.log('\n🔍 验证ATR值修复结果...');

      // 检查所有模拟交易记录的ATR值状态
      const simulations = await this.db.runQuery(`
        SELECT symbol, atr_value, atr14, created_at
        FROM simulations 
        WHERE status = 'ACTIVE'
        ORDER BY created_at DESC
      `);

      console.log('\n📊 ATR值状态:');
      console.log('交易对\t\tATR值\t\tATR14\t\t状态');
      console.log('─'.repeat(60));

      let validATRCount = 0;
      let invalidATRCount = 0;

      for (const sim of simulations) {
        const { symbol, atr_value, atr14 } = sim;
        
        const hasValidATR = (atr_value && atr_value > 0) || (atr14 && atr14 > 0);
        const status = hasValidATR ? '✅' : '❌';
        
        if (hasValidATR) {
          validATRCount++;
        } else {
          invalidATRCount++;
        }
        
        console.log(`${symbol.padEnd(12)}\t${(atr_value || 0).toFixed(8)}\t${(atr14 || 0).toFixed(8)}\t${status}`);
      }

      console.log(`\n📊 统计结果:`);
      console.log(`  有效ATR值: ${validATRCount}/${simulations.length}`);
      console.log(`  无效ATR值: ${invalidATRCount}/${simulations.length}`);

      return { validATRCount, invalidATRCount, total: simulations.length };

    } catch (error) {
      console.error('❌ 验证过程出错:', error);
      throw error;
    }
  }

  /**
   * 运行完整的ATR修复流程
   */
  async runFullFix() {
    try {
      const fixResult = await this.fixMissingATRValues();
      const verifyResult = await this.verifyATRFix();
      
      console.log('\n🎉 ATR值修复流程完成！');
      console.log(`✅ 修复结果: ${fixResult.fixedCount} 成功, ${fixResult.failedCount} 失败`);
      console.log(`📊 验证结果: ${verifyResult.validATRCount}/${verifyResult.total} 有效`);
      
      return { fixResult, verifyResult };
    } catch (error) {
      console.error('❌ ATR修复流程失败:', error);
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
  const fixer = new ATRValueFixer();
  
  try {
    await fixer.init();
    await fixer.runFullFix();
  } catch (error) {
    console.error('❌ ATR修复失败:', error);
    process.exit(1);
  } finally {
    await fixer.close();
  }
}

// 运行修复脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = ATRValueFixer;
