# Cloudflare 地区限制配置指南

## 方法1：使用 Cloudflare Transform Rules

### 步骤1：在 Cloudflare Dashboard 中配置

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 选择你的域名或 Workers 域名
3. 进入 "Rules" > "Transform Rules"
4. 创建新的 "Rewrite URL" 规则

### 步骤2：配置规则

**规则名称**: `Binance API Region Redirect`

**条件**:
```
(http.request.uri.path contains "/api" and ip.geoip.country in {"US" "CA" "GB" "NL" "NG" "BE" "CU" "IR" "SY" "KP" "PH"})
```

**操作**:
```
Rewrite to: /api/restricted
```

### 步骤3：在 Worker 中处理受限请求

在 Worker 中添加处理受限地区的逻辑：

```javascript
if (url.pathname === '/api/restricted') {
  return new Response(JSON.stringify({
    error: 'Service not available in your region',
    message: 'This service is not available in restricted regions due to Binance API limitations',
    suggestion: 'Please use a VPN or access from a different region'
  }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

## 方法2：使用 Cloudflare Workers 的 Geo 路由

### 在 wrangler.toml 中配置

```toml
# 地区限制配置
[compatibility_flags]
nodejs_compat = true

# 环境变量
[vars]
ALLOWED_COUNTRIES = "SG,JP,KR,AU,CA,GB,DE,FR,IT,ES,NL,SE,NO,DK,FI,CH,AT,BE,LU,IE,PT,GR,CZ,PL,HU,SK,SI,HR,RO,BG,LT,LV,EE,CY,MT"

# 路由配置
[[routes]]
pattern = "smartflow-trader.wendy-wang926.workers.dev/*"
zone_name = "workers.dev"
```

## 方法3：使用代理服务

### 配置代理 API

如果需要在受限地区使用，可以配置代理服务：

```javascript
// 在 BinanceAPI 类中添加代理支持
static async getKlines(symbol, interval, limit = 500) {
  const baseUrl = this.getProxyUrl() || this.BASE_URL;
  const url = `${baseUrl}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SmartFlow/1.0)',
      'Accept': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Binance API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.map(k => ({
    time: k[0],
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
    closeTime: k[6],
    quoteVolume: parseFloat(k[7]),
    trades: parseInt(k[8]),
    takerBuyBaseVolume: parseFloat(k[9]),
    takerBuyQuoteVolume: parseFloat(k[10])
  }));
}
```

## 方法4：使用 Cloudflare 的 Page Rules

### 配置 Page Rules

1. 进入 "Rules" > "Page Rules"
2. 创建新规则

**URL Pattern**: `smartflow-trader.wendy-wang926.workers.dev/api/*`

**设置**:
- Browser Cache TTL: 1 hour
- Security Level: High
- Disable Security

**条件**:
- Country: Not in (US, CA, GB, NL, NG, BE, CU, IR, SY, KP, PH)

## 推荐方案

建议使用 **方法1 (Transform Rules)** 结合 **方法2 (Geo 路由)**，这样可以：

1. 在 Cloudflare 边缘节点层面就过滤掉受限地区的请求
2. 减少 Worker 的计算资源消耗
3. 提供更好的用户体验
4. 避免 Binance API 的 403 错误

## 测试配置

部署后，可以通过以下方式测试：

```bash
# 测试不同地区的访问
curl -H "CF-IPCountry: US" https://smartflow-trader.wendy-wang926.workers.dev/api/test
curl -H "CF-IPCountry: CN" https://smartflow-trader.wendy-wang926.workers.dev/api/test
curl -H "CF-IPCountry: SG" https://smartflow-trader.wendy-wang926.workers.dev/api/test
```
