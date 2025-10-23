-- ICT策略阈值参数配置
-- 为三种模式添加信号阈值参数

INSERT INTO strategy_params (strategy_name, strategy_mode, param_name, param_value, param_type, category, description, is_active, param_group, unit, min_value, max_value) VALUES
-- AGGRESSIVE模式 - 更宽松的阈值，更多交易
('ICT', 'AGGRESSIVE', 'strongSignalThreshold', '30', 'number', 'signal_thresholds', '强信号阈值', 1, 'thresholds', 'score', '10', '100'),
('ICT', 'AGGRESSIVE', 'highConfidenceThreshold', '50', 'number', 'signal_thresholds', '高置信度阈值', 1, 'thresholds', 'score', '20', '100'),
('ICT', 'AGGRESSIVE', 'medConfidenceThreshold', '30', 'number', 'signal_thresholds', '中等置信度阈值', 1, 'thresholds', 'score', '10', '80'),

-- BALANCED模式 - 平衡的阈值
('ICT', 'BALANCED', 'strongSignalThreshold', '45', 'number', 'signal_thresholds', '强信号阈值', 1, 'thresholds', 'score', '10', '100'),
('ICT', 'BALANCED', 'highConfidenceThreshold', '60', 'number', 'signal_thresholds', '高置信度阈值', 1, 'thresholds', 'score', '20', '100'),
('ICT', 'BALANCED', 'medConfidenceThreshold', '40', 'number', 'signal_thresholds', '中等置信度阈值', 1, 'thresholds', 'score', '10', '80'),

-- CONSERVATIVE模式 - 更严格的阈值，更少但更高质量的交易
('ICT', 'CONSERVATIVE', 'strongSignalThreshold', '60', 'number', 'signal_thresholds', '强信号阈值', 1, 'thresholds', 'score', '10', '100'),
('ICT', 'CONSERVATIVE', 'highConfidenceThreshold', '70', 'number', 'signal_thresholds', '高置信度阈值', 1, 'thresholds', 'score', '20', '100'),
('ICT', 'CONSERVATIVE', 'medConfidenceThreshold', '50', 'number', 'signal_thresholds', '中等置信度阈值', 1, 'thresholds', 'score', '10', '80')

ON DUPLICATE KEY UPDATE 
  param_value = VALUES(param_value), 
  updated_at = NOW();
