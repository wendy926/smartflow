-- 保守策略参数配置（CONSERVATIVE）
-- 特点：更严格信号，更宽止损，更低风险

USE trading_system;

-- ICT 策略保守参数
INSERT INTO strategy_params (strategy_name, strategy_mode, param_group, param_name, param_value, param_type, category, description, unit, min_value, max_value, is_active) VALUES
-- 趋势判断参数
('ICT', 'CONSERVATIVE', 'trend', 'dailyTrendThreshold', '0.025', 'number', 'trend', '日线趋势判断阈值（保守）', '%', '0.01', '0.03', 1),
('ICT', 'CONSERVATIVE', 'trend', 'dailyTrendLookback', '25', 'number', 'trend', '日线趋势回看期（保守）', '天', '10', '30', 1),

-- 订单块检测参数
('ICT', 'CONSERVATIVE', 'orderblock', 'orderBlockWindowSize', '7', 'number', 'orderblock', '订单块检测窗口（保守）', '根K线', '3', '7', 1),
('ICT', 'CONSERVATIVE', 'orderblock', 'orderBlockMaxAge', '20', 'number', 'orderblock', '订单块最大年龄（保守）', '天', '15', '60', 1),
('ICT', 'CONSERVATIVE', 'orderblock', 'orderBlockVolumeThreshold', '1.8', 'number', 'orderblock', '订单块成交量阈值（保守）', '倍', '1.2', '2.0', 1),

-- 扫荡检测参数
('ICT', 'CONSERVATIVE', 'sweep', 'sweepSpeedThreshold', '0.03', 'number', 'sweep', '扫荡速率阈值（保守）', '× ATR', '0.01', '0.05', 1),
('ICT', 'CONSERVATIVE', 'sweep', 'sweepBarsToReturn', '4', 'number', 'sweep', '扫荡收回K线数（保守）', '根', '2', '5', 1),
('ICT', 'CONSERVATIVE', 'sweep', 'sweepConfidenceBonus', '0.18', 'number', 'sweep', '扫荡置信度加成（保守）', '%', '0.10', '0.20', 1),

-- 吞没形态参数
('ICT', 'CONSERVATIVE', 'engulfing', 'engulfingBodyRatio', '1.8', 'number', 'engulfing', '吞没实体比例（保守）', '倍', '1.2', '2.0', 1),
('ICT', 'CONSERVATIVE', 'engulfing', 'engulfingVolumeRatio', '1.8', 'number', 'engulfing', '吞没成交量比例（保守）', '倍', '1.2', '2.0', 1),
('ICT', 'CONSERVATIVE', 'engulfing', 'engulfingConfidenceWeight', '18', 'number', 'engulfing', '吞没形态权重（保守）', '分', '10', '20', 1),

-- 成交量参数
('ICT', 'CONSERVATIVE', 'volume', 'volumeExpansionRatio', '1.8', 'number', 'volume', '成交量放大比例（保守）', '倍', '1.2', '2.0', 1),
('ICT', 'CONSERVATIVE', 'volume', 'volumeConfidenceWeight', '7', 'number', 'volume', '成交量权重（保守）', '分', '3', '10', 1),

-- 谐波形态参数
('ICT', 'CONSERVATIVE', 'harmonic', 'harmonicPatternEnabled', 'false', 'boolean', 'harmonic', '是否启用谐波形态（保守）', '', 'true', 'false', 1),
('ICT', 'CONSERVATIVE', 'harmonic', 'harmonicConfidenceBonus', '0', 'number', 'harmonic', '谐波形态加成（保守）', '分', '5', '15', 1),

-- 信号评分参数
('ICT', 'CONSERVATIVE', 'signal', 'signalScoreThreshold', '65', 'number', 'signal', '信号触发阈值（保守）', '分', '50', '70', 1),
('ICT', 'CONSERVATIVE', 'signal', 'trendScoreWeight', '28', 'number', 'signal', '趋势评分权重（保守）', '分', '20', '30', 1),
('ICT', 'CONSERVATIVE', 'signal', 'orderBlockScoreWeight', '22', 'number', 'signal', '订单块评分权重（保守）', '分', '15', '25', 1),
('ICT', 'CONSERVATIVE', 'signal', 'engulfingScoreWeight', '17', 'number', 'signal', '吞没形态评分权重（保守）', '分', '10', '20', 1),
('ICT', 'CONSERVATIVE', 'signal', 'sweepScoreWeight', '17', 'number', 'signal', '扫荡评分权重（保守）', '分', '10', '20', 1),
('ICT', 'CONSERVATIVE', 'signal', 'volumeScoreWeight', '7', 'number', 'signal', '成交量评分权重（保守）', '分', '3', '10', 1),
('ICT', 'CONSERVATIVE', 'signal', 'harmonicScoreWeight', '22', 'number', 'signal', '谐波形态评分权重（保守）', '分', '15', '25', 1),

-- 仓位管理参数
('ICT', 'CONSERVATIVE', 'position', 'riskPercent', '0.0075', 'number', 'position', '单笔风险百分比（保守）', '%', '0.005', '0.02', 1),
('ICT', 'CONSERVATIVE', 'position', 'maxLeverage', '15', 'number', 'position', '最大杠杆倍数（保守）', '倍', '10', '24', 1),
('ICT', 'CONSERVATIVE', 'position', 'tp1Multiplier', '2.5', 'number', 'position', 'TP1止盈倍数（保守）', 'R', '1.5', '3', 1),
('ICT', 'CONSERVATIVE', 'position', 'tp2Multiplier', '3.5', 'number', 'position', 'TP2止盈倍数（保守）', 'R', '2', '4', 1),
('ICT', 'CONSERVATIVE', 'position', 'tp1ClosePercent', '0.6', 'number', 'position', 'TP1平仓比例（保守）', '%', '0.3', '0.7', 1),
('ICT', 'CONSERVATIVE', 'position', 'breakevenMove', '0.28', 'number', 'position', '保本点移动距离（保守）', '× stopDistance', '0.2', '0.3', 1),
('ICT', 'CONSERVATIVE', 'position', 'trailingStopStep', '0.6', 'number', 'position', '移动止损步长（保守）', '× ATR', '0.3', '0.8', 1),
('ICT', 'CONSERVATIVE', 'position', 'timeStopMinutes', '90', 'number', 'position', '时间止损分钟数（保守）', '分钟', '30', '120', 1),
('ICT', 'CONSERVATIVE', 'position', 'timeStopExitPercent', '0.6', 'number', 'position', '时间止损平仓比例（保守）', '%', '0.3', '0.7', 1);

-- V3 策略保守参数
INSERT INTO strategy_params (strategy_name, strategy_mode, param_group, param_name, param_value, param_type, category, description, unit, min_value, max_value, is_active) VALUES
-- 4H 趋势判断参数
('V3', 'CONSERVATIVE', 'trend4h', 'trend4HStrongThreshold', '7', 'number', 'trend4h', '4H强趋势阈值（保守）', '分', '5', '8', 1),
('V3', 'CONSERVATIVE', 'trend4h', 'trend4HModerateThreshold', '6', 'number', 'trend4h', '4H中等趋势阈值（保守）', '分', '4', '7', 1),
('V3', 'CONSERVATIVE', 'trend4h', 'trend4HWeakThreshold', '5', 'number', 'trend4h', '4H弱趋势阈值（保守）', '分', '3', '6', 1),
('V3', 'CONSERVATIVE', 'trend4h', 'trend4HADXThreshold', '35', 'number', 'trend4h', '4H ADX阈值（保守）', '', '25', '35', 1),

-- 1H 因子参数
('V3', 'CONSERVATIVE', 'factor1h', 'factorTrendWeight', '45', 'number', 'factor1h', '趋势因子权重（保守）', '分', '30', '50', 1),
('V3', 'CONSERVATIVE', 'factor1h', 'factorMomentumWeight', '22', 'number', 'factor1h', '动量因子权重（保守）', '分', '15', '25', 1),
('V3', 'CONSERVATIVE', 'factor1h', 'factorVolatilityWeight', '17', 'number', 'factor1h', '波动率因子权重（保守）', '分', '10', '20', 1),
('V3', 'CONSERVATIVE', 'factor1h', 'factorVolumeWeight', '12', 'number', 'factor1h', '成交量因子权重（保守）', '分', '5', '15', 1),
('V3', 'CONSERVATIVE', 'factor1h', 'factorFundingWeight', '12', 'number', 'factor1h', '资金费率因子权重（保守）', '分', '5', '15', 1),
('V3', 'CONSERVATIVE', 'factor1h', 'factorOIWeight', '7', 'number', 'factor1h', '持仓量因子权重（保守）', '分', '3', '10', 1),
('V3', 'CONSERVATIVE', 'factor1h', 'factorADXStrongThreshold', '28', 'number', 'factor1h', 'ADX强动量阈值（保守）', '', '20', '30', 1),
('V3', 'CONSERVATIVE', 'factor1h', 'factorADXModerateThreshold', '16', 'number', 'factor1h', 'ADX中等动量阈值（保守）', '', '12', '18', 1),
('V3', 'CONSERVATIVE', 'factor1h', 'factorBBWHighThreshold', '0.06', 'number', 'factor1h', 'BBW高波动率阈值（保守）', '', '0.03', '0.07', 1),
('V3', 'CONSERVATIVE', 'factor1h', 'factorBBWModerateThreshold', '0.025', 'number', 'factor1h', 'BBW中等波动率阈值（保守）', '', '0.015', '0.03', 1),

-- 15M 入场信号参数
('V3', 'CONSERVATIVE', 'entry15m', 'entry15MStrongThreshold', '5', 'number', 'entry15m', '15M强信号阈值（保守）', '分', '3', '5', 1),
('V3', 'CONSERVATIVE', 'entry15m', 'entry15MModerateThreshold', '4', 'number', 'entry15m', '15M中等信号阈值（保守）', '分', '2', '4', 1),
('V3', 'CONSERVATIVE', 'entry15m', 'entry15MWeakThreshold', '3', 'number', 'entry15m', '15M弱信号阈值（保守）', '分', '1', '3', 1),
('V3', 'CONSERVATIVE', 'entry15m', 'entry15MStructureWeight', '3', 'number', 'entry15m', '15M结构评分权重（保守）', '分', '1', '3', 1),

-- 信号融合参数
('V3', 'CONSERVATIVE', 'signal-fusion', 'signalFusionStrongThreshold', '0.75', 'number', 'signal-fusion', '强信号阈值（保守）', '%', '0.60', '0.80', 1),
('V3', 'CONSERVATIVE', 'signal-fusion', 'signalFusionModerateThreshold', '0.50', 'number', 'signal-fusion', '中等信号阈值（保守）', '%', '0.40', '0.55', 1),
('V3', 'CONSERVATIVE', 'signal-fusion', 'signalFusionWeakThreshold', '0.40', 'number', 'signal-fusion', '弱信号阈值（保守）', '%', '0.30', '0.45', 1),
('V3', 'CONSERVATIVE', 'signal-fusion', 'signalFusionTrendWeight', '0.55', 'number', 'signal-fusion', '趋势权重（保守）', '%', '0.40', '0.60', 1),
('V3', 'CONSERVATIVE', 'signal-fusion', 'signalFusionFactorWeight', '0.40', 'number', 'signal-fusion', '因子权重（保守）', '%', '0.25', '0.45', 1),
('V3', 'CONSERVATIVE', 'signal-fusion', 'signalFusionEntryWeight', '0.18', 'number', 'signal-fusion', '入场权重（保守）', '%', '0.10', '0.20', 1),
('V3', 'CONSERVATIVE', 'signal-fusion', 'signalFusionCompensationEnabled', 'false', 'boolean', 'signal-fusion', '是否启用补偿机制（保守）', '', 'true', 'false', 1),
('V3', 'CONSERVATIVE', 'signal-fusion', 'signalFusionCompensationThreshold', '0.85', 'number', 'signal-fusion', '补偿阈值（保守）', '%', '0.70', '0.90', 1),

-- 持仓时长参数
('V3', 'CONSERVATIVE', 'duration', 'mainstreamTrendMaxHours', '144', 'number', 'duration', '主流币趋势市最大持仓（保守）', '小时', '120', '216', 1),
('V3', 'CONSERVATIVE', 'duration', 'mainstreamRangeMaxHours', '10', 'number', 'duration', '主流币震荡市最大持仓（保守）', '小时', '8', '18', 1),
('V3', 'CONSERVATIVE', 'duration', 'highCapTrendMaxHours', '60', 'number', 'duration', '高市值强趋势币趋势市最大持仓（保守）', '小时', '48', '96', 1),
('V3', 'CONSERVATIVE', 'duration', 'highCapRangeMaxHours', '3.5', 'number', 'duration', '高市值强趋势币震荡市最大持仓（保守）', '小时', '3', '6', 1),
('V3', 'CONSERVATIVE', 'duration', 'hotTrendMaxHours', '20', 'number', 'duration', '热点币趋势市最大持仓（保守）', '小时', '18', '36', 1),
('V3', 'CONSERVATIVE', 'duration', 'hotRangeMaxHours', '2.5', 'number', 'duration', '热点币震荡市最大持仓（保守）', '小时', '2', '5', 1),
('V3', 'CONSERVATIVE', 'duration', 'smallCapTrendMaxHours', '10', 'number', 'duration', '小币趋势市最大持仓（保守）', '小时', '8', '18', 1),
('V3', 'CONSERVATIVE', 'duration', 'smallCapRangeMaxHours', '1.5', 'number', 'duration', '小币震荡市最大持仓（保守）', '小时', '1.5', '3', 1),

-- 时间止损参数
('V3', 'CONSERVATIVE', 'time-stop', 'mainstreamTrendTimeStop', '50', 'number', 'time-stop', '主流币趋势市时间止损（保守）', '分钟', '45', '90', 1),
('V3', 'CONSERVATIVE', 'time-stop', 'mainstreamRangeTimeStop', '25', 'number', 'time-stop', '主流币震荡市时间止损（保守）', '分钟', '20', '45', 1),
('V3', 'CONSERVATIVE', 'time-stop', 'highCapTrendTimeStop', '105', 'number', 'time-stop', '高市值强趋势币趋势市时间止损（保守）', '分钟', '90', '150', 1),
('V3', 'CONSERVATIVE', 'time-stop', 'highCapRangeTimeStop', '40', 'number', 'time-stop', '高市值强趋势币震荡市时间止损（保守）', '分钟', '30', '60', 1),
('V3', 'CONSERVATIVE', 'time-stop', 'hotTrendTimeStop', '150', 'number', 'time-stop', '热点币趋势市时间止损（保守）', '分钟', '120', '240', 1),
('V3', 'CONSERVATIVE', 'time-stop', 'hotRangeTimeStop', '50', 'number', 'time-stop', '热点币震荡市时间止损（保守）', '分钟', '45', '90', 1),
('V3', 'CONSERVATIVE', 'time-stop', 'smallCapTrendTimeStop', '25', 'number', 'time-stop', '小币趋势市时间止损（保守）', '分钟', '20', '45', 1),
('V3', 'CONSERVATIVE', 'time-stop', 'smallCapRangeTimeStop', '25', 'number', 'time-stop', '小币震荡市时间止损（保守）', '分钟', '20', '45', 1),

-- 止损止盈参数
('V3', 'CONSERVATIVE', 'stop-profit', 'mainstreamTrendStopLoss', '1.8', 'number', 'stop-profit', '主流币趋势市止损倍数（保守）', '× ATR', '1.2', '2.0', 1),
('V3', 'CONSERVATIVE', 'stop-profit', 'mainstreamTrendProfitTarget', '5.5', 'number', 'stop-profit', '主流币趋势市止盈倍数（保守）', '× ATR', '3.5', '6.0', 1),
('V3', 'CONSERVATIVE', 'stop-profit', 'mainstreamRangeStopLoss', '1.8', 'number', 'stop-profit', '主流币震荡市止损倍数（保守）', '× ATR', '1.2', '2.0', 1),
('V3', 'CONSERVATIVE', 'stop-profit', 'mainstreamRangeProfitTarget', '5.5', 'number', 'stop-profit', '主流币震荡市止盈倍数（保守）', '× ATR', '3.5', '6.0', 1),
('V3', 'CONSERVATIVE', 'stop-profit', 'highCapTrendStopLoss', '2.3', 'number', 'stop-profit', '高市值强趋势币趋势市止损倍数（保守）', '× ATR', '1.5', '2.5', 1),
('V3', 'CONSERVATIVE', 'stop-profit', 'highCapTrendProfitTarget', '7.0', 'number', 'stop-profit', '高市值强趋势币趋势市止盈倍数（保守）', '× ATR', '5.0', '8.0', 1),
('V3', 'CONSERVATIVE', 'stop-profit', 'highCapRangeStopLoss', '2.3', 'number', 'stop-profit', '高市值强趋势币震荡市止损倍数（保守）', '× ATR', '1.5', '2.5', 1),
('V3', 'CONSERVATIVE', 'stop-profit', 'highCapRangeProfitTarget', '7.0', 'number', 'stop-profit', '高市值强趋势币震荡市止盈倍数（保守）', '× ATR', '5.0', '8.0', 1),
('V3', 'CONSERVATIVE', 'stop-profit', 'hotTrendStopLoss', '2.8', 'number', 'stop-profit', '热点币趋势市止损倍数（保守）', '× ATR', '2.0', '3.0', 1),
('V3', 'CONSERVATIVE', 'stop-profit', 'hotTrendProfitTarget', '8.5', 'number', 'stop-profit', '热点币趋势市止盈倍数（保守）', '× ATR', '6.0', '10.0', 1),
('V3', 'CONSERVATIVE', 'stop-profit', 'hotRangeStopLoss', '2.8', 'number', 'stop-profit', '热点币震荡市止损倍数（保守）', '× ATR', '2.0', '3.0', 1),
('V3', 'CONSERVATIVE', 'stop-profit', 'hotRangeProfitTarget', '8.5', 'number', 'stop-profit', '热点币震荡市止盈倍数（保守）', '× ATR', '6.0', '10.0', 1),
('V3', 'CONSERVATIVE', 'stop-profit', 'smallCapTrendStopLoss', '1.8', 'number', 'stop-profit', '小币趋势市止损倍数（保守）', '× ATR', '1.2', '2.0', 1),
('V3', 'CONSERVATIVE', 'stop-profit', 'smallCapTrendProfitTarget', '5.5', 'number', 'stop-profit', '小币趋势市止盈倍数（保守）', '× ATR', '3.5', '6.0', 1),
('V3', 'CONSERVATIVE', 'stop-profit', 'smallCapRangeStopLoss', '1.8', 'number', 'stop-profit', '小币震荡市止损倍数（保守）', '× ATR', '1.2', '2.0', 1),
('V3', 'CONSERVATIVE', 'stop-profit', 'smallCapRangeProfitTarget', '5.5', 'number', 'stop-profit', '小币震荡市止盈倍数（保守）', '× ATR', '3.5', '6.0', 1),

-- 置信度调整参数
('V3', 'CONSERVATIVE', 'confidence', 'confidenceHighMultiplier', '1.05', 'number', 'confidence', '高置信度倍数（保守）', '', '0.9', '1.1', 1),
('V3', 'CONSERVATIVE', 'confidence', 'confidenceMedMultiplier', '1.25', 'number', 'confidence', '中等置信度倍数（保守）', '', '1.0', '1.4', 1),
('V3', 'CONSERVATIVE', 'confidence', 'confidenceLowMultiplier', '1.55', 'number', 'confidence', '低置信度倍数（保守）', '', '1.3', '1.7', 1),

-- 杠杆参数
('V3', 'CONSERVATIVE', 'leverage', 'maxLeverage', '15', 'number', 'leverage', '最大杠杆倍数（保守）', '倍', '10', '24', 1),
('V3', 'CONSERVATIVE', 'leverage', 'leverageBuffer', '0.006', 'number', 'leverage', '杠杆计算缓冲（保守）', '%', '0.003', '0.007', 1);

SELECT 'Conservative strategy parameters inserted successfully!' AS status;

