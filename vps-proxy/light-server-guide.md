# 阿里云轻量应用服务器配置指南

## 🚨 问题分析

阿里云轻量应用服务器没有安全组，只有防火墙配置。需要同时配置：
1. **阿里云控制台防火墙**
2. **VPS 系统防火墙**

## 🔧 阿里云控制台配置

### 1. 登录轻量应用服务器控制台

1. 访问 [轻量应用服务器控制台](https://swas.console.aliyun.com/)
2. 登录你的账号

### 2. 找到你的实例

1. 在实例列表中找到你的服务器（主机名：iZt4nfung78ymt8out05jzZ）
2. 点击实例名称进入详情页

### 3. 配置防火墙

1. 点击 **"防火墙"** 标签页
2. 点击 **"添加规则"** 按钮
3. 配置如下：
   - **端口**：3000
   - **协议**：TCP
   - **来源**：0.0.0.0/0
   - **描述**：SmartFlow Proxy Server
4. 点击 **"确定"** 保存

### 4. 验证规则

确保防火墙规则列表中有：
```
端口    协议    来源        描述
3000    TCP     0.0.0.0/0   SmartFlow Proxy Server
22      TCP     0.0.0.0/0   SSH (默认)
```

## 🔧 VPS 系统防火墙配置

在 VPS 上执行以下命令：

```bash
# 1. 启用防火墙
sudo ufw enable

# 2. 开放必要端口
sudo ufw allow ssh
sudo ufw allow 3000

# 3. 检查防火墙状态
sudo ufw status
```

## 🧪 测试步骤

### 1. 在 VPS 上测试

```bash
# 运行配置脚本
curl -sSL https://raw.githubusercontent.com/wendy926/smartflow/main/vps-proxy/configure-light-server.sh | bash
```

### 2. 从本地测试

```bash
# 测试健康检查
curl http://47.237.163.85:3000/health

# 测试 Binance API 代理
curl "http://47.237.163.85:3000/api/binance/fapi/v1/klines?symbol=BTCUSDT&interval=1h&limit=5"
```

## 🔍 故障排除

### 如果仍然无法访问

1. **检查阿里云控制台防火墙**
   - 确保端口 3000 已添加
   - 确保来源是 0.0.0.0/0
   - 等待 1-2 分钟让规则生效

2. **检查 VPS 系统防火墙**
   ```bash
   # 检查防火墙状态
   sudo ufw status
   
   # 如果端口没有开放，手动添加
   sudo ufw allow 3000
   ```

3. **检查服务状态**
   ```bash
   # 检查 PM2 状态
   pm2 status
   
   # 检查端口监听
   netstat -tlnp | grep :3000
   ```

4. **检查服务日志**
   ```bash
   # 查看服务日志
   pm2 logs smartflow-proxy --lines 20
   ```

### 临时开放所有端口（测试用）

如果上述方法都不行，可以临时开放所有端口进行测试：

**阿里云控制台**：
- 端口：1-65535
- 协议：TCP
- 来源：0.0.0.0/0

**VPS 系统**：
```bash
sudo ufw allow 1:65535/tcp
```

**注意：测试完成后请立即删除此规则！**

## ✅ 验证清单

- [ ] 阿里云控制台防火墙已配置
- [ ] 端口 3000 已开放
- [ ] 来源设置为 0.0.0.0/0
- [ ] VPS 系统防火墙已配置
- [ ] 服务正在运行
- [ ] 端口正在监听
- [ ] 外部连接测试通过

## 📞 支持

如果按照上述步骤配置后仍然无法访问，请检查：

1. 阿里云轻量应用服务器是否有其他网络限制
2. 实例是否在正确的区域
3. 是否有其他安全策略阻止连接
4. 服务是否绑定到 0.0.0.0:3000
