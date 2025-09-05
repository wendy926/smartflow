/**
 * Vercel API 路由 - 策略分析接口
 */

export default async function handler(req, res) {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  try {
    const { symbol = 'BTCUSDT' } = req.query;
    
    // 模拟策略分析结果
    const result = {
      time: new Date().toISOString(),
      symbol: symbol,
      trend: 'UPTREND',
      close: 50000 + Math.random() * 1000,
      vwap: 49900 + Math.random() * 1000,
      volume: 1000 + Math.random() * 500,
      avgVol: 800 + Math.random() * 200,
      volumeRatio: 1.2 + Math.random() * 0.5,
      oiChange: 2.5 + Math.random() * 2,
      funding: 0.0001 + Math.random() * 0.0001,
      signal: Math.random() > 0.7 ? 'LONG_SIGNAL' : 'NO_SIGNAL',
      reason: '模拟分析结果 - 用于演示',
      setupHigh: 50100 + Math.random() * 100,
      setupLow: 49900 + Math.random() * 100,
      stopLoss: 49800 + Math.random() * 100,
      targetPrice: 50200 + Math.random() * 200,
      riskReward: 2.0 + Math.random() * 0.5
    };
    
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
}
