# CN VPS部署状态报告

## 部署日期
2025-10-27

## VPS信息
- **IP地址**: 121.41.228.109
- **域名**: https://smart.aimaven.top/
- **操作系统**: Alibaba Cloud Linux 3
- **SSH密钥**: ~/.ssh/smartflow_vps_cn

## 已完成步骤

### 1. SSH免密登录配置 ✅
```bash
ssh -i ~/.ssh/smartflow_vps_cn root@121.41.228.109
```

### 2. 基础软件安装 ✅
- **Git**: 已安装
- **Redis**: 已安装并运行
- **Python3**: 已安装
- **Node.js**: v18.20.8 (已安装到 `/usr/local/nodejs`)
- **PM2**: 已安装

### 3. 代码部署 ✅
- **方式**: 打包上传（CN VPS无法访问GitHub）
- **位置**: `/home/admin/trading-system-v2`
- **状态**: 代码已解压，依赖已安装

### 4. 环境变量配置 ✅
- **文件**: `/home/admin/trading-system-v2/.env`
- **端口**: 8080
- **数据库**: 待配置
- **Redis**: localhost:6379

## 待完成步骤

### 1. MySQL/MariaDB配置
```bash
# 安装MariaDB
yum install -y mariadb-server

# 启动服务
systemctl enable mariadb
systemctl start mariadb

# 创建数据库
mysql -u root -p
CREATE DATABASE smartflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON smartflow.* TO 'root'@'localhost';

# 导入数据库结构（需要从SG VPS复制）
# mysql -u root -p smartflow < schema.sql
```

### 2. Nginx安装和配置
```bash
# Alibaba Cloud Linux 3 需要特殊配置
# 方案1: 使用阿里云镜像安装
yum install -y nginx --enablerepo=alinux3

# 或 方案2: 手动编译安装
# 参考: https://nginx.org/en/download.html

# 配置文件位置: /etc/nginx/nginx.conf
```

### 3. SSL证书配置
```bash
# 安装Certbot (Let's Encrypt)
yum install -y certbot python3-certbot-nginx

# 申请证书
certbot --nginx -d smart.aimaven.top

# 或使用自签名证书（测试用）
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/smartflow.key \
    -out /etc/nginx/ssl/smartflow.crt \
    -subj "/C=CN/ST=ZJ/L=HZ/O=SmartFlow/OU=IT/CN=smart.aimaven.top"
```

### 4. 防火墙配置
```bash
# 开放必要端口
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --permanent --add-port=8080/tcp
firewall-cmd --reload

# 或使用iptables
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT
iptables -A INPUT -p tcp --dport 8080 -j ACCEPT
```

### 5. 应用启动
```bash
cd /home/admin/trading-system-v2

# 启动应用
pm2 start src/main.js --name smartflow-cn

# 保存PM2配置
pm2 save

# 设置开机自启
pm2 startup
```

## 部署命令汇总

```bash
# 1. SSH登录
ssh -i ~/.ssh/smartflow_vps_cn root@121.41.228.109

# 2. 安装MariaDB
yum install -y mariadb-server mariadb
systemctl enable mariadb
systemctl start mariadb

# 3. 创建数据库
mysql -u root -e "CREATE DATABASE IF NOT EXISTS smartflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 4. 导入数据库（需要先从SG VPS导出）
# mysqldump -u root -p smartflow > smartflow.sql
# scp smartflow.sql root@121.41.228.109:/home/admin/
# mysql -u root -p smartflow < smartflow.sql

# 5. 安装Nginx
# 参考上面的Nginx安装命令

# 6. 配置Nginx
# 参考 CN_VPS_DEPLOYMENT_GUIDE.md

# 7. 启动应用
cd /home/admin/trading-system-v2
pm2 start src/main.js --name smartflow-cn
pm2 logs smartflow-cn

# 8. 配置域名DNS
# 在Cloudflare添加A记录: smart.aimaven.top -> 121.41.228.109
```

## 问题和解决方案

### 问题1: 无法访问GitHub
**影响**: CN VPS无法直接拉取GitHub代码
**解决**: 使用打包上传方式部署代码

### 问题2: Alibaba Cloud Linux 3 特殊配置
**影响**: 某些软件包名称与CentOS/RHEL不同
**解决**: 使用阿里云官方软件源，参考官方文档

### 问题3: 网络连接限制
**影响**: 连接GitHub等国外网站超时
**解决**: 使用镜像源或打包上传

## 下一步行动

1. **安装和配置MySQL/MariaDB**
2. **安装和配置Nginx**
3. **配置SSL证书**
4. **导入数据库结构**
5. **启动应用并验证**

## 参考资料

- Alibaba Cloud Linux 3 官方文档: https://help.aliyun.com/product/184189.html
- Nginx安装指南: http://nginx.org/en/download.html
- Let's Encrypt证书申请: https://letsencrypt.org/
- PM2部署指南: https://pm2.keymetrics.io/docs/usage/quick-start/

## 联系方式

如有问题，请联系:
- SSH登录: `ssh -i ~/.ssh/smartflow_vps_cn root@121.41.228.109`
- 域名访问: https://smart.aimaven.top/

