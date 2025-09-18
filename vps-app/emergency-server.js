#!/usr/bin/env node

/**
 * 应急服务器 - 解决502错误
 * 简化版本，确保基本功能可用
 */

const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 8080;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'src/web/public')));

// 基本路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/web/public/index.html'));
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: '应急服务器运行正常'
  });
});

// 模拟数据API
app.get('/api/signals', (req, res) => {
  res.json([
    {
      symbol: 'BTCUSDT',
      trend4h: '多头趋势',
      marketType: '趋势市',
      score: 4,
      direction: 'BULL',
      score1h: 4,
      vwapDirectionConsistent: true,
      factors: {
        oi: true,
        funding: true,
        breakout: true,
        volume: true,
        delta: true
      },
      execution: '做多_多头回踩突破',
      executionMode: '多头回踩突破',
      entrySignal: 45000.0,
      stopLoss: 44000.0,
      takeProfit: 47000.0,
      currentPrice: 45000.0,
      dataCollectionRate: 95.5,
      strategyVersion: 'V3',
      timestamp: new Date().toISOString()
    },
    {
      symbol: 'ETHUSDT',
      trend4h: '空头趋势',
      marketType: '趋势市',
      score: 3,
      direction: 'BEAR',
      score1h: 3,
      vwapDirectionConsistent: true,
      factors: {
        oi: true,
        funding: false,
        breakout: true,
        volume: true,
        delta: false
      },
      execution: '做空_空头反抽破位',
      executionMode: '空头反抽破位',
      entrySignal: 3000.0,
      stopLoss: 3100.0,
      takeProfit: 2800.0,
      currentPrice: 3000.0,
      dataCollectionRate: 92.3,
      strategyVersion: 'V3',
      timestamp: new Date().toISOString()
    }
  ]);
});

app.get('/api/symbols', (req, res) => {
  res.json([
    { symbol: 'BTCUSDT' },
    { symbol: 'ETHUSDT' },
    { symbol: 'LINKUSDT' },
    { symbol: 'LDOUSDT' }
  ]);
});

app.get('/api/simulation-history', (req, res) => {
  res.json([
    {
      id: 1,
      symbol: 'BTCUSDT',
      entry_price: 45000.0,
      stop_loss_price: 44000.0,
      take_profit_price: 47000.0,
      max_leverage: 20,
      min_margin: 100.0,
      direction: 'LONG',
      status: 'CLOSED',
      trigger_reason: 'SIGNAL_多头回踩突破',
      created_at: new Date().toISOString(),
      closed_at: new Date(Date.now() - 3600000).toISOString(),
      exit_price: 47000.0,
      exit_reason: '止盈触发',
      is_win: true,
      profit_loss: 2000.0
    }
  ]);
});

app.get('/api/monitoring-dashboard', (req, res) => {
  res.json({
    summary: {
      totalSymbols: 4,
      healthySymbols: 3,
      warningSymbols: 1,
      errorSymbols: 0,
      totalErrors: 0,
      overallHealth: 'HEALTHY',
      completionRates: {
        dataCollection: 95.5,
        signalAnalysis: 100.0,
        simulationTrading: 100.0
      }
    },
    detailedStats: [
      {
        symbol: 'BTCUSDT',
        dataCollection: {
          rate: 95.5,
          attempts: 100,
          successes: 95,
          lastTime: Date.now()
        },
        signalAnalysis: {
          rate: 100.0,
          attempts: 100,
          successes: 100,
          lastTime: Date.now()
        },
        simulationCompletion: {
          rate: 100.0,
          triggers: 10,
          completions: 10
        }
      }
    ],
    recentLogs: [],
    dataValidation: {
      errors: [],
      errorCount: 0,
      hasErrors: false
    }
  });
});

// 启动服务器
app.listen(port, () => {
  console.log(`🚀 应急服务器运行在 http://localhost:${port}`);
  console.log(`📁 静态文件目录: ${path.join(__dirname, 'src/web/public')}`);
  console.log(`⏰ 启动时间: ${new Date().toISOString()}`);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n🛑 收到SIGINT信号，正在关闭应急服务器...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 收到SIGTERM信号，正在关闭应急服务器...');
  process.exit(0);
});
