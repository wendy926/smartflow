const ICTStrategy = require('./src/strategies/ict-strategy');
const BinanceAPI = require('./src/api/binance-api');

/**
 * 测试15分钟扫荡速率显示修复
 */
async function test15mSweepDisplay() {
  const ictStrategy = new ICTStrategy();
  const binanceAPI = new BinanceAPI();

  const symbols = ['ADAUSDT', 'BNBUSDT', 'BTCUSDT', 'ETHUSDT'];

  console.log('🔍 测试15分钟扫荡速率显示修复\n');
  console.log('符号\t\tATR\t\t阈值(0.2×ATR)\t实际扫荡率\t检测状态');
  console.log('─'.repeat(80));

  for (const symbol of symbols) {
    try {
      // 获取15分钟K线数据
      const klines15m = await binanceAPI.getKlines(symbol, '15m', 50);
      if (!klines15m || klines15m.length < 10) {
        console.log(`${symbol}\t\t数据不足`);
        continue;
      }

      // 计算ATR
      const atr = ictStrategy.calculateATR(klines15m, 14);
      const currentATR = atr[atr.length - 1];

      // 计算极值点
      const recent15mKlines = klines15m.slice(-10);
      let recent15mHigh = 0;
      let recent15mLow = Infinity;
      recent15mKlines.forEach(kline => {
        const high = parseFloat(kline[2]);
        const low = parseFloat(kline[3]);
        if (high > recent15mHigh) recent15mHigh = high;
        if (low < recent15mLow) recent15mLow = low;
      });

      // 检测扫荡
      const sweepUp = ictStrategy.detectSweepLTF(klines15m, currentATR, recent15mHigh);
      const sweepDown = ictStrategy.detectSweepLTF(klines15m, currentATR, recent15mLow);
      const sweep = sweepUp.speed > sweepDown.speed ? sweepUp : sweepDown;

      const threshold = currentATR * 0.2;
      const status = sweep.detected ? '✅ 满足阈值' : (sweep.speed > 0 ? '⚠️ 未达阈值' : '❌ 无扫荡');

      console.log(`${symbol}\t\t${currentATR.toFixed(6)}\t\t${threshold.toFixed(6)}\t\t${sweep.speed.toFixed(6)}\t\t${status}`);

    } catch (error) {
      console.log(`${symbol}\t\t错误: ${error.message}`);
    }
  }
}

// 运行测试
test15mSweepDisplay().catch(console.error);
