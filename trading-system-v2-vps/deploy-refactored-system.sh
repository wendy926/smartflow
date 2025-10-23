#!/bin/bash

# 重构后回测系统部署脚本

echo "=== 重构后回测系统部署 ==="

# 1. 备份现有文件
echo "1. 备份现有文件..."
mkdir -p backup-$(date +%Y%m%d-%H%M%S)
cp -r src/strategies backup-$(date +%Y%m%d-%H%M%S)/
cp -r src/services backup-$(date +%Y%m%d-%H%M%S)/

# 2. 创建核心目录
echo "2. 创建核心目录..."
mkdir -p src/core
mkdir -p src/routes

# 3. 部署核心模块
echo "3. 部署核心模块..."
echo "   - 策略引擎"
echo "   - 策略基类"
echo "   - 回测引擎"
echo "   - 数据库适配器"

# 4. 部署重构后的策略
echo "4. 部署重构后的策略..."
echo "   - V3策略重构版本"
echo "   - ICT策略重构版本"

# 5. 部署回测管理器
echo "5. 部署回测管理器..."
echo "   - 回测管理器重构版本"
echo "   - API路由适配器"

# 6. 更新主应用
echo "6. 更新主应用..."
cat > src/main-refactored.js << 'EOF'
/**
 * 主应用重构版本
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// 导入重构后的模块
const backtestRefactoredRouter = require('./routes/backtest-refactored');
const logger = require('./utils/logger');

const app = express();

// 中间件
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100 // 限制每个IP 15分钟内最多100个请求
});
app.use('/api/', limiter);

// 路由
app.use('/api/v1/backtest', backtestRefactoredRouter);

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0-refactored'
  });
});

// 错误处理
app.use((err, req, res, next) => {
  logger.error('应用错误', err);
  res.status(500).json({
    success: false,
    error: '内部服务器错误'
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  logger.info(`重构后回测系统启动成功，端口: ${PORT}`);
  console.log(`重构后回测系统启动成功，端口: ${PORT}`);
});

module.exports = app;
EOF

# 7. 创建PM2配置文件
echo "7. 创建PM2配置文件..."
cat > ecosystem.refactored.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'backtest-refactored',
    script: 'src/main-refactored.js',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 8080
    },
    error_file: './logs/refactored-error.log',
    out_file: './logs/refactored-out.log',
    log_file: './logs/refactored-combined.log',
    time: true
  }]
};
EOF

# 8. 创建测试脚本
echo "8. 创建测试脚本..."
cat > test-refactored-system.js << 'EOF'
/**
 * 重构后系统测试脚本
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:8080';

async function testRefactoredSystem() {
  try {
    console.log('=== 重构后系统测试 ===');
    
    // 测试1: 健康检查
    console.log('\n1. 健康检查:');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log(healthResponse.data);
    
    // 测试2: 获取支持的策略列表
    console.log('\n2. 获取支持的策略列表:');
    const strategiesResponse = await axios.get(`${BASE_URL}/api/v1/backtest/strategies`);
    console.log(strategiesResponse.data);
    
    // 测试3: 获取支持的时间框架
    console.log('\n3. 获取支持的时间框架:');
    const timeframesResponse = await axios.get(`${BASE_URL}/api/v1/backtest/timeframes`);
    console.log(timeframesResponse.data);
    
    // 测试4: 设置V3策略参数
    console.log('\n4. 设置V3策略参数:');
    const setParamsResponse = await axios.post(`${BASE_URL}/api/v1/backtest/V3/BALANCED/parameters`, {
      trend4HStrongThreshold: 0.6,
      trend4HModerateThreshold: 0.4,
      trend4HWeakThreshold: 0.2,
      entry15MStrongThreshold: 0.5,
      entry15MModerateThreshold: 0.3,
      entry15MWeakThreshold: 0.15,
      stopLossATRMultiplier: 0.5,
      takeProfitRatio: 3.0
    });
    console.log(setParamsResponse.data);
    
    // 测试5: 获取V3策略参数
    console.log('\n5. 获取V3策略参数:');
    const getParamsResponse = await axios.get(`${BASE_URL}/api/v1/backtest/V3/BALANCED/parameters`);
    console.log(getParamsResponse.data);
    
    // 测试6: 启动V3策略回测
    console.log('\n6. 启动V3策略回测:');
    const backtestResponse = await axios.post(`${BASE_URL}/api/v1/backtest/V3/BALANCED`, {
      timeframe: '1h',
      startDate: '2025-04-25',
      endDate: '2025-10-22'
    });
    console.log(backtestResponse.data);
    
    // 测试7: 获取回测结果
    console.log('\n7. 获取回测结果:');
    const resultsResponse = await axios.get(`${BASE_URL}/api/v1/backtest/V3`);
    console.log(resultsResponse.data);
    
    console.log('\n=== 测试完成 ===');
    
  } catch (error) {
    console.error('测试失败:', error.response?.data || error.message);
  }
}

testRefactoredSystem();
EOF

# 9. 设置权限
echo "9. 设置权限..."
chmod +x deploy-refactored-system.sh
chmod +x test-refactored-system.js

echo "=== 部署完成 ==="
echo "使用方法:"
echo "1. 启动重构后系统: pm2 start ecosystem.refactored.config.js"
echo "2. 测试系统: node test-refactored-system.js"
echo "3. 查看日志: pm2 logs backtest-refactored"
echo "4. 停止系统: pm2 stop backtest-refactored"
