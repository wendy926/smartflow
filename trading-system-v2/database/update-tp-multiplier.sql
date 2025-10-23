-- 更新止盈倍数从1.5提升到5.0 ATR以实现3:1盈亏比
-- 执行时间: 2025-10-23

-- ICT策略 - 更新三种模式的止盈倍数
UPDATE strategy_params 
SET param_value = '5.0',
    updated_at = CURRENT_TIMESTAMP
WHERE strategy_name = 'ICT' 
  AND param_name = 'takeProfitRatio'
  AND is_active = 1;

-- V3策略 - 更新三种模式的止盈倍数  
UPDATE strategy_params 
SET param_value = '5.0',
    updated_at = CURRENT_TIMESTAMP
WHERE strategy_name = 'V3' 
  AND param_name = 'takeProfitRatio'
  AND is_active = 1;

-- 验证更新结果
SELECT 
  strategy_name,
  strategy_mode,
  param_group,
  param_name,
  param_value,
  updated_at
FROM strategy_params
WHERE param_name = 'takeProfitRatio'
  AND is_active = 1
ORDER BY strategy_name, strategy_mode;

