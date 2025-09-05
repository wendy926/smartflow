# Cloudflare DNS 配置说明

## 目标
将 VPS 应用通过 Cloudflare DNS 代理提供域名访问，实现：
- 域名访问：`https://smartflow.wendy-wang926.workers.dev`
- 真实 Binance 数据
- 无 IP 限制

## 配置步骤

### 1. 在 Cloudflare 控制台添加 DNS 记录

1. **登录 Cloudflare 控制台**
   - 访问：https://dash.cloudflare.com
   - 选择域名：`wendy-wang926.workers.dev`

2. **添加 A 记录**
   - **类型**：A
   - **名称**：`smartflow`
   - **IPv4 地址**：`47.237.163.85`
   - **代理状态**：✅ **已代理**（橙色云朵）
   - **TTL**：自动

3. **添加 CNAME 记录**（可选）
   - **类型**：CNAME
   - **名称**：`smartflow-api`
   - **目标**：`smartflow.wendy-wang926.workers.dev`
   - **代理状态**：✅ **已代理**（橙色云朵）

### 2. 配置 SSL/TLS

1. **SSL/TLS 模式**
   - 进入 **SSL/TLS** → **概述**
   - 选择 **完全（严格）** 模式

2. **边缘证书**
   - 确保 **始终使用 HTTPS** 已启用
   - 确保 **HTTP 严格传输安全 (HSTS)** 已启用

### 3. 配置页面规则（可选）

1. **创建页面规则**
   - 进入 **规则** → **页面规则**
   - 创建规则：`smartflow.wendy-wang926.workers.dev/*`
   - 设置：**缓存级别** → **绕过**

### 4. 验证配置

配置完成后，访问以下地址验证：

- **主页面**：https://smartflow.wendy-wang926.workers.dev
- **API 测试**：https://smartflow.wendy-wang926.workers.dev/api/test
- **健康检查**：https://smartflow.wendy-wang926.workers.dev/health

## 预期结果

✅ **域名访问**：通过 Cloudflare 代理访问 VPS 应用
✅ **真实数据**：直接访问 Binance API，无 IP 限制
✅ **HTTPS 支持**：Cloudflare 提供 SSL 证书
✅ **全球加速**：Cloudflare CDN 加速访问

## 故障排除

### 如果无法访问

1. **检查 DNS 传播**
   ```bash
   nslookup smartflow.wendy-wang926.workers.dev
   ```

2. **检查 VPS 服务**
   ```bash
   curl http://47.237.163.85:3000/health
   ```

3. **检查 Cloudflare 状态**
   - 确保代理状态为橙色云朵
   - 检查 SSL/TLS 配置

### 如果 API 调用失败

1. **检查 VPS 防火墙**
   ```bash
   sudo ufw status
   sudo ufw allow 3000
   ```

2. **检查服务状态**
   ```bash
   pm2 status
   pm2 logs smartflow-app
   ```

## 优势

- **无 IP 限制**：VPS 直接访问 Binance API
- **全球访问**：Cloudflare CDN 加速
- **HTTPS 支持**：自动 SSL 证书
- **高可用性**：Cloudflare 全球网络
- **真实数据**：直接获取 Binance 实时数据
