/**
 * 真实策略生产服务器
 * 集成V3和ICT策略的真实分析逻辑
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const RealStrategyAPI = require('./src/api/RealStrategyAPI');

const app = express();
const port = process.env.PORT || 8080;

// 数据库连接
const dbPath = path.join(__dirname, 'smartflow.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('✅ 数据库连接成功');
  }
});

// 初始化真实策略API
const realStrategyAPI = new RealStrategyAPI(dbPath);

// 中间件设置
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'src/web/public')));

// 数据库迁移：创建真实策略所需的表
async function initRealStrategyTables() {
  try {
    console.log('🔄 初始化真实策略数据库表...');
    
    // 执行数据库迁移脚本
    const fs = require('fs');
    const migrationSQL = fs.readFileSync(path.join(__dirname, 'database-migration-real-strategy.sql'), 'utf8');
    
    await new Promise((resolve, reject) => {
      db.exec(migrationSQL, (err) => {
        if (err) {
          console.error('❌ 数据库迁移失败:', err.message);
          reject(err);
        } else {
          console.log('✅ 数据库迁移完成');
          resolve();
        }
      });
    });
    
    // 初始化真实策略API
    await realStrategyAPI.init();
    console.log('✅ 真实策略API初始化完成');
    
  } catch (error) {
    console.error('❌ 初始化真实策略表失败:', error.message);
  }
}

// 执行数据库初始化
initRealStrategyTables();

// ==================== 真实策略API接口 ====================

/**
 * 获取V3策略分析结果
 */
app.get('/api/v3/analysis/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    
    const result = await realStrategyAPI.getV3Analysis(symbol, limit);
    res.json(result);
    
  } catch (error) {
    console.error('❌ 获取V3分析结果失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      data: null
    });
  }
});

/**
 * 获取ICT策略分析结果
 */
app.get('/api/ict/analysis/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    
    const result = await realStrategyAPI.getICTAnalysis(symbol, limit);
    res.json(result);
    
  } catch (error) {
    console.error('❌ 获取ICT分析结果失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      data: null
    });
  }
});

/**
 * 获取所有V3策略信号（兼容现有前端）
 */
app.get('/api/signals', async (req, res) => {
  try {
    const result = await realStrategyAPI.getAllV3Signals();
    
    // 转换为前端期望的格式
    const signals = result.data.map(signal => ({
      symbol: signal.symbol,
      signal: signal.signal,
      signal_strength: signal.signal_strength,
      trend4h: signal.trend4h,
      score4h: signal.score4h,
      score1h: signal.score1h,
      execution: signal.execution,
      entrySignal: signal.entrySignal,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
      currentPrice: signal.currentPrice,
      timestamp: signal.timestamp
    }));
    
    res.json({
      success: true,
      data: signals,
      count: signals.length
    });
    
  } catch (error) {
    console.error('❌ 获取V3信号失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      data: []
    });
  }
});

/**
 * 获取所有ICT策略信号（兼容现有前端）
 */
app.get('/api/ict/signals', async (req, res) => {
  try {
    const result = await realStrategyAPI.getAllICTSignals();
    
    // 转换为前端期望的格式
    const signals = result.data.map(signal => ({
      symbol: signal.symbol,
      signalType: signal.signalType,
      signal_strength: signal.signal_strength,
      dailyTrend: signal.dailyTrend,
      obDetected: signal.obDetected,
      sweepHTF: signal.sweepHTF,
      sweepLTF: signal.sweepLTF,
      engulfingDetected: signal.engulfingDetected,
      entrySignal: signal.entrySignal,
      entryPrice: signal.entryPrice,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
      currentPrice: signal.currentPrice,
      atr4h: signal.atr4h,
      atr15m: signal.atr15m,
      timestamp: signal.timestamp
    }));
    
    res.json({
      success: true,
      data: signals,
      count: signals.length
    });
    
  } catch (error) {
    console.error('❌ 获取ICT信号失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      data: []
    });
  }
});

/**
 * 触发实时策略分析
 */
app.post('/api/strategy/analyze', async (req, res) => {
  try {
    const { symbol } = req.body;
    
    const result = await realStrategyAPI.triggerAnalysis(symbol);
    res.json(result);
    
  } catch (error) {
    console.error('❌ 触发策略分析失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      message: '策略分析失败'
    });
  }
});

/**
 * 获取策略统计信息
 */
app.get('/api/strategy/stats', async (req, res) => {
  try {
    const result = await realStrategyAPI.getStrategyStats();
    res.json(result);
    
  } catch (error) {
    console.error('❌ 获取策略统计失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      data: null
    });
  }
});

// ==================== 兼容现有API接口 ====================

/**
 * 获取模拟交易历史（兼容现有接口）
 */
app.get('/api/unified-simulations/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    
    // 从现有simulations表获取数据
    const sql = `
      SELECT 
        id, symbol, strategy_type, direction, entry_price, stop_loss_price, take_profit_price,
        max_leverage, min_margin, stop_loss_distance, atr_value, trigger_reason, execution_mode,
        status, exit_price, exit_reason, profit_loss, is_win, created_at, closed_at
      FROM simulations 
      ORDER BY created_at DESC 
      LIMIT ?
    `;
    
    db.all(sql, [limit], (err, rows) => {
      if (err) {
        console.error('❌ 查询模拟交易历史失败:', err.message);
        res.status(500).json({
          success: false,
          error: err.message,
          data: { simulations: [] }
        });
        return;
      }
      
      const simulations = rows.map(row => ({
        id: row.id,
        symbol: row.symbol,
        strategyType: row.strategy_type || 'V3',
        direction: row.direction,
        entryPrice: row.entry_price,
        stopLossPrice: row.stop_loss_price,
        takeProfitPrice: row.take_profit_price,
        maxLeverage: row.max_leverage,
        minMargin: row.min_margin,
        stopLossDistance: row.stop_loss_distance,
        atrValue: row.atr_value,
        triggerReason: row.trigger_reason,
        executionMode: row.execution_mode,
        status: row.status,
        exitPrice: row.exit_price,
        exitReason: row.exit_reason,
        profitLoss: row.profit_loss,
        isWin: row.is_win,
        createdAt: row.created_at,
        closedAt: row.closed_at
      }));
      
      res.json({
        success: true,
        data: { simulations },
        count: simulations.length
      });
    });
    
  } catch (error) {
    console.error('❌ 获取模拟交易历史失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      data: { simulations: [] }
    });
  }
});

/**
 * 获取胜率统计（兼容现有接口）
 */
app.get('/api/win-rate-stats', async (req, res) => {
  try {
    // 整体胜率统计
    const overallSql = `
      SELECT 
        COUNT(*) as totalTrades,
        SUM(CASE WHEN is_win = 1 THEN 1 ELSE 0 END) as winningTrades,
        SUM(CASE WHEN is_win = 0 THEN 1 ELSE 0 END) as losingTrades,
        AVG(CASE WHEN is_win = 1 THEN profit_loss ELSE 0 END) as avgWin,
        AVG(CASE WHEN is_win = 0 THEN profit_loss ELSE 0 END) as avgLoss,
        SUM(profit_loss) as netProfit
      FROM simulations 
      WHERE status = 'CLOSED'
    `;
    
    db.get(overallSql, [], (err, overallRow) => {
      if (err) {
        console.error('❌ 查询胜率统计失败:', err.message);
        res.status(500).json({
          success: false,
          error: err.message,
          data: null
        });
        return;
      }
      
      const overall = {
        totalTrades: overallRow.totalTrades || 0,
        winningTrades: overallRow.winningTrades || 0,
        losingTrades: overallRow.losingTrades || 0,
        winRate: overallRow.totalTrades > 0 ? (overallRow.winningTrades / overallRow.totalTrades * 100) : 0,
        avgWin: overallRow.avgWin || 0,
        avgLoss: overallRow.avgLoss || 0,
        netProfit: overallRow.netProfit || 0
      };
      
      // 按策略类型统计
      const byStrategySql = `
        SELECT 
          strategy_type,
          COUNT(*) as totalTrades,
          SUM(CASE WHEN is_win = 1 THEN 1 ELSE 0 END) as winningTrades,
          SUM(CASE WHEN is_win = 0 THEN 1 ELSE 0 END) as losingTrades,
          AVG(CASE WHEN is_win = 1 THEN profit_loss ELSE 0 END) as avgWin,
          AVG(CASE WHEN is_win = 0 THEN profit_loss ELSE 0 END) as avgLoss,
          SUM(profit_loss) as netProfit
        FROM simulations 
        WHERE status = 'CLOSED'
        GROUP BY strategy_type
      `;
      
      db.all(byStrategySql, [], (err, byStrategyRows) => {
        if (err) {
          console.error('❌ 查询按策略胜率统计失败:', err.message);
          // 返回整体统计
          res.json({
            success: true,
            data: {
              overall,
              byStrategy: {
                V3: overall,
                ICT: { totalTrades: 0, winningTrades: 0, losingTrades: 0, winRate: 0, avgWin: 0, avgLoss: 0, netProfit: 0 }
              }
            }
          });
          return;
        }
        
        const byStrategy = {
          V3: { totalTrades: 0, winningTrades: 0, losingTrades: 0, winRate: 0, avgWin: 0, avgLoss: 0, netProfit: 0 },
          ICT: { totalTrades: 0, winningTrades: 0, losingTrades: 0, winRate: 0, avgWin: 0, avgLoss: 0, netProfit: 0 }
        };
        
        byStrategyRows.forEach(row => {
          const strategyType = row.strategy_type || 'V3';
          byStrategy[strategyType] = {
            totalTrades: row.totalTrades || 0,
            winningTrades: row.winningTrades || 0,
            losingTrades: row.losingTrades || 0,
            winRate: row.totalTrades > 0 ? (row.winningTrades / row.totalTrades * 100) : 0,
            avgWin: row.avgWin || 0,
            avgLoss: row.avgLoss || 0,
            netProfit: row.netProfit || 0
          };
        });
        
        res.json({
          success: true,
          data: {
            overall,
            byStrategy
          }
        });
      });
    });
    
  } catch (error) {
    console.error('❌ 获取胜率统计失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      data: null
    });
  }
});

/**
 * 用户设置API（保持现有功能）
 */
app.get('/api/user-settings', async (req, res) => {
  try {
    const sql = 'SELECT setting_key as key, setting_value as value FROM user_settings';
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error('❌ 查询用户设置失败:', err.message);
        res.json({
          success: false,
          error: err.message,
          data: {
            maxLossAmount: 100,
            ictMaxLossAmount: 100
          }
        });
        return;
      }
      
      const settings = {
        maxLossAmount: 100,
        ictMaxLossAmount: 100
      };
      
      rows.forEach(row => {
        if (row.key === 'maxLossAmount') {
          settings.maxLossAmount = parseFloat(row.value) || 100;
        } else if (row.key === 'ictMaxLossAmount') {
          settings.ictMaxLossAmount = parseFloat(row.value) || 100;
        }
      });
      
      res.json({
        success: true,
        data: settings
      });
    });
    
  } catch (error) {
    console.error('❌ 获取用户设置失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      data: {
        maxLossAmount: 100,
        ictMaxLossAmount: 100
      }
    });
  }
});

app.post('/api/user-settings', async (req, res) => {
  try {
    const { maxLossAmount, ictMaxLossAmount } = req.body;
    
    const sql = `
      INSERT OR REPLACE INTO user_settings (setting_key, setting_value, updated_at)
      VALUES 
        ('maxLossAmount', ?, CURRENT_TIMESTAMP),
        ('ictMaxLossAmount', ?, CURRENT_TIMESTAMP)
    `;
    
    db.run(sql, [maxLossAmount || 100, ictMaxLossAmount || 100], (err) => {
      if (err) {
        console.error('❌ 保存用户设置失败:', err.message);
        res.status(500).json({
          success: false,
          error: err.message
        });
        return;
      }
      
      res.json({
        success: true,
        message: '用户设置保存成功'
      });
    });
    
  } catch (error) {
    console.error('❌ 保存用户设置失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 启动服务器 ====================

app.listen(port, () => {
  console.log(`🚀 真实策略服务器启动成功`);
  console.log(`📊 端口: ${port}`);
  console.log(`🌐 访问地址: http://localhost:${port}`);
  console.log(`📈 V3策略API: http://localhost:${port}/api/v3/analysis/BTCUSDT`);
  console.log(`📈 ICT策略API: http://localhost:${port}/api/ict/analysis/BTCUSDT`);
  console.log(`🔄 策略分析API: http://localhost:${port}/api/strategy/analyze`);
  console.log(`📊 策略统计API: http://localhost:${port}/api/strategy/stats`);
  console.log(`✅ 严格按照strategy-v3.md和ict.md实现真实策略逻辑`);
});

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('\n🔄 正在关闭服务器...');
  
  try {
    await realStrategyAPI.close();
    db.close();
    console.log('✅ 服务器已关闭');
    process.exit(0);
  } catch (error) {
    console.error('❌ 关闭服务器失败:', error.message);
    process.exit(1);
  }
});
