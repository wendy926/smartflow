-- 迁移AI配置从Claude到OpenAI
-- 执行时间: 2025-10-08

USE trading_system;

-- 更新配置键名
UPDATE ai_config SET config_key = 'openai_api_key', description = 'OpenAI API密钥(加密存储)' 
WHERE config_key = 'claude_api_key';

UPDATE ai_config SET config_key = 'openai_base_url', description = 'OpenAI API基础URL' 
WHERE config_key = 'claude_api_proxy';

UPDATE ai_config SET config_key = 'openai_model', config_value = 'gpt-4o-mini', description = 'OpenAI模型版本' 
WHERE config_key = 'claude_model';

UPDATE ai_config SET config_key = 'openai_max_tokens', description = '最大Token数' 
WHERE config_key = 'claude_max_tokens';

UPDATE ai_config SET config_key = 'openai_temperature', description = '温度参数(0-1)' 
WHERE config_key = 'claude_temperature';

-- 验证更新
SELECT 'OpenAI配置迁移完成' as status;

SELECT config_key, 
       CASE 
         WHEN config_key LIKE '%api_key%' THEN CONCAT(LEFT(config_value, 15), '...')
         ELSE config_value 
       END as config_value,
       description
FROM ai_config 
WHERE config_key LIKE 'openai%'
ORDER BY config_key;

