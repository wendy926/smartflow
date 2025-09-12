// debug-scoring.js - 调试1H多因子打分问题
const DatabaseManager = require('./modules/database/DatabaseManager');
const StrategyV3Core = require('./modules/strategy/StrategyV3Core');
const FactorWeightManager = require('./modules/strategy/FactorWeightManager');
const BinanceAPI = require('./modules/api/BinanceAPI');

async function debugScoring() {
  try {
    console.log('🔍 开始调试1H多因子打分问题...\n');

    // 初始化数据库
    const db = new DatabaseManager('./smartflow.db');
    await db.init();

    // 初始化策略核心
    const strategyCore = new StrategyV3Core(db);
    const factorWeightManager = new FactorWeightManager(db);

    // 测试交易对
    const testSymbols = ['BNBUSDT', 'AVAXUSDT', 'PUMPUSDT'];

    for (const symbol of testSymbols) {
      console.log(`\n📊 调试交易对: ${symbol}`);
      console.log('='.repeat(50));

      try {
        // 1. 检查分类
        const category = await factorWeightManager.getSymbolCategory(symbol);
        console.log(`分类: ${category || '未分类'}`);

        // 2. 检查权重配置
        const weights = await factorWeightManager.getFactorWeights(category, '1h_scoring');
        console.log(`权重配置:`, weights);

        // 3. 获取1H K线数据
        const klines1h = await BinanceAPI.getKlines(symbol, '1h', 20);
        if (!klines1h || klines1h.length < 20) {
          console.log(`❌ 1H K线数据不足: ${klines1h?.length || 0}条`);
          continue;
        }

        const candles1h = klines1h.map(k => ({
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5])
        }));

        const last1h = candles1h[candles1h.length - 1];
        console.log(`最新1H收盘价: ${last1h.close}`);

        // 4. 计算VWAP
        const vwap = strategyCore.calculateVWAP(candles1h.slice(-20));
        console.log(`VWAP: ${vwap}`);

        // 5. 模拟多头趋势的VWAP检查
        const trend4h = '多头趋势';
        const vwapDirectionConsistent = last1h.close > vwap;
        console.log(`VWAP方向检查: ${last1h.close} > ${vwap} = ${vwapDirectionConsistent}`);

        if (!vwapDirectionConsistent) {
          console.log(`❌ VWAP方向不一致，跳过后续计算`);
          continue;
        }

        // 6. 模拟因子数据
        const factorValues = {
          vwap: true,  // VWAP方向一致
          breakout: false,  // 假设突破失败
          volume: false,    // 假设成交量不足
          oi: false,        // 假设OI变化不足
          funding: true,    // 假设资金费率正常
          delta: false      // 假设Delta不平衡
        };

        console.log(`因子数据:`, factorValues);

        // 7. 计算加权得分
        const weightedResult = await factorWeightManager.calculateWeightedScore(
          symbol,
          '1h_scoring',
          factorValues
        );

        console.log(`加权得分结果:`, weightedResult);

        // 8. 计算各因子得分
        console.log('\n各因子得分详情:');
        for (const [factor, value] of Object.entries(factorValues)) {
          if (weights && weights[factor]) {
            const factorScore = factorWeightManager.calculateFactorScore(factor, value, '1h_scoring');
            const weightedScore = factorScore * weights[factor];
            console.log(`  ${factor}: 值=${value}, 权重=${weights[factor]}, 得分=${factorScore}, 加权得分=${weightedScore}`);
          }
        }

      } catch (error) {
        console.error(`❌ 调试${symbol}失败:`, error.message);
      }
    }

    await db.close();
    console.log('\n✅ 调试完成');

  } catch (error) {
    console.error('❌ 调试失败:', error);
  }
}

// 运行调试
debugScoring();
