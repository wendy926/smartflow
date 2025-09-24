const TechnicalIndicators = require('./src/utils/technical-indicators');

// 测试数据
const testPrices = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120];
const testHighs = [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121];
const testLows = [99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119];
const testVolumes = [1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200, 2300, 2400, 2500, 2600, 2700, 2800, 2900, 3000];

console.log('测试数据长度:', testPrices.length);

// 测试EMA
const ema20 = TechnicalIndicators.calculateEMA(testPrices, 20);
console.log('EMA20结果:', ema20);
console.log('EMA20长度:', ema20.length);
console.log('EMA20最后值:', ema20[ema20.length - 1]);

const ema50 = TechnicalIndicators.calculateEMA(testPrices, 50);
console.log('EMA50结果:', ema50);
console.log('EMA50长度:', ema50.length);
console.log('EMA50最后值:', ema50[ema50.length - 1]);

// 测试ADX
const adx = TechnicalIndicators.calculateADX(testHighs, testLows, testPrices);
console.log('ADX结果:', adx);

// 测试BBW
const bbw = TechnicalIndicators.calculateBBW(testPrices);
console.log('BBW结果:', bbw);

// 测试VWAP
const vwap = TechnicalIndicators.calculateVWAP(testPrices, testVolumes);
console.log('VWAP结果:', vwap);
