#!/usr/bin/env node

// 收集缺失的K线数据
// 为API中使用的所有交易对收集4H/1H/15m K线数据

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { default: fetch } = require('node-fetch');

class MissingKlineDataCollector {
  constructor() {
    this.dbPath = path.join(__dirname, 'smartflow.db');
    this.db = null;
    this.apiSymbols = [
      'AAVEUSDT', 'ADAUSDT', 'AVAXUSDT', 'BNBUSDT', 'BTCUSDT', 'DOGEUSDT',
      'ENAUSDT', 'ETHUSDT', 'FETUSDT', 'HYPEUSDT', 'LDOUSDT', 'LINEAUSDT',
      'LINKUSDT', 'ONDOUSDT', 'PUMPUSDT', 'SOLUSDT', 'SUIUSDT', 'TAOUSDT',
      'TRXUSDT', 'XLMUSDT', 'XRPUSDT'
    ];
  }

  async init() {
    this.db = new sqlite3.Database(this.dbPath);
    console.log('🔧 初始化数据库连接...');
  }

  async getKlineData(symbol, interval = '4h', limit = 250) {
    try {
      const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
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

  async checkMissingSymbols() {
    console.log('🔍 检查缺失的交易对数据...');
    
    const missingSymbols = [];
    
    for (const symbol of this.apiSymbols) {
      const count = await new Promise((resolve, reject) => {
        this.db.get(
          'SELECT COUNT(*) as count FROM kline_data WHERE symbol = ? AND interval = ?',
          [symbol, '4h'],
          (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          }
        );
      });
      
      if (count < 200) {
        missingSymbols.push(symbol);
        console.log(`⚠️  ${symbol}: 4H数据不足 (${count}/200)`);
      }
    }
    
    return missingSymbols;
  }

  async collectMissingData() {
    console.log('🔧 开始收集缺失的K线数据...');
    
    const missingSymbols = await this.checkMissingSymbols();
    
    if (missingSymbols.length === 0) {
      console.log('✅ 所有交易对数据完整，无需收集');
      return;
    }
    
    console.log(`📊 需要收集 ${missingSymbols.length} 个交易对的数据`);
    
    const results = {
      total: 0,
      success: 0,
      error: 0
    };

    for (const symbol of missingSymbols) {
      console.log(`\n📊 处理 ${symbol}...`);
      
      // 收集4H数据
      const klineData4h = await this.getKlineData(symbol, '4h', 250);
      if (klineData4h) {
        const result4h = await this.storeKlineData(symbol, '4h', klineData4h);
        results.total += klineData4h.length;
        results.success += result4h.success;
        results.error += result4h.error;
      }

      // 收集1H数据
      const klineData1h = await this.getKlineData(symbol, '1h', 50);
      if (klineData1h) {
        const result1h = await this.storeKlineData(symbol, '1h', klineData1h);
        results.total += klineData1h.length;
        results.success += result1h.success;
        results.error += result1h.error;
      }

      // 收集15m数据
      const klineData15m = await this.getKlineData(symbol, '15m', 50);
      if (klineData15m) {
        const result15m = await this.storeKlineData(symbol, '15m', klineData15m);
        results.total += klineData15m.length;
        results.success += result15m.success;
        results.error += result15m.error;
      }

      // 添加延迟避免API限制
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log('\n📈 收集结果统计:');
    console.log(`总数据量: ${results.total}`);
    console.log(`成功存储: ${results.success}`);
    console.log(`存储失败: ${results.error}`);
    console.log(`成功率: ${((results.success / results.total) * 100).toFixed(2)}%`);
  }

  async verifyData() {
    console.log('\n🔍 验证数据收集结果...');
    
    const totalCount = await new Promise((resolve, reject) => {
      this.db.get('SELECT COUNT(*) as count FROM kline_data', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
    
    console.log(`✅ 数据库中总K线记录数: ${totalCount}`);
    
    // 检查每个交易对的数据完整性
    for (const symbol of this.apiSymbols) {
      const counts = await new Promise((resolve, reject) => {
        this.db.all(
          'SELECT interval, COUNT(*) as count FROM kline_data WHERE symbol = ? GROUP BY interval',
          [symbol],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });
      
      const countMap = {};
      counts.forEach(row => {
        countMap[row.interval] = row.count;
      });
      
      console.log(`${symbol}: 4H=${countMap['4h'] || 0}, 1H=${countMap['1h'] || 0}, 15m=${countMap['15m'] || 0}`);
    }
  }

  async close() {
    if (this.db) {
      this.db.close();
    }
  }
}

async function main() {
  const collector = new MissingKlineDataCollector();
  
  try {
    await collector.init();
    await collector.collectMissingData();
    await collector.verifyData();
    console.log('\n🎉 缺失K线数据收集完成！');
  } catch (error) {
    console.error('❌ 收集过程中出现错误:', error);
  } finally {
    await collector.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = MissingKlineDataCollector;
