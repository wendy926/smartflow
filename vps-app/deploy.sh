#!/bin/bash

# SmartFlow VPS 应用部署脚本
# 适用于新加坡 VPS (47.237.163.85)

set -e

echo "🚀 开始部署 SmartFlow VPS 应用..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目配置
PROJECT_DIR="/home/admin/smartflow-vps-app"
SERVICE_NAME="smartflow-app"
PORT=3000

echo -e "${BLUE}📁 创建项目目录: $PROJECT_DIR${NC}"
mkdir -p $PROJECT_DIR
cd $PROJECT_DIR

echo -e "${BLUE}📝 创建 package.json...${NC}"
cat > package.json << 'EOF'
{
  "name": "smartflow-vps-app",
  "version": "1.0.0",
  "description": "SmartFlow Trading Strategy VPS Application",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "pm2:start": "pm2 start ecosystem.config.js",
    "pm2:stop": "pm2 stop smartflow-app",
    "pm2:restart": "pm2 restart smartflow-app",
    "pm2:logs": "pm2 logs smartflow-app"
  },
  "dependencies": {
    "express": "^4.18.2",
    "axios": "^1.6.0",
    "technicalindicators": "^3.1.0",
    "ws": "^8.14.0",
    "csv-writer": "^1.6.0",
    "cors": "^2.8.5",
    "express-rate-limit": "^7.1.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

echo -e "${BLUE}📝 创建 PM2 配置文件...${NC}"
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'smartflow-app',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_memory_restart: '1G',
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF

echo -e "${BLUE}📝 创建服务器文件...${NC}"
cat > server.js << 'EOF'
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const axios = require('axios');
const { SMA, VWAP, ATR } = require('technicalindicators');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100 // 限制每个IP 15分钟内最多100个请求
});
app.use('/api/', limiter);

// 技术指标计算
class TechnicalIndicators {
  static calculateSMA(data, period) {
    return SMA.calculate({ values: data, period });
  }

  static calculateVWAP(klines) {
    const prices = klines.map(k => (parseFloat(k[2]) + parseFloat(k[3]) + parseFloat(k[4])) / 3);
    const volumes = klines.map(k => parseFloat(k[5]));
    return VWAP.calculate({ high: prices, low: prices, close: prices, volume: volumes });
  }

  static calculateATR(klines, period = 14) {
    const high = klines.map(k => parseFloat(k[2]));
    const low = klines.map(k => parseFloat(k[3]));
    const close = klines.map(k => parseFloat(k[4]));
    return ATR.calculate({ high, low, close, period });
  }
}

// Binance API 数据获取
class BinanceAPI {
  static BASE_URL = 'https://fapi.binance.com';

  static async getKlines(symbol, interval, limit = 500) {
    try {
      const response = await axios.get(`${this.BASE_URL}/fapi/v1/klines`, {
        params: { symbol, interval, limit },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error(`[BinanceAPI] K线数据获取失败: ${error.message}`);
      throw error;
    }
  }

  static async getFundingRate(symbol) {
    try {
      const response = await axios.get(`${this.BASE_URL}/fapi/v1/premiumIndex`, {
        params: { symbol },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error(`[BinanceAPI] 资金费率获取失败: ${error.message}`);
      throw error;
    }
  }

  static async getOpenInterest(symbol) {
    try {
      const response = await axios.get(`${this.BASE_URL}/fapi/v1/openInterest`, {
        params: { symbol },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error(`[BinanceAPI] 持仓量获取失败: ${error.message}`);
      throw error;
    }
  }

  static async get24hrTicker(symbol) {
    try {
      const response = await axios.get(`${this.BASE_URL}/fapi/v1/ticker/24hr`, {
        params: { symbol },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error(`[BinanceAPI] 24小时价格获取失败: ${error.message}`);
      throw error;
    }
  }
}

// 交易策略
class SmartFlowStrategy {
  static async analyzeDailyTrend(symbol) {
    try {
      const klines = await BinanceAPI.getKlines(symbol, '1d', 100);
      const closes = klines.map(k => parseFloat(k[4]));
      const sma20 = TechnicalIndicators.calculateSMA(closes, 20);
      const sma50 = TechnicalIndicators.calculateSMA(closes, 50);
      
      const currentPrice = closes[closes.length - 1];
      const currentSma20 = sma20[sma20.length - 1];
      const currentSma50 = sma50[sma50.length - 1];

      if (currentPrice > currentSma20 && currentSma20 > currentSma50) {
        return 'UPTREND';
      } else if (currentPrice < currentSma20 && currentSma20 < currentSma50) {
        return 'DOWNTREND';
      } else {
        return 'RANGE';
      }
    } catch (error) {
      console.error(`[Strategy] 日线趋势分析失败: ${error.message}`);
      return 'RANGE';
    }
  }

  static async analyzeHourlyConfirmation(symbol) {
    try {
      const klines = await BinanceAPI.getKlines(symbol, '1h', 24);
      const closes = klines.map(k => parseFloat(k[4]));
      const volumes = klines.map(k => parseFloat(k[5]));
      
      const currentPrice = closes[closes.length - 1];
      const currentVolume = volumes[volumes.length - 1];
      const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
      
      const volumeRatio = currentVolume / avgVolume;
      
      if (volumeRatio > 1.5) {
        return { confirmed: true, volumeRatio };
      } else {
        return { confirmed: false, volumeRatio };
      }
    } catch (error) {
      console.error(`[Strategy] 小时确认分析失败: ${error.message}`);
      return { confirmed: false, volumeRatio: 1 };
    }
  }

  static async analyze15mExecution(symbol) {
    try {
      const klines = await BinanceAPI.getKlines(symbol, '15m', 96);
      const vwap = TechnicalIndicators.calculateVWAP(klines);
      const atr = TechnicalIndicators.calculateATR(klines);
      
      const currentPrice = parseFloat(klines[klines.length - 1][4]);
      const currentVwap = vwap[vwap.length - 1];
      const currentAtr = atr[atr.length - 1];
      
      const priceVsVwap = (currentPrice - currentVwap) / currentVwap;
      
      if (priceVsVwap > 0.002) {
        return { signal: 'LONG', priceVsVwap, atr: currentAtr };
      } else if (priceVsVwap < -0.002) {
        return { signal: 'SHORT', priceVsVwap, atr: currentAtr };
      } else {
        return { signal: 'NO_SIGNAL', priceVsVwap, atr: currentAtr };
      }
    } catch (error) {
      console.error(`[Strategy] 15分钟执行分析失败: ${error.message}`);
      return { signal: 'NO_SIGNAL', priceVsVwap: 0, atr: 0 };
    }
  }

  static async analyzeAll(symbol) {
    try {
      const [dailyTrend, hourlyConfirmation, execution15m, fundingRate, openInterest, ticker24hr] = await Promise.all([
        this.analyzeDailyTrend(symbol),
        this.analyzeHourlyConfirmation(symbol),
        this.analyze15mExecution(symbol),
        BinanceAPI.getFundingRate(symbol),
        BinanceAPI.getOpenInterest(symbol),
        BinanceAPI.get24hrTicker(symbol)
      ]);

      const currentPrice = parseFloat(ticker24hr.lastPrice);
      const fundingRateValue = parseFloat(fundingRate.lastFundingRate);
      const oiChange = parseFloat(openInterest.openInterest);

      let signal = 'NO_SIGNAL';
      let reason = '';

      if (dailyTrend === 'UPTREND' && hourlyConfirmation.confirmed && execution15m.signal === 'LONG') {
        signal = 'LONG';
        reason = '多周期共振多头信号';
      } else if (dailyTrend === 'DOWNTREND' && hourlyConfirmation.confirmed && execution15m.signal === 'SHORT') {
        signal = 'SHORT';
        reason = '多周期共振空头信号';
      } else {
        reason = '趋势不明确';
      }

      return {
        time: new Date().toISOString(),
        symbol,
        trend: dailyTrend,
        signal,
        currentPrice,
        vwap: execution15m.priceVsVwap,
        volumeRatio: hourlyConfirmation.volumeRatio,
        oiChange,
        fundingRate: fundingRateValue,
        stopLoss: signal === 'LONG' ? currentPrice - execution15m.atr * 2 : 
                  signal === 'SHORT' ? currentPrice + execution15m.atr * 2 : 0,
        targetPrice: signal === 'LONG' ? currentPrice + execution15m.atr * 3 : 
                    signal === 'SHORT' ? currentPrice - execution15m.atr * 3 : 0,
        riskReward: signal !== 'NO_SIGNAL' ? 1.5 : 0,
        reason
      };
    } catch (error) {
      console.error(`[Strategy] 综合分析失败: ${error.message}`);
      return {
        time: new Date().toISOString(),
        symbol,
        trend: 'RANGE',
        signal: 'NO_SIGNAL',
        reason: '分析失败'
      };
    }
  }
}

// API 路由
app.get('/api/test', async (req, res) => {
  try {
    const tests = [
      {
        test: 'K线数据',
        status: 'PASS',
        data: (await BinanceAPI.getKlines('BTCUSDT', '1h', 5)).length
      },
      {
        test: '资金费率',
        status: 'PASS',
        data: (await BinanceAPI.getFundingRate('BTCUSDT')).length
      },
      {
        test: '持仓量',
        status: 'PASS',
        data: (await BinanceAPI.getOpenInterest('BTCUSDT')).openInterest
      }
    ];

    res.json({
      timestamp: new Date().toISOString(),
      tests,
      summary: {
        total: tests.length,
        passed: tests.filter(t => t.status === 'PASS').length,
        failed: tests.filter(t => t.status === 'FAIL').length
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'API测试失败',
      message: error.message
    });
  }
});

app.get('/api/analyze/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const result = await SmartFlowStrategy.analyzeAll(symbol);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: '分析失败',
      message: error.message
    });
  }
});

app.get('/api/analyze-all', async (req, res) => {
  try {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'LINKUSDT', 'LDOUSDT'];
    const results = await Promise.all(
      symbols.map(symbol => SmartFlowStrategy.analyzeAll(symbol))
    );
    res.json(results);
  } catch (error) {
    res.status(500).json({
      error: '批量分析失败',
      message: error.message
    });
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    server: 'SmartFlow VPS Application',
    location: 'Singapore'
  });
});

// 前端页面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SmartFlow VPS 应用启动成功！`);
  console.log(`📊 端口: ${PORT}`);
  console.log(`🌍 访问地址: http://localhost:${PORT}`);
  console.log(`🔗 API 地址: http://localhost:${PORT}/api/test`);
});
EOF

echo -e "${BLUE}📁 创建前端目录...${NC}"
mkdir -p public

echo -e "${BLUE}📝 创建前端页面...${NC}"
cat > public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SmartFlow 交易策略仪表板</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            text-align: center;
            margin-bottom: 30px;
            color: white;
        }

        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }

        .header p {
            font-size: 1.1rem;
            opacity: 0.9;
        }

        .controls {
            display: flex;
            justify-content: center;
            gap: 15px;
            margin-bottom: 30px;
            flex-wrap: wrap;
        }

        .btn {
            background: rgba(255, 255, 255, 0.2);
            border: 2px solid rgba(255, 255, 255, 0.3);
            color: white;
            padding: 12px 24px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 1rem;
            font-weight: 600;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
        }

        .btn:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }

        .btn:active {
            transform: translateY(0);
        }

        .btn.primary {
            background: linear-gradient(45deg, #ff6b6b, #ee5a24);
            border-color: #ff6b6b;
        }

        .btn.secondary {
            background: linear-gradient(45deg, #4834d4, #686de0);
            border-color: #4834d4;
        }

        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .stat-card {
            background: rgba(255, 255, 255, 0.95);
            padding: 25px;
            border-radius: 15px;
            text-align: center;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .stat-card h3 {
            font-size: 2rem;
            margin-bottom: 10px;
            background: linear-gradient(45deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .stat-card p {
            color: #666;
            font-weight: 500;
        }

        .table-container {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            overflow-x: auto;
        }

        .table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }

        .table th,
        .table td {
            padding: 15px 12px;
            text-align: left;
            border-bottom: 1px solid #eee;
        }

        .table th {
            background: linear-gradient(45deg, #667eea, #764ba2);
            color: white;
            font-weight: 600;
            position: sticky;
            top: 0;
        }

        .table tr:hover {
            background: rgba(102, 126, 234, 0.05);
        }

        .signal {
            padding: 6px 12px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 0.85rem;
            text-align: center;
        }

        .signal.long {
            background: linear-gradient(45deg, #00b894, #00cec9);
            color: white;
        }

        .signal.short {
            background: linear-gradient(45deg, #e17055, #d63031);
            color: white;
        }

        .signal.no-signal {
            background: #ddd;
            color: #666;
        }

        .trend {
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: 500;
        }

        .trend.uptrend {
            background: #d4edda;
            color: #155724;
        }

        .trend.downtrend {
            background: #f8d7da;
            color: #721c24;
        }

        .trend.range {
            background: #fff3cd;
            color: #856404;
        }

        .loading {
            text-align: center;
            padding: 40px;
            color: #666;
        }

        .error {
            background: #f8d7da;
            color: #721c24;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            border: 1px solid #f5c6cb;
        }

        .success {
            background: #d4edda;
            color: #155724;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            border: 1px solid #c3e6cb;
        }

        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }

            .header h1 {
                font-size: 2rem;
            }

            .controls {
                flex-direction: column;
                align-items: center;
            }

            .btn {
                width: 100%;
                max-width: 300px;
            }

            .stats {
                grid-template-columns: repeat(2, 1fr);
            }

            .table-container {
                padding: 15px;
            }

            .table th,
            .table td {
                padding: 10px 8px;
                font-size: 0.9rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 SmartFlow 交易策略仪表板</h1>
            <p>基于多周期共振的高胜率高盈亏比加密货币交易策略</p>
        </div>

        <div class="controls">
            <button class="btn primary" onclick="refreshAllSignals()">
                🔄 刷新所有信号
            </button>
            <button class="btn secondary" onclick="testAPI()">
                🧪 测试API连接
            </button>
            <button class="btn" onclick="toggleAutoRefresh()">
                ⏰ 自动刷新
            </button>
        </div>

        <div class="stats">
            <div class="stat-card">
                <h3 id="totalSignals">0</h3>
                <p>总信号数</p>
            </div>
            <div class="stat-card">
                <h3 id="longSignals">0</h3>
                <p>多头信号</p>
            </div>
            <div class="stat-card">
                <h3 id="shortSignals">0</h3>
                <p>空头信号</p>
            </div>
            <div class="stat-card">
                <h3 id="lastUpdate">--</h3>
                <p>最后更新</p>
            </div>
        </div>

        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>交易对</th>
                        <th>趋势</th>
                        <th>信号</th>
                        <th>当前价格</th>
                        <th>VWAP</th>
                        <th>成交量倍数</th>
                        <th>OI变化%</th>
                        <th>资金费率</th>
                        <th>止损价</th>
                        <th>目标价</th>
                        <th>盈亏比</th>
                        <th>原因</th>
                    </tr>
                </thead>
                <tbody id="signalsTable">
                    <tr>
                        <td colspan="12" class="loading">点击"刷新所有信号"开始分析</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>

    <script>
        let autoRefreshInterval = null;
        let isAutoRefresh = false;

        // 刷新所有信号
        async function refreshAllSignals() {
            const tableBody = document.getElementById('signalsTable');
            tableBody.innerHTML = '<tr><td colspan="12" class="loading">分析中...</td></tr>';

            try {
                const response = await fetch('/api/analyze-all');
                const signals = await response.json();
                
                displaySignals(signals);
                updateStats(signals);
                
                showMessage('信号刷新成功！', 'success');
            } catch (error) {
                console.error('刷新信号失败:', error);
                tableBody.innerHTML = '<tr><td colspan="12" class="error">刷新失败: ' + error.message + '</td></tr>';
                showMessage('刷新失败: ' + error.message, 'error');
            }
        }

        // 测试API连接
        async function testAPI() {
            try {
                const response = await fetch('/api/test');
                const result = await response.json();
                
                if (result.summary.passed === result.summary.total) {
                    showMessage('API连接正常！所有测试通过', 'success');
                } else {
                    showMessage('API连接异常！部分测试失败', 'error');
                }
            } catch (error) {
                console.error('API测试失败:', error);
                showMessage('API测试失败: ' + error.message, 'error');
            }
        }

        // 切换自动刷新
        function toggleAutoRefresh() {
            if (isAutoRefresh) {
                clearInterval(autoRefreshInterval);
                isAutoRefresh = false;
                showMessage('自动刷新已关闭', 'success');
            } else {
                autoRefreshInterval = setInterval(refreshAllSignals, 30000); // 30秒
                isAutoRefresh = true;
                showMessage('自动刷新已开启（30秒间隔）', 'success');
            }
        }

        // 显示信号
        function displaySignals(signals) {
            const tableBody = document.getElementById('signalsTable');
            
            if (signals.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="12" class="loading">暂无信号数据</td></tr>';
                return;
            }

            tableBody.innerHTML = signals.map(signal => `
                <tr>
                    <td><strong>${signal.symbol}</strong></td>
                    <td><span class="trend ${signal.trend.toLowerCase()}">${signal.trend}</span></td>
                    <td><span class="signal ${signal.signal.toLowerCase().replace('_', '-')}">${signal.signal}</span></td>
                    <td>$${signal.currentPrice ? signal.currentPrice.toFixed(2) : '--'}</td>
                    <td>${signal.vwap ? (signal.vwap * 100).toFixed(2) + '%' : '--'}</td>
                    <td>${signal.volumeRatio ? signal.volumeRatio.toFixed(2) + 'x' : '--'}</td>
                    <td>${signal.oiChange ? signal.oiChange.toFixed(2) : '--'}</td>
                    <td>${signal.fundingRate ? (signal.fundingRate * 100).toFixed(4) + '%' : '--'}</td>
                    <td>${signal.stopLoss ? '$' + signal.stopLoss.toFixed(2) : '--'}</td>
                    <td>${signal.targetPrice ? '$' + signal.targetPrice.toFixed(2) : '--'}</td>
                    <td>${signal.riskReward ? signal.riskReward.toFixed(1) : '--'}</td>
                    <td>${signal.reason || '--'}</td>
                </tr>
            `).join('');
        }

        // 更新统计
        function updateStats(signals) {
            const totalSignals = signals.length;
            const longSignals = signals.filter(s => s.signal === 'LONG').length;
            const shortSignals = signals.filter(s => s.signal === 'SHORT').length;
            
            document.getElementById('totalSignals').textContent = totalSignals;
            document.getElementById('longSignals').textContent = longSignals;
            document.getElementById('shortSignals').textContent = shortSignals;
            document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
        }

        // 显示消息
        function showMessage(message, type) {
            const existingMessage = document.querySelector('.message');
            if (existingMessage) {
                existingMessage.remove();
            }

            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${type}`;
            messageDiv.textContent = message;
            
            document.querySelector('.container').insertBefore(messageDiv, document.querySelector('.stats'));
            
            setTimeout(() => {
                messageDiv.remove();
            }, 5000);
        }

        // 页面加载时自动刷新一次
        document.addEventListener('DOMContentLoaded', () => {
            refreshAllSignals();
        });
    </script>
</body>
</html>
EOF

echo -e "${BLUE}📦 安装依赖...${NC}"
npm install

echo -e "${BLUE}📁 创建日志目录...${NC}"
mkdir -p logs

echo -e "${BLUE}📦 安装 PM2...${NC}"
npm install -g pm2

echo -e "${BLUE}🛑 停止现有服务...${NC}"
pm2 stop $SERVICE_NAME 2>/dev/null || true
pm2 delete $SERVICE_NAME 2>/dev/null || true

echo -e "${BLUE}🚀 启动服务...${NC}"
pm2 start ecosystem.config.js

echo -e "${BLUE}⏳ 等待服务启动...${NC}"
sleep 5

echo -e "${BLUE}📊 检查服务状态...${NC}"
pm2 status

echo -e "${BLUE}🧪 测试服务...${NC}"
if curl -s http://localhost:$PORT/health > /dev/null; then
    echo -e "${GREEN}✅ 服务启动成功！${NC}"
else
    echo -e "${RED}❌ 服务启动失败，请检查日志${NC}"
    echo -e "${YELLOW}查看日志: pm2 logs $SERVICE_NAME${NC}"
    exit 1
fi

echo -e "${GREEN}🎉 SmartFlow VPS 应用部署完成！${NC}"
echo -e "${BLUE}🌍 访问地址: http://47.237.163.85:$PORT${NC}"
echo -e "${BLUE}🔗 API 地址: http://47.237.163.85:$PORT/api/test${NC}"
echo -e "${BLUE}📊 管理命令: pm2 status, pm2 logs $SERVICE_NAME${NC}"
echo -e "${BLUE}🔄 重启命令: pm2 restart $SERVICE_NAME${NC}"
