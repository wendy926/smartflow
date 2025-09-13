const http = require('http');

/**
 * 测试前端API是否正常工作
 * 验证当前价格显示和监控数据收集率修复效果
 */
async function testFrontendAPI() {
    console.log('🌐 开始测试前端API...\n');
    
    const testResults = {
        priceTests: [],
        monitoringTests: [],
        overallSuccess: true
    };
    
    // 测试主页API
    console.log('📊 1. 测试主页API...');
    try {
        const homeData = await makeRequest('https://smart.aimaventop.com/api/signals');
        
        if (homeData && Array.isArray(homeData)) {
            console.log(`  ✅ 主页API正常，返回${homeData.length}个交易对数据`);
            
            // 检查价格显示
            let validPriceCount = 0;
            homeData.forEach(signal => {
                if (signal.currentPrice && signal.currentPrice > 0) {
                    validPriceCount++;
                }
            });
            
            const priceSuccessRate = (validPriceCount / homeData.length) * 100;
            console.log(`  ✅ 价格显示正常率: ${priceSuccessRate.toFixed(1)}% (${validPriceCount}/${homeData.length})`);
            
            testResults.priceTests.push({
                success: priceSuccessRate >= 80,
                rate: priceSuccessRate,
                total: homeData.length,
                valid: validPriceCount
            });
            
            // 显示前几个交易对的价格信息
            console.log('\n  📋 价格显示示例:');
            homeData.slice(0, 5).forEach(signal => {
                console.log(`    ${signal.symbol}: ${signal.currentPrice || '0'} (${signal.trend4h || '未知'})`);
            });
            
        } else {
            console.log('  ❌ 主页API返回数据格式异常');
            testResults.priceTests.push({ success: false, error: '数据格式异常' });
            testResults.overallSuccess = false;
        }
        
    } catch (error) {
        console.log(`  ❌ 主页API测试失败: ${error.message}`);
        testResults.priceTests.push({ success: false, error: error.message });
        testResults.overallSuccess = false;
    }
    
    // 测试监控页面API
    console.log('\n📊 2. 测试监控页面API...');
    try {
        const monitoringData = await makeRequest('https://smart.aimaventop.com/api/monitoring-dashboard');
        
        if (monitoringData && monitoringData.summary) {
            const summary = monitoringData.summary;
            const completionRates = summary.completionRates || {};
            
            console.log(`  ✅ 监控API正常`);
            console.log(`  📈 数据收集率: ${completionRates.dataCollection || 0}%`);
            console.log(`  📈 信号分析率: ${completionRates.signalAnalysis || 0}%`);
            console.log(`  📊 总交易对数: ${summary.totalSymbols || 0}`);
            
            const dataCollectionRate = completionRates.dataCollection || 0;
            const signalAnalysisRate = completionRates.signalAnalysis || 0;
            
            testResults.monitoringTests.push({
                success: dataCollectionRate >= 95 && signalAnalysisRate >= 95,
                dataCollectionRate,
                signalAnalysisRate,
                totalSymbols: summary.totalSymbols
            });
            
            if (dataCollectionRate < 95 || signalAnalysisRate < 95) {
                testResults.overallSuccess = false;
            }
            
        } else {
            console.log('  ❌ 监控API返回数据格式异常');
            testResults.monitoringTests.push({ success: false, error: '数据格式异常' });
            testResults.overallSuccess = false;
        }
        
    } catch (error) {
        console.log(`  ❌ 监控API测试失败: ${error.message}`);
        testResults.monitoringTests.push({ success: false, error: error.message });
        testResults.overallSuccess = false;
    }
    
    // 测试单个交易对API
    console.log('\n📊 3. 测试单个交易对API...');
    const testSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
    
    for (const symbol of testSymbols) {
        try {
            const symbolData = await makeRequest(`https://smart.aimaventop.com/api/signal/${symbol}`);
            
            if (symbolData && symbolData.currentPrice && symbolData.currentPrice > 0) {
                console.log(`  ✅ ${symbol}: 价格${symbolData.currentPrice}, 趋势${symbolData.trend4h || '未知'}`);
            } else {
                console.log(`  ❌ ${symbol}: 价格获取失败或为0`);
                testResults.overallSuccess = false;
            }
            
        } catch (error) {
            console.log(`  ❌ ${symbol}: API调用失败 - ${error.message}`);
            testResults.overallSuccess = false;
        }
    }
    
    // 生成测试报告
    console.log('\n' + '='.repeat(60));
    console.log('📋 前端API测试报告');
    console.log('='.repeat(60));
    
    // 价格测试结果
    if (testResults.priceTests.length > 0) {
        const priceTest = testResults.priceTests[0];
        if (priceTest.success) {
            console.log(`\n✅ 价格显示修复: 成功率${priceTest.rate.toFixed(1)}% (${priceTest.valid}/${priceTest.total})`);
        } else {
            console.log(`\n❌ 价格显示修复: 失败 - ${priceTest.error || '成功率过低'}`);
        }
    }
    
    // 监控测试结果
    if (testResults.monitoringTests.length > 0) {
        const monitoringTest = testResults.monitoringTests[0];
        if (monitoringTest.success) {
            console.log(`\n✅ 监控数据修复: 数据收集率${monitoringTest.dataCollectionRate}%, 信号分析率${monitoringTest.signalAnalysisRate}%`);
        } else {
            console.log(`\n❌ 监控数据修复: 失败 - 数据收集率${monitoringTest.dataCollectionRate}%, 信号分析率${monitoringTest.signalAnalysisRate}%`);
        }
    }
    
    // 总体评估
    console.log('\n🎯 总体评估:');
    if (testResults.overallSuccess) {
        console.log('  🎉 所有前端API测试通过！');
        console.log('  ✅ 当前价格显示已修复');
        console.log('  ✅ 监控数据收集率已修复');
        console.log('  ✅ 前端页面应该正常显示数据');
    } else {
        console.log('  ⚠️ 部分前端API测试失败，需要进一步调试');
    }
    
    console.log('\n' + '='.repeat(60));
    
    return testResults.overallSuccess;
}

// HTTP请求辅助函数
function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve(jsonData);
                } catch (error) {
                    reject(new Error(`JSON解析失败: ${error.message}`));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(new Error(`请求失败: ${error.message}`));
        });
        
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('请求超时'));
        });
    });
}

// 运行测试
testFrontendAPI().then(success => {
    if (success) {
        console.log('\n🎉 前端API测试完成，所有测试通过！');
        console.log('📱 前端页面应该正常显示价格和监控数据');
        process.exit(0);
    } else {
        console.log('\n⚠️ 前端API测试完成，部分测试失败！');
        console.log('🔧 需要进一步检查前端显示问题');
        process.exit(1);
    }
}).catch(error => {
    console.error('❌ 测试执行失败:', error.message);
    process.exit(1);
});