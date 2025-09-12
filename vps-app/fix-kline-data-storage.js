#!/usr/bin/env node

// 修复K线数据存储问题
// 1. 检查Binance API连通性
// 2. 收集K线数据并存储到数据库
// 3. 验证数据存储成功

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { default: fetch } = require('node-fetch');

class KlineDataFixer {
  constructor() {
    this.dbPath = path.join(__dirname, 'smartflow.db');
    this.db = null;
    this.symbols = [
      'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'AVAXUSDT', 'DOGEUSDT', 'BNBUSDT',
      'ADAUSDT', 'XRPUSDT', 'MATICUSDT', 'LINKUSDT', 'UNIUSDT', 'LTCUSDT',
      'ATOMUSDT', 'DOTUSDT', 'NEARUSDT', 'ALGOUSDT', 'VETUSDT', 'ICPUSDT',
      'FILUSDT', 'TRXUSDT', 'LINEAUSDT'
    ];
  }

  async init() {
    this.db = new sqlite3.Database(this.dbPath);
    console.log('🔧 初始化数据库连接...');
  }

  async testBinanceAPI() {
    console.log('🌐 测试Binance API连通性...');
    try {
      const response = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=4h&limit=5');
      const data = await response.json();
      
      if (data && data.length > 0) {
        console.log('✅ Binance API连通性正常');
        console.log(`📊 获取到 ${data.length} 条K线数据`);
        return true;
      } else {
        console.log('❌ Binance API返回空数据');
        return false;
      }
    } catch (error) {
      console.log('❌ Binance API连接失败:', error.message);
      return false;
    }
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

  async fixKlineData() {
    console.log('🔧 开始修复K线数据存储...');
    
    // 1. 测试API连通性
    const apiWorking = await this.testBinanceAPI();
    if (!apiWorking) {
      console.log('❌ API连通性测试失败，无法继续');
      return;
    }

    // 2. 收集并存储K线数据
    const results = {
      total: 0,
      success: 0,
      error: 0
    };

    for (const symbol of this.symbols) {
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
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n📈 修复结果统计:');
    console.log(`总数据量: ${results.total}`);
    console.log(`成功存储: ${results.success}`);
    console.log(`存储失败: ${results.error}`);
    console.log(`成功率: ${((results.success / results.total) * 100).toFixed(2)}%`);
  }

  async verifyData() {
    console.log('\n🔍 验证数据存储结果...');
    
    return new Promise((resolve, reject) => {
      this.db.get('SELECT COUNT(*) as count FROM kline_data', (err, row) => {
        if (err) {
          reject(err);
        } else {
          console.log(`✅ 数据库中总K线记录数: ${row.count}`);
          resolve(row.count);
        }
      });
    });
  }

  async close() {
    if (this.db) {
      this.db.close();
    }
  }
}

async function main() {
  const fixer = new KlineDataFixer();
  
  try {
    await fixer.init();
    await fixer.fixKlineData();
    await fixer.verifyData();
    console.log('\n🎉 K线数据修复完成！');
  } catch (error) {
    console.error('❌ 修复过程中出现错误:', error);
  } finally {
    await fixer.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = KlineDataFixer;
