#!/usr/bin/env node

/**
 * WebSocket 连接测试脚本
 * 用于测试 Binance WebSocket API 连接和 CVD 数据接收
 */

const WebSocket = require('ws');

const symbols = ['BTCUSDT', 'ETHUSDT', 'LINKUSDT', 'LDOUSDT', 'SOLUSDT'];

console.log('🔌 开始测试 Binance WebSocket 连接...\n');

symbols.forEach(symbol => {
  const wsSymbol = symbol.toLowerCase();
  const ws = new WebSocket(`wss://fstream.binance.com/ws/${wsSymbol}@aggTrade`);

  let cvd = 0;
  let tradeCount = 0;
  let startTime = Date.now();

  ws.on('open', () => {
    console.log(`✅ ${symbol} WebSocket 连接成功`);
  });

  ws.on('message', (data) => {
    try {
      const trade = JSON.parse(data);
      const qty = parseFloat(trade.q);
      const isBuyerMaker = trade.m;

      if (isBuyerMaker) {
        cvd -= qty;
      } else {
        cvd += qty;
      }

      tradeCount++;

      // 每100笔交易输出一次状态
      if (tradeCount % 100 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        console.log(`📊 ${symbol}: CVD=${cvd.toFixed(2)}, 交易数=${tradeCount}, 耗时=${elapsed.toFixed(1)}s`);
      }
    } catch (error) {
      console.error(`❌ ${symbol} 数据解析失败:`, error.message);
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`⚠️ ${symbol} WebSocket 断开: 代码=${code}, 原因=${reason}`);
  });

  ws.on('error', (error) => {
    console.error(`❌ ${symbol} WebSocket 错误:`, error.message);
  });

  ws.on('ping', (data) => {
    console.log(`🏓 ${symbol} 收到 ping，发送 pong`);
    ws.pong(data);
  });

  // 10秒后关闭连接
  setTimeout(() => {
    if (ws.readyState === WebSocket.OPEN) {
      console.log(`🔌 ${symbol} 测试完成，关闭连接`);
      ws.close();
    }
  }, 10000);
});

// 15秒后退出程序
setTimeout(() => {
  console.log('\n✅ WebSocket 测试完成');
  process.exit(0);
}, 15000);
