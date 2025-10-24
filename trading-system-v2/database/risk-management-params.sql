-- 添加风险管理参数到策略参数表
-- 目的: 为ICT和V3策略添加风险管理配置，控制最大回撤在15%以内

-- ICT策略风险管理参数
INSERT INTO strategy_params (strategy_name, strategy_mode, param_name, param_value, param_type, category, description, is_active, param_group, unit, min_value, max_value) VALUES
-- AGGRESSIVE模式
('ICT', 'AGGRESSIVE', 'maxDrawdownLimit', '0.15', 'number', 'risk_management', '最大回撤限制', 1, 'risk', 'ratio', '0.05', '0.30'),
('ICT', 'AGGRESSIVE', 'maxSingleLoss', '0.02', 'number', 'risk_management', '单笔最大损失', 1, 'risk', 'ratio', '0.005', '0.05'),
('ICT', 'AGGRESSIVE', 'riskPercent', '0.01', 'number', 'risk_management', '风险百分比', 1, 'risk', 'ratio', '0.005', '0.02'),

-- BALANCED模式
('ICT', 'BALANCED', 'maxDrawdownLimit', '0.15', 'number', 'risk_management', '最大回撤限制', 1, 'risk', 'ratio', '0.05', '0.30'),
('ICT', 'BALANCED', 'maxSingleLoss', '0.015', 'number', 'risk_management', '单笔最大损失', 1, 'risk', 'ratio', '0.005', '0.05'),
('ICT', 'BALANCED', 'riskPercent', '0.008', 'number', 'risk_management', '风险百分比', 1, 'risk', 'ratio', '0.005', '0.02'),

-- CONSERVATIVE模式
('ICT', 'CONSERVATIVE', 'maxDrawdownLimit', '0.12', 'number', 'risk_management', '最大回撤限制', 1, 'risk', 'ratio', '0.05', '0.30'),
('ICT', 'CONSERVATIVE', 'maxSingleLoss', '0.01', 'number', 'risk_management', '单笔最大损失', 1, 'risk', 'ratio', '0.005', '0.05'),
('ICT', 'CONSERVATIVE', 'riskPercent', '0.005', 'number', 'risk_management', '风险百分比', 1, 'risk', 'ratio', '0.005', '0.02'),

-- V3策略风险管理参数
-- AGGRESSIVE模式
('V3', 'AGGRESSIVE', 'maxDrawdownLimit', '0.15', 'number', 'risk_management', '最大回撤限制', 1, 'risk', 'ratio', '0.05', '0.30'),
('V3', 'AGGRESSIVE', 'maxSingleLoss', '0.02', 'number', 'risk_management', '单笔最大损失', 1, 'risk', 'ratio', '0.005', '0.05'),
('V3', 'AGGRESSIVE', 'riskPercent', '0.01', 'number', 'risk_management', '风险百分比', 1, 'risk', 'ratio', '0.005', '0.02'),

-- BALANCED模式
('V3', 'BALANCED', 'maxDrawdownLimit', '0.15', 'number', 'risk_management', '最大回撤限制', 1, 'risk', 'ratio', '0.05', '0.30'),
('V3', 'BALANCED', 'maxSingleLoss', '0.015', 'number', 'risk_management', '单笔最大损失', 1, 'risk', 'ratio', '0.005', '0.05'),
('V3', 'BALANCED', 'riskPercent', '0.008', 'number', 'risk_management', '风险百分比', 1, 'risk', 'ratio', '0.005', '0.02'),

-- CONSERVATIVE模式
('V3', 'CONSERVATIVE', 'maxDrawdownLimit', '0.12', 'number', 'risk_management', '最大回撤限制', 1, 'risk', 'ratio', '0.05', '0.30'),
('V3', 'CONSERVATIVE', 'maxSingleLoss', '0.01', 'number', 'risk_management', '单笔最大损失', 1, 'risk', 'ratio', '0.005', '0.05'),
('V3', 'CONSERVATIVE', 'riskPercent', '0.005', 'number', 'risk_management', '风险百分比', 1, 'risk', 'ratio', '0.005', '0.02')

ON DUPLICATE KEY UPDATE 
  param_value = VALUES(param_value), 
  updated_at = NOW();
