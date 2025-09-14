const SmartFlowStrategyV3 = require('./modules/strategy/SmartFlowStrategyV3');
const DatabaseManager = require('./modules/database/DatabaseManager');

async function checkAllIndicators() {
  console.log('🔍 开始检查所有交易对的关键指标...\n');
  
  const db = new DatabaseManager();
  await db.init();
  
  try {
    // 获取所有交易对
    const symbols = await db.getCustomSymbols();
    console.log(`📊 总共检查 ${symbols.length} 个交易对\n`);
    
    const results = [];
    const issues = [];
    
    for (const symbol of symbols) {
      try {
        console.log(`🔍 检查 ${symbol}...`);
        
        // 分析交易对
        const analysis = await SmartFlowStrategyV3.analyzeSymbol(symbol, {
          database: db,
          maxLossAmount: 100
        });
        
        // 检查关键指标
        const indicatorStatus = {
          symbol,
          timestamp: new Date().toISOString(),
          // 技术指标
          ma: {
            ma20: analysis.ma20,
            ma50: analysis.ma50, 
            ma200: analysis.ma200,
            status: !!(analysis.ma20 && analysis.ma50 && analysis.ma200)
          },
          ema: {
            ema20: analysis.ema20,
            ema50: analysis.ema50,
            status: !!(analysis.ema20 && analysis.ema50)
          },
          adx: {
            adx14: analysis.adx14,
            status: !!(analysis.adx14 && analysis.adx14 > 0)
          },
          bbw: {
            bbw: analysis.bbw,
            status: !!(analysis.bbw && analysis.bbw >= 0)
          },
          vwap: {
            vwap: analysis.vwap,
            status: !!(analysis.vwap && analysis.vwap > 0)
          },
          vol15m: {
            vol15m: analysis.vol15m,
            status: !!(analysis.vol15m && analysis.vol15m > 0)
          },
          vol1h: {
            vol1h: analysis.vol1h,
            status: !!(analysis.vol1h && analysis.vol1h > 0)
          },
          oiChange6: {
            oiChange6: analysis.oiChange6h,
            status: analysis.oiChange6h !== null && analysis.oiChange6h !== undefined
          },
          fundingRate: {
            fundingRate: analysis.fundingRate,
            status: analysis.fundingRate !== null && analysis.fundingRate !== undefined
          },
          deltaImbalance: {
            deltaImbalance: analysis.deltaImbalance,
            status: analysis.deltaImbalance !== null && analysis.deltaImbalance !== undefined
          },
          // 策略指标
          scores: {
            bullScore: analysis.bullScore,
            bearScore: analysis.bearScore,
            score1h: analysis.score1h,
            status: !!(analysis.bullScore !== null && analysis.bearScore !== null && analysis.score1h !== null)
          },
          trendStrength: {
            trendStrength: analysis.trendStrength,
            status: !!(analysis.trendStrength && analysis.trendStrength !== 'NONE')
          },
          signalStrength: {
            signalStrength: analysis.signalStrength,
            status: !!(analysis.signalStrength && analysis.signalStrength !== 'NONE')
          },
          // 杠杆和保证金
          leverage: {
            maxLeverage: analysis.maxLeverage,
            minMargin: analysis.minMargin,
            stopLossDistance: analysis.stopLossDistance,
            status: !!(analysis.maxLeverage && analysis.minMargin && analysis.stopLossDistance !== null)
          }
        };
        
        // 检查是否有问题
        const problemFields = [];
        if (!indicatorStatus.ma.status) problemFields.push('MA');
        if (!indicatorStatus.ema.status) problemFields.push('EMA');
        if (!indicatorStatus.adx.status) problemFields.push('ADX');
        if (!indicatorStatus.bbw.status) problemFields.push('BBW');
        if (!indicatorStatus.vwap.status) problemFields.push('VWAP');
        if (!indicatorStatus.vol15m.status) problemFields.push('VOL15M');
        if (!indicatorStatus.vol1h.status) problemFields.push('VOL1H');
        if (!indicatorStatus.oiChange6.status) problemFields.push('OIChange6');
        if (!indicatorStatus.fundingRate.status) problemFields.push('FundingRate');
        if (!indicatorStatus.deltaImbalance.status) problemFields.push('DeltaImbalance');
        if (!indicatorStatus.scores.status) problemFields.push('Scores');
        if (!indicatorStatus.trendStrength.status) problemFields.push('TrendStrength');
        if (!indicatorStatus.signalStrength.status) problemFields.push('SignalStrength');
        if (!indicatorStatus.leverage.status) problemFields.push('Leverage');
        
        if (problemFields.length > 0) {
          issues.push({
            symbol,
            problems: problemFields,
            details: indicatorStatus
          });
          console.log(`❌ ${symbol}: 问题字段 ${problemFields.join(', ')}`);
        } else {
          console.log(`✅ ${symbol}: 所有指标正常`);
        }
        
        results.push(indicatorStatus);
        
      } catch (error) {
        console.error(`❌ ${symbol} 检查失败:`, error.message);
        issues.push({
          symbol,
          error: error.message
        });
      }
    }
    
    // 输出总结
    console.log('\n📊 检查结果总结:');
    console.log(`✅ 正常: ${results.length - issues.length} 个交易对`);
    console.log(`❌ 异常: ${issues.length} 个交易对`);
    
    if (issues.length > 0) {
      console.log('\n❌ 异常详情:');
      issues.forEach(issue => {
        if (issue.problems) {
          console.log(`  ${issue.symbol}: ${issue.problems.join(', ')}`);
        } else {
          console.log(`  ${issue.symbol}: ${issue.error}`);
        }
      });
    }
    
    // 检查默认值使用情况
    console.log('\n🔍 检查默认值使用情况:');
    const defaultLeverageCount = results.filter(r => r.leverage.maxLeverage === 10).length;
    const defaultMarginCount = results.filter(r => r.leverage.minMargin === 100).length;
    
    console.log(`使用默认杠杆(10x): ${defaultLeverageCount} 个交易对`);
    console.log(`使用默认保证金(100): ${defaultMarginCount} 个交易对`);
    
    if (defaultLeverageCount > 0 || defaultMarginCount > 0) {
      console.log('\n⚠️ 发现使用默认值的情况，需要检查杠杆计算逻辑');
    }
    
    return {
      total: results.length,
      normal: results.length - issues.length,
      issues: issues.length,
      details: results,
      problems: issues
    };
    
  } finally {
    await db.close();
  }
}

// 运行检查
checkAllIndicators()
  .then(result => {
    console.log('\n✅ 指标检查完成');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ 检查失败:', error);
    process.exit(1);
  });
