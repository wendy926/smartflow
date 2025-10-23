-- 紧急清理AI历史数据
-- 只保留每个交易对最近50条记录

USE trading_system;

-- 1. 清理MACRO_RISK类型的旧数据
DELETE FROM ai_market_analysis 
WHERE analysis_type = 'MACRO_RISK'
AND id NOT IN (
  SELECT id FROM (
    SELECT id FROM ai_market_analysis 
    WHERE analysis_type = 'MACRO_RISK'
    GROUP BY symbol
    HAVING id IN (
      SELECT id FROM ai_market_analysis a2
      WHERE a2.symbol = ai_market_analysis.symbol
      AND a2.analysis_type = 'MACRO_RISK'
      ORDER BY created_at DESC
      LIMIT 50
    )
  ) tmp
);

-- 2. 清理SYMBOL_TREND类型的旧数据
DELETE t1 FROM ai_market_analysis t1
LEFT JOIN (
  SELECT symbol, id
  FROM (
    SELECT symbol, id,
           ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY created_at DESC) as rn
    FROM ai_market_analysis
    WHERE analysis_type = 'SYMBOL_TREND'
  ) ranked
  WHERE rn <= 50
) t2 ON t1.id = t2.id
WHERE t1.analysis_type = 'SYMBOL_TREND'
AND t2.id IS NULL;

-- 3. 清理API日志（只保留最近1000条）
DELETE FROM ai_api_logs
WHERE id NOT IN (
  SELECT id FROM (
    SELECT id FROM ai_api_logs
    ORDER BY created_at DESC
    LIMIT 1000
  ) tmp
);

-- 4. 清理告警历史（只保留最近500条）
DELETE FROM ai_alert_history
WHERE id NOT IN (
  SELECT id FROM (
    SELECT id FROM ai_alert_history
    ORDER BY created_at DESC
    LIMIT 500
  ) tmp
);

-- 5. 优化表
OPTIMIZE TABLE ai_market_analysis;
OPTIMIZE TABLE ai_api_logs;
OPTIMIZE TABLE ai_alert_history;

-- 6. 查看清理后的数据量
SELECT 
  'ai_market_analysis' as table_name,
  COUNT(*) as total_records,
  COUNT(DISTINCT symbol) as unique_symbols
FROM ai_market_analysis
UNION ALL
SELECT 
  'ai_api_logs',
  COUNT(*),
  NULL
FROM ai_api_logs
UNION ALL
SELECT
  'ai_alert_history',
  COUNT(*),
  NULL
FROM ai_alert_history;

