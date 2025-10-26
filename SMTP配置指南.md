# Gmail SMTP 配置指南

## 步骤 1: 获取 Gmail 应用专用密码

### 1.1 访问 Google 账户设置
1. 打开浏览器，访问：https://myaccount.google.com
2. 登录您的 Gmail 账户（wendy.wang926@gmail.com）

### 1.2 启用两步验证（如果还没有启用）
1. 在左侧菜单中选择"安全性"
2. 找到"登录 Google"
3. 点击"两步验证"
4. 按照提示启用两步验证（需要手机号）

### 1.3 生成应用专用密码
1. 启用两步验证后，回到"安全性"页面
2. 在"登录 Google"部分，点击"应用专用密码"
3. 选择"邮件"
4. 选择"Mac"或其他
5. 点击"生成"
6. **复制生成的 16 位密码**（例如：abcd efgh ijkl mnop，但实际使用时要去除空格）

**重要提示**：
- 应用专用密码是 16 个字符
- 格式通常显示为 `xxxx xxxx xxxx xxxx`，但使用时去除空格
- 只显示一次，请妥善保管

## 步骤 2: 在 VPS 上配置 SMTP

### 方法 A: 使用 SSH 命令配置（推荐）

连接到 VPS：
```bash
ssh -i ~/.ssh/smartflow_vps_new root@47.237.163.85
```

进入项目目录并编辑 .env 文件：
```bash
cd /home/admin/trading-system-v2/trading-system-v2/trading-system-v2
nano .env
```

在文件末尾添加以下内容（替换为您的实际密码）：
```env
# Gmail SMTP 配置
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=wendy.wang926@gmail.com
SMTP_PASS=你的16位应用专用密码（去除空格）
```

保存并退出（Ctrl+X，然后 Y，然后 Enter）

重启服务：
```bash
pm2 restart main-app
```

### 方法 B: 使用一行命令配置

**在本地执行**（会提示输入密码）：
```bash
ssh -i ~/.ssh/smartflow_vps_new root@47.237.163.85 << 'EOF'
cd /home/admin/trading-system-v2/trading-system-v2/trading-system-v2

# 提示用户输入
read -p "请输入 Gmail 应用专用密码（16位）: " SMTP_PASS

# 备份现有配置
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# 删除旧配置
sed -i '/^SMTP_/d' .env

# 添加新配置
cat >> .env << 'CONFIG'
# Gmail SMTP 配置
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=wendy.wang926@gmail.com
SMTP_PASS=
CONFIG

# 添加密码
sed -i "s/SMTP_PASS=/SMTP_PASS=$SMTP_PASS/" .env

echo "配置完成，重启服务..."
pm2 restart main-app

echo ""
echo "============================================"
echo "✅ SMTP 配置完成！"
echo "============================================"
echo ""
EOF
```

## 步骤 3: 测试验证码发送

1. 访问 https://smart.aimaventop.com/
2. 点击"进入交易系统"
3. 输入邮箱：wendy.wang926@gmail.com
4. 点击"发送验证码"
5. 检查收件箱，应该会收到验证码邮件

## 故障排查

### 如果收不到邮件：

1. **检查垃圾邮件文件夹**：有时邮件会被标记为垃圾邮件

2. **检查 VPS 日志**：
```bash
ssh -i ~/.ssh/smartflow_vps_new root@47.237.163.85
pm2 logs main-app --lines 50 | grep -i "验证码\|smtp"
```

3. **检查配置是否正确**：
```bash
cd /home/admin/trading-system-v2/trading-system-v2/trading-system-v2
grep "^SMTP_" .env
```

4. **常见错误**：
   - ❌ 使用普通密码而不是应用专用密码
   - ❌ 应用专用密码中有空格
   - ❌ 未启用两步验证
   - ❌ SMTP_PASS 配置错误

## 其他 SMTP 服务商配置

### Outlook/Hotmail
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
```

### QQ 邮箱
```env
SMTP_HOST=smtp.qq.com
SMTP_PORT=587
SMTP_USER=your-qq-number@qq.com
SMTP_PASS=授权码
```

**注意事项**：
- 需要开启 SMTP 服务
- 获取授权码（不是密码）
- QQ 邮箱需要在设置中开启 SMTP 服务

## 验证配置是否生效

查看日志确认 SMTP 配置：
```bash
pm2 logs main-app --lines 20 | grep "验证码服务"
```

应该看到：
```
[验证码服务] 邮件发送器已初始化
```

而不是：
```
[验证码服务] SMTP配置未设置，将使用日志模式
```

