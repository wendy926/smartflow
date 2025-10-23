# Claude AI Agent 集成设计文档

## 一、需求概述

### 1.1 功能需求
1. **宏观数据监控AI分析**：对BTC和ETH进行风险分析，每2小时更新
2. **交易对AI分析**：对策略表格中的交易对进行趋势和信号分析

### 1.2 技术要求
- Claude API集成（使用proxy）
- 敏感信息存储在VPS数据库
- 高风险触发Telegram报警
- 前端友好交互展示
- 完整的单元测试覆盖

---

## 二、数据库设计

### 2.1 新增表结构

#### 2.1.1 AI分析配置表 (ai_config)
```sql
CREATE TABLE IF NOT EXISTS ai_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE COMMENT '配置键',
    config_value TEXT NOT NULL COMMENT '配置值(加密)',
    config_type ENUM('API_KEY', 'PROXY', 'PROMPT', 'SETTING') DEFAULT 'SETTING',
    description TEXT DEFAULT NULL COMMENT '配置描述',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否激活',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_config_key (config_key),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI配置表';
```

#### 2.1.2 AI市场分析记录表 (ai_market_analysis)
```sql
CREATE TABLE IF NOT EXISTS ai_market_analysis (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL COMMENT '交易对符号',
    analysis_type ENUM('MACRO_RISK', 'SYMBOL_TREND') NOT NULL COMMENT '分析类型',
    analysis_data JSON NOT NULL COMMENT 'AI分析结果(JSON格式)',
    risk_level ENUM('SAFE', 'WATCH', 'DANGER', 'EXTREME') DEFAULT NULL COMMENT '风险等级',
    confidence_score DECIMAL(5, 2) DEFAULT NULL COMMENT '置信度(0-100)',
    alert_triggered BOOLEAN DEFAULT FALSE COMMENT '是否触发告警',
    raw_response TEXT DEFAULT NULL COMMENT 'AI原始响应',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_symbol_type (symbol, analysis_type),
    INDEX idx_risk_level (risk_level),
    INDEX idx_created_at (created_at),
    INDEX idx_alert_triggered (alert_triggered)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI市场分析记录表';
```

#### 2.1.3 AI告警历史表 (ai_alert_history)
```sql
CREATE TABLE IF NOT EXISTS ai_alert_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    analysis_id BIGINT NOT NULL COMMENT '分析记录ID',
    alert_type ENUM('RISK_WARNING', 'RISK_CRITICAL') NOT NULL COMMENT '告警类型',
    alert_message TEXT NOT NULL COMMENT '告警消息',
    telegram_sent BOOLEAN DEFAULT FALSE COMMENT '是否已发送Telegram',
    telegram_message_id VARCHAR(100) DEFAULT NULL COMMENT 'Telegram消息ID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_analysis_id (analysis_id),
    INDEX idx_alert_type (alert_type),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (analysis_id) REFERENCES ai_market_analysis(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI告警历史表';
```

#### 2.1.4 AI调用日志表 (ai_api_logs)
```sql
CREATE TABLE IF NOT EXISTS ai_api_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    request_type ENUM('MACRO_MONITOR', 'SYMBOL_ANALYST') NOT NULL,
    request_data JSON DEFAULT NULL COMMENT '请求数据',
    response_status ENUM('SUCCESS', 'ERROR', 'TIMEOUT') NOT NULL,
    response_time_ms INT DEFAULT NULL COMMENT '响应时间(毫秒)',
    error_message TEXT DEFAULT NULL COMMENT '错误消息',
    tokens_used INT DEFAULT NULL COMMENT '使用Token数',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_request_type (request_type),
    INDEX idx_response_status (response_status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI API调用日志表';
```

### 2.2 现有表扩展

#### 2.2.1 扩展 strategy_judgments 表
```sql
ALTER TABLE strategy_judgments 
ADD COLUMN ai_analysis_id BIGINT DEFAULT NULL COMMENT 'AI分析记录ID',
ADD INDEX idx_ai_analysis_id (ai_analysis_id);
```

---

## 三、系统架构设计

### 3.1 模块划分

```
src/
├── services/
│   ├── ai-agent/
│   │   ├── claude-client.js          # Claude API客户端
│   │   ├── macro-risk-analyzer.js    # 宏观风险分析器
│   │   ├── symbol-trend-analyzer.js  # 交易对趋势分析器
│   │   ├── prompt-manager.js         # Prompt管理器
│   │   ├── response-parser.js        # 响应解析器
│   │   └── scheduler.js              # 定时任务调度器
│   └── ai-alert.js                   # AI告警服务
├── database/
│   └── ai-operations.js              # AI相关数据库操作
├── api/
│   └── routes/
│       └── ai-analysis.js            # AI分析API路由
└── utils/
    └── encryption.js                 # 加密工具(用于API Key)
```

### 3.2 核心类设计

#### 3.2.1 ClaudeClient
```javascript
class ClaudeClient {
  constructor(apiKey, proxyUrl)
  async analyze(prompt, systemPrompt, options)
  async healthCheck()
  getUsageStats()
}
```

#### 3.2.2 MacroRiskAnalyzer
```javascript
class MacroRiskAnalyzer {
  async analyzeBTCRisk()
  async analyzeETHRisk()
  async parseRiskLevel(aiResponse)
  async shouldTriggerAlert(riskLevel)
}
```

#### 3.2.3 SymbolTrendAnalyzer
```javascript
class SymbolTrendAnalyzer {
  async analyzeSymbol(symbol, strategyData)
  async parseAnalysisResult(aiResponse)
  async cacheAnalysis(symbol, result)
}
```

---

## 四、设计原则应用（23个设计原则）

### 4.1 SOLID原则
1. **单一职责原则(SRP)**：每个类只负责一个功能模块
   - `ClaudeClient` 只负责API调用
   - `MacroRiskAnalyzer` 只负责宏观分析
   - `SymbolTrendAnalyzer` 只负责交易对分析

2. **开闭原则(OCP)**：通过接口扩展，不修改现有代码
   - 分析器通过继承基类扩展新功能
   - 使用策略模式处理不同分析类型

3. **里氏替换原则(LSP)**：子类可替换父类
   - 所有分析器实现统一的`analyze()`接口

4. **接口隔离原则(ISP)**：使用小而专的接口
   - 分离读写接口
   - 分离不同类型的分析接口

5. **依赖倒置原则(DIP)**：依赖抽象而非具体实现
   - 通过依赖注入传递数据库连接
   - 使用配置对象而非硬编码

### 4.2 其他关键原则
6. **DRY原则**：避免重复代码，提取公共方法
7. **KISS原则**：保持简单，避免过度设计
8. **YAGNI原则**：只实现当前需要的功能
9. **组合优于继承**：使用组合模式构建功能
10. **最少知识原则**：降低模块间耦合

### 4.3 架构原则
11. **关注点分离**：业务逻辑、数据访问、API调用分离
12. **高内聚低耦合**：模块内部紧密相关，模块间松散耦合
13. **错误处理优先**：完善的错误处理和日志记录
14. **性能优化**：缓存机制、批量处理、异步执行
15. **安全优先**：API Key加密存储、请求验证

### 4.4 可维护性原则
16. **代码可读性**：清晰的命名、注释、文档
17. **可测试性**：单元测试覆盖、Mock数据
18. **可扩展性**：易于添加新的分析类型
19. **可监控性**：日志记录、性能指标
20. **可配置性**：通过配置文件和数据库配置

### 4.5 工程实践
21. **版本控制**：Git分支管理、代码审查
22. **持续集成**：自动化测试、部署流程
23. **文档优先**：先设计后实现、API文档完善

---

## 五、API设计

### 5.1 AI分析API

#### 5.1.1 获取BTC/ETH宏观风险分析
```http
GET /api/v1/ai/macro-risk?symbols=BTCUSDT,ETHUSDT
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "BTCUSDT": {
      "symbol": "BTCUSDT",
      "riskLevel": "DANGER",
      "currentPrice": 122867,
      "analysis": {
        "shortTerm": "顶部特征明显，建议减仓",
        "midTerm": "资金流入放缓，需观察",
        "riskFactors": ["资金费率过高", "ETF净流出"],
        "suggestions": ["止损在$118000", "等待回调至$115000-117000"]
      },
      "confidence": 85,
      "updatedAt": "2025-10-08T10:00:00Z"
    },
    "ETHUSDT": { ... }
  },
  "lastUpdate": "2025-10-08T10:00:00Z"
}
```

#### 5.1.2 获取交易对AI分析
```http
GET /api/v1/ai/symbol-analysis?symbol=BTCUSDT
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "symbol": "BTCUSDT",
    "trendScore": 85,
    "strengthSignal": "强势看多",
    "shortTermPrediction": {
      "direction": "up",
      "confidence": 75,
      "priceRange": [121000, 125000]
    },
    "midTermPrediction": {
      "direction": "sideways",
      "confidence": 60,
      "priceRange": [115000, 130000]
    },
    "updatedAt": "2025-10-08T10:05:00Z"
  }
}
```

#### 5.1.3 手动触发分析
```http
POST /api/v1/ai/analyze
Content-Type: application/json

{
  "type": "macro_risk", // or "symbol_trend"
  "symbols": ["BTCUSDT", "ETHUSDT"]
}
```

### 5.2 配置管理API

#### 5.2.1 获取AI配置状态
```http
GET /api/v1/ai/config/status
```

#### 5.2.2 更新AI配置（管理员）
```http
PUT /api/v1/ai/config
Content-Type: application/json

{
  "updateInterval": 7200, // 2小时
  "enableAlerts": true
}
```

---

## 六、前端交互设计

### 6.1 宏观数据监控区域

#### 布局结构
```html
<!-- 在现有宏观数据监控下方添加 -->
<div class="macro-ai-analysis">
  <h4>AI市场风险分析 <span class="update-time">最后更新: 2小时前</span></h4>
  
  <!-- BTC分析卡片 -->
  <div class="ai-card risk-danger"> <!-- 根据风险等级添加class: risk-safe/risk-watch/risk-danger/risk-extreme -->
    <div class="ai-card-header">
      <h5>🟠 BTC风险分析</h5>
      <span class="risk-badge danger">🔴 危险</span>
    </div>
    <div class="ai-card-body">
      <div class="risk-summary">
        <p class="core-finding">核心发现：顶部特征明显，建议减仓</p>
      </div>
      <div class="risk-details">
        <div class="detail-item">
          <span class="label">当前价格:</span>
          <span class="value">$122,867</span>
        </div>
        <div class="detail-item">
          <span class="label">短期趋势:</span>
          <span class="value">回调概率60%</span>
        </div>
        <div class="detail-item">
          <span class="label">建议操作:</span>
          <span class="value">止损$118,000</span>
        </div>
      </div>
      <button class="btn-expand" onclick="toggleDetails('btc')">查看详细分析</button>
    </div>
  </div>
  
  <!-- ETH分析卡片 -->
  <div class="ai-card risk-watch">
    <!-- 类似结构 -->
  </div>
</div>
```

#### 样式设计
```css
.ai-card {
  margin: 15px 0;
  padding: 15px;
  border-radius: 8px;
  border-left: 4px solid;
  transition: all 0.3s ease;
}

.ai-card.risk-safe {
  border-left-color: #28a745;
  background: #f0fff4;
}

.ai-card.risk-watch {
  border-left-color: #ffc107;
  background: #fffbeb;
}

.ai-card.risk-danger {
  border-left-color: #dc3545;
  background: #fff5f5;
  animation: pulse-danger 2s infinite;
}

.ai-card.risk-extreme {
  border-left-color: #000;
  background: #ffe0e0;
  animation: pulse-extreme 1s infinite;
}

@keyframes pulse-danger {
  0%, 100% { box-shadow: 0 0 0 rgba(220, 53, 69, 0); }
  50% { box-shadow: 0 0 20px rgba(220, 53, 69, 0.5); }
}

@keyframes pulse-extreme {
  0%, 100% { box-shadow: 0 0 0 rgba(0, 0, 0, 0); }
  50% { box-shadow: 0 0 30px rgba(0, 0, 0, 0.6); }
}
```

### 6.2 策略表格AI分析列

#### 表格扩展
```html
<table id="strategy-table">
  <thead>
    <tr>
      <th>交易对</th>
      <th>当前价格</th>
      <!-- 现有列 -->
      <th>AI分析</th> <!-- 新增列 -->
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>BTCUSDT</td>
      <td>$122,867</td>
      <!-- 现有列数据 -->
      <td class="ai-analysis-cell">
        <div class="ai-mini-card">
          <div class="trend-score">
            <span class="score-label">趋势评分:</span>
            <span class="score-value high">85/100</span>
          </div>
          <div class="strength-signal">
            <span class="signal-badge bullish">强势看多</span>
          </div>
          <div class="predictions">
            <small>短期: ↗️ 上涨 (75%)</small>
            <small>中期: ↔️ 震荡 (60%)</small>
          </div>
          <button class="btn-detail" onclick="showAIDetail('BTCUSDT')">详情</button>
        </div>
      </td>
    </tr>
  </tbody>
</table>
```

#### 详情弹窗
```html
<div id="ai-detail-modal" class="modal">
  <div class="modal-content">
    <span class="close">&times;</span>
    <h3>BTCUSDT AI详细分析</h3>
    <div class="detail-content">
      <!-- 显示完整的AI分析结果 -->
    </div>
  </div>
</div>
```

### 6.3 交互流程
1. 页面加载时获取最新AI分析
2. 每2小时自动刷新宏观分析
3. 交易对分析按需加载（表格滚动到视图时）
4. 高风险时自动显示通知
5. 支持手动刷新和查看历史分析

---

## 七、定时任务设计

### 7.1 宏观风险分析任务
```javascript
// 每2小时执行
cron.schedule('0 */2 * * *', async () => {
  await macroRiskAnalyzer.analyzeBTCRisk();
  await macroRiskAnalyzer.analyzeETHRisk();
  await checkAndTriggerAlerts();
});
```

### 7.2 交易对分析任务
```javascript
// 每5分钟更新活跃交易对
cron.schedule('*/5 * * * *', async () => {
  const activeSymbols = await getActiveSymbols();
  for (const symbol of activeSymbols) {
    await symbolTrendAnalyzer.analyzeSymbol(symbol);
  }
});
```

---

## 八、安全设计

### 8.1 API Key管理
- 使用AES-256加密存储
- 环境变量注入到VPS数据库
- 运行时内存解密
- 定期轮换密钥

### 8.2 访问控制
- API调用频率限制
- IP白名单（VPS内部调用）
- 请求签名验证

### 8.3 数据保护
- 敏感数据脱敏
- 日志不记录完整响应
- 定期清理历史数据

---

## 九、性能优化

### 9.1 缓存策略
- Redis缓存AI分析结果（2小时TTL）
- 相同交易对去重
- 预加载热门交易对分析

### 9.2 并发控制
- 批量分析限制并发数
- 请求队列管理
- 超时重试机制

### 9.3 资源管理
- 限制单次分析Token数
- 监控API调用费用
- 降级策略（AI不可用时显示历史数据）

---

## 十、测试策略

### 10.1 单元测试
- Claude客户端测试（Mock API）
- 分析器逻辑测试
- 数据库操作测试
- 加密解密测试

### 10.2 集成测试
- 端到端分析流程测试
- 告警触发测试
- 前端API集成测试

### 10.3 性能测试
- 并发请求压力测试
- 内存泄漏检测
- 响应时间监控

---

## 十一、部署流程

### 11.1 数据库迁移
1. 执行SQL脚本创建新表
2. 初始化配置数据
3. 验证表结构

### 11.2 环境配置
1. VPS配置Claude API Key
2. 设置Proxy URL
3. 更新.env文件

### 11.3 代码部署
1. Git推送代码
2. VPS拉取最新代码
3. 安装依赖
4. PM2重启服务

### 11.4 验证测试
1. 健康检查API
2. 手动触发分析
3. 验证前端显示
4. 测试告警功能

---

## 十二、监控与告警

### 12.1 监控指标
- AI API调用成功率
- 平均响应时间
- Token使用量
- 分析结果准确性

### 12.2 告警规则
- API调用失败超过3次
- 响应时间超过30秒
- 风险等级为DANGER或EXTREME
- Token超出预算

### 12.3 日志记录
- 请求/响应日志
- 错误日志
- 性能日志
- 业务日志

---

## 十三、风险与应对

### 13.1 技术风险
- **API不可用**：使用历史数据降级
- **响应超时**：设置合理超时时间，重试机制
- **成本超标**：监控Token使用，设置预算告警

### 13.2 业务风险
- **分析不准确**：标注AI建议仅供参考
- **过度依赖**：保留人工判断机制
- **延迟更新**：显示更新时间，避免误导

---

## 十四、后续优化

### 14.1 功能扩展
- 支持更多交易对分析
- 历史分析准确性回测
- 自定义分析频率
- 分析结果导出

### 14.2 性能提升
- 增量更新机制
- 智能缓存策略
- 分布式部署

### 14.3 用户体验
- 移动端适配
- 个性化分析
- 交互式图表
- 语音播报告警

---

## 十五、时间规划

| 阶段 | 任务 | 预计时间 |
|------|------|---------|
| 1 | 数据库设计与创建 | 1小时 |
| 2 | Claude客户端开发 | 2小时 |
| 3 | 分析器开发 | 3小时 |
| 4 | API路由开发 | 2小时 |
| 5 | 前端集成 | 3小时 |
| 6 | 单元测试 | 2小时 |
| 7 | 集成测试 | 1小时 |
| 8 | 部署与验证 | 1小时 |
| **总计** | | **15小时** |

---

**设计完成时间**: 2025-10-08
**设计版本**: v1.0
**设计者**: AI Assistant

