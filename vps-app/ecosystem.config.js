// ecosystem.config.js - PM2配置文件

module.exports = {
  apps: [{
    name: 'smartflow-app',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',

    // 内存管理
    max_memory_restart: '300M', // 内存超过300MB时重启
    min_uptime: '10s', // 最小运行时间
    max_restarts: 10, // 最大重启次数

    // 环境变量
    env: {
      NODE_ENV: 'production',
      PORT: 8080
    },

    // 日志配置
    log_file: '/var/log/smartflow/app.log',
    out_file: '/var/log/smartflow/out.log',
    error_file: '/var/log/smartflow/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

    // 监控配置
    monitoring: true,

    // 自动重启配置
    autorestart: true,
    watch: false,

    // 内存监控
    node_args: '--max-old-space-size=256', // 限制V8堆内存为256MB

    // 进程管理
    kill_timeout: 5000, // 5秒超时
    listen_timeout: 3000, // 3秒监听超时

    // 健康检查
    health_check_grace_period: 3000,

    // 内存清理
    cron_restart: '0 2 * * *', // 每天凌晨2点重启

    // 环境变量
    env_production: {
      NODE_ENV: 'production',
      PORT: 8080,
      MEMORY_LIMIT: '256MB'
    }
  }],

  // 部署配置
  deploy: {
    production: {
      user: 'root',
      host: '47.237.163.85',
      ref: 'origin/main',
      repo: 'https://github.com/wendy926/smartflow.git',
      path: '/home/admin/smartflow-vps-app',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production'
    }
  }
};