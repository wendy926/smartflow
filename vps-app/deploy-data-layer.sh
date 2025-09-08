#!/bin/bash
# 数据层架构部署脚本

echo "🚀 开始部署数据层架构..."

# 设置颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 错误处理
set -e

# 检查是否在正确的目录
if [ ! -f "server.js" ]; then
    echo -e "${RED}❌ 错误: 请在项目根目录运行此脚本${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 步骤 1: 运行测试用例${NC}"
echo "运行数据层架构测试..."

# 运行测试用例
if node test/data-layer-tests.js; then
    echo -e "${GREEN}✅ 测试用例通过${NC}"
else
    echo -e "${RED}❌ 测试用例失败，停止部署${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 步骤 2: 检查代码质量${NC}"
echo "检查代码语法..."

# 检查主要文件的语法
for file in modules/data/*.js; do
    if [ -f "$file" ]; then
        echo "检查 $file..."
        if ! node -c "$file"; then
            echo -e "${RED}❌ 语法错误: $file${NC}"
            exit 1
        fi
    fi
done

echo -e "${GREEN}✅ 代码质量检查通过${NC}"

echo -e "${YELLOW}📋 步骤 3: 备份现有代码${NC}"
# 创建备份目录
BACKUP_DIR="backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# 备份关键文件
cp server.js "$BACKUP_DIR/"
cp -r modules/data "$BACKUP_DIR/"
cp -r modules/database "$BACKUP_DIR/"

echo -e "${GREEN}✅ 代码备份完成: $BACKUP_DIR${NC}"

echo -e "${YELLOW}📋 步骤 4: 更新数据库架构${NC}"
echo "更新数据库表结构..."

# 运行数据库架构更新
if node -e "
const { DatabaseSchemaUpdater } = require('./modules/database/DatabaseSchemaUpdater');
const DatabaseManager = require('./modules/database/DatabaseManager');

async function updateSchema() {
    try {
        const db = new DatabaseManager();
        await db.init();
        
        const updater = new DatabaseSchemaUpdater(db);
        await updater.performFullUpdate();
        
        console.log('✅ 数据库架构更新完成');
        await db.close();
    } catch (error) {
        console.error('❌ 数据库架构更新失败:', error);
        process.exit(1);
    }
}

updateSchema();
"; then
    echo -e "${GREEN}✅ 数据库架构更新完成${NC}"
else
    echo -e "${RED}❌ 数据库架构更新失败${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 步骤 5: 重启服务${NC}"
echo "重启 PM2 服务..."

# 重启 PM2 服务
if pm2 restart smartflow-app; then
    echo -e "${GREEN}✅ 服务重启成功${NC}"
else
    echo -e "${RED}❌ 服务重启失败${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 步骤 6: 验证部署${NC}"
echo "等待服务启动..."
sleep 10

# 检查服务状态
if pm2 status smartflow-app | grep -q "online"; then
    echo -e "${GREEN}✅ 服务运行正常${NC}"
else
    echo -e "${RED}❌ 服务未正常运行${NC}"
    pm2 logs smartflow-app --lines 20
    exit 1
fi

# 检查数据层健康状态
echo "检查数据层健康状态..."
if curl -s http://localhost:8080/api/data-layer-health | grep -q "healthy"; then
    echo -e "${GREEN}✅ 数据层健康检查通过${NC}"
else
    echo -e "${YELLOW}⚠️ 数据层健康检查异常，请检查日志${NC}"
    curl -s http://localhost:8080/api/data-layer-health
fi

echo -e "${YELLOW}📋 步骤 7: 性能测试${NC}"
echo "运行性能测试..."

# 简单的性能测试
start_time=$(date +%s%3N)
for i in {1..10}; do
    curl -s http://localhost:8080/api/data-layer-status > /dev/null
done
end_time=$(date +%s%3N)
duration=$((end_time - start_time))

echo "10次API调用耗时: ${duration}ms"
if [ $duration -lt 5000 ]; then
    echo -e "${GREEN}✅ 性能测试通过${NC}"
else
    echo -e "${YELLOW}⚠️ 性能可能较慢，请监控${NC}"
fi

echo -e "${GREEN}🎉 数据层架构部署完成！${NC}"
echo ""
echo "📊 部署信息:"
echo "  - 备份目录: $BACKUP_DIR"
echo "  - 服务状态: $(pm2 status smartflow-app --no-color | grep smartflow-app | awk '{print $10}')"
echo "  - 健康检查: http://localhost:8080/api/data-layer-health"
echo "  - 状态监控: http://localhost:8080/api/data-layer-status"
echo ""
echo "🔍 监控命令:"
echo "  - 查看日志: pm2 logs smartflow-app"
echo "  - 查看状态: pm2 status"
echo "  - 重启服务: pm2 restart smartflow-app"
echo ""
echo "📈 新功能:"
echo "  - 内存缓存系统"
echo "  - 数据一致性检查"
echo "  - 自动数据持久化"
echo "  - 性能监控"
