# 手动修复 npm 问题

## 🚨 问题分析

从错误信息看，主要问题是：
1. Node.js 已安装但 npm 缺失
2. Ubuntu 的 Node.js 包不包含 npm
3. 需要重新安装包含 npm 的 Node.js

## 🔧 手动修复步骤

### 1. 卸载现有 Node.js

```bash
# 卸载现有的 Node.js
apt remove -y nodejs

# 清理 apt 缓存
apt clean
apt autoclean
```

### 2. 重新安装 Node.js 和 npm

```bash
# 添加 NodeSource 仓库
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -

# 安装 Node.js（包含 npm）
apt-get install -y nodejs

# 验证安装
node --version
npm --version
```

### 3. 如果 npm 仍然缺失，手动安装

```bash
# 手动安装 npm
curl -L https://npmjs.org/install.sh | sh

# 或者使用 apt 安装
apt install -y npm
```

### 4. 进入项目目录并安装依赖

```bash
# 进入项目目录
cd /home/admin/smartflow-proxy

# 安装项目依赖
npm install

# 安装 PM2
npm install -g pm2
```

### 5. 启动服务

```bash
# 启动服务
pm2 start server.js --name smartflow-proxy

# 设置开机自启
pm2 startup
pm2 save
```

### 6. 测试服务

```bash
# 检查服务状态
pm2 status

# 测试健康检查
curl http://localhost:3000/health

# 测试 Binance API 代理
curl "http://localhost:3000/api/binance/fapi/v1/klines?symbol=BTCUSDT&interval=1h&limit=5"
```

## 🚀 一键修复命令

在 VPS 上执行以下命令：

```bash
# 1. 切换到 root 用户
sudo su -

# 2. 卸载现有 Node.js
apt remove -y nodejs

# 3. 重新安装 Node.js 和 npm
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# 4. 验证安装
node --version
npm --version

# 5. 进入项目目录
cd /home/admin/smartflow-proxy

# 6. 安装依赖
npm install

# 7. 安装 PM2
npm install -g pm2

# 8. 启动服务
pm2 start server.js --name smartflow-proxy
pm2 startup
pm2 save

# 9. 测试服务
curl http://localhost:3000/health
```

## 🔍 故障排除

### 如果 npm 仍然缺失

```bash
# 方法1：使用 apt 安装
apt install -y npm

# 方法2：手动安装
curl -L https://npmjs.org/install.sh | sh

# 方法3：使用 nvm 安装
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18
```

### 如果依赖安装失败

```bash
# 清理 npm 缓存
npm cache clean --force

# 删除 node_modules 和 package-lock.json
rm -rf node_modules package-lock.json

# 重新安装
npm install
```

### 如果服务无法启动

```bash
# 查看 PM2 日志
pm2 logs smartflow-proxy

# 手动测试
node server.js
```

## ✅ 验证部署

部署成功后，应该能够访问：

- **健康检查**: http://47.237.163.85:3000/health
- **API 代理**: http://47.237.163.85:3000/api/binance/*

## 📊 管理命令

```bash
# 查看服务状态
pm2 status

# 查看日志
pm2 logs smartflow-proxy

# 重启服务
pm2 restart smartflow-proxy

# 停止服务
pm2 stop smartflow-proxy
```
