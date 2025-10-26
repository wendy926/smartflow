#!/bin/bash

# 通用交易系统部署脚本
# 支持SG/CN机房部署

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查依赖
check_dependencies() {
    log_info "检查系统依赖..."

    # 检查Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker未安装，请先安装Docker"
        exit 1
    fi

    # 检查Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose未安装，请先安装Docker Compose"
        exit 1
    fi

    # 检查Node.js
    if ! command -v node &> /dev/null; then
        log_warning "Node.js未安装，将使用Docker容器中的Node.js"
    fi

    log_success "依赖检查完成"
}

# 检查环境变量
check_env() {
    log_info "检查环境变量..."

    if [ ! -f ".env" ]; then
        log_warning ".env文件不存在，从env.example复制..."
        cp env.example .env
        log_warning "请编辑.env文件并填入正确的配置值"
        exit 1
    fi

    # 检查必要的环境变量
    required_vars=(
        "MYSQL_PASSWORD"
        "REDIS_PASSWORD"
        "DEEPSEEK_API_KEY"
    )

    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            log_error "环境变量 $var 未设置"
            exit 1
        fi
    done

    log_success "环境变量检查完成"
}

# 创建必要的目录
create_directories() {
    log_info "创建必要的目录..."

    mkdir -p logs
    mkdir -p data
    mkdir -p config/mysql
    mkdir -p config/prometheus
    mkdir -p config/grafana/provisioning

    log_success "目录创建完成"
}

# 创建MySQL初始化脚本
create_mysql_init() {
    log_info "创建MySQL初始化脚本..."

    cat > config/mysql/init.sql << 'EOF'
-- 创建交易系统数据库表
CREATE DATABASE IF NOT EXISTS trading_sg;
CREATE DATABASE IF NOT EXISTS trading_cn;

-- 使用trading_sg数据库
USE trading_sg;

-- 创建市场数据表
CREATE TABLE IF NOT EXISTS market_data (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    timestamp DATETIME NOT NULL,
    open DECIMAL(20,8) NOT NULL,
    high DECIMAL(20,8) NOT NULL,
    low DECIMAL(20,8) NOT NULL,
    close DECIMAL(20,8) NOT NULL,
    volume DECIMAL(20,8) NOT NULL,
    market_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_symbol_timeframe (symbol, timeframe),
    INDEX idx_timestamp (timestamp)
);

-- 创建交易记录表
CREATE TABLE IF NOT EXISTS trades (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    strategy VARCHAR(50) NOT NULL,
    side ENUM('BUY', 'SELL') NOT NULL,
    quantity DECIMAL(20,8) NOT NULL,
    entry_price DECIMAL(20,8) NOT NULL,
    exit_price DECIMAL(20,8),
    entry_time DATETIME NOT NULL,
    exit_time DATETIME,
    pnl DECIMAL(20,8),
    status ENUM('OPEN', 'CLOSED', 'CANCELLED') NOT NULL,
    market_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_symbol_strategy (symbol, strategy),
    INDEX idx_entry_time (entry_time)
);

-- 创建AI分析记录表
CREATE TABLE IF NOT EXISTS ai_analysis (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    analysis_type VARCHAR(50) NOT NULL,
    result JSON NOT NULL,
    confidence DECIMAL(5,2),
    ai_provider VARCHAR(50) NOT NULL,
    region VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_symbol_type (symbol, analysis_type),
    INDEX idx_created_at (created_at)
);

-- 使用trading_cn数据库
USE trading_cn;

-- 复制相同的表结构
CREATE TABLE IF NOT EXISTS market_data (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    timestamp DATETIME NOT NULL,
    open DECIMAL(20,8) NOT NULL,
    high DECIMAL(20,8) NOT NULL,
    low DECIMAL(20,8) NOT NULL,
    close DECIMAL(20,8) NOT NULL,
    volume DECIMAL(20,8) NOT NULL,
    market_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_symbol_timeframe (symbol, timeframe),
    INDEX idx_timestamp (timestamp)
);

CREATE TABLE IF NOT EXISTS trades (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    strategy VARCHAR(50) NOT NULL,
    side ENUM('BUY', 'SELL') NOT NULL,
    quantity DECIMAL(20,8) NOT NULL,
    entry_price DECIMAL(20,8) NOT NULL,
    exit_price DECIMAL(20,8),
    entry_time DATETIME NOT NULL,
    exit_time DATETIME,
    pnl DECIMAL(20,8),
    status ENUM('OPEN', 'CLOSED', 'CANCELLED') NOT NULL,
    market_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_symbol_strategy (symbol, strategy),
    INDEX idx_entry_time (entry_time)
);

CREATE TABLE IF NOT EXISTS ai_analysis (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    analysis_type VARCHAR(50) NOT NULL,
    result JSON NOT NULL,
    confidence DECIMAL(5,2),
    ai_provider VARCHAR(50) NOT NULL,
    region VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_symbol_type (symbol, analysis_type),
    INDEX idx_created_at (created_at)
);
EOF

    log_success "MySQL初始化脚本创建完成"
}

# 创建Prometheus配置
create_prometheus_config() {
    log_info "创建Prometheus配置..."

    cat > config/prometheus/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  # - "first_rules.yml"
  # - "second_rules.yml"

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'trading-system'
    static_configs:
      - targets: ['trading-system-sg:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'mysql'
    static_configs:
      - targets: ['mysql-sg:3306']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-sg:6379']
EOF

    log_success "Prometheus配置创建完成"
}

# 构建Docker镜像
build_image() {
    log_info "构建Docker镜像..."

    docker build -t trading-system:latest .

    log_success "Docker镜像构建完成"
}

# 部署SG机房
deploy_sg() {
    log_info "部署SG机房..."

    # 设置环境变量
    export REGION=SG

    # 启动服务
    docker-compose -f docker-compose.sg.yml up -d

    # 等待服务启动
    log_info "等待服务启动..."
    sleep 30

    # 检查服务状态
    check_services "sg"

    log_success "SG机房部署完成"
}

# 部署CN机房
deploy_cn() {
    log_info "部署CN机房..."

    # 设置环境变量
    export REGION=CN

    # 启动服务
    docker-compose -f docker-compose.cn.yml up -d

    # 等待服务启动
    log_info "等待服务启动..."
    sleep 30

    # 检查服务状态
    check_services "cn"

    log_success "CN机房部署完成"
}

# 检查服务状态
check_services() {
    local region=$1
    log_info "检查${region}机房服务状态..."

    # 检查容器状态
    docker-compose -f docker-compose.${region}.yml ps

    # 检查健康状态
    local container_name="trading-system-${region}"
    local health_status=$(docker inspect --format='{{.State.Health.Status}}' $container_name 2>/dev/null || echo "unknown")

    if [ "$health_status" = "healthy" ]; then
        log_success "${region}机房服务健康"
    else
        log_warning "${region}机房服务状态: $health_status"
    fi
}

# 运行测试
run_tests() {
    log_info "运行单元测试..."

    # 检查是否有测试文件
    if [ -d "tests" ] || [ -d "__tests__" ]; then
        # 在容器中运行测试
        local region=${REGION:-sg}
        docker exec trading-system-${region} npm test

        log_success "测试完成"
    else
        log_warning "未找到测试文件，跳过测试"
    fi
}

# 显示服务信息
show_info() {
    log_info "服务信息:"
    echo "Web界面: http://localhost:3000"
    echo "健康检查: http://localhost:3000/health"
    echo "Prometheus: http://localhost:9090"
    echo "Grafana: http://localhost:3001"
    echo ""
    echo "查看日志: docker-compose -f docker-compose.${REGION:-sg}.yml logs -f"
    echo "停止服务: docker-compose -f docker-compose.${REGION:-sg}.yml down"
}

# 主函数
main() {
    log_info "开始部署通用交易系统..."

    # 解析命令行参数
    REGION=${1:-sg}

    case $REGION in
        sg|SG)
            REGION="sg"
            ;;
        cn|CN)
            REGION="cn"
            ;;
        *)
            log_error "无效的区域参数: $REGION"
            log_info "使用方法: $0 [sg|cn]"
            exit 1
            ;;
    esac

    log_info "部署区域: $REGION"

    # 执行部署步骤
    check_dependencies
    check_env
    create_directories
    create_mysql_init
    create_prometheus_config
    build_image

    if [ "$REGION" = "sg" ]; then
        deploy_sg
    else
        deploy_cn
    fi

    # 等待服务完全启动
    log_info "等待服务完全启动..."
    sleep 60

    # 运行测试
    run_tests

    # 显示服务信息
    show_info

    log_success "部署完成！"
}

# 执行主函数
main "$@"
