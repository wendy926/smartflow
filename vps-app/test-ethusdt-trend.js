const https = require('https');

function makeRequest(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
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

// 计算移动平均线
function calculateMA(prices, period) {
    if (prices.length < period) return [];
    const ma = [];
    for (let i = period - 1; i < prices.length; i++) {
        const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        ma.push(sum / period);
    }
    return ma;
}

// 计算ADX指标
function calculateADX(klines, period = 14) {
    if (klines.length < period + 1) return { ADX: null, DIplus: null, DIminus: null };
    
    const highs = klines.map(k => parseFloat(k[2]));
    const lows = klines.map(k => parseFloat(k[3]));
    const closes = klines.map(k => parseFloat(k[4]));
    
    let trSum = 0;
    let dmPlusSum = 0;
    let dmMinusSum = 0;
    
    for (let i = 1; i <= period; i++) {
        const tr = Math.max(
            highs[i] - lows[i],
            Math.abs(highs[i] - closes[i-1]),
            Math.abs(lows[i] - closes[i-1])
        );
        trSum += tr;
        
        const dmPlus = Math.max(0, highs[i] - highs[i-1]) > Math.max(0, lows[i-1] - lows[i]) 
            ? Math.max(0, highs[i] - highs[i-1]) : 0;
        const dmMinus = Math.max(0, lows[i-1] - lows[i]) > Math.max(0, highs[i] - highs[i-1])
            ? Math.max(0, lows[i-1] - lows[i]) : 0;
            
        dmPlusSum += dmPlus;
        dmMinusSum += dmMinus;
    }
    
    const atr = trSum / period;
    const diPlus = (dmPlusSum / period) / atr * 100;
    const diMinus = (dmMinusSum / period) / atr * 100;
    
    const dx = Math.abs(diPlus - diMinus) / (diPlus + diMinus) * 100;
    const adx = dx;
    
    return { ADX: adx, DIplus: diPlus, DIminus: diMinus };
}

// 计算布林带宽度
function calculateBollingerBands(prices, period = 20, multiplier = 2) {
    if (prices.length < period) return null;
    
    const recentPrices = prices.slice(-period);
    const sma = recentPrices.reduce((sum, price) => sum + price, 0) / period;
    
    const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    
    const upperBand = sma + (multiplier * stdDev);
    const lowerBand = sma - (multiplier * stdDev);
    const bandwidth = (upperBand - lowerBand) / sma;
    
    return {
        upper: upperBand,
        middle: sma,
        lower: lowerBand,
        bandwidth: bandwidth
    };
}

// 检查BBW是否扩张
function isBBWExpanding(candles, period = 20, multiplier = 2) {
    if (candles.length < period + 10) return false;
    
    const prices = candles.map(c => parseFloat(c[4]));
    
    // 前5根K线的BBW
    const front5Prices = prices.slice(-10, -5);
    const front5BB = calculateBollingerBands(front5Prices, Math.min(period, front5Prices.length), multiplier);
    const front5BBW = front5BB ? front5BB.bandwidth : 0;
    
    // 后5根K线的BBW
    const back5Prices = prices.slice(-5);
    const back5BB = calculateBollingerBands(back5Prices, Math.min(period, back5Prices.length), multiplier);
    const back5BBW = back5BB ? back5BB.bandwidth : 0;
    
    return back5BBW > front5BBW * 1.05;
}

async function testETHUSDTTrend() {
    try {
        console.log('🔍 测试ETHUSDT 4H趋势分析逻辑...\n');
        
        // 获取4H K线数据
        const klines = await makeRequest('https://fapi.binance.com/fapi/v1/klines?symbol=ETHUSDT&interval=4h&limit=200');
        
        const candles = klines.map(k => ({
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5])
        }));
        
        const closes = candles.map(c => c.close);
        const lastClose = closes[closes.length - 1];
        
        console.log(`💰 最新收盘价: ${lastClose.toFixed(2)}`);
        
        // 计算MA指标
        const ma20 = calculateMA(closes, 20);
        const ma50 = calculateMA(closes, 50);
        const ma200 = calculateMA(closes, 200);
        
        const currentMA20 = ma20[ma20.length - 1];
        const currentMA50 = ma50[ma50.length - 1];
        const currentMA200 = ma200[ma200.length - 1];
        
        console.log(`\n📈 MA计算结果:`);
        console.log(`MA20: ${currentMA20.toFixed(2)}`);
        console.log(`MA50: ${currentMA50.toFixed(2)}`);
        console.log(`MA200: ${currentMA200.toFixed(2)}`);
        
        // 计算ADX指标
        const adxResult = calculateADX(klines, 14);
        console.log(`\n📊 ADX指标:`);
        console.log(`ADX: ${adxResult.ADX?.toFixed(2)}`);
        console.log(`DI+: ${adxResult.DIplus?.toFixed(2)}`);
        console.log(`DI-: ${adxResult.DIminus?.toFixed(2)}`);
        
        // 计算布林带宽度
        const bb = calculateBollingerBands(closes, 20, 2);
        console.log(`\n📏 布林带指标:`);
        console.log(`带宽: ${bb?.bandwidth?.toFixed(4)}`);
        
        // 模拟StrategyV3Core的analyze4HTrend逻辑
        console.log(`\n🎯 模拟StrategyV3Core.analyze4HTrend逻辑:`);
        
        let totalScore = 0;
        let bullScore = 0;
        let bearScore = 0;
        let direction = null;
        let trend4h = '震荡市';
        let marketType = '震荡市';
        
        // 1. 趋势方向（必选）- 每个方向至少需要2分
        console.log(`\n1️⃣ MA条件打分:`);
        
        // 多头方向得分
        if (lastClose > currentMA20) bullScore++;
        if (currentMA20 > currentMA50) bullScore++;
        if (currentMA50 > currentMA200) bullScore++;
        
        // 空头方向得分
        if (lastClose < currentMA20) bearScore++;
        if (currentMA20 < currentMA50) bearScore++;
        if (currentMA50 < currentMA200) bearScore++;
        
        console.log(`多头得分: ${bullScore}/3, 空头得分: ${bearScore}/3`);
        
        // 检查每个方向是否至少2分
        if (bullScore >= 2) {
            direction = "BULL";
            totalScore += bullScore;
            console.log(`✅ 多头方向: 得分${bullScore} >= 2`);
        } else if (bearScore >= 2) {
            direction = "BEAR";
            totalScore += bearScore;
            console.log(`✅ 空头方向: 得分${bearScore} >= 2`);
        } else {
            console.log(`❌ 趋势不明确: 多头${bullScore}分，空头${bearScore}分，都 < 2`);
            console.log(`最终判断: 震荡市`);
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
        } else if (direction === "BEAR") {
            trendStability = last2.every((c, i) =>
                c < last2MA20[i] &&
                last2MA20[i] < last2MA50[i] &&
                last2MA50[i] < last2MA200[i]
            );
        }
        
        if (trendStability) {
            totalScore++;
            console.log(`✅ 趋势稳定: +1分`);
        } else {
            console.log(`❌ 趋势不稳定: 0分`);
        }
        
        // 3. 趋势强度 - 1分（ADX(14) > 20 且 DI方向正确）
        console.log(`\n3️⃣ 趋势强度打分:`);
        if (adxResult.ADX > 20 &&
            ((direction === "BULL" && adxResult.DIplus > adxResult.DIminus) ||
             (direction === "BEAR" && adxResult.DIminus > adxResult.DIplus))) {
            totalScore++;
            console.log(`✅ 趋势强度: ADX=${adxResult.ADX.toFixed(2)} > 20 且DI方向正确 +1分`);
        } else {
            console.log(`❌ 趋势强度: ADX=${adxResult.ADX.toFixed(2)} <= 20 或DI方向错误 0分`);
        }
        
        // 4. 布林带扩张 - 1分
        console.log(`\n4️⃣ 布林带扩张打分:`);
        const bbwExpanding = isBBWExpanding(klines, 20, 2);
        if (bbwExpanding) {
            totalScore++;
            console.log(`✅ 布林带扩张: +1分`);
        } else {
            console.log(`❌ 布林带未扩张: 0分`);
        }
        
        // 5. 动量确认 - 1分（当前K线收盘价离MA20距离 ≥ 0.5%）
        console.log(`\n5️⃣ 动量确认打分:`);
        const momentumDistance = Math.abs((lastClose - currentMA20) / currentMA20);
        if (momentumDistance >= 0.005) {
            totalScore++;
            console.log(`✅ 动量确认: 距离${(momentumDistance * 100).toFixed(2)}% >= 0.5% +1分`);
        } else {
            console.log(`❌ 动量不足: 距离${(momentumDistance * 100).toFixed(2)}% < 0.5% 0分`);
        }
        
        console.log(`\n📊 最终打分结果:`);
        console.log(`总得分: ${totalScore}/10`);
        console.log(`方向: ${direction}`);
        
        // 最终判断：得分≥4分才保留趋势
        if (totalScore >= 4) {
            if (direction === "BULL") {
                trend4h = "多头趋势";
            } else {
                trend4h = "空头趋势";
            }
            marketType = "趋势市";
        } else {
            trend4h = "震荡市";
            marketType = "震荡市";
        }
        
        console.log(`\n🎯 最终判断:`);
        console.log(`4H趋势: ${trend4h}`);
        console.log(`市场类型: ${marketType}`);
        
        // 对比实际价格走势
        console.log(`\n📈 最近价格走势验证:`);
        const recentPrices = closes.slice(-10);
        recentPrices.forEach((price, index) => {
            const change = index > 0 ? ((price - recentPrices[index-1]) / recentPrices[index-1] * 100).toFixed(2) : '0.00';
            console.log(`${index + 1}: ${price.toFixed(2)} (${change > 0 ? '+' : ''}${change}%)`);
        });
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
    }
}

testETHUSDTTrend();
