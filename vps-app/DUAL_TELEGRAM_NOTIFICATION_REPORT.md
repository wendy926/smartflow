# 双机器人Telegram通知功能实现报告

## 功能概述

成功实现了双机器人Telegram通知功能，将15min信号通知和模拟交易执行通知分离，使用不同的机器人配置。

## 实现内容

### 1. 通知逻辑分离
- **15min信号通知**：使用当前机器人配置（bot token: `8023308948:AAEOK1pHR`）
- **模拟交易执行通知**：使用新机器人配置（bot token: `1111111`）
- **相同Chat ID**：两个机器人使用相同的chat ID

### 2. TelegramNotifier模块更新

#### 2.1 双机器人配置支持
```javascript
class TelegramNotifier {
    constructor() {
        // 15min信号通知机器人配置
        this.botToken = null;
        this.chatId = null;
        this.enabled = false;
        this.initialized = false;
        
        // 模拟交易执行通知机器人配置
        this.simulationBotToken = null;
        this.simulationChatId = null;
        this.simulationEnabled = false;
        this.simulationInitialized = false;
    }
}
```

#### 2.2 初始化方法
- `init(botToken, chatId)`：初始化15min信号通知机器人
- `initSimulation(botToken, chatId)`：初始化模拟交易通知机器人

#### 2.3 消息发送方法
- `sendMessage(message, type)`：支持指定机器人类型
  - `type = 'signal'`：使用15min信号机器人
  - `type = 'simulation'`：使用模拟交易机器人

### 3. 服务器配置更新

#### 3.1 双机器人初始化
```javascript
// 15min信号通知配置
const botToken = await this.db.getUserSetting('telegramBotToken', '');
const chatId = await this.db.getUserSetting('telegramChatId', '');
this.telegramNotifier.init(botToken, chatId);

// 模拟交易通知配置
const simulationBotToken = await this.db.getUserSetting('telegramSimulationBotToken', '1111111');
const simulationChatId = await this.db.getUserSetting('telegramSimulationChatId', chatId || '');
this.telegramNotifier.initSimulation(simulationBotToken, simulationChatId);
```

#### 3.2 新增API接口
- `POST /api/telegram-simulation-config`：配置模拟交易机器人
- `POST /api/telegram-simulation-test`：测试模拟交易通知
- `GET /api/telegram-config`：返回两个机器人的状态

### 4. 通知类型分离

#### 4.1 15min信号通知
- **触发时机**：策略分析检测到执行模式时
- **使用机器人**：当前机器人（`8023308948:AAEOK1pHR`）
- **通知内容**：交易对、执行模式、价格信息、触发原因等

#### 4.2 模拟交易执行通知
- **触发时机**：模拟交易开启和结束时
- **使用机器人**：新机器人（`1111111`）
- **通知内容**：交易详情、盈亏结果、执行状态等

### 5. 配置管理

#### 5.1 数据库存储
- `telegramBotToken`：15min信号机器人token
- `telegramChatId`：15min信号机器人chat ID
- `telegramSimulationBotToken`：模拟交易机器人token
- `telegramSimulationChatId`：模拟交易机器人chat ID

#### 5.2 配置状态查询
```json
{
  "signal": {
    "enabled": true,
    "initialized": true,
    "hasBotToken": true,
    "hasChatId": true,
    "configured": true
  },
  "simulation": {
    "enabled": true,
    "initialized": true,
    "hasBotToken": true,
    "hasChatId": true,
    "configured": true
  }
}
```

### 6. 测试验证

#### 6.1 配置验证
- ✅ 15min信号机器人配置成功
- ✅ 模拟交易机器人配置成功
- ✅ 两个机器人使用相同chat ID

#### 6.2 功能测试
- ✅ 15min信号通知测试成功
- ✅ 模拟交易通知测试（预期失败，因为bot token无效）
- ✅ 配置状态查询正常

#### 6.3 实际运行
- ✅ 15min信号通知正常工作
- ✅ 模拟交易通知逻辑正确（使用新机器人）
- ✅ 错误处理机制正常

## 技术架构

```
策略分析 → 15min信号检测 → 15min信号机器人 → Telegram API
    ↓
模拟交易执行 → 模拟交易机器人 → Telegram API
```

## 使用说明

### 1. 配置15min信号机器人
```bash
curl -X POST 'https://smart.aimaventop.com/api/telegram-config' \
  -H 'Content-Type: application/json' \
  -d '{"botToken":"YOUR_SIGNAL_BOT_TOKEN","chatId":"YOUR_CHAT_ID"}'
```

### 2. 配置模拟交易机器人
```bash
curl -X POST 'https://smart.aimaventop.com/api/telegram-simulation-config' \
  -H 'Content-Type: application/json' \
  -d '{"botToken":"YOUR_SIMULATION_BOT_TOKEN","chatId":"YOUR_CHAT_ID"}'
```

### 3. 测试通知
```bash
# 测试15min信号通知
curl -X POST 'https://smart.aimaventop.com/api/telegram-test'

# 测试模拟交易通知
curl -X POST 'https://smart.aimaventop.com/api/telegram-simulation-test'
```

### 4. 查看配置状态
```bash
curl 'https://smart.aimaventop.com/api/telegram-config'
```

## 功能特点

### 1. 分离管理
- 15min信号和模拟交易通知使用不同机器人
- 便于独立管理和配置
- 支持不同的通知策略

### 2. 灵活配置
- 支持动态配置两个机器人
- 配置存储在数据库中
- 支持配置更新和测试

### 3. 错误隔离
- 一个机器人故障不影响另一个
- 独立的错误处理机制
- 详细的日志记录

### 4. 向后兼容
- 保持原有API接口
- 现有功能不受影响
- 平滑升级

## 总结

双机器人Telegram通知功能已成功实现并部署，具备以下优势：

1. **功能分离**：15min信号和模拟交易通知使用不同机器人
2. **配置灵活**：支持独立配置和管理两个机器人
3. **错误隔离**：一个机器人故障不影响另一个
4. **向后兼容**：保持原有功能不受影响
5. **易于维护**：清晰的架构和完整的API支持

该功能将提供更精细化的通知管理，让用户能够根据需要配置不同的通知策略。
