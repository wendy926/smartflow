#!/usr/bin/env node

/**
 * VPS服务器修复脚本
 * 解决502错误和服务器启动问题
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🔧 开始修复VPS服务器问题...');

// 修复函数
async function fixVPSServer() {
  try {
    console.log('📋 步骤1: 添加测试数据到VPS数据库...');

    const addDataCommands = [
      "cd /home/admin/smartflow-vps-app/vps-app",
      "sqlite3 smartflow.db \"INSERT OR IGNORE INTO custom_symbols (symbol) VALUES ('BTCUSDT'), ('ETHUSDT'), ('LINKUSDT'), ('LDOUSDT');\"",
      "sqlite3 smartflow.db \"INSERT INTO strategy_analysis (symbol, trend4h, market_type, score1h, execution, current_price, data_collection_rate, strategy_version, timestamp) VALUES ('BTCUSDT', '多头趋势', '趋势市', 4, '做多_多头回踩突破', 45000.0, 95.5, 'V3', datetime('now')), ('ETHUSDT', '空头趋势', '趋势市', 3, '做空_空头反抽破位', 3000.0, 92.3, 'V3', datetime('now'));\"",
      "sqlite3 smartflow.db \"INSERT INTO simulations (symbol, entry_price, stop_loss_price, take_profit_price, max_leverage, min_margin, direction, status, trigger_reason, created_at) VALUES ('BTCUSDT', 45000.0, 44000.0, 47000.0, 20, 100.0, 'LONG', 'CLOSED', 'SIGNAL_多头回踩突破', datetime('now'));\"",
      "echo '✅ 测试数据添加完成'"
    ];

    const addDataScript = addDataCommands.join(' && ');

    console.log('📋 步骤2: 启动VPS服务器...');

    const startServerCommands = [
      "cd /home/admin/smartflow-vps-app/vps-app",
      "pkill -f 'node.*server' || true",
      "sleep 2",
      "nohup node src/core/server.js > server_main.log 2>&1 &",
      "sleep 10",
      "echo '=== 检查端口状态 ==='",
      "ss -ltnp | grep 8080 || echo '端口8080未监听'",
      "echo '=== 健康检查 ==='",
      "curl -s http://127.0.0.1:8080 | head -5 || echo '服务器无响应'",
      "echo '=== 服务器日志尾部 ==='",
      "tail -n 20 server_main.log"
    ];

    const startServerScript = startServerCommands.join(' && ');

    // 执行修复
    const fullScript = `${addDataScript} && ${startServerScript}`;

    console.log('🚀 执行修复脚本...');
    console.log('脚本内容:', fullScript);

    // 这里需要手动执行，因为需要SSH连接
    console.log('📝 请手动执行以下命令:');
    console.log(`ssh -i ~/.ssh/smartflow_vps_correct root@47.237.163.85 "${fullScript}"`);

  } catch (error) {
    console.error('❌ 修复过程中出错:', error);
  }
}

// 运行修复
fixVPSServer();
