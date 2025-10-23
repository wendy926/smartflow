#!/bin/bash

# MySQL内存优化脚本
echo "开始优化MySQL内存使用..."

# 停止MySQL
systemctl stop mysql

# 创建优化的配置文件
cat > /etc/mysql/mysql.conf.d/50-memory-optimized.cnf << 'EOF'
[mysqld]
# 内存优化配置
innodb_buffer_pool_size = 64M
key_buffer_size = 8M
innodb_log_buffer_size = 8M
innodb_log_file_size = 16M
innodb_log_files_in_group = 2

# 连接优化
max_connections = 20
max_connect_errors = 1000

# 临时表优化
tmp_table_size = 8M
max_heap_table_size = 8M

# 缓冲区优化
sort_buffer_size = 128K
read_buffer_size = 64K
read_rnd_buffer_size = 128K
join_buffer_size = 128K

# 关闭性能模式
performance_schema = OFF

# 关闭慢查询日志
slow_query_log = 0

# 关闭二进制日志
log_bin = OFF
EOF

# 启动MySQL
systemctl start mysql

# 等待MySQL启动
sleep 5

# 检查MySQL状态
if systemctl is-active --quiet mysql; then
    echo "MySQL优化成功！"
    echo "当前内存使用情况："
    free -h
    echo ""
    echo "MySQL进程内存使用："
    ps aux --sort=-%mem | grep mysql | head -3
else
    echo "MySQL启动失败，恢复原配置..."
    rm -f /etc/mysql/mysql.conf.d/50-memory-optimized.cnf
    systemctl start mysql
fi
