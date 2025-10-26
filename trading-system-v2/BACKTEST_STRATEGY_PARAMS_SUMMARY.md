# 策略参数配置和回测修复总结

## 修复完成的问题

### 1. 回测结果三种模式相同问题
**根本原因**：参数读取路径错误
- 数据库中参数按`category`字段分组（`risk_management`或`position`）
- 回测代码只读取`params?.position`分组
- V3策略的参数在`risk_management`分组下

**修复方案**：
- 更新回测代码，同时支持读取`risk_management`和`position`两个分组
- 优先级：`risk_management` > `position` > 默认值

### 2. 变量重复声明错误
**问题**：`actualRR`变量在多个位置重复声明
**修复**：重命名为`actualRRRecalculated`避免冲突

### 3. 回测数据获取问题
**问题**：ICT策略需要1D/4H/15M数据，但只获取了15M
**修复**：同时获取15m、1h、5m三个时间框架的数据

## 当前配置状态

### ICT策略参数配置

| 模式 | stopLossATRMultiplier | takeProfitRatio | 风险等级 |
|------|------------------------|-----------------|---------|
| **AGGRESSIVE** | 1.5 | 3.5 | 高风险高收益 |
| **BALANCED** | 1.8 | 4.0 | 平衡 |
| **CONSERVATIVE** | 2.0 | 4.5 | 低风险稳健 |

### V3策略参数配置

| 模式 | stopLossATRMultiplier | takeProfitRatio | 风险等级 |
|------|------------------------|-----------------|---------|
| **AGGRESSIVE** | 1.3 | 3.8 | 高风险高收益 |
| **BALANCED** | 1.5 | 4.5 | 平衡 |
| **CONSERVATIVE** | 1.8 | 5.5 | 低风险稳健 |

## 运行中的策略配置

### ICT策略
- **当前模式**：BALANCED
- **止损倍数**：1.8
- **止盈倍数**：4.0
- **参数分组**：position

### V3策略
- **当前模式**：BALANCED
- **止损倍数**：1.5
- **止盈倍数**：4.5
- **参数分组**：risk_management

## 修复文件清单

1. `src/services/backtest-strategy-engine-v3.js`
   - 修复actualRR变量重复声明
   - 添加risk_management参数路径支持
   - 强制使用参数计算止损止盈

2. `src/services/backtest-manager-v3.js`
   - 修复fetchMarketData获取多个时间框架数据
   - 修复数据库连接池使用问题
   - 修复回测结果保存时的数据清理

## 测试验证

请在 https://smart.aimaventop.com/strategy-params 重新触发回测，验证：
- ✅ ICT策略三种模式结果应该不同
- ✅ V3策略三种模式结果应该不同
- ✅ 回测使用正确的止损止盈参数

## 预期结果

### ICT策略回测预期
- AGGRESSIVE：止损较小(1.5×ATR)，止盈较低(3.5×)，高频交易
- BALANCED：止损适中(1.8×ATR)，止盈中等(4.0×)，平衡收益
- CONSERVATIVE：止损较大(2.0×ATR)，止盈较高(4.5×)，稳健收益

### V3策略回测预期
- AGGRESSIVE：止损最小(1.3×ATR)，止盈较低(3.8×)，高频交易
- BALANCED：止损适中(1.5×ATR)，止盈中等(4.5×)，平衡收益
- CONSERVATIVE：止损较大(1.8×ATR)，止盈较高(5.5×)，稳健收益

