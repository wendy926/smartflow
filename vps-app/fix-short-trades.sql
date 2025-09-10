-- 修复做空交易的止损止盈价格问题
-- 问题：做空交易的止损价格低于入场价，止盈价格高于入场价（错误）
-- 修复：交换止损和止盈价格，使其符合做空逻辑

-- 首先查看当前错误的做空交易数据
SELECT 
    symbol,
    entry_price,
    stop_loss_price,
    take_profit_price,
    CASE 
        WHEN stop_loss_price > entry_price THEN '✅'
        ELSE '❌'
    END as stop_loss_check,
    CASE 
        WHEN take_profit_price < entry_price THEN '✅'
        ELSE '❌'
    END as take_profit_check,
    created_at
FROM simulations 
WHERE direction = 'SHORT' 
ORDER BY created_at DESC 
LIMIT 10;

-- 交换做空交易的止损和止盈价格
UPDATE simulations 
SET 
    stop_loss_price = take_profit_price,
    take_profit_price = stop_loss_price
WHERE direction = 'SHORT'
    AND stop_loss_price < entry_price  -- 只修复错误的数据
    AND take_profit_price > entry_price;

-- 验证修复后的数据
SELECT 
    '修复后' as status,
    symbol,
    entry_price,
    stop_loss_price,
    take_profit_price,
    CASE 
        WHEN stop_loss_price > entry_price THEN '✅'
        ELSE '❌'
    END as stop_loss_check,
    CASE 
        WHEN take_profit_price < entry_price THEN '✅'
        ELSE '❌'
    END as take_profit_check,
    created_at
FROM simulations 
WHERE direction = 'SHORT' 
ORDER BY created_at DESC 
LIMIT 10;
