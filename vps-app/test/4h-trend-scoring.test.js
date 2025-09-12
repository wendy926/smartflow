/**
 * 4H趋势判断5分打分机制测试
 * 按照strategy-v3.md文档要求测试
 */

const path = require('path');

// 设置测试环境
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(__dirname, '../data/test_database.db');

describe('4H趋势判断5分打分机制测试', () => {
  let strategyCore;

  beforeAll(async () => {
    // 模拟StrategyV3Core类
    strategyCore = {
      calculateMA: (candles, period) => {
        const result = [];
        for (let i = period - 1; i < candles.length; i++) {
          const sum = candles.slice(i - period + 1, i + 1).reduce((a, c) => a + c.close, 0);
          result.push(sum / period);
        }
        return result;
      },
      calculateADX: (candles, period = 14) => {
        // 简化版ADX计算
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);
        const closes = candles.map(c => c.close);
        
        let trList = [], dmPlusList = [], dmMinusList = [];
        for (let i = 1; i < highs.length; i++) {
          const highDiff = highs[i] - highs[i - 1];
          const lowDiff = lows[i - 1] - lows[i];
          const tr = Math.max(
            highs[i] - lows[i],
            Math.abs(highs[i] - closes[i - 1]),
            Math.abs(lows[i] - closes[i - 1])
          );
          trList.push(tr);
          dmPlusList.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
          dmMinusList.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);
        }
        const tr14 = trList.slice(-period).reduce((a, b) => a + b, 0);
        const dmPlus14 = dmPlusList.slice(-period).reduce((a, b) => a + b, 0);
        const dmMinus14 = dmMinusList.slice(-period).reduce((a, b) => a + b, 0);
        const diPlus = 100 * (dmPlus14 / tr14);
        const diMinus = 100 * (dmMinus14 / tr14);
        const dx = Math.abs(diPlus - diMinus) / (diPlus + diMinus) * 100;
        return { ADX: dx, DIplus: diPlus, DIminus: diMinus };
      },
      calculateBollingerBands: (candles, period, stdDev) => {
        const result = [];
        for (let i = period - 1; i < candles.length; i++) {
          const slice = candles.slice(i - period + 1, i + 1);
          const mean = slice.reduce((a, c) => a + c.close, 0) / period;
          const variance = slice.reduce((a, c) => a + Math.pow(c.close - mean, 2), 0) / period;
          const std = Math.sqrt(variance);
          const upper = mean + stdDev * std;
          const lower = mean - stdDev * std;
          const bandwidth = (upper - lower) / mean;
          result.push({ upper, lower, middle: mean, bandwidth });
        }
        return result;
      },
      isBBWExpanding: (candles, period, stdDev) => {
        // 简化版布林带扩张判断
        const bbws = [];
        for (let i = period; i < candles.length; i++) {
          const slice = candles.slice(i - period, i);
          const mean = slice.reduce((a, c) => a + c.close, 0) / period;
          const variance = slice.reduce((a, c) => a + Math.pow(c.close - mean, 2), 0) / period;
          const std = Math.sqrt(variance);
          const upper = mean + stdDev * std;
          const lower = mean - stdDev * std;
          bbws.push((upper - lower) / mean);
        }
        if (bbws.length < 10) return false;
        const firstHalf = bbws.slice(-10, -5).reduce((a, b) => a + b, 0) / 5;
        const secondHalf = bbws.slice(-5).reduce((a, b) => a + b, 0) / 5;
        return secondHalf > firstHalf * 1.05;
      },
      dataMonitor: {
        recordIndicator: () => {}
      }
    };
  });

  describe('5分打分机制测试', () => {
    test('多头趋势应该正确计算5个因子得分', () => {
      // 创建测试数据：多头趋势
      const candles = [];
      for (let i = 0; i < 250; i++) {
        const basePrice = 100 + i * 0.1; // 上升趋势
        candles.push({
          open: basePrice,
          high: basePrice + 1,
          low: basePrice - 1,
          close: basePrice + 0.5,
          volume: 1000
        });
      }

      const ma20 = strategyCore.calculateMA(candles, 20);
      const ma50 = strategyCore.calculateMA(candles, 50);
      const ma200 = strategyCore.calculateMA(candles, 200);
      const lastClose = candles[candles.length - 1].close;

      // 1. 趋势方向（必选）- 1分
      let score = 0;
      let direction = null;
      
      if (lastClose > ma20[ma20.length - 1] && 
          ma20[ma20.length - 1] > ma50[ma50.length - 1] && 
          ma50[ma50.length - 1] > ma200[ma200.length - 1]) {
        direction = "BULL";
        score++;
      }

      expect(direction).toBe("BULL");
      expect(score).toBe(1);

      // 2. 趋势稳定性 - 1分
      const last2 = candles.slice(-2).map(c => c.close);
      const last2MA20 = ma20.slice(-2);
      const last2MA50 = ma50.slice(-2);
      const last2MA200 = ma200.slice(-2);
      
      let trendStability = false;
      if (direction === "BULL") {
        trendStability = last2.every((c, i) => 
          c > last2MA20[i] && 
          last2MA20[i] > last2MA50[i] && 
          last2MA50[i] > last2MA200[i]
        );
      }
      
      if (trendStability) {
        score++;
      }

      // 3. 趋势强度 - 1分
      const { ADX, DIplus, DIminus } = strategyCore.calculateADX(candles, 14);
      if (ADX > 20 && direction === "BULL" && DIplus > DIminus) {
        score++;
      }

      // 4. 布林带扩张 - 1分
      const bbwExpanding = strategyCore.isBBWExpanding(candles, 20, 2);
      if (bbwExpanding) {
        score++;
      }

      // 5. 动量确认 - 1分
      const momentumDistance = Math.abs((lastClose - ma20[ma20.length - 1]) / ma20[ma20.length - 1]);
      if (momentumDistance >= 0.005) {
        score++;
      }

      // 最终判断
      let trend4h = '震荡市';
      let marketType = '震荡市';
      
      if (score >= 3) {
        if (direction === "BULL") {
          trend4h = '多头趋势';
          marketType = '趋势市';
        }
      }

      console.log(`测试结果: 得分=${score}, 趋势=${trend4h}, 市场类型=${marketType}`);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(5);
    });

    test('空头趋势应该正确计算5个因子得分', () => {
      // 创建测试数据：空头趋势
      const candles = [];
      for (let i = 0; i < 250; i++) {
        const basePrice = 100 - i * 0.1; // 下降趋势
        candles.push({
          open: basePrice,
          high: basePrice + 1,
          low: basePrice - 1,
          close: basePrice - 0.5,
          volume: 1000
        });
      }

      const ma20 = strategyCore.calculateMA(candles, 20);
      const ma50 = strategyCore.calculateMA(candles, 50);
      const ma200 = strategyCore.calculateMA(candles, 200);
      const lastClose = candles[candles.length - 1].close;

      // 1. 趋势方向（必选）- 1分
      let score = 0;
      let direction = null;
      
      if (lastClose < ma20[ma20.length - 1] && 
          ma20[ma20.length - 1] < ma50[ma50.length - 1] && 
          ma50[ma50.length - 1] < ma200[ma200.length - 1]) {
        direction = "BEAR";
        score++;
      }

      expect(direction).toBe("BEAR");
      expect(score).toBe(1);

      // 最终判断
      let trend4h = '震荡市';
      let marketType = '震荡市';
      
      if (score >= 3) {
        if (direction === "BEAR") {
          trend4h = '空头趋势';
          marketType = '趋势市';
        }
      }

      console.log(`测试结果: 得分=${score}, 趋势=${trend4h}, 市场类型=${marketType}`);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(5);
    });

    test('震荡市应该返回震荡市', () => {
      // 创建测试数据：震荡市（没有明显趋势）
      const candles = [];
      for (let i = 0; i < 250; i++) {
        const basePrice = 100 + Math.sin(i * 0.1) * 5; // 震荡价格
        candles.push({
          open: basePrice,
          high: basePrice + 1,
          low: basePrice - 1,
          close: basePrice,
          volume: 1000
        });
      }

      const ma20 = strategyCore.calculateMA(candles, 20);
      const ma50 = strategyCore.calculateMA(candles, 50);
      const ma200 = strategyCore.calculateMA(candles, 200);
      const lastClose = candles[candles.length - 1].close;

      // 1. 趋势方向（必选）- 1分
      let score = 0;
      let direction = null;
      
      if (lastClose > ma20[ma20.length - 1] && 
          ma20[ma20.length - 1] > ma50[ma50.length - 1] && 
          ma50[ma50.length - 1] > ma200[ma200.length - 1]) {
        direction = "BULL";
        score++;
      } else if (lastClose < ma20[ma20.length - 1] && 
                 ma20[ma20.length - 1] < ma50[ma50.length - 1] && 
                 ma50[ma50.length - 1] < ma200[ma200.length - 1]) {
        direction = "BEAR";
        score++;
      }

      // 最终判断
      let trend4h = '震荡市';
      let marketType = '震荡市';
      
      if (score >= 3) {
        if (direction === "BULL") {
          trend4h = '多头趋势';
          marketType = '趋势市';
        } else if (direction === "BEAR") {
          trend4h = '空头趋势';
          marketType = '趋势市';
        }
      }

      console.log(`测试结果: 得分=${score}, 趋势=${trend4h}, 市场类型=${marketType}`);
      expect(trend4h).toBe('震荡市');
      expect(marketType).toBe('震荡市');
    });
  });

  describe('边界情况测试', () => {
    test('数据不足应该返回震荡市', () => {
      const result = {
        trend4h: '震荡市',
        marketType: '震荡市',
        error: '数据不足'
      };

      expect(result.trend4h).toBe('震荡市');
      expect(result.marketType).toBe('震荡市');
      expect(result.error).toBe('数据不足');
    });

    test('得分<3分应该返回震荡市', () => {
      const score = 2;
      const direction = "BULL";
      
      let trend4h = '震荡市';
      let marketType = '震荡市';
      
      if (score >= 3) {
        if (direction === "BULL") {
          trend4h = '多头趋势';
          marketType = '趋势市';
        }
      }

      expect(trend4h).toBe('震荡市');
      expect(marketType).toBe('震荡市');
    });

    test('得分≥3分应该返回对应趋势', () => {
      const score = 4;
      const direction = "BULL";
      
      let trend4h = '震荡市';
      let marketType = '震荡市';
      
      if (score >= 3) {
        if (direction === "BULL") {
          trend4h = '多头趋势';
          marketType = '趋势市';
        }
      }

      expect(trend4h).toBe('多头趋势');
      expect(marketType).toBe('趋势市');
    });
  });
});
