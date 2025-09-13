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

async function debugETHUSDTMA() {
    try {
        console.log('🔍 调试ETHUSDT MA计算...\n');
        
        // 获取4H K线数据
        const klines = await makeRequest('https://fapi.binance.com/fapi/v1/klines?symbol=ETHUSDT&interval=4h&limit=200');
        
        const closes = klines.map(k => parseFloat(k[4]));
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
        
        // 分析多头条件
        console.log(`\n🎯 多头条件分析:`);
        let bullScore = 0;
        if (lastClose > currentMA20) {
            bullScore++;
            console.log(`✅ 条件1: ${lastClose.toFixed(2)} > ${currentMA20.toFixed(2)} (+1分)`);
        } else {
            console.log(`❌ 条件1: ${lastClose.toFixed(2)} <= ${currentMA20.toFixed(2)} (0分)`);
        }
        
        if (currentMA20 > currentMA50) {
            bullScore++;
            console.log(`✅ 条件2: ${currentMA20.toFixed(2)} > ${currentMA50.toFixed(2)} (+1分)`);
        } else {
            console.log(`❌ 条件2: ${currentMA20.toFixed(2)} <= ${currentMA50.toFixed(2)} (0分)`);
        }
        
        if (currentMA50 > currentMA200) {
            bullScore++;
            console.log(`✅ 条件3: ${currentMA50.toFixed(2)} > ${currentMA200.toFixed(2)} (+1分)`);
        } else {
            console.log(`❌ 条件3: ${currentMA50.toFixed(2)} <= ${currentMA200.toFixed(2)} (0分)`);
        }
        
        console.log(`\n📊 多头得分: ${bullScore}/3`);
        
        // 分析空头条件
        console.log(`\n🎯 空头条件分析:`);
        let bearScore = 0;
        if (lastClose < currentMA20) {
            bearScore++;
            console.log(`✅ 条件1: ${lastClose.toFixed(2)} < ${currentMA20.toFixed(2)} (+1分)`);
        } else {
            console.log(`❌ 条件1: ${lastClose.toFixed(2)} >= ${currentMA20.toFixed(2)} (0分)`);
        }
        
        if (currentMA20 < currentMA50) {
            bearScore++;
            console.log(`✅ 条件2: ${currentMA20.toFixed(2)} < ${currentMA50.toFixed(2)} (+1分)`);
        } else {
            console.log(`❌ 条件2: ${currentMA20.toFixed(2)} >= ${currentMA50.toFixed(2)} (0分)`);
        }
        
        if (currentMA50 < currentMA200) {
            bearScore++;
            console.log(`✅ 条件3: ${currentMA50.toFixed(2)} < ${currentMA200.toFixed(2)} (+1分)`);
        } else {
            console.log(`❌ 条件3: ${currentMA50.toFixed(2)} >= ${currentMA200.toFixed(2)} (0分)`);
        }
        
        console.log(`\n📊 空头得分: ${bearScore}/3`);
        
        // 判断趋势方向
        console.log(`\n🎯 趋势方向判断:`);
        if (bullScore >= 2 && bearScore < 2) {
            console.log(`✅ 多头趋势: 多头得分${bullScore} >= 2，空头得分${bearScore} < 2`);
        } else if (bearScore >= 2 && bullScore < 2) {
            console.log(`✅ 空头趋势: 空头得分${bearScore} >= 2，多头得分${bullScore} < 2`);
        } else {
            console.log(`❌ 趋势不明确: 多头得分${bullScore}，空头得分${bearScore}`);
        }
        
        // 显示最近的价格走势
        console.log(`\n📈 最近价格走势:`);
        const recentPrices = closes.slice(-10);
        recentPrices.forEach((price, index) => {
            const change = index > 0 ? ((price - recentPrices[index-1]) / recentPrices[index-1] * 100).toFixed(2) : '0.00';
            console.log(`${index + 1}: ${price.toFixed(2)} (${change > 0 ? '+' : ''}${change}%)`);
        });
        
    } catch (error) {
        console.error('❌ 调试失败:', error.message);
    }
}

debugETHUSDTMA();

