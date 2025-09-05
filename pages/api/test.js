/**
 * Vercel API 路由 - 测试接口
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
    // 模拟测试结果
    const testResult = {
      timestamp: new Date().toISOString(),
      tests: [
        {
          test: 'K线数据',
          status: 'PASS',
          data: '模拟数据 - 10条K线'
        },
        {
          test: '资金费率',
          status: 'PASS', 
          data: '模拟数据 - 0.0001'
        },
        {
          test: '持仓量',
          status: 'PASS',
          data: '模拟数据 - 5条记录'
        }
      ],
      summary: {
        total: 3,
        passed: 3,
        failed: 0
      },
      message: 'Vercel 部署成功！所有测试通过。'
    };
    
    res.status(200).json(testResult);
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
}
