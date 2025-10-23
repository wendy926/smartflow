-- 修复止损参数到正确值
-- 执行时间: 2025-10-23

-- ICT策略 - 更新止损倍数到1.5 ATR
UPDATE strategy_params 
SET param_value = '1.5',
    updated_at = CURRENT_TIMESTAMP
WHERE strategy_name = 'ICT' 
  AND param_name = 'stopLossATRMultiplier'
  AND is_active = 1;

-- V3策略 - 根据模式更新止损倍数
UPDATE strategy_params 
SET param_value = CASE strategy_mode
    WHEN 'AGGRESSIVE' THEN '1.5'
    WHEN 'BALANCED' THEN '1.8'
    WHEN 'CONSERVATIVE' THEN '2.0'
    ELSE param_value
  END,
  updated_at = CURRENT_TIMESTAMP
WHERE strategy_name = 'V3' 
  AND param_name = 'stopLossATRMultiplier'
  AND is_active = 1;

-- V3策略 - 更新分级止损倍数
UPDATE strategy_params 
SET param_value = '1.5',
    updated_at = CURRENT_TIMESTAMP
WHERE strategy_name = 'V3' 
  AND param_name = 'stopLossATRMultiplier_high'
  AND is_active = 1;

UPDATE strategy_params 
SET param_value = '1.8',
    updated_at = CURRENT_TIMESTAMP
WHERE strategy_name = 'V3' 
  AND param_name = 'stopLossATRMultiplier_medium'
  AND is_active = 1;

UPDATE strategy_params 
SET param_value = '2.0',
    updated_at = CURRENT_TIMESTAMP
WHERE strategy_name = 'V3' 
  AND param_name = 'stopLossATRMultiplier_low'
  AND is_active = 1;

-- 验证更新结果
SELECT 
  strategy_name,
  strategy_mode,
  param_name,
  param_value AS '参数值',
  DATE_FORMAT(updated_at, '%H:%i:%s') AS '更新时间'
FROM strategy_params
WHERE param_name IN (
  'stopLossATRMultiplier',
  'stopLossATRMultiplier_high', 
  'stopLossATRMultiplier_medium',
  'stopLossATRMultiplier_low',
  'takeProfitRatio'
)
  AND is_active = 1
ORDER BY strategy_name, strategy_mode, param_name;

