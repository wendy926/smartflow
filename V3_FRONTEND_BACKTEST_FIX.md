# V3策略前端回测结果显示为0的问题修复

## 问题描述

前端点击V3策略回测时，结果显示都是0，与方案3结果不一致。

## 问题分析

### 问题1：前端回测结果显示为0

**根本原因**：
- `getAllBacktestResults` 方法返回所有历史记录（按 `created_at DESC` 排序）
- 前端 `renderBacktestResults` 使用 `results.find(r => r.mode === mode)` 查找每个模式的结果
- 由于返回了多条记录，`find` 可能匹配到旧的记录，而不是最新的方案3结果

**解决方案**：
修改 `getAllBacktestResults` 方法，只返回每个模式的最新一条记录：

```javascript
async getAllBacktestResults(strategy) {
  try {
    // ✅ 修复：只返回每个模式的最新一条记录，而不是所有历史记录
    // 使用子查询获取每个模式的最新created_at，然后关联回原表获取完整记录
    const query = `
      SELECT t1.* 
      FROM strategy_parameter_backtest_results t1
      INNER JOIN (
        SELECT strategy_mode, MAX(created_at) as max_created_at
        FROM strategy_parameter_backtest_results
        WHERE strategy_name = ?
        GROUP BY strategy_mode
      ) t2 ON t1.strategy_mode = t2.strategy_mode 
         AND t1.created_at = t2.max_created_at
      WHERE t1.strategy_name = ?
      ORDER BY t1.strategy_mode
    `;

    const rows = await this.database.query(query, [strategy, strategy]);
    logger.info(`[回测管理器V3] 获取到${rows.length}条${strategy}回测结果（每个模式最新一条）`);

    return rows;
  } catch (error) {
    logger.error(`[回测管理器V3] 获取回测结果失败:`, error);
    throw error;
  }
}
```

### 问题2：V3策略从10.29之后没有新交易

**可能原因**：
1. 策略信号过滤过严（High≥70），导致没有信号产生
2. 策略worker未正常运行
3. 策略执行过程中出现错误
4. 信号产生了但没有创建交易

**需要检查**：
1. 策略worker运行状态
2. 策略执行日志
3. V3策略信号生成情况
4. 最近是否有V3交易记录

## 修复内容

### 已修复

1. ✅ **前端回测结果显示**：修改 `getAllBacktestResults` 只返回每个模式的最新一条记录

### 待检查

1. ⏳ **V3策略交易生成**：检查策略worker是否正常运行，信号是否生成，交易是否创建

## 修复文件

- `trading-system-v2/src/services/backtest-manager-v3.js`

## 部署状态

- ✅ 代码已提交并推送到GitHub
- ✅ VPS代码已更新
- ✅ 策略worker已重启

