# CN VPS部署完成报告

## 部署日期
2025-10-27

## VPS信息
- **IP地址**: 121.41.228.109
- **域名**: https://smart.aimaven.top/
- **操作系统**: Alibaba Cloud Linux 3
- **SSH密钥**: ~/.ssh/smartflow_vps_cn

## 已完成步骤 ✅

### 1. 基础环境配置
- ✅ Node.js v18.20.8 安装
- ✅ PM2 进程管理安装
- ✅ Redis 安装并运行
- ✅ MariaDB 安装并运行
- ✅ 数据库创建: `smartflow`
- ✅ 环境变量配置: `.env`
- ✅ 代码部署完成

### 2. 数据库配置
- ✅ MariaDB root密码设置: `SmartFlow2024!`
- ✅ 数据库schema导入完成 (55张表)
- ⚠️ 缺少部分表: `large_order_detection_results`

### 3. 应用部署
- ✅ 代码位于: `/home/admin/trading-system-v2`
- ✅ PM2应用名: `smartflow-cn`
- ✅ 应用运行状态: online
- ⚠️ 端口监听: 待配置Nginx反向代理

## 当前问题

### 1. 网络连接限制
CN VPS无法访问某些外部API:
- Binance API连接超时
- 以太坊API连接失败
- WebSocket连接失败

**影响**: 部分功能受限，需要在国内配置或使用镜像源

### 2. 缺少数据库表
- `large_order_detection_results` 表不存在
- 需要运行额外的SQL脚本创建

### 3. Nginx未配置
- 需要配置Nginx作为反向代理
- 需要配置SSL证书
- 端口8080未开放

## 待完成步骤

### 1. 创建缺失的表
```bash
# SSH登录CN VPS
ssh -i ~/.ssh/smartflow_vps_cn root@121.41.228.109

# 进入数据库目录
cd /home/admin/trading-system-v2/database

# 导入缺失的表
mysql -u root -pSmartFlow2024! smartflow < large-order-tracking-schema.sql
```

### 2. 配置防火墙
```bash
# 开放端口
firewall-cmd --permanent --add-port=8080/tcp
firewall-cmd --reload

# 或使用iptables
iptables -A INPUT -p tcp --dport 8080 -j ACCEPT
```

### 3. 配置域名DNS
在Cloudflare添加记录:
```
类型: A
名称: smart
内容: 121.41.228.109
代理: 已启用
```

### 4. 配置SSL证书（Let's Encrypt）
```bash
# 安装certbot
yum install -y certbot python3-certbot-nginx

# 申请证书
certbot certonly --standalone -d smart.aimaven.top
```

### 5. 配置Nginx（使用Caddy替代）
由于Alibaba Cloud Linux 3无法直接安装Nginx，可以考虑:
- 使用Caddy作为反向代理
- 或使用阿里云SLB（负载均衡）
- 或直接使用Node.js HTTP服务器

## 简化方案

### 方案1: 使用Caddy（推荐）
```bash
# 下载并安装Caddy
curl https://caddyserver.com/api/download?os=linux&arch=amd64 -o caddy
chmod +x caddy
mv caddy /usr/local/bin/

# 配置Caddyfile
cat > /etc/Caddyfile << 'EOF'
smart.aimaven.top {
    reverse_proxy localhost:8080
}
EOF

# 启动Caddy
caddy start
```

### 方案2: 直接使用Node.js
```bash
# 修改应用端口为80或443
# 需要root权限
# 修改.env中的PORT=80
```

## 当前服务状态

```bash
# 查看PM2状态
ssh -i ~/.ssh/smartflow_vps_cn root@121.41.228.109 "pm2 status"

# 查看应用日志
ssh -i ~/.ssh/smartflow_vps_cn root@121.41.228.109 "pm2 logs smartflow-cn"

# 查看数据库
ssh -i ~/.ssh/smartflow_vps_cn root@121.41.228.109 "mysql -u root -pSmartFlow2024! smartflow -e 'SHOW TABLES;'"

# 重启应用
ssh -i ~/.ssh/smartflow_vps_cn root@121.41.228.109 "pm2 restart smartflow-cn"
```

## 部署总结

CN VPS基础部署已完成，应用正在运行。主要待解决问题:

1. **缺少部分数据库表** - 需要导入额外的schema
2. **网络连接限制** - 无法访问Binance等API
3. **反向代理未配置** - 需要Nginx或Caddy
4. **SSL证书未配置** - 需要Let's Encrypt证书
5. **防火墙未开放** - 需要开放8080端口

## 建议

1. 先解决数据库表缺失问题
2. 配置Caddy作为反向代理
3. 配置SSL证书
4. 开放防火墙端口
5. 测试网站访问

## 下一步操作

```bash
# 1. 登录CN VPS
ssh -i ~/.ssh/smartflow_vps_cn root@121.41.228.109

# 2. 导入缺失的表
cd /home/admin/trading-system-v2/database
mysql -u root -pSmartFlow2024! smartflow < large-order-tracking-schema.sql

# 3. 重启应用
pm2 restart smartflow-cn

# 4. 配置Caddy（可选）
# 下载Caddy并配置反向代理

# 5. 配置防火墙（可选）
firewall-cmd --permanent --add-port=8080/tcp
firewall-cmd --reload
```

## 联系信息

如有问题，请查看日志:
```bash
ssh -i ~/.ssh/smartflow_vps_cn root@121.41.228.109 "pm2 logs smartflow-cn --lines 100"
```

