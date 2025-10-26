# 文档更新和单元测试计划

## 📋 任务概述

### 1. 文档更新 (@https://smart.aimaventop.com/docs)

#### 当前状态
- 文档页面：`trading-system-v2/src/web/index.html` (约2.4万行)
- 主要内容：
  - AI辅助分析系统
  - V3/ICT策略实现
  - Telegram通知
  - 持仓时长管理
  - 聪明钱检测
  - 系统架构

#### 需要更新的内容

##### 1.1 系统架构文档
- **核心引擎层**：
  - `src/core/strategy-engine.js` - 策略引擎核心
  - `src/core/backtest-engine.js` - 回测引擎
- **微服务层**：
  - `src/services/backtest-manager-v3.js` - 回测管理器
  - `src/services/strategy-parameter-manager.js` - 参数管理器
  - `src/services/ai-agent/scheduler.js` - AI调度器
  - `src/services/market-data-preloader.js` - 数据预加载器

##### 1.2 新增技术栈说明
- PM2进程管理
- MySQL 8.0 + Redis 6.0
- Express.js + 中间件
- WebSocket实时监控
- Docker部署支持

##### 1.3 更新参数配置说明
- ICT/V3策略三种模式（激进/平衡/保守）参数
- 回测使用15m级别数据
- AI分析使用DeepSeek模型

### 2. 单元测试实现

#### 2.1 核心引擎层单测

##### StrategyEngine (`src/core/strategy-engine.js`)
```javascript
describe('StrategyEngine', () => {
  test('应正确注册策略', () => {});
  test('应正确执行策略', () => {});
  test('应正确处理参数管理', () => {});
  test('应正确处理信号生成', () => {});
});
```

##### BacktestEngine (`src/core/backtest-engine.js`)
```javascript
describe('BacktestEngine', () => {
  test('应正确构建K线窗口', () => {});
  test('应正确执行回测', () => {});
  test('应正确计算PnL', () => {});
  test('应正确生成回测报告', () => {});
});
```

#### 2.2 微服务层单测

##### BacktestManagerV3 (`src/services/backtest-manager-v3.js`)
```javascript
describe('BacktestManagerV3', () => {
  test('应正确启动回测', () => {});
  test('应正确获取市场数据', () => {});
  test('应正确保存回测结果', () => {});
});
```

##### StrategyParameterManager (`src/services/strategy-parameter-manager.js`)
```javascript
describe('StrategyParameterManager', () => {
  test('应正确加载参数', () => {});
  test('应正确缓存参数', () => {});
  test('应正确处理模式切换', () => {});
});
```

##### AIAnalysisScheduler (`src/services/ai-agent/scheduler.js`)
```javascript
describe('AIAnalysisScheduler', () => {
  test('应正确初始化', () => {});
  test('应正确触发宏观分析', () => {});
  test('应正确触发交易对分析', () => {});
});
```

##### MarketDataPreloader (`src/services/market-data-preloader.js`)
```javascript
describe('MarketDataPreloader', () => {
  test('应正确预加载数据', () => {});
  test('应正确处理数据更新', () => {});
  test('应正确管理缓存', () => {});
});
```

### 3. 实施步骤

#### 步骤1：创建基础测试框架
- 安装测试依赖 (Jest/Mocha)
- 创建测试目录结构
- 配置测试环境

#### 步骤2：实现核心引擎测试
- StrategyEngine测试
- BacktestEngine测试
- 参数管理测试

#### 步骤3：实现微服务测试
- BacktestManagerV3测试
- StrategyParameterManager测试
- AI调度器测试
- 数据预加载器测试

#### 步骤4：文档更新
- 更新系统架构说明
- 更新技术栈说明
- 更新参数配置说明

#### 步骤5：VPS部署验证
- 在VPS上运行测试
- 确保所有测试通过
- 更新文档为"已测试"状态

## 🎯 优先级

### 高优先级
1. ✅ 核心引擎单测 - StrategyEngine, BacktestEngine
2. ✅ 微服务单测 - BacktestManagerV3, StrategyParameterManager
3. ✅ VPS运行验证

### 中优先级
4. 文档更新 - 系统架构和技术栈
5. 文档更新 - 参数配置说明

### 低优先级
6. AI服务单测
7. 数据预加载器单测

## 📝 预期成果

1. ✅ 完整覆盖核心引擎和主要微服务
2. ✅ 所有测试在VPS环境通过
3. ✅ 文档更新反映最新系统架构
4. ✅ 测试覆盖率 > 70%

## ⚠️ 风险提示

1. **时间限制**：两个任务都很大，建议分阶段实施
2. **VPS资源**：测试运行需要额外资源，注意CPU/内存
3. **数据库依赖**：测试需要Mock或独立测试数据库
4. **异步测试**：大量异步代码需要特殊测试技巧

## 🚀 后续优化

1. CI/CD集成 - 自动运行测试
2. 性能基准测试 - 确保系统性能不降
3. E2E测试 - 端到端测试
4. 监控集成 - 测试结果监控

