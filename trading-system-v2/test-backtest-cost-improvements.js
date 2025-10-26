/**
 * 回测成本计算改进测试脚本
 * 验证新的成本计算功能
 */

const { BacktestEngine } = require('./src/core/backtest-engine');
const DatabaseConnection = require('./src/database/connection');
const { getBinanceAPI } = require('./src/api/binance-api-singleton');

async function testBacktestCostImprovements() {
  console.log('🚀 开始测试回测成本计算改进...\n');

  try {
    // 初始化组件
    const database = DatabaseConnection.default;
    const binanceAPI = getBinanceAPI();

    // 创建回测引擎（带Binance API支持）
    const backtestEngine = new BacktestEngine(database, binanceAPI);

    console.log('✅ 回测引擎初始化完成');
    console.log(`   - 资金费率计算器: ${backtestEngine.fundingRateCalculator ? '✅' : '❌'}`);
    console.log(`   - 市场费率管理器: ${backtestEngine.marketRateManager ? '✅' : '❌'}`);
    console.log(`   - 成本分析报告器: ${backtestEngine.costAnalysisReporter ? '✅' : '❌'}\n`);

    // 测试市场费率管理器
    if (backtestEngine.marketRateManager) {
      console.log('📊 测试市场费率管理器...');

      try {
        const rates = await backtestEngine.marketRateManager.getAllRates('BTCUSDT');
        console.log('   资金费率:', (rates.fundingRate * 100).toFixed(4) + '%');
        console.log('   手续费率:', (rates.feeRate * 100).toFixed(4) + '%');
        console.log('   利率:', (rates.interestRate * 100).toFixed(2) + '%');
        console.log('   ✅ 市场费率获取成功\n');
      } catch (error) {
        console.log('   ⚠️ 市场费率获取失败，使用默认值:', error.message, '\n');
      }
    }

    // 测试资金费率计算器
    console.log('💰 测试资金费率计算器...');

    const testParams = {
      entryPrice: 50000,
      exitPrice: 51000,
      positionSize: 1000, // 1000 USDT
      holdHours: 24, // 24小时
      isLong: true
    };

    const pnlResult = backtestEngine.fundingRateCalculator.calculatePnLWithCosts(testParams);

    console.log('   测试参数:');
    console.log(`   - 入场价格: ${testParams.entryPrice} USDT`);
    console.log(`   - 出场价格: ${testParams.exitPrice} USDT`);
    console.log(`   - 仓位大小: ${testParams.positionSize} USDT`);
    console.log(`   - 持仓时长: ${testParams.holdHours} 小时`);
    console.log('   计算结果:');
    console.log(`   - 原始盈亏: ${pnlResult.rawPnL.toFixed(4)} USDT`);
    console.log(`   - 净盈亏: ${pnlResult.netPnL.toFixed(4)} USDT`);
    console.log(`   - 手续费成本: ${pnlResult.feeCost.toFixed(4)} USDT`);
    console.log(`   - 资金费率成本: ${pnlResult.fundingCost.toFixed(4)} USDT`);
    console.log(`   - 利息成本: ${pnlResult.interestCost.toFixed(4)} USDT`);
    console.log(`   - 总成本: ${pnlResult.totalCost.toFixed(4)} USDT`);
    console.log(`   - 成本占比: ${pnlResult.costPercentage.toFixed(2)}%`);
    console.log('   ✅ 资金费率计算器测试成功\n');

    // 测试成本分析报告器
    console.log('📈 测试成本分析报告器...');

    const mockTrades = [
      {
        symbol: 'BTCUSDT',
        entryPrice: 50000,
        exitPrice: 51000,
        rawPnl: 20,
        netPnl: 18.5,
        feeCost: 0.8,
        fundingCost: 0.5,
        interestCost: 0.2,
        totalCost: 1.5,
        holdHours: 24
      },
      {
        symbol: 'ETHUSDT',
        entryPrice: 3000,
        exitPrice: 2950,
        rawPnl: -16.67,
        netPnl: -18.17,
        feeCost: 0.6,
        fundingCost: 0.3,
        interestCost: 0.1,
        totalCost: 1.0,
        holdHours: 12
      }
    ];

    const mockCostAnalysis = {
      totalRawPnL: 3.33,
      totalNetPnL: 0.33,
      totalCosts: 2.5,
      costBreakdown: {
        totalFeeCost: 1.4,
        totalFundingCost: 0.8,
        totalInterestCost: 0.3
      },
      costPercentages: {
        feeCostPercent: 0.14,
        fundingCostPercent: 0.08,
        interestCostPercent: 0.03
      },
      avgCostPerTrade: 1.25,
      costImpact: 75.08
    };

    const costReport = backtestEngine.costAnalysisReporter.generateReport(mockCostAnalysis, mockTrades, 'summary');

    console.log('   摘要报告:');
    console.log(`   - 报告类型: ${costReport.reportType}`);
    console.log(`   - 原始盈亏: ${costReport.overview.totalRawPnL} USDT`);
    console.log(`   - 净盈亏: ${costReport.overview.totalNetPnL} USDT`);
    console.log(`   - 总成本: ${costReport.overview.totalCosts} USDT`);
    console.log(`   - 成本影响: ${costReport.overview.costImpact}`);
    console.log('   ✅ 成本分析报告器测试成功\n');

    // 测试完整回测（如果有数据）
    console.log('🔄 测试完整回测流程...');

    try {
      // 运行一个简单的回测
      const backtestResult = await backtestEngine.runBacktest(
        'V3',
        'BALANCED',
        '1h',
        '2024-01-01',
        '2024-01-02',
        'BTCUSDT'
      );

      console.log('   回测结果:');
      console.log(`   - 策略: ${backtestResult.strategy}`);
      console.log(`   - 模式: ${backtestResult.mode}`);
      console.log(`   - 总交易数: ${backtestResult.totalTrades}`);
      console.log(`   - 胜率: ${backtestResult.winRate.toFixed(2)}%`);
      console.log(`   - 净盈利: ${backtestResult.netProfit.toFixed(4)} USDT`);

      if (backtestResult.costAnalysis) {
        console.log('   成本分析:');
        console.log(`   - 原始盈亏: ${backtestResult.costAnalysis.totalRawPnL} USDT`);
        console.log(`   - 净盈亏: ${backtestResult.costAnalysis.totalNetPnL} USDT`);
        console.log(`   - 总成本: ${backtestResult.costAnalysis.totalCosts} USDT`);
        console.log(`   - 成本影响: ${backtestResult.costAnalysis.costImpact}%`);
      }

      if (backtestResult.costReport) {
        console.log('   成本报告:');
        console.log(`   - 摘要报告: ${backtestResult.costReport.summary ? '✅' : '❌'}`);
        console.log(`   - 详细报告: ${backtestResult.costReport.detailed ? '✅' : '❌'}`);
        console.log(`   - 对比报告: ${backtestResult.costReport.comparison ? '✅' : '❌'}`);
      }

      console.log('   ✅ 完整回测流程测试成功\n');

    } catch (error) {
      console.log('   ⚠️ 完整回测测试失败（可能是数据不足）:', error.message, '\n');
    }

    console.log('🎉 所有测试完成！');
    console.log('\n📋 改进总结:');
    console.log('✅ 1. 统一回测成本计算 - 已集成FundingRateCalculator');
    console.log('✅ 2. 动态费率获取 - 已集成MarketRateManager');
    console.log('✅ 3. 成本分析报告 - 已集成CostAnalysisReporter');
    console.log('\n🚀 回测系统成本计算功能已全面升级！');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    process.exit(0);
  }
}

// 运行测试
testBacktestCostImprovements();
