-- 添加缺失的数据库字段
-- 用于修复交易创建失败的问题

-- 添加market_type字段
ALTER TABLE simulation_trades 
ADD COLUMN market_type VARCHAR(20) DEFAULT 'TREND' 
AFTER entry_reason;

-- 添加max_duration_hours字段  
ALTER TABLE simulation_trades 
ADD COLUMN max_duration_hours INT DEFAULT 72 
AFTER market_type;

-- 验证字段添加成功
DESCRIBE simulation_trades;
