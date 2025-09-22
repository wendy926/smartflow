/**
 * 工具API单测 - 字段格式验证
 * 测试动态杠杆滚仓计算器和其他工具的API响应格式
 */

const request = require('supertest');
const express = require('express');

// 模拟API路由
const app = express();
app.use(express.json());

// 模拟中间件
const mockAuth = (req, res, next) => {
  req.user = { id: 1, role: 'user' };
  next();
};

// 设置路由
app.post('/api/v1/tools/rolling-calculator', mockAuth, (req, res) => {
  const {
    initialPosition,
    currentPrice,
    targetPrice,
    leverageDecayRate = 0.1,
    riskTolerance = 0.02,
    maxLeverage = 10
  } = req.body;

  // 验证必填字段
  if (!initialPosition || !currentPrice || !targetPrice) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields',
      code: 'MISSING_FIELDS',
      details: {
        required: ['initialPosition', 'currentPrice', 'targetPrice'],
        provided: { initialPosition, currentPrice, targetPrice }
      },
      timestamp: new Date().toISOString()
    });
  }

  // 验证数值范围
  if (initialPosition <= 0 || currentPrice <= 0 || targetPrice <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Values must be positive',
      code: 'INVALID_VALUES',
      timestamp: new Date().toISOString()
    });
  }

  if (leverageDecayRate < 0 || leverageDecayRate > 1) {
    return res.status(400).json({
      success: false,
      error: 'Leverage decay rate must be between 0 and 1',
      code: 'INVALID_LEVERAGE_DECAY_RATE',
      timestamp: new Date().toISOString()
    });
  }

  // 计算滚仓参数
  const priceChange = (targetPrice - currentPrice) / currentPrice;
  const calculatedLeverage = Math.min(maxLeverage, Math.max(1, 1 + priceChange * 2));
  const riskLevel = Math.abs(priceChange) > 0.1 ? 'high' :
    Math.abs(priceChange) > 0.05 ? 'medium' : 'low';
  const recommendedAction = priceChange > 0.02 ? 'buy' :
    priceChange < -0.02 ? 'sell' : 'hold';

  const nextRollingPrice = targetPrice * (1 + (priceChange > 0 ? 0.02 : -0.02));
  const maxDrawdown = Math.abs(priceChange) * 1.5;
  const expectedReturn = Math.abs(priceChange) * 0.8;

  const result = {
    input: {
      initialPosition: parseFloat(initialPosition),
      currentPrice: parseFloat(currentPrice),
      targetPrice: parseFloat(targetPrice),
      leverageDecayRate: parseFloat(leverageDecayRate),
      riskTolerance: parseFloat(riskTolerance),
      maxLeverage: parseInt(maxLeverage)
    },
    calculation: {
      calculatedLeverage: parseFloat(calculatedLeverage.toFixed(2)),
      riskLevel: riskLevel,
      recommendedAction: recommendedAction,
      nextRollingPrice: parseFloat(nextRollingPrice.toFixed(8)),
      maxDrawdown: parseFloat(maxDrawdown.toFixed(4)),
      expectedReturn: parseFloat(expectedReturn.toFixed(4)),
      priceChange: parseFloat(priceChange.toFixed(4))
    },
    risk: {
      positionSize: parseFloat((initialPosition * currentPrice).toFixed(2)),
      potentialLoss: parseFloat((initialPosition * currentPrice * maxDrawdown).toFixed(2)),
      potentialProfit: parseFloat((initialPosition * currentPrice * expectedReturn).toFixed(2)),
      riskRewardRatio: parseFloat((expectedReturn / maxDrawdown).toFixed(2)),
      marginRequired: parseFloat((initialPosition * currentPrice / calculatedLeverage).toFixed(2))
    },
    rolling: {
      canRoll: Math.abs(priceChange) > 0.01,
      rollingThreshold: parseFloat((currentPrice * 0.01).toFixed(8)),
      nextRollingDistance: parseFloat(Math.abs(nextRollingPrice - currentPrice).toFixed(8)),
      rollingFrequency: Math.abs(priceChange) > 0.05 ? 'high' :
        Math.abs(priceChange) > 0.02 ? 'medium' : 'low'
    },
    timestamp: new Date().toISOString()
  };

  res.json({
    success: true,
    data: result,
    message: 'Rolling calculation completed successfully',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/v1/tools/health-check', mockAuth, (req, res) => {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: {
        status: 'up',
        response_time: 15.2,
        last_check: new Date().toISOString()
      },
      redis: {
        status: 'up',
        memory_usage: 45.6,
        last_check: new Date().toISOString()
      },
      binance_api: {
        status: 'up',
        response_time: 120.5,
        rate_limit_remaining: 1150,
        last_check: new Date().toISOString()
      },
      strategies: {
        v3: {
          status: 'running',
          last_execution: new Date().toISOString(),
          success_rate: 87.3
        },
        ict: {
          status: 'running',
          last_execution: new Date().toISOString(),
          success_rate: 82.1
        }
      }
    },
    system: {
      cpu_usage: 45.2,
      memory_usage: 62.1,
      disk_usage: 35.8,
      uptime: 86400
    }
  };

  res.json({
    success: true,
    data: healthCheck,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/v1/tools/symbols/validate', mockAuth, (req, res) => {
  const { symbol } = req.query;

  if (!symbol) {
    return res.status(400).json({
      success: false,
      error: 'Symbol parameter is required',
      code: 'MISSING_SYMBOL',
      timestamp: new Date().toISOString()
    });
  }

  // 模拟验证逻辑
  const isValid = /^[A-Z]{3,10}USDT$/.test(symbol);
  const isSupported = ['BTCUSDT', 'ETHUSDT', 'ONDOUSDT', 'MKRUSDT', 'PENDLEUSDT', 'MPLUSDT', 'LINKUSDT', 'LDOUSDT'].includes(symbol);

  const result = {
    symbol: symbol,
    isValid: isValid,
    isSupported: isSupported,
    validation: {
      format: isValid ? 'valid' : 'invalid',
      pattern: '^[A-Z]{3,10}USDT$',
      supported: isSupported
    },
    recommendations: isValid && !isSupported ? ['Symbol format is valid but not in supported list'] : [],
    timestamp: new Date().toISOString()
  };

  res.json({
    success: true,
    data: result,
    timestamp: new Date().toISOString()
  });
});

describe('工具API - 字段格式验证', () => {
  describe('POST /api/v1/tools/rolling-calculator', () => {
    it('应该返回滚仓计算的完整格式', async () => {
      const calculationData = {
        initialPosition: 0.1,
        currentPrice: 50000,
        targetPrice: 52000,
        leverageDecayRate: 0.1,
        riskTolerance: 0.02,
        maxLeverage: 10
      };

      const response = await request(app)
        .post('/api/v1/tools/rolling-calculator')
        .send(calculationData)
        .expect(200);

      // 验证响应结构
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');

      // 验证数据结构
      const result = response.body.data;
      expect(result).toHaveProperty('input');
      expect(result).toHaveProperty('calculation');
      expect(result).toHaveProperty('risk');
      expect(result).toHaveProperty('rolling');
      expect(result).toHaveProperty('timestamp');

      // 验证输入数据
      expect(result.input).toHaveProperty('initialPosition');
      expect(result.input).toHaveProperty('currentPrice');
      expect(result.input).toHaveProperty('targetPrice');
      expect(result.input).toHaveProperty('leverageDecayRate');
      expect(result.input).toHaveProperty('riskTolerance');
      expect(result.input).toHaveProperty('maxLeverage');

      // 验证计算结果
      expect(result.calculation).toHaveProperty('calculatedLeverage');
      expect(result.calculation).toHaveProperty('riskLevel');
      expect(result.calculation).toHaveProperty('recommendedAction');
      expect(result.calculation).toHaveProperty('nextRollingPrice');
      expect(result.calculation).toHaveProperty('maxDrawdown');
      expect(result.calculation).toHaveProperty('expectedReturn');
      expect(result.calculation).toHaveProperty('priceChange');

      // 验证风险数据
      expect(result.risk).toHaveProperty('positionSize');
      expect(result.risk).toHaveProperty('potentialLoss');
      expect(result.risk).toHaveProperty('potentialProfit');
      expect(result.risk).toHaveProperty('riskRewardRatio');
      expect(result.risk).toHaveProperty('marginRequired');

      // 验证滚仓数据
      expect(result.rolling).toHaveProperty('canRoll');
      expect(result.rolling).toHaveProperty('rollingThreshold');
      expect(result.rolling).toHaveProperty('nextRollingDistance');
      expect(result.rolling).toHaveProperty('rollingFrequency');

      // 验证字段类型
      expect(typeof result.input.initialPosition).toBe('number');
      expect(typeof result.input.currentPrice).toBe('number');
      expect(typeof result.input.targetPrice).toBe('number');
      expect(typeof result.calculation.calculatedLeverage).toBe('number');
      expect(typeof result.calculation.riskLevel).toBe('string');
      expect(typeof result.calculation.recommendedAction).toBe('string');
      expect(typeof result.risk.positionSize).toBe('number');
      expect(typeof result.risk.potentialLoss).toBe('number');
      expect(typeof result.risk.potentialProfit).toBe('number');
      expect(typeof result.rolling.canRoll).toBe('boolean');
    });

    it('应该返回400当缺少必填字段', async () => {
      const response = await request(app)
        .post('/api/v1/tools/rolling-calculator')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Missing required fields');
      expect(response.body.code).toBe('MISSING_FIELDS');
      expect(response.body.details).toHaveProperty('required');
      expect(response.body.details).toHaveProperty('provided');
    });

    it('应该返回400当数值为负数或零', async () => {
      const response = await request(app)
        .post('/api/v1/tools/rolling-calculator')
        .send({
          initialPosition: -0.1,
          currentPrice: 50000,
          targetPrice: 52000
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Values must be positive');
      expect(response.body.code).toBe('INVALID_VALUES');
    });

    it('应该返回400当杠杆衰减率无效', async () => {
      const response = await request(app)
        .post('/api/v1/tools/rolling-calculator')
        .send({
          initialPosition: 0.1,
          currentPrice: 50000,
          targetPrice: 52000,
          leverageDecayRate: 1.5
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Leverage decay rate must be between 0 and 1');
      expect(response.body.code).toBe('INVALID_LEVERAGE_DECAY_RATE');
    });
  });

  describe('GET /api/v1/tools/health-check', () => {
    it('应该返回健康检查的完整格式', async () => {
      const response = await request(app)
        .get('/api/v1/tools/health-check')
        .expect(200);

      // 验证响应结构
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('timestamp');

      // 验证健康检查数据
      const healthCheck = response.body.data;
      expect(healthCheck).toHaveProperty('status');
      expect(healthCheck).toHaveProperty('timestamp');
      expect(healthCheck).toHaveProperty('services');
      expect(healthCheck).toHaveProperty('system');

      // 验证服务状态
      expect(healthCheck.services).toHaveProperty('database');
      expect(healthCheck.services).toHaveProperty('redis');
      expect(healthCheck.services).toHaveProperty('binance_api');
      expect(healthCheck.services).toHaveProperty('strategies');

      // 验证数据库状态
      expect(healthCheck.services.database).toHaveProperty('status');
      expect(healthCheck.services.database).toHaveProperty('response_time');
      expect(healthCheck.services.database).toHaveProperty('last_check');

      // 验证Redis状态
      expect(healthCheck.services.redis).toHaveProperty('status');
      expect(healthCheck.services.redis).toHaveProperty('memory_usage');
      expect(healthCheck.services.redis).toHaveProperty('last_check');

      // 验证Binance API状态
      expect(healthCheck.services.binance_api).toHaveProperty('status');
      expect(healthCheck.services.binance_api).toHaveProperty('response_time');
      expect(healthCheck.services.binance_api).toHaveProperty('rate_limit_remaining');
      expect(healthCheck.services.binance_api).toHaveProperty('last_check');

      // 验证策略状态
      expect(healthCheck.services.strategies).toHaveProperty('v3');
      expect(healthCheck.services.strategies).toHaveProperty('ict');
      expect(healthCheck.services.strategies.v3).toHaveProperty('status');
      expect(healthCheck.services.strategies.v3).toHaveProperty('last_execution');
      expect(healthCheck.services.strategies.v3).toHaveProperty('success_rate');

      // 验证系统状态
      expect(healthCheck.system).toHaveProperty('cpu_usage');
      expect(healthCheck.system).toHaveProperty('memory_usage');
      expect(healthCheck.system).toHaveProperty('disk_usage');
      expect(healthCheck.system).toHaveProperty('uptime');

      // 验证字段类型
      expect(typeof healthCheck.status).toBe('string');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(healthCheck.status);
      expect(typeof healthCheck.services.database.status).toBe('string');
      expect(typeof healthCheck.services.database.response_time).toBe('number');
      expect(typeof healthCheck.services.redis.memory_usage).toBe('number');
      expect(typeof healthCheck.services.binance_api.rate_limit_remaining).toBe('number');
      expect(typeof healthCheck.system.cpu_usage).toBe('number');
      expect(typeof healthCheck.system.memory_usage).toBe('number');
      expect(typeof healthCheck.system.disk_usage).toBe('number');
      expect(typeof healthCheck.system.uptime).toBe('number');
    });
  });

  describe('GET /api/v1/tools/symbols/validate', () => {
    it('应该返回交易对验证的完整格式', async () => {
      const response = await request(app)
        .get('/api/v1/tools/symbols/validate?symbol=BTCUSDT')
        .expect(200);

      // 验证响应结构
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('timestamp');

      // 验证验证数据
      const validation = response.body.data;
      expect(validation).toHaveProperty('symbol', 'BTCUSDT');
      expect(validation).toHaveProperty('isValid');
      expect(validation).toHaveProperty('isSupported');
      expect(validation).toHaveProperty('validation');
      expect(validation).toHaveProperty('recommendations');
      expect(validation).toHaveProperty('timestamp');

      // 验证验证规则
      expect(validation.validation).toHaveProperty('format');
      expect(validation.validation).toHaveProperty('pattern');
      expect(validation.validation).toHaveProperty('supported');

      // 验证字段类型
      expect(typeof validation.symbol).toBe('string');
      expect(typeof validation.isValid).toBe('boolean');
      expect(typeof validation.isSupported).toBe('boolean');
      expect(typeof validation.validation.format).toBe('string');
      expect(typeof validation.validation.pattern).toBe('string');
      expect(typeof validation.validation.supported).toBe('boolean');
      expect(Array.isArray(validation.recommendations)).toBe(true);
    });

    it('应该返回400当缺少交易对参数', async () => {
      const response = await request(app)
        .get('/api/v1/tools/symbols/validate')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Symbol parameter is required');
      expect(response.body.code).toBe('MISSING_SYMBOL');
    });

    it('应该验证不支持的交易对', async () => {
      const response = await request(app)
        .get('/api/v1/tools/symbols/validate?symbol=INVALIDUSDT')
        .expect(200);

      expect(response.body.data.symbol).toBe('INVALIDUSDT');
      expect(response.body.data.isValid).toBe(true);
      expect(response.body.data.isSupported).toBe(false);
      expect(response.body.data.recommendations.length).toBeGreaterThan(0);
    });

    it('应该验证格式错误的交易对', async () => {
      const response = await request(app)
        .get('/api/v1/tools/symbols/validate?symbol=INVALID')
        .expect(200);

      expect(response.body.data.symbol).toBe('INVALID');
      expect(response.body.data.isValid).toBe(false);
      expect(response.body.data.isSupported).toBe(false);
    });
  });
});
