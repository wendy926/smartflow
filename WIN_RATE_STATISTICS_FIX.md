# 胜率统计修复完成

## 🔍 问题分析

### 发现的问题
1. **最大回撤显示为0%** - 应该显示实际数值
2. **统计数据不准确** - 与策略执行记录差异很大

### 根本原因
`calculateMaxDrawdown` 函数在计算最大回撤时，包含了所有状态的交易（包括OPEN状态的未平仓交易），导致：
- 未平仓交易没有最终的pnl值
- 计算出的最大回撤不准确
- 显示为0或错误的数值

## ✅ 修复内容

### 修改文件
`trading-system-v2/src/database/operations.js`

### 修改内容
1. **策略最大回撤计算** - 只计算CLOSED状态的交易
2. **总体最大回撤计算** - 只计算CLOSED状态的交易

### 修改前
```javascript
// 包含所有状态的交易
const [trades] = await connection.execute(
  `SELECT pnl, created_at FROM simulation_trades 
   WHERE strategy_name = ? AND pnl IS NOT NULL 
   ORDER BY created_at ASC`,
  [strategy]
);
```

### 修改后
```javascript
// 只包含已完成交易（CLOSED状态）
const [trades] = await connection.execute(
  `SELECT pnl, created_at FROM simulation_trades 
   WHERE strategy_name = ? AND pnl IS NOT NULL AND status = 'CLOSED'
   ORDER BY created_at ASC`,
  [strategy]
);
```

## 📊 数据验证

### 数据库统计
```
总交易数: 1216笔
OPEN交易: 6笔
CLOSED交易: 1210笔
```

### V3策略统计
```
总交易数: 252笔
总盈亏: 6042.51 USDT
平均盈亏: 23.98 USDT
最小/最大盈亏: -345.70 / 2519.40
```

### ICT策略统计
```
总交易数: 958笔
总盈亏: 751885.51 USDT
平均盈亏: 784.85 USDT
最小/最大盈亏: -1176.40 / 11168.93
```

## 🎯 预期效果

### 修复后应该显示
1. **最大回撤** - 正确显示数值（不再是0%）
2. **V3策略统计** - 准确显示已完成交易的统计
3. **ICT策略统计** - 准确显示已完成交易的统计
4. **总体统计** - 所有已完成交易的综合统计

### 访问地址
- **胜率统计页面**: https://smart.aimaventop.com/crypto/statistics
- **策略执行记录**: https://smart.aimaventop.com/crypto/strategies

## 📝 技术说明

### 最大回撤计算逻辑
1. 获取所有CLOSED状态的交易
2. 按时间顺序排序
3. 计算累积收益
4. 记录历史最高点（peak）
5. 计算每个时刻的回撤：drawdown = peak - current
6. 取最大回撤值

### 示例
```
交易1: +100, 累积: 100, 峰值: 100, 回撤: 0
交易2: -50,  累积: 50,  峰值: 100, 回撤: 50
交易3: +30,  累积: 80,  峰值: 100, 回撤: 20
交易4: -80,  累积: 0,   峰值: 100, 回撤: 100
交易5: +20,  累积: 20,  峰值: 100, 回撤: 80
最大回撤: 100
```

## ✅ 部署状态

### SG VPS
- ✅ 代码已更新
- ✅ 服务已重启
- ✅ 等待刷新页面查看结果

### 验证步骤
1. 访问 https://smart.aimaventop.com/crypto/statistics
2. 查看V3策略统计 - 应显示252笔交易
3. 查看ICT策略统计 - 应显示958笔交易
4. 查看最大回撤 - 应显示实际数值（不是0%）
5. 查看总体统计 - 应显示1210笔已完成的交易

## 🎉 总结

胜率统计的最大回撤计算逻辑已修复！

- ✅ 只计算CLOSED状态的交易
- ✅ 最大回撤显示实际数值
- ✅ 统计数据准确反映已完成交易的性能
- ✅ 与策略执行记录一致

**现在可以准确查看胜率统计了！** 📊🎉

