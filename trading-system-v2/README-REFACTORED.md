# 重构后回测系统

## 概述

本系统是对原有回测系统的完全重构，解决了以下根本性问题：

1. **策略逻辑与回测引擎耦合过紧**：回测引擎直接调用策略实例，导致参数传递和模式切换失效
2. **参数应用机制不完善**：策略参数没有真正生效，差异化配置形同虚设
3. **盈亏比计算逻辑混乱**：多个地方计算盈亏比，逻辑不一致
4. **信号生成机制过于复杂**：多层过滤导致信号生成困难

## 设计原则

1. **分离关注点**：策略逻辑与回测引擎完全分离
2. **参数驱动**：所有策略行为完全由参数控制
3. **统一接口**：策略、回测、参数管理使用统一接口
4. **可测试性**：每个模块都可以独立测试
5. **复用现有数据库表**：充分利用现有数据库结构

## 架构设计

### 核心模块

```
src/core/
├── strategy-engine.js      # 策略引擎核心
├── base-strategy.js        # 策略基类
├── backtest-engine.js      # 回测引擎
└── database-adapter.js     # 数据库适配器
```

### 策略模块

```
src/strategies/
├── v3-strategy-refactored.js    # V3策略重构版本
└── ict-strategy-refactored.js   # ICT策略重构版本
```

### 服务模块

```
src/services/
└── backtest-manager-refactored.js  # 回测管理器重构版本
```

### API路由

```
src/routes/
└── backtest-refactored.js  # 回测API路由重构版本
```

## 核心特性

### 1. 策略引擎

- **策略注册**：支持动态注册策略
- **参数管理**：统一的参数管理系统
- **信号处理**：可扩展的信号处理器
- **模式支持**：AGGRESSIVE/BALANCED/CONSERVATIVE三种模式

### 2. 策略基类

- **参数驱动**：所有行为由参数控制
- **模式切换**：支持动态模式切换
- **指标计算**：统一的技术指标计算
- **信号生成**：标准化的信号生成流程

### 3. 回测引擎

- **数据管理**：统一的数据获取和管理
- **交易管理**：完整的交易生命周期管理
- **结果处理**：标准化的回测结果处理
- **性能优化**：内存管理和垃圾回收

### 4. 数据库适配器

- **表复用**：充分利用现有数据库表
- **数据转换**：标准化的数据格式转换
- **结果存储**：回测结果的持久化存储
- **参数管理**：策略参数的数据库管理

## 使用方法

### 1. 启动系统

```bash
# 使用PM2启动
pm2 start ecosystem.refactored.config.js

# 或直接启动
node src/main-refactored.js
```

### 2. 测试系统

```bash
# 运行测试脚本
node test-refactored-system.js

# 或使用API测试
curl http://localhost:8080/health
```

### 3. API使用

#### 启动回测

```bash
curl -X POST http://localhost:8080/api/v1/backtest/V3/BALANCED \
  -H "Content-Type: application/json" \
  -d '{
    "timeframe": "1h",
    "startDate": "2025-04-25",
    "endDate": "2025-10-22"
  }'
```

#### 设置策略参数

```bash
curl -X POST http://localhost:8080/api/v1/backtest/V3/BALANCED/parameters \
  -H "Content-Type: application/json" \
  -d '{
    "trend4HStrongThreshold": 0.6,
    "trend4HModerateThreshold": 0.4,
    "entry15MStrongThreshold": 0.5,
    "stopLossATRMultiplier": 0.5,
    "takeProfitRatio": 3.0
  }'
```

#### 获取回测结果

```bash
curl http://localhost:8080/api/v1/backtest/V3
```

## 配置说明

### 策略参数配置

#### V3策略参数

```javascript
{
  // 趋势判断参数
  trend4HStrongThreshold: 0.8,
  trend4HModerateThreshold: 0.6,
  trend4HWeakThreshold: 0.4,
  
  // 入场信号参数
  entry15MStrongThreshold: 0.7,
  entry15MModerateThreshold: 0.5,
  entry15MWeakThreshold: 0.3,
  
  // 止损止盈参数
  stopLossATRMultiplier: 0.5,
  takeProfitRatio: 3.0,
  
  // 假突破过滤参数
  fakeBreakoutFilter: {
    volFactor: 0.2,
    deltaThreshold: 0.0005,
    reclaimPct: 0.001
  }
}
```

#### ICT策略参数

```javascript
{
  // 趋势判断参数
  trend4HStrongThreshold: 0.8,
  trend4HModerateThreshold: 0.6,
  trend4HWeakThreshold: 0.4,
  
  // 入场信号参数
  entry15MStrongThreshold: 0.7,
  entry15MModerateThreshold: 0.5,
  entry15MWeakThreshold: 0.3,
  
  // 止损止盈参数
  stopLossATRMultiplier: 0.5,
  takeProfitRatio: 3.0,
  
  // ICT特有参数
  liquiditySweepThreshold: 0.002,
  orderBlockStrength: 0.6,
  fairValueGapThreshold: 0.001,
  marketStructureBreakThreshold: 0.005
}
```

### 模式配置

#### AGGRESSIVE模式
- 降低信号阈值，提高交易频率
- 收紧止损，提高盈亏比
- 放宽过滤条件

#### BALANCED模式
- 平衡的信号阈值
- 适中的止损设置
- 平衡的过滤条件

#### CONSERVATIVE模式
- 提高信号阈值，降低交易频率
- 放宽止损，降低风险
- 严格的过滤条件

## 数据库表结构

### 现有表复用

- `strategy_params`：策略参数存储
- `strategy_parameter_backtest_results`：回测结果存储
- `backtest_market_data`：市场数据存储

### 表字段说明

#### strategy_params表
- `strategy_name`：策略名称
- `mode`：模式（AGGRESSIVE/BALANCED/CONSERVATIVE）
- `parameters`：参数JSON
- `is_active`：是否激活
- `created_at`：创建时间

#### strategy_parameter_backtest_results表
- `strategy_name`：策略名称
- `mode`：模式
- `timeframe`：时间框架
- `total_trades`：总交易数
- `win_rate`：胜率
- `net_profit`：净盈利
- `profit_factor`：盈利因子
- `max_drawdown`：最大回撤
- `created_at`：创建时间

## 性能优化

### 1. 内存管理
- 定期垃圾回收
- 缓存清理机制
- 数据分页处理

### 2. 计算优化
- 指标计算缓存
- 并行处理支持
- 算法优化

### 3. 数据库优化
- 连接池管理
- 查询优化
- 索引优化

## 监控和日志

### 日志级别
- `info`：一般信息
- `warn`：警告信息
- `error`：错误信息
- `debug`：调试信息

### 监控指标
- 系统性能
- 内存使用
- 数据库连接
- 回测进度

## 故障排除

### 常见问题

1. **数据库连接失败**
   - 检查数据库配置
   - 验证连接字符串
   - 检查网络连接

2. **策略参数不生效**
   - 检查参数格式
   - 验证参数范围
   - 确认模式设置

3. **回测结果异常**
   - 检查市场数据
   - 验证策略逻辑
   - 查看错误日志

### 调试方法

1. **启用调试日志**
   ```javascript
   logger.level = 'debug';
   ```

2. **查看详细日志**
   ```bash
   pm2 logs backtest-refactored
   ```

3. **运行测试脚本**
   ```bash
   node test-refactored-system.js
   ```

## 扩展开发

### 添加新策略

1. 继承`BaseStrategy`类
2. 实现必要的方法
3. 注册到策略引擎
4. 配置参数

### 添加新指标

1. 在策略基类中添加计算方法
2. 在策略中使用指标
3. 配置指标参数

### 添加新过滤器

1. 实现过滤器接口
2. 注册到信号处理器
3. 配置过滤器参数

## 版本历史

### v2.0.0-refactored
- 完全重构系统架构
- 解决耦合问题
- 实现参数驱动
- 支持差异化配置
- 优化性能

## 贡献指南

1. Fork项目
2. 创建特性分支
3. 提交更改
4. 创建Pull Request

## 许可证

MIT License
