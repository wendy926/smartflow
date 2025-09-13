const SafeDatabaseManager = require('./modules/database/SafeDatabaseManager');
const BinanceAPI = require('./modules/api/BinanceAPI');
const SmartFlowStrategyV3 = require('./modules/strategy/SmartFlowStrategyV3');

/**
 * 诊断前端显示问题
 * 1. 检查当前价格获取问题
 * 2. 检查数据收集率计算问题
 */
async function diagnoseFrontendIssues() {
    const safeDB = new SafeDatabaseManager();
    
    try {
        await safeDB.init();
        console.log('🔍 开始诊断前端显示问题...\n');
        
        const testSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
        const issues = {
            priceIssues: [],
            dataCollectionIssues: [],
            apiIssues: []
        };
        
        // 1. 检查当前价格获取
        console.log('📊 1. 检查当前价格获取...');
        for (const symbol of testSymbols) {
            console.log(`\n🔍 测试 ${symbol}:`);
            
            // 测试getTicker API
            try {
                const ticker = await BinanceAPI.getTicker(symbol);
                console.log(`  ✅ getTicker成功:`, JSON.stringify(ticker));
                
                if (ticker && ticker.price) {
                    const price = parseFloat(ticker.price);
                    console.log(`  ✅ 价格解析成功: ${price}`);
                } else {
                    console.log(`  ❌ 价格字段缺失或无效`);
                    issues.priceIssues.push(`${symbol}: ticker.price字段缺失`);
                }
            } catch (error) {
                console.log(`  ❌ getTicker失败: ${error.message}`);
                issues.apiIssues.push(`${symbol}: getTicker API调用失败 - ${error.message}`);
            }
            
            // 测试get24hrTicker API
            try {
                const ticker24h = await BinanceAPI.get24hrTicker(symbol);
                console.log(`  ✅ get24hrTicker成功:`, JSON.stringify(ticker24h));
                
                if (ticker24h && ticker24h.lastPrice) {
                    const price = parseFloat(ticker24h.lastPrice);
                    console.log(`  ✅ 24h价格解析成功: ${price}`);
                } else {
                    console.log(`  ❌ 24h价格字段缺失或无效`);
                    issues.priceIssues.push(`${symbol}: ticker24h.lastPrice字段缺失`);
                }
            } catch (error) {
                console.log(`  ❌ get24hrTicker失败: ${error.message}`);
                issues.apiIssues.push(`${symbol}: get24hrTicker API调用失败 - ${error.message}`);
            }
            
            // 测试完整的策略分析
            try {
                const strategy = new SmartFlowStrategyV3(safeDB.database);
                const analysis = await strategy.analyzeSymbol(symbol);
                
                console.log(`  ✅ 策略分析成功:`, {
                    currentPrice: analysis.currentPrice,
                    trend4h: analysis.trend4h,
                    marketType: analysis.marketType
                });
                
                if (!analysis.currentPrice || analysis.currentPrice === 0) {
                    issues.priceIssues.push(`${symbol}: 策略分析返回的currentPrice为${analysis.currentPrice}`);
                }
            } catch (error) {
                console.log(`  ❌ 策略分析失败: ${error.message}`);
                issues.apiIssues.push(`${symbol}: 策略分析失败 - ${error.message}`);
            }
        }
        
        // 2. 检查数据收集率计算
        console.log('\n\n📊 2. 检查数据收集率计算...');
        
        // 检查K线数据
        for (const symbol of testSymbols) {
            console.log(`\n🔍 检查 ${symbol} 的K线数据:`);
            
            // 检查4H数据
            try {
                const klines4h = await safeDB.database.runQuery(`
                    SELECT COUNT(*) as count, MAX(close_time) as latest_time 
                    FROM kline_data 
                    WHERE symbol = ? AND interval = '4h'
                `, [symbol]);
                
                const count4h = klines4h[0]?.count || 0;
                const latestTime4h = klines4h[0]?.latest_time;
                
                console.log(`  4H K线数据: ${count4h}条, 最新时间: ${latestTime4h ? new Date(latestTime4h).toISOString() : '无'}`);
                
                if (count4h === 0) {
                    issues.dataCollectionIssues.push(`${symbol}: 4H K线数据为空`);
                }
            } catch (error) {
                console.log(`  ❌ 检查4H数据失败: ${error.message}`);
                issues.dataCollectionIssues.push(`${symbol}: 4H数据查询失败 - ${error.message}`);
            }
            
            // 检查1H数据
            try {
                const klines1h = await safeDB.database.runQuery(`
                    SELECT COUNT(*) as count, MAX(close_time) as latest_time 
                    FROM kline_data 
                    WHERE symbol = ? AND interval = '1h'
                `, [symbol]);
                
                const count1h = klines1h[0]?.count || 0;
                const latestTime1h = klines1h[0]?.latest_time;
                
                console.log(`  1H K线数据: ${count1h}条, 最新时间: ${latestTime1h ? new Date(latestTime1h).toISOString() : '无'}`);
                
                if (count1h === 0) {
                    issues.dataCollectionIssues.push(`${symbol}: 1H K线数据为空`);
                }
            } catch (error) {
                console.log(`  ❌ 检查1H数据失败: ${error.message}`);
                issues.dataCollectionIssues.push(`${symbol}: 1H数据查询失败 - ${error.message}`);
            }
        }
        
        // 3. 检查Binance API成功率
        console.log('\n\n📊 3. 检查Binance API成功率...');
        try {
            const stats = BinanceAPI.getRealTimeStats();
            console.log('API统计信息:', JSON.stringify(stats, null, 2));
            
            if (stats.global.successRate < 100) {
                issues.dataCollectionIssues.push(`Binance API成功率仅为${stats.global.successRate}%`);
            }
        } catch (error) {
            console.log(`❌ 获取API统计失败: ${error.message}`);
            issues.dataCollectionIssues.push(`API统计获取失败 - ${error.message}`);
        }
        
        // 4. 检查监控数据
        console.log('\n\n📊 4. 检查监控数据...');
        try {
            // 模拟监控数据计算
            const symbols = await safeDB.database.runQuery(`
                SELECT DISTINCT symbol FROM kline_data
            `);
            
            console.log(`数据库中的交易对数量: ${symbols.length}`);
            
            let dataCollectionSuccess = 0;
            for (const { symbol } of symbols) {
                const klineCount = await safeDB.database.runQuery(`
                    SELECT COUNT(*) as count FROM kline_data WHERE symbol = ?
                `, [symbol]);
                
                if (klineCount[0].count > 0) {
                    dataCollectionSuccess++;
                }
            }
            
            const dataCollectionRate = symbols.length > 0 ? (dataCollectionSuccess / symbols.length) * 100 : 0;
            console.log(`数据收集成功率: ${dataCollectionRate.toFixed(1)}% (${dataCollectionSuccess}/${symbols.length})`);
            
            if (dataCollectionRate < 100) {
                issues.dataCollectionIssues.push(`数据收集率仅为${dataCollectionRate.toFixed(1)}%`);
            }
            
        } catch (error) {
            console.log(`❌ 检查监控数据失败: ${error.message}`);
            issues.dataCollectionIssues.push(`监控数据检查失败 - ${error.message}`);
        }
        
        // 生成诊断报告
        console.log('\n' + '='.repeat(60));
        console.log('📋 前端显示问题诊断报告');
        console.log('='.repeat(60));
        
        if (issues.priceIssues.length > 0) {
            console.log('\n❌ 价格显示问题:');
            issues.priceIssues.forEach((issue, index) => {
                console.log(`   ${index + 1}. ${issue}`);
            });
        }
        
        if (issues.dataCollectionIssues.length > 0) {
            console.log('\n⚠️ 数据收集率问题:');
            issues.dataCollectionIssues.forEach((issue, index) => {
                console.log(`   ${index + 1}. ${issue}`);
            });
        }
        
        if (issues.apiIssues.length > 0) {
            console.log('\n🔌 API调用问题:');
            issues.apiIssues.forEach((issue, index) => {
                console.log(`   ${index + 1}. ${issue}`);
            });
        }
        
        if (issues.priceIssues.length === 0 && issues.dataCollectionIssues.length === 0 && issues.apiIssues.length === 0) {
            console.log('\n🎉 未发现明显问题！');
        }
        
        console.log('\n' + '='.repeat(60));
        
        return {
            success: issues.priceIssues.length === 0 && issues.dataCollectionIssues.length === 0 && issues.apiIssues.length === 0,
            issues
        };
        
    } catch (error) {
        console.error('❌ 诊断过程异常:', error.message);
        return {
            success: false,
            error: error.message
        };
    } finally {
        await safeDB.close();
    }
}

// 运行诊断
diagnoseFrontendIssues().then(result => {
    if (result.success) {
        console.log('\n🎉 诊断完成，未发现重大问题！');
        process.exit(0);
    } else {
        console.log('\n⚠️ 诊断完成，发现了问题需要修复！');
        process.exit(1);
    }
}).catch(error => {
    console.error('❌ 诊断执行失败:', error.message);
    process.exit(1);
});
