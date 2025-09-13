const SafeDatabaseManager = require('./modules/database/SafeDatabaseManager');
const StrategyV3Core = require('./modules/strategy/StrategyV3Core');

// 测试的交易对列表
const TEST_SYMBOLS = [
    'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT', 'SOLUSDT',
    'DOGEUSDT', 'TRXUSDT', 'MATICUSDT', 'DOTUSDT', 'AVAXUSDT', 'LINKUSDT'
];

// 测试结果统计
let testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
};

/**
 * 验证MA数据的合理性
 */
function validateMAValues(ma20, ma50, ma200, currentPrice, symbol) {
    const issues = [];
    
    // 检查MA值是否为正数
    if (ma20 <= 0) issues.push('MA20 <= 0');
    if (ma50 <= 0) issues.push('MA50 <= 0');
    if (ma200 <= 0) issues.push('MA200 <= 0');
    
    // 检查MA值是否在合理范围内（不超过当前价格的10倍或低于当前价格的1/10）
    if (ma20 > currentPrice * 10) issues.push('MA20过高');
    if (ma20 < currentPrice / 10) issues.push('MA20过低');
    
    // 检查MA排列的合理性（多头趋势：MA20 > MA50 > MA200）
    const isBullish = ma20 > ma50 && ma50 > ma200;
    const isBearish = ma20 < ma50 && ma50 < ma200;
    const isNeutral = !isBullish && !isBearish;
    
    return {
        isValid: issues.length === 0,
        issues,
        trend: isBullish ? '多头' : (isBearish ? '空头' : '中性'),
        isBullish,
        isBearish,
        isNeutral
    };
}

/**
 * 测试单个交易对的MA数据
 */
async function testSymbolMA(safeDB, symbol) {
    try {
        console.log(`\n📊 测试 ${symbol}...`);
        
        const strategyCore = await safeDB.createStrategyInstance(StrategyV3Core);
        const result = await strategyCore.analyze4HTrend(symbol);
        await strategyCore.destroy();
        
        if (result.error) {
            console.log(`❌ ${symbol}: 分析失败 - ${result.error}`);
            return {
                symbol,
                success: false,
                error: result.error,
                ma20: null,
                ma50: null,
                ma200: null,
                trend: null
            };
        }
        
        const validation = validateMAValues(
            result.ma20, 
            result.ma50, 
            result.ma200, 
            result.ma20 * 1.1, // 假设当前价格接近MA20
            symbol
        );
        
        if (validation.isValid) {
            console.log(`✅ ${symbol}: MA数据正常`);
            console.log(`   MA20: ${result.ma20.toFixed(2)}`);
            console.log(`   MA50: ${result.ma50.toFixed(2)}`);
            console.log(`   MA200: ${result.ma200.toFixed(2)}`);
            console.log(`   趋势: ${result.trend4h} (${validation.trend})`);
            console.log(`   得分: 多头${result.bullScore}, 空头${result.bearScore}, 总分${result.score}`);
            
            return {
                symbol,
                success: true,
                ma20: result.ma20,
                ma50: result.ma50,
                ma200: result.ma200,
                trend: result.trend4h,
                bullScore: result.bullScore,
                bearScore: result.bearScore,
                totalScore: result.score,
                validation
            };
        } else {
            console.log(`⚠️ ${symbol}: MA数据异常 - ${validation.issues.join(', ')}`);
            console.log(`   MA20: ${result.ma20?.toFixed(2) || 'N/A'}`);
            console.log(`   MA50: ${result.ma50?.toFixed(2) || 'N/A'}`);
            console.log(`   MA200: ${result.ma200?.toFixed(2) || 'N/A'}`);
            
            return {
                symbol,
                success: false,
                error: `MA数据异常: ${validation.issues.join(', ')}`,
                ma20: result.ma20,
                ma50: result.ma50,
                ma200: result.ma200,
                trend: result.trend4h,
                validation
            };
        }
        
    } catch (error) {
        console.log(`❌ ${symbol}: 测试异常 - ${error.message}`);
        return {
            symbol,
            success: false,
            error: error.message,
            ma20: null,
            ma50: null,
            ma200: null,
            trend: null
        };
    }
}

/**
 * 生成测试报告
 */
function generateReport(results) {
    console.log('\n' + '='.repeat(60));
    console.log('📋 MA数据测试报告');
    console.log('='.repeat(60));
    
    console.log(`\n📊 总体统计:`);
    console.log(`   总测试数: ${results.length}`);
    console.log(`   成功: ${results.filter(r => r.success).length}`);
    console.log(`   失败: ${results.filter(r => !r.success).length}`);
    console.log(`   成功率: ${((results.filter(r => r.success).length / results.length) * 100).toFixed(1)}%`);
    
    console.log(`\n✅ 成功的交易对:`);
    results.filter(r => r.success).forEach(r => {
        console.log(`   ${r.symbol}: ${r.trend} (多头${r.bullScore}, 空头${r.bearScore}, 总分${r.totalScore})`);
    });
    
    console.log(`\n❌ 失败的交易对:`);
    results.filter(r => !r.success).forEach(r => {
        console.log(`   ${r.symbol}: ${r.error}`);
    });
    
    // 趋势分布统计
    const trendStats = {};
    results.filter(r => r.success && r.trend).forEach(r => {
        trendStats[r.trend] = (trendStats[r.trend] || 0) + 1;
    });
    
    console.log(`\n📈 趋势分布:`);
    Object.entries(trendStats).forEach(([trend, count]) => {
        console.log(`   ${trend}: ${count}个`);
    });
    
    console.log('\n' + '='.repeat(60));
}

/**
 * 主测试函数
 */
async function testAllSymbolsMA() {
    const safeDB = new SafeDatabaseManager();
    const results = [];
    
    try {
        console.log('🚀 开始测试所有交易对的MA数据...');
        console.log(`📋 测试交易对: ${TEST_SYMBOLS.join(', ')}`);
        
        for (const symbol of TEST_SYMBOLS) {
            const result = await testSymbolMA(safeDB, symbol);
            results.push(result);
            
            // 避免请求过于频繁
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // 生成测试报告
        generateReport(results);
        
        // 返回测试结果
        return {
            success: results.every(r => r.success),
            results,
            summary: {
                total: results.length,
                passed: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length
            }
        };
        
    } catch (error) {
        console.error('❌ 测试过程异常:', error.message);
        return {
            success: false,
            error: error.message,
            results: []
        };
    }
}

// 运行测试
testAllSymbolsMA().then(result => {
    if (result.success) {
        console.log('\n🎉 所有MA数据测试通过！');
        process.exit(0);
    } else {
        console.log('\n⚠️ 部分MA数据测试失败，请检查！');
        process.exit(1);
    }
}).catch(error => {
    console.error('❌ 测试执行失败:', error.message);
    process.exit(1);
});
