# CN VPS SSH免密登录配置指南

## 生成的密钥文件

- **私钥**: `~/.ssh/smartflow_vps_cn`
- **公钥**: `~/.ssh/smartflow_vps_cn.pub`

## 配置步骤

### 方法1: 使用ssh-copy-id（最简单）

```bash
# 首次连接可能需要输入密码
ssh-copy-id -i ~/.ssh/smartflow_vps_cn.pub root@121.41.228.109

# 之后即可免密登录
ssh -i ~/.ssh/smartflow_vps_cn root@121.41.228.109
```

### 方法2: 手动添加（如果方法1失败）

```bash
# 1. 查看公钥内容
cat ~/.ssh/smartflow_vps_cn.pub

# 2. 复制公钥内容，然后SSH登录到CN VPS
ssh root@121.41.228.109

# 3. 在CN VPS上执行以下命令
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# 4. 添加公钥到authorized_keys
echo "你的公钥内容" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# 5. 退出并重新测试
exit
ssh -i ~/.ssh/smartflow_vps_cn root@121.41.228.109
```

## 公钥内容

```
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQCvlxq3Ubqt9sakFJtgQ3b+dllHWYt3IQl/H3sJEJka+QWaOHwRl8MxcBjpOQlojTZ/vyVo8OI9BErsY5d+v1vS4eDCfdug1l4VpMksl1Blfxf531ZM93ntXUFfoodgj0/OUAjDE8kGOkZR6Ls6A/kfnGdN49ckEmE5oiCQ1NmH+eaiD5zy5KOlIlGn4OfGJWZq52N56xowvkEYZ8BdfOiWeK0zqw6tkY+W6O1BgnWQk8whR7YAL5Qdpd5DVOMakVuKfu+ORSngHOowA8JE/a29yQycsZPAmmlqk3aSKViPXuzcGcI5Nmxvkk01h1HzWNCPYHwliOR38fUfyJ4sW/9hnwjuT3iZsaH8k40J/ubbG3oG5p0hq8UnMxfHsTbtiLirNqCkP8YbDs68ilQQcqg/3q7xNVoDNtaA3i5TeumDTKJ9P/7t4NBs8H4dpRS7kqlRfHK146nOGZC2IRlkVLBssHfr00ThsHnEhBB5v4P380x2M372VKmwdnndgFubE/B8CvJs0i3osJ4E5JbWOev1tmJrPxM60w2rrQkywi7SX68ZB1kvfq0yQ6+Osvp6lOTLMX4CBnbPvqkqMBT87wEIUEVhe/6HmJ383kFKbKmcjNVhUQ7R8rHGXtsO9U6nDPz3C4ifopuFvMp6OUQkfHGsXnoOk0Y+0g15oAJb+k0eDw== smartflow-cn-vps
```

## 配置SSH客户端（可选）

为了更方便地登录，可以在 `~/.ssh/config` 中添加配置：

```bash
# 编辑SSH配置文件
vim ~/.ssh/config

# 添加以下内容：
Host cn-vps
    HostName 121.41.228.109
    User root
    IdentityFile ~/.ssh/smartflow_vps_cn
    ServerAliveInterval 60

# 然后就可以简化登录命令
ssh cn-vps
```

## 测试连接

```bash
# 使用密钥登录
ssh -i ~/.ssh/smartflow_vps_cn root@121.41.228.109

# 或使用别名（如果配置了config）
ssh cn-vps
```

## 故障排查

### 1. 权限问题
```bash
# 确保私钥权限正确
chmod 600 ~/.ssh/smartflow_vps_cn
```

### 2. SSH服务器配置
如果无法使用密钥登录，检查CN VPS的SSH配置：

```bash
# 在CN VPS上编辑SSH配置
vim /etc/ssh/sshd_config

# 确保以下设置
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys

# 重启SSH服务
systemctl restart sshd
```

### 3. 防火墙
确保SSH端口22开放：

```bash
# 检查防火墙
firewall-cmd --list-ports

# 如果SSH端口未开放
firewall-cmd --permanent --add-port=22/tcp
firewall-cmd --reload
```

## 使用命令总结

```bash
# 连接CN VPS
ssh -i ~/.ssh/smartflow_vps_cn root@121.41.228.109

# 或配置config后
ssh cn-vps

# 在服务器上部署应用
ssh -i ~/.ssh/smartflow_vps_cn root@121.41.228.109 "cd /path/to/app && git pull && pm2 restart"
```

