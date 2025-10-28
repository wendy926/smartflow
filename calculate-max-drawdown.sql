-- 计算V3策略的最大回撤
SET @cumulative = 0;
SET @peak = 0;
SET @max_dd = 0;

SELECT
  @cumulative := @cumulative + pnl as cumulative,
  @peak := GREATEST(@peak, @cumulative) as peak,
  @drawdown := @peak - @cumulative as drawdown,
  @max_dd := GREATEST(@max_dd, @drawdown) as max_drawdown,
  pnl,
  entry_time
FROM simulation_trades
WHERE strategy_name = 'V3' AND status = 'CLOSED'
ORDER BY entry_time ASC;

SELECT @max_dd as final_max_drawdown;

-- ICT策略
SET @cumulative = 0;
SET @peak = 0;
SET @max_dd = 0;

SELECT
  @cumulative := @cumulative + pnl as cumulative,
  @peak := GREATEST(@peak, @cumulative) as peak,
  @drawdown := @peak - @cumulative as drawdown,
  @max_dd := GREATEST(@max_dd, @drawdown) as max_drawdown,
  pnl,
  entry_time
FROM simulation_trades
WHERE strategy_name = 'ICT' AND status = 'CLOSED'
ORDER BY entry_time ASC;

SELECT @max_dd as ict_max_drawdown;

