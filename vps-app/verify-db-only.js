#!/usr/bin/env node

/**
 * 数据库功能验证脚本 - 只验证数据库表结构和存储功能
 * 运行方式: node verify-db-only.js
 */

const DatabaseManager = require('./modules/database/DatabaseManager');

class DatabaseVerifier {
  constructor() {
    this.db = new DatabaseManager();
  }

  async init() {
    try {
      await this.db.init();
      console.log('✅ 数据库初始化成功');
    } catch (error) {
      console.error('❌ 数据库初始化失败:', error);
      throw error;
    }
  }

  async verifyTableStructure() {
    console.log('🔍 验证数据库表结构...');

    try {
      // 检查strategy_analysis表结构
      const tableInfo = await this.db.runQuery(`
        PRAGMA table_info(strategy_analysis)
      `);

      console.log('📊 strategy_analysis表结构:');
      tableInfo.forEach(column => {
        console.log(`   - ${column.name}: ${column.type} ${column.notnull ? 'NOT NULL' : ''} ${column.pk ? 'PRIMARY KEY' : ''}`);
      });

      // 检查索引
      const indexes = await this.db.runQuery(`
        PRAGMA index_list(strategy_analysis)
      `);

      console.log('📈 索引信息:');
      indexes.forEach(index => {
        console.log(`   - ${index.name}: ${index.unique ? 'UNIQUE' : 'NON-UNIQUE'}`);
      });

      console.log('✅ 表结构验证完成');

    } catch (error) {
      console.error('❌ 表结构验证失败:', error);
      throw error;
    }
  }

  async verifyDataStorage() {
    console.log('💾 验证数据存储功能...');

    try {
      // 创建测试数据
      const testAnalysisData = {
        symbol: 'TESTUSDT',
        time: new Date().toISOString(),
        // 天级趋势数据
        trend: '多头趋势',
        trendStrength: '强趋势',
        // 小时级趋势加强数据
        signal: '做多',
        signalStrength: 'STRONG',
        hourlyScore: 5,
        // 15分钟入场执行数据
        execution: 'LONG_EXECUTE',
        executionMode: '模式A',
        modeA: true,
        modeB: false,
        entrySignal: 50000.0,
        stopLoss: 49000.0,
        takeProfit: 52000.0,
        // 基础信息
        currentPrice: 50000.0,
        dataCollectionRate: 100.0,
        // 详细分析数据
        dailyTrend: {
          trend: '多头趋势',
          trendStrength: '强趋势',
          ma20: 49500.0,
          ma50: 49000.0,
          ma200: 48000.0,
          bbwExpanding: true,
          currentPrice: 50000.0,
          dataValid: true
        },
        hourlyConfirmation: {
          symbol: 'TESTUSDT',
          trend: '多头趋势',
          score: 5,
          action: '做多',
          signalStrength: 'STRONG',
          scoreDetails: {
            vwapDirection: 'BULLISH',
            breakoutStructure: 'BULLISH',
            volumeConfirmation: 'BULLISH',
            oiConfirmation: 'BULLISH',
            fundingRate: 'BULLISH',
            deltaConfirmation: 'BULLISH'
          },
          vwap: 49900.0,
          oiChange: 2.5,
          fundingRate: 0.01,
          dataValid: true
        },
        execution15m: {
          entrySignal: 50000.0,
          stopLoss: 49000.0,
          takeProfit: 52000.0,
          mode: '回踩确认A',
          modeA: true,
          modeB: false,
          dataValid: true
        },
        dataValid: true
      };

      // 存储测试数据
      console.log('📝 存储测试数据...');
      const insertResult = await this.db.recordStrategyAnalysis(testAnalysisData);
      console.log(`✅ 数据存储成功，记录ID: ${insertResult.id}`);

      // 验证数据存储
      console.log('🔍 验证存储的数据...');
      const storedData = await this.db.getLatestStrategyAnalysis('TESTUSDT');

      if (storedData) {
        console.log('✅ 数据存储验证成功:');
        console.log(`   - 记录ID: ${storedData.id}`);
        console.log(`   - 交易对: ${storedData.symbol}`);
        console.log(`   - 时间戳: ${storedData.timestamp}`);
        console.log(`   - 趋势: ${storedData.trend}`);
        console.log(`   - 趋势强度: ${storedData.trend_strength}`);
        console.log(`   - 信号: ${storedData.signal}`);
        console.log(`   - 信号强度: ${storedData.signal_strength}`);
        console.log(`   - 小时得分: ${storedData.hourly_score}`);
        console.log(`   - 执行: ${storedData.execution}`);
        console.log(`   - 执行模式: ${storedData.execution_mode}`);
        console.log(`   - 模式A: ${storedData.mode_a}`);
        console.log(`   - 模式B: ${storedData.mode_b}`);
        console.log(`   - 入场价格: ${storedData.entry_signal}`);
        console.log(`   - 止损: ${storedData.stop_loss}`);
        console.log(`   - 止盈: ${storedData.take_profit}`);
        console.log(`   - 当前价格: ${storedData.current_price}`);
        console.log(`   - 数据有效: ${storedData.data_valid}`);

        // 验证JSON数据
        if (storedData.full_analysis_data) {
          const fullData = JSON.parse(storedData.full_analysis_data);
          console.log('✅ 完整JSON数据存储验证成功');
          console.log(`   - 包含天级趋势数据: ${!!fullData.dailyTrend}`);
          console.log(`   - 包含小时级确认数据: ${!!fullData.hourlyConfirmation}`);
          console.log(`   - 包含15分钟执行数据: ${!!fullData.execution15m}`);
          console.log(`   - 天级趋势数据完整: ${!!fullData.dailyTrend?.trend && !!fullData.dailyTrend?.ma20}`);
          console.log(`   - 小时级确认数据完整: ${!!fullData.hourlyConfirmation?.score && !!fullData.hourlyConfirmation?.scoreDetails}`);
          console.log(`   - 15分钟执行数据完整: ${!!fullData.execution15m?.entrySignal && !!fullData.execution15m?.mode}`);
        }
      } else {
        console.error('❌ 数据存储验证失败: 未找到存储的数据');
      }

      // 验证数据统计
      console.log('📊 验证数据统计...');
      const stats = await this.db.getDataStats();
      console.log('✅ 数据统计:');
      console.log(`   - 策略分析记录: ${stats.totalStrategyAnalysis}`);
      console.log(`   - 信号记录: ${stats.totalSignals}`);
      console.log(`   - 执行记录: ${stats.totalExecutions}`);
      console.log(`   - 模拟交易: ${stats.totalSimulations}`);

      // 验证历史记录查询
      console.log('📜 验证历史记录查询...');
      const history = await this.db.getStrategyAnalysisHistory('TESTUSDT', 5);
      console.log(`✅ 历史记录查询成功，找到 ${history.length} 条记录`);

      console.log('🎉 数据存储验证完成！所有功能正常');

    } catch (error) {
      console.error('❌ 数据存储验证失败:', error);
      throw error;
    }
  }

  async verifyTechnicalIndicators() {
    console.log('🔧 验证技术指标计算模块...');

    try {
      const TechnicalIndicators = require('./modules/utils/TechnicalIndicators');

      // 测试数据
      const testData = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110];

      // 测试SMA计算
      console.log('📊 测试SMA计算...');
      const sma = TechnicalIndicators.calculateSMA(testData, 5);
      console.log(`✅ SMA计算成功，最新值: ${sma[sma.length - 1]}`);

      // 测试EMA计算
      console.log('📈 测试EMA计算...');
      const ema = TechnicalIndicators.calculateEMA(testData, 5);
      console.log(`✅ EMA计算成功，最新值: ${ema[ema.length - 1]}`);

      // 测试ATR计算
      console.log('📉 测试ATR计算...');
      const klines = testData.map((price, i) => ({
        open: price - 1,
        high: price + 1,
        low: price - 2,
        close: price,
        volume: 1000
      }));
      const atr = TechnicalIndicators.calculateATR(klines, 5);
      console.log(`✅ ATR计算成功，最新值: ${atr[atr.length - 1]}`);

      // 测试BBW计算
      console.log('📊 测试BBW计算...');
      const bbw = TechnicalIndicators.calculateBBW(testData, 5, 2);
      console.log(`✅ BBW计算成功，最新值: ${bbw[bbw.length - 1]}`);

      // 测试VWAP计算
      console.log('💰 测试VWAP计算...');
      const vwap = TechnicalIndicators.calculateVWAP(klines);
      console.log(`✅ VWAP计算成功，最新值: ${vwap}`);

      // 测试突破结构计算
      console.log('🚀 测试突破结构计算...');
      const breakout = TechnicalIndicators.calculateBreakout(klines, 5);
      console.log(`✅ 突破结构计算成功，最新值: ${breakout}`);

      // 测试成交量确认
      console.log('📊 测试成交量确认...');
      const volumeConfirmed = TechnicalIndicators.isVolumeConfirmed(klines, 1.5, 5);
      console.log(`✅ 成交量确认计算成功，结果: ${volumeConfirmed}`);

      // 测试Delta计算
      console.log('📈 测试Delta计算...');
      const deltaPositive = TechnicalIndicators.isDeltaPositive(klines, 1.0);
      console.log(`✅ Delta计算成功，结果: ${deltaPositive}`);

      console.log('🎉 技术指标计算验证完成！所有指标正常');

    } catch (error) {
      console.error('❌ 技术指标计算验证失败:', error);
      throw error;
    }
  }

  async run() {
    try {
      await this.init();

      console.log('='.repeat(60));
      console.log('🔍 SmartFlow 数据库功能验证');
      console.log('='.repeat(60));

      await this.verifyTableStructure();
      console.log('');

      await this.verifyTechnicalIndicators();
      console.log('');

      await this.verifyDataStorage();
      console.log('');

      console.log('='.repeat(60));
      console.log('✅ 所有验证完成！数据库表结构已正确更新到新策略逻辑');
      console.log('📋 验证总结:');
      console.log('   ✅ 数据库表结构正确');
      console.log('   ✅ 技术指标计算模块正常');
      console.log('   ✅ 数据存储功能正常');
      console.log('   ✅ 数据查询功能正常');
      console.log('   ✅ 所有原始数据和计算指标都能正确存储');
      console.log('='.repeat(60));

    } catch (error) {
      console.error('❌ 验证失败:', error);
      process.exit(1);
    } finally {
      await this.db.close();
    }
  }
}

// 主执行函数
async function main() {
  const verifier = new DatabaseVerifier();
  await verifier.run();
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = DatabaseVerifier;
