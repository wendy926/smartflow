// fix-kline-data-update.js - 修复K线数据更新逻辑

const https = require('https');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class KlineDataUpdater {
  constructor() {
    this.dbPath = path.join(__dirname, 'smartflow.db');
    this.db = null;
    this.symbols = [];
    this.updateInterval = null;
  }

  async init() {
    console.log('🔧 初始化K线数据更新器...');
    
    // 连接数据库
    this.db = new sqlite3.Database(this.dbPath);
    
    // 获取交易对列表
    this.symbols = await this.getSymbols();
    console.log(`📊 获取到 ${this.symbols.length} 个交易对`);
    
    // 检查数据新鲜度
    await this.checkDataFreshness();
  }

  async getSymbols() {
    return new Promise((resolve, reject) => {
      this.db.all("SELECT DISTINCT symbol FROM kline_data", (err, rows) => {
        if (err) {
          console.error('获取交易对列表失败:', err);
          resolve([]);
        } else {
          const symbols = rows.map(row => row.symbol);
          resolve(symbols);
        }
      });
    });
  }

  async checkDataFreshness() {
    console.log('\n🔍 检查数据新鲜度...');
    
    const now = Date.now();
    const staleThreshold = 4 * 60 * 60 * 1000; // 4小时阈值
    
    for (const symbol of this.symbols) {
      const freshness = await this.getSymbolDataFreshness(symbol);
      
      if (freshness.isStale) {
        console.log(`⚠️ ${symbol}: 数据过期 ${freshness.ageHours.toFixed(1)} 小时`);
      } else {
        console.log(`✅ ${symbol}: 数据新鲜 (${freshness.ageHours.toFixed(1)} 小时前)`);
      }
    }
  }

  async getSymbolDataFreshness(symbol) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT MAX(close_time) as latest_close_time
        FROM kline_data 
        WHERE symbol = ? AND interval = '4h'
      `;
      
      this.db.get(sql, [symbol], (err, row) => {
        if (err) {
          resolve({ isStale: true, ageHours: 999 });
        } else if (!row || !row.latest_close_time) {
          resolve({ isStale: true, ageHours: 999 });
        } else {
          const ageMs = Date.now() - row.latest_close_time;
          const ageHours = ageMs / (1000 * 60 * 60);
          const isStale = ageHours > 4;
          
          resolve({ isStale, ageHours });
        }
      });
    });
  }

  async updateKlineData(symbol, interval = '4h') {
    try {
      console.log(`📊 更新 ${symbol} ${interval} 数据...`);
      
      // 从Binance API获取最新数据
      const klines = await this.fetchKlinesFromAPI(symbol, interval, 250);
      
      if (!klines || klines.length === 0) {
        console.log(`❌ ${symbol} ${interval}: 无数据`);
        return { success: 0, error: 1 };
      }

      // 存储到数据库
      let successCount = 0;
      let errorCount = 0;

      for (const kline of klines) {
        try {
          await this.storeKline(symbol, interval, kline);
          successCount++;
        } catch (error) {
          console.error(`存储K线失败 [${symbol}]:`, error);
          errorCount++;
        }
      }

      console.log(`✅ ${symbol} ${interval}: 成功 ${successCount}, 失败 ${errorCount}`);
      return { success: successCount, error: errorCount };

    } catch (error) {
      console.error(`更新K线数据失败 [${symbol} ${interval}]:`, error);
      return { success: 0, error: 1 };
    }
  }

  async fetchKlinesFromAPI(symbol, interval, limit) {
    return new Promise((resolve, reject) => {
      const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
      
      https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const klines = JSON.parse(data);
            resolve(klines);
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', (error) => {
        reject(error);
      });
    });
  }

  async storeKline(symbol, interval, kline) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO kline_data 
        (symbol, interval, open_time, close_time, open_price, high_price, low_price, close_price, 
         volume, quote_volume, trades_count, taker_buy_volume, taker_buy_quote_volume)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const params = [
        symbol,
        interval,
        parseInt(kline[0]),    // open_time
        parseInt(kline[6]),    // close_time
        parseFloat(kline[1]),  // open_price
        parseFloat(kline[2]),  // high_price
        parseFloat(kline[3]),  // low_price
        parseFloat(kline[4]),  // close_price
        parseFloat(kline[5]),  // volume
        parseFloat(kline[7]),  // quote_volume
        parseInt(kline[8]),    // trades_count
        parseFloat(kline[9]),  // taker_buy_volume
        parseFloat(kline[10])  // taker_buy_quote_volume
      ];
      
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  async updateAllSymbols() {
    console.log('\n🚀 开始批量更新所有交易对数据...');
    
    const intervals = ['4h', '1h', '15m'];
    const results = {
      total: 0,
      success: 0,
      error: 0
    };

    for (const symbol of this.symbols) {
      console.log(`\n📊 处理 ${symbol}...`);
      
      for (const interval of intervals) {
        const result = await this.updateKlineData(symbol, interval);
        results.total += result.success + result.error;
        results.success += result.success;
        results.error += result.error;
        
        // 添加延迟避免API限制
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log('\n📈 更新结果统计:');
    console.log(`总数据量: ${results.total}`);
    console.log(`成功更新: ${results.success}`);
    console.log(`更新失败: ${results.error}`);
    console.log(`成功率: ${((results.success / results.total) * 100).toFixed(2)}%`);
    
    return results;
  }

  async updateSpecificSymbol(symbol) {
    console.log(`\n🎯 更新特定交易对: ${symbol}`);
    
    const intervals = ['4h', '1h', '15m'];
    const results = {
      total: 0,
      success: 0,
      error: 0
    };

    for (const interval of intervals) {
      const result = await this.updateKlineData(symbol, interval);
      results.total += result.success + result.error;
      results.success += result.success;
      results.error += result.error;
      
      // 添加延迟避免API限制
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n📈 ${symbol} 更新结果:`);
    console.log(`成功更新: ${results.success}`);
    console.log(`更新失败: ${results.error}`);
    
    return results;
  }

  startAutoUpdate(intervalMinutes = 60) {
    console.log(`\n⏰ 启动自动更新服务 (间隔: ${intervalMinutes} 分钟)`);
    
    this.updateInterval = setInterval(async () => {
      console.log('\n🔄 开始定时更新K线数据...');
      
      try {
        // 只更新4H数据，因为这是MA计算的主要数据源
        for (const symbol of this.symbols) {
          await this.updateKlineData(symbol, '4h');
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        console.log('✅ 定时更新完成');
      } catch (error) {
        console.error('❌ 定时更新失败:', error);
      }
    }, intervalMinutes * 60 * 1000);
  }

  stopAutoUpdate() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      console.log('⏹️ 自动更新服务已停止');
    }
  }

  async verifyUpdate() {
    console.log('\n🔍 验证更新结果...');
    
    for (const symbol of this.symbols) {
      const freshness = await this.getSymbolDataFreshness(symbol);
      const status = freshness.isStale ? '❌ 仍过期' : '✅ 已更新';
      console.log(`${symbol}: ${status} (${freshness.ageHours.toFixed(1)} 小时前)`);
    }
  }

  close() {
    this.stopAutoUpdate();
    if (this.db) {
      this.db.close();
    }
  }
}

// 主函数
async function main() {
  const updater = new KlineDataUpdater();
  
  try {
    await updater.init();
    
    // 检查命令行参数
    const args = process.argv.slice(2);
    const command = args[0];
    const symbol = args[1];
    
    switch (command) {
      case 'update-all':
        await updater.updateAllSymbols();
        break;
        
      case 'update-symbol':
        if (symbol) {
          await updater.updateSpecificSymbol(symbol);
        } else {
          console.log('请指定交易对: node fix-kline-data-update.js update-symbol AAVEUSDT');
        }
        break;
        
      case 'start-auto':
        const interval = parseInt(args[1]) || 60;
        updater.startAutoUpdate(interval);
        // 保持进程运行
        process.on('SIGINT', () => {
          console.log('\n🛑 接收到停止信号...');
          updater.close();
          process.exit(0);
        });
        break;
        
      default:
        console.log('用法:');
        console.log('  node fix-kline-data-update.js update-all          # 更新所有交易对');
        console.log('  node fix-kline-data-update.js update-symbol AAVEUSDT  # 更新特定交易对');
        console.log('  node fix-kline-data-update.js start-auto [间隔分钟]   # 启动自动更新');
        break;
    }
    
    if (command !== 'start-auto') {
      await updater.verifyUpdate();
      updater.close();
    }
    
  } catch (error) {
    console.error('❌ 执行失败:', error);
    updater.close();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = KlineDataUpdater;
