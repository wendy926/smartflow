# A股策略本地测试指南

**日期**: 2025-10-26  
**版本**: v3.0.0

---

## 📋 前提条件

### 1. 环境要求
- Node.js 18+
- MySQL 8.0+
- Tushare Pro Token

### 2. 获取Tushare Token
1. 访问 [Tushare Pro](https://tushare.pro/)
2. 注册账号并登录
3. 在"接口令牌"页面获取Token
4. 注意：日线数据需要积分，建议至少充值200积分

### 3. 配置环境变量
```bash
# 创建或编辑 .env 文件
cp env.example .env

# 编辑 .env 文件，添加以下配置：
TUSHARE_TOKEN=your_tushare_token_here
CN_STOCK_SIMULATION_MODE=true
```

---

## 🗄️ 数据库初始化

### 1. 创建数据库表
```bash
# 连接MySQL
mysql -u root -p

# 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS trading_system;

# 导入A股表结构
mysql -u root -p trading_system < database/cn_stock_schema.sql
```

### 2. 验证表创建
```sql
USE trading_system;

-- 查看表
SHOW TABLES LIKE 'cn_stock_%';

-- 验证指数数据
SELECT * FROM cn_stock_indices LIMIT 10;
```

---

## 🚀 本地测试步骤

### 步骤1: 安装依赖
```bash
cd trading-system-v2
npm install
npm install tushare --save
```

### 步骤2: 加载市场数据
```bash
# 运行数据加载脚本
node test-cn-stock-strategy.js

# 输出示例:
# === 测试A股数据加载 ===
# 开始加载指数基本信息...
# 指数基本信息加载完成，共插入/更新 XX 条记录
# 加载历史数据: 20241001 - 20250126
# 指数 000300.SH 日线数据加载完成，共插入/更新 XXX 条记录
```

### 步骤3: 测试适配器功能
```bash
# 测试适配器会自动运行
# 验证:
# - K线数据获取
# - 实时行情获取
# - 市场指标获取
# - 模拟下单
```

### 步骤4: 验证数据
```sql
-- 查看沪深300数据
SELECT 
  trade_date,
  close,
  volume,
  amount,
  change_pct
FROM cn_stock_market_data
WHERE ts_code = '000300.SH'
ORDER BY trade_date DESC
LIMIT 30;
```

---

## 📊 支持的指数

| 指数代码 | 指数名称 | 类型 |
|---------|---------|------|
| 000300.SH | 沪深300 | 大盘蓝筹 |
| 000905.SH | 中证500 | 中小盘 |
| 000852.SH | 中证1000 | 小盘 |
| 399001.SZ | 深证成指 | 深市大盘 |
| 399006.SZ | 创业板指 | 成长股 |

---

## 🧪 测试功能

### 1. 数据加载测试
- ✅ 加载指数基本信息
- ✅ 加载历史日线数据
- ✅ 数据统计和验证

### 2. 适配器测试
- ✅ 获取市场信息
- ✅ 获取K线数据
- ✅ 获取实时行情
- ✅ 获取市场指标
- ✅ 模拟下单

### 3. 策略测试（待实现）
- ⏳ V3策略执行
- ⏳ ICT策略执行
- ⏳ 信号生成
- ⏳ 回测执行

---

## 🔧 常见问题

### Q1: Tushare API调用失败
**A**: 检查以下几点：
1. Token是否正确配置
2. Token是否过期（需要定期续费）
3. 账户是否有足够积分（日线数据需要积分）
4. 网络是否正常（Tushare服务器在国内）

### Q2: 数据库连接失败
**A**: 检查以下几点：
1. MySQL服务是否启动
2. 数据库用户名和密码是否正确
3. 数据库是否已创建
4. 是否有足够的权限

### Q3: 数据加载慢
**A**: 正常现象，因为：
1. Tushare有调用频率限制
2. 脚本已添加1秒延迟避免限流
3. 建议在非高峰期加载历史数据

### Q4: 如何获取更多历史数据
**A**: 修改脚本中的日期范围：
```javascript
// 修改为1年
startDate.setMonth(startDate.getMonth() - 12);

// 或者指定具体日期
const startDateStr = '20240101';
const endDateStr = '20250126';
```

---

## 📈 后续步骤

### 1. 实现A股策略
- [ ] 创建 `src/strategies/cn-v3-strategy.js`
- [ ] 适配V3策略到A股指数
- [ ] 测试策略信号生成

### 2. 实现回测引擎
- [ ] 创建 `src/services/cn-stock-backtest-engine.js`
- [ ] 实现回测逻辑
- [ ] 计算胜率和性能指标

### 3. 添加更多功能
- [ ] 实时数据更新
- [ ] 策略监控
- [ ] 交易报告生成

---

## 🎯 预期结果

### 数据加载成功后
```bash
✅ 数据加载测试完成

数据统计:
  000300.SH: 20240102 - 20250126, 298 条记录
  000905.SH: 20240102 - 20250126, 298 条记录
  000852.SH: 20240102 - 20250126, 298 条记录
  399001.SZ: 20240102 - 20250126, 298 条记录
  399006.SZ: 20240102 - 20250126, 298 条记录
```

### 适配器测试成功后
```bash
✅ 适配器测试完成

市场类型: CN_STOCK
交易时间: 09:30-11:30, 13:00-15:00
支持符号: 000300.SH, 000905.SH, 000852.SH...
获取到 30 条K线数据
最新K线: 2025-01-26T00:00:00.000Z - 3805.23
沪深300价格: 3805.23
涨跌幅: 1.25%
模拟订单创建成功: SIM_1737820800000
```

---

**参考文档**: 
- [A股适配器实现](CN_STOCK_ADAPTER_IMPLEMENTATION.md)
- [Tushare Pro文档](https://tushare.pro/document/2?doc_id=385)

