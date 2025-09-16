// ict-api-integration.test.js - ICT API集成测试

const request = require('supertest');
const express = require('express');
const path = require('path');

// Mock external dependencies
jest.mock('../../src/core/modules/api/BinanceAPI');
jest.mock('../../src/core/modules/monitoring/DataMonitor');

const BinanceAPI = require('../../src/core/modules/api/BinanceAPI');
const { DataMonitor } = require('../../src/core/modules/monitoring/DataMonitor');

// 创建测试应用
async function createTestApp() {
  const app = express();
  app.use(express.json());

  // 模拟数据库
  const Database = require('sqlite3').Database;
  const db = new Database(':memory:');

  // 设置基础表结构
  await new Promise((resolve, reject) => {
    setupTestDatabase(db);
    resolve();
  });

  // 模拟数据管理器
  const mockDataManager = {
    getData: jest.fn(),
    updateData: jest.fn()
  };

  const mockDeltaManager = {
    getDeltaData: jest.fn().mockReturnValue({
      delta: 1000,
      oi: 50000,
      fundingRate: 0.0001
    })
  };

  // Mock BinanceAPI
  BinanceAPI.getKlines = jest.fn();

  // Mock DataMonitor
  DataMonitor.mockImplementation(() => ({
    startAnalysis: jest.fn(),
    recordAnalysisLog: jest.fn()
  }));

  // 导入ICT策略
  const ICTStrategy = require('../../src/core/modules/strategy/ict-trading/ICTStrategy');
  const ICTDatabaseManager = require('../../src/core/modules/database/ICTDatabaseManager');
  const ICTMigration = require('../../src/core/modules/database/ICTMigration');

  // 初始化ICT组件
  const ictDatabaseManager = new ICTDatabaseManager(db);
  const ictMigration = new ICTMigration(db);

  // 设置ICT API路由
  app.get('/api/ict/signals', async (req, res) => {
    try {
      const symbols = await db.prepare('SELECT symbol FROM custom_symbols').all();
      const signals = [];
      const maxLossAmount = 100;

      for (const symbolRow of symbols) {
        const symbol = symbolRow.symbol;
        try {
          const analysis = await ICTStrategy.analyzeSymbol(symbol, {
            database: db,
            maxLossAmount: parseFloat(maxLossAmount),
            equity: 10000,
            riskPct: 0.01,
            RR: 3
          });

          if (ictDatabaseManager) {
            await ictDatabaseManager.recordICTAnalysis(analysis);
          }

          let category = 'smallcap';
          try {
            const categoryResult = await db.prepare('SELECT category FROM symbol_categories WHERE symbol = ?').get(symbol);
            if (categoryResult && categoryResult.category) {
              category = categoryResult.category;
            }
          } catch (error) {
            console.warn(`获取 ${symbol} 分类失败:`, error.message);
          }

          signals.push({
            symbol,
            category,
            dailyTrend: analysis.dailyTrend,
            dailyTrendScore: analysis.dailyTrendScore,
            signalType: analysis.signalType,
            signalStrength: analysis.signalStrength,
            executionMode: analysis.executionMode,
            obDetected: analysis.mtfResult?.obDetected || false,
            fvgDetected: analysis.mtfResult?.fvgDetected || false,
            sweepHTF: analysis.mtfResult?.sweepHTF || false,
            engulfingDetected: analysis.ltfResult?.engulfing?.detected || false,
            sweepLTF: analysis.ltfResult?.sweepLTF?.detected || false,
            volumeConfirm: analysis.ltfResult?.volumeConfirm || false,
            entryPrice: analysis.riskManagement?.entry || 0,
            stopLoss: analysis.riskManagement?.stopLoss || 0,
            takeProfit: analysis.riskManagement?.takeProfit || 0,
            riskRewardRatio: analysis.riskManagement?.riskRewardRatio || 0,
            leverage: analysis.riskManagement?.leverage || 1,
            atr4h: analysis.mtfResult?.atr4h || 0,
            atr15m: analysis.ltfResult?.atr15 || 0,
            dataCollectionRate: analysis.dataCollectionRate,
            strategyVersion: 'ICT',
            timestamp: analysis.timestamp,
            errorMessage: analysis.errorMessage
          });
        } catch (error) {
          console.error(`ICT分析 ${symbol} 失败:`, error);
        }
      }
      res.json(signals);
    } catch (error) {
      console.error('获取ICT信号失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/ict/refresh-all', async (req, res) => {
    try {
      const symbols = await db.prepare('SELECT symbol FROM custom_symbols').all();
      const maxLossAmount = 100;

      for (const symbolRow of symbols) {
        const symbol = symbolRow.symbol;
        try {
          const analysis = await ICTStrategy.analyzeSymbol(symbol, {
            database: db,
            maxLossAmount: parseFloat(maxLossAmount),
            equity: 10000,
            riskPct: 0.01,
            RR: 3
          });
          if (ictDatabaseManager) {
            await ictDatabaseManager.recordICTAnalysis(analysis);
          }
        } catch (error) {
          console.error(`刷新ICT ${symbol} 失败:`, error);
        }
      }
      res.json({ success: true, message: 'ICT策略信号已刷新' });
    } catch (error) {
      console.error('刷新ICT信号失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/ict/simulation', async (req, res) => {
    try {
      const { symbol, entryPrice, stopLoss, takeProfit, signalType, executionMode } = req.body;
      if (!symbol || !entryPrice || !stopLoss || !takeProfit || !signalType) {
        return res.status(400).json({ error: '缺少必要参数' });
      }

      const ICTExecution = require('../../src/core/modules/strategy/ict-trading/ICTExecution');
      const simulationData = ICTExecution.createSimulationRecord({
        symbol,
        entryPrice,
        stopLoss,
        takeProfit,
        signalType,
        executionMode: executionMode || 'ICT_SIGNAL'
      }, {
        maxLossAmount: 100
      });

      const simulation = await ictDatabaseManager.createICTSimulation(simulationData);
      res.json({ success: true, simulation });
    } catch (error) {
      console.error('创建ICT模拟交易失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/ict/simulation/history', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const history = await ictDatabaseManager.getICTSimulationHistory(limit);
      res.json(history);
    } catch (error) {
      console.error('获取ICT模拟交易历史失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/ict/analysis/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const analysis = await ictDatabaseManager.getLatestICTAnalysis(symbol);
      if (analysis) {
        res.json(analysis);
      } else {
        res.status(404).json({ error: '未找到ICT分析数据' });
      }
    } catch (error) {
      console.error(`获取ICT分析历史失败 [${req.params.symbol}]:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/ict/stats', async (req, res) => {
    try {
      const stats = await ictMigration.getICTStats();
      res.json(stats);
    } catch (error) {
      console.error('获取ICT统计信息失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/ict/cleanup-test-data', async (req, res) => {
    try {
      await ictMigration.cleanupTestData();
      res.json({ success: true, message: 'ICT测试数据清理完成' });
    } catch (error) {
      console.error('清理ICT测试数据失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return { app, db, ictDatabaseManager, ictMigration };
}

describe('ICT API集成测试', () => {
  let app, db, ictDatabaseManager, ictMigration;

  beforeEach(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    db = testApp.db;
    ictDatabaseManager = testApp.ictDatabaseManager;
    ictMigration = testApp.ictMigration;

    // 执行数据库迁移
    await ictMigration.migrate();
    await ictDatabaseManager.initICTTables();
  });

  afterEach(() => {
    db.close();
    jest.clearAllMocks();
  });

  describe('GET /api/ict/signals', () => {
    test('应该返回ICT信号列表', async () => {
      // Mock 数据响应
      BinanceAPI.getKlines
        .mockResolvedValueOnce([
          [1640995200000, '50000', '51000', '49000', '50500', '1000', 1640995259999, '5000', 100, '0', '0', '0']
        ])
        .mockResolvedValueOnce([
          [1640995200000, '50000', '52000', '49000', '51000', '1000', 1640995259999, '5000', 100, '0', '0', '0']
        ])
        .mockResolvedValueOnce([
          [1640995200000, '50000', '51000', '49000', '50500', '1000', 1640995259999, '5000', 100, '0', '0', '0']
        ]);

      const response = await request(app)
        .get('/api/ict/signals')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      const signal = response.body[0];
      expect(signal).toHaveProperty('symbol');
      expect(signal).toHaveProperty('signalType');
      expect(signal).toHaveProperty('strategyVersion', 'ICT');
    });

    test('应该处理API错误', async () => {
      BinanceAPI.getKlines.mockRejectedValue(new Error('API Error'));

      const response = await request(app)
        .get('/api/ict/signals')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // 即使有错误，也应该返回空数组而不是崩溃
    });
  });

  describe('POST /api/ict/refresh-all', () => {
    test('应该刷新所有ICT信号', async () => {
      BinanceAPI.getKlines
        .mockResolvedValue([
          [1640995200000, '50000', '51000', '49000', '50500', '1000', 1640995259999, '5000', 100, '0', '0', '0']
        ]);

      const response = await request(app)
        .post('/api/ict/refresh-all')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('ICT策略信号已刷新');
    });
  });

  describe('POST /api/ict/simulation', () => {
    test('应该创建ICT模拟交易', async () => {
      const simulationData = {
        symbol: 'BTCUSDT',
        entryPrice: 50000,
        stopLoss: 49000,
        takeProfit: 53000,
        signalType: 'LONG',
        executionMode: 'OB_ENGULFING'
      };

      const response = await request(app)
        .post('/api/ict/simulation')
        .send(simulationData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.simulation).toBeDefined();
      expect(response.body.simulation.symbol).toBe('BTCUSDT');
    });

    test('应该验证必要参数', async () => {
      const response = await request(app)
        .post('/api/ict/simulation')
        .send({
          symbol: 'BTCUSDT',
          entryPrice: 50000
          // 缺少其他必要参数
        })
        .expect(400);

      expect(response.body.error).toBe('缺少必要参数');
    });
  });

  describe('GET /api/ict/simulation/history', () => {
    test('应该返回模拟交易历史', async () => {
      // 先创建一个模拟交易
      const simulationData = {
        symbol: 'BTCUSDT',
        entry_price: 50000,
        stop_loss_price: 49000,
        take_profit_price: 53000,
        max_leverage: 10,
        min_margin: 1000,
        position_size: 10000,
        risk_reward_ratio: 3,
        trigger_reason: 'ICT_SIGNAL',
        signal_type: 'LONG',
        execution_mode: 'OB_ENGULFING',
        status: 'ACTIVE'
      };

      await ictDatabaseManager.createICTSimulation(simulationData);

      const response = await request(app)
        .get('/api/ict/simulation/history')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].symbol).toBe('BTCUSDT');
    });

    test('应该支持limit参数', async () => {
      const response = await request(app)
        .get('/api/ict/simulation/history?limit=10')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/ict/analysis/:symbol', () => {
    test('应该返回指定交易对的分析历史', async () => {
      // 先创建一个分析记录
      const analysis = {
        symbol: 'BTCUSDT',
        daily_trend: 'up',
        daily_trend_score: 3,
        mtf_result: JSON.stringify({
          obDetected: true,
          fvgDetected: false,
          ob: { high: 52000, low: 50000, height: 2000, ageDays: 1 },
          atr4h: 1000
        }),
        ltf_result: JSON.stringify({
          engulfing: { detected: true, bodyRatio: 2.0 },
          sweepLTF: { detected: true, speed: 100 },
          volumeConfirm: true,
          atr15: 500
        }),
        risk_management: JSON.stringify({
          entry: 51000,
          stopLoss: 50000,
          takeProfit: 54000,
          riskRewardRatio: 3,
          leverage: 10,
          margin: 1000
        }),
        signal_type: 'LONG',
        signal_strength: 'STRONG',
        execution_mode: 'OB_ENGULFING',
        data_collection_rate: 100,
        timestamp: new Date().toISOString(),
        strategy_version: 'ICT',
        data_valid: true
      };

      await ictDatabaseManager.recordICTAnalysis(analysis);

      const response = await request(app)
        .get('/api/ict/analysis/BTCUSDT')
        .expect(200);

      expect(response.body.symbol).toBe('BTCUSDT');
      expect(response.body.signal_type).toBe('LONG');
    });

    test('应该处理不存在的交易对', async () => {
      const response = await request(app)
        .get('/api/ict/analysis/NONEXISTENT')
        .expect(404);

      expect(response.body.error).toBe('未找到ICT分析数据');
    });
  });

  describe('GET /api/ict/stats', () => {
    test('应该返回ICT统计信息', async () => {
      const response = await request(app)
        .get('/api/ict/stats')
        .expect(200);

      expect(response.body).toHaveProperty('totalAnalysis');
      expect(response.body).toHaveProperty('totalSimulations');
      expect(response.body).toHaveProperty('signalDistribution');
    });
  });

  describe('POST /api/ict/cleanup-test-data', () => {
    test('应该清理测试数据', async () => {
      const response = await request(app)
        .post('/api/ict/cleanup-test-data')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('ICT测试数据清理完成');
    });
  });
});

// 辅助函数：设置测试数据库
function setupTestDatabase(db) {
  const createTables = [
    `CREATE TABLE IF NOT EXISTS user_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS custom_symbols (
      symbol TEXT PRIMARY KEY
    )`,
    `CREATE TABLE IF NOT EXISTS symbol_categories (
      symbol TEXT PRIMARY KEY,
      category TEXT
    )`,
    // ICT相关表
    `CREATE TABLE IF NOT EXISTS ict_strategy_analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      daily_trend TEXT,
      daily_trend_score INTEGER,
      mtf_ob_detected BOOLEAN DEFAULT FALSE,
      mtf_fvg_detected BOOLEAN DEFAULT FALSE,
      ob_height REAL,
      ob_age_days REAL,
      ob_high REAL,
      ob_low REAL,
      ob_time DATETIME,
      fvg_high REAL,
      fvg_low REAL,
      fvg_time DATETIME,
      fvg_type TEXT,
      sweep_htf_detected BOOLEAN DEFAULT FALSE,
      sweep_htf_speed REAL,
      ltf_ob_age_hours REAL,
      engulfing_detected BOOLEAN DEFAULT FALSE,
      engulfing_body_ratio REAL,
      sweep_ltf_detected BOOLEAN DEFAULT FALSE,
      sweep_ltf_speed REAL,
      volume_confirmation BOOLEAN DEFAULT FALSE,
      entry_price REAL,
      stop_loss REAL,
      take_profit REAL,
      risk_reward_ratio REAL,
      position_size REAL,
      max_leverage INTEGER,
      min_margin REAL,
      stop_distance_percent REAL,
      atr_4h REAL,
      atr_15m REAL,
      signal_type TEXT,
      signal_strength TEXT,
      execution_mode TEXT,
      data_collection_rate REAL,
      error_message TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS ict_simulations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      entry_price REAL,
      stop_loss REAL,
      take_profit REAL,
      status TEXT DEFAULT 'ACTIVE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS ict_data_refresh_status (
      symbol TEXT NOT NULL,
      data_type TEXT NOT NULL,
      last_refresh DATETIME,
      next_refresh DATETIME,
      should_refresh BOOLEAN DEFAULT TRUE,
      refresh_interval INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(symbol, data_type)
    )`,
    `CREATE TABLE IF NOT EXISTS ict_signal_types (
      id INTEGER PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS ict_execution_modes (
      id INTEGER PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS ict_trend_types (
      id INTEGER PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT
    )`
  ];

  for (const sql of createTables) {
    db.exec(sql);
  }

  db.exec(`
    INSERT OR IGNORE INTO custom_symbols (symbol) VALUES 
    ('BTCUSDT'), ('ETHUSDT'), ('BNBUSDT'), ('ADAUSDT'), ('SOLUSDT')
  `);

  db.exec(`
    INSERT OR IGNORE INTO symbol_categories (symbol, category) VALUES 
    ('BTCUSDT', 'mainstream'),
    ('ETHUSDT', 'mainstream'),
    ('BNBUSDT', 'mainstream'),
    ('ADAUSDT', 'highcap'),
    ('SOLUSDT', 'highcap')
  `);
}
