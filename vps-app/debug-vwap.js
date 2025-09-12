// debug-vwap.js - 调试VWAP计算问题
const BinanceAPI = require('./modules/api/BinanceAPI');

async function debugVWAP() {
  try {
    console.log('🔍 开始调试VWAP计算问题...\n');

    const symbol = 'BNBUSDT';

    // 获取1H K线数据
    console.log(`📊 获取 ${symbol} 1H K线数据...`);
    const klines1h = await BinanceAPI.getKlines(symbol, '1h', 20);

    if (!klines1h || klines1h.length < 20) {
      console.log(`❌ 1H K线数据不足: ${klines1h?.length || 0}条`);
      return;
    }

    console.log(`✅ 获取到 ${klines1h.length} 条1H K线数据`);

    // 转换为candles格式
    const candles1h = klines1h.map(k => ({
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5])
    }));

    const last1h = candles1h[candles1h.length - 1];
    console.log(`最新1H收盘价: ${last1h.close}`);

    // 计算VWAP
    let pvSum = 0;
    let vSum = 0;

    for (const c of candles1h) {
      const typicalPrice = (c.high + c.low + c.close) / 3;
      pvSum += typicalPrice * c.volume;
      vSum += c.volume;
    }

    const vwap = vSum > 0 ? pvSum / vSum : null;
    console.log(`VWAP: ${vwap}`);

    // 检查VWAP方向一致性
    const trend4h = '多头趋势';
    const vwapDirectionConsistent = last1h.close > vwap;

    console.log(`\nVWAP方向检查:`);
    console.log(`  趋势: ${trend4h}`);
    console.log(`  收盘价: ${last1h.close}`);
    console.log(`  VWAP: ${vwap}`);
    console.log(`  方向一致: ${vwapDirectionConsistent}`);
    console.log(`  条件: ${last1h.close} > ${vwap}`);

    // 显示最近5条K线数据
    console.log(`\n最近5条1H K线数据:`);
    candles1h.slice(-5).forEach((candle, index) => {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      console.log(`  ${index + 1}. 开:${candle.open} 高:${candle.high} 低:${candle.low} 收:${candle.close} 量:${candle.volume} 典型价:${typicalPrice.toFixed(4)}`);
    });

  } catch (error) {
    console.error('❌ 调试失败:', error.message);
  }
}

// 运行调试
debugVWAP();
