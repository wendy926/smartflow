-- 添加新的交易对：ADA/USDT、BNB/USDT、SOL/USDT
-- 执行时间：2025-10-06

USE trading_system;

-- 插入新的交易对数据
INSERT INTO symbols (symbol, status, funding_rate, last_price, volume_24h, price_change_24h) VALUES
('ADAUSDT', 'ACTIVE', 0.00010000, 0.45000000, 800000.00000000, 2.1000),
('BNBUSDT', 'ACTIVE', 0.00010000, 320.00000000, 1200000.00000000, 1.8000),
('SOLUSDT', 'ACTIVE', 0.00010000, 95.00000000, 1500000.00000000, 3.5000)
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    funding_rate = VALUES(funding_rate),
    last_price = VALUES(last_price),
    volume_24h = VALUES(volume_24h),
    price_change_24h = VALUES(price_change_24h),
    updated_at = CURRENT_TIMESTAMP;

-- 更新系统配置中的默认交易对列表
UPDATE system_config 
SET config_value = 'BTCUSDT,ETHUSDT,ONDOUSDT,MKRUSDT,PENDLEUSDT,MPLUSDT,LINKUSDT,LDOUSDT,ADAUSDT,BNBUSDT,SOLUSDT',
    updated_at = CURRENT_TIMESTAMP
WHERE config_key = 'default_symbols';

-- 显示添加结果
SELECT 'New symbols added successfully!' as status;
SELECT symbol, status, last_price, volume_24h, price_change_24h 
FROM symbols 
WHERE symbol IN ('ADAUSDT', 'BNBUSDT', 'SOLUSDT')
ORDER BY symbol;

-- 显示更新后的默认交易对配置
SELECT config_key, config_value 
FROM system_config 
WHERE config_key = 'default_symbols';
