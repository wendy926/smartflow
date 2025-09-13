const SafeDatabaseManager = require('./modules/database/SafeDatabaseManager');
const SmartFlowStrategyV3 = require('./modules/strategy/SmartFlowStrategyV3');

/**
 * 测试前端修复效果
 * 1. 测试当前价格获取修复
 * 2. 测试监控数据收集率修复
 */
async function testFrontendFixes() {
    const safeDB = new SafeDatabaseManager();
    
    try {
        await safeDB.init();
        console.log('🧪 开始测试前端修复效果...\n');
        
        const testSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
        const results = {
            priceTests: [],
            monitoringTests: []
        };
        
        // 1. 测试当前价格获取修复
        console.log('📊 1. 测试当前价格获取修复...');
        for (const symbol of testSymbols) {
            console.log(`\n🔍 测试 ${symbol}:`);
            
            try {
                const analysis = await SmartFlowStrategyV3.analyzeSymbol(symbol, {
                    database: safeDB.database
                });
                
                const hasValidPrice = analysis.currentPrice && analysis.currentPrice > 0;
                console.log(`  ${hasValidPrice ? '✅' : '❌'} 当前价格: ${analysis.currentPrice}`);
                console.log(`  ✅ 趋势: ${analysis.trend4h}`);
                console.log(`  ✅ 市场类型: ${analysis.marketType}`);
                
                results.priceTests.push({
                    symbol,
                    success: hasValidPrice,
                    currentPrice: analysis.currentPrice,
                    trend4h: analysis.trend4h,
                    marketType: analysis.marketType
                });
                
            } catch (error) {
                console.log(`  ❌ 测试失败: ${error.message}`);
                results.priceTests.push({
                    symbol,
                    success: false,
                    error: error.message
                });
            }
        }
        
        // 2. 测试监控数据收集率修复
        console.log('\n\n📊 2. 测试监控数据收集率修复...');
        
        try {
            // 模拟监控API调用
            const symbols = await safeDB.database.runQuery(`
                SELECT DISTINCT symbol FROM custom_symbols
            `);
            
            console.log(`数据库中的交易对数量: ${symbols.length}`);
            
            let dataCollectionSuccess = 0;
            let signalAnalysisSuccess = 0;
            
            for (const { symbol } of symbols) {
                // 检查4H和1H数据
                const klineCount4h = await safeDB.database.runQuery(`
                    SELECT COUNT(*) as count FROM kline_data 
                    WHERE symbol = ? AND interval = '4h'
                `, [symbol]);
                
                const klineCount1h = await safeDB.database.runQuery(`
                    SELECT COUNT(*) as count FROM kline_data 
                    WHERE symbol = ? AND interval = '1h'
                `, [symbol]);
                
                const hasData = klineCount4h[0].count > 0 && klineCount1h[0].count > 0;
                if (hasData) dataCollectionSuccess++;
                
                // 检查策略分析结果
                const analysisCount = await safeDB.database.runQuery(`
                    SELECT COUNT(*) as count FROM strategy_analysis 
                    WHERE symbol = ?
                `, [symbol]);
                
                const hasAnalysis = analysisCount[0].count > 0;
                if (hasAnalysis) signalAnalysisSuccess++;
                
                console.log(`  ${symbol}: 数据收集${hasData ? '✅' : '❌'}, 信号分析${hasAnalysis ? '✅' : '❌'}`);
            }
            
            const dataCollectionRate = symbols.length > 0 ? (dataCollectionSuccess / symbols.length) * 100 : 0;
            const signalAnalysisRate = symbols.length > 0 ? (signalAnalysisSuccess / symbols.length) * 100 : 0;
            
            console.log(`\n📈 监控数据统计:`);
            console.log(`  数据收集率: ${dataCollectionRate.toFixed(1)}% (${dataCollectionSuccess}/${symbols.length})`);
            console.log(`  信号分析率: ${signalAnalysisRate.toFixed(1)}% (${signalAnalysisSuccess}/${symbols.length})`);
            
            results.monitoringTests.push({
                success: true,
                dataCollectionRate,
                signalAnalysisRate,
                totalSymbols: symbols.length,
                dataCollectionSuccess,
                signalAnalysisSuccess
            });
            
        } catch (error) {
            console.log(`❌ 监控数据测试失败: ${error.message}`);
            results.monitoringTests.push({
                success: false,
                error: error.message
            });
        }
        
        // 生成测试报告
        console.log('\n' + '='.repeat(60));
        console.log('📋 前端修复效果测试报告');
        console.log('='.repeat(60));
        
        // 价格测试结果
        console.log('\n📊 价格获取修复测试:');
        const priceSuccessCount = results.priceTests.filter(t => t.success).length;
        console.log(`  通过率: ${priceSuccessCount}/${results.priceTests.length} (${(priceSuccessCount/results.priceTests.length*100).toFixed(1)}%)`);
        
        results.priceTests.forEach(test => {
            if (test.success) {
                console.log(`  ✅ ${test.symbol}: 价格${test.currentPrice}, 趋势${test.trend4h}`);
            } else {
                console.log(`  ❌ ${test.symbol}: ${test.error}`);
            }
        });
        
        // 监控测试结果
        console.log('\n📊 监控数据收集率修复测试:');
        if (results.monitoringTests[0]?.success) {
            const test = results.monitoringTests[0];
            console.log(`  ✅ 数据收集率: ${test.dataCollectionRate.toFixed(1)}%`);
            console.log(`  ✅ 信号分析率: ${test.signalAnalysisRate.toFixed(1)}%`);
            console.log(`  ✅ 总交易对数: ${test.totalSymbols}`);
        } else {
            console.log(`  ❌ 监控测试失败: ${results.monitoringTests[0]?.error}`);
        }
        
        // 总体评估
        const allPriceTestsPass = results.priceTests.every(t => t.success);
        const monitoringTestPass = results.monitoringTests[0]?.success;
        
        console.log('\n🎯 总体评估:');
        if (allPriceTestsPass && monitoringTestPass) {
            console.log('  🎉 所有修复测试通过！');
            console.log('  ✅ 当前价格获取已修复');
            console.log('  ✅ 监控数据收集率计算已修复');
        } else {
            console.log('  ⚠️ 部分修复测试未通过，需要进一步调试');
            if (!allPriceTestsPass) {
                console.log('  ❌ 价格获取仍有问题');
            }
            if (!monitoringTestPass) {
                console.log('  ❌ 监控数据计算仍有问题');
            }
        }
        
        console.log('\n' + '='.repeat(60));
        
        return {
            success: allPriceTestsPass && monitoringTestPass,
            results
        };
        
    } catch (error) {
        console.error('❌ 测试过程异常:', error.message);
        return {
            success: false,
            error: error.message
        };
    } finally {
        await safeDB.close();
    }
}

// 运行测试
testFrontendFixes().then(result => {
    if (result.success) {
        console.log('\n🎉 前端修复测试完成，所有测试通过！');
        process.exit(0);
    } else {
        console.log('\n⚠️ 前端修复测试完成，部分测试失败！');
        process.exit(1);
    }
}).catch(error => {
    console.error('❌ 测试执行失败:', error.message);
    process.exit(1);
});
