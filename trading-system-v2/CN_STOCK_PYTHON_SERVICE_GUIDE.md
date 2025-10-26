# A股Python数据服务运行指南

**日期**: 2025-10-26  
**数据源**: akshare（完全免费）

---

## 📋 概述

A股数据已改为使用独立的Python服务，基于akshare获取市场数据，完全免费，无需Token。

### 架构
```
Node.js交易系统
    ↓
CNStockServiceAPI (HTTP客户端)
    ↓
Flask Python数据服务 (localhost:5001)
    ↓
akshare (获取A股市场数据)
```

---

## 🚀 快速开始

### 1. 启动Python数据服务

#### 方式1: 使用启动脚本
```bash
cd cn-stock-data-service
./start.sh
```

#### 方式2: 手动启动
```bash
cd cn-stock-data-service

# 安装依赖
pip3 install -r requirements.txt

# 启动服务
python3 main.py
```

#### 服务启动成功
```
INFO:启动A股数据服务，端口: 5001
 * Running on http://0.0.0.0:5001
```

### 2. 测试Python服务

在另一个终端运行：
```bash
# 健康检查
curl http://localhost:5001/health

# 获取指数列表
curl http://localhost:5001/api/v1/indexes

# 获取沪深300日线数据
curl "http://localhost:5001/api/v1/index/000300/daily?limit=10"
```

### 3. 运行Node.js测试

```bash
# 运行完整测试
node test-cn-stock-with-service.js
```

---

## 📡 API接口

### 1. 健康检查
```
GET /health
```

响应：
```json
{
  "status": "ok",
  "service": "CN Stock Data Service",
  "timestamp": "2025-01-26T12:00:00"
}
```

### 2. 获取指数列表
```
GET /api/v1/indexes
```

响应：
```json
{
  "data": [
    {
      "code": "000300",
      "name": "沪深300",
      "market": "SH"
    },
    ...
  ]
}
```

### 3. 获取日线数据
```
GET /api/v1/index/{code}/daily
参数:
  - start_date: 开始日期 (YYYYMMDD)
  - end_date: 结束日期 (YYYYMMDD)
  - limit: 数据条数 (默认100)
```

示例：
```
GET /api/v1/index/000300/daily?start_date=20240101&end_date=20250126&limit=100
```

响应：
```json
{
  "code": "000300",
  "period": "daily",
  "count": 100,
  "data": [
    {
      "date": "2025-01-26",
      "open": 3805.23,
      "high": 3820.15,
      "low": 3790.50,
      "close": 3810.88,
      "volume": 1234567,
      "change_pct": 1.25
    },
    ...
  ]
}
```

### 4. 获取实时行情
```
GET /api/v1/index/{code}/realtime
```

响应：
```json
{
  "code": "000300",
  "price": 3810.88,
  "open": 3805.23,
  "high": 3820.15,
  "low": 3790.50,
  "change": 1.25,
  "volume": 1234567,
  "timestamp": "2025-01-26"
}
```

---

## 🔧 支持的指数

| 代码 | 名称 | 市场 |
|-----|------|------|
| 000300 | 沪深300 | 沪市 |
| 000905 | 中证500 | 沪市 |
| 000852 | 中证1000 | 沪市 |
| 399001 | 深证成指 | 深市 |
| 399006 | 创业板指 | 深市 |
| 000016 | 上证50 | 沪市 |
| 000688 | 科创50 | 沪市 |

---

## 📊 使用示例

### Node.js中使用

```javascript
const CNStockServiceAPI = require('./src/api/cn-stock-service-api');
const ChinaStockAdapter = require('./src/adapters/ChinaStockAdapter');

// 创建API客户端
const api = new CNStockServiceAPI({
  baseURL: 'http://localhost:5001',
  timeout: 30000
});

// 获取日线数据
const data = await api.getIndexDaily('000300', '20240101', '20250126', 100);

// 创建适配器
const adapter = new ChinaStockAdapter({
  serviceURL: 'http://localhost:5001',
  symbols: ['000300.SH', '000905.SH'],
  simulationMode: true
});

// 获取K线
const klines = await adapter.getKlines('000300.SH', '1d', 100);

// 获取实时行情
const ticker = await adapter.getTicker('000300.SH');
```

---

## ⚠️ 注意事项

### 1. Python环境
- 需要Python 3.7+
- 确保已安装pip

### 2. 依赖安装
```bash
pip3 install Flask akshare requests pandas numpy
```

### 3. 端口占用
- 默认端口5001
- 可通过环境变量修改：
```bash
PORT=5002 python3 main.py
```

### 4. 数据更新
- akshare数据更新及时
- 无需Token，完全免费
- 无API调用次数限制

### 5. 服务状态
- 确保Python服务一直运行
- 建议使用PM2或systemd管理

---

## 🐛 故障排除

### 问题1: 服务启动失败
```bash
# 检查Python版本
python3 --version

# 检查依赖
pip3 list | grep akshare

# 重新安装依赖
pip3 install -r requirements.txt
```

### 问题2: 连接失败
```bash
# 检查服务是否运行
curl http://localhost:5001/health

# 检查端口占用
lsof -i :5001

# 重启服务
./start.sh
```

### 问题3: 数据获取失败
```bash
# 检查akshare版本
pip3 show akshare

# 更新akshare
pip3 install --upgrade akshare
```

---

## 📈 性能优化

### 1. 数据缓存
Python服务可以添加Redis缓存：
```python
from flask_caching import Cache

cache = Cache(app)
@app.route('/api/v1/index/<code>/daily')
@cache.cached(timeout=3600)  # 缓存1小时
def get_index_daily(code):
    ...
```

### 2. 并发请求
使用gunicorn启动：
```bash
pip3 install gunicorn
gunicorn -w 4 -b 0.0.0.0:5001 main:app
```

### 3. 日志管理
```python
# 添加日志文件
logging.basicConfig(
    level=logging.INFO,
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)
```

---

## 🎯 与原有方案对比

| 特性 | Tushare Pro | akshare (当前) |
|------|-------------|---------------|
| **费用** | 需要积分 | ✅ 完全免费 |
| **Token** | ✅ 需要 | ❌ 不需要 |
| **稳定性** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **数据量** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **更新** | 及时 | 及时 |
| **集成** | Node.js | Python服务 |

---

## 🚀 生产环境部署

### 使用PM2管理
```bash
npm install -g pm2

# 启动服务
pm2 start cn-stock-data-service/main.py --name cn-stock-service --interpreter python3

# 查看状态
pm2 status

# 查看日志
pm2 logs cn-stock-service
```

### Docker部署
```bash
# 构建镜像
docker build -t cn-stock-service .

# 运行
docker run -d -p 5001:5001 cn-stock-service
```

---

## 📝 总结

**优势**：
- ✅ 完全免费，无需Token
- ✅ 数据全面，支持所有指数
- ✅ 独立服务，易于维护
- ✅ Python生态，资源丰富

**下一步**：
- 实现A股策略适配
- 实现回测引擎
- 本地运行和测试

**参考文档**：
- [A股免费数据源](CN_STOCK_FREE_DATA_SOURCES.md)
- [A股适配器实现](CN_STOCK_ADAPTER_IMPLEMENTATION.md)

