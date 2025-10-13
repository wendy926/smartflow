module.exports = {
  apps: [
    {
      name: 'main-app',
      script: './src/main.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '150M',  // 提升内存限制（WebSocket需要更多内存）
      node_args: '--max-old-space-size=150',
      env: {
        NODE_ENV: 'production',
        MEMORY_LIMIT: '150',  // 更新环境变量
        PORT: 8080
      },
      error_file: './logs/main-app-error.log',
      out_file: './logs/main-app-out.log',
      log_file: './logs/main-app-combined.log',
      time: true
    },
    {
      name: 'strategy-worker',
      script: './src/workers/strategy-worker.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '100M',
      node_args: '--max-old-space-size=100',
      cron_restart: '*/5 * * * *',
      env: {
        NODE_ENV: 'production',
        MEMORY_LIMIT: '150',
        BATCH_SIZE: '5',
        MAX_SYMBOLS: '50'
      },
      error_file: './logs/strategy-worker-error.log',
      out_file: './logs/strategy-worker-out.log',
      log_file: './logs/strategy-worker-combined.log',
      time: true
    },
    {
      name: 'data-cleaner',
      script: './src/workers/data-cleaner.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '50M',  // 从30M提升到50M（减少重启）
      node_args: '--max-old-space-size=50 --optimize-for-size',
      cron_restart: '0 2 * * *',  // 每天凌晨2点重启
      env: {
        NODE_ENV: 'production',
        MEMORY_LIMIT: '50'
      },
      error_file: './logs/data-cleaner-error.log',
      out_file: './logs/data-cleaner-out.log',
      log_file: './logs/data-cleaner-combined.log',
      time: true,
      autorestart: true,
      max_restarts: 10,  // 1小时内最多重启10次
      min_uptime: '10s'  // 至少运行10秒才算成功启动
    },
    {
      name: 'monitor',
      script: './src/workers/monitor.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '80M',  // 从50M提升到80M（观察到实际使用62MB）
      node_args: '--max-old-space-size=80 --optimize-for-size --gc-interval=100',
      env: {
        NODE_ENV: 'production',
        MEMORY_LIMIT: '80'
      },
      error_file: './logs/monitor-error.log',
      out_file: './logs/monitor-out.log',
      log_file: './logs/monitor-combined.log',
      time: true,
      autorestart: true,
      max_restarts: 10,  // 1小时内最多重启10次
      min_uptime: '10s'  // 至少运行10秒才算成功启动
    }
  ]
};
