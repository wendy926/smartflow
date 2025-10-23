-- 激进策略参数配置（AGGRESSIVE）
-- 特点：更多交易机会，更紧止损，更高风险

USE trading_system;

-- ICT 策略激进参数
INSERT INTO strategy_params (strategy_name, strategy_mode, param_group, param_name, param_value, param_type, category, description, unit, min_value, max_value, is_active) VALUES
-- 趋势判断参数
('ICT', 'AGGRESSIVE', 'trend', 'dailyTrendThreshold', '0.015', 'number', 'trend', '日线趋势判断阈值（激进）', '%', '0.01', '0.03', 1),
('ICT', 'AGGRESSIVE', 'trend', 'dailyTrendLookback', '15', 'number', 'trend', '日线趋势回看期（激进）', '天', '10', '30', 1),

-- 订单块检测参数
('ICT', 'AGGRESSIVE', 'orderblock', 'orderBlockWindowSize', '3', 'number', 'orderblock', '订单块检测窗口（激进）', '根K线', '3', '7', 1),
('ICT', 'AGGRESSIVE', 'orderblock', 'orderBlockMaxAge', '45', 'number', 'orderblock', '订单块最大年龄（激进）', '天', '15', '60', 1),
('ICT', 'AGGRESSIVE', 'orderblock', 'orderBlockVolumeThreshold', '1.3', 'number', 'orderblock', '订单块成交量阈值（激进）', '倍', '1.2', '2.0', 1),

-- 扫荡检测参数
('ICT', 'AGGRESSIVE', 'sweep', 'sweepSpeedThreshold', '0.015', 'number', 'sweep', '扫荡速率阈值（激进）', '× ATR', '0.01', '0.05', 1),
('ICT', 'AGGRESSIVE', 'sweep', 'sweepBarsToReturn', '2', 'number', 'sweep', '扫荡收回K线数（激进）', '根', '2', '5', 1),
('ICT', 'AGGRESSIVE', 'sweep', 'sweepConfidenceBonus', '0.12', 'number', 'sweep', '扫荡置信度加成（激进）', '%', '0.10', '0.20', 1),

-- 吞没形态参数
('ICT', 'AGGRESSIVE', 'engulfing', 'engulfingBodyRatio', '1.3', 'number', 'engulfing', '吞没实体比例（激进）', '倍', '1.2', '2.0', 1),
('ICT', 'AGGRESSIVE', 'engulfing', 'engulfingVolumeRatio', '1.3', 'number', 'engulfing', '吞没成交量比例（激进）', '倍', '1.2', '2.0', 1),
('ICT', 'AGGRESSIVE', 'engulfing', 'engulfingConfidenceWeight', '12', 'number', 'engulfing', '吞没形态权重（激进）', '分', '10', '20', 1),

-- 成交量参数
('ICT', 'AGGRESSIVE', 'volume', 'volumeExpansionRatio', '1.3', 'number', 'volume', '成交量放大比例（激进）', '倍', '1.2', '2.0', 1),
('ICT', 'AGGRESSIVE', 'volume', 'volumeConfidenceWeight', '4', 'number', 'volume', '成交量权重（激进）', '分', '3', '10', 1),

-- 谐波形态参数
('ICT', 'AGGRESSIVE', 'harmonic', 'harmonicPatternEnabled', 'true', 'boolean', 'harmonic', '是否启用谐波形态（激进）', '', 'true', 'false', 1),
('ICT', 'AGGRESSIVE', 'harmonic', 'harmonicConfidenceBonus', '8', 'number', 'harmonic', '谐波形态加成（激进）', '分', '5', '15', 1),

-- 信号评分参数
('ICT', 'AGGRESSIVE', 'signal', 'signalScoreThreshold', '55', 'number', 'signal', '信号触发阈值（激进）', '分', '50', '70', 1),
('ICT', 'AGGRESSIVE', 'signal', 'trendScoreWeight', '22', 'number', 'signal', '趋势评分权重（激进）', '分', '20', '30', 1),
('ICT', 'AGGRESSIVE', 'signal', 'orderBlockScoreWeight', '18', 'number', 'signal', '订单块评分权重（激进）', '分', '15', '25', 1),
('ICT', 'AGGRESSIVE', 'signal', 'engulfingScoreWeight', '13', 'number', 'signal', '吞没形态评分权重（激进）', '分', '10', '20', 1),
('ICT', 'AGGRESSIVE', 'signal', 'sweepScoreWeight', '13', 'number', 'signal', '扫荡评分权重（激进）', '分', '10', '20', 1),
('ICT', 'AGGRESSIVE', 'signal', 'volumeScoreWeight', '4', 'number', 'signal', '成交量评分权重（激进）', '分', '3', '10', 1),
('ICT', 'AGGRESSIVE', 'signal', 'harmonicScoreWeight', '18', 'number', 'signal', '谐波形态评分权重（激进）', '分', '15', '25', 1),

-- 仓位管理参数
('ICT', 'AGGRESSIVE', 'position', 'riskPercent', '0.015', 'number', 'position', '单笔风险百分比（激进）', '%', '0.005', '0.02', 1),
('ICT', 'AGGRESSIVE', 'position', 'maxLeverage', '20', 'number', 'position', '最大杠杆倍数（激进）', '倍', '10', '24', 1),
('ICT', 'AGGRESSIVE', 'position', 'tp1Multiplier', '1.8', 'number', 'position', 'TP1止盈倍数（激进）', 'R', '1.5', '3', 1),
('ICT', 'AGGRESSIVE', 'position', 'tp2Multiplier', '2.5', 'number', 'position', 'TP2止盈倍数（激进）', 'R', '2', '4', 1),
('ICT', 'AGGRESSIVE', 'position', 'tp1ClosePercent', '0.4', 'number', 'position', 'TP1平仓比例（激进）', '%', '0.3', '0.7', 1),
('ICT', 'AGGRESSIVE', 'position', 'breakevenMove', '0.22', 'number', 'position', '保本点移动距离（激进）', '× stopDistance', '0.2', '0.3', 1),
('ICT', 'AGGRESSIVE', 'position', 'trailingStopStep', '0.4', 'number', 'position', '移动止损步长（激进）', '× ATR', '0.3', '0.8', 1),
('ICT', 'AGGRESSIVE', 'position', 'timeStopMinutes', '45', 'number', 'position', '时间止损分钟数（激进）', '分钟', '30', '120', 1),
('ICT', 'AGGRESSIVE', 'position', 'timeStopExitPercent', '0.4', 'number', 'position', '时间止损平仓比例（激进）', '%', '0.3', '0.7', 1);

-- V3 策略激进参数
INSERT INTO strategy_params (strategy_name, strategy_mode, param_group, param_name, param_value, param_type, category, description, unit, min_value, max_value, is_active) VALUES
-- 4H 趋势判断参数
('V3', 'AGGRESSIVE', 'trend4h', 'trend4HStrongThreshold', '5', 'number', 'trend4h', '4H强趋势阈值（激进）', '分', '5', '8', 1),
('V3', 'AGGRESSIVE', 'trend4h', 'trend4HModerateThreshold', '4', 'number', 'trend4h', '4H中等趋势阈值（激进）', '分', '4', '7', 1),
('V3', 'AGGRESSIVE', 'trend4h', 'trend4HWeakThreshold', '3', 'number', 'trend4h', '4H弱趋势阈值（激进）', '分', '3', '6', 1),
('V3', 'AGGRESSIVE', 'trend4h', 'trend4HADXThreshold', '25', 'number', 'trend4h', '4H ADX阈值（激进）', '', '25', '35', 1),

-- 1H 因子参数
('V3', 'AGGRESSIVE', 'factor1h', 'factorTrendWeight', '35', 'number', 'factor1h', '趋势因子权重（激进）', '分', '30', '50', 1),
('V3', 'AGGRESSIVE', 'factor1h', 'factorMomentumWeight', '18', 'number', 'factor1h', '动量因子权重（激进）', '分', '15', '25', 1),
('V3', 'AGGRESSIVE', 'factor1h', 'factorVolatilityWeight', '13', 'number', 'factor1h', '波动率因子权重（激进）', '分', '10', '20', 1),
('V3', 'AGGRESSIVE', 'factor1h', 'factorVolumeWeight', '8', 'number', 'factor1h', '成交量因子权重（激进）', '分', '5', '15', 1),
('V3', 'AGGRESSIVE', 'factor1h', 'factorFundingWeight', '8', 'number', 'factor1h', '资金费率因子权重（激进）', '分', '5', '15', 1),
('V3', 'AGGRESSIVE', 'factor1h', 'factorOIWeight', '4', 'number', 'factor1h', '持仓量因子权重（激进）', '分', '3', '10', 1),
('V3', 'AGGRESSIVE', 'factor1h', 'factorADXStrongThreshold', '22', 'number', 'factor1h', 'ADX强动量阈值（激进）', '', '20', '30', 1),
('V3', 'AGGRESSIVE', 'factor1h', 'factorADXModerateThreshold', '14', 'number', 'factor1h', 'ADX中等动量阈值（激进）', '', '12', '18', 1),
('V3', 'AGGRESSIVE', 'factor1h', 'factorBBWHighThreshold', '0.04', 'number', 'factor1h', 'BBW高波动率阈值（激进）', '', '0.03', '0.07', 1),
('V3', 'AGGRESSIVE', 'factor1h', 'factorBBWModerateThreshold', '0.018', 'number', 'factor1h', 'BBW中等波动率阈值（激进）', '', '0.015', '0.03', 1),

-- 15M 入场信号参数
('V3', 'AGGRESSIVE', 'entry15m', 'entry15MStrongThreshold', '3', 'number', 'entry15m', '15M强信号阈值（激进）', '分', '3', '5', 1),
('V3', 'AGGRESSIVE', 'entry15m', 'entry15MModerateThreshold', '2', 'number', 'entry15m', '15M中等信号阈值（激进）', '分', '2', '4', 1),
('V3', 'AGGRESSIVE', 'entry15m', 'entry15MWeakThreshold', '1', 'number', 'entry15m', '15M弱信号阈值（激进）', '分', '1', '3', 1),
('V3', 'AGGRESSIVE', 'entry15m', 'entry15MStructureWeight', '1', 'number', 'entry15m', '15M结构评分权重（激进）', '分', '1', '3', 1),

-- 信号融合参数
('V3', 'AGGRESSIVE', 'signal-fusion', 'signalFusionStrongThreshold', '0.65', 'number', 'signal-fusion', '强信号阈值（激进）', '%', '0.60', '0.80', 1),
('V3', 'AGGRESSIVE', 'signal-fusion', 'signalFusionModerateThreshold', '0.40', 'number', 'signal-fusion', '中等信号阈值（激进）', '%', '0.40', '0.55', 1),
('V3', 'AGGRESSIVE', 'signal-fusion', 'signalFusionWeakThreshold', '0.30', 'number', 'signal-fusion', '弱信号阈值（激进）', '%', '0.30', '0.45', 1),
('V3', 'AGGRESSIVE', 'signal-fusion', 'signalFusionTrendWeight', '0.45', 'number', 'signal-fusion', '趋势权重（激进）', '%', '0.40', '0.60', 1),
('V3', 'AGGRESSIVE', 'signal-fusion', 'signalFusionFactorWeight', '0.30', 'number', 'signal-fusion', '因子权重（激进）', '%', '0.25', '0.45', 1),
('V3', 'AGGRESSIVE', 'signal-fusion', 'signalFusionEntryWeight', '0.15', 'number', 'signal-fusion', '入场权重（激进）', '%', '0.10', '0.20', 1),
('V3', 'AGGRESSIVE', 'signal-fusion', 'signalFusionCompensationEnabled', 'true', 'boolean', 'signal-fusion', '是否启用补偿机制（激进）', '', 'true', 'false', 1),
('V3', 'AGGRESSIVE', 'signal-fusion', 'signalFusionCompensationThreshold', '0.75', 'number', 'signal-fusion', '补偿阈值（激进）', '%', '0.70', '0.90', 1),

-- 持仓时长参数
('V3', 'AGGRESSIVE', 'duration', 'mainstreamTrendMaxHours', '192', 'number', 'duration', '主流币趋势市最大持仓（激进）', '小时', '120', '216', 1),
('V3', 'AGGRESSIVE', 'duration', 'mainstreamRangeMaxHours', '15', 'number', 'duration', '主流币震荡市最大持仓（激进）', '小时', '8', '18', 1),
('V3', 'AGGRESSIVE', 'duration', 'highCapTrendMaxHours', '84', 'number', 'duration', '高市值强趋势币趋势市最大持仓（激进）', '小时', '48', '96', 1),
('V3', 'AGGRESSIVE', 'duration', 'highCapRangeMaxHours', '5', 'number', 'duration', '高市值强趋势币震荡市最大持仓（激进）', '小时', '3', '6', 1),
('V3', 'AGGRESSIVE', 'duration', 'hotTrendMaxHours', '30', 'number', 'duration', '热点币趋势市最大持仓（激进）', '小时', '18', '36', 1),
('V3', 'AGGRESSIVE', 'duration', 'hotRangeMaxHours', '4', 'number', 'duration', '热点币震荡市最大持仓（激进）', '小时', '2', '5', 1),
('V3', 'AGGRESSIVE', 'duration', 'smallCapTrendMaxHours', '15', 'number', 'duration', '小币趋势市最大持仓（激进）', '小时', '8', '18', 1),
('V3', 'AGGRESSIVE', 'duration', 'smallCapRangeMaxHours', '2.5', 'number', 'duration', '小币震荡市最大持仓（激进）', '小时', '1.5', '3', 1),

-- 时间止损参数
('V3', 'AGGRESSIVE', 'time-stop', 'mainstreamTrendTimeStop', '75', 'number', 'time-stop', '主流币趋势市时间止损（激进）', '分钟', '45', '90', 1),
('V3', 'AGGRESSIVE', 'time-stop', 'mainstreamRangeTimeStop', '35', 'number', 'time-stop', '主流币震荡市时间止损（激进）', '分钟', '20', '45', 1),
('V3', 'AGGRESSIVE', 'time-stop', 'highCapTrendTimeStop', '135', 'number', 'time-stop', '高市值强趋势币趋势市时间止损（激进）', '分钟', '90', '150', 1),
('V3', 'AGGRESSIVE', 'time-stop', 'highCapRangeTimeStop', '50', 'number', 'time-stop', '高市值强趋势币震荡市时间止损（激进）', '分钟', '30', '60', 1),
('V3', 'AGGRESSIVE', 'time-stop', 'hotTrendTimeStop', '210', 'number', 'time-stop', '热点币趋势市时间止损（激进）', '分钟', '120', '240', 1),
('V3', 'AGGRESSIVE', 'time-stop', 'hotRangeTimeStop', '70', 'number', 'time-stop', '热点币震荡市时间止损（激进）', '分钟', '45', '90', 1),
('V3', 'AGGRESSIVE', 'time-stop', 'smallCapTrendTimeStop', '35', 'number', 'time-stop', '小币趋势市时间止损（激进）', '分钟', '20', '45', 1),
('V3', 'AGGRESSIVE', 'time-stop', 'smallCapRangeTimeStop', '35', 'number', 'time-stop', '小币震荡市时间止损（激进）', '分钟', '20', '45', 1),

-- 止损止盈参数
('V3', 'AGGRESSIVE', 'stop-profit', 'mainstreamTrendStopLoss', '1.3', 'number', 'stop-profit', '主流币趋势市止损倍数（激进）', '× ATR', '1.2', '2.0', 1),
('V3', 'AGGRESSIVE', 'stop-profit', 'mainstreamTrendProfitTarget', '3.8', 'number', 'stop-profit', '主流币趋势市止盈倍数（激进）', '× ATR', '3.5', '6.0', 1),
('V3', 'AGGRESSIVE', 'stop-profit', 'mainstreamRangeStopLoss', '1.3', 'number', 'stop-profit', '主流币震荡市止损倍数（激进）', '× ATR', '1.2', '2.0', 1),
('V3', 'AGGRESSIVE', 'stop-profit', 'mainstreamRangeProfitTarget', '3.8', 'number', 'stop-profit', '主流币震荡市止盈倍数（激进）', '× ATR', '3.5', '6.0', 1),
('V3', 'AGGRESSIVE', 'stop-profit', 'highCapTrendStopLoss', '1.7', 'number', 'stop-profit', '高市值强趋势币趋势市止损倍数（激进）', '× ATR', '1.5', '2.5', 1),
('V3', 'AGGRESSIVE', 'stop-profit', 'highCapTrendProfitTarget', '5.3', 'number', 'stop-profit', '高市值强趋势币趋势市止盈倍数（激进）', '× ATR', '5.0', '8.0', 1),
('V3', 'AGGRESSIVE', 'stop-profit', 'highCapRangeStopLoss', '1.7', 'number', 'stop-profit', '高市值强趋势币震荡市止损倍数（激进）', '× ATR', '1.5', '2.5', 1),
('V3', 'AGGRESSIVE', 'stop-profit', 'highCapRangeProfitTarget', '5.3', 'number', 'stop-profit', '高市值强趋势币震荡市止盈倍数（激进）', '× ATR', '5.0', '8.0', 1),
('V3', 'AGGRESSIVE', 'stop-profit', 'hotTrendStopLoss', '2.2', 'number', 'stop-profit', '热点币趋势市止损倍数（激进）', '× ATR', '2.0', '3.0', 1),
('V3', 'AGGRESSIVE', 'stop-profit', 'hotTrendProfitTarget', '6.5', 'number', 'stop-profit', '热点币趋势市止盈倍数（激进）', '× ATR', '6.0', '10.0', 1),
('V3', 'AGGRESSIVE', 'stop-profit', 'hotRangeStopLoss', '2.2', 'number', 'stop-profit', '热点币震荡市止损倍数（激进）', '× ATR', '2.0', '3.0', 1),
('V3', 'AGGRESSIVE', 'stop-profit', 'hotRangeProfitTarget', '6.5', 'number', 'stop-profit', '热点币震荡市止盈倍数（激进）', '× ATR', '6.0', '10.0', 1),
('V3', 'AGGRESSIVE', 'stop-profit', 'smallCapTrendStopLoss', '1.3', 'number', 'stop-profit', '小币趋势市止损倍数（激进）', '× ATR', '1.2', '2.0', 1),
('V3', 'AGGRESSIVE', 'stop-profit', 'smallCapTrendProfitTarget', '3.8', 'number', 'stop-profit', '小币趋势市止盈倍数（激进）', '× ATR', '3.5', '6.0', 1),
('V3', 'AGGRESSIVE', 'stop-profit', 'smallCapRangeStopLoss', '1.3', 'number', 'stop-profit', '小币震荡市止损倍数（激进）', '× ATR', '1.2', '2.0', 1),
('V3', 'AGGRESSIVE', 'stop-profit', 'smallCapRangeProfitTarget', '3.8', 'number', 'stop-profit', '小币震荡市止盈倍数（激进）', '× ATR', '3.5', '6.0', 1),

-- 置信度调整参数
('V3', 'AGGRESSIVE', 'confidence', 'confidenceHighMultiplier', '0.95', 'number', 'confidence', '高置信度倍数（激进）', '', '0.9', '1.1', 1),
('V3', 'AGGRESSIVE', 'confidence', 'confidenceMedMultiplier', '1.15', 'number', 'confidence', '中等置信度倍数（激进）', '', '1.0', '1.4', 1),
('V3', 'AGGRESSIVE', 'confidence', 'confidenceLowMultiplier', '1.45', 'number', 'confidence', '低置信度倍数（激进）', '', '1.3', '1.7', 1),

-- 杠杆参数
('V3', 'AGGRESSIVE', 'leverage', 'maxLeverage', '20', 'number', 'leverage', '最大杠杆倍数（激进）', '倍', '10', '24', 1),
('V3', 'AGGRESSIVE', 'leverage', 'leverageBuffer', '0.004', 'number', 'leverage', '杠杆计算缓冲（激进）', '%', '0.003', '0.007', 1);

SELECT 'Aggressive strategy parameters inserted successfully!' AS status;

