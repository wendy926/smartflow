# 策略参数化调优实施方案

## 📋 实施概述

本方案基于 `strategy_parameterization_plan.md` 文档，实现 ICT 策略和 V3 策略的参数化调优功能，支持激进/保守/平衡三种策略模式。

**实施日期**：2025-10-19  
**目标**：通过参数调优 + 每周复盘的方式优化策略胜率

---

## 🎯 实施步骤

### 步骤 1：数据库设计 ✅

**复用现有表**：`strategy_params` 表已存在，可直接扩展使用

**扩展方案**：
- 添加 `strategy_mode` 字段（AGGRESSIVE/CONSERVATIVE/BALANCED）
- 添加 `strategy_name` 字段（ICT/V3）
- 添加 `param_group` 字段（参数分组）

**SQL 扩展**：
```sql
-- 扩展 strategy_params 表
ALTER TABLE strategy_params
ADD COLUMN strategy_name VARCHAR(20) DEFAULT 'ICT' COMMENT '策略名称',
ADD COLUMN strategy_mode ENUM('AGGRESSIVE', 'CONSERVATIVE', 'BALANCED') DEFAULT 'BALANCED' COMMENT '策略模式',
ADD COLUMN param_group VARCHAR(50) DEFAULT 'general' COMMENT '参数分组',
ADD COLUMN unit VARCHAR(20) COMMENT '参数单位',
ADD COLUMN min_value VARCHAR(50) COMMENT '最小值',
ADD COLUMN max_value VARCHAR(50) COMMENT '最大值';

-- 添加索引
CREATE INDEX idx_strategy_mode ON strategy_params(strategy_name, strategy_mode);
CREATE INDEX idx_param_group ON strategy_params(param_group);
```

---

### 步骤 2：服务端参数管理 ✅

**创建参数管理服务**：`src/services/strategy-parameter-manager.js`

**核心功能**：
1. 参数加载和缓存
2. 参数更新和历史记录
3. 参数验证
4. 参数对比（激进/保守/平衡）

---

### 步骤 3：策略集成 ✅

**ICT 策略集成**：
- 修改 `ict-strategy.js` 使用参数管理器
- 支持动态参数调整

**V3 策略集成**：
- 修改 `v3-strategy.js` 使用参数管理器
- 支持动态参数调整

---

### 步骤 4：前端界面 ✅

**创建参数化页面**：`src/web/strategy-parameters.html`

**核心功能**：
1. 参数可视化调整
2. 三种模式对比
3. 实时预览
4. 参数回测

---

### 步骤 5：单元测试 ✅

**测试覆盖**：
1. 参数管理器测试
2. ICT 策略参数化测试
3. V3 策略参数化测试

---

### 步骤 6：部署验证 ✅

**部署步骤**：
1. 执行数据库迁移
2. 部署代码
3. 运行单元测试
4. 验证功能

---

## 📊 实施状态

| 步骤 | 状态 | 说明 |
|------|------|------|
| 数据库设计 | ⏳ 待实施 | 扩展现有表 |
| 服务端参数管理 | ⏳ 待实施 | 创建参数管理器 |
| 策略集成 | ⏳ 待实施 | 集成到 ICT 和 V3 |
| 前端界面 | ⏳ 待实施 | 创建参数化页面 |
| 单元测试 | ⏳ 待实施 | 编写测试用例 |
| 部署验证 | ⏳ 待实施 | VPS 部署验证 |

---

**实施日期**：2025-10-19  
**预计完成时间**：2-3小时

