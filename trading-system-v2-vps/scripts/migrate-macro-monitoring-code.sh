#!/bin/bash

###############################################################################
# 宏观监控模块代码迁移脚本
# 
# 功能：
# 1. 备份原文件
# 2. 将macro_monitoring_*表操作改为使用UnifiedMonitoringOperations
# 3. 更新所有引用
#
# 使用方法：
#   chmod +x scripts/migrate-macro-monitoring-code.sh
#   ./scripts/migrate-macro-monitoring-code.sh
###############################################################################

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ROOT="/Users/kaylame/KaylaProject/smartflow/trading-system-v2"
BACKUP_DIR="${PROJECT_ROOT}/backup_code_$(date +%Y%m%d_%H%M%S)"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  宏观监控模块代码迁移${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 创建备份目录
echo -e "${YELLOW}[1/5] 创建备份目录...${NC}"
mkdir -p "${BACKUP_DIR}/services/macro-monitor"
mkdir -p "${BACKUP_DIR}/api/routes"
echo -e "${GREEN}✓ 备份目录创建完成: ${BACKUP_DIR}${NC}"
echo ""

# 备份需要修改的文件
echo -e "${YELLOW}[2/5] 备份原文件...${NC}"

FILES_TO_BACKUP=(
  "src/services/macro-monitor/futures-market-monitor.js"
  "src/services/macro-monitor/fund-flow-monitor.js"
  "src/services/macro-monitor/market-sentiment-monitor.js"
  "src/services/macro-monitor/macro-economic-monitor.js"
  "src/services/macro-monitor/macro-monitor-controller.js"
  "src/api/routes/macro-monitor.js"
)

for file in "${FILES_TO_BACKUP[@]}"; do
  if [ -f "${PROJECT_ROOT}/${file}" ]; then
    cp "${PROJECT_ROOT}/${file}" "${BACKUP_DIR}/${file}"
    echo -e "${GREEN}✓ 已备份: ${file}${NC}"
  else
    echo -e "${RED}✗ 文件不存在: ${file}${NC}"
  fi
done

echo ""

# 创建迁移文件
echo -e "${YELLOW}[3/5] 创建迁移辅助文件...${NC}"

cat > "${PROJECT_ROOT}/src/services/macro-monitor/monitoring-adapter.js" << 'EOF'
/**
 * 监控数据适配器
 * 提供向后兼容的接口，内部使用UnifiedMonitoringOperations
 */

const UnifiedMonitoringOperations = require('../../database/unified-monitoring-operations');

class MonitoringAdapter {
  constructor(database) {
    this.unified = new UnifiedMonitoringOperations(database);
  }

  /**
   * 保存合约市场数据（兼容旧接口）
   */
  async saveFuturesData(dataType, source, metricName, metricValue, metricUnit, alertLevel, rawData) {
    return await this.unified.saveMonitoringData(metricName, metricValue, metricUnit, {
      dataType,
      source,
      alertLevel,
      rawData
    });
  }

  /**
   * 保存告警（兼容旧接口）
   */
  async saveAlert(alert) {
    return await this.unified.saveAlert(alert);
  }

  /**
   * 获取配置（兼容旧接口）
   */
  async getConfig(configKey = null) {
    return await this.unified.getConfig(configKey);
  }

  /**
   * 查询监控数据（兼容旧接口）
   */
  async getMonitoringData(metricName, options = {}) {
    return await this.unified.getMonitoringData(metricName, options);
  }
}

module.exports = MonitoringAdapter;
EOF

echo -e "${GREEN}✓ 已创建: src/services/macro-monitor/monitoring-adapter.js${NC}"
echo ""

# 显示需要手动修改的文件列表
echo -e "${YELLOW}[4/5] 需要手动修改的文件:${NC}"
echo ""
echo -e "${BLUE}需要在以下文件中添加适配器导入:${NC}"
echo ""

for file in "${FILES_TO_BACKUP[@]}"; do
  if [[ $file == *"monitor"*.js ]]; then
    echo -e "${YELLOW}  ${file}${NC}"
    echo -e "    1. 添加导入: const MonitoringAdapter = require('./monitoring-adapter');"
    echo -e "    2. 初始化: this.adapter = new MonitoringAdapter(database);"
    echo -e "    3. 替换调用: 将直接的数据库操作改为使用this.adapter"
    echo ""
  fi
done

# 创建代码模板
echo -e "${YELLOW}[5/5] 创建代码修改模板...${NC}"

cat > "${PROJECT_ROOT}/CODE_CHANGES_TEMPLATE.md" << 'EOF'
# 代码修改模板

## 修改模式1: 保存监控数据

### 修改前
```javascript
const query = `
  INSERT INTO macro_monitoring_data 
  (data_type, source, metric_name, metric_value, metric_unit, alert_level, raw_data)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`;
await this.database.query(query, [dataType, source, metricName, metricValue, metricUnit, alertLevel, JSON.stringify(rawData)]);
```

### 修改后
```javascript
await this.adapter.saveFuturesData(dataType, source, metricName, metricValue, metricUnit, alertLevel, rawData);
```

---

## 修改模式2: 查询监控数据

### 修改前
```javascript
const query = `
  SELECT metric_value FROM macro_monitoring_data 
  WHERE metric_name = ? 
  ORDER BY created_at DESC LIMIT 1
`;
const rows = await this.database.query(query, [metricName]);
```

### 修改后
```javascript
const rows = await this.adapter.getMonitoringData(metricName, { limit: 1 });
const metricValue = rows.length > 0 ? rows[0].metric_value : null;
```

---

## 修改模式3: 保存告警

### 修改前
```javascript
const query = `
  INSERT INTO macro_monitoring_alerts 
  (alert_type, alert_level, message, metric_name, metric_value)
  VALUES (?, ?, ?, ?, ?)
`;
await this.database.query(query, [type, level, message, metricName, metricValue]);
```

### 修改后
```javascript
await this.adapter.saveAlert({
  type,
  level,
  message,
  metricName,
  metricValue
});
```

---

## 修改模式4: 查询配置

### 修改前
```javascript
const query = 'SELECT config_key, config_value FROM macro_monitoring_config WHERE is_active = 1';
const rows = await this.database.query(query);
```

### 修改后
```javascript
const config = await this.adapter.getConfig();
```

---

## 快速替换命令（sed）

```bash
# 替换表名（谨慎使用）
sed -i 's/macro_monitoring_data/system_monitoring/g' *.js
sed -i 's/macro_monitoring_alerts/macro_alert_history/g' *.js
sed -i 's/macro_monitoring_config/system_config/g' *.js

# 添加component过滤
sed -i "s/WHERE metric_name/WHERE component = 'macro_monitor' AND metric_name/g" *.js
```

注意：sed命令可能需要手动调整，建议逐个文件检查
EOF

echo -e "${GREEN}✓ 已创建修改模板: CODE_CHANGES_TEMPLATE.md${NC}"
echo ""

# 完成提示
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  迁移准备完成${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}已完成:${NC}"
echo -e "  ✓ 备份原文件到: ${BACKUP_DIR}"
echo -e "  ✓ 创建监控适配器: src/services/macro-monitor/monitoring-adapter.js"
echo -e "  ✓ 创建修改模板: CODE_CHANGES_TEMPLATE.md"
echo ""
echo -e "${BLUE}下一步:${NC}"
echo -e "  1. 阅读 CODE_CHANGES_TEMPLATE.md 了解修改模式"
echo -e "  2. 手动修改7个macro-monitor相关文件"
echo -e "  3. 运行测试: npm test"
echo -e "  4. 启动服务测试: pm2 restart all"
echo -e "  5. 验证功能正常后执行数据库清理"
echo ""
echo -e "${YELLOW}⚠️  重要提示:${NC}"
echo -e "  - 所有原文件已备份到: ${BACKUP_DIR}"
echo -e "  - 如果出现问题可以从备份恢复"
echo -e "  - 建议先在本地环境测试，再部署到VPS"
echo ""

