# A股指数免费数据源指南

**日期**: 2025-10-26
**适用于**: 本地开发和测试

---

## 🆓 免费数据源推荐

### 1. **akshare (推荐) ⭐⭐⭐⭐⭐**

#### 特点
- ✅ **完全免费**，开源Python库
- ✅ **无需注册**，无需Token
- ✅ **数据全面**：指数、股票、基金、期货等
- ✅ **更新及时**：实时行情、历史数据
- ✅ **易于使用**：Python pip安装即可

#### 安装方法
```bash
# Python 环境
pip install akshare

# Node.js 环境（需要调用Python脚本）
# 通过 child_process 调用
```

#### API示例
```python
import akshare as ak

# 获取沪深300指数日线数据
df = ak.index_zh_a_hist(symbol="000300", period="daily", start_date="20240101", end_date="20250126")

# 获取实时行情
df = ak.index_zh_a_hist_min_em(symbol="sh000300", period='1', adjust="")

# 输出
print(df)
```

#### 支持的主要指数
- 沪深300: sh000300
- 中证500: sh000905
- 中证1000: sh000852
- 上证指数: sh000001
- 深证成指: sz399001
- 创业板指: sz399006

---

### 2. **东方财富 (推荐) ⭐⭐⭐⭐**

#### 特点
- ✅ **完全免费**，无需注册
- ✅ **实时行情**，刷新快
- ✅ **Web API**，易获取
- ✅ **数据丰富**：K线、成交、指标等
- ⚠️ 注意请求频率限制

#### API示例
```javascript
// 获取沪深300指数K线数据
const url = `http://push2his.eastmoney.com/api/qt/kline/get?secid=1.000300&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=101&fqt=1&lmt=100`;

fetch(url)
  .then(res => res.json())
  .then(data => {
    console.log(data);
  });
```

#### 支持的指数格式
- 沪市: secid=1.000300 (1表示指数，000300是代码)
- 深市: secid=0.399001 (0表示指数，399001是代码)

---

### 3. **新浪财经 API ⭐⭐⭐**

#### 特点
- ✅ **完全免费**
- ✅ **无需注册**
- ✅ **易获取**
- ⚠️ 偶尔不稳定
- ⚠️ 可能有反爬虫限制

#### API示例
```javascript
// 获取沪深300指数行情
const url = 'http://hq.sinajs.cn/list=sh000300';
fetch(url)
  .then(res => res.text())
  .then(data => {
    console.log(data);
  });
```

---

### 4. **腾讯财经 API ⭐⭐⭐**

#### 特点
- ✅ **完全免费**
- ✅ **无需注册**
- ⚠️ 接口可能变更

#### API示例
```javascript
const url = 'http://qt.gtimg.cn/q=sh000300';
fetch(url)
  .then(res => res.text())
  .then(data => {
    console.log(data);
  });
```

---

### 5. **Tushare Pro (部分免费) ⭐⭐⭐⭐**

#### 特点
- ✅ **数据权威**，官方接口
- ✅ **稳定性好**
- ✅ **数据全面**
- ⚠️ 需要注册账号
- ⚠️ 部分数据需要积分
- ⚠️ 新用户免费积分有限

#### 免费配额
- 注册送100积分
- 日线数据：5积分/条
- 基本面数据：10积分/条
- 分钟数据：需要更多积分

#### 使用方法
```javascript
const tushare = require('tushare');
tushare.set_token('your_token');

// 获取日线数据（消耗5积分）
const data = await tushare.index_daily({
  ts_code: '000300.SH',
  start_date: '20240101',
  end_date: '20250126'
});
```

---

## 🎯 推荐方案

### 方案1: akshare (Python)
**适用场景**: 需要全面数据，Python开发

```python
# 安装
pip install akshare

# 使用
import akshare as ak

# 获取指数日线数据
df = ak.index_zh_a_hist(symbol="000300", period="daily", start_date="20240101", end_date="20250126")

# 保存为CSV
df.to_csv('index_data.csv', index=False)
```

### 方案2: 东方财富 API (Node.js)
**适用场景**: Node.js开发，Web服务

```javascript
// 创建API客户端
class EastMoneyAPI {
  async getIndexKline(code, period = '101', limit = 100) {
    const url = `http://push2his.eastmoney.com/api/qt/kline/get?secid=${code}&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=${period}&fqt=1&lmt=${limit}`;

    const response = await fetch(url);
    const data = await response.json();

    return data.data.klines.map(k => {
      const [time, open, close, high, low, volume, amount] = k.split(',');
      return { time, open, high, low, close, volume, amount };
    });
  }
}

// 使用
const api = new EastMoneyAPI();
const klines = await api.getIndexKline('1.000300', '101', 100);
```

---

## 📊 数据源对比

| 数据源 | 免费度 | 稳定性 | 数据量 | 易用性 | 推荐度 |
|--------|--------|--------|--------|--------|--------|
| **akshare** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 5星 |
| **东方财富** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 4星 |
| **新浪财经** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | 3星 |
| **腾讯财经** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | 3星 |
| **Tushare** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 3星 |

---

## 🚀 推荐实施：使用akshare

### 优点
1. **完全免费**，无需注册
2. **数据权威**，来源可靠
3. **更新及时**，支持实时数据
4. **易于集成**，Python pip安装
5. **文档完善**，社区活跃

### 集成方法

#### 1. 创建Python脚本
```python
# cn_stock_data_fetch.py
import akshare as ak
import json
import sys

def fetch_index_data(code, start_date, end_date):
    """获取指数日线数据"""
    try:
        df = ak.index_zh_a_hist(
            symbol=code,
            period="daily",
            start_date=start_date,
            end_date=end_date
        )
        return df.to_json(orient='records')
    except Exception as e:
        print(f"Error: {e}")
        return None

if __name__ == '__main__':
    code = sys.argv[1]
    start = sys.argv[2]
    end = sys.argv[3]

    result = fetch_index_data(code, start, end)
    if result:
        print(result)
```

#### 2. Node.js调用
```javascript
const { exec } = require('child_process');

async function fetchIndexData(code, start, end) {
  return new Promise((resolve, reject) => {
    exec(`python3 cn_stock_data_fetch.py ${code} ${start} ${end}`, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(JSON.parse(stdout));
    });
  });
}

// 使用
const data = await fetchIndexData('000300', '20240101', '20250126');
```

---

## 📝 实际操作

### 方案选择建议

#### 🔹 **开发/测试阶段**
使用 **akshare** 或 **东方财富 API**（免费，易用）

#### 🔹 **生产环境**
- 如果资金充足：使用 **Tushare Pro**（稳定性好，数据全）
- 如果预算有限：继续使用 **东方财富 API**（配合缓存策略）

#### 🔹 **混合使用**
- **历史数据**：使用 akshare 或东方财富
- **实时数据**：使用东方财富 API
- **基本面数据**：使用 Tushare（按需付费）

---

## 🔗 参考链接

- [akshare GitHub](https://github.com/akfamily/akshare)
- [东方财富API文档](https://quote.eastmoney.com/)
- [Tushare Pro](https://tushare.pro/)
- [新浪财经](http://finance.sina.com.cn/)
- [腾讯财经](https://finance.qq.com/)

---

## ⚠️ 注意事项

### 1. 请求频率限制
- 所有免费API都有频率限制
- 建议添加请求间隔（1-2秒）
- 使用缓存减少API调用

### 2. 数据准确性
- 免费数据源可能存在延迟
- 建议多个数据源交叉验证
- 重要数据使用官方数据

### 3. 法律合规
- 确保数据使用符合相关规定
- 不要过度请求，遵循robots.txt
- 商业使用需要授权

---

**建议**: 优先使用 **akshare**，完全免费且功能强大！

