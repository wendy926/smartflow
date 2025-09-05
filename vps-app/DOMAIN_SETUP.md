# 🌐 smart.aimaventop.com 域名配置指南

## 📋 配置概览

- **域名**: smart.aimaventop.com
- **VPS IP**: 47.237.163.85
- **应用端口**: 8080
- **SSL**: Cloudflare 处理

## 🔧 步骤 1: Cloudflare DNS 配置

### 1.1 登录 Cloudflare
1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 选择域名 `aimaventop.com`

### 1.2 添加 DNS 记录
在 `DNS` → `记录` 页面添加：

| 类型 | 名称 | 内容 | 代理状态 | TTL |
|------|------|------|----------|-----|
| A | smart | 47.237.163.85 | 🟠 已代理 | 自动 |

### 1.3 SSL/TLS 配置
1. 进入 `SSL/TLS` → `概述`
2. 选择 `完全（严格）` 模式
3. 进入 `SSL/TLS` → `边缘证书`
4. 启用 `始终使用 HTTPS`

## 🖥️ 步骤 2: VPS 服务器配置

### 2.1 上传配置文件
将以下文件上传到 VPS 服务器：
- `setup-domain.sh` - 域名配置脚本
- `nginx-config.conf` - Nginx 配置文件

### 2.2 运行配置脚本
```bash
# 在 VPS 服务器上执行
cd /path/to/smartflow-vps-app/vps-app
chmod +x setup-domain.sh
sudo ./setup-domain.sh
```

### 2.3 验证配置
```bash
# 检查 Nginx 状态
sudo systemctl status nginx

# 检查 Nginx 配置
sudo nginx -t

# 查看日志
sudo tail -f /var/log/nginx/aimaventop.com.access.log
```

## 🧪 步骤 3: 测试访问

### 3.1 基本测试
```bash
# 测试 HTTP 重定向
curl -I http://smart.aimaventop.com

# 测试 HTTPS 访问
curl -I https://smart.aimaventop.com

# 测试 API
curl https://smart.aimaventop.com/api/test
```

### 3.2 浏览器测试
访问以下 URL：
- https://smart.aimaventop.com - 主页面
- https://smart.aimaventop.com/api/test - API 测试
- https://smart.aimaventop.com/health - 健康检查
- https://smart.aimaventop.com/api/analyze-all - 分析所有交易对

## 🔍 故障排除

### 问题 1: DNS 解析失败
```bash
# 检查 DNS 解析
nslookup smart.aimaventop.com
dig smart.aimaventop.com
```

### 问题 2: SSL 证书错误
- 确保 Cloudflare SSL 模式设置为 `完全（严格）`
- 检查 VPS 上的 SSL 证书配置

### 问题 3: 502 Bad Gateway
```bash
# 检查 Node.js 应用状态
pm2 status smartflow-app

# 检查端口占用
netstat -tlnp | grep 8080

# 重启应用
pm2 restart smartflow-app
```

### 问题 4: 连接超时
```bash
# 检查防火墙
sudo ufw status

# 开放必要端口
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 8080
```

## 📊 监控和维护

### 日志文件
- Nginx 访问日志: `/var/log/nginx/smart.aimaventop.com.access.log`
- Nginx 错误日志: `/var/log/nginx/smart.aimaventop.com.error.log`
- 应用日志: `pm2 logs smartflow-app`

### 性能监控
```bash
# 查看 Nginx 状态
sudo systemctl status nginx

# 查看应用状态
pm2 status

# 查看系统资源
htop
```

## 🚀 优化建议

### 1. 启用 Gzip 压缩
在 Nginx 配置中添加：
```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
```

### 2. 设置缓存
```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 3. 安全加固
- 定期更新系统和软件包
- 配置防火墙规则
- 监控访问日志
- 设置访问频率限制

## 📞 支持

如果遇到问题，请检查：
1. Cloudflare DNS 记录是否正确
2. VPS 服务器是否正常运行
3. Nginx 配置是否正确
4. 防火墙设置是否允许访问

---

**配置完成后，你的 SmartFlow 应用将通过 https://smart.aimaventop.com 访问！** 🎉
