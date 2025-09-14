#!/usr/bin/env node

/**
 * 检查所有交易对的MA计算问题
 * 识别哪些交易对存在NaN值问题
 */

const StrategyV3Core = require('./modules/strategy/StrategyV3Core.js');
const DatabaseManager = require('./modules/database/DatabaseManager.js');

async function checkAllSymbolsMA() {
    console.log('🔍 开始检查所有交易对的MA计算问题...\n');
    
    const db = new DatabaseManager('./smartflow.db');
    await db.init();
    
    const strategyCore = new StrategyV3Core(db);
    
    // 获取所有交易对
    const symbols = await db.getCustomSymbols();
    console.log(`📊 总共检查 ${symbols.length} 个交易对\n`);
    
    const results = {
        total: symbols.length,
        valid: 0,
        invalid: 0,
        problematic: []
    };
    
    for (const symbol of symbols) {
        try {
            console.log(`🔍 检查 [${symbol}]...`);
            
            // 获取4H数据
            const klines4h = await strategyCore.getKlineData(symbol, '4h', 250);
            
            if (!klines4h || klines4h.length === 0) {
                console.log(`  ❌ 无数据`);
                results.invalid++;
                continue;
            }
            
            // 检查数据质量
            const invalidData = klines4h.filter(k => {
                if (!k || !Array.isArray(k) || k.length < 6) return true;
                const close = parseFloat(k[4]);
                const volume = parseFloat(k[5]);
                return isNaN(close) || close <= 0 || isNaN(volume) || volume < 0;
            });
            
            const validData = klines4h.length - invalidData.length;
            console.log(`  📊 数据质量: ${validData}/${klines4h.length} 条有效`);
            
            if (validData < 20) {
                console.log(`  ⚠️ 有效数据不足，无法计算MA`);
                results.invalid++;
                continue;
            }
            
            // 计算MA
            const ma20 = strategyCore.calculateMA(klines4h, 20);
            const ma50 = strategyCore.calculateMA(klines4h, 50);
            
            // 检查MA结果
            const ma20NaN = ma20.some(val => isNaN(val));
            const ma50NaN = ma50.some(val => isNaN(val));
            
            if (ma20NaN || ma50NaN) {
                console.log(`  ❌ MA计算包含NaN值`);
                results.problematic.push({
                    symbol,
                    issue: 'MA计算返回NaN',
                    ma20NaN,
                    ma50NaN,
                    validData,
                    totalData: klines4h.length,
                    invalidData: invalidData.length
                });
                results.invalid++;
            } else if (ma20.length > 0 && ma50.length > 0) {
                console.log(`  ✅ MA计算正常`);
                console.log(`     MA20: ${ma20[ma20.length - 1].toFixed(4)}`);
                console.log(`     MA50: ${ma50[ma50.length - 1].toFixed(4)}`);
                results.valid++;
            } else {
                console.log(`  ⚠️ MA计算结果为空`);
                results.invalid++;
            }
            
        } catch (error) {
            console.log(`  ❌ 检查失败: ${error.message}`);
            results.invalid++;
        }
        
        console.log('');
    }
    
    // 输出总结
    console.log('📋 检查结果总结:');
    console.log(`  总交易对数量: ${results.total}`);
    console.log(`  正常: ${results.valid}`);
    console.log(`  异常: ${results.invalid}`);
    console.log(`  存在MA计算问题: ${results.problematic.length}`);
    
    if (results.problematic.length > 0) {
        console.log('\n🚨 存在MA计算问题的交易对:');
        results.problematic.forEach(item => {
            console.log(`  - ${item.symbol}: ${item.issue}`);
            console.log(`    有效数据: ${item.validData}/${item.totalData}`);
            console.log(`    无效数据: ${item.invalidData}`);
            console.log(`    MA20 NaN: ${item.ma20NaN}, MA50 NaN: ${item.ma50NaN}`);
        });
    }
    
    await db.close();
    
    return results;
}

// 如果直接运行此脚本
if (require.main === module) {
    checkAllSymbolsMA().catch(console.error);
}

module.exports = { checkAllSymbolsMA };
