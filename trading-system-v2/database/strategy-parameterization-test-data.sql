-- 策略参数化调优 - 测试参数数据
-- 创建 is_active = 0 的测试参数，不影响正在运行的策略

USE trading_system;

-- 插入ICT策略测试参数（激进模式）
INSERT INTO strategy_params (strategy_name, strategy_mode, param_group, param_name, param_value, param_type, category, description, unit, min_value, max_value, is_active) VALUES
('ICT', 'AGGRESSIVE', 'order_block', 'obLookbackPeriod', '20', 'number', 'order_block', '订单块回看周期', '根K线', '10', '50', 0),
('ICT', 'AGGRESSIVE', 'order_block', 'obMinStrength', '3', 'number', 'order_block', '订单块最小强度', '次', '2', '10', 0),
('ICT', 'AGGRESSIVE', 'order_block', 'obConfidenceThreshold', '0.8', 'number', 'order_block', '订单块置信度阈值', '', '0.5', '1.0', 0),
('ICT', 'AGGRESSIVE', 'order_block', 'obVolumeMultiplier', '1.5', 'number', 'order_block', '订单块成交量倍数', '倍', '1.0', '3.0', 0),
('ICT', 'AGGRESSIVE', 'order_block', 'obPriceDeviation', '0.005', 'number', 'order_block', '订单块价格偏差', '%', '0.001', '0.02', 0),

('ICT', 'AGGRESSIVE', 'liquidity_sweep', 'lsLookbackPeriod', '15', 'number', 'liquidity_sweep', '流动性扫荡回看周期', '根K线', '5', '30', 0),
('ICT', 'AGGRESSIVE', 'liquidity_sweep', 'lsMinDeviation', '0.003', 'number', 'liquidity_sweep', '流动性扫荡最小偏差', '%', '0.001', '0.01', 0),
('ICT', 'AGGRESSIVE', 'liquidity_sweep', 'lsVolumeConfirmation', '1.2', 'number', 'liquidity_sweep', '流动性扫荡成交量确认', '倍', '1.0', '2.0', 0),
('ICT', 'AGGRESSIVE', 'liquidity_sweep', 'lsTimeWindow', '4', 'number', 'liquidity_sweep', '流动性扫荡时间窗口', '小时', '1', '12', 0),

('ICT', 'AGGRESSIVE', 'engulfing', 'engMinBodyRatio', '0.7', 'number', 'engulfing', '吞没形态最小实体比例', '', '0.5', '1.0', 0),
('ICT', 'AGGRESSIVE', 'engulfing', 'engMinSize', '0.002', 'number', 'engulfing', '吞没形态最小大小', '%', '0.001', '0.01', 0),
('ICT', 'AGGRESSIVE', 'engulfing', 'engVolumeConfirmation', '1.3', 'number', 'engulfing', '吞没形态成交量确认', '倍', '1.0', '2.0', 0),

('ICT', 'AGGRESSIVE', 'harmonic', 'harmonicPatternEnabled', 'true', 'boolean', 'harmonic', '谐波形态启用', '', '', '', 0),
('ICT', 'AGGRESSIVE', 'harmonic', 'harmonicConfidenceBonus', '0.1', 'number', 'harmonic', '谐波形态置信度奖励', '', '0.0', '0.3', 0),
('ICT', 'AGGRESSIVE', 'harmonic', 'harmonicMinRatio', '0.618', 'number', 'harmonic', '谐波形态最小比例', '', '0.5', '0.8', 0),

-- 插入ICT策略测试参数（平衡模式）
('ICT', 'BALANCED', 'order_block', 'obLookbackPeriod', '25', 'number', 'order_block', '订单块回看周期', '根K线', '10', '50', 0),
('ICT', 'BALANCED', 'order_block', 'obMinStrength', '4', 'number', 'order_block', '订单块最小强度', '次', '2', '10', 0),
('ICT', 'BALANCED', 'order_block', 'obConfidenceThreshold', '0.7', 'number', 'order_block', '订单块置信度阈值', '', '0.5', '1.0', 0),
('ICT', 'BALANCED', 'order_block', 'obVolumeMultiplier', '1.3', 'number', 'order_block', '订单块成交量倍数', '倍', '1.0', '3.0', 0),
('ICT', 'BALANCED', 'order_block', 'obPriceDeviation', '0.003', 'number', 'order_block', '订单块价格偏差', '%', '0.001', '0.02', 0),

('ICT', 'BALANCED', 'liquidity_sweep', 'lsLookbackPeriod', '20', 'number', 'liquidity_sweep', '流动性扫荡回看周期', '根K线', '5', '30', 0),
('ICT', 'BALANCED', 'liquidity_sweep', 'lsMinDeviation', '0.002', 'number', 'liquidity_sweep', '流动性扫荡最小偏差', '%', '0.001', '0.01', 0),
('ICT', 'BALANCED', 'liquidity_sweep', 'lsVolumeConfirmation', '1.1', 'number', 'liquidity_sweep', '流动性扫荡成交量确认', '倍', '1.0', '2.0', 0),
('ICT', 'BALANCED', 'liquidity_sweep', 'lsTimeWindow', '6', 'number', 'liquidity_sweep', '流动性扫荡时间窗口', '小时', '1', '12', 0),

('ICT', 'BALANCED', 'engulfing', 'engMinBodyRatio', '0.6', 'number', 'engulfing', '吞没形态最小实体比例', '', '0.5', '1.0', 0),
('ICT', 'BALANCED', 'engulfing', 'engMinSize', '0.0015', 'number', 'engulfing', '吞没形态最小大小', '%', '0.001', '0.01', 0),
('ICT', 'BALANCED', 'engulfing', 'engVolumeConfirmation', '1.2', 'number', 'engulfing', '吞没形态成交量确认', '倍', '1.0', '2.0', 0),

('ICT', 'BALANCED', 'harmonic', 'harmonicPatternEnabled', 'true', 'boolean', 'harmonic', '谐波形态启用', '', '', '', 0),
('ICT', 'BALANCED', 'harmonic', 'harmonicConfidenceBonus', '0.05', 'number', 'harmonic', '谐波形态置信度奖励', '', '0.0', '0.3', 0),
('ICT', 'BALANCED', 'harmonic', 'harmonicMinRatio', '0.618', 'number', 'harmonic', '谐波形态最小比例', '', '0.5', '0.8', 0),

-- 插入ICT策略测试参数（保守模式）
('ICT', 'CONSERVATIVE', 'order_block', 'obLookbackPeriod', '30', 'number', 'order_block', '订单块回看周期', '根K线', '10', '50', 0),
('ICT', 'CONSERVATIVE', 'order_block', 'obMinStrength', '5', 'number', 'order_block', '订单块最小强度', '次', '2', '10', 0),
('ICT', 'CONSERVATIVE', 'order_block', 'obConfidenceThreshold', '0.6', 'number', 'order_block', '订单块置信度阈值', '', '0.5', '1.0', 0),
('ICT', 'CONSERVATIVE', 'order_block', 'obVolumeMultiplier', '1.1', 'number', 'order_block', '订单块成交量倍数', '倍', '1.0', '3.0', 0),
('ICT', 'CONSERVATIVE', 'order_block', 'obPriceDeviation', '0.002', 'number', 'order_block', '订单块价格偏差', '%', '0.001', '0.02', 0),

('ICT', 'CONSERVATIVE', 'liquidity_sweep', 'lsLookbackPeriod', '25', 'number', 'liquidity_sweep', '流动性扫荡回看周期', '根K线', '5', '30', 0),
('ICT', 'CONSERVATIVE', 'liquidity_sweep', 'lsMinDeviation', '0.0015', 'number', 'liquidity_sweep', '流动性扫荡最小偏差', '%', '0.001', '0.01', 0),
('ICT', 'CONSERVATIVE', 'liquidity_sweep', 'lsVolumeConfirmation', '1.05', 'number', 'liquidity_sweep', '流动性扫荡成交量确认', '倍', '1.0', '2.0', 0),
('ICT', 'CONSERVATIVE', 'liquidity_sweep', 'lsTimeWindow', '8', 'number', 'liquidity_sweep', '流动性扫荡时间窗口', '小时', '1', '12', 0),

('ICT', 'CONSERVATIVE', 'engulfing', 'engMinBodyRatio', '0.5', 'number', 'engulfing', '吞没形态最小实体比例', '', '0.5', '1.0', 0),
('ICT', 'CONSERVATIVE', 'engulfing', 'engMinSize', '0.001', 'number', 'engulfing', '吞没形态最小大小', '%', '0.001', '0.01', 0),
('ICT', 'CONSERVATIVE', 'engulfing', 'engVolumeConfirmation', '1.1', 'number', 'engulfing', '吞没形态成交量确认', '倍', '1.0', '2.0', 0),

('ICT', 'CONSERVATIVE', 'harmonic', 'harmonicPatternEnabled', 'false', 'boolean', 'harmonic', '谐波形态启用', '', '', '', 0),
('ICT', 'CONSERVATIVE', 'harmonic', 'harmonicConfidenceBonus', '0', 'number', 'harmonic', '谐波形态置信度奖励', '', '0.0', '0.3', 0),
('ICT', 'CONSERVATIVE', 'harmonic', 'harmonicMinRatio', '0.618', 'number', 'harmonic', '谐波形态最小比例', '', '0.5', '0.8', 0);

-- 插入V3策略测试参数（激进模式）
INSERT INTO strategy_params (strategy_name, strategy_mode, param_group, param_name, param_value, param_type, category, description, unit, min_value, max_value, is_active) VALUES
('V3', 'AGGRESSIVE', 'trend_analysis', 'trendLookbackPeriod', '20', 'number', 'trend_analysis', '趋势分析回看周期', '根K线', '10', '50', 0),
('V3', 'AGGRESSIVE', 'trend_analysis', 'trendConfidenceThreshold', '0.8', 'number', 'trend_analysis', '趋势置信度阈值', '', '0.5', '1.0', 0),
('V3', 'AGGRESSIVE', 'trend_analysis', 'trendVolumeConfirmation', '1.5', 'number', 'trend_analysis', '趋势成交量确认', '倍', '1.0', '3.0', 0),

('V3', 'AGGRESSIVE', 'factor_scoring', 'factorWeightTrend', '0.4', 'number', 'factor_scoring', '趋势因子权重', '', '0.1', '0.8', 0),
('V3', 'AGGRESSIVE', 'factor_scoring', 'factorWeightVolume', '0.3', 'number', 'factor_scoring', '成交量因子权重', '', '0.1', '0.8', 0),
('V3', 'AGGRESSIVE', 'factor_scoring', 'factorWeightMomentum', '0.3', 'number', 'factor_scoring', '动量因子权重', '', '0.1', '0.8', 0),
('V3', 'AGGRESSIVE', 'factor_scoring', 'factorMinScore', '0.7', 'number', 'factor_scoring', '因子最小得分', '', '0.3', '1.0', 0),

('V3', 'AGGRESSIVE', 'entry_signal', 'entryConfirmationWait', '2', 'number', 'entry_signal', '入场确认等待时间', '分钟', '1', '10', 0),
('V3', 'AGGRESSIVE', 'entry_signal', 'entryVolumeFactor', '1.3', 'number', 'entry_signal', '入场成交量因子', '倍', '1.0', '2.0', 0),
('V3', 'AGGRESSIVE', 'entry_signal', 'entryDeltaThreshold', '0.001', 'number', 'entry_signal', '入场Delta阈值', '%', '0.0001', '0.01', 0),

('V3', 'AGGRESSIVE', 'risk_control', 'riskMaxPosition', '0.1', 'number', 'risk_control', '最大仓位比例', '', '0.01', '0.5', 0),
('V3', 'AGGRESSIVE', 'risk_control', 'riskStopLoss', '0.02', 'number', 'risk_control', '止损比例', '', '0.005', '0.1', 0),
('V3', 'AGGRESSIVE', 'risk_control', 'riskTakeProfit', '0.04', 'number', 'risk_control', '止盈比例', '', '0.01', '0.2', 0),

-- 插入V3策略测试参数（平衡模式）
('V3', 'BALANCED', 'trend_analysis', 'trendLookbackPeriod', '25', 'number', 'trend_analysis', '趋势分析回看周期', '根K线', '10', '50', 0),
('V3', 'BALANCED', 'trend_analysis', 'trendConfidenceThreshold', '0.7', 'number', 'trend_analysis', '趋势置信度阈值', '', '0.5', '1.0', 0),
('V3', 'BALANCED', 'trend_analysis', 'trendVolumeConfirmation', '1.3', 'number', 'trend_analysis', '趋势成交量确认', '倍', '1.0', '3.0', 0),

('V3', 'BALANCED', 'factor_scoring', 'factorWeightTrend', '0.35', 'number', 'factor_scoring', '趋势因子权重', '', '0.1', '0.8', 0),
('V3', 'BALANCED', 'factor_scoring', 'factorWeightVolume', '0.35', 'number', 'factor_scoring', '成交量因子权重', '', '0.1', '0.8', 0),
('V3', 'BALANCED', 'factor_scoring', 'factorWeightMomentum', '0.3', 'number', 'factor_scoring', '动量因子权重', '', '0.1', '0.8', 0),
('V3', 'BALANCED', 'factor_scoring', 'factorMinScore', '0.6', 'number', 'factor_scoring', '因子最小得分', '', '0.3', '1.0', 0),

('V3', 'BALANCED', 'entry_signal', 'entryConfirmationWait', '3', 'number', 'entry_signal', '入场确认等待时间', '分钟', '1', '10', 0),
('V3', 'BALANCED', 'entry_signal', 'entryVolumeFactor', '1.2', 'number', 'entry_signal', '入场成交量因子', '倍', '1.0', '2.0', 0),
('V3', 'BALANCED', 'entry_signal', 'entryDeltaThreshold', '0.0008', 'number', 'entry_signal', '入场Delta阈值', '%', '0.0001', '0.01', 0),

('V3', 'BALANCED', 'risk_control', 'riskMaxPosition', '0.08', 'number', 'risk_control', '最大仓位比例', '', '0.01', '0.5', 0),
('V3', 'BALANCED', 'risk_control', 'riskStopLoss', '0.015', 'number', 'risk_control', '止损比例', '', '0.005', '0.1', 0),
('V3', 'BALANCED', 'risk_control', 'riskTakeProfit', '0.03', 'number', 'risk_control', '止盈比例', '', '0.01', '0.2', 0),

-- 插入V3策略测试参数（保守模式）
('V3', 'CONSERVATIVE', 'trend_analysis', 'trendLookbackPeriod', '30', 'number', 'trend_analysis', '趋势分析回看周期', '根K线', '10', '50', 0),
('V3', 'CONSERVATIVE', 'trend_analysis', 'trendConfidenceThreshold', '0.6', 'number', 'trend_analysis', '趋势置信度阈值', '', '0.5', '1.0', 0),
('V3', 'CONSERVATIVE', 'trend_analysis', 'trendVolumeConfirmation', '1.1', 'number', 'trend_analysis', '趋势成交量确认', '倍', '1.0', '3.0', 0),

('V3', 'CONSERVATIVE', 'factor_scoring', 'factorWeightTrend', '0.3', 'number', 'factor_scoring', '趋势因子权重', '', '0.1', '0.8', 0),
('V3', 'CONSERVATIVE', 'factor_scoring', 'factorWeightVolume', '0.4', 'number', 'factor_scoring', '成交量因子权重', '', '0.1', '0.8', 0),
('V3', 'CONSERVATIVE', 'factor_scoring', 'factorWeightMomentum', '0.3', 'number', 'factor_scoring', '动量因子权重', '', '0.1', '0.8', 0),
('V3', 'CONSERVATIVE', 'factor_scoring', 'factorMinScore', '0.5', 'number', 'factor_scoring', '因子最小得分', '', '0.3', '1.0', 0),

('V3', 'CONSERVATIVE', 'entry_signal', 'entryConfirmationWait', '5', 'number', 'entry_signal', '入场确认等待时间', '分钟', '1', '10', 0),
('V3', 'CONSERVATIVE', 'entry_signal', 'entryVolumeFactor', '1.1', 'number', 'entry_signal', '入场成交量因子', '倍', '1.0', '2.0', 0),
('V3', 'CONSERVATIVE', 'entry_signal', 'entryDeltaThreshold', '0.0005', 'number', 'entry_signal', '入场Delta阈值', '%', '0.0001', '0.01', 0),

('V3', 'CONSERVATIVE', 'risk_control', 'riskMaxPosition', '0.05', 'number', 'risk_control', '最大仓位比例', '', '0.01', '0.5', 0),
('V3', 'CONSERVATIVE', 'risk_control', 'riskStopLoss', '0.01', 'number', 'risk_control', '止损比例', '', '0.005', '0.1', 0),
('V3', 'CONSERVATIVE', 'risk_control', 'riskTakeProfit', '0.02', 'number', 'risk_control', '止盈比例', '', '0.01', '0.2', 0);

SELECT 'Strategy parameterization test data created successfully!' AS status;
