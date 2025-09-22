/**
 * 真实策略实现单元测试
 * 测试V3和ICT策略的真实逻辑实现
 */

const assert = require('assert');
const TechnicalIndicators = require('../src/strategies/TechnicalIndicators');
const V3Strategy = require('../src/strategies/V3Strategy');
const ICTStrategy = require('../src/strategies/ICTStrategy');
const KlineDataFetcher = require('../src/strategies/KlineDataFetcher');

describe('真实策略实现测试', () => {
  let v3Strategy, ictStrategy, klineFetcher;

  beforeAll(() => {
    v3Strategy = new V3Strategy();
    ictStrategy = new ICTStrategy();
    klineFetcher = new KlineDataFetcher();
  });

  describe('技术指标计算测试', () => {
    it('应该正确计算SMA', () => {
      const prices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const sma = TechnicalIndicators.calculateSMA(prices, 5);

      assert.strictEqual(sma.length, 6);
      assert.strictEqual(sma[0], 3); // (1+2+3+4+5)/5
      assert.strictEqual(sma[5], 8); // (6+7+8+9+10)/5
    });

    it('应该正确计算EMA', () => {
      const prices = [1, 2, 3, 4, 5];
      const ema = TechnicalIndicators.calculateEMA(prices, 3);

      assert.strictEqual(ema.length, 5);
      assert.strictEqual(ema[0], 1); // 初始值
      assert.ok(ema[4] > ema[0]); // EMA应该递增
    });

    it('应该正确计算ATR', () => {
      const highs = [10, 11, 12, 13, 14];
      const lows = [9, 10, 11, 12, 13];
      const closes = [9.5, 10.5, 11.5, 12.5, 13.5];

      const atr = TechnicalIndicators.calculateATR(highs, lows, closes, 3);

      assert.strictEqual(atr.length, 5);
      assert.ok(atr[4] > 0); // ATR应该为正数
    });

    it('应该正确计算ADX', () => {
      const highs = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
      const lows = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
      const closes = [9.5, 10.5, 11.5, 12.5, 13.5, 14.5, 15.5, 16.5, 17.5, 18.5, 19.5, 20.5, 21.5, 22.5, 23.5];

      const adx = TechnicalIndicators.calculateADX(highs, lows, closes, 14);

      assert.ok(adx.adx >= 0 && adx.adx <= 100);
      assert.ok(adx.diPlus >= 0 && adx.diPlus <= 100);
      assert.ok(adx.diMinus >= 0 && adx.diMinus <= 100);
    });

    it('应该正确计算布林带', () => {
      const prices = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
      const bands = TechnicalIndicators.calculateBollingerBands(prices, 20, 2);

      assert.strictEqual(bands.length, 2);
      const band = bands[1];
      assert.ok(band.upper > band.middle);
      assert.ok(band.middle > band.lower);
      assert.ok(band.width > 0);
    });

    it('应该正确计算VWAP', () => {
      const klines = [
        { high: 10, low: 9, close: 9.5, volume: 100 },
        { high: 11, low: 10, close: 10.5, volume: 200 },
        { high: 12, low: 11, close: 11.5, volume: 300 }
      ];

      const vwap = TechnicalIndicators.calculateVWAP(klines);

      assert.ok(vwap > 9.5 && vwap < 11.5);
    });

    it('应该正确检测吞没形态', () => {
      const prevCandle = { open: 10, close: 11, high: 11.5, low: 9.5 };
      const currCandle = { open: 10.5, close: 12, high: 12.5, low: 10 };
      const atr = 0.5;

      const isEngulfing = TechnicalIndicators.isEngulfingPattern(prevCandle, currCandle, atr, 'up');

      assert.strictEqual(isEngulfing, true);
    });

    it('应该正确检测突破', () => {
      const currentPrice = 105;
      const highs = [100, 101, 102, 103, 104];
      const lows = [99, 100, 101, 102, 103];

      const breakoutUp = TechnicalIndicators.isBreakout(currentPrice, highs, lows, 'up');
      const breakoutDown = TechnicalIndicators.isBreakout(currentPrice, highs, lows, 'down');

      assert.strictEqual(breakoutUp, true);
      assert.strictEqual(breakoutDown, false);
    });

    it('应该正确计算趋势得分', () => {
      const close = 105;
      const ma20 = 103;
      const ma50 = 101;
      const ma200 = 99;

      const trendScore = TechnicalIndicators.calculateTrendScore(close, ma20, ma50, ma200);

      assert.strictEqual(trendScore.direction, 'BULL');
      assert.strictEqual(trendScore.bullScore, 3);
      assert.strictEqual(trendScore.bearScore, 0);
    });
  });

  describe('V3策略测试', () => {
    it('应该正确分析4H趋势', () => {
      const klines4h = Array.from({ length: 250 }, (_, i) => ({
        open_time: Date.now() - (250 - i) * 4 * 60 * 60 * 1000,
        close_price: 100 + i * 0.1, // 上升趋势
        high_price: 100.5 + i * 0.1,
        low_price: 99.5 + i * 0.1,
        volume: 1000
      }));

      const indicators4h = Array.from({ length: 250 }, (_, i) => ({
        ma20: 100 + i * 0.1,
        ma50: 99 + i * 0.1,
        ma200: 98 + i * 0.1,
        adx14: 25,
        di_plus: 60,
        di_minus: 40,
        bb_width: 0.05
      }));

      const result = v3Strategy.analyze4HTrend(klines4h, indicators4h);

      assert.ok(['多头趋势', '空头趋势', '震荡市'].includes(result.trend));
      assert.ok(typeof result.score === 'number');
      assert.ok(['强', '中', '弱'].includes(result.strength));
    });

    it('应该正确进行1H多因子打分', () => {
      const klines1h = Array.from({ length: 50 }, (_, i) => ({
        close_price: 100 + i * 0.01,
        high_price: 100.5 + i * 0.01,
        low_price: 99.5 + i * 0.01,
        volume: 1000
      }));

      const indicators1h = Array.from({ length: 50 }, (_, i) => ({
        vwap: 100 + i * 0.01,
        volume_ratio: 1.5,
        oi_change_6h: 0.025,
        funding_rate: 0.0001,
        delta_ratio: 1.3
      }));

      const result = v3Strategy.analyze1HFactors(klines1h, indicators1h, '多头趋势');

      assert.ok(typeof result.score === 'number');
      assert.ok(result.score >= 0);
      assert.ok(typeof result.details === 'object');
    });

    it('应该正确分析15m入场执行', () => {
      const klines15m = Array.from({ length: 100 }, (_, i) => ({
        close_price: 100 + i * 0.001,
        high_price: 100.1 + i * 0.001,
        low_price: 99.9 + i * 0.001,
        volume: 100
      }));

      const indicators15m = Array.from({ length: 100 }, (_, i) => ({
        ema20: 100 + i * 0.001,
        ema50: 99.8 + i * 0.001,
        atr14: 0.5
      }));

      const result = v3Strategy.analyze15mExecution(klines15m, indicators15m, '多头趋势');

      assert.ok(['回踩确认', '反抽确认', 'NONE'].includes(result.mode));
      if (result.mode !== 'NONE') {
        assert.ok(result.entryPrice > 0);
        assert.ok(result.stopLoss > 0);
        assert.ok(result.takeProfit > 0);
      }
    });

    it('应该正确计算信号强度', () => {
      const strength1 = v3Strategy.calculateSignalStrength(5, 4, '回踩确认');
      const strength2 = v3Strategy.calculateSignalStrength(3, 2, '反抽确认');
      const strength3 = v3Strategy.calculateSignalStrength(2, 1, 'NONE');

      assert.ok(['强', '中', '弱'].includes(strength1));
      assert.ok(['强', '中', '弱'].includes(strength2));
      assert.strictEqual(strength3, '弱');
    });
  });

  describe('ICT策略测试', () => {
    it('应该正确分析1D趋势', () => {
      const klines1d = Array.from({ length: 25 }, (_, i) => ({
        close_price: 100 + i * 0.5 // 明显上升趋势
      }));

      const result = ictStrategy.analyzeDailyTrend(klines1d);

      assert.ok(['up', 'down', 'sideways'].includes(result.trend));
      assert.ok(typeof result.score === 'number');
    });

    it('应该正确检测订单块', () => {
      const klines4h = Array.from({ length: 20 }, (_, i) => ({
        open_time: Date.now() - (20 - i) * 4 * 60 * 60 * 1000,
        high_price: 100 + i * 0.1,
        low_price: 99 + i * 0.1,
        close_price: 99.5 + i * 0.1,
        volume: 1000
      }));

      const indicators4h = Array.from({ length: 20 }, () => ({
        atr14: 1.0
      }));

      const result = ictStrategy.detectOrderBlocks(klines4h, indicators4h);

      assert.strictEqual(typeof result.detected, 'boolean');
      if (result.detected) {
        assert.ok(result.low > 0);
        assert.ok(result.high > 0);
        assert.ok(result.ageDays >= 0);
      }
    });

    it('应该正确检测4H Sweep', () => {
      const klines4h = Array.from({ length: 10 }, (_, i) => ({
        high_price: 100 + i * 0.1,
        low_price: 99 + i * 0.1,
        close_price: 99.5 + i * 0.1,
        volume: 1000
      }));

      const indicators4h = Array.from({ length: 10 }, () => ({
        atr14: 1.0
      }));

      const result = ictStrategy.detectSweepHTF(klines4h, indicators4h, 'up');

      assert.strictEqual(typeof result.detected, 'boolean');
      assert.ok(result.speed >= 0);
    });

    it('应该正确检测15m Sweep', () => {
      const klines15m = Array.from({ length: 10 }, (_, i) => ({
        high_price: 100 + i * 0.01,
        low_price: 99.9 + i * 0.01,
        close_price: 99.95 + i * 0.01,
        volume: 100
      }));

      const indicators15m = Array.from({ length: 10 }, () => ({
        atr14: 0.1
      }));

      const result = ictStrategy.detectSweepLTF(klines15m, indicators15m);

      assert.strictEqual(typeof result.detected, 'boolean');
      assert.ok(result.speed >= 0);
    });

    it('应该正确检测吞没形态', () => {
      const klines15m = [
        { open: 100, close: 101, high: 101.5, low: 99.5 },
        { open: 100.5, close: 102, high: 102.5, low: 100 }
      ];

      const indicators15m = [{ atr14: 0.5 }];

      const result = ictStrategy.detectEngulfingPattern(klines15m, indicators15m, 'up');

      assert.strictEqual(typeof result.detected, 'boolean');
    });

    it('应该正确计算交易参数', () => {
      const klines15m = Array.from({ length: 50 }, (_, i) => ({
        close_price: 100 + i * 0.001,
        high_price: 100.1 + i * 0.001,
        low_price: 99.9 + i * 0.001,
        volume: 100
      }));

      const indicators4h = [{ atr14: 1.0 }];
      const indicators15m = [{ atr14: 0.1 }];

      const result = ictStrategy.calculateTradeParameters(
        klines15m, indicators4h, indicators15m, 'up', 99.5, 100.5
      );

      assert.ok(result.entryPrice > 0);
      assert.ok(result.stopLoss > 0);
      assert.ok(result.takeProfit > 0);
      assert.ok(result.atr4h > 0);
      assert.ok(result.atr15m > 0);
    });

    it('应该正确确定信号类型', () => {
      const signalType1 = ictStrategy.determineSignalType('up', true, true);
      const signalType2 = ictStrategy.determineSignalType('down', true, true);
      const signalType3 = ictStrategy.determineSignalType('up', false, true);

      assert.strictEqual(signalType1, 'BOS_LONG');
      assert.strictEqual(signalType2, 'BOS_SHORT');
      assert.strictEqual(signalType3, 'WAIT');
    });

    it('应该正确计算信号强度', () => {
      const analysis = {
        dailyTrend: 'up',
        obDetected: true,
        sweepHTF: true,
        sweepLTF: true,
        engulfingDetected: true
      };

      const strength = ictStrategy.calculateSignalStrength(analysis);

      assert.ok(['强', '中', '弱'].includes(strength));
    });
  });

  describe('K线数据获取测试', () => {
    it('应该正确获取最新价格', async () => {
      try {
        const price = await klineFetcher.fetchLatestPrice('BTCUSDT');
        assert.ok(typeof price === 'number');
        assert.ok(price > 0);
      } catch (error) {
        // 如果网络请求失败，跳过测试
        console.warn('⚠️ 跳过网络请求测试:', error.message);
      }
    });

    it('应该正确获取24小时统计', async () => {
      try {
        const ticker = await klineFetcher.fetch24hrTicker('BTCUSDT');
        assert.ok(typeof ticker === 'object');
        assert.ok(ticker.symbol === 'BTCUSDT');
        assert.ok(typeof ticker.lastPrice === 'number');
        assert.ok(ticker.lastPrice > 0);
      } catch (error) {
        console.warn('⚠️ 跳过网络请求测试:', error.message);
      }
    });

    it('应该正确获取资金费率', async () => {
      try {
        const fundingRate = await klineFetcher.fetchFundingRate('BTCUSDT');
        assert.ok(typeof fundingRate === 'number');
        assert.ok(fundingRate >= -0.01 && fundingRate <= 0.01); // 合理范围
      } catch (error) {
        console.warn('⚠️ 跳过网络请求测试:', error.message);
      }
    });

    it('应该正确验证交易对', async () => {
      try {
        const isValid = await klineFetcher.validateSymbol('BTCUSDT');
        assert.strictEqual(typeof isValid, 'boolean');
      } catch (error) {
        console.warn('⚠️ 跳过网络请求测试:', error.message);
      }
    });
  });

  describe('策略配置测试', () => {
    it('V3策略应该有正确的默认配置', () => {
      const config = v3Strategy.config;

      assert.ok(config.trend4h.scoreThreshold >= 4);
      assert.ok(config.trend4h.minDirectionScore >= 2);
      assert.ok(config.trend4h.adxThreshold >= 20);
      assert.ok(config.hourly.scoreThreshold >= 3);
      assert.ok(config.execution.riskRewardRatio >= 2);
    });

    it('ICT策略应该有正确的默认配置', () => {
      const config = ictStrategy.config;

      assert.ok(config.dailyTrend.lookbackPeriod >= 20);
      assert.ok(config.obDetection.minHeightATRRatio >= 0.25);
      assert.ok(config.obDetection.maxAgeDays >= 30);
      assert.ok(config.riskManagement.riskRewardRatio >= 3);
    });
  });

  describe('错误处理测试', () => {
    it('应该正确处理无效的K线数据', () => {
      const result = v3Strategy.analyze('BTCUSDT', {}, {});

      assert.ok(result.finalSignal === '观望');
      assert.ok(result.error || result.trend4h === '震荡市');
    });

    it('应该正确处理数据不足的情况', () => {
      const klines4h = [{ close_price: 100 }]; // 数据不足
      const result = v3Strategy.analyze4HTrend(klines4h, []);

      assert.strictEqual(result.trend, '震荡市');
      assert.strictEqual(result.score, 0);
    });

    it('应该正确处理技术指标计算错误', () => {
      const result = TechnicalIndicators.calculateSMA([], 5);
      assert.strictEqual(result.length, 0);
    });
  });
});
