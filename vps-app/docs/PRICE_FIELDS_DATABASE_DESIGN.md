# 价格字段数据库表结构设计文档

## 📋 需求分析

### ICT策略新增字段
- **4H OB (Order Block) 区间价格**
  - `ob_upper_price` - OB上沿价格
  - `ob_lower_price` - OB下沿价格
  
- **4H FVG (Fair Value Gap) 区间价格**
  - `fvg_upper_price` - FVG上沿价格  
  - `fvg_lower_price` - FVG下沿价格

### V3策略新增字段
- **1H 震荡市区间边界价格**
  - `range_upper_boundary_price` - 震荡市上边界价格
  - `range_lower_boundary_price` - 震荡市下边界价格
  
- **1H 趋势市入场价格**
  - `trend_entry_price` - 趋势市判断入场价格
  - `trend_confirmation_price` - 趋势确认价格

## 🏗️ 数据库表结构修改

### 1. ICT策略表 (ict_strategy_analysis) 字段扩展

```sql
-- 4H OB区间价格字段
ALTER TABLE ict_strategy_analysis ADD COLUMN ob_upper_price REAL;
ALTER TABLE ict_strategy_analysis ADD COLUMN ob_lower_price REAL;
ALTER TABLE ict_strategy_analysis ADD COLUMN ob_mid_price REAL; -- OB中间价格
ALTER TABLE ict_strategy_analysis ADD COLUMN ob_price_range REAL; -- OB价格区间宽度

-- 4H FVG区间价格字段  
ALTER TABLE ict_strategy_analysis ADD COLUMN fvg_upper_price REAL;
ALTER TABLE ict_strategy_analysis ADD COLUMN fvg_lower_price REAL;
ALTER TABLE ict_strategy_analysis ADD COLUMN fvg_mid_price REAL; -- FVG中间价格
ALTER TABLE ict_strategy_analysis ADD COLUMN fvg_price_range REAL; -- FVG价格区间宽度

-- 价格相关的辅助字段
ALTER TABLE ict_strategy_analysis ADD COLUMN price_distance_to_ob REAL; -- 当前价格到OB的距离
ALTER TABLE ict_strategy_analysis ADD COLUMN price_distance_to_fvg REAL; -- 当前价格到FVG的距离
ALTER TABLE ict_strategy_analysis ADD COLUMN ob_fvg_alignment BOOLEAN DEFAULT FALSE; -- OB和FVG是否对齐

-- 时间戳字段
ALTER TABLE ict_strategy_analysis ADD COLUMN ob_price_updated_at DATETIME;
ALTER TABLE ict_strategy_analysis ADD COLUMN fvg_price_updated_at DATETIME;
```

### 2. V3策略表 (strategy_analysis) 字段扩展

```sql
-- 1H 震荡市区间边界价格
ALTER TABLE strategy_analysis ADD COLUMN range_upper_boundary_price REAL;
ALTER TABLE strategy_analysis ADD COLUMN range_lower_boundary_price REAL;
ALTER TABLE strategy_analysis ADD COLUMN range_mid_price REAL; -- 震荡区间中间价格
ALTER TABLE strategy_analysis ADD COLUMN range_price_width REAL; -- 震荡区间宽度

-- 1H 趋势市入场价格
ALTER TABLE strategy_analysis ADD COLUMN trend_entry_price REAL;
ALTER TABLE strategy_analysis ADD COLUMN trend_confirmation_price REAL;
ALTER TABLE strategy_analysis ADD COLUMN trend_breakout_price REAL; -- 趋势突破价格
ALTER TABLE strategy_analysis ADD COLUMN trend_support_resistance_price REAL; -- 支撑/阻力价格

-- 价格相关的辅助字段
ALTER TABLE strategy_analysis ADD COLUMN price_position_in_range TEXT; -- 价格在区间中的位置 (upper/middle/lower)
ALTER TABLE strategy_analysis ADD COLUMN distance_to_range_boundary REAL; -- 到区间边界的距离
ALTER TABLE strategy_analysis ADD COLUMN trend_price_momentum REAL; -- 趋势价格动量

-- 时间戳字段
ALTER TABLE strategy_analysis ADD COLUMN range_price_updated_at DATETIME;
ALTER TABLE strategy_analysis ADD COLUMN trend_price_updated_at DATETIME;
```

## 📊 索引优化

```sql
-- ICT策略表索引
CREATE INDEX IF NOT EXISTS idx_ict_ob_prices ON ict_strategy_analysis(symbol, ob_upper_price, ob_lower_price);
CREATE INDEX IF NOT EXISTS idx_ict_fvg_prices ON ict_strategy_analysis(symbol, fvg_upper_price, fvg_lower_price);
CREATE INDEX IF NOT EXISTS idx_ict_price_timestamp ON ict_strategy_analysis(symbol, ob_price_updated_at, fvg_price_updated_at);

-- V3策略表索引
CREATE INDEX IF NOT EXISTS idx_v3_range_prices ON strategy_analysis(symbol, range_upper_boundary_price, range_lower_boundary_price);
CREATE INDEX IF NOT EXISTS idx_v3_trend_prices ON strategy_analysis(symbol, trend_entry_price, trend_confirmation_price);
CREATE INDEX IF NOT EXISTS idx_v3_price_timestamp ON strategy_analysis(symbol, range_price_updated_at, trend_price_updated_at);
```

## 🔧 数据迁移脚本设计

### PriceFieldsMigration.js

```javascript
class PriceFieldsMigration {
  constructor(database) {
    this.db = database;
  }

  async migrate() {
    console.log('🚀 开始价格字段数据库迁移...');
    
    try {
      // 1. 扩展ICT策略表
      await this.extendICTStrategyTable();
      
      // 2. 扩展V3策略表
      await this.extendV3StrategyTable();
      
      // 3. 创建索引
      await this.createPriceIndexes();
      
      // 4. 数据验证
      await this.validateMigration();
      
      console.log('✅ 价格字段数据库迁移完成');
      return true;
    } catch (error) {
      console.error('❌ 价格字段数据库迁移失败:', error);
      throw error;
    }
  }
}
```

## 📈 业务逻辑设计

### ICT策略价格计算逻辑
1. **OB区间计算**: 基于4H时间框架的订单块检测
2. **FVG区间计算**: 基于4H时间框架的公允价值缺口检测
3. **价格对齐验证**: 检查OB和FVG区间的重叠情况

### V3策略价格计算逻辑
1. **震荡市边界**: 基于1H布林带和支撑阻力位计算
2. **趋势市入场**: 基于1H突破点和动量指标计算
3. **动态调整**: 根据市场波动性动态调整价格区间

## 🔍 数据验证规则

### 价格一致性检查
- OB/FVG上沿价格必须大于下沿价格
- 震荡区间上边界必须大于下边界
- 价格值必须为正数且在合理范围内

### 时间戳验证
- 价格更新时间不能晚于当前时间
- 价格数据的时效性检查

## 🎯 性能优化考虑

1. **分区策略**: 按时间和交易对分区存储
2. **缓存机制**: 热点价格数据缓存
3. **批量更新**: 批量处理价格字段更新
4. **异步处理**: 价格计算异步执行

## 📋 API接口设计预览

```javascript
// 获取ICT价格区间
GET /api/ict/price-ranges/:symbol

// 获取V3价格边界  
GET /api/v3/price-boundaries/:symbol

// 更新价格字段
PUT /api/strategy/price-fields/:symbol
```

---

**设计版本**: v1.0  
**创建时间**: 2025年1月17日  
**负责模块**: 价格字段扩展功能
