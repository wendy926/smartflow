const SafeDatabaseManager = require('./modules/database/SafeDatabaseManager');
const StrategyV3Core = require('./modules/strategy/StrategyV3Core');
const EnhancedDataQualityMonitor = require('./modules/monitoring/EnhancedDataQualityMonitor');

/**
 * 核心功能测试脚本
 * 验证MA计算、趋势分析、数据质量监控等核心功能
 */
async function testCoreFunctionality() {
    console.log('🧪 开始核心功能测试...\n');
    
    const testResults = {
        total: 0,
        passed: 0,
        failed: 0,
        errors: []
    };
    
    // 测试1: MA计算功能
    console.log('📊 测试1: MA计算功能');
    try {
        const strategyCore = new StrategyV3Core();
        
        // 创建测试数据
        const testCandles = [];
        for (let i = 0; i < 25; i++) {
            testCandles.push({
                open: 100 + i,
                high: 105 + i,
                low: 95 + i,
                close: 100 + i,
                volume: 1000
            });
        }
        
        const ma20 = strategyCore.calculateMA(testCandles, 20);
        const ma50 = strategyCore.calculateMA(testCandles, 50);
        
        testResults.total++;
        if (ma20[19] !== null && ma50[49] === null) {
            console.log('  ✅ MA20计算正确');
            console.log('  ✅ MA50数据不足处理正确');
            testResults.passed++;
        } else {
            console.log('  ❌ MA计算失败');
            testResults.failed++;
            testResults.errors.push('MA计算逻辑错误');
        }
        
    } catch (error) {
        console.log('  ❌ MA计算测试异常:', error.message);
        testResults.failed++;
        testResults.errors.push(`MA计算异常: ${error.message}`);
    }
    
    // 测试2: 数据质量监控功能
    console.log('\n⚠️ 测试2: 数据质量监控功能');
    try {
        const qualityMonitor = new EnhancedDataQualityMonitor();
        
        // 测试MA数据合理性检查
        const maCheck = await qualityMonitor.checkMAValidity(
            'TESTUSDT', 100, 99, 98, 101
        );
        
        testResults.total++;
        if (maCheck.isValid) {
            console.log('  ✅ MA数据合理性检查正确');
            testResults.passed++;
        } else {
            console.log('  ❌ MA数据合理性检查失败');
            testResults.failed++;
            testResults.errors.push('MA数据合理性检查错误');
        }
        
        // 测试趋势判断合理性检查
        const trendResult = {
            trend4h: '多头趋势',
            marketType: '趋势市',
            bullScore: 3,
            bearScore: 0,
            score: 5
        };
        
        const trendCheck = qualityMonitor.checkTrendValidity(trendResult);
        
        testResults.total++;
        if (trendCheck.isValid) {
            console.log('  ✅ 趋势判断合理性检查正确');
            testResults.passed++;
        } else {
            console.log('  ❌ 趋势判断合理性检查失败');
            testResults.failed++;
            testResults.errors.push('趋势判断合理性检查错误');
        }
        
    } catch (error) {
        console.log('  ❌ 数据质量监控测试异常:', error.message);
        testResults.failed++;
        testResults.errors.push(`数据质量监控异常: ${error.message}`);
    }
    
    // 测试3: 数据库连接管理
    console.log('\n🗄️ 测试3: 数据库连接管理');
    try {
        const safeDB = new SafeDatabaseManager();
        await safeDB.init();
        
        testResults.total++;
        if (safeDB.connectionCount > 0) {
            console.log('  ✅ 数据库连接建立成功');
            testResults.passed++;
        } else {
            console.log('  ❌ 数据库连接失败');
            testResults.failed++;
            testResults.errors.push('数据库连接失败');
        }
        
        // 测试连接关闭
        await safeDB.close();
        
        testResults.total++;
        if (safeDB.connectionCount === 0) {
            console.log('  ✅ 数据库连接关闭成功');
            testResults.passed++;
        } else {
            console.log('  ❌ 数据库连接关闭失败');
            testResults.failed++;
            testResults.errors.push('数据库连接关闭失败');
        }
        
    } catch (error) {
        console.log('  ❌ 数据库连接测试异常:', error.message);
        testResults.failed++;
        testResults.errors.push(`数据库连接异常: ${error.message}`);
    }
    
    // 测试4: 策略核心集成测试（如果数据库可用）
    console.log('\n🎯 测试4: 策略核心集成测试');
    try {
        const safeDB = new SafeDatabaseManager();
        await safeDB.init();
        
        const strategyCore = await safeDB.createStrategyInstance(StrategyV3Core);
        
        // 测试4H趋势分析（使用ETHUSDT）
        const trendResult = await strategyCore.analyze4HTrend('ETHUSDT');
        
        testResults.total++;
        if (trendResult && trendResult.trend4h && !trendResult.error) {
            console.log(`  ✅ 4H趋势分析成功: ${trendResult.trend4h}`);
            testResults.passed++;
        } else {
            console.log('  ❌ 4H趋势分析失败');
            testResults.failed++;
            testResults.errors.push('4H趋势分析失败');
        }
        
        await strategyCore.destroy();
        await safeDB.close();
        
    } catch (error) {
        console.log('  ❌ 策略核心集成测试异常:', error.message);
        testResults.failed++;
        testResults.errors.push(`策略核心集成异常: ${error.message}`);
    }
    
    // 生成测试报告
    console.log('\n' + '='.repeat(60));
    console.log('📋 核心功能测试报告');
    console.log('='.repeat(60));
    
    console.log(`\n📊 总体统计:`);
    console.log(`   总测试数: ${testResults.total}`);
    console.log(`   通过: ${testResults.passed}`);
    console.log(`   失败: ${testResults.failed}`);
    console.log(`   成功率: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
    
    if (testResults.errors.length > 0) {
        console.log(`\n❌ 失败详情:`);
        testResults.errors.forEach((error, index) => {
            console.log(`   ${index + 1}. ${error}`);
        });
    } else {
        console.log(`\n🎉 所有核心功能测试通过！`);
    }
    
    console.log('\n' + '='.repeat(60));
    
    return {
        success: testResults.failed === 0,
        results: testResults
    };
}

// 运行测试
testCoreFunctionality().then(result => {
    if (result.success) {
        console.log('\n🎉 核心功能测试完成，所有测试通过！');
        process.exit(0);
    } else {
        console.log('\n⚠️ 核心功能测试完成，部分测试失败！');
        process.exit(1);
    }
}).catch(error => {
    console.error('❌ 测试执行失败:', error.message);
    process.exit(1);
});
