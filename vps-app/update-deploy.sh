#!/bin/bash

# SmartFlow VPS 更新部署脚本 v2.1
# 使用方法: ./update-deploy.sh [git-branch]
# 默认分支: main

set -e  # 遇到错误立即退出

# 获取分支参数，默认为 main
BRANCH=${1:-main}

echo "🚀 开始更新部署 SmartFlow 应用 v2.1..."
echo "📋 目标分支: $BRANCH"

# 检查是否在正确的目录
if [ ! -f "server.js" ]; then
    echo "❌ 错误: 请在 vps-app 目录中运行此脚本"
    exit 1
fi

# 检查 Git 是否安装
if ! command -v git &> /dev/null; then
    echo "❌ 错误: 需要安装 Git"
    echo "安装命令: sudo apt update && sudo apt install git -y"
    exit 1
fi

# 检查是否在 Git 仓库中
if [ ! -d ".git" ]; then
    echo "❌ 错误: 当前目录不是 Git 仓库"
    echo "请先克隆仓库: git clone <repository-url> ."
    exit 1
fi

# 检查 Node.js 版本
echo "🔍 检查 Node.js 版本..."
node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$node_version" -lt 18 ]; then
    echo "❌ 错误: 需要 Node.js 18 或更高版本，当前版本: $(node --version)"
    echo "安装命令: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs"
    exit 1
fi
echo "✅ Node.js 版本: $(node --version)"

# 停止现有应用
echo "🛑 停止现有应用..."
pm2 stop smartflow-app 2>/dev/null || true

# 备份当前版本
echo "💾 备份当前版本..."
BACKUP_DIR="backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "../backups/$BACKUP_DIR"
cp -r . "../backups/$BACKUP_DIR/" 2>/dev/null || true
echo "✅ 当前版本已备份到: ../backups/$BACKUP_DIR"

# 备份数据库
echo "💾 备份数据库..."
if [ -f "smartflow.db" ]; then
    cp smartflow.db "smartflow.db.backup.$(date +%Y%m%d_%H%M%S)"
    echo "✅ 数据库已备份"
fi

# 获取最新代码
echo "📥 获取最新代码..."
echo "🔄 拉取分支 $BRANCH 的最新代码..."

# 保存当前修改
git stash push -m "Auto-stash before update $(date)" || true

# 获取最新代码
git fetch origin
git checkout $BRANCH
git pull origin $BRANCH

echo "✅ 代码更新完成"

# 检查关键文件是否存在
echo "🔍 检查关键文件..."
required_files=(
    "server.js"
    "package.json"
    "ecosystem.config.js"
    "modules/database/DatabaseManager.js"
    "modules/strategy/SmartFlowStrategy.js"
    "modules/monitoring/DataMonitor.js"
    "public/css/main.css"
    "public/js/main.js"
    "public/js/api.js"
    "public/js/data/DataManager.js"
)

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ 错误: 缺少必要文件 $file"
        echo "请检查代码是否完整"
        exit 1
    fi
done
echo "✅ 所有关键文件检查通过"

# 安装/更新依赖
echo "📦 安装/更新依赖..."
npm install --production

# 检查 PM2 是否安装
if ! command -v pm2 &> /dev/null; then
    echo "📦 安装 PM2..."
    npm install -g pm2
fi

# 清理旧日志
echo "🧹 清理旧日志..."
pm2 flush 2>/dev/null || true

# 启动应用
echo "▶️ 启动应用..."
pm2 start ecosystem.config.js

# 等待应用启动
echo "⏳ 等待应用启动..."
sleep 8

# 检查应用状态
echo "🔍 检查应用状态..."
if pm2 list | grep -q "smartflow-app.*online"; then
    echo "✅ 应用启动成功！"
    
    # 显示应用信息
    echo ""
    echo "📊 应用状态:"
    pm2 list | grep smartflow-app
    
    # 检查端口是否监听
    if netstat -tlnp 2>/dev/null | grep -q ":8080"; then
        echo "✅ 端口 8080 正在监听"
    else
        echo "⚠️ 警告: 端口 8080 未监听，请检查应用日志"
    fi
    
else
    echo "❌ 应用启动失败，查看日志："
    pm2 logs smartflow-app --lines 30
    exit 1
fi

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup | grep -v "sudo" || true

# 显示部署信息
echo ""
echo "🎉 更新部署完成！"
echo "📋 部署信息:"
echo "   - 分支: $BRANCH"
echo "   - 时间: $(date)"
echo "   - 备份: ../backups/$BACKUP_DIR"
echo ""
echo "🔧 管理命令:"
echo "   - 查看状态: pm2 status"
echo "   - 查看日志: pm2 logs smartflow-app"
echo "   - 重启应用: pm2 restart smartflow-app"
echo "   - 停止应用: pm2 stop smartflow-app"
echo ""
echo "🌐 访问地址:"
echo "   - 主页: http://$(hostname -I | awk '{print $1}'):8080"
echo "   - 测试页面: http://$(hostname -I | awk '{print $1}'):8080/test-iphone.html"
echo ""
echo "📱 iPhone 16 Pro Max 适配:"
echo "   - 竖屏模式: 430×932 像素"
echo "   - 横屏模式: 932×430 像素"
echo "   - 触摸优化: 44px 最小点击区域"
echo "   - 响应式设计: 自动适配屏幕方向"
echo ""

# 检查新功能
echo "🆕 本次更新包含:"
echo "   - iPhone 16 Pro Max 竖屏和横屏适配"
echo "   - 统一监控中心性能优化"
echo "   - 数据更新时机修复 (趋势4H、信号1H、执行15min)"
echo "   - 触摸交互体验优化"
echo "   - 响应式布局改进"
echo ""

# 运行健康检查
echo "🏥 运行健康检查..."
sleep 2

# 检查应用响应
if curl -s -f http://localhost:8080/api/health-check > /dev/null 2>&1; then
    echo "✅ 健康检查通过"
else
    echo "⚠️ 健康检查失败，应用可能还在启动中"
fi

echo "✨ 部署完成！应用已成功更新并运行。"
