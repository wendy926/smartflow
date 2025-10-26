# Gmail 两步验证和应用专用密码设置指南

## 问题：无法访问应用专用密码页面

**错误提示**："The setting you are looking for is not available for your account."

**原因**：必须先启用两步验证，才能生成应用专用密码。

## 解决步骤

### 步骤 1：启用两步验证

1. **访问 Google 账户**：https://myaccount.google.com
2. **登录**您的 Gmail 账户（wendy.wang926@gmail.com）
3. **点击左侧菜单的"安全性"**
4. **找到"两步验证"**
5. **点击"开始使用"**
6. **选择验证方式**：
   - ✅ 手机号码（推荐）
   - ✅ Google 身份验证器（TOTP）
   - ✅ 备用代码
7. **按照提示完成设置**
8. **启用两步验证**

### 步骤 2：生成应用专用密码

启用两步验证后：

1. **返回安全性页面**：https://myaccount.google.com/security
2. **找到"应用专用密码"**
3. **点击"应用专用密码"**
4. **如果需要，输入 Google 账户密码**
5. **选择应用**："邮件"
6. **选择设备**："其他（自定义名称）"
7. **输入名称**："SmartFlow"
8. **点击"生成"**
9. **复制 16 位密码**（格式类似：`abcd efgh ijkl mnop`，使用时**去除空格**）

## 替代方案：如果无法启用两步验证

如果您的账户不支持两步验证（某些组织账户限制），可以尝试以下方案：

### 方案 A：使用"安全性较低的应用"访问权限

⚠️ **不推荐**，安全性较低，可能无法使用。

### 方案 B：使用其他邮件服务商

#### 使用 QQ 邮箱（推荐国内用户）

1. **登录 QQ 邮箱**：https://mail.qq.com
2. **点击"设置" → "账户"**
3. **找到"POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV服务"**
4. **开启服务**（可能需要短信验证）
5. **点击"生成授权码"**
6. **将授权码复制到 VPS 配置**：

```env
SMTP_HOST=smtp.qq.com
SMTP_PORT=587
SMTP_USER=your-qq@qq.com
SMTP_PASS=授权码（不是QQ密码）
```

#### 使用 Outlook/Hotmail

```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=你的密码或应用密码
```

### 方案 C：临时使用开发模式

如果不急于配置真实 SMTP，可以暂时使用开发模式：

- 访问 https://smart.aimaventop.com/
- 点击"发送验证码"
- 在浏览器控制台（F12）中查看网络请求
- 响应 JSON 中的 `code` 字段就是验证码

## 推荐操作流程

### 如果您可以使用 Gmail

1. ✅ 启用两步验证（必需步骤）
2. ✅ 生成应用专用密码
3. ✅ 配置 VPS SMTP
4. ✅ 测试验证码发送

### 如果您无法使用两步验证

1. ✅ 切换到 QQ 邮箱或其他服务商
2. ✅ 获取授权码/应用密码
3. ✅ 配置 VPS SMTP
4. ✅ 测试验证码发送

### 临时解决方案

1. ✅ 使用浏览器开发者工具查看验证码
2. ✅ 或查看 VPS 日志获取验证码
3. ⏸️ 稍后配置真实 SMTP

## 配置命令模板

### Gmail 配置（启用两步验证后）

```bash
cd /home/admin/trading-system-v2/trading-system-v2/trading-system-v2
cp .env .env.backup

cat >> .env << 'EOF'
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=wendy.wang926@gmail.com
SMTP_PASS=你的16位应用专用密码
EOF

pm2 restart main-app
```

### QQ 邮箱配置

```bash
cd /home/admin/trading-system-v2/trading-system-v2/trading-system-v2
cp .env .env.backup

cat >> .env << 'EOF'
SMTP_HOST=smtp.qq.com
SMTP_PORT=587
SMTP_USER=your-qq@qq.com
SMTP_PASS=授权码
EOF

pm2 restart main-app
```

## 下一步

请告诉我您想：
1. 尝试启用 Gmail 两步验证
2. 切换到其他邮件服务商（如 QQ 邮箱）
3. 暂时使用开发模式查看验证码

