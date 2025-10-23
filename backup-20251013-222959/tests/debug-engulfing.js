const ICTStrategy = require('./src/strategies/ict-strategy');

async function debugEngulfing() {
  const ictStrategy = new ICTStrategy();
  const symbols = ['BTCUSDT', 'LDOUSDT', 'ADAUSDT'];

  for (const symbol of symbols) {
    console.log(`\n=== ${symbol} 吞没形态检测调试 ===`);

    try {
      // 获取15M K线数据
      const klines15m = await ictStrategy.binanceAPI.getKlines(symbol, '15m', 50);

      if (!klines15m || klines15m.length < 2) {
        console.log('K线数据不足');
        continue;
      }

      // 显示最近几根K线的详细信息
      console.log('最近5根15M K线:');
      for (let i = klines15m.length - 5; i < klines15m.length; i++) {
        if (i >= 0) {
          const kline = klines15m[i];
          const open = parseFloat(kline[1]);
          const high = parseFloat(kline[2]);
          const low = parseFloat(kline[3]);
          const close = parseFloat(kline[4]);
          const volume = parseFloat(kline[5]);
          const time = new Date(parseFloat(kline[0])).toLocaleString();

          const isGreen = close > open;
          const bodySize = Math.abs(close - open);
          const totalSize = high - low;
          const bodyRatio = totalSize > 0 ? (bodySize / totalSize) : 0;

          console.log(`  ${i}: ${time} | O:${open.toFixed(4)} H:${high.toFixed(4)} L:${low.toFixed(4)} C:${close.toFixed(4)} | ${isGreen ? '绿' : '红'} | 实体:${(bodyRatio * 100).toFixed(1)}% | Vol:${(volume / 1000000).toFixed(1)}M`);
        }
      }

      // 检测吞没形态
      const engulfing = ictStrategy.detectEngulfingPattern(klines15m);
      console.log(`\n吞没形态检测结果:`);
      console.log(`  检测到: ${engulfing.detected}`);
      console.log(`  类型: ${engulfing.type}`);
      console.log(`  强度: ${engulfing.strength}`);

      // 手动检查最近两根K线
      const current = klines15m[klines15m.length - 1];
      const previous = klines15m[klines15m.length - 2];

      const currentOpen = parseFloat(current[1]);
      const currentClose = parseFloat(current[4]);
      const previousOpen = parseFloat(previous[1]);
      const previousClose = parseFloat(previous[4]);

      console.log(`\n手动检查吞没条件:`);
      console.log(`  前一根: O=${previousOpen.toFixed(4)}, C=${previousClose.toFixed(4)} (${previousClose < previousOpen ? '阴线' : '阳线'})`);
      console.log(`  当前根: O=${currentOpen.toFixed(4)}, C=${currentClose.toFixed(4)} (${currentClose > currentOpen ? '阳线' : '阴线'})`);

      // 看涨吞没条件
      const bullishEngulfing = previousClose < previousOpen && currentClose > currentOpen &&
        currentOpen < previousClose && currentClose > previousOpen;
      console.log(`  看涨吞没条件: ${bullishEngulfing}`);
      if (bullishEngulfing) {
        console.log(`    前阴线: ${previousClose < previousOpen}`);
        console.log(`    当前阳线: ${currentClose > currentOpen}`);
        console.log(`    开盘低于前收盘: ${currentOpen < previousClose}`);
        console.log(`    收盘高于前开盘: ${currentClose > previousOpen}`);
      }

      // 看跌吞没条件
      const bearishEngulfing = previousClose > previousOpen && currentClose < currentOpen &&
        currentOpen > previousClose && currentClose < previousOpen;
      console.log(`  看跌吞没条件: ${bearishEngulfing}`);
      if (bearishEngulfing) {
        console.log(`    前阳线: ${previousClose > previousOpen}`);
        console.log(`    当前阴线: ${currentClose < currentOpen}`);
        console.log(`    开盘高于前收盘: ${currentOpen > previousClose}`);
        console.log(`    收盘低于前开盘: ${currentClose < previousOpen}`);
      }

    } catch (error) {
      console.error(`${symbol} 调试失败:`, error.message);
    }
  }
}

debugEngulfing().catch(console.error);
