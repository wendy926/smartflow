-- 资金费率和利率成本计算 - 数据库迁移脚本
-- 在 simulation_trades 表中添加资金费率和利率相关字段

USE trading_system;

-- 添加资金费率和利率相关字段
ALTER TABLE simulation_trades 
ADD COLUMN funding_rate DECIMAL(10, 8) DEFAULT NULL COMMENT '资金费率（每8小时）',
ADD COLUMN interest_rate DECIMAL(10, 8) DEFAULT NULL COMMENT '利率（年化）',
ADD COLUMN fee_rate DECIMAL(10, 8) DEFAULT 0.0004 COMMENT '手续费率（双向）',
ADD COLUMN hold_hours DECIMAL(10, 2) DEFAULT NULL COMMENT '持仓时长（小时）',
ADD COLUMN funding_cost DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '资金费率成本',
ADD COLUMN interest_cost DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '利息成本',
ADD COLUMN fee_cost DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '手续费成本',
ADD COLUMN raw_pnl DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '原始盈亏（未扣除成本）',
ADD COLUMN net_pnl DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '实际盈亏（扣除成本后）',
ADD COLUMN funding_rate_history JSON DEFAULT NULL COMMENT '资金费率历史记录';

-- 添加索引
CREATE INDEX idx_funding_rate ON simulation_trades(funding_rate);
CREATE INDEX idx_hold_hours ON simulation_trades(hold_hours);
CREATE INDEX idx_net_pnl ON simulation_trades(net_pnl);

-- 为现有交易设置默认值
UPDATE simulation_trades 
SET 
  funding_rate = 0.0001,
  interest_rate = 0.01,
  fee_rate = 0.0004,
  hold_hours = TIMESTAMPDIFF(HOUR, entry_time, COALESCE(exit_time, NOW())),
  funding_cost = 0,
  interest_cost = 0,
  fee_cost = margin_used * 0.0004 * 2,
  raw_pnl = pnl,
  net_pnl = pnl
WHERE status IN ('OPEN', 'CLOSED', 'STOPPED');

-- 为已平仓的交易重新计算实际盈亏
UPDATE simulation_trades 
SET 
  hold_hours = TIMESTAMPDIFF(HOUR, entry_time, exit_time),
  funding_cost = margin_used * COALESCE(funding_rate, 0.0001) * FLOOR(TIMESTAMPDIFF(HOUR, entry_time, exit_time) / 8),
  interest_cost = margin_used * COALESCE(interest_rate, 0.01) / 365 / 24 * TIMESTAMPDIFF(HOUR, entry_time, exit_time),
  fee_cost = margin_used * COALESCE(fee_rate, 0.0004) * 2,
  raw_pnl = pnl,
  net_pnl = pnl - (margin_used * COALESCE(funding_rate, 0.0001) * FLOOR(TIMESTAMPDIFF(HOUR, entry_time, exit_time) / 8)) - (margin_used * COALESCE(interest_rate, 0.01) / 365 / 24 * TIMESTAMPDIFF(HOUR, entry_time, exit_time)) - (margin_used * COALESCE(fee_rate, 0.0004) * 2)
WHERE status IN ('CLOSED', 'STOPPED') AND exit_time IS NOT NULL;

SELECT 'Migration completed!' AS status;

