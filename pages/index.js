/**
 * Vercel 主页面 - SmartFlow 仪表板
 */

export default function Home() {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SmartFlow 交易策略仪表板</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container { 
            max-width: 1400px; 
            margin: 0 auto; 
            background: rgba(255,255,255,0.95);
            border-radius: 20px;
            padding: 30px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }
        h1 { 
            text-align: center; 
            color: #333; 
            margin-bottom: 30px;
            font-size: 2.5em;
            background: linear-gradient(45deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .controls {
            display: flex;
            gap: 15px;
            margin-bottom: 30px;
            flex-wrap: wrap;
            justify-content: center;
        }
        button {
            padding: 12px 24px;
            border: none;
            border-radius: 25px;
            background: linear-gradient(45deg, #667eea, #764ba2);
            color: white;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s ease;
        }
        button:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.2); }
        .status { 
            text-align: center; 
            margin: 20px 0; 
            padding: 15px;
            border-radius: 10px;
            background: #f8f9fa;
        }
        .signal-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 20px;
            background: white;
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        th, td { 
            padding: 15px; 
            text-align: center; 
            border-bottom: 1px solid #eee;
        }
        th { 
            background: linear-gradient(45deg, #667eea, #764ba2);
            color: white;
            font-weight: 600;
        }
        tr:hover { background: #f8f9fa; }
        .signal-long { color: #28a745; font-weight: bold; }
        .signal-short { color: #dc3545; font-weight: bold; }
        .signal-none { color: #6c757d; }
        .trend-up { color: #28a745; }
        .trend-down { color: #dc3545; }
        .trend-range { color: #ffc107; }
        .loading { 
            text-align: center; 
            padding: 40px; 
            color: #666;
        }
        .error { 
            background: #f8d7da; 
            color: #721c24; 
            padding: 15px; 
            border-radius: 10px; 
            margin: 10px 0;
        }
        .success { 
            background: #d4edda; 
            color: #155724; 
            padding: 15px; 
            border-radius: 10px; 
            margin: 10px 0;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: linear-gradient(45deg, #667eea, #764ba2);
            color: white;
            padding: 20px;
            border-radius: 15px;
            text-align: center;
        }
        .stat-value {
            font-size: 2em;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .stat-label {
            opacity: 0.9;
            font-size: 0.9em;
        }
        .deployment-info {
            background: #e3f2fd;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            border-left: 4px solid #2196f3;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 SmartFlow 交易策略仪表板</h1>
        
        <div class="deployment-info">
            <h3>✅ Vercel 部署成功！</h3>
            <p>你的 SmartFlow 交易策略系统已成功部署到 Vercel，现在可以在中国正常访问。</p>
            <p><strong>部署平台:</strong> Vercel | <strong>状态:</strong> 运行中 | <strong>地区:</strong> 全球</p>
        </div>
        
        <div class="controls">
            <button onclick="analyzeAll()">🔄 刷新所有信号</button>
            <button onclick="testAPI()">🧪 测试API连接</button>
            <button onclick="toggleAutoRefresh()">⏰ 自动刷新</button>
        </div>
        
        <div id="status" class="status">点击"刷新所有信号"开始分析</div>
        
        <div id="stats" class="stats" style="display: none;">
            <div class="stat-card">
                <div class="stat-value" id="totalSignals">0</div>
                <div class="stat-label">总信号数</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="longSignals">0</div>
                <div class="stat-label">多头信号</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="shortSignals">0</div>
                <div class="stat-label">空头信号</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="lastUpdate">--</div>
                <div class="stat-label">最后更新</div>
            </div>
        </div>
        
        <table class="signal-table">
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
            <tbody id="signalTableBody">
                <tr>
                    <td colspan="12" class="loading">加载中...</td>
                </tr>
            </tbody>
        </table>
    </div>

    <script>
        let autoRefreshInterval = null;
        
        async function analyzeAll() {
            updateStatus('正在分析所有交易对...', 'loading');
            try {
                const response = await fetch('/api/analyze-all');
                const data = await response.json();
                updateTable(data);
                updateStats(data);
                updateStatus('分析完成！', 'success');
            } catch (error) {
                updateStatus('分析失败: ' + error.message, 'error');
            }
        }
        
        async function testAPI() {
            updateStatus('正在测试API连接...', 'loading');
            try {
                const response = await fetch('/api/test');
                const data = await response.json();
                updateStatus('API测试完成: ' + data.summary.passed + '/' + data.summary.total + ' 通过', 
                           data.summary.failed === 0 ? 'success' : 'error');
            } catch (error) {
                updateStatus('API测试失败: ' + error.message, 'error');
            }
        }
        
        function toggleAutoRefresh() {
            if (autoRefreshInterval) {
                clearInterval(autoRefreshInterval);
                autoRefreshInterval = null;
                updateStatus('自动刷新已停止', '');
            } else {
                autoRefreshInterval = setInterval(analyzeAll, 60000); // 每分钟刷新
                updateStatus('自动刷新已启动（每分钟）', 'success');
            }
        }
        
        function updateStatus(message, type) {
            const status = document.getElementById('status');
            status.textContent = message;
            status.className = 'status ' + type;
        }
        
        function updateTable(data) {
            const tbody = document.getElementById('signalTableBody');
            tbody.innerHTML = '';
            
            data.forEach(item => {
                const row = document.createElement('tr');
                
                const signalClass = item.signal === 'LONG_SIGNAL' ? 'signal-long' : 
                                  item.signal === 'SHORT_SIGNAL' ? 'signal-short' : 'signal-none';
                
                const trendClass = item.trend === 'UPTREND' ? 'trend-up' : 
                                 item.trend === 'DOWNTREND' ? 'trend-down' : 'trend-range';
                
                row.innerHTML = \`
                    <td><strong>\${item.symbol}</strong></td>
                    <td class="\${trendClass}">\${item.trend}</td>
                    <td class="\${signalClass}">\${item.signal}</td>
                    <td>\${item.close ? item.close.toFixed(2) : '--'}</td>
                    <td>\${item.vwap ? item.vwap.toFixed(2) : '--'}</td>
                    <td>\${item.volumeRatio ? item.volumeRatio.toFixed(2) + 'x' : '--'}</td>
                    <td>\${item.oiChange ? item.oiChange.toFixed(2) + '%' : '--'}</td>
                    <td>\${item.funding ? (item.funding * 100).toFixed(4) + '%' : '--'}</td>
                    <td>\${item.stopLoss ? item.stopLoss.toFixed(2) : '--'}</td>
                    <td>\${item.targetPrice ? item.targetPrice.toFixed(2) : '--'}</td>
                    <td>\${item.riskReward ? item.riskReward.toFixed(2) : '--'}</td>
                    <td style="text-align: left; max-width: 200px; word-wrap: break-word;">\${item.reason || '--'}</td>
                \`;
                
                tbody.appendChild(row);
            });
        }
        
        function updateStats(data) {
            const stats = document.getElementById('stats');
            stats.style.display = 'grid';
            
            const totalSignals = data.filter(item => item.signal !== 'NO_SIGNAL' && item.signal !== 'ERROR').length;
            const longSignals = data.filter(item => item.signal === 'LONG_SIGNAL').length;
            const shortSignals = data.filter(item => item.signal === 'SHORT_SIGNAL').length;
            
            document.getElementById('totalSignals').textContent = totalSignals;
            document.getElementById('longSignals').textContent = longSignals;
            document.getElementById('shortSignals').textContent = shortSignals;
            document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
        }
        
        // 页面加载时自动分析
        window.onload = () => {
            analyzeAll();
        };
    </script>
</body>
</html>`;
}
