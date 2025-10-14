#!/bin/bash

# Nginx连接监控脚本
# 用于监控nginx连接状态和自动重启

LOG_FILE="/var/log/nginx-monitor.log"
ERROR_THRESHOLD=5  # 5分钟内超过5个连接错误就重启nginx
CHECK_INTERVAL=60  # 检查间隔60秒

log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> $LOG_FILE
}

check_nginx_connections() {
    # 检查nginx错误日志中的连接错误
    local error_count=$(tail -100 /var/log/nginx/error.log | grep -c "connect() failed.*Connection refused" 2>/dev/null || echo 0)
    echo $error_count
}

check_app_health() {
    # 检查应用健康状态
    local health_response=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/health 2>/dev/null || echo "000")
    if [ "$health_response" = "200" ]; then
        return 0  # 健康
    else
        return 1  # 不健康
    fi
}

restart_nginx() {
    log_message "重启nginx服务..."
    systemctl restart nginx
    sleep 5
    
    if systemctl is-active --quiet nginx; then
        log_message "nginx重启成功"
        return 0
    else
        log_message "nginx重启失败"
        return 1
    fi
}

restart_main_app() {
    log_message "重启main-app服务..."
    pm2 restart main-app
    sleep 10
    
    if pm2 list | grep -q "main-app.*online"; then
        log_message "main-app重启成功"
        return 0
    else
        log_message "main-app重启失败"
        return 1
    fi
}

# 主监控循环
log_message "nginx监控脚本启动"

while true; do
    error_count=$(check_nginx_connections)
    
    if [ $error_count -gt $ERROR_THRESHOLD ]; then
        log_message "检测到${error_count}个连接错误，超过阈值${ERROR_THRESHOLD}"
        
        # 检查应用健康状态
        if ! check_app_health; then
            log_message "应用健康检查失败，重启main-app"
            restart_main_app
            sleep 30
        fi
        
        # 重启nginx
        restart_nginx
        
        # 重置错误计数（清空最近的错误日志）
        echo "" > /var/log/nginx/error.log
    fi
    
    sleep $CHECK_INTERVAL
done
