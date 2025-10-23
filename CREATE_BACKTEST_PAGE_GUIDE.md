# 创建策略参数回测页面指南

**问题**: `/strategy-params` 页面返回404  
**原因**: 该页面尚未创建  
**解决方案**: 创建前端页面和API端点

---

## 📋 方案概述

由于 `/strategy-params` 页面不存在，我们有两个选择：

### 选项A: 通过命令行运行回测 ⭐ 推荐

直接在VPS上运行回测脚本，无需前端页面。

### 选项B: 创建前端页面

创建完整的策略参数回测页面（需要更多开发工作）。

---

## 🚀 选项A: 命令行运行回测（推荐）

### 步骤1: 创建回测脚本

在VPS上创建一个简单的回测脚本：

```bash
ssh -i ~/.ssh/smartflow_vps_new root@47.237.163.85

cd /home/admin/trading-system-v2/trading-system-v2/trading-system-v2

# 创建回测脚本
cat > run-backtest-optimized.js << 'EOFSCRIPT'
/**
 * 优化后策略回测脚本
 * 用于验证参数化和ADX过滤的效果
 */

const BacktestManagerV3 = require('./src/services/backtest-manager-v3');
const DatabaseConnection = require('./src/database/connection');
const logger = require('./src/utils/logger');

async function runBacktest(strategyName, symbol, startDate, endDate, mode = 'BALANCED') {
  console.log(`\n=== ${strategyName} 策略回测 ===`);
  console.log(`交易对: ${symbol}`);
  console.log(`时间范围: ${startDate} 至 ${endDate}`);
  console.log(`模式: ${mode}`);
  console.log(`时间框架: 5m\n`);

  try {
    // 初始化数据库连接
    const db = DatabaseConnection.getInstance();
    await db.connect();
    
    // 创建回测管理器
    const backtestManager = new BacktestManagerV3();
    
    // 运行回测
    const result = await backtestManager.runBacktest({
      strategy: strategyName,
      symbol: symbol,
      timeframe: '5m',
      startDate: startDate,
      endDate: endDate,
      mode: mode
    });
    
    // 输出结果
    console.log('\n=== 回测结果 ===');
    console.log(`策略: ${result.strategy}`);
    console.log(`模式: ${result.mode || mode}`);
    console.log(`胜率: ${result.winRate?.toFixed(2) || 0}%`);
    console.log(`盈亏比: ${result.profitFactor?.toFixed(2) || 0}:1`);
    console.log(`净盈利: ${result.netProfit?.toFixed(2) || 0} USDT`);
    console.log(`总交易数: ${result.totalTrades || 0}笔`);
    console.log(`盈利交易: ${result.winningTrades || 0}笔`);
    console.log(`亏损交易: ${result.losingTrades || 0}笔`);
    console.log(`最大回撤: ${result.maxDrawdown?.toFixed(2) || 0}%`);
    console.log(`平均盈利: ${result.avgWin?.toFixed(2) || 0} USDT`);
    console.log(`平均亏损: ${result.avgLoss?.toFixed(2) || 0} USDT`);
    
    return result;
    
  } catch (error) {
    console.error('回测失败:', error.message);
    throw error;
  }
}

// 解析命令行参数
const args = process.argv.slice(2);
const strategyName = args[0] || 'ICT';
const symbol = args[1] || 'BTCUSDT';
const startDate = args[2] || '2024-01-01';
const endDate = args[3] || '2024-01-31';
const mode = args[4] || 'BALANCED';

// 运行回测
runBacktest(strategyName, symbol, startDate, endDate, mode)
  .then(() => {
    console.log('\n✅ 回测完成');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 回测失败:', error);
    process.exit(1);
  });
EOFSCRIPT

echo "✅ 回测脚本已创建"
```

### 步骤2: 运行回测

```bash
# ICT策略回测 (2024年1月)
node run-backtest-optimized.js ICT BTCUSDT 2024-01-01 2024-01-31 BALANCED

# V3策略回测 (2024年1月)
node run-backtest-optimized.js V3 BTCUSDT 2024-01-01 2024-01-31 BALANCED

# ICT策略回测 (2024年1-4月完整)
node run-backtest-optimized.js ICT BTCUSDT 2024-01-01 2024-04-22 BALANCED

# V3策略回测 (2024年1-4月完整)
node run-backtest-optimized.js V3 BTCUSDT 2024-01-01 2024-04-22 BALANCED

# 不同模式回测
node run-backtest-optimized.js ICT BTCUSDT 2024-01-01 2024-01-31 AGGRESSIVE
node run-backtest-optimized.js ICT BTCUSDT 2024-01-01 2024-01-31 CONSERVATIVE
```

### 步骤3: 查看结果

回测完成后，结果会：
1. 直接输出到终端
2. 保存到数据库 `strategy_parameter_backtest_results` 表

查询数据库中的最新结果：
```sql
SELECT 
  strategy_name,
  strategy_mode,
  ROUND(win_rate, 2) as '胜率%',
  ROUND(profit_factor, 2) as '盈亏比',
  ROUND(net_profit, 2) as '净盈利',
  total_trades as '交易数',
  DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') as '时间'
FROM strategy_parameter_backtest_results
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
ORDER BY created_at DESC;
```

---

## 🎨 选项B: 创建前端页面（完整方案）

如果需要前端页面，需要以下步骤：

### 1. 创建前端HTML页面

```bash
cd /home/admin/trading-system-v2/trading-system-v2/trading-system-v2

cat > src/web/strategy-params.html << 'EOFHTML'
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>策略参数回测 - SmartFlow</title>
  <link rel="stylesheet" href="styles.css">
  <style>
    .backtest-container {
      max-width: 1200px;
      margin: 20px auto;
      padding: 20px;
    }
    .backtest-form {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .form-group {
      margin-bottom: 15px;
    }
    .form-group label {
      display: block;
      margin-bottom: 5px;
      font-weight: 600;
    }
    .form-group select,
    .form-group input {
      width: 100%;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .btn-run-backtest {
      background: #4CAF50;
      color: white;
      padding: 12px 24px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
    }
    .btn-run-backtest:hover {
      background: #45a049;
    }
    .results-container {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-top: 20px;
    }
    .results-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-top: 15px;
    }
    .result-card {
      padding: 15px;
      background: #f5f5f5;
      border-radius: 4px;
    }
    .result-card h4 {
      margin: 0 0 10px 0;
      color: #666;
    }
    .result-card .value {
      font-size: 24px;
      font-weight: bold;
      color: #333;
    }
    .loading {
      display: none;
      text-align: center;
      padding: 20px;
    }
  </style>
</head>
<body>
  <div class="backtest-container">
    <h1>策略参数回测</h1>
    
    <div class="backtest-form">
      <h2>回测配置</h2>
      
      <div class="form-group">
        <label>策略</label>
        <select id="strategy">
          <option value="ICT">ICT策略</option>
          <option value="V3">V3策略</option>
        </select>
      </div>
      
      <div class="form-group">
        <label>模式</label>
        <select id="mode">
          <option value="BALANCED">BALANCED（平衡）</option>
          <option value="AGGRESSIVE">AGGRESSIVE（激进）</option>
          <option value="CONSERVATIVE">CONSERVATIVE（保守）</option>
        </select>
      </div>
      
      <div class="form-group">
        <label>交易对</label>
        <select id="symbol">
          <option value="BTCUSDT">BTCUSDT</option>
          <option value="ETHUSDT">ETHUSDT</option>
        </select>
      </div>
      
      <div class="form-group">
        <label>时间框架</label>
        <select id="timeframe">
          <option value="5m">5分钟</option>
          <option value="1h">1小时</option>
        </select>
      </div>
      
      <div class="form-group">
        <label>开始日期</label>
        <input type="date" id="startDate" value="2024-01-01">
      </div>
      
      <div class="form-group">
        <label>结束日期</label>
        <input type="date" id="endDate" value="2024-01-31">
      </div>
      
      <button class="btn-run-backtest" onclick="runBacktest()">运行回测</button>
    </div>
    
    <div class="loading" id="loading">
      <p>回测运行中，请稍候...</p>
    </div>
    
    <div class="results-container" id="results" style="display: none;">
      <h2>回测结果</h2>
      <div class="results-grid" id="resultsGrid"></div>
    </div>
  </div>
  
  <script>
    async function runBacktest() {
      const strategy = document.getElementById('strategy').value;
      const mode = document.getElementById('mode').value;
      const symbol = document.getElementById('symbol').value;
      const timeframe = document.getElementById('timeframe').value;
      const startDate = document.getElementById('startDate').value;
      const endDate = document.getElementById('endDate').value;
      
      // 显示加载中
      document.getElementById('loading').style.display = 'block';
      document.getElementById('results').style.display = 'none';
      
      try {
        const response = await fetch('/api/backtest/run', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            strategy,
            mode,
            symbol,
            timeframe,
            startDate,
            endDate
          })
        });
        
        const result = await response.json();
        
        // 隐藏加载中
        document.getElementById('loading').style.display = 'none';
        
        if (result.success) {
          displayResults(result.data);
        } else {
          alert('回测失败: ' + result.message);
        }
      } catch (error) {
        document.getElementById('loading').style.display = 'none';
        alert('回测失败: ' + error.message);
      }
    }
    
    function displayResults(data) {
      const resultsGrid = document.getElementById('resultsGrid');
      resultsGrid.innerHTML = `
        <div class="result-card">
          <h4>胜率</h4>
          <div class="value">${(data.winRate || 0).toFixed(2)}%</div>
        </div>
        <div class="result-card">
          <h4>盈亏比</h4>
          <div class="value">${(data.profitFactor || 0).toFixed(2)}:1</div>
        </div>
        <div class="result-card">
          <h4>净盈利</h4>
          <div class="value">${(data.netProfit || 0).toFixed(2)} USDT</div>
        </div>
        <div class="result-card">
          <h4>总交易数</h4>
          <div class="value">${data.totalTrades || 0}笔</div>
        </div>
        <div class="result-card">
          <h4>盈利交易</h4>
          <div class="value">${data.winningTrades || 0}笔</div>
        </div>
        <div class="result-card">
          <h4>亏损交易</h4>
          <div class="value">${data.losingTrades || 0}笔</div>
        </div>
        <div class="result-card">
          <h4>最大回撤</h4>
          <div class="value">${(data.maxDrawdown || 0).toFixed(2)}%</div>
        </div>
        <div class="result-card">
          <h4>平均盈利</h4>
          <div class="value">${(data.avgWin || 0).toFixed(2)} USDT</div>
        </div>
      `;
      
      document.getElementById('results').style.display = 'block';
    }
  </script>
</body>
</html>
EOFHTML

echo "✅ 前端页面已创建"
```

### 2. 添加API路由

```bash
cat > src/api/routes/backtest.js << 'EOFJS'
const express = require('express');
const router = express.Router();
const BacktestManagerV3 = require('../../services/backtest-manager-v3');
const logger = require('../../utils/logger');

// 运行回测
router.post('/run', async (req, res) => {
  try {
    const { strategy, mode, symbol, timeframe, startDate, endDate } = req.body;
    
    logger.info(`开始回测: ${strategy}-${mode} ${symbol} ${timeframe} ${startDate}~${endDate}`);
    
    const backtestManager = new BacktestManagerV3();
    const result = await backtestManager.runBacktest({
      strategy,
      symbol,
      timeframe,
      startDate,
      endDate,
      mode
    });
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    logger.error('回测失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
EOFJS

echo "✅ API路由已创建"
```

### 3. 注册路由

在 `src/main.js` 或 `src/web/app.js` 中添加：

```javascript
// 添加回测路由
const backtestRoutes = require('./api/routes/backtest');
app.use('/api/backtest', backtestRoutes);

// 添加静态页面路由
app.get('/strategy-params', (req, res) => {
  res.sendFile(path.join(__dirname, 'web/strategy-params.html'));
});
```

### 4. 重启服务

```bash
pm2 restart main-app
```

---

## 🎯 推荐方案

### 立即可用：选项A（命令行）⭐

**优点**:
- ✅ 无需修改代码
- ✅ 立即可用
- ✅ 结果保存到数据库
- ✅ 可批量运行多个回测

**缺点**:
- ❌ 需要SSH访问
- ❌ 无图形界面

### 长期方案：选项B（前端页面）

**优点**:
- ✅ 用户友好
- ✅ 图形化界面
- ✅ 更易操作

**缺点**:
- ❌ 需要开发时间
- ❌ 需要测试

---

## 📝 建议行动

### 立即执行（今天）
1. 使用选项A在VPS上运行命令行回测
2. 验证优化效果
3. 获取胜率和盈亏比数据

### 后续优化（有时间时）
1. 创建完整的前端页面（选项B）
2. 添加历史回测记录查看
3. 添加参数对比功能

---

**下一步**: 使用选项A立即运行回测，验证优化效果！

