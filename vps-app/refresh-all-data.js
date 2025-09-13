const DatabaseManager = require('./modules/database/DatabaseManager');
const https = require('https');

function makeRequest(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// 所有需要处理的交易对
const SYMBOLS = [
    'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT', 'SOLUSDT', 
    'DOGEUSDT', 'TRXUSDT', 'MATICUSDT', 'DOTUSDT', 'AVAXUSDT', 'LINKUSDT',
    'UNIUSDT', 'LTCUSDT', 'BCHUSDT', 'ATOMUSDT', 'FILUSDT', 'ETCUSDT',
    'XLMUSDT', 'NEARUSDT', 'ALGOUSDT', 'VETUSDT', 'ICPUSDT', 'THETAUSDT',
    'FTMUSDT', 'MANAUSDT', 'SANDUSDT', 'AAVEUSDT', 'CRVUSDT', 'COMPUSDT',
    'MKRUSDT', 'YFIUSDT', 'SNXUSDT', 'UMAUSDT', 'SUSHIUSDT', '1INCHUSDT',
    'HYPEUSDT', 'PUMPUSDT', 'LINEAUSDT', 'TAOUSDT', 'SUIUSDT', 'ONDOUSDT',
    'FETUSDT', 'JUPUSDT', 'WIFUSDT', 'BOMEUSDT', 'PEPEUSDT', 'FLOKIUSDT'
];

const INTERVALS = ['4h', '1h', '15m'];

async function refreshAllKlineData() {
    const db = new DatabaseManager();
    
    try {
        console.log('🔧 初始化数据库连接...');
        await db.init();
        
        console.log('🚀 开始刷新所有交易对的K线数据...');
        console.log(`📋 处理 ${SYMBOLS.length} 个交易对，${INTERVALS.length} 个时间周期`);
        
        let totalProcessed = 0;
        let totalErrors = 0;
        
        for (const symbol of SYMBOLS) {
            console.log(`\n📊 处理 ${symbol}...`);
            
            for (const interval of INTERVALS) {
                try {
                    console.log(`  📈 刷新 ${interval} 数据...`);
                    
                    // 获取最新K线数据
                    const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=250`;
                    const klines = await makeRequest(url);
                    
                    let successCount = 0;
                    let errorCount = 0;
                    
                    for (const kline of klines) {
                        try {
                            await db.runQuery(
                                `INSERT OR REPLACE INTO kline_data 
                                (symbol, interval, open_time, close_time, open_price, high_price, low_price, close_price, volume, quote_volume, trades_count, taker_buy_volume, taker_buy_quote_volume)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                [
                                    symbol,
                                    interval,
                                    parseInt(kline[0]),
                                    parseInt(kline[6]),
                                    parseFloat(kline[1]),
                                    parseFloat(kline[2]),
                                    parseFloat(kline[3]),
                                    parseFloat(kline[4]),
                                    parseFloat(kline[5]),
                                    parseFloat(kline[7]),
                                    parseInt(kline[8]),
                                    parseFloat(kline[9]),
                                    parseFloat(kline[10])
                                ]
                            );
                            successCount++;
                        } catch (error) {
                            errorCount++;
                        }
                    }
                    
                    console.log(`    ✅ ${interval}: 成功存储 ${successCount} 条，失败 ${errorCount} 条`);
                    totalProcessed += successCount;
                    totalErrors += errorCount;
                    
                    // 避免请求过于频繁
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                } catch (error) {
                    console.log(`    ❌ ${interval}: 获取数据失败 - ${error.message}`);
                    totalErrors++;
                }
            }
        }
        
        console.log(`\n📊 刷新完成统计:`);
        console.log(`✅ 成功处理: ${totalProcessed} 条K线数据`);
        console.log(`❌ 失败: ${totalErrors} 条`);
        console.log(`📈 处理交易对: ${SYMBOLS.length} 个`);
        
        // 验证数据完整性
        console.log(`\n🔍 验证数据完整性...`);
        for (const symbol of SYMBOLS.slice(0, 5)) { // 只验证前5个交易对
            for (const interval of INTERVALS) {
                const result = await db.runQuery(
                    `SELECT COUNT(*) as count FROM kline_data WHERE symbol = ? AND interval = ?`,
                    [symbol, interval]
                );
                const count = result[0].count;
                const required = interval === '4h' ? 200 : 40;
                const status = count >= required ? '✅' : '❌';
                console.log(`📋 ${symbol} ${interval}: ${count} 条 ${status}`);
            }
        }
        
        console.log('\n✅ 所有K线数据刷新完成!');
        
    } catch (error) {
        console.error('❌ 刷新失败:', error.message);
    } finally {
        await db.close();
        console.log('🔒 数据库连接已关闭');
    }
}

refreshAllKlineData();
