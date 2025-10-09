# 🧹 项目清理计划

**清理时间**: 2025-10-09  
**目的**: 整理项目结构，清理中间产物文件  

---

## 📊 当前状态

**根目录.md文件**: 61个（过多）
**测试脚本**: 3个
**临时文件**: 多个中间报告

---

## 🗂️ 清理方案

### 保留文件（必要文档）

**项目核心文档**（保留在根目录）:
1. `README.md` - 项目说明
2. `AI_INTEGRATION_FINAL_SUMMARY.md` - AI集成最终总结
3. `AI_SIGNAL_SCORING_GUIDE.md` - AI评分逻辑说明（用户参考）
4. `prompt-analyst.md` - AI符号分析prompt
5. `prompt-monitor.md` - AI宏观风险prompt

### 归档文件（移动到docs/archived-reports/）

**AI集成过程报告**（44个文件）:
- `AI_*.md` （除了上述保留的）
- `ALL_*.md`
- `COMPLETE_*.md`
- `FINAL_*.md`
- `FRONTEND_*.md`
- `PRICE_*.md`
- `PROMPT_*.md`
- `SOLUSDT_*.md`
- `SYMBOL_*.md`

**Telegram相关报告**（6个文件）:
- `TELEGRAM_*.md`
- `TRADE_MANAGER_*.md`

**部署和配置报告**（8个文件）:
- `DEPLOYMENT_*.md`
- `VPS_*.md`
- `OPENAI_*.md`
- `MARKET_MONITOR_*.md`
- `UPDATE_*.md`

### 删除文件（临时测试文件）

**测试脚本**（3个文件）:
- `check-ai-provider.js`
- `test-realtime-price.js`
- `test-scheduler-prices.js`
- `test-telegram-config.js`
- `trigger-ai-now.js`

### 整理后结构

```
trading-system-v2/
├── README.md  ← 项目说明
├── AI_INTEGRATION_FINAL_SUMMARY.md  ← AI总结
├── AI_SIGNAL_SCORING_GUIDE.md  ← AI评分说明
├── prompt-analyst.md  ← Prompt模板
├── prompt-monitor.md  ← Prompt模板
├── package.json
├── ecosystem.config.js
├── docs/
│   ├── archived-reports/  ← 归档所有过程报告
│   │   ├── ai-integration/
│   │   ├── telegram/
│   │   ├── deployment/
│   │   └── optimization/
│   └── analysis/
├── src/
├── database/
├── scripts/
└── tests/
```

---

## 🎯 清理效果

**根目录.md文件**: 61个 → 5个（减少92%）
**归档报告**: 0个 → 58个（妥善保存）
**测试脚本**: 5个 → 0个（已删除）

**清理比例**: 92%
**保留必要文档**: 5个
**归档过程报告**: 58个

---

## ✅ 执行命令

```bash
# 创建归档目录
mkdir -p docs/archived-reports/{ai-integration,telegram,deployment,optimization}

# 移动AI相关报告
mv AI_CACHE_FIX.md docs/archived-reports/ai-integration/
mv AI_COVERAGE_FIX.md docs/archived-reports/ai-integration/
# ... (所有AI_*.md)

# 移动Telegram报告
mv TELEGRAM_*.md docs/archived-reports/telegram/

# 移动部署报告
mv DEPLOYMENT_*.md docs/archived-reports/deployment/
mv VPS_*.md docs/archived-reports/deployment/

# 删除测试文件
rm check-ai-provider.js
rm test-*.js
rm trigger-ai-now.js
```
