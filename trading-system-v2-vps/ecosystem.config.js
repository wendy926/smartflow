module.exports = {
  apps: [
    {
      name: 'main-app',
      script: 'src/main.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '400M', // 内存超过400MB时重启
      min_uptime: '10s', // 最小运行时间
      max_restarts: 5, // 最大重启次数
      restart_delay: 4000, // 重启延迟
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/main-app-error.log',
      out_file: './logs/main-app-out.log',
      log_file: './logs/main-app-combined.log',
      time: true
    },
    {
      name: 'strategy-worker',
      script: 'src/workers/strategy-worker.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '200M', // 内存超过200MB时重启
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/strategy-worker-error.log',
      out_file: './logs/strategy-worker-out.log',
      log_file: './logs/strategy-worker-combined.log',
      time: true
    },
    {
      name: 'data-cleaner',
      script: 'src/workers/data-cleaner.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '150M',
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/data-cleaner-error.log',
      out_file: './logs/data-cleaner-out.log',
      log_file: './logs/data-cleaner-combined.log',
      time: true
    },
    {
      name: 'monitor',
      script: 'src/workers/monitor.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '150M',
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/monitor-error.log',
      out_file: './logs/monitor-out.log',
      log_file: './logs/monitor-combined.log',
      time: true
    }
  ]
};