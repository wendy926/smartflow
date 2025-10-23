module.exports = {
  apps: [
    {
      name: 'minimal-app',
      script: './src/main-minimal.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '30M',
      node_args: '--max-old-space-size=30',
      env: {
        NODE_ENV: 'production',
        PORT: 8080
      },
      error_file: './logs/minimal-app-error.log',
      out_file: './logs/minimal-app-out.log',
      log_file: './logs/minimal-app-combined.log',
      time: true,
      // 禁用自动重启
      autorestart: false,
      // 禁用监控
      watch: false
    }
  ]
};
