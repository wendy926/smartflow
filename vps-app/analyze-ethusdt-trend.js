const https = require('https');

// 计算移动平均线
function calculateMA(prices, period) {
    if (prices.length < period) return null;
    const recentPrices = prices.slice(-period);
    return recentPrices.reduce((sum, price) => sum + price, 0) / period;
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
    const adx = dx; // 简化计算，实际应该用平滑处理
    
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

async function analyzeETHUSDTTrend() {
    try {
        console.log('🔍 开始分析ETHUSDT 4H趋势判断逻辑...\n');
        
        // 获取4H K线数据
        const klines = await makeRequest('https://fapi.binance.com/fapi/v1/klines?symbol=ETHUSDT&interval=4h&limit=200');
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
        
        console.log(`\n📈 移动平均线指标:`);
        console.log(`MA20: ${ma20?.toFixed(2)}`);
        console.log(`MA50: ${ma50?.toFixed(2)}`);
        console.log(`MA200: ${ma200?.toFixed(2)}`);
        console.log(`当前价格: ${lastClose.toFixed(2)}`);
        
        // 计算ADX指标
        const adxResult = calculateADX(klines, 14);
        console.log(`\n📊 ADX指标:`);
        console.log(`ADX: ${adxResult.ADX?.toFixed(2)}`);
        console.log(`DI+: ${adxResult.DIplus?.toFixed(2)}`);
        console.log(`DI-: ${adxResult.DIminus?.toFixed(2)}`);
        
        // 计算布林带宽度
        const bb = calculateBollingerBands(closes, 20, 2);
        console.log(`\n📏 布林带指标:`);
        console.log(`上轨: ${bb?.upper?.toFixed(2)}`);
        console.log(`中轨: ${bb?.middle?.toFixed(2)}`);
        console.log(`下轨: ${bb?.lower?.toFixed(2)}`);
        console.log(`带宽: ${bb?.bandwidth?.toFixed(4)}`);
        
        // 按照策略文档的10分打分机制分析
        console.log(`\n🎯 4H趋势打分分析 (10分制):`);
        
        let totalScore = 0;
        let bullScore = 0;
        let bearScore = 0;
        
        // 1. MA条件打分 (最多3分)
        console.log(`\n1️⃣ MA条件打分:`);
        if (ma20 && ma50 && ma200) {
            // 多头条件
            if (lastClose > ma20) {
                bullScore += 1;
                console.log(`✅ 多头条件1: 当前价格 > MA20 (${lastClose.toFixed(2)} > ${ma20.toFixed(2)}) +1分`);
            } else {
                console.log(`❌ 多头条件1: 当前价格 <= MA20 (${lastClose.toFixed(2)} <= ${ma20.toFixed(2)}) 0分`);
            }
            
            if (ma20 > ma50) {
                bullScore += 1;
                console.log(`✅ 多头条件2: MA20 > MA50 (${ma20.toFixed(2)} > ${ma50.toFixed(2)}) +1分`);
            } else {
                console.log(`❌ 多头条件2: MA20 <= MA50 (${ma20.toFixed(2)} <= ${ma50.toFixed(2)}) 0分`);
            }
            
            if (ma50 > ma200) {
                bullScore += 1;
                console.log(`✅ 多头条件3: MA50 > MA200 (${ma50.toFixed(2)} > ${ma200.toFixed(2)}) +1分`);
            } else {
                console.log(`❌ 多头条件3: MA50 <= MA200 (${ma50.toFixed(2)} <= ${ma200.toFixed(2)}) 0分`);
            }
            
            // 空头条件
            if (lastClose < ma20) {
                bearScore += 1;
                console.log(`✅ 空头条件1: 当前价格 < MA20 (${lastClose.toFixed(2)} < ${ma20.toFixed(2)}) +1分`);
            } else {
                console.log(`❌ 空头条件1: 当前价格 >= MA20 (${lastClose.toFixed(2)} >= ${ma20.toFixed(2)}) 0分`);
            }
            
            if (ma20 < ma50) {
                bearScore += 1;
                console.log(`✅ 空头条件2: MA20 < MA50 (${ma20.toFixed(2)} < ${ma50.toFixed(2)}) +1分`);
            } else {
                console.log(`❌ 空头条件2: MA20 >= MA50 (${ma20.toFixed(2)} >= ${ma50.toFixed(2)}) 0分`);
            }
            
            if (ma50 < ma200) {
                bearScore += 1;
                console.log(`✅ 空头条件3: MA50 < MA200 (${ma50.toFixed(2)} < ${ma200.toFixed(2)}) +1分`);
            } else {
                console.log(`❌ 空头条件3: MA50 >= MA200 (${ma50.toFixed(2)} >= ${ma200.toFixed(2)}) 0分`);
            }
        }
        
        console.log(`多头得分: ${bullScore}/3, 空头得分: ${bearScore}/3`);
        
        // 2. 趋势稳定性打分 (最多2分)
        console.log(`\n2️⃣ 趋势稳定性打分:`);
        if (adxResult.ADX > 25) {
            totalScore += 2;
            console.log(`✅ ADX > 25 (${adxResult.ADX.toFixed(2)}) +2分`);
        } else if (adxResult.ADX > 20) {
            totalScore += 1;
            console.log(`✅ ADX > 20 (${adxResult.ADX.toFixed(2)}) +1分`);
        } else {
            console.log(`❌ ADX <= 20 (${adxResult.ADX.toFixed(2)}) 0分`);
        }
        
        // 3. 趋势强度打分 (最多2分)
        console.log(`\n3️⃣ 趋势强度打分:`);
        if (bb && bb.bandwidth > 0.1) {
            totalScore += 2;
            console.log(`✅ 布林带宽度 > 0.1 (${bb.bandwidth.toFixed(4)}) +2分`);
        } else if (bb && bb.bandwidth > 0.05) {
            totalScore += 1;
            console.log(`✅ 布林带宽度 > 0.05 (${bb.bandwidth.toFixed(4)}) +1分`);
        } else {
            console.log(`❌ 布林带宽度 <= 0.05 (${bb?.bandwidth?.toFixed(4)}) 0分`);
        }
        
        // 4. 动量确认打分 (最多2分)
        console.log(`\n4️⃣ 动量确认打分:`);
        const recent5Closes = closes.slice(-5);
        const priceChange = (recent5Closes[4] - recent5Closes[0]) / recent5Closes[0];
        console.log(`近5根K线价格变化: ${(priceChange * 100).toFixed(2)}%`);
        
        if (Math.abs(priceChange) > 0.05) { // 5%以上变化
            totalScore += 2;
            console.log(`✅ 价格变化 > 5% (${(priceChange * 100).toFixed(2)}%) +2分`);
        } else if (Math.abs(priceChange) > 0.02) { // 2%以上变化
            totalScore += 1;
            console.log(`✅ 价格变化 > 2% (${(priceChange * 100).toFixed(2)}%) +1分`);
        } else {
            console.log(`❌ 价格变化 <= 2% (${(priceChange * 100).toFixed(2)}%) 0分`);
        }
        
        // 5. 趋势一致性打分 (最多1分)
        console.log(`\n5️⃣ 趋势一致性打分:`);
        const maTrendConsistent = (bullScore >= 2 || bearScore >= 2);
        if (maTrendConsistent) {
            totalScore += 1;
            console.log(`✅ MA趋势一致 (多头${bullScore}分或空头${bearScore}分 >= 2) +1分`);
        } else {
            console.log(`❌ MA趋势不一致 (多头${bullScore}分，空头${bearScore}分 < 2) 0分`);
        }
        
        console.log(`\n📊 最终打分结果:`);
        console.log(`多头得分: ${bullScore}/3`);
        console.log(`空头得分: ${bearScore}/3`);
        console.log(`总得分: ${totalScore}/10`);
        
        // 判断趋势方向
        console.log(`\n🎯 趋势判断逻辑:`);
        if (bullScore >= 2 && bearScore < 2) {
            console.log(`✅ 多头趋势: 多头得分${bullScore} >= 2，空头得分${bearScore} < 2`);
        } else if (bearScore >= 2 && bullScore < 2) {
            console.log(`✅ 空头趋势: 空头得分${bearScore} >= 2，多头得分${bullScore} < 2`);
        } else {
            console.log(`❌ 趋势不明确: 多头得分${bullScore}，空头得分${bearScore}`);
        }
        
        // 判断是否为趋势市
        if (totalScore >= 4) {
            console.log(`✅ 趋势市: 总得分${totalScore} >= 4`);
            if (bullScore >= 2 && bearScore < 2) {
                console.log(`最终判断: 多头趋势市`);
            } else if (bearScore >= 2 && bullScore < 2) {
                console.log(`最终判断: 空头趋势市`);
            } else {
                console.log(`最终判断: 震荡趋势市`);
            }
        } else {
            console.log(`❌ 震荡市: 总得分${totalScore} < 4`);
            console.log(`最终判断: 震荡市`);
        }
        
        // 显示最近价格走势
        console.log(`\n📈 最近10根4H K线收盘价:`);
        const recentCloses = closes.slice(-10);
        recentCloses.forEach((price, index) => {
            const change = index > 0 ? ((price - recentCloses[index-1]) / recentCloses[index-1] * 100).toFixed(2) : '0.00';
            console.log(`${index + 1}: ${price.toFixed(2)} (${change > 0 ? '+' : ''}${change}%)`);
        });
        
    } catch (error) {
        console.error('❌ 分析失败:', error.message);
    }
}

analyzeETHUSDTTrend();
