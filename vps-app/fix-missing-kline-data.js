#!/usr/bin/env node

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

class MissingKlineDataFixer {
  constructor() {
    this.dbPath = path.join(__dirname, 'smartflow.db');
    this.db = null;
    
    // 需要修复的交易对
    this.symbols = ['HYPEUSDT', 'PUMPUSDT', 'LINEAUSDT'];
    
    // 数据收集配置
    this.intervals = {
      '4h': { limit: 250, required: 200 },
      '1h': { limit: 50, required: 40 },
      '15m': { limit: 50, required: 40 }
    };
  }

  async init() {
    this.db = new sqlite3.Database(this.dbPath);
    console.log('🔧 初始化数据库连接...');
  }

  async close() {
    if (this.db) {
      this.db.close();
      console.log('🔒 数据库连接已关闭');
    }
  }

  /**
   * 从Binance API获取K线数据
   */
  async getKlineData(symbol, interval = '4h', limit = 250) {
    try {
      const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
      console.log(`📡 获取 ${symbol} ${interval} K线数据: ${url}`);
      
      const response = await fetch(url);
      const data = await response.json();

      if (!data || data.length === 0) {
        throw new Error('API返回空数据');
      }

      return data.map(kline => ({
        openTime: parseInt(kline[0]),
        closeTime: parseInt(kline[6]),
        open: parseFloat(kline[1]),
        high: parseFloat(kline[2]),
        low: parseFloat(kline[3]),
        close: parseFloat(kline[4]),
        volume: parseFloat(kline[5]),
        quoteVolume: parseFloat(kline[7]),
        tradesCount: parseInt(kline[8]),
        takerBuyVolume: parseFloat(kline[9]),
        takerBuyQuoteVolume: parseFloat(kline[10])
      }));
    } catch (error) {
      console.error(`❌ 获取 ${symbol} ${interval} K线数据失败:`, error.message);
      return null;
    }
  }

  /**
   * 存储K线数据到数据库
   */
  async storeKlineData(symbol, interval, klineData) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO kline_data 
        (symbol, interval, open_time, close_time, open_price, high_price, low_price, close_price, 
         volume, quote_volume, trades_count, taker_buy_volume, taker_buy_quote_volume)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      let successCount = 0;
      let errorCount = 0;

      const processNext = (index) => {
        if (index >= klineData.length) {
          stmt.finalize();
          console.log(`✅ ${symbol} ${interval}: 成功存储 ${successCount} 条，失败 ${errorCount} 条`);
          resolve({ success: successCount, error: errorCount });
          return;
        }

        const kline = klineData[index];
        stmt.run([
          symbol, interval, kline.openTime, kline.closeTime,
          kline.open, kline.high, kline.low, kline.close,
          kline.volume, kline.quoteVolume, kline.tradesCount,
          kline.takerBuyVolume, kline.takerBuyQuoteVolume
        ], (err) => {
          if (err) {
            errorCount++;
            console.error(`❌ 存储 ${symbol} K线数据失败 [${index}]:`, err.message);
          } else {
            successCount++;
          }
          processNext(index + 1);
        });
      };

      processNext(0);
    });
  }

  /**
   * 检查数据库中现有的K线数据
   */
  async checkExistingData(symbol, interval) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT COUNT(*) as count 
        FROM kline_data 
        WHERE symbol = ? AND interval = ?
      `;
      
      this.db.get(sql, [symbol, interval], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? row.count : 0);
        }
      });
    });
  }

  /**
   * 修复指定交易对的K线数据
   */
  async fixSymbolData(symbol) {
    console.log(`\n🔧 修复 ${symbol} 的K线数据...`);
    
    const results = {
      symbol,
      intervals: {},
      totalCollected: 0,
      totalStored: 0
    };

    for (const [interval, config] of Object.entries(this.intervals)) {
      console.log(`\n📊 处理 ${symbol} ${interval} 数据...`);
      
      // 检查现有数据
      const existingCount = await this.checkExistingData(symbol, interval);
      console.log(`📋 现有数据: ${existingCount} 条`);
      
      // 如果数据不足，则收集新数据
      if (existingCount < config.required) {
        console.log(`⚠️  数据不足，需要收集更多数据...`);
        
        const klineData = await this.getKlineData(symbol, interval, config.limit);
        if (klineData && klineData.length > 0) {
          const storeResult = await this.storeKlineData(symbol, interval, klineData);
          
          results.intervals[interval] = {
            collected: klineData.length,
            stored: storeResult.success,
            errors: storeResult.error,
            existing: existingCount
          };
          
          results.totalCollected += klineData.length;
          results.totalStored += storeResult.success;
          
          // 添加延迟避免API限制
          await new Promise(resolve => setTimeout(resolve, 200));
        } else {
          console.error(`❌ ${symbol} ${interval}: 无法获取K线数据`);
          results.intervals[interval] = {
            collected: 0,
            stored: 0,
            errors: 1,
            existing: existingCount
          };
        }
      } else {
        console.log(`✅ ${symbol} ${interval}: 数据充足，无需修复`);
        results.intervals[interval] = {
          collected: 0,
          stored: 0,
          errors: 0,
          existing: existingCount
        };
      }
    }
    
    return results;
  }

  /**
   * 验证修复结果
   */
  async verifyFix() {
    console.log('\n🔍 验证修复结果...');
    
    for (const symbol of this.symbols) {
      console.log(`\n📋 ${symbol} 数据验证:`);
      
      for (const [interval, config] of Object.entries(this.intervals)) {
        const count = await this.checkExistingData(symbol, interval);
        const status = count >= config.required ? '✅' : '❌';
        console.log(`  ${interval}: ${count} 条 ${status} (需要: ${config.required})`);
      }
    }
  }

  /**
   * 清理数据质量问题记录
   */
  async cleanupDataQualityIssues() {
    console.log('\n🧹 清理数据质量问题记录...');
    
    return new Promise((resolve, reject) => {
      const sql = `
        DELETE FROM data_quality_issues 
        WHERE issue_type = 'KLINE_DATA_INSUFFICIENT' 
        AND symbol IN (?, ?, ?)
      `;
      
      this.db.run(sql, this.symbols, function(err) {
        if (err) {
          reject(err);
        } else {
          console.log(`✅ 清理了 ${this.changes} 条数据质量问题记录`);
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * 主修复流程
   */
  async fix() {
    try {
      await this.init();
      
      console.log('🚀 开始修复K线数据...');
      console.log(`📋 目标交易对: ${this.symbols.join(', ')}`);
      
      const results = [];
      
      for (const symbol of this.symbols) {
        const result = await this.fixSymbolData(symbol);
        results.push(result);
      }
      
      // 验证修复结果
      await this.verifyFix();
      
      // 清理数据质量问题记录
      await this.cleanupDataQualityIssues();
      
      // 输出总结
      console.log('\n📊 修复总结:');
      let totalCollected = 0;
      let totalStored = 0;
      
      results.forEach(result => {
        console.log(`\n${result.symbol}:`);
        totalCollected += result.totalCollected;
        totalStored += result.totalStored;
        
        Object.entries(result.intervals).forEach(([interval, data]) => {
          console.log(`  ${interval}: 收集${data.collected}条, 存储${data.stored}条, 错误${data.errors}条`);
        });
      });
      
      console.log(`\n🎯 总计: 收集${totalCollected}条, 存储${totalStored}条`);
      console.log('✅ K线数据修复完成!');
      
    } catch (error) {
      console.error('❌ 修复过程中出现错误:', error);
    } finally {
      await this.close();
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const fixer = new MissingKlineDataFixer();
  fixer.fix().then(() => {
    console.log('🎉 脚本执行完成');
    process.exit(0);
  }).catch(error => {
    console.error('💥 脚本执行失败:', error);
    process.exit(1);
  });
}

module.exports = MissingKlineDataFixer;
