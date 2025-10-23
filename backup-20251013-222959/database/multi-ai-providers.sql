-- 多AI提供商配置
-- 支持OpenAI、Grok、DeepSeek三个提供商

USE trading_system;

-- 添加AI提供商选择配置
INSERT INTO ai_config (config_key, config_value, config_type, description) VALUES
('ai_provider', 'deepseek', 'SETTING', '当前使用的AI提供商 (openai|grok|deepseek)')
ON DUPLICATE KEY UPDATE config_value = VALUES(config_value);

-- Grok配置
INSERT INTO ai_config (config_key, config_value, config_type, description) VALUES
('grok_api_key', '', 'API_KEY', 'Grok API密钥(加密存储)'),
('grok_base_url', 'https://api.x.ai/v1', 'SETTING', 'Grok API基础URL'),
('grok_model', 'grok-beta', 'SETTING', 'Grok模型版本')
ON DUPLICATE KEY UPDATE config_value = VALUES(config_value);

-- DeepSeek配置
INSERT INTO ai_config (config_key, config_value, config_type, description) VALUES
('deepseek_api_key', '', 'API_KEY', 'DeepSeek API密钥(加密存储)'),
('deepseek_base_url', 'https://api.deepseek.com/v1', 'SETTING', 'DeepSeek API基础URL'),
('deepseek_model', 'deepseek-chat', 'SETTING', 'DeepSeek模型版本')
ON DUPLICATE KEY UPDATE config_value = VALUES(config_value);

-- 通用AI配置
INSERT INTO ai_config (config_key, config_value, config_type, description) VALUES
('ai_max_tokens', '4000', 'SETTING', 'AI最大Token数'),
('ai_temperature', '0.3', 'SETTING', 'AI温度参数(0-1)')
ON DUPLICATE KEY UPDATE config_value = VALUES(config_value);

SELECT 'AI提供商配置已添加' as status;

-- 查看所有AI提供商配置
SELECT config_key,
       CASE 
         WHEN config_key LIKE '%api_key%' THEN '***已配置***'
         ELSE config_value 
       END as config_value,
       description
FROM ai_config 
WHERE config_key LIKE '%ai%' OR config_key LIKE '%grok%' OR config_key LIKE '%deepseek%' OR config_key LIKE '%openai%'
ORDER BY config_key;

