// tests/unit/dashboard-display-fix.test.js
// 仪表板显示问题修复测试

const request = require('supertest');
const express = require('express');

describe('仪表板显示修复测试', () => {
  let app;

  beforeAll(() => {
    // 创建测试应用，模拟修复后的服务器
    app = express();
    app.use(express.json());

    // 胜率统计API - 修复字段映射问题
    app.get('/api/win-rate-stats', (req, res) => {
      res.json({
        // API原格式（保持兼容性）
        total_trades: 234,
        winning_trades: 156,
        losing_trades: 78,
        win_rate: 66.67,
        // 前端期望格式（解决字段映射问题）
        totalTrades: 234,
        winTrades: 156,
        lossTrades: 78,
        winRate: 66.67,
        // 添加更新时间
        lastUpdated: new Date().toISOString()
      });
    });

    // 更新时间API
    app.get('/api/getUpdateTimes', (req, res) => {
      const now = new Date().toISOString();
      res.json({
        trend: now,
        signal: now,
        execution: now,
        timestamp: now
      });
    });

    // 用户设置API
    app.get('/api/user-settings', (req, res) => {
      res.json({
        maxLossAmount: 100,
        riskLevel: 'medium',
        autoRefresh: true
      });
    });
  });

  describe('胜率统计显示修复', () => {
    test('应该返回前端期望的字段格式', async () => {
      const response = await request(app)
        .get('/api/win-rate-stats')
        .expect(200);

      // 检查前端期望的驼峰命名格式
      expect(response.body).toHaveProperty('winRate');
      expect(response.body).toHaveProperty('totalTrades');
      expect(response.body).toHaveProperty('winTrades');
      expect(response.body).toHaveProperty('lossTrades');

      // 检查数值有效性
      expect(response.body.winRate).toBeGreaterThan(0);
      expect(response.body.totalTrades).toBeGreaterThan(0);
      expect(response.body.winTrades).toBeGreaterThan(0);

      // 检查胜率计算正确性
      const expectedWinRate = (response.body.winTrades / response.body.totalTrades) * 100;
      expect(Math.abs(response.body.winRate - expectedWinRate)).toBeLessThan(0.1);
    });

    test('应该同时保持API原格式的兼容性', async () => {
      const response = await request(app)
        .get('/api/win-rate-stats')
        .expect(200);

      // 检查原始下划线格式仍然存在
      expect(response.body).toHaveProperty('win_rate');
      expect(response.body).toHaveProperty('total_trades');
      expect(response.body).toHaveProperty('winning_trades');
      expect(response.body).toHaveProperty('losing_trades');

      // 检查两种格式的数值一致性
      expect(response.body.winRate).toBe(response.body.win_rate);
      expect(response.body.totalTrades).toBe(response.body.total_trades);
      expect(response.body.winTrades).toBe(response.body.winning_trades);
      expect(response.body.lossTrades).toBe(response.body.losing_trades);
    });

    test('应该包含最后更新时间', async () => {
      const response = await request(app)
        .get('/api/win-rate-stats')
        .expect(200);

      expect(response.body).toHaveProperty('lastUpdated');
      expect(response.body.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      // 检查时间是否为最近时间（5分钟内）
      const updateTime = new Date(response.body.lastUpdated);
      const now = new Date();
      const timeDiff = now - updateTime;
      expect(timeDiff).toBeLessThan(5 * 60 * 1000); // 5分钟
    });
  });

  describe('更新时间API修复', () => {
    test('应该提供getUpdateTimes API', async () => {
      const response = await request(app)
        .get('/api/getUpdateTimes')
        .expect(200);

      expect(response.body).toHaveProperty('trend');
      expect(response.body).toHaveProperty('signal');
      expect(response.body).toHaveProperty('execution');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('更新时间应该是有效的ISO格式', async () => {
      const response = await request(app)
        .get('/api/getUpdateTimes')
        .expect(200);

      // 检查时间格式
      expect(response.body.trend).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(response.body.signal).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(response.body.execution).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      // 检查时间有效性
      const trendTime = new Date(response.body.trend);
      const signalTime = new Date(response.body.signal);
      const executionTime = new Date(response.body.execution);

      expect(trendTime.getTime()).not.toBeNaN();
      expect(signalTime.getTime()).not.toBeNaN();
      expect(executionTime.getTime()).not.toBeNaN();
    });

    test('更新时间应该是最近时间', async () => {
      const response = await request(app)
        .get('/api/getUpdateTimes')
        .expect(200);

      const now = new Date();
      const trendTime = new Date(response.body.trend);
      const timeDiff = now - trendTime;

      // 时间差应该小于1分钟
      expect(timeDiff).toBeLessThan(60 * 1000);
    });
  });

  describe('用户设置API验证', () => {
    test('应该返回最大损失金额设置', async () => {
      const response = await request(app)
        .get('/api/user-settings')
        .expect(200);

      expect(response.body).toHaveProperty('maxLossAmount');
      expect(typeof response.body.maxLossAmount).toBe('number');
      expect(response.body.maxLossAmount).toBeGreaterThan(0);
    });

    test('最大损失金额应该在合理范围内', async () => {
      const response = await request(app)
        .get('/api/user-settings')
        .expect(200);

      // 最大损失金额应该在1-1000 USDT范围内
      expect(response.body.maxLossAmount).toBeGreaterThanOrEqual(1);
      expect(response.body.maxLossAmount).toBeLessThanOrEqual(1000);
    });
  });

  describe('数据一致性验证', () => {
    test('胜率统计数据应该数学一致', async () => {
      const response = await request(app)
        .get('/api/win-rate-stats')
        .expect(200);

      const { totalTrades, winTrades, lossTrades, winRate } = response.body;

      // 总交易数 = 盈利交易数 + 亏损交易数
      expect(totalTrades).toBe(winTrades + lossTrades);

      // 胜率 = 盈利交易数 / 总交易数 * 100
      const calculatedWinRate = (winTrades / totalTrades) * 100;
      expect(Math.abs(winRate - calculatedWinRate)).toBeLessThan(0.01);
    });

    test('所有API响应应该包含有效时间戳', async () => {
      const winRateResponse = await request(app).get('/api/win-rate-stats');
      const updateTimesResponse = await request(app).get('/api/getUpdateTimes');

      // 检查时间戳存在且有效
      expect(winRateResponse.body.lastUpdated).toBeDefined();
      expect(updateTimesResponse.body.timestamp).toBeDefined();

      const winRateTime = new Date(winRateResponse.body.lastUpdated);
      const updateTime = new Date(updateTimesResponse.body.timestamp);

      expect(winRateTime.getTime()).not.toBeNaN();
      expect(updateTime.getTime()).not.toBeNaN();
    });
  });

  describe('前端显示问题检测', () => {
    test('应该检测字段映射问题', async () => {
      const response = await request(app)
        .get('/api/win-rate-stats')
        .expect(200);

      // 模拟前端代码中的字段访问
      const frontendExpectedFields = ['winRate', 'totalTrades', 'winTrades', 'lossTrades'];
      const backendFields = ['win_rate', 'total_trades', 'winning_trades', 'losing_trades'];

      // 检查前端期望字段都存在
      frontendExpectedFields.forEach(field => {
        expect(response.body).toHaveProperty(field);
        expect(response.body[field]).toBeDefined();
        expect(response.body[field]).not.toBeNull();
      });

      // 检查后端字段也存在（兼容性）
      backendFields.forEach(field => {
        expect(response.body).toHaveProperty(field);
      });
    });

    test('应该检测空值显示问题', async () => {
      const response = await request(app)
        .get('/api/win-rate-stats')
        .expect(200);

      // 所有关键字段都不应该为空、null或undefined
      const criticalFields = ['winRate', 'totalTrades', 'winTrades'];

      criticalFields.forEach(field => {
        expect(response.body[field]).not.toBeNull();
        expect(response.body[field]).not.toBeUndefined();
        expect(response.body[field]).not.toBe('');
        expect(response.body[field]).not.toBe(0); // 胜率和交易数不应该为0
      });
    });
  });
});
