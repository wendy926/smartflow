// debug-aaveusdt-trend.js - 分析AAVEUSDT的趋势判断逻辑

const https = require('https');

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function calculateMA(data, period) {
  if (data.length < period) return null;
  const ma = [];
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    ma.push(sum / period);
  }
  return ma;
}

function calculateADX(candles, period = 14) {
  if (candles.length < period + 1) return { ADX: 0, DIplus: 0, DIminus: 0 };

  const trueRanges = [];
  const plusDMs = [];
  const minusDMs = [];

  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const previous = candles[i - 1];

    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close)
    );
    trueRanges.push(tr);

    const highDiff = current.high - previous.high;
    const lowDiff = previous.low - current.low;

    const plusDM = (highDiff > lowDiff && highDiff > 0) ? highDiff : 0;
    const minusDM = (lowDiff > highDiff && lowDiff > 0) ? lowDiff : 0;

    plusDMs.push(plusDM);
    minusDMs.push(minusDM);
  }

  const atr = calculateMA(trueRanges, period);
  const plusDI = calculateMA(plusDMs, period);
  const minusDI = calculateMA(minusDMs, period);

  if (!atr || !plusDI || !minusDI) return { ADX: 0, DIplus: 0, DIminus: 0 };

  const smoothedPlusDI = plusDI.map((di, i) => (di / atr[i]) * 100);
  const smoothedMinusDI = minusDI.map((di, i) => (di / atr[i]) * 100);

  const dx = smoothedPlusDI.map((plus, i) => {
    const minus = smoothedMinusDI[i];
    const sum = plus + minus;
    return sum > 0 ? Math.abs(plus - minus) / sum * 100 : 0;
  });

  const adx = calculateMA(dx, period);

  return {
    ADX: adx ? adx[adx.length - 1] : 0,
    DIplus: smoothedPlusDI ? smoothedPlusDI[smoothedPlusDI.length - 1] : 0,
    DIminus: smoothedMinusDI ? smoothedMinusDI[smoothedMinusDI.length - 1] : 0
  };
}

function calculateBollingerBands(data, period = 20, k = 2) {
  if (data.length < period) return null;

  const bands = [];
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;

    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    bands.push({
      upper: mean + (k * stdDev),
      middle: mean,
      lower: mean - (k * stdDev),
      bandwidth: (k * stdDev * 2) / mean
    });
  }

  return bands;
}

function isBBWExpanding(candles, period = 20, k = 2) {
  if (candles.length < 10) return false;

  const closes = candles.map(c => c.close);
  const bb = calculateBollingerBands(closes, period, k);

  if (!bb || bb.length < 10) return false;

  const recent10 = bb.slice(-10);
  const first5 = recent10.slice(0, 5);
  const last5 = recent10.slice(5);

  const first5Avg = first5.reduce((a, b) => a + b.bandwidth, 0) / 5;
  const last5Avg = last5.reduce((a, b) => a + b.bandwidth, 0) / 5;

  return last5Avg > first5Avg * 1.05;
}

async function analyzeAAVEUSDTTrend() {
  try {
    console.log('🔍 开始分析AAVEUSDT 4H趋势判断逻辑...\n');

    // 获取4H K线数据
    const klines = await makeRequest('https://fapi.binance.com/fapi/v1/klines?symbol=AAVEUSDT&interval=4h&limit=200');
    console.log(`📊 获取到 ${klines.length} 条4H K线数据`);

    // 提取价格数据
    const closes = klines.map(k => parseFloat(k[4]));
    const highs = klines.map(k => parseFloat(k[2]));
    const lows = klines.map(k => parseFloat(k[3]));
    const volumes = klines.map(k => parseFloat(k[5]));

    const lastClose = closes[closes.length - 1];
    console.log(`💰 最新收盘价: ${lastClose}`);

    // 计算MA指标
    const ma20 = calculateMA(closes, 20);
    const ma50 = calculateMA(closes, 50);
    const ma200 = calculateMA(closes, 200);

    const currentMA20 = ma20[ma20.length - 1];
    const currentMA50 = ma50[ma50.length - 1];
    const currentMA200 = ma200[ma200.length - 1];

    console.log(`\n📈 移动平均线指标:`);
    console.log(`MA20: ${currentMA20?.toFixed(4)}`);
    console.log(`MA50: ${currentMA50?.toFixed(4)}`);
    console.log(`MA200: ${currentMA200?.toFixed(4)}`);
    console.log(`当前价格: ${lastClose.toFixed(4)}`);

    // 计算ADX指标
    const candles = klines.map(k => ({
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5])
    }));

    const adxResult = calculateADX(candles, 14);
    console.log(`\n📊 ADX指标:`);
    console.log(`ADX: ${adxResult.ADX?.toFixed(2)}`);
    console.log(`DI+: ${adxResult.DIplus?.toFixed(2)}`);
    console.log(`DI-: ${adxResult.DIminus?.toFixed(2)}`);

    // 计算布林带宽度
    const bb = calculateBollingerBands(closes, 20, 2);
    const bbw = bb ? bb[bb.length - 1]?.bandwidth : 0;
    console.log(`\n📏 布林带指标:`);
    console.log(`上轨: ${bb ? bb[bb.length - 1]?.upper?.toFixed(4) : 'N/A'}`);
    console.log(`中轨: ${bb ? bb[bb.length - 1]?.middle?.toFixed(4) : 'N/A'}`);
    console.log(`下轨: ${bb ? bb[bb.length - 1]?.lower?.toFixed(4) : 'N/A'}`);
    console.log(`带宽: ${bbw?.toFixed(6)}`);

    // 按照V3策略的10分打分机制分析
    console.log(`\n🎯 4H趋势打分分析 (10分制):`);

    let totalScore = 0;
    let bullScore = 0;
    let bearScore = 0;
    let direction = null;

    // 1. 趋势方向（必选）- 每个方向至少需要2分
    console.log(`\n1️⃣ 趋势方向打分:`);

    // 多头方向得分
    if (lastClose > currentMA20) {
      bullScore++;
      console.log(`✅ 多头条件1: 当前价格 > MA20 (${lastClose.toFixed(4)} > ${currentMA20.toFixed(4)}) +1分`);
    } else {
      console.log(`❌ 多头条件1: 当前价格 <= MA20 (${lastClose.toFixed(4)} <= ${currentMA20.toFixed(4)}) 0分`);
    }

    if (currentMA20 > currentMA50) {
      bullScore++;
      console.log(`✅ 多头条件2: MA20 > MA50 (${currentMA20.toFixed(4)} > ${currentMA50.toFixed(4)}) +1分`);
    } else {
      console.log(`❌ 多头条件2: MA20 <= MA50 (${currentMA20.toFixed(4)} <= ${currentMA50.toFixed(4)}) 0分`);
    }

    if (currentMA50 > currentMA200) {
      bullScore++;
      console.log(`✅ 多头条件3: MA50 > MA200 (${currentMA50.toFixed(4)} > ${currentMA200.toFixed(4)}) +1分`);
    } else {
      console.log(`❌ 多头条件3: MA50 <= MA200 (${currentMA50.toFixed(4)} <= ${currentMA200.toFixed(4)}) 0分`);
    }

    // 空头方向得分
    if (lastClose < currentMA20) {
      bearScore++;
      console.log(`✅ 空头条件1: 当前价格 < MA20 (${lastClose.toFixed(4)} < ${currentMA20.toFixed(4)}) +1分`);
    } else {
      console.log(`❌ 空头条件1: 当前价格 >= MA20 (${lastClose.toFixed(4)} >= ${currentMA20.toFixed(4)}) 0分`);
    }

    if (currentMA20 < currentMA50) {
      bearScore++;
      console.log(`✅ 空头条件2: MA20 < MA50 (${currentMA20.toFixed(4)} < ${currentMA50.toFixed(4)}) +1分`);
    } else {
      console.log(`❌ 空头条件2: MA20 >= MA50 (${currentMA20.toFixed(4)} >= ${currentMA50.toFixed(4)}) 0分`);
    }

    if (currentMA50 < currentMA200) {
      bearScore++;
      console.log(`✅ 空头条件3: MA50 < MA200 (${currentMA50.toFixed(4)} < ${currentMA200.toFixed(4)}) +1分`);
    } else {
      console.log(`❌ 空头条件3: MA50 >= MA200 (${currentMA50.toFixed(4)} >= ${currentMA200.toFixed(4)}) 0分`);
    }

    console.log(`多头得分: ${bullScore}/3, 空头得分: ${bearScore}/3`);

    // 检查每个方向是否至少2分
    if (bullScore >= 2) {
      direction = "BULL";
      totalScore += bullScore;
      console.log(`✅ 多头方向确认: 得分${bullScore} >= 2`);
    } else if (bearScore >= 2) {
      direction = "BEAR";
      totalScore += bearScore;
      console.log(`✅ 空头方向确认: 得分${bearScore} >= 2`);
    } else {
      console.log(`❌ 方向不明确: 多头${bullScore}分，空头${bearScore}分，都 < 2分`);
      console.log(`最终判断: 震荡市 (方向不明确)`);
      return;
    }

    // 2. 趋势稳定性 - 1分（连续≥2根4H K线满足趋势方向）
    console.log(`\n2️⃣ 趋势稳定性打分:`);
    const last2 = closes.slice(-2);
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
      console.log(`检查多头稳定性: 最近2根K线都满足多头条件`);
      console.log(`K线1: 价格${last2[0].toFixed(4)} > MA20${last2MA20[0].toFixed(4)} > MA50${last2MA50[0].toFixed(4)} > MA200${last2MA200[0].toFixed(4)}`);
      console.log(`K线2: 价格${last2[1].toFixed(4)} > MA20${last2MA20[1].toFixed(4)} > MA50${last2MA50[1].toFixed(4)} > MA200${last2MA200[1].toFixed(4)}`);
    } else if (direction === "BEAR") {
      trendStability = last2.every((c, i) =>
        c < last2MA20[i] &&
        last2MA20[i] < last2MA50[i] &&
        last2MA50[i] < last2MA200[i]
      );
      console.log(`检查空头稳定性: 最近2根K线都满足空头条件`);
      console.log(`K线1: 价格${last2[0].toFixed(4)} < MA20${last2MA20[0].toFixed(4)} < MA50${last2MA50[0].toFixed(4)} < MA200${last2MA200[0].toFixed(4)}`);
      console.log(`K线2: 价格${last2[1].toFixed(4)} < MA20${last2MA20[1].toFixed(4)} < MA50${last2MA50[1].toFixed(4)} < MA200${last2MA200[1].toFixed(4)}`);
    }

    if (trendStability) {
      totalScore++;
      console.log(`✅ 趋势稳定性确认 +1分`);
    } else {
      console.log(`❌ 趋势稳定性不足 0分`);
    }

    // 3. 趋势强度 - 1分（ADX(14) > 20 且 DI方向正确）
    console.log(`\n3️⃣ 趋势强度打分:`);
    const adxCondition = adxResult.ADX > 20;
    const diCondition = direction === "BULL" ?
      (adxResult.DIplus > adxResult.DIminus) :
      (adxResult.DIminus > adxResult.DIplus);

    console.log(`ADX条件: ADX=${adxResult.ADX.toFixed(2)} > 20 = ${adxCondition}`);
    console.log(`DI条件: DI+=${adxResult.DIplus.toFixed(2)}, DI-=${adxResult.DIminus.toFixed(2)}`);

    if (direction === "BULL") {
      console.log(`多头DI条件: DI+ > DI- = ${diCondition}`);
    } else {
      console.log(`空头DI条件: DI- > DI+ = ${diCondition}`);
    }

    if (adxCondition && diCondition) {
      totalScore++;
      console.log(`✅ 趋势强度确认 +1分`);
    } else {
      console.log(`❌ 趋势强度不足 0分`);
    }

    // 4. 布林带扩张 - 1分
    console.log(`\n4️⃣ 布林带扩张打分:`);
    const bbwExpanding = isBBWExpanding(candles, 20, 2);
    console.log(`布林带扩张检测: ${bbwExpanding}`);
    if (bbwExpanding) {
      totalScore++;
      console.log(`✅ 布林带扩张确认 +1分`);
    } else {
      console.log(`❌ 布林带未扩张 0分`);
    }

    // 5. 动量确认 - 1分（当前K线收盘价离MA20距离 ≥ 0.5%）
    console.log(`\n5️⃣ 动量确认打分:`);
    const momentumDistance = Math.abs((lastClose - currentMA20) / currentMA20);
    console.log(`动量距离: ${(momentumDistance * 100).toFixed(2)}%`);
    if (momentumDistance >= 0.005) {
      totalScore++;
      console.log(`✅ 动量确认 (≥0.5%) +1分`);
    } else {
      console.log(`❌ 动量不足 (<0.5%) 0分`);
    }

    console.log(`\n📊 最终打分结果:`);
    console.log(`${direction === "BULL" ? "多头" : "空头"}得分: ${direction === "BULL" ? bullScore : bearScore}/3`);
    console.log(`总得分: ${totalScore}/10`);

    // 最终判断
    console.log(`\n🎯 最终趋势判断:`);
    if (totalScore >= 4) {
      const trend = direction === "BULL" ? "多头趋势" : "空头趋势";
      console.log(`✅ ${trend}: 总得分${totalScore} >= 4分`);
    } else {
      console.log(`❌ 震荡市: 总得分${totalScore} < 4分`);
    }

    // 显示最近价格走势
    console.log(`\n📈 最近10根4H K线收盘价:`);
    const recentCloses = closes.slice(-10);
    recentCloses.forEach((price, index) => {
      const change = index > 0 ? ((price - recentCloses[index - 1]) / recentCloses[index - 1] * 100).toFixed(2) : '0.00';
      console.log(`${index + 1}: ${price.toFixed(4)} (${change > 0 ? '+' : ''}${change}%)`);
    });

  } catch (error) {
    console.error('❌ 分析失败:', error.message);
    console.error('错误详情:', error);
  }
}

analyzeAAVEUSDTTrend();
