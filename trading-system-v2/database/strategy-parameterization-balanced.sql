-- 平衡策略参数配置（BALANCED）
-- 特点：当前默认配置，平衡风险和收益

USE trading_system;

-- ICT 策略平衡参数（当前默认配置）
INSERT INTO strategy_params (strategy_name, strategy_mode, param_group, param_name, param_value, param_type, category, description, unit, min_value, max_value, is_active) VALUES
-- 趋势判断参数
('ICT', 'BALANCED', 'trend', 'dailyTrendThreshold', '0.02', 'number', 'trend', '日线趋势判断阈值（平衡）', '%', '0.01', '0.03', 1),
('ICT', 'BALANCED', 'trend', 'dailyTrendLookback', '20', 'number', 'trend', '日线趋势回看期（平衡）', '天', '10', '30', 1),

-- 订单块检测参数
('ICT', 'BALANCED', 'orderblock', 'orderBlockWindowSize', '5', 'number', 'orderblock', '订单块检测窗口（平衡）', '根K线', '3', '7', 1),
('ICT', 'BALANCED', 'orderblock', 'orderBlockMaxAge', '30', 'number', 'orderblock', '订单块最大年龄（平衡）', '天', '15', '60', 1),
('ICT', 'BALANCED', 'orderblock', 'orderBlockVolumeThreshold', '1.5', 'number', 'orderblock', '订单块成交量阈值（平衡）', '倍', '1.2', '2.0', 1),

-- 扫荡检测参数
('ICT', 'BALANCED', 'sweep', 'sweepSpeedThreshold', '0.02', 'number', 'sweep', '扫荡速率阈值（平衡）', '× ATR', '0.01', '0.05', 1),
('ICT', 'BALANCED', 'sweep', 'sweepBarsToReturn', '3', 'number', 'sweep', '扫荡收回K线数（平衡）', '根', '2', '5', 1),
('ICT', 'BALANCED', 'sweep', 'sweepConfidenceBonus', '0.15', 'number', 'sweep', '扫荡置信度加成（平衡）', '%', '0.10', '0.20', 1),

-- 吞没形态参数
('ICT', 'BALANCED', 'engulfing', 'engulfingBodyRatio', '1.5', 'number', 'engulfing', '吞没实体比例（平衡）', '倍', '1.2', '2.0', 1),
('ICT', 'BALANCED', 'engulfing', 'engulfingVolumeRatio', '1.5', 'number', 'engulfing', '吞没成交量比例（平衡）', '倍', '1.2', '2.0', 1),
('ICT', 'BALANCED', 'engulfing', 'engulfingConfidenceWeight', '15', 'number', 'engulfing', '吞没形态权重（平衡）', '分', '10', '20', 1),

-- 成交量参数
('ICT', 'BALANCED', 'volume', 'volumeExpansionRatio', '1.5', 'number', 'volume', '成交量放大比例（平衡）', '倍', '1.2', '2.0', 1),
('ICT', 'BALANCED', 'volume', 'volumeConfidenceWeight', '5', 'number', 'volume', '成交量权重（平衡）', '分', '3', '10', 1),

-- 谐波形态参数
('ICT', 'BALANCED', 'harmonic', 'harmonicPatternEnabled', 'true', 'boolean', 'harmonic', '是否启用谐波形态（平衡）', '', 'true', 'false', 1),
('ICT', 'BALANCED', 'harmonic', 'harmonicConfidenceBonus', '10', 'number', 'harmonic', '谐波形态加成（平衡）', '分', '5', '15', 1),

-- 信号评分参数
('ICT', 'BALANCED', 'signal', 'signalScoreThreshold', '60', 'number', 'signal', '信号触发阈值（平衡）', '分', '50', '70', 1),
('ICT', 'BALANCED', 'signal', 'trendScoreWeight', '25', 'number', 'signal', '趋势评分权重（平衡）', '分', '20', '30', 1),
('ICT', 'BALANCED', 'signal', 'orderBlockScoreWeight', '20', 'number', 'signal', '订单块评分权重（平衡）', '分', '15', '25', 1),
('ICT', 'BALANCED', 'signal', 'engulfingScoreWeight', '15', 'number', 'signal', '吞没形态评分权重（平衡）', '分', '10', '20', 1),
('ICT', 'BALANCED', 'signal', 'sweepScoreWeight', '15', 'number', 'signal', '扫荡评分权重（平衡）', '分', '10', '20', 1),
('ICT', 'BALANCED', 'signal', 'volumeScoreWeight', '5', 'number', 'signal', '成交量评分权重（平衡）', '分', '3', '10', 1),
('ICT', 'BALANCED', 'signal', 'harmonicScoreWeight', '20', 'number', 'signal', '谐波形态评分权重（平衡）', '分', '15', '25', 1),

-- 仓位管理参数
('ICT', 'BALANCED', 'position', 'riskPercent', '0.01', 'number', 'position', '单笔风险百分比（平衡）', '%', '0.005', '0.02', 1),
('ICT', 'BALANCED', 'position', 'maxLeverage', '24', 'number', 'position', '最大杠杆倍数（平衡）', '倍', '10', '24', 1),
('ICT', 'BALANCED', 'position', 'tp1Multiplier', '2', 'number', 'position', 'TP1止盈倍数（平衡）', 'R', '1.5', '3', 1),
('ICT', 'BALANCED', 'position', 'tp2Multiplier', '3', 'number', 'position', 'TP2止盈倍数（平衡）', 'R', '2', '4', 1),
('ICT', 'BALANCED', 'position', 'tp1ClosePercent', '0.5', 'number', 'position', 'TP1平仓比例（平衡）', '%', '0.3', '0.7', 1),
('ICT', 'BALANCED', 'position', 'breakevenMove', '0.25', 'number', 'position', '保本点移动距离（平衡）', '× stopDistance', '0.2', '0.3', 1),
('ICT', 'BALANCED', 'position', 'trailingStopStep', '0.5', 'number', 'position', '移动止损步长（平衡）', '× ATR', '0.3', '0.8', 1),
('ICT', 'BALANCED', 'position', 'timeStopMinutes', '60', 'number', 'position', '时间止损分钟数（平衡）', '分钟', '30', '120', 1),
('ICT', 'BALANCED', 'position', 'timeStopExitPercent', '0.5', 'number', 'position', '时间止损平仓比例（平衡）', '%', '0.3', '0.7', 1);

-- V3 策略平衡参数（当前默认配置）
INSERT INTO strategy_params (strategy_name, strategy_mode, param_group, param_name, param_value, param_type, category, description, unit, min_value, max_value, is_active) VALUES
-- 4H 趋势判断参数
('V3', 'BALANCED', 'trend4h', 'trend4HStrongThreshold', '6', 'number', 'trend4h', '4H强趋势阈值（平衡）', '分', '5', '8', 1),
('V3', 'BALANCED', 'trend4h', 'trend4HModerateThreshold', '5', 'number', 'trend4h', '4H中等趋势阈值（平衡）', '分', '4', '7', 1),
('V3', 'BALANCED', 'trend4h', 'trend4HWeakThreshold', '4', 'number', 'trend4h', '4H弱趋势阈值（平衡）', '分', '3', '6', 1),
('V3', 'BALANCED', 'trend4h', 'trend4HADXThreshold', '30', 'number', 'trend4h', '4H ADX阈值（平衡）', '', '25', '35', 1),

-- 1H 因子参数
('V3', 'BALANCED', 'factor1h', 'factorTrendWeight', '40', 'number', 'factor1h', '趋势因子权重（平衡）', '分', '30', '50', 1),
('V3', 'BALANCED', 'factor1h', 'factorMomentumWeight', '20', 'number', 'factor1h', '动量因子权重（平衡）', '分', '15', '25', 1),
('V3', 'BALANCED', 'factor1h', 'factorVolatilityWeight', '15', 'number', 'factor1h', '波动率因子权重（平衡）', '分', '10', '20', 1),
('V3', 'BALANCED', 'factor1h', 'factorVolumeWeight', '10', 'number', 'factor1h', '成交量因子权重（平衡）', '分', '5', '15', 1),
('V3', 'BALANCED', 'factor1h', 'factorFundingWeight', '10', 'number', 'factor1h', '资金费率因子权重（平衡）', '分', '5', '15', 1),
('V3', 'BALANCED', 'factor1h', 'factorOIWeight', '5', 'number', 'factor1h', '持仓量因子权重（平衡）', '分', '3', '10', 1),
('V3', 'BALANCED', 'factor1h', 'factorADXStrongThreshold', '25', 'number', 'factor1h', 'ADX强动量阈值（平衡）', '', '20', '30', 1),
('V3', 'BALANCED', 'factor1h', 'factorADXModerateThreshold', '15', 'number', 'factor1h', 'ADX中等动量阈值（平衡）', '', '12', '18', 1),
('V3', 'BALANCED', 'factor1h', 'factorBBWHighThreshold', '0.05', 'number', 'factor1h', 'BBW高波动率阈值（平衡）', '', '0.03', '0.07', 1),
('V3', 'BALANCED', 'factor1h', 'factorBBWModerateThreshold', '0.02', 'number', 'factor1h', 'BBW中等波动率阈值（平衡）', '', '0.015', '0.03', 1),

-- 15M 入场信号参数
('V3', 'BALANCED', 'entry15m', 'entry15MStrongThreshold', '4', 'number', 'entry15m', '15M强信号阈值（平衡）', '分', '3', '5', 1),
('V3', 'BALANCED', 'entry15m', 'entry15MModerateThreshold', '3', 'number', 'entry15m', '15M中等信号阈值（平衡）', '分', '2', '4', 1),
('V3', 'BALANCED', 'entry15m', 'entry15MWeakThreshold', '2', 'number', 'entry15m', '15M弱信号阈值（平衡）', '分', '1', '3', 1),
('V3', 'BALANCED', 'entry15m', 'entry15MStructureWeight', '2', 'number', 'entry15m', '15M结构评分权重（平衡）', '分', '1', '3', 1),

-- 信号融合参数
('V3', 'BALANCED', 'signal-fusion', 'signalFusionStrongThreshold', '0.70', 'number', 'signal-fusion', '强信号阈值（平衡）', '%', '0.60', '0.80', 1),
('V3', 'BALANCED', 'signal-fusion', 'signalFusionModerateThreshold', '0.45', 'number', 'signal-fusion', '中等信号阈值（平衡）', '%', '0.40', '0.55', 1),
('V3', 'BALANCED', 'signal-fusion', 'signalFusionWeakThreshold', '0.35', 'number', 'signal-fusion', '弱信号阈值（平衡）', '%', '0.30', '0.45', 1),
('V3', 'BALANCED', 'signal-fusion', 'signalFusionTrendWeight', '0.50', 'number', 'signal-fusion', '趋势权重（平衡）', '%', '0.40', '0.60', 1),
('V3', 'BALANCED', 'signal-fusion', 'signalFusionFactorWeight', '0.35', 'number', 'signal-fusion', '因子权重（平衡）', '%', '0.25', '0.45', 1),
('V3', 'BALANCED', 'signal-fusion', 'signalFusionEntryWeight', '0.15', 'number', 'signal-fusion', '入场权重（平衡）', '%', '0.10', '0.20', 1),
('V3', 'BALANCED', 'signal-fusion', 'signalFusionCompensationEnabled', 'true', 'boolean', 'signal-fusion', '是否启用补偿机制（平衡）', '', 'true', 'false', 1),
('V3', 'BALANCED', 'signal-fusion', 'signalFusionCompensationThreshold', '0.80', 'number', 'signal-fusion', '补偿阈值（平衡）', '%', '0.70', '0.90', 1),

-- 持仓时长参数
('V3', 'BALANCED', 'duration', 'mainstreamTrendMaxHours', '168', 'number', 'duration', '主流币趋势市最大持仓（平衡）', '小时', '120', '216', 1),
('V3', 'BALANCED', 'duration', 'mainstreamRangeMaxHours', '12', 'number', 'duration', '主流币震荡市最大持仓（平衡）', '小时', '8', '18', 1),
('V3', 'BALANCED', 'duration', 'highCapTrendMaxHours', '72', 'number', 'duration', '高市值强趋势币趋势市最大持仓（平衡）', '小时', '48', '96', 1),
('V3', 'BALANCED', 'duration', 'highCapRangeMaxHours', '4', 'number', 'duration', '高市值强趋势币震荡市最大持仓（平衡）', '小时', '3', '6', 1),
('V3', 'BALANCED', 'duration', 'hotTrendMaxHours', '24', 'number', 'duration', '热点币趋势市最大持仓（平衡）', '小时', '18', '36', 1),
('V3', 'BALANCED', 'duration', 'hotRangeMaxHours', '3', 'number', 'duration', '热点币震荡市最大持仓（平衡）', '小时', '2', '5', 1),
('V3', 'BALANCED', 'duration', 'smallCapTrendMaxHours', '12', 'number', 'duration', '小币趋势市最大持仓（平衡）', '小时', '8', '18', 1),
('V3', 'BALANCED', 'duration', 'smallCapRangeMaxHours', '2', 'number', 'duration', '小币震荡市最大持仓（平衡）', '小时', '1.5', '3', 1),

-- 时间止损参数
('V3', 'BALANCED', 'time-stop', 'mainstreamTrendTimeStop', '60', 'number', 'time-stop', '主流币趋势市时间止损（平衡）', '分钟', '45', '90', 1),
('V3', 'BALANCED', 'time-stop', 'mainstreamRangeTimeStop', '30', 'number', 'time-stop', '主流币震荡市时间止损（平衡）', '分钟', '20', '45', 1),
('V3', 'BALANCED', 'time-stop', 'highCapTrendTimeStop', '120', 'number', 'time-stop', '高市值强趋势币趋势市时间止损（平衡）', '分钟', '90', '150', 1),
('V3', 'BALANCED', 'time-stop', 'highCapRangeTimeStop', '45', 'number', 'time-stop', '高市值强趋势币震荡市时间止损（平衡）', '分钟', '30', '60', 1),
('V3', 'BALANCED', 'time-stop', 'hotTrendTimeStop', '180', 'number', 'time-stop', '热点币趋势市时间止损（平衡）', '分钟', '120', '240', 1),
('V3', 'BALANCED', 'time-stop', 'hotRangeTimeStop', '60', 'number', 'time-stop', '热点币震荡市时间止损（平衡）', '分钟', '45', '90', 1),
('V3', 'BALANCED', 'time-stop', 'smallCapTrendTimeStop', '30', 'number', 'time-stop', '小币趋势市时间止损（平衡）', '分钟', '20', '45', 1),
('V3', 'BALANCED', 'time-stop', 'smallCapRangeTimeStop', '30', 'number', 'time-stop', '小币震荡市时间止损（平衡）', '分钟', '20', '45', 1),

-- 止损止盈参数
('V3', 'BALANCED', 'stop-profit', 'mainstreamTrendStopLoss', '1.5', 'number', 'stop-profit', '主流币趋势市止损倍数（平衡）', '× ATR', '1.2', '2.0', 1),
('V3', 'BALANCED', 'stop-profit', 'mainstreamTrendProfitTarget', '4.5', 'number', 'stop-profit', '主流币趋势市止盈倍数（平衡）', '× ATR', '3.5', '6.0', 1),
('V3', 'BALANCED', 'stop-profit', 'mainstreamRangeStopLoss', '1.5', 'number', 'stop-profit', '主流币震荡市止损倍数（平衡）', '× ATR', '1.2', '2.0', 1),
('V3', 'BALANCED', 'stop-profit', 'mainstreamRangeProfitTarget', '4.5', 'number', 'stop-profit', '主流币震荡市止盈倍数（平衡）', '× ATR', '3.5', '6.0', 1),
('V3', 'BALANCED', 'stop-profit', 'highCapTrendStopLoss', '2.0', 'number', 'stop-profit', '高市值强趋势币趋势市止损倍数（平衡）', '× ATR', '1.5', '2.5', 1),
('V3', 'BALANCED', 'stop-profit', 'highCapTrendProfitTarget', '6.0', 'number', 'stop-profit', '高市值强趋势币趋势市止盈倍数（平衡）', '× ATR', '5.0', '8.0', 1),
('V3', 'BALANCED', 'stop-profit', 'highCapRangeStopLoss', '2.0', 'number', 'stop-profit', '高市值强趋势币震荡市止损倍数（平衡）', '× ATR', '1.5', '2.5', 1),
('V3', 'BALANCED', 'stop-profit', 'highCapRangeProfitTarget', '6.0', 'number', 'stop-profit', '高市值强趋势币震荡市止盈倍数（平衡）', '× ATR', '5.0', '8.0', 1),
('V3', 'BALANCED', 'stop-profit', 'hotTrendStopLoss', '2.5', 'number', 'stop-profit', '热点币趋势市止损倍数（平衡）', '× ATR', '2.0', '3.0', 1),
('V3', 'BALANCED', 'stop-profit', 'hotTrendProfitTarget', '7.5', 'number', 'stop-profit', '热点币趋势市止盈倍数（平衡）', '× ATR', '6.0', '10.0', 1),
('V3', 'BALANCED', 'stop-profit', 'hotRangeStopLoss', '2.5', 'number', 'stop-profit', '热点币震荡市止损倍数（平衡）', '× ATR', '2.0', '3.0', 1),
('V3', 'BALANCED', 'stop-profit', 'hotRangeProfitTarget', '7.5', 'number', 'stop-profit', '热点币震荡市止盈倍数（平衡）', '× ATR', '6.0', '10.0', 1),
('V3', 'BALANCED', 'stop-profit', 'smallCapTrendStopLoss', '1.5', 'number', 'stop-profit', '小币趋势市止损倍数（平衡）', '× ATR', '1.2', '2.0', 1),
('V3', 'BALANCED', 'stop-profit', 'smallCapTrendProfitTarget', '4.5', 'number', 'stop-profit', '小币趋势市止盈倍数（平衡）', '× ATR', '3.5', '6.0', 1),
('V3', 'BALANCED', 'stop-profit', 'smallCapRangeStopLoss', '1.5', 'number', 'stop-profit', '小币震荡市止损倍数（平衡）', '× ATR', '1.2', '2.0', 1),
('V3', 'BALANCED', 'stop-profit', 'smallCapRangeProfitTarget', '4.5', 'number', 'stop-profit', '小币震荡市止盈倍数（平衡）', '× ATR', '3.5', '6.0', 1),

-- 置信度调整参数
('V3', 'BALANCED', 'confidence', 'confidenceHighMultiplier', '1.0', 'number', 'confidence', '高置信度倍数（平衡）', '', '0.9', '1.1', 1),
('V3', 'BALANCED', 'confidence', 'confidenceMedMultiplier', '1.2', 'number', 'confidence', '中等置信度倍数（平衡）', '', '1.0', '1.4', 1),
('V3', 'BALANCED', 'confidence', 'confidenceLowMultiplier', '1.5', 'number', 'confidence', '低置信度倍数（平衡）', '', '1.3', '1.7', 1),

-- 杠杆参数
('V3', 'BALANCED', 'leverage', 'maxLeverage', '24', 'number', 'leverage', '最大杠杆倍数（平衡）', '倍', '10', '24', 1),
('V3', 'BALANCED', 'leverage', 'leverageBuffer', '0.005', 'number', 'leverage', '杠杆计算缓冲（平衡）', '%', '0.003', '0.007', 1);

SELECT 'Balanced strategy parameters inserted successfully!' AS status;

