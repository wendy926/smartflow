-- 初始化美股策略参数

-- V3策略参数 - 激进模式
INSERT INTO us_stock_strategy_params (strategy_name, strategy_mode, param_name, param_value, param_type, description) VALUES
('V3_US', 'AGGRESSIVE', 'emaFast', '10', 'number', '快速EMA周期'),
('V3_US', 'AGGRESSIVE', 'emaSlow', '20', 'number', '慢速EMA周期'),
('V3_US', 'AGGRESSIVE', 'rsiPeriod', '14', 'number', 'RSI周期'),
('V3_US', 'AGGRESSIVE', 'rsiOverbought', '70', 'number', 'RSI超买线'),
('V3_US', 'AGGRESSIVE', 'rsiOversold', '30', 'number', 'RSI超卖线'),
('V3_US', 'AGGRESSIVE', 'stopLoss', '0.015', 'number', '止损比例（1.5%）'),
('V3_US', 'AGGRESSIVE', 'takeProfit', '0.06', 'number', '止盈比例（6%）');

-- V3策略参数 - 平衡模式
INSERT INTO us_stock_strategy_params (strategy_name, strategy_mode, param_name, param_value, param_type, description) VALUES
('V3_US', 'BALANCED', 'emaFast', '12', 'number', '快速EMA周期'),
('V3_US', 'BALANCED', 'emaSlow', '26', 'number', '慢速EMA周期'),
('V3_US', 'BALANCED', 'rsiPeriod', '14', 'number', 'RSI周期'),
('V3_US', 'BALANCED', 'rsiOverbought', '75', 'number', 'RSI超买线'),
('V3_US', 'BALANCED', 'rsiOversold', '25', 'number', 'RSI超卖线'),
('V3_US', 'BALANCED', 'stopLoss', '0.02', 'number', '止损比例（2%）'),
('V3_US', 'BALANCED', 'takeProfit', '0.04', 'number', '止盈比例（4%）');

-- V3策略参数 - 保守模式
INSERT INTO us_stock_strategy_params (strategy_name, strategy_mode, param_name, param_value, param_type, description) VALUES
('V3_US', 'CONSERVATIVE', 'emaFast', '15', 'number', '快速EMA周期'),
('V3_US', 'CONSERVATIVE', 'emaSlow', '30', 'number', '慢速EMA周期'),
('V3_US', 'CONSERVATIVE', 'rsiPeriod', '14', 'number', 'RSI周期'),
('V3_US', 'CONSERVATIVE', 'rsiOverbought', '80', 'number', 'RSI超买线'),
('V3_US', 'CONSERVATIVE', 'rsiOversold', '20', 'number', 'RSI超卖线'),
('V3_US', 'CONSERVATIVE', 'stopLoss', '0.025', 'number', '止损比例（2.5%）'),
('V3_US', 'CONSERVATIVE', 'takeProfit', '0.03', 'number', '止盈比例（3%）');

-- ICT策略参数 - 激进模式
INSERT INTO us_stock_strategy_params (strategy_name, strategy_mode, param_name, param_value, param_type, description) VALUES
('ICT_US', 'AGGRESSIVE', 'orderBlockSize', '10', 'number', '订单块大小'),
('ICT_US', 'AGGRESSIVE', 'liquidityRange', '0.005', 'number', '流动性区间（0.5%）'),
('ICT_US', 'AGGRESSIVE', 'stopLossATRMultiplier', '1.5', 'number', '止损ATR倍数'),
('ICT_US', 'AGGRESSIVE', 'takeProfitRatio', '3.0', 'number', '止盈比率（R:R 1:3）');

-- ICT策略参数 - 平衡模式
INSERT INTO us_stock_strategy_params (strategy_name, strategy_mode, param_name, param_value, param_type, description) VALUES
('ICT_US', 'BALANCED', 'orderBlockSize', '15', 'number', '订单块大小'),
('ICT_US', 'BALANCED', 'liquidityRange', '0.008', 'number', '流动性区间（0.8%）'),
('ICT_US', 'BALANCED', 'stopLossATRMultiplier', '2.0', 'number', '止损ATR倍数'),
('ICT_US', 'BALANCED', 'takeProfitRatio', '2.0', 'number', '止盈比率（R:R 1:2）');

-- ICT策略参数 - 保守模式
INSERT INTO us_stock_strategy_params (strategy_name, strategy_mode, param_name, param_value, param_type, description) VALUES
('ICT_US', 'CONSERVATIVE', 'orderBlockSize', '20', 'number', '订单块大小'),
('ICT_US', 'CONSERVATIVE', 'liquidityRange', '0.01', 'number', '流动性区间（1%）'),
('ICT_US', 'CONSERVATIVE', 'stopLossATRMultiplier', '2.5', 'number', '止损ATR倍数'),
('ICT_US', 'CONSERVATIVE', 'takeProfitRatio', '1.5', 'number', '止盈比率（R:R 1:1.5）');

