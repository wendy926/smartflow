#!/usr/bin/env node

/**
 * 修复模拟交易记录中缺失的ATR值
 * 根据入场价格和止损价格重新计算ATR值
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'smartflow.db');

class ATRFixer {
  constructor() {
    this.db = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('❌ 数据库连接失败:', err.message);
          reject(err);
        } else {
          console.log('✅ 数据库连接成功');
          resolve();
        }
      });
    });
  }

  async close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('❌ 关闭数据库失败:', err.message);
          } else {
            console.log('✅ 数据库连接已关闭');
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * 计算ATR值（简化版本）
   */
  calculateATR(entryPrice, stopLossPrice) {
    // 使用止损距离的1/3作为ATR的近似值
    const stopLossDistance = Math.abs(entryPrice - stopLossPrice) / entryPrice;
    return entryPrice * stopLossDistance * 0.33; // 简化计算
  }

  /**
   * 修复缺失的ATR值
   */
  async fixMissingATR() {
    try {
      console.log('🔍 查找缺失ATR值的模拟交易记录...');

      // 查找ATR值为空的记录
      const records = await this.runQuery(`
        SELECT id, symbol, entry_price, stop_loss_price, created_at, status
        FROM simulations 
        WHERE (atr_value IS NULL OR atr_value = '') 
           OR (atr14 IS NULL OR atr14 = '')
        ORDER BY created_at DESC
      `);

      console.log(`📊 找到 ${records.length} 条缺失ATR值的记录`);

      if (records.length === 0) {
        console.log('✅ 没有需要修复的记录');
        return;
      }

      let fixedCount = 0;
      let errorCount = 0;

      for (const record of records) {
        try {
          const { id, symbol, entry_price, stop_loss_price } = record;

          // 验证必要参数
          if (!entry_price || !stop_loss_price || entry_price <= 0 || stop_loss_price <= 0) {
            console.warn(`⚠️ 跳过记录 ${id} [${symbol}]: 价格参数无效`);
            continue;
          }

          // 计算ATR值
          const atrValue = this.calculateATR(entry_price, stop_loss_price);
          const atr14 = atrValue; // 使用相同的值

          // 更新记录
          await this.runQuery(`
            UPDATE simulations 
            SET atr_value = ?, atr14 = ?
            WHERE id = ?
          `, [atrValue, atr14, id]);

          console.log(`✅ 修复记录 ${id} [${symbol}]: ATR=${atrValue.toFixed(6)}`);
          fixedCount++;

        } catch (error) {
          console.error(`❌ 修复记录 ${record.id} [${record.symbol}] 失败:`, error.message);
          errorCount++;
        }
      }

      console.log(`\n📊 修复完成:`);
      console.log(`  ✅ 成功修复: ${fixedCount} 条记录`);
      console.log(`  ❌ 修复失败: ${errorCount} 条记录`);

    } catch (error) {
      console.error('❌ 修复ATR值失败:', error);
    }
  }

  /**
   * 验证修复结果
   */
  async verifyFix() {
    try {
      console.log('\n🔍 验证修复结果...');

      const remaining = await this.runQuery(`
        SELECT COUNT(*) as count
        FROM simulations 
        WHERE (atr_value IS NULL OR atr_value = '') 
           OR (atr14 IS NULL OR atr14 = '')
      `);

      console.log(`📊 剩余缺失ATR值的记录: ${remaining[0].count} 条`);

      if (remaining[0].count === 0) {
        console.log('🎉 所有ATR值已修复完成！');
      } else {
        console.log('⚠️ 仍有部分记录未修复');
      }

    } catch (error) {
      console.error('❌ 验证失败:', error);
    }
  }

  /**
   * 执行查询
   */
  runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * 运行修复
   */
  async run() {
    try {
      await this.connect();

      console.log('🚀 开始修复缺失的ATR值...\n');

      await this.fixMissingATR();
      await this.verifyFix();

      console.log('\n🎉 ATR值修复完成!');

    } catch (error) {
      console.error('❌ 修复失败:', error);
    } finally {
      await this.close();
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const fixer = new ATRFixer();
  fixer.run().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('❌ 运行失败:', error);
    process.exit(1);
  });
}

module.exports = ATRFixer;
