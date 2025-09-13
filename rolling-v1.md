# 动态杠杆滚仓

# **1️⃣ 核心思路**

- 初期高杠杆 → 快速积累浮盈
- 当浮盈达到一定比例 → 抽出本金，降低杠杆
- 后续每次滚仓 → 杠杆递减，落袋部分利润
- 止损随仓位提升 → 保证前期利润不被回吐

# **2️⃣ 策略步骤**

**Step 1：初始开仓**

- 本金 = P_0
- 初始杠杆 = L_0（例如 50x）
- 仓位 = P_0 \times L_0
- 止损设置：允许亏损不超过本金的一定比例（如 20%）

**Step 2：第一阶段盈利触发**

- 当浮盈 ≥ 本金 → 抽出本金
- 剩余浮盈继续滚仓
- 降低杠杆：L_1 = L_0 \times r （0<r<1，例如 r=0.5）
- 新仓位 = 剩余浮盈 × 新杠杆

**Step 3：后续滚仓阶段**

- 每次浮盈达到滚仓阈值（例如浮盈 50%）：
    1. 落袋部分利润（例如 50%）
    2. 用剩余浮盈滚仓
    3. 杠杆逐步递减：
    L_{n+1} = L_n \times 
- 止损随仓位上移 → 保证本金 + 已锁利润不受回撤影响

**Step 4：趋势结束或目标价到达**

- 全部盈利落袋
- 持仓止盈或平仓
- 确保本金 + 大部分浮盈已锁定

# **3️⃣ 杠杆与滚仓公式**

1. 滚仓杠杆递减公式
L_{n+1} = \max(L_{min}, L_n \times r)
- L_{min} = 最低杠杆（例如 5x）
- r = 杠杆递减系数（0.3~0.7，可调）
1. 滚仓触发阈值
F_{trigger} = P_0 \times k
- k = 盈利触发比例（例如 1.0 表示浮盈达到本金触发滚仓）
1. 落袋比例
Profit_{lock} = Profit \times p
- p = 落袋比例（0.3~0.5）

# **4️⃣ 风险控制原则**

1. 初期高杠杆 → 高收益，止损保护本金
2. 后期降低杠杆 → 风险降低，滚仓利润锁定
3. 止损动态上移 → 保证本金 + 已锁利润不被回撤吞掉
4. 滚仓触发阈值灵活 → 根据行情波动设定

# **5️⃣ 策略示例**

假设：

- 本金 = 200 U
- 初始杠杆 = 50x
- 滚仓触发阈值 = 浮盈 ≥ 本金
- 杠杆递减系数 r = 0.5
- 落袋比例 p = 50%

| **阶段** | **杠杆** | **仓位** | **浮盈** | **落袋** | **剩余滚仓** |
| --- | --- | --- | --- | --- | --- |
| 初始 | 50x | 10,000 U | — | — | — |
| 第一滚 | 25x | 200 U × 25 = 5,000 U | 200 U | 100 U | 100 U 滚仓 |
| 第二滚 | 12x | 100 U × 12 = 1,200 U | 50 U | 25 U | 25 U 滚仓 |
| 第三滚 | 6x | 25 U × 6 = 150 U | 10 U | 5 U | 5 U 滚仓 |

这样，初期高杠杆放大利润，后期降低杠杆锁利润，最大化趋势收益，同时保护本金。

# **✅ 核心优点**

- 本金安全 → 初期浮盈触发后抽回
- 利润最大化 → 趋势中滚仓逐步累积
- 风险可控 → 杠杆随盈利递减，止损动态上移
- 灵活性高 → 滚仓阈值、杠杆递减系数、落袋比例可根据市场调整


```jsx
/**
 * 动态杠杆滚仓策略模拟器
 * 
 * 输入参数：
 *  - principal: 本金
 *  - initialLeverage: 初始杠杆
 *  - priceStart: 开仓价
 *  - priceTarget: 目标价
 *  - triggerRatio: 滚仓触发浮盈比例 (参考综合参数示例表格)
 *  - leverageDecay: 滚仓后杠杆递减系数 (参考综合参数示例表格)
 *  - profitLockRatio: 每次落袋比例 (参考综合参数示例表格)
 *  - minLeverage: 最低杠杆（参考综合参数示例表格）
 */

function simulateDynamicPyramid({
    principal = 200,
    initialLeverage = 50,
    priceStart = 4700,
    priceTarget = 5200,
    triggerRatio = 1,
    leverageDecay = 0.5,
    profitLockRatio = 0.5,
    minLeverage = 5
}) {
    let equity = principal; // 当前总净值
    let lockedProfit = 0;   // 已落袋利润
    let floatingProfit = 0; // 当前浮盈
    let leverage = initialLeverage;
    let position = principal * leverage; // 仓位价值
    let price = priceStart;
    const totalPriceIncrease = priceTarget - priceStart;
    const priceStep = totalPriceIncrease / 100; // 模拟100步上涨
    const history = [];

    for (let i = 1; i <= 100; i++) {
        price += priceStep;
        floatingProfit = position * (price - priceStart) / priceStart;

        // 判断是否触发滚仓
        if (floatingProfit >= principal * triggerRatio) {
            // 抽回本金
            equity += principal; 
            floatingProfit -= principal;

            // 落袋部分利润
            const locked = floatingProfit * profitLockRatio;
            lockedProfit += locked;
            floatingProfit -= locked;

            // 滚仓
            leverage = Math.max(minLeverage, leverage * leverageDecay);
            position = floatingProfit * leverage;

            // 重置开仓价
            priceStart = price;
        }

        // 保存历史记录
        history.push({
            step: i,
            price: price.toFixed(2),
            position: position.toFixed(2),
            floatingProfit: floatingProfit.toFixed(2),
            lockedProfit: lockedProfit.toFixed(2),
            equity: (equity + floatingProfit + lockedProfit).toFixed(2),
            leverage: leverage.toFixed(2)
        });
    }

    return history;
}

// 示例调用
const result = simulateDynamicPyramid({
    principal: 200,
    initialLeverage: 50,
    priceStart: 4700,
    priceTarget: 5200,
    triggerRatio: 1,
    leverageDecay: 0.5,
    profitLockRatio: 0.5,
    minLeverage: 5
});

console.table(result);
```

参考综合参数示例表格
| **参数** | **建议值** | **说明** |
| --- | --- | --- |
| triggerRatio | 1.0 | 浮盈达到本金触发滚仓 |
| leverageDecay | 0.5~0.6 | 滚仓后杠杆减半或略高，风险递减 |
| profitLockRatio | 0.5 | 每次锁定一半利润，保证安全 |
| minLeverage | 5~8 | 趋势末期杠杆不能低于 5x，保证收益 |

逻辑效果：

- 初期 50x → 快速放大浮盈
- 盈利 ≥ 本金 → 本金抽出，杠杆降到 25~30x
- 浮盈滚仓 → 落袋一半，杠杆再降低 12~15x
- 趋势末期 → 杠杆保持 5~8x，锁定利润，回撤可控